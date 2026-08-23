"use client";

import { useState } from "react";
import type { DashboardData } from "@/lib/types";
import KpiCard from "./KpiCard";
import VolumeChart from "./VolumeChart";
import AlertsList from "./AlertsList";
import RootCauseView from "./RootCauseView";

const TABS = [
  { id: "overview", label: "Visão geral" },
  { id: "alerts", label: "Alertas preditivos" },
  { id: "rootcause", label: "Causa raiz & clusters" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Dashboard({ data }: { data: DashboardData }) {
  const [tab, setTab] = useState<TabId>("overview");
  const [segmentId, setSegmentId] = useState("todos");
  const { overview, segments, risk, rootcause } = data;
  const activeSegment = segments.dados[segmentId] ?? segments.dados["todos"];
  const activeSegmentLabel =
    segments.opcoes.find((o) => o.id === segmentId)?.label ?? "Todos";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-dark-bg.svg" alt="LocAiOps" className="h-10 w-auto" />
        <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-sky-400">
          Challenge Locaweb · FIAP 2TSCOA
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-50">
          Previsão de incidentes e risco de SLA — MVP preliminar
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Dataset real da Locaweb: {overview.periodo_dataset.total_registros.toLocaleString("pt-BR")}{" "}
          incidentes ({overview.periodo_dataset.inicio} a {overview.periodo_dataset.fim}). Modelos
          treinados sobre o regime operacional atual (a partir de set/2025).
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grow grid-cols-2 gap-3 sm:grid-cols-5">
          <KpiCard
            label="Previsão D+1"
            value={activeSegment.d1.toLocaleString("pt-BR")}
            hint={segmentId === "todos" ? "incidentes esperados" : activeSegmentLabel}
          />
          <KpiCard
            label="Previsão D+7 (total)"
            value={activeSegment.d7_total.toLocaleString("pt-BR")}
            hint="soma dos próximos 7 dias"
          />
          <KpiCard
            label="Volume mês atual"
            value={activeSegment.kpis.volume_mes_atual.toLocaleString("pt-BR")}
            hint="último mês do dataset"
          />
          <KpiCard
            label="Violação de SLA"
            value={
              activeSegment.kpis.taxa_violacao_sla_pct !== null
                ? `${activeSegment.kpis.taxa_violacao_sla_pct}%`
                : "—"
            }
            tone={
              activeSegment.kpis.taxa_violacao_sla_pct !== null &&
              activeSegment.kpis.taxa_violacao_sla_pct > 1
                ? "bad"
                : "good"
            }
            hint="tickets P1/P2/P3 elegíveis a KPI"
          />
          <KpiCard
            label="MAPE previsão (segmento)"
            value={
              activeSegment.metricas.mape_14d_pct !== null
                ? `${activeSegment.metricas.mape_14d_pct}%`
                : "—"
            }
            tone={
              activeSegment.metricas.mape_14d_pct !== null && activeSegment.metricas.mape_14d_pct > 60
                ? "warn"
                : "default"
            }
            hint="backtest 14 dias"
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <KpiCard
          label="% aberto via monitoramento"
          value={`${overview.kpis.pct_aberto_monitoramento}%`}
          hint="global, todo o dataset"
        />
        <KpiCard
          label="AUC modelo de risco"
          value={overview.kpis.auc_modelo_risco?.toFixed(3) ?? "—"}
          tone="good"
          hint="holdout, classificação de violação (global)"
        />
        <KpiCard
          label="Amostras treino (risco)"
          value={risk.metricas.amostras_treino.toLocaleString("pt-BR")}
          hint="global"
        />
      </div>

      <nav className="mt-6 flex gap-2 border-b border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-b-2 border-sky-400 text-slate-50"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section className="mt-6">
        {tab === "overview" && (
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-300">
                Volume diário de incidentes — real vs. previsto
              </h2>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                Filtrar por:
                <select
                  value={segmentId}
                  onChange={(e) => setSegmentId(e.target.value)}
                  className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100"
                >
                  {segments.opcoes.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <VolumeChart forecast={activeSegment} />
            {segmentId !== "todos" &&
              activeSegment.metricas.mape_14d_pct !== null &&
              activeSegment.metricas.mape_14d_pct > 60 && (
                <p className="mt-2 text-xs text-amber-400">
                  Aviso: este segmento tem volume diário baixo, o que deixa o erro percentual (MAPE) do
                  backtest alto — típico de séries esparsas. Use o valor absoluto (D+1/D+7) com cautela.
                </p>
              )}
          </div>
        )}
        {tab === "alerts" && <AlertsList risk={risk} />}
        {tab === "rootcause" && <RootCauseView rootcause={rootcause} />}
      </section>

      <footer className="mt-10 border-t border-slate-800 pt-4 text-xs text-slate-500">
        Modelos: RandomForestRegressor (previsão de volume) e RandomForestClassifier (risco de
        violação de SLA), scikit-learn. Dados agregados a partir do dataset ITSM fornecido pela
        Locaweb — nenhum dado bruto ou texto livre é exposto neste dashboard.
      </footer>
    </div>
  );
}
