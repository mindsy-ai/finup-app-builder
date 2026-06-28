import { formatBRL } from "@/lib/format";

type Tone = "income" | "expense" | "neutral";

type Props = {
  label: string;
  value: number;
  variation: number;
  accent: "purple" | "orange" | "green" | "teal";
};

const ACCENT_BORDER: Record<Props["accent"], string> = {
  purple: "border-l-[color:var(--brand-purple)]",
  orange: "border-l-[color:var(--brand-orange)]",
  green: "border-l-[color:var(--income)]",
  teal: "border-l-[color:var(--teal)]",
};

export function KpiCard({ label, value, variation, accent }: Props) {
  const tone: Tone =
    accent === "orange" || (accent === "purple" && variation < 0 && label.toLowerCase().includes("desp"))
      ? "expense"
      : variation >= 0
        ? "income"
        : "expense";
  const sign = variation > 0 ? "+" : "";
  const pctText = `${sign}${variation.toFixed(1).replace(".", ",")}%`;

  const badgeClass =
    accent === "orange"
      ? "bg-[rgba(239,68,68,0.15)] text-[color:var(--expense)]"
      : tone === "income"
        ? "bg-[rgba(34,197,94,0.15)] text-[color:var(--income)]"
        : "bg-[rgba(239,68,68,0.15)] text-[color:var(--expense)]";

  return (
    <div
      className={`rounded-xl border border-[color:var(--border-default)] border-l-2 bg-[color:var(--bg-card)] px-6 py-5 ${ACCENT_BORDER[accent]}`}
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--text-secondary)]">
        {label}
      </div>
      <div className="mt-2 text-[28px] font-bold leading-tight text-white">{formatBRL(value)}</div>
      <div className="mt-3">
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${badgeClass}`}>
          {pctText}
        </span>
      </div>
    </div>
  );
}
