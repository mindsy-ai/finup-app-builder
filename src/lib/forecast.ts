import { useMemo } from "react";
import type { TxRow } from "@/lib/transactions";
import type { ClientRow } from "@/lib/clients";
import { type RecurringExpenseRow } from "@/lib/recurring";
import { parseDateLocal } from "@/lib/format";

const MONTHS_BY_FREQUENCY: Record<string, number> = {
  Mensal: 1,
  Trimestral: 3,
  Semestral: 6,
  Anual: 12,
};

const monthsBetween = (from: Date, to: Date) =>
  (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());

/**
 * Uma recorrência acontece no mês de referência se a distância até o próximo
 * vencimento for múltipla da frequência — e se o mês não for anterior ao cadastro.
 */
export function occursInMonth(r: RecurringExpenseRow, refDate: Date): boolean {
  const created = parseDateLocal(r.created_at.slice(0, 10));
  if (monthsBetween(created, refDate) < 0) return false;
  const step = MONTHS_BY_FREQUENCY[r.frequency] ?? 1;
  const diff = monthsBetween(parseDateLocal(r.next_due_date), refDate);
  return diff % step === 0;
}

/** Dia do vencimento dentro do mês de referência, respeitando meses curtos. */
export function dueDateInMonth(r: RecurringExpenseRow, refDate: Date): Date {
  const due = parseDateLocal(r.next_due_date);
  const lastDay = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate();
  return new Date(refDate.getFullYear(), refDate.getMonth(), Math.min(due.getDate(), lastDay));
}

export type ExpectedExpense = RecurringExpenseRow & { launched: boolean; dueDate: Date };
export type ExpectedIncome = {
  clientId: string;
  clientName: string;
  amount: number;
  booked: boolean;
};

export type ForecastData = {
  /** despesas recorrentes previstas para o mês (lançadas ou não) */
  expectedExpenses: ExpectedExpense[];
  /** receita recorrente esperada dos contratos ativos */
  expectedIncome: ExpectedIncome[];
  /** total de despesa recorrente ainda não lançada */
  pendingExpenseTotal: number;
  /** total de receita recorrente ainda não lançada */
  pendingIncomeTotal: number;
  /** já lançado no mês */
  bookedIncome: number;
  bookedExpense: number;
  /** lançado + previsto */
  projectedIncome: number;
  projectedExpense: number;
  hasPending: boolean;
};

export function useForecast(
  transactions: TxRow[] | undefined,
  recurring: RecurringExpenseRow[] | undefined,
  clients: ClientRow[] | undefined,
  refDate: Date,
): ForecastData {
  return useMemo(() => {
    const txs = transactions ?? [];
    const monthRows = txs.filter((t) => {
      const d = parseDateLocal(t.occurred_at);
      return d.getMonth() === refDate.getMonth() && d.getFullYear() === refDate.getFullYear();
    });

    const launchedRecurringExpenses = monthRows.filter(
      (t) => t.type === "expense" && t.is_recurring,
    );
    const expectedExpenses: ExpectedExpense[] = (recurring ?? [])
      .filter((r) => occursInMonth(r, refDate))
      .map((r) => ({
        ...r,
        launched: launchedRecurringExpenses.some((t) => t.description.trim() === r.name.trim()),
        dueDate: dueDateInMonth(r, refDate),
      }))
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    const recurringIncomeByClient = new Map<string, number>();
    monthRows
      .filter((t) => t.type === "income" && t.entry_type === "recorrente" && t.client_id)
      .forEach((t) =>
        recurringIncomeByClient.set(
          t.client_id!,
          (recurringIncomeByClient.get(t.client_id!) ?? 0) + t.amount,
        ),
      );

    const expectedIncome: ExpectedIncome[] = (clients ?? [])
      .filter((c) => c.status === "ativo" && c.monthly_amount > 0)
      .map((c) => ({
        clientId: c.id,
        clientName: c.name,
        amount: c.monthly_amount,
        booked: (recurringIncomeByClient.get(c.id) ?? 0) >= c.monthly_amount,
      }));

    const pendingExpenseTotal = expectedExpenses
      .filter((e) => !e.launched)
      .reduce((s, e) => s + e.amount, 0);
    const pendingIncomeTotal = expectedIncome
      .filter((e) => !e.booked)
      .reduce((s, e) => s + e.amount, 0);

    const bookedIncome = monthRows
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + t.amount, 0);
    const bookedExpense = monthRows
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + t.amount, 0);

    return {
      expectedExpenses,
      expectedIncome,
      pendingExpenseTotal,
      pendingIncomeTotal,
      bookedIncome,
      bookedExpense,
      projectedIncome: bookedIncome + pendingIncomeTotal,
      projectedExpense: bookedExpense + pendingExpenseTotal,
      hasPending: pendingExpenseTotal > 0 || pendingIncomeTotal > 0,
    };
  }, [transactions, recurring, clients, refDate]);
}
