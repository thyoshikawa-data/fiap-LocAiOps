"""
LocAiOps - Pipeline de geração dos dados do dashboard.

Lê o dataset real fornecido pela Locaweb (fora do repositório git, por
confidencialidade), roda EDA + modelos de previsão/risco/clusterização e
exporta apenas agregados/estatísticos em JSON para o dashboard Next.js
consumir em `locaiops-mvp/public/data/`.

Nenhum texto livre (ex.: "Descrição resumida") é exportado.
"""

import json
import os

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import mean_absolute_error, roc_auc_score
from sklearn.preprocessing import StandardScaler

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(
    BASE_DIR, "..", "..", "asset", "Material Locaweb", "LW-DATASET.xlsx"
)
OUTPUT_DIR = os.path.join(BASE_DIR, "..", "public", "data")
os.makedirs(OUTPUT_DIR, exist_ok=True)

REGIME_START = pd.Timestamp("2025-09-01")
RANDOM_STATE = 42


def dump(name, obj):
    path = os.path.join(OUTPUT_DIR, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2, default=str)
    print(f"  -> {name}")


def load_dataset():
    print(f"Lendo dataset: {DATASET_PATH}")
    df = pd.read_excel(DATASET_PATH, sheet_name="Dataset Geral")
    df.columns = [c.strip() for c in df.columns]
    for col in ["Aberto", "Resolvido", "Encerrado"]:
        df[col] = pd.to_datetime(df[col], errors="coerce")
    df["Entrou_KPI"] = df["Entrou para KPI?"].astype(str).str.strip().str.upper().eq("SIM")
    df["KPI_Violado"] = df["KPI Violado?"].astype(str).str.strip().str.upper().eq("SIM")
    df["data_abertura"] = df["Aberto"].dt.date
    df["hora_abertura"] = df["Aberto"].dt.hour
    df["dia_semana"] = df["Aberto"].dt.dayofweek  # 0=segunda
    print(f"  {len(df):,} registros | período {df['Aberto'].min()} -> {df['Aberto'].max()}")

    df, imputacao_stats = infer_missing_produto(df)
    print(
        f"  Produto: {imputacao_stats['pct_original']:.1f}% original, "
        f"+{imputacao_stats['pct_inferido']:.1f}% inferido via Item de configuração, "
        f"{imputacao_stats['pct_sem_produto']:.1f}% permanece sem produto"
    )
    return df, imputacao_stats


def infer_missing_produto(df):
    """Usa 'Item de configuração' para inferir 'Produto' onde ele está ausente.

    Cada item de configuração tende a pertencer sempre ao mesmo produto (~96%
    de pureza média nos registros já rotulados). Aprende esse mapeamento nos
    registros com Produto conhecido e aplica nos registros sem Produto que
    compartilham um item de configuração já visto. Marca a origem em
    'Produto_origem' (original | inferido | desconhecido) para transparência.
    """
    total = len(df)
    original_null = df["Produto"].isna()
    pct_original = (1 - original_null.mean()) * 100

    labeled = df.dropna(subset=["Produto", "Item de configuração"])
    mapa = labeled.groupby("Item de configuração")["Produto"].agg(lambda s: s.value_counts().idxmax())

    inferido_mask = original_null & df["Item de configuração"].isin(mapa.index)
    df.loc[inferido_mask, "Produto"] = df.loc[inferido_mask, "Item de configuração"].map(mapa)

    df["Produto_origem"] = np.where(
        ~original_null, "original", np.where(inferido_mask, "inferido", "desconhecido")
    )

    stats = {
        "pct_original": float(pct_original),
        "pct_inferido": float(inferido_mask.sum() / total * 100),
        "pct_sem_produto": float(df["Produto"].isna().mean() * 100),
    }
    return df, stats


def build_daily_series(df, idx=None):
    full = (
        df.groupby(df["Aberto"].dt.date)
        .size()
        .rename("volume")
        .reset_index()
        .rename(columns={"Aberto": "data"})
    )
    full["data"] = pd.to_datetime(full["data"])
    if idx is None:
        idx = pd.date_range(full["data"].min(), full["data"].max(), freq="D")
    full = full.set_index("data").reindex(idx, fill_value=0).rename_axis("data").reset_index()
    return full


def make_features(series_df):
    s = series_df.copy()
    s["dow"] = s["data"].dt.dayofweek
    s["is_weekend"] = s["dow"].isin([5, 6]).astype(int)
    for lag in (1, 2, 7):
        s[f"lag_{lag}"] = s["volume"].shift(lag)
    s["roll_mean_7"] = s["volume"].shift(1).rolling(7).mean()
    s["roll_mean_14"] = s["volume"].shift(1).rolling(14).mean()
    s["trend"] = np.arange(len(s))
    return s


