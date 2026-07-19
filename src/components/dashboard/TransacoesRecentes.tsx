import { ArrowDown, ArrowUp, Clock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { TxRow } from "@/lib/transactions";
import { formatBRL, formatDateBR } from "@/lib/format";
import { effectiveStatus, statusVisual } from "@/lib/status";

export function TransacoesRecentes({ rows }: { rows: TxRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)]">
      <div className="flex items-center justify-between border-b border-[color:var(--border-default)] px-5 py-4">
        <h3 className="text-sm font-bold text-white">Transações Recentes</h3>
        <Link
          to="/lancamentos"
          className="text-xs font-bold text-[color:var(--brand-purple)] hover:underline"
        >
          Ver todas →
        </Link>
      </div>
      <ul>
        {rows.length === 0 && (
          <li className="px-5 py-10 text-center text-sm text-[color:var(--text-muted)]">
            Nenhuma transação ainda. Use “+ Lançamento” para começar.
          </li>
        )}
        {rows.map((r) => {
          const isIncome = r.type === "income";
          const status = effectiveStatus(r);
          const sv = statusVisual(status, r.type);
          // valor em aberto não pode parecer dinheiro já movimentado
          const settled = status === "settled";
          return (
            <li
              key={r.id}
              className="flex items-center gap-3.5 border-b border-[color:var(--border-subtle)] px-5 py-3 last:border-b-0"
            >
              <div
                className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px]"
                style={{ background: isIncome ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.1)" }}
              >
                {isIncome ? (
                  <ArrowUp className="h-[19px] w-[19px] text-[color:var(--income)]" />
                ) : (
                  <ArrowDown className="h-[19px] w-[19px] text-[color:var(--expense)]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-white">{r.description}</p>
                <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-[color:var(--text-secondary)]">
                  <span>
                    {r.category} · {formatDateBR(r.occurred_at)}
                  </span>
                  {!settled && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[9px] font-bold"
                      style={{ color: sv.color, background: sv.bg }}
                    >
                      <Clock className="h-2.5 w-2.5" />
                      {sv.label}
                    </span>
                  )}
                </p>
              </div>
              <span
                className={`whitespace-nowrap text-[13.5px] font-bold tabular-nums ${
                  settled ? "" : "opacity-60"
                }`}
                style={{
                  color: settled
                    ? isIncome
                      ? "var(--income)"
                      : "var(--expense)"
                    : "var(--text-secondary)",
                }}
              >
                {isIncome ? "+" : "−"}
                {formatBRL(r.amount)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
