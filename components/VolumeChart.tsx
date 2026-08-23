"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Forecast } from "@/lib/types";

function formatDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export default function VolumeChart({ forecast }: { forecast: Forecast }) {
  const backtestDates = new Set(forecast.backtest.map((b) => b.data));

  const merged = forecast.historico.map((h) => {
    const bt = forecast.backtest.find((b) => b.data === h.data);
    return {
      data: h.data,
      real: h.real,
      previsto: bt ? bt.previsto : undefined,
    };
  });

  const future = forecast.previsao_7d.map((f) => ({
    data: f.data,
    real: undefined,
    previsto: f.previsto,
  }));

  const series = [...merged, ...future].map((p) => ({ ...p, label: formatDate(p.data) }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} interval={Math.floor(series.length / 12)} />
          <YAxis stroke="#94a3b8" fontSize={11} />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontSize: 12 }}
            labelStyle={{ color: "#e2e8f0" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="real"
            name="Volume real"
            stroke="#38bdf8"
            dot={false}
            strokeWidth={2}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="previsto"
            name="Previsto (backtest + D+1..D+7)"
            stroke="#f472b6"
            strokeDasharray="4 3"
            dot={false}
            strokeWidth={2}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-1 text-xs text-slate-500">
        {backtestDates.size} dias de backtest (linha rosa sobre o real) + 7 dias de previsão futura.
      </p>
    </div>
  );
}
