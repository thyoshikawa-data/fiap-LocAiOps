"""Achata os JSONs agregados de public/data/ em CSVs simples para consumo no
Looker Studio (via Planilha Google com IMPORTDATA apontando para o raw do GitHub).

Não roda nenhum modelo de novo: só reformata o que o pipeline principal
(generate_dashboard_data.py) já calculou e exportou como JSON.
"""

import csv
import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "public" / "data"
OUT_DIR = DATA_DIR / "looker"


def load(name):
    with open(DATA_DIR / name, encoding="utf-8") as f:
        return json.load(f)


def write_csv(name, rows, fieldnames):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / name
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    print(f"  {name}: {len(rows)} linhas")


def export_overview():
    data = load("overview.json")
    kpis = data["kpis"]
    imput = data["produto_imputacao"]
    row = {
        "periodo_inicio": data["periodo_dataset"]["inicio"],
        "periodo_fim": data["periodo_dataset"]["fim"],
        "total_registros": data["periodo_dataset"]["total_registros"],
        "volume_mes_atual": kpis["volume_mes_atual"],
        "previsao_d1": kpis["previsao_d1"],
        "previsao_d7_total": kpis["previsao_d7_total"],
        "taxa_violacao_sla_pct": kpis["taxa_violacao_sla_pct"],
        "pct_aberto_monitoramento": kpis["pct_aberto_monitoramento"],
        "auc_modelo_risco": kpis["auc_modelo_risco"],
        "mape_previsao_pct": kpis["mape_previsao_pct"],
        "produto_pct_original": imput["pct_original"],
        "produto_pct_inferido": imput["pct_inferido"],
        "produto_pct_sem_produto": imput["pct_sem_produto"],
    }
    write_csv("overview_kpis.csv", [row], list(row.keys()))


def export_forecast_segments():
    """Usa segments.json (todos os recortes) em vez de forecast.json (só 'todos')."""
    data = load("segments.json")
    historico_rows = []
    backtest_rows = []
    previsao_rows = []
    metricas_rows = []

    for chave, seg in data["dados"].items():
        label = seg.get("label", chave)
        for pt in seg.get("historico", []):
            historico_rows.append({"segmento": label, "data": pt["data"], "real": pt["real"]})
        for pt in seg.get("backtest", []):
            backtest_rows.append({
                "segmento": label, "data": pt["data"],
                "real": pt["real"], "previsto": pt["previsto"],
            })
        for pt in seg.get("previsao_7d", []):
            previsao_rows.append({"segmento": label, "data": pt["data"], "previsto": pt["previsto"]})

        met = seg.get("metricas", {})
        kpi = seg.get("kpis", {})
        metricas_rows.append({
            "segmento": label,
            "d1": seg.get("d1"),
            "d7_total": seg.get("d7_total"),
            "mae_14d": met.get("mae_14d"),
            "mape_14d_pct": met.get("mape_14d_pct"),
            "volume_mes_atual": kpi.get("volume_mes_atual"),
            "taxa_violacao_sla_pct": kpi.get("taxa_violacao_sla_pct"),
        })

    write_csv("forecast_historico.csv", historico_rows, ["segmento", "data", "real"])
    write_csv("forecast_backtest.csv", backtest_rows, ["segmento", "data", "real", "previsto"])
    write_csv("forecast_previsao7d.csv", previsao_rows, ["segmento", "data", "previsto"])
    write_csv("forecast_metricas.csv", metricas_rows,
               ["segmento", "d1", "d7_total", "mae_14d", "mape_14d_pct",
                "volume_mes_atual", "taxa_violacao_sla_pct"])


def export_risk():
    data = load("risk.json")

    met = data["metricas"]
    write_csv("risk_metricas.csv", [met], list(met.keys()))

    write_csv("risk_features.csv", data["importancia_features"], ["feature", "importancia"])

    alert_rows = []
    for a in data["alertas_simulados"]:
        ctx = a.get("contexto_produto", {})
        alert_rows.append({
            "ticket": a["ticket"],
            "prioridade": a["prioridade"],
            "produto": a["produto"],
            "produto_origem": a["produto_origem"],
            "categoria": a["categoria"],
            "subcategoria": a["subcategoria"],
            "item_configuracao": a["item_configuracao"],
            "grupo": a["grupo"],
            "aberto_por": a["aberto_por"],
            "probabilidade": a["probabilidade"],
            "severidade": a["severidade"],
            "recomendacao": a["recomendacao"],
            "ctx_volume_total": ctx.get("volume_total"),
            "ctx_taxa_violacao_pct": ctx.get("taxa_violacao_pct"),
            "ctx_top_codigo_fechamento": ctx.get("top_codigo_fechamento"),
            "ctx_pct_codigo_fechamento": ctx.get("pct_codigo_fechamento"),
            "ctx_solucao_comum": ctx.get("solucao_comum"),
            "ctx_pct_solucao_comum": ctx.get("pct_solucao_comum"),
        })
    write_csv("risk_alertas.csv", alert_rows, list(alert_rows[0].keys()) if alert_rows else [])


def export_rootcause():
    data = load("rootcause.json")
    write_csv("rootcause_top_produtos.csv", data["top_produtos"], ["produto", "volume"])
    write_csv("rootcause_violacao_origem.csv", data["violacao_por_origem"],
               ["Aberto por", "taxa_violacao", "amostras"])
    write_csv("rootcause_top_codigos.csv", data["top_codigos_fechamento"], ["codigo", "volume"])
    write_csv("rootcause_clusters.csv", data["clusters_operacionais"],
               ["cluster", "tamanho", "duracao_media_min", "hora_media_abertura", "pct_manual"])


if __name__ == "__main__":
    print("Exportando CSVs para Looker Studio em:", OUT_DIR)
    export_overview()
    export_forecast_segments()
    export_risk()
    export_rootcause()
    print("Concluído.")
