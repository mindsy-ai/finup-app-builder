import { ArrowDown, ArrowUp } from "lucide-react";
import type { TxRow } from "@/lib/transactions";
import { formatBRL, formatDateBR } from "@/lib/format";

export function TransacoesRecentes({ rows }: { rows: TxRow[] }) {
  return (
    <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)]">
      <div className="flex items-center justify-between px-5 py-4">
        <h3 className="text-base font-semibold text-white">Transações Recentes</h3>
        <button
          type="button"
          className="text-xs font-medium text-[color:var(--brand-purple)] hover:underline"
        >
          Ver todas →
        </button>
      </div>
      <ul>
        {rows.length === 0 && (
          <li className="px-5 py-10 text-center text-sm text-[color:var(--text-muted)]">
            Nenhuma transação ainda. Use “+ Lançamento” para começar.
          </li>
        )}
        {rows.map((r) => {
          const isIncome = r.type === "income";
          return (
            <li
              key={r.id}
              className="flex items-center justify-between border-t border-[color:var(--border-subtle)] px-5 py-3.5"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${
                    isIncome ? "bg-[#052e16]" : "bg-[#2d0a0a]"
                  }`}
                >
                  {isIncome ? (
                    <ArrowUp className="h-4 w-4 text-[color:var(--income)]" />
                  ) : (
                    <ArrowDown className="h-4 w-4 text-[color:var(--expense)]" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{r.description}</div>
                  <div className="text-xs text-[color:var(--text-secondary)]">
                    {r.category} · {formatDateBR(r.occurred_at)}
                  </div>
                </div>
              </div>
              <div
                className={`text-sm font-semibold ${isIncome ? "text-[color:var(--income)]" : "text-[color:var(--expense)]"}`}
              >
                {isIncome ? "+" : "−"}
                {formatBRL(r.amount)}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
