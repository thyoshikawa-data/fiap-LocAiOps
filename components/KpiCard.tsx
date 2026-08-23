interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad";
}

const toneClasses: Record<string, string> = {
  default: "border-slate-700 bg-slate-800/60",
  good: "border-emerald-700 bg-emerald-950/40",
  warn: "border-amber-700 bg-amber-950/40",
  bad: "border-rose-700 bg-rose-950/40",
};

export default function KpiCard({ label, value, hint, tone = "default" }: KpiCardProps) {
  return (
    <div className={`rounded-xl border p-4 ${toneClasses[tone]}`}>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-50">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
