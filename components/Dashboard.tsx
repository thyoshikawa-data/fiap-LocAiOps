"use client";

import { useState } from "react";
import type { DashboardData } from "@/lib/types";
import KpiCard from "./KpiCard";
import VolumeChart from "./VolumeChart";
import StackedVolumeChart from "./StackedVolumeChart";
import AlertsList from "./AlertsList";
import RootCauseView from "./RootCauseView";

const PRODUCT_COLORS: Record<string, string> = {
  lhco: "#F00843",
  lsin: "#DE003B",
  lcem: "#2A343E",
  lhvp: "#00ADC8",
  lrev: "#F4A6B7",
};

const PRIORITY_COLORS: Record<string, string> = {
  "2 - Alta": "#F00843",
  "3 - Média": "#2A343E",
  "4 - Baixa": "#00ADC8",
};

const TABS = [
  { id: "overview", label: "Visão geral" },
  { id: "alerts", label: "Alertas preditivos" },
  { id: "rootcause", label: "Causa raiz & clusters" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Dashboard({ data }: { data: DashboardData }) {
  const [tab, setTab] = useState<TabId>("overview");
  const [segmentId, setSegmentId] = useState("todos");
  const [produtoView, setProdutoView] = useState<"combinado" | "original">("combinado");
  const { overview, segments, risk, rootcause } = data;
  const activeSegment = segments.dados[segmentId] ?? segments.dados["todos"];
  const activeSegmentLabel =
    segments.opcoes.find((o) => o.id === segmentId)?.label ?? "Todos";
  const produtoSeries = segments.opcoes
    .filter((o) => o.tipo === "produto" && o.valor)
    .map((o) => ({
      key: o.valor as string,
      label: `Produto: ${o.valor}`,
      color: PRODUCT_COLORS[o.valor as string] ?? "#94A3B8",
      seg: segments.dados[o.id],
    }));
  const prioridadeSeries = segments.opcoes
    .filter((o) => o.tipo === "prioridade" && o.valor)
    .map((o) => ({
      key: o.id,
      label: o.valor as string,
      color: PRIORITY_COLORS[o.valor as string] ?? "#94A3B8",
      seg: segments.dados[o.id],
    }));

  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 py-6 sm:px-8 lg:px-12">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="LocAiOps" className="h-9 w-auto" />
          <span className="text-xs font-semibold uppercase tracking-widest text-[#F00843]">
            Challenge Locaweb · FIAP 2TSCOA
          </span>
        </div>
        <p className="max-w-xl text-sm text-slate-500">
          Dataset real da Locaweb: {overview.periodo_dataset.total_registros.toLocaleString("pt-BR")}{" "}
          incidentes ({overview.periodo_dataset.inicio} a {overview.periodo_dataset.fim}). Modelos
          treinados sobre o regime operacional atual (a partir de set/2025).
        </p>
      </header>

      <h1 className="mt-3 text-2xl font-bold text-[#2A343E]">
        Previsão de incidentes e risco de SLA
      </h1>

      <nav className="mt-4 flex gap-2 border-b border-[#E4E0DC]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-b-2 border-[#F00843] text-[#2A343E]"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section className="mt-6">
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
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

            <div className="grid grid-cols-3 gap-3">
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

            <div className="rounded-xl border border-[#E4E0DC] bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[#2A343E]">
                  Volume diário de incidentes — real vs. previsto
                </h2>
                <label className="flex items-center gap-2 text-xs text-slate-500">
                  Filtrar por:
                  <select
                    value={segmentId}
                    onChange={(e) => setSegmentId(e.target.value)}
                    className="rounded-md border border-[#E4E0DC] bg-white px-2 py-1 text-sm text-[#2A343E]"
                  >
                    {segments.opcoes.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {segmentId !== "todos" && <VolumeChart forecast={activeSegment} />}
              {segmentId !== "todos" &&
                activeSegment.metricas.mape_14d_pct !== null &&
                activeSegment.metricas.mape_14d_pct > 60 && (
                  <p className="mt-2 text-xs text-amber-600">
                    Aviso: este segmento tem volume diário baixo, o que deixa o erro percentual (MAPE) do
                    backtest alto — típico de séries esparsas. Use o valor absoluto (D+1/D+7) com cautela.
                  </p>
                )}
              {segmentId === "todos" && (
                <p className="text-xs text-slate-400">
                  Com &ldquo;Todos&rdquo; selecionado, o volume é decomposto em dois gráficos
                  empilhados abaixo — por produto e por severidade.
                </p>
              )}
            </div>

            {segmentId === "todos" && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-[#E4E0DC] bg-white p-4 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-[#2A343E]">
                      Volume diário empilhado por produto
                    </h2>
                    <div className="flex overflow-hidden rounded-md border border-[#E4E0DC] text-xs">
                      <button
                        onClick={() => setProdutoView("combinado")}
                        className={`px-2.5 py-1 font-medium ${
                          produtoView === "combinado"
                            ? "bg-[#2A343E] text-white"
                            : "bg-white text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        Original + inferido
                      </button>
                      <button
                        onClick={() => setProdutoView("original")}
                        className={`px-2.5 py-1 font-medium ${
                          produtoView === "original"
                            ? "bg-[#2A343E] text-white"
                            : "bg-white text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        Somente original
                      </button>
                    </div>
                  </div>
                  <p className="mb-2 text-xs text-slate-500">
                    Só {overview.produto_imputacao.pct_original}% dos incidentes já vêm com Produto
                    preenchido na origem; {overview.produto_imputacao.pct_inferido}% foram inferidos a
                    partir do Item de Configuração (pureza ~96%) e {overview.produto_imputacao.pct_sem_produto}%
                    permanece sem identificação.
                  </p>
                  <StackedVolumeChart
                    todos={activeSegment}
                    series={produtoSeries}
                    historicoField={produtoView === "original" ? "historico_original" : "historico"}
                    outros={
                      produtoView === "original"
                        ? { label: "Não informado originalmente (inclui inferidos)", color: "#C8C2BC" }
                        : { label: "Sem produto identificado", color: "#C8C2BC" }
                    }
                    caption={
                      produtoView === "original"
                        ? "Mostra só o que veio preenchido de fábrica no campo Produto — sem nenhuma inferência."
                        : "Camadas empilhadas somam o volume total do dia (top 5 produtos, incluindo os inferidos, + sem produto identificado). Linha tracejada = previsão agregada."
                    }
                  />
                </div>
                <div className="rounded-xl border border-[#E4E0DC] bg-white p-4 shadow-sm">
                  <h2 className="mb-3 text-sm font-semibold text-[#2A343E]">
                    Volume diário empilhado por severidade
                  </h2>
                  <StackedVolumeChart
                    todos={activeSegment}
                    series={prioridadeSeries}
                    outros={{ label: "Outras prioridades (1 e 5)", color: "#C8C2BC" }}
                    caption="Camadas empilhadas somam o volume total do dia por prioridade (2-Alta, 3-Média, 4-Baixa + outras). Linha tracejada = previsão agregada."
                  />
                </div>
              </div>
            )}
          </div>
        )}
        {tab === "alerts" && <AlertsList risk={risk} />}
        {tab === "rootcause" && <RootCauseView rootcause={rootcause} />}
      </section>

      <footer className="mt-10 border-t border-[#E4E0DC] pt-4 text-xs text-slate-400">
        <p>
          Modelos: RandomForestRegressor (previsão de volume) e RandomForestClassifier (risco de
          violação de SLA), scikit-learn. Dados agregados a partir do dataset ITSM fornecido pela
          Locaweb — nenhum dado bruto ou texto livre é exposto neste dashboard.
        </p>
        <p className="mt-2">
          Desenvolvido por <span className="font-medium text-slate-500">Silvielen Couto (RM564378)</span>{" "}
          e <span className="font-medium text-slate-500">Thales Yoshikawa (RM562897)</span> — FIAP
          2TSCOA, Challenge Locaweb.
        </p>
      </footer>
    </div>
  );
}
