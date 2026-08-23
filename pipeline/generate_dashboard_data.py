"""
LocAiOps - Pipeline de geração dos dados do MVP (Sprint 3).

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
    return df


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
        dados[seg_id] = segment_bundle(seg_id, df[df["Produto"] == produto], global_idx)

    for prioridade in prioridades:
        seg_id = f"prioridade:{prioridade}"
        opcoes.append(
            {"id": seg_id, "tipo": "prioridade", "valor": prioridade, "label": f"Prioridade: {prioridade}"}
        )
        dados[seg_id] = segment_bundle(seg_id, df[df["Prioridade"] == prioridade], global_idx)

    return {"opcoes": opcoes, "dados": dados}


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

    clf = RandomForestClassifier(
        n_estimators=300, class_weight="balanced", random_state=RANDOM_STATE, min_samples_leaf=3
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

    clf_full = RandomForestClassifier(
        n_estimators=300, class_weight="balanced", random_state=RANDOM_STATE, min_samples_leaf=3
    )
    clf_full.fit(X, y)
    kpi_df["prob_violacao"] = clf_full.predict_proba(X)[:, 1]

    recentes = (
        kpi_df[kpi_df["Prioridade"].astype(str).isin(["2 - Alta", "3 - Média"])]
        .sort_values("Aberto", ascending=False)
        .head(60)
    )
    top_risco = recentes.sort_values("prob_violacao", ascending=False).head(8)

    def severidade(p):
        if p >= 0.5:
            return "ALTO"
        if p >= 0.2:
            return "MÉDIO"
        return "BAIXO"

    alertas = []
    for _, row in top_risco.iterrows():
        alertas.append(
            {
                "ticket": row["Número"],
                "prioridade": row["Prioridade"],
                "produto": row["Produto"] if pd.notna(row["Produto"]) else "não categorizado",
                "grupo": row["Grupo designado"],
                "aberto_por": row["Aberto por"],
                "probabilidade": round(float(row["prob_violacao"]) * 100, 1),
                "severidade": severidade(row["prob_violacao"]),
                "recomendacao": (
                    "Escalar para intervenção manual imediata"
                    if row["Aberto por"] == "Manual"
                    else "Priorizar triagem automática antes do SLA"
                ),
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
        "aviso": "Probabilidades geradas sobre tickets históricos reais, simulando o momento da abertura — não representam incidentes em aberto no momento.",
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


def overview(df, forecast, risk):
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
    }


def main():
    df = load_dataset()

    print("Treinando modelos de previsão de volume (geral + segmentos por produto/prioridade)...")
    segments = build_segments(df)
    forecast = segments["dados"]["todos"]

    print("Treinando modelo de risco de violação de SLA...")
    risk = risk_model(df)

    print("Calculando causa raiz e clusterização operacional...")
    causes = root_cause(df)

    print("Consolidando KPIs de visão geral...")
    ov = overview(df, forecast, risk)

    print("Exportando JSONs em", OUTPUT_DIR)
    dump("overview.json", ov)
    dump("forecast.json", forecast)
    dump("segments.json", segments)
    dump("risk.json", risk)
    dump("rootcause.json", causes)
    print("Concluído.")


if __name__ == "__main__":
    main()
