interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad";
}

const toneClasses: Record<string, string> = {
  default: "border-l-[#F00843]",
  good: "border-l-emerald-500",
  warn: "border-l-amber-500",
  bad: "border-l-[#DE003B]",
};

export default function KpiCard({ label, value, hint, tone = "default" }: KpiCardProps) {
  return (
    <div
      className={`rounded-xl border border-[#E4E0DC] border-l-4 bg-white p-4 shadow-sm ${toneClasses[tone]}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#2A343E]">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
