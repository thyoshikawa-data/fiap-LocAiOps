import type { Risk } from "@/lib/types";

const severidadeClasses: Record<string, string> = {
  ALTO: "bg-rose-950/50 text-rose-300 border-rose-800",
  MÉDIO: "bg-amber-950/50 text-amber-300 border-amber-800",
  BAIXO: "bg-emerald-950/50 text-emerald-300 border-emerald-800",
};

export default function AlertsList({ risk }: { risk: Risk }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">{risk.aviso}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {risk.alertas_simulados.map((a) => (
          <div key={a.ticket} className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-slate-200">{a.ticket}</span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${severidadeClasses[a.severidade]}`}
              >
                {a.severidade} · {a.probabilidade}%
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-300">
              {a.prioridade} · produto <span className="text-slate-100">{a.produto}</span> ·{" "}
              {a.grupo}
            </p>
            <p className="mt-1 text-xs text-slate-500">Aberto por: {a.aberto_por}</p>
            <p className="mt-2 text-sm text-slate-200">↳ {a.recomendacao}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