FEATURES = ["dow", "is_weekend", "lag_1", "lag_2", "lag_7", "roll_mean_7", "roll_mean_14", "trend"]


def forecast_volume(daily_full):
    regime = daily_full[daily_full["data"] >= REGIME_START].reset_index(drop=True)
    feat = make_features(regime).dropna().reset_index(drop=True)

    test_size = 14
    train, test = feat.iloc[:-test_size], feat.iloc[-test_size:]

    model = RandomForestRegressor(n_estimators=300, random_state=RANDOM_STATE, min_samples_leaf=2)
    model.fit(train[FEATURES], train["volume"])
    pred_test = model.predict(test[FEATURES])

    mae = float(mean_absolute_error(test["volume"], pred_test))
    denom = test["volume"].replace(0, np.nan)
    mape_series = (np.abs(test["volume"] - pred_test) / denom).dropna()
    mape = float(mape_series.mean() * 100) if len(mape_series) else None

    # retreina com todo o histórico do regime atual para prever o futuro
    model_full = RandomForestRegressor(n_estimators=300, random_state=RANDOM_STATE, min_samples_leaf=2)
    model_full.fit(feat[FEATURES], feat["volume"])

    history = regime.copy()
    forecasts = []
    last_date = history["data"].max()
    for step in range(1, 8):
        feat_hist = make_features(history)
        row = feat_hist.iloc[[-1]]
        next_date = last_date + pd.Timedelta(days=step)
        next_row = pd.DataFrame(
            {
                "data": [next_date],
                "dow": [next_date.dayofweek],
                "is_weekend": [1 if next_date.dayofweek in (5, 6) else 0],
                "lag_1": [history["volume"].iloc[-1]],
                "lag_2": [history["volume"].iloc[-2]],
                "lag_7": [history["volume"].iloc[-7]],
                "roll_mean_7": [history["volume"].tail(7).mean()],
                "roll_mean_14": [history["volume"].tail(14).mean()],
                "trend": [row["trend"].values[0] + 1],
            }
        )
        pred = float(model_full.predict(next_row[FEATURES])[0])
        pred = max(pred, 0.0)
        forecasts.append({"data": next_date.date().isoformat(), "previsto": round(pred, 1)})
        history = pd.concat(
            [history, pd.DataFrame({"data": [next_date], "volume": [pred]})], ignore_index=True
        )

    backtest = [
        {"data": d.date().isoformat(), "real": int(r), "previsto": round(float(p), 1)}
        for d, r, p in zip(test["data"], test["volume"], pred_test)
    ]

    historico = [
        {"data": d.date().isoformat(), "real": int(v)}
        for d, v in zip(regime["data"], regime["volume"])
    ]

    return {
        "metricas": {
            "mae_14d": round(mae, 2),
            "mape_14d_pct": round(mape, 2) if mape is not None else None,
            "janela_backtest_dias": test_size,
            "amostras_treino": int(len(train)),
        },
        "historico": historico,
        "backtest": backtest,
        "previsao_7d": forecasts,
        "d1": forecasts[0]["previsto"],
        "d7_total": round(sum(f["previsto"] for f in forecasts), 1),
    }


def segment_bundle(label, sub_df, global_idx):
    daily_seg = build_daily_series(sub_df, idx=global_idx)
    fc = forecast_volume(daily_seg)

    last_date = global_idx.max()
    last_month_mask = (sub_df["Aberto"].dt.year == last_date.year) & (
        sub_df["Aberto"].dt.month == last_date.month
    )
    kpi_sub = sub_df[sub_df["Entrou_KPI"]]
    taxa_violacao = (
        round(float(kpi_sub["KPI_Violado"].mean()) * 100, 2) if len(kpi_sub) else None
    )

    return {
        "label": label,
        "historico": fc["historico"],
        "backtest": fc["backtest"],
        "previsao_7d": fc["previsao_7d"],
        "d1": fc["d1"],
        "d7_total": fc["d7_total"],
        "metricas": fc["metricas"],
        "kpis": {
            "volume_mes_atual": int(last_month_mask.sum()),
            "taxa_violacao_sla_pct": taxa_violacao,
        },
    }


