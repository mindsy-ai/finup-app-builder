import { formatBRL } from "@/lib/format";
import type { Reconciliation } from "@/lib/status";

type Props = {
  data: Reconciliation;
  /** entrada muda os rótulos para recebimento; saída, para pagamento */
  flow: "income" | "expense";
  title?: string;
  subtitle?: string;
};

/**
 * Concilia o que foi realizado com o que ainda está em aberto.
 *
 * A barra dá a proporção num relance e os três números dão o valor exato —
 * é a leitura que responde "quanto disso eu já tenho no bolso?".
 */
export function ReconciliationBar({ data, flow, title, subtitle }: Props) {
  const settledLabel = flow === "income" ? "Recebido" : "Pago";
  const pendingLabel = flow === "income" ? "A receber" : "A pagar";
  const overdueLabel = flow === "income" ? "Inadimplente" : "Atrasado";

  const segments = [
    { value: data.settled, pct: data.settledPct, color: "var(--income)" },
    { value: data.pending, pct: data.pendingPct, color: "var(--brand-orange)" },
    { value: data.overdue, pct: data.overduePct, color: "var(--expense)" },
  ].filter((s) => s.value > 0);

  return (
    <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-5">
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <p className="text-sm font-bold text-white">{title}</p>}
          {subtitle && (
            <p className="mt-0.5 text-xs text-[color:var(--text-secondary)]">{subtitle}</p>
          )}
        </div>
      )}

      <div className="mb-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {segments.length === 0 ? (
          <div className="w-full bg-white/5" />
        ) : (
          segments.map((s, i) => (
            <div key={i} style={{ width: `${s.pct}%`, background: s.color }} />
          ))
        )}
      </div>

      {/* No mobile, três colunas em 360px cortariam os valores: viram linhas. */}
      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-3 sm:gap-3">
        <Cell
          label={settledLabel}
          value={data.settled}
          pct={data.settledPct}
          color="var(--income)"
        />
        <Cell
          label={pendingLabel}
          value={data.pending}
          pct={data.pendingPct}
          color="var(--brand-orange)"
        />
        <Cell
          label={overdueLabel}
          value={data.overdue}
          pct={data.overduePct}
          color="var(--expense)"
          alert={data.overdue > 0}
        />
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  pct,
  color,
  alert,
}: {
  label: string;
  value: number;
  pct: number;
  color: string;
  alert?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 sm:block">
      <div className="flex items-center gap-1.5 sm:mb-1">
        <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: color }} />
        <span
          className={`text-[10px] font-bold uppercase tracking-[0.05em] ${
            alert ? "" : "text-[color:var(--text-secondary)]"
          }`}
          style={alert ? { color } : undefined}
        >
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2 sm:block">
        <p className="text-[15px] font-bold leading-none text-white tabular-nums sm:text-[17px]">
          {formatBRL(value)}
        </p>
        <p className="text-[11px] text-[color:var(--text-secondary)] tabular-nums sm:mt-1">
          {Math.round(pct)}%<span className="hidden sm:inline"> do total</span>
        </p>
      </div>
    </div>
  );
}
