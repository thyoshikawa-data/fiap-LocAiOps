"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RootCause } from "@/lib/types";

export default function RootCauseView({ rootcause }: { rootcause: RootCause }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-300">Top produtos por volume</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rootcause.top_produtos} margin={{ left: -16, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="produto" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontSize: 12 }} />
              <Bar dataKey="volume" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-300">Taxa de violação de SLA por origem</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rootcause.violacao_por_origem} margin={{ left: -16, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="Aberto por" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} unit="%" />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontSize: 12 }} />
              <Bar dataKey="taxa_violacao" fill="#f472b6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Abertura manual viola SLA{" "}
          {(
            (rootcause.violacao_por_origem.find((r) => r["Aberto por"] === "Manual")?.taxa_violacao ?? 0) /
            (rootcause.violacao_por_origem.find((r) => r["Aberto por"] === "Monitoramento")?.taxa_violacao || 1)
          ).toFixed(1)}
          x mais que a via monitoramento.
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-300">Top códigos de fechamento</h3>
        <ul className="space-y-1 text-sm text-slate-300">
          {rootcause.top_codigos_fechamento.slice(0, 6).map((c) => (
            <li key={c.codigo} className="flex justify-between border-b border-slate-800 py-1">
              <span>{c.codigo}</span>
              <span className="font-mono text-slate-400">{c.volume.toLocaleString("pt-BR")}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-300">Clusters operacionais (KMeans)</h3>
        <ul className="space-y-2 text-sm text-slate-300">
          {rootcause.clusters_operacionais.map((c) => (
            <li key={c.cluster} className="rounded-lg border border-slate-800 p-2">
              <span className="font-semibold text-slate-100">Cluster {c.cluster}</span> ·{" "}
              {c.tamanho.toLocaleString("pt-BR")} incidentes · abertura média ~{c.hora_media_abertura}h ·
              {" "}duração média {(c.duracao_media_min / 60).toFixed(1)}h · {c.pct_manual}% manual
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