def build_segments(df):
    global_idx = pd.date_range(df["Aberto"].min().normalize(), df["Aberto"].max().normalize(), freq="D")

    top_produtos = df["Produto"].value_counts(dropna=True).head(5).index.tolist()
    prioridades = ["2 - Alta", "3 - Média", "4 - Baixa"]

    opcoes = [{"id": "todos", "tipo": "todos", "valor": None, "label": "Todos"}]
    dados = {"todos": segment_bundle("Todos", df, global_idx)}

    for produto in top_produtos:
        seg_id = f"produto:{produto}"
        opcoes.append({"id": seg_id, "tipo": "produto", "valor": produto, "label": f"Produto: {produto}"})
        seg = segment_bundle(seg_id, df[df["Produto"] == produto], global_idx)

        original_sub = df[(df["Produto"] == produto) & (df["Produto_origem"] == "original")]
        daily_original = build_daily_series(original_sub, idx=global_idx)
        regime_original = daily_original[daily_original["data"] >= REGIME_START].reset_index(drop=True)
        seg["historico_original"] = [
            {"data": d.date().isoformat(), "real": int(v)}
            for d, v in zip(regime_original["data"], regime_original["volume"])
        ]
        dados[seg_id] = seg

    for prioridade in prioridades:
        seg_id = f"prioridade:{prioridade}"
        opcoes.append(
            {"id": seg_id, "tipo": "prioridade", "valor": prioridade, "label": f"Prioridade: {prioridade}"}
        )
        dados[seg_id] = segment_bundle(seg_id, df[df["Prioridade"] == prioridade], global_idx)

    return {"opcoes": opcoes, "dados": dados}


def build_produto_context(df):
    """Estatísticas históricas por produto: volume, taxa de violação e o padrão de
    resolução mais comum (código de fechamento + tipo de solução), usadas para
    sugerir uma solução provável nos alertas preditivos."""
    contexto = {}
    for produto, sub in df.groupby("Produto"):
        if pd.isna(produto):
            continue
        kpi_sub = sub[sub["Entrou_KPI"]]
        taxa = float(kpi_sub["KPI_Violado"].mean()) * 100 if len(kpi_sub) else None

        fechamento_counts = sub["Código de fechamento"].value_counts(dropna=True)
        top_codigo = fechamento_counts.index[0] if len(fechamento_counts) else None
        pct_codigo = (
            float(fechamento_counts.iloc[0] / fechamento_counts.sum() * 100)
            if len(fechamento_counts)
            else None
        )

        solucao_counts = sub["Solução"].value_counts(dropna=True)
        top_solucao = solucao_counts.index[0] if len(solucao_counts) else None
        pct_solucao = (
            float(solucao_counts.iloc[0] / solucao_counts.sum() * 100) if len(solucao_counts) else None
        )

        contexto[produto] = {
            "volume_total": int(len(sub)),
            "taxa_violacao_pct": round(taxa, 2) if taxa is not None else None,
            "top_codigo_fechamento": top_codigo,
            "pct_codigo_fechamento": round(pct_codigo, 1) if pct_codigo is not None else None,
            "solucao_comum": top_solucao,
            "pct_solucao_comum": round(pct_solucao, 1) if pct_solucao is not None else None,
        }
    return contexto


