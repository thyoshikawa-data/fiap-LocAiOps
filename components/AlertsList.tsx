import type { Risk } from "@/lib/types";

const severidadeClasses: Record<string, string> = {
  ALTO: "bg-[#FDE7EC] text-[#B0002F] border-[#F5B8C6]",
  MÉDIO: "bg-amber-50 text-amber-700 border-amber-300",
  BAIXO: "bg-emerald-50 text-emerald-700 border-emerald-300",
};

const barClasses: Record<string, string> = {
  ALTO: "bg-[#F00843]",
  MÉDIO: "bg-amber-500",
  BAIXO: "bg-emerald-500",
};

export default function AlertsList({ risk }: { risk: Risk }) {
  const total = risk.alertas_simulados.length;
  const altos = risk.alertas_simulados.filter((a) => a.severidade === "ALTO").length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#E4E0DC] bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Tickets sob observação
          </p>
          <p className="mt-1 text-2xl font-bold text-[#2A343E]">{total}</p>
        </div>
        <div className="rounded-xl border border-[#E4E0DC] bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Severidade alta
          </p>
          <p className="mt-1 text-2xl font-bold text-[#F00843]">{altos}</p>
        </div>
        <div className="rounded-xl border border-[#E4E0DC] bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            AUC do modelo (holdout)
          </p>
          <p className="mt-1 text-2xl font-bold text-[#2A343E]">
            {risk.metricas.auc_holdout?.toFixed(3) ?? "—"}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
        {risk.aviso}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {risk.alertas_simulados.map((a) => (
          <div
            key={a.ticket}
            className="overflow-hidden rounded-xl border border-[#E4E0DC] bg-white shadow-sm"
          >
            <div className={`h-1.5 ${barClasses[a.severidade]}`} />
            <div className="p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold text-[#2A343E]">{a.ticket}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${severidadeClasses[a.severidade]}`}
                >
                  {a.severidade} · {a.probabilidade}%
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {a.prioridade} · produto <span className="font-medium text-[#2A343E]">{a.produto}</span>{" "}
                · {a.grupo}
              </p>
              <p className="mt-1 text-xs text-slate-400">Aberto por: {a.aberto_por}</p>
              <p className="mt-3 rounded-lg bg-[#F5F3F2] px-3 py-2 text-sm text-[#2A343E]">
                ↳ {a.recomendacao}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
