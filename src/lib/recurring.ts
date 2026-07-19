import { supabase } from "@/integrations/supabase/client";
import { parseDateLocal } from "@/lib/format";

export type RecurringExpenseRow = {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  next_due_date: string;
  category: string;
  created_at: string;
};

export async function fetchRecurringExpenses(): Promise<RecurringExpenseRow[]> {
  const { data, error } = await supabase
    .from("recurring_expenses")
    .select("id, name, amount, frequency, next_due_date, category, created_at")
    .order("next_due_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })) as RecurringExpenseRow[];
}

export type NewRecurringExpense = {
  name: string;
  amount: number;
  frequency?: string;
  next_due_date?: string;
  category?: string;
};

export async function createRecurringExpense(input: NewRecurringExpense) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");
  const { error } = await supabase
    .from("recurring_expenses")
    .insert({ ...input, user_id: userData.user.id });
  if (error) throw error;
}

export async function updateRecurringExpense(id: string, input: Partial<NewRecurringExpense>) {
  const { error } = await supabase.from("recurring_expenses").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteRecurringExpense(id: string) {
  const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
  if (error) throw error;
}

const MONTHS_BY_FREQUENCY: Record<string, number> = {
  Mensal: 1,
  Trimestral: 3,
  Semestral: 6,
  Anual: 12,
};

/** Avança a data de vencimento conforme a frequência, preservando o fim de mês. */
export function advanceDueDate(date: string, frequency: string): string {
  const step = MONTHS_BY_FREQUENCY[frequency] ?? 1;
  const d = parseDateLocal(date);
  const day = d.getDate();
  const next = new Date(d.getFullYear(), d.getMonth() + step, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return toISODate(next);
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Gera a despesa do período a partir da recorrência e avança o próximo vencimento.
 *
 * A recorrência é apenas um agendamento: enquanto não vira uma transação, ela não
 * entra em nenhum total (despesas, DRE, lucro). Este passo é o que a torna real.
 */
export async function materializeRecurringExpense(r: RecurringExpenseRow, refDate: Date) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");

  // lança dentro do mês visualizado, mantendo o dia do vencimento
  const due = parseDateLocal(r.next_due_date);
  const lastDay = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate();
  const occurredAt = toISODate(
    new Date(refDate.getFullYear(), refDate.getMonth(), Math.min(due.getDate(), lastDay)),
  );

  const { error } = await supabase.from("transactions").insert({
    user_id: userData.user.id,
    type: "expense",
    description: r.name,
    category: r.category,
    amount: r.amount,
    occurred_at: occurredAt,
    due_date: occurredAt,
    status: "pending",
    is_recurring: true,
  });
  if (error) throw error;

  // Só avança o agendamento se lançamos o próprio vencimento pendente. Lançar um
  // mês retroativo não pode empurrar o próximo vencimento para frente.
  const isCurrentCycle =
    refDate.getFullYear() === due.getFullYear() && refDate.getMonth() === due.getMonth();
  if (isCurrentCycle) {
    const { error: updateError } = await supabase
      .from("recurring_expenses")
      .update({ next_due_date: advanceDueDate(r.next_due_date, r.frequency) })
      .eq("id", r.id);
    if (updateError) throw updateError;
  }
}