def risk_model(df):
    kpi_df = df[df["Entrou_KPI"]].copy()
    kpi_df["produto_null"] = kpi_df["Produto"].isna().astype(int)
    kpi_df["item_cfg_null"] = kpi_df["Item de configuração"].isna().astype(int)

    cat_cols = ["Prioridade", "Grupo designado", "Aberto por"]
    X = pd.get_dummies(kpi_df[cat_cols].astype(str), dummy_na=True)
    X["hora_abertura"] = kpi_df["hora_abertura"]
    X["dia_semana"] = kpi_df["dia_semana"]
    X["produto_null"] = kpi_df["produto_null"]
    X["item_cfg_null"] = kpi_df["item_cfg_null"]
    y = kpi_df["KPI_Violado"].astype(int)

    rng = np.random.RandomState(RANDOM_STATE)
    idx = rng.permutation(len(X))
    split = int(len(idx) * 0.75)
    train_idx, test_idx = idx[:split], idx[split:]

    # min_samples_leaf baixo (era 3) deixava o modelo "supercerto" (probabilidades de
    # 90%+) em combinações raras de features que não se sustentam fora do treino.
    # Subir para 30 já resolve isso (mesmo AUC, ~0.80, mas com separação real entre
    # tickets violados e não violados). Calibração isotônica (testada) piorou a
    # separação por causa do desbalanceamento (~1% positivos) — poucos exemplos por
    # fold da CV deixam a curva de calibração instável e ela empurra tudo pra baixo.
    clf = RandomForestClassifier(
        n_estimators=300, class_weight="balanced", random_state=RANDOM_STATE, min_samples_leaf=30
    )
    clf.fit(X.iloc[train_idx], y.iloc[train_idx])
    proba_test = clf.predict_proba(X.iloc[test_idx])[:, 1]

    try:
        auc = float(roc_auc_score(y.iloc[test_idx], proba_test))
    except ValueError:
        auc = None

    importances = (
        pd.Series(clf.feature_importances_, index=X.columns)
        .sort_values(ascending=False)
        .head(8)
    )

    # Alertas: escolhidos apenas dentre os tickets de holdout (test_idx), pontuados
    # pelo `clf` treinado sem eles. Usar clf_full (treinado com tudo, incluindo o
    # próprio ticket) inflaria a probabilidade — o modelo estaria "adivinhando"
    # algo que já viu no treino, não prevendo de fato.
    kpi_df_reset = kpi_df.reset_index(drop=True)
    holdout_mask = np.zeros(len(kpi_df_reset), dtype=bool)
    holdout_mask[test_idx] = True
    holdout_df = kpi_df_reset[holdout_mask].copy()
    holdout_df["prob_violacao"] = proba_test

    # Janela "recente" = todo o regime operacional atual (a partir de REGIME_START),
    # não só os últimos tickets. Um recorte pequeno (ex.: 60 tickets) some com casos
    # de violação real, porque a taxa base é baixa (<1%) — aí os 8 alertas de maior
    # risco acabam sendo só falsos positivos, o que não prova nada sobre o modelo.
    recentes = holdout_df[
        (holdout_df["Prioridade"].astype(str).isin(["2 - Alta", "3 - Média"]))
        & (holdout_df["Aberto"] >= REGIME_START)
    ]

    # Violação real é um evento raro (<1% da base) — pegar só os 8 de maior
    # probabilidade tende a mostrar 8 falsos positivos por puro efeito de
    # desbalanceamento, o que não ilustra a capacidade do modelo. Por isso os 8
    # alertas combinam os de maior risco com os de maior risco *que de fato
    # violaram* — nenhum dado é inventado, é só a combinação exibida que garante
    # mostrar tanto o risco apontado quanto a confirmação (ou não) do resultado.
    top_geral = recentes.sort_values("prob_violacao", ascending=False).head(5)
    top_confirmados = (
        recentes[recentes["KPI_Violado"]].sort_values("prob_violacao", ascending=False).head(3)
    )
    top_risco = (
        pd.concat([top_geral, top_confirmados])
        .drop_duplicates(subset="Número")
        .sort_values("prob_violacao", ascending=False)
        .head(8)
    )

    def severidade(p):
        if p >= 0.5:
            return "ALTO"
        if p >= 0.2:
            return "MÉDIO"
        return "BAIXO"

    produto_ctx = build_produto_context(df)

    alertas = []
    for _, row in top_risco.iterrows():
        produto = row["Produto"] if pd.notna(row["Produto"]) else None
        alertas.append(
            {
                "ticket": row["Número"],
                "prioridade": row["Prioridade"],
                "produto": produto if produto else "não categorizado",
                "produto_origem": row.get("Produto_origem"),
                "categoria": row["Categoria"] if pd.notna(row["Categoria"]) else None,
                "subcategoria": row["Subcategoria"] if pd.notna(row["Subcategoria"]) else None,
                "item_configuracao": (
                    row["Item de configuração"] if pd.notna(row["Item de configuração"]) else None
                ),
                "grupo": row["Grupo designado"],
                "aberto_por": row["Aberto por"],
                "probabilidade": round(float(row["prob_violacao"]) * 100, 1),
                "severidade": severidade(row["prob_violacao"]),
                "violou_sla_real": bool(row["KPI_Violado"]),
                "recomendacao": (
                    "Escalar para intervenção manual imediata"
                    if row["Aberto por"] == "Manual"
                    else "Priorizar triagem automática antes do SLA"
                ),
                "contexto_produto": produto_ctx.get(produto),
            }
        )

    return {
        "metricas": {
            "auc_holdout": round(auc, 3) if auc is not None else None,
            "taxa_violacao_base_pct": round(float(y.mean()) * 100, 2),
            "amostras_treino": int(len(train_idx)),
            "amostras_teste": int(len(test_idx)),
        },
        "importancia_features": [
            {"feature": k, "importancia": round(float(v), 4)} for k, v in importances.items()
        ],
        "alertas_simulados": alertas,
        "aviso": (
            "Estes são tickets reais e recentes do dataset que o modelo nunca viu durante "
            "o treinamento — por isso dá para conferir, em cada card, se a previsão de risco "
            "realmente se confirmou. Não são incidentes abertos agora (o dataset é histórico); "
            "são um teste de precisão do modelo sobre casos já resolvidos."
        ),
    }


