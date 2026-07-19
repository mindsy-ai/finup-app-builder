import type { TxRow } from "@/lib/transactions";
import { parseDateLocal } from "@/lib/format";

/**
 * Estado efetivo de uma transação.
 *
 * `overdue` não é gravado no banco: um lançamento pendente vira inadimplente
 * sozinho quando o vencimento passa. Derivar evita depender de um job diário
 * e garante que a tela nunca mostre um vencido como simplesmente "pendente".
 */
export type EffectiveStatus = "settled" | "pending" | "overdue";

/** Data que define o vencimento: due_date quando existe, senão a data do lançamento. */
export function dueDateOf(t: Pick<TxRow, "due_date" | "occurred_at">): Date {
  return parseDateLocal(t.due_date ?? t.occurred_at);
}

export function daysUntilDue(t: Pick<TxRow, "due_date" | "occurred_at">): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((dueDateOf(t).getTime() - today.getTime()) / 86400000);
}

export function effectiveStatus(
  t: Pick<TxRow, "status" | "due_date" | "occurred_at">,
): EffectiveStatus {
  if (t.status === "paid") return "settled";
  return daysUntilDue(t) < 0 ? "overdue" : "pending";
}

type StatusVisual = { label: string; color: string; bg: string };

/** Rótulos mudam conforme o fluxo: recebimento (entrada) ou pagamento (saída). */
export function statusVisual(status: EffectiveStatus, type: "income" | "expense"): StatusVisual {
  if (status === "settled")
    return {
      label: type === "income" ? "Recebido" : "Pago",
      color: "var(--income)",
      bg: "rgba(34,197,94,0.12)",
    };
  if (status === "overdue")
    return {
      label: type === "income" ? "Inadimplente" : "Atrasado",
      color: "var(--expense)",
      bg: "rgba(239,68,68,0.12)",
    };
  return {
    label: type === "income" ? "A receber" : "A pagar",
    color: "var(--brand-orange)",
    bg: "rgba(255,92,26,0.12)",
  };
}

/** Texto humano do vencimento — "Vence em 3 dias", "Venceu há 2 dias", "Vence hoje". */
export function dueLabel(t: Pick<TxRow, "due_date" | "occurred_at">): string {
  const d = daysUntilDue(t);
  const plural = (n: number) => (Math.abs(n) === 1 ? "dia" : "dias");
  if (d < 0) return `Venceu há ${Math.abs(d)} ${plural(d)}`;
  if (d === 0) return "Vence hoje";
  return `Vence em ${d} ${plural(d)}`;
}

export type Reconciliation = {
  settled: number;
  pending: number;
  overdue: number;
  total: number;
  settledPct: number;
  pendingPct: number;
  overduePct: number;
};

/** Quebra um conjunto de lançamentos em realizado / a vencer / vencido. */
export function reconcile(rows: TxRow[]): Reconciliation {
  let settled = 0;
  let pending = 0;
  let overdue = 0;
  for (const r of rows) {
    const s = effectiveStatus(r);
    if (s === "settled") settled += r.amount;
    else if (s === "overdue") overdue += r.amount;
    else pending += r.amount;
  }
  const total = settled + pending + overdue;
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);
  return {
    settled,
    pending,
    overdue,
    total,
    settledPct: pct(settled),
    pendingPct: pct(pending),
    overduePct: pct(overdue),
  };
}
