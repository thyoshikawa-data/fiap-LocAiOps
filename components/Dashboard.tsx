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
  const { overview, forecast, risk, rootcause } = data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">
          LocAiOps · Challenge Locaweb · FIAP 2TSCOA
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Previsão D+1"
          value={overview.kpis.previsao_d1.toLocaleString("pt-BR")}
          hint="incidentes esperados"
        />
        <KpiCard
          label="Previsão D+7 (total)"
          value={overview.kpis.previsao_d7_total.toLocaleString("pt-BR")}
          hint="soma dos próximos 7 dias"
        />
        <KpiCard
          label="Volume mês atual"
          value={overview.kpis.volume_mes_atual.toLocaleString("pt-BR")}
          hint="último mês do dataset"
        />
        <KpiCard
          label="Violação de SLA"
          value={`${overview.kpis.taxa_violacao_sla_pct}%`}
          tone={overview.kpis.taxa_violacao_sla_pct > 1 ? "bad" : "good"}
          hint="tickets P1/P2/P3 elegíveis a KPI"
        />
        <KpiCard
          label="% aberto via monitoramento"
          value={`${overview.kpis.pct_aberto_monitoramento}%`}
        />
        <KpiCard
          label="AUC modelo de risco"
          value={overview.kpis.auc_modelo_risco?.toFixed(3) ?? "—"}
          tone="good"
          hint="holdout, classificação de violação"
        />
        <KpiCard
          label="MAPE previsão de volume"
          value={`${overview.kpis.mape_previsao_pct}%`}
          hint="backtest 14 dias"
        />
        <KpiCard
          label="Amostras treino (risco)"
          value={risk.metricas.amostras_treino.toLocaleString("pt-BR")}
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
            <h2 className="mb-2 text-sm font-semibold text-slate-300">
              Volume diário de incidentes — real vs. previsto
            </h2>
            <VolumeChart forecast={forecast} />
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