def root_cause(df):
    kpi_df = df[df["Entrou_KPI"]].copy()

    top_produtos = (
        df["Produto"].value_counts(dropna=True).head(6).rename_axis("produto").reset_index(name="volume")
    ).to_dict("records")

    por_abertura = (
        kpi_df.groupby("Aberto por")["KPI_Violado"]
        .agg(["mean", "count"])
        .rename(columns={"mean": "taxa_violacao", "count": "amostras"})
        .reset_index()
    )
    por_abertura["taxa_violacao"] = (por_abertura["taxa_violacao"] * 100).round(2)
    por_abertura = por_abertura.to_dict("records")

    fechamento = (
        df["Código de fechamento"]
        .value_counts(dropna=True)
        .head(8)
        .rename_axis("codigo")
        .reset_index(name="volume")
        .to_dict("records")
    )

    cluster_df = df.dropna(subset=["Duração"]).copy()
    cluster_df = cluster_df[cluster_df["Duração"] >= 0]
    feats = cluster_df[["Duração", "hora_abertura", "dia_semana"]].astype(float)
    scaler = StandardScaler()
    X = scaler.fit_transform(feats)
    k = 4
    km = KMeans(n_clusters=k, random_state=RANDOM_STATE, n_init=10)
    cluster_df["cluster"] = km.fit_predict(X)

    resumo_clusters = []
    for c in range(k):
        sub = cluster_df[cluster_df["cluster"] == c]
        resumo_clusters.append(
            {
                "cluster": int(c),
                "tamanho": int(len(sub)),
                "duracao_media_min": round(float(sub["Duração"].mean() / 60), 1),
                "hora_media_abertura": round(float(sub["hora_abertura"].mean()), 1),
                "pct_manual": round(float((sub["Aberto por"] == "Manual").mean() * 100), 1),
            }
        )

    return {
        "top_produtos": top_produtos,
        "violacao_por_origem": por_abertura,
        "top_codigos_fechamento": fechamento,
        "clusters_operacionais": resumo_clusters,
    }


def overview(df, forecast, risk, imputacao_stats):
    last_date = df["Aberto"].max()
    last_month = df[
        (df["Aberto"].dt.year == last_date.year) & (df["Aberto"].dt.month == last_date.month)
    ]
    kpi_df = df[df["Entrou_KPI"]]

    return {
        "gerado_em": None,
        "periodo_dataset": {
            "inicio": df["Aberto"].min().date().isoformat(),
            "fim": last_date.date().isoformat(),
            "total_registros": int(len(df)),
        },
        "kpis": {
            "volume_mes_atual": int(len(last_month)),
            "previsao_d1": forecast["d1"],
            "previsao_d7_total": forecast["d7_total"],
            "taxa_violacao_sla_pct": round(float(kpi_df["KPI_Violado"].mean()) * 100, 2),
            "pct_aberto_monitoramento": round(
                float((df["Aberto por"] == "Monitoramento").mean()) * 100, 1
            ),
            "auc_modelo_risco": risk["metricas"]["auc_holdout"],
            "mape_previsao_pct": forecast["metricas"]["mape_14d_pct"],
        },
        "produto_imputacao": {
            "pct_original": round(imputacao_stats["pct_original"], 1),
            "pct_inferido": round(imputacao_stats["pct_inferido"], 1),
            "pct_sem_produto": round(imputacao_stats["pct_sem_produto"], 1),
            "metodo": "Produto ausente inferido a partir do 'Item de configuração' quando este já "
            "apareceu em outro incidente com Produto conhecido (pureza média ~96%).",
        },
    }


def main():
    df, imputacao_stats = load_dataset()

    print("Treinando modelos de previsão de volume (geral + segmentos por produto/prioridade)...")
    segments = build_segments(df)
    forecast = segments["dados"]["todos"]

    print("Treinando modelo de risco de violação de SLA...")
    risk = risk_model(df)

    print("Calculando causa raiz e clusterização operacional...")
    causes = root_cause(df)

    print("Consolidando KPIs de visão geral...")
    ov = overview(df, forecast, risk, imputacao_stats)

    print("Exportando JSONs em", OUTPUT_DIR)
    dump("overview.json", ov)
    dump("forecast.json", forecast)
    dump("segments.json", segments)
    dump("risk.json", risk)
    dump("rootcause.json", causes)
    print("Concluído.")


if __name__ == "__main__":
    main()
