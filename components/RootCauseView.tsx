"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RootCause } from "@/lib/types";

const tooltipStyle = {
  contentStyle: { background: "#FFFFFF", border: "1px solid #E4E0DC", fontSize: 12, color: "#2A343E" },
  labelStyle: { color: "#2A343E", fontWeight: 600 },
};

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#E4E0DC] bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-[#2A343E]">{title}</h3>
      {children}
    </div>
  );
}

export default function RootCauseView({ rootcause }: { rootcause: RootCause }) {
  const manual = rootcause.violacao_por_origem.find((r) => r["Aberto por"] === "Manual")?.taxa_violacao ?? 0;
  const monitoramento =
    rootcause.violacao_por_origem.find((r) => r["Aberto por"] === "Monitoramento")?.taxa_violacao || 1;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Top produtos por volume">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rootcause.top_produtos} margin={{ left: -16, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E0DC" />
              <XAxis dataKey="produto" stroke="#8A8580" fontSize={11} />
              <YAxis stroke="#8A8580" fontSize={11} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="volume" fill="#2A343E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Taxa de violação de SLA por origem">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rootcause.violacao_por_origem} margin={{ left: -16, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E0DC" />
              <XAxis dataKey="Aberto por" stroke="#8A8580" fontSize={11} />
              <YAxis stroke="#8A8580" fontSize={11} unit="%" />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="taxa_violacao" fill="#F00843" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 rounded-lg bg-[#FDE7EC] px-3 py-2 text-xs text-[#B0002F]">
          Abertura manual viola SLA {(manual / monitoramento).toFixed(1)}x mais que a via monitoramento.
        </p>
      </Panel>

      <Panel title="Top códigos de fechamento">
        <ul className="text-sm text-slate-600">
          {rootcause.top_codigos_fechamento.slice(0, 6).map((c) => (
            <li
              key={c.codigo}
              className="flex justify-between border-b border-[#F0EDEA] py-1.5 last:border-0"
            >
              <span>{c.codigo}</span>
              <span className="font-mono text-slate-400">{c.volume.toLocaleString("pt-BR")}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Clusters operacionais (KMeans)">
        <ul className="space-y-2">
          {rootcause.clusters_operacionais.map((c) => (
            <li
              key={c.cluster}
              className="rounded-lg border border-[#E4E0DC] bg-[#F5F3F2] p-2.5 text-sm text-slate-600"
            >
              <span className="font-semibold text-[#2A343E]">Cluster {c.cluster}</span> ·{" "}
              {c.tamanho.toLocaleString("pt-BR")} incidentes · abertura média ~{c.hora_media_abertura}h ·{" "}
              duração média {(c.duracao_media_min / 60).toFixed(1)}h · {c.pct_manual}% manual
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
