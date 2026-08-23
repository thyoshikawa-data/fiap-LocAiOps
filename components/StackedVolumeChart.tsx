"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
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

const PRODUCT_COLORS: Record<string, string> = {
  lhco: "#F00843",
  lsin: "#DE003B",
  lcem: "#2A343E",
  lhvp: "#00ADC8",
  lrev: "#F4A6B7",
};

export default function StackedVolumeChart({
  todos,
  produtos,
}: {
  todos: Segment;
  produtos: { key: string; seg: Segment }[];
}) {
  const rows = todos.historico.map((h, i) => {
    const row: Record<string, number | string | undefined> = {
      label: formatDate(h.data),
      data: h.data,
    };
    let soma = 0;
    for (const p of produtos) {
      const v = p.seg.historico[i]?.real ?? 0;
      row[p.key] = v;
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

  const series = [...rows, ...future];

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E4E0DC" />
          <XAxis dataKey="label" stroke="#8A8580" fontSize={11} interval={Math.floor(series.length / 12)} />
          <YAxis stroke="#8A8580" fontSize={11} />
          <Tooltip
            contentStyle={{ background: "#FFFFFF", border: "1px solid #E4E0DC", fontSize: 12, color: "#2A343E" }}
            labelStyle={{ color: "#2A343E", fontWeight: 600 }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#2A343E" }} />
          {produtos.map((p) => (
            <Area
              key={p.key}
              type="monotone"
              dataKey={p.key}
              name={`Produto: ${p.key}`}
              stackId="vol"
              stroke="none"
              fill={PRODUCT_COLORS[p.key] ?? "#94A3B8"}
              fillOpacity={0.85}
            />
          ))}
          <Area
            type="monotone"
            dataKey="outros"
            name="Outros produtos"
            stackId="vol"
            stroke="none"
            fill="#C8C2BC"
            fillOpacity={0.85}
          />
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
      <p className="mt-1 text-xs text-slate-500">
        Áreas empilhadas = volume real por produto (top 5 + &ldquo;outros&rdquo;). Linha tracejada =
        previsão agregada (backtest 14 dias + D+1..D+7).
      </p>
    </div>
  );
}
