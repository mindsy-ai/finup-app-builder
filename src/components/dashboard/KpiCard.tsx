import type { LucideIcon } from "lucide-react";
import { formatBRL } from "@/lib/format";

type Accent = "purple" | "orange" | "green" | "teal";

type Props = {
  label: string;
  value: number;
  /** null quando não há mês anterior com dados para comparar */
  variation: number | null;
  accent: Accent;
  icon: LucideIcon;
  /** true when growth is bad news (e.g. despesas) */
  invert?: boolean;
};

const ACCENT_COLOR: Record<Accent, string> = {
  purple: "var(--brand-purple)",
  orange: "var(--brand-orange)",
  green: "var(--income)",
  teal: "var(--teal)",
};

const ACCENT_BG: Record<Accent, string> = {
  purple: "rgba(124,58,255,0.13)",
  orange: "rgba(255,92,26,0.13)",
  green: "rgba(34,197,94,0.13)",
  teal: "rgba(45,212,191,0.13)",
};

export function KpiCard({ label, value, variation, accent, icon: Icon, invert = false }: Props) {
  const good = variation === null ? true : invert ? variation <= 0 : variation >= 0;
  const pctText =
    variation === null
      ? "—"
      : `${variation > 0 ? "+" : ""}${variation.toFixed(1).replace(".", ",")}%`;

  return (
    <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-3 sm:p-[18px]">
      <div className="mb-2 flex items-center justify-between gap-1 sm:mb-4">
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[9px] sm:h-[38px] sm:w-[38px] sm:rounded-[11px]"
          style={{ background: ACCENT_BG[accent] }}
        >
          <Icon
            className="h-[17px] w-[17px] sm:h-5 sm:w-5"
            style={{ color: ACCENT_COLOR[accent] }}
          />
        </div>
        <span
          title={variation === null ? "Sem mês anterior para comparar" : undefined}
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold sm:px-2.5 sm:py-1 sm:text-[11px] ${
            variation === null
              ? "bg-white/5 text-[color:var(--text-secondary)]"
              : good
                ? "bg-[rgba(34,197,94,0.12)] text-[color:var(--income)]"
                : "bg-[rgba(239,68,68,0.12)] text-[color:var(--expense)]"
          }`}
        >
          {pctText}
        </span>
      </div>
      <p className="mb-1 truncate text-[19px] font-bold leading-none tracking-tight text-white tabular-nums sm:mb-1.5 sm:text-[23px]">
        {formatBRL(value)}
      </p>
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.06em] text-[color:var(--text-secondary)] sm:text-[11px]">
        {label}
      </p>
    </div>
  );
}
