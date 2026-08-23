"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Segment } from "@/lib/types";

function formatDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export interface BreakdownSeries {
  key: string;
  label: string;
  color: string;
  seg: Segment;
}

export default function StackedVolumeChart({
  todos,
  series,
  outros,
  caption,
  historicoField = "historico",
}: {
  todos: Segment;
  series: BreakdownSeries[];
  outros: { label: string; color: string };
  caption: string;
  historicoField?: "historico" | "historico_original";
}) {
  const rows = todos.historico.map((h, i) => {
    const row: Record<string, number | string | undefined> = {
      label: formatDate(h.data),
      data: h.data,
    };
    let soma = 0;
    for (const s of series) {
      const fonte = s.seg[historicoField] ?? s.seg.historico;
      const v = fonte[i]?.real ?? 0;
      row[s.key] = v;
      soma += v;
    }
    row.outros = Math.max((h.real ?? 0) - soma, 0);
    const bt = todos.backtest.find((b) => b.data === h.data);
    row.previsto = bt ? bt.previsto : undefined;
    return row;
  });

  const future = todos.previsao_7d.map((f) => ({
    label: formatDate(f.data),
    data: f.data,
    previsto: f.previsto,
  }));

  const chartData = [...rows, ...future];

  return (
    <div className="w-full">
      <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E4E0DC" />
          <XAxis
            dataKey="label"
            stroke="#8A8580"
            fontSize={11}
            interval={Math.floor(chartData.length / 12)}
          />
          <YAxis stroke="#8A8580" fontSize={11} />
          <Tooltip
            contentStyle={{
              background: "#FFFFFF",
              border: "1px solid #E4E0DC",
              fontSize: 12,
              color: "#2A343E",
            }}
            labelStyle={{ color: "#2A343E", fontWeight: 600 }}
          />
          <Area
            type="monotone"
            dataKey="outros"
            name={outros.label}
            stackId="vol"
            stroke="#FFFFFF"
            strokeWidth={1}
            fill={outros.color}
            fillOpacity={0.9}
          />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stackId="vol"
              stroke="#FFFFFF"
              strokeWidth={1}
              fill={s.color}
              fillOpacity={0.9}
            />
          ))}
          <Line
            type="monotone"
            dataKey="previsto"
            name="Previsto (agregado)"
            stroke="#2A343E"
            strokeWidth={2.4}
            strokeDasharray="4 3"
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: outros.color }}
          />
          {outros.label}
        </span>
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 border-t-2 border-dashed border-[#2A343E]" />
          Previsto (agregado)
        </span>
      </div>

      <p className="mt-1 text-xs text-slate-500">{caption}</p>
    </div>
  );
}
