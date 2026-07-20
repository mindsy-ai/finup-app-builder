import { supabase } from "@/integrations/supabase/client";

export type EntryType = "recorrente" | "servico" | "venda" | "comissao";

export type TxRow = {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  occurred_at: string;
  status: "paid" | "pending" | "overdue";
  client_id: string | null;
  entry_type: EntryType | null;
  due_date: string | null;
  is_recurring: boolean;
  client?: { name: string } | null;
};

const SELECT_COLUMNS =
  "id, type, amount, category, description, occurred_at, status, client_id, entry_type, due_date, is_recurring, client:clients(name)";

const PAGE_SIZE = 1000;

/**
 * Busca todas as transações paginando.
 *
 * Um limite fixo truncaria o histórico em silêncio assim que o volume crescesse,
 * e os totais passariam a mentir sem nenhum aviso.
 */
export async function fetchTransactions(): Promise<TxRow[]> {
  const all: TxRow[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from("transactions")
      .select(SELECT_COLUMNS)
      .order("occurred_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })) as TxRow[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

export type NewTx = {
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  occurred_at: string;
  status?: "paid" | "pending" | "overdue";
  client_id?: string | null;
  entry_type?: EntryType | null;
  due_date?: string | null;
  is_recurring?: boolean;
};

/** Confirma recebimento/pagamento — ou desfaz, voltando para pendente. */
export async function settleTransaction(id: string, settled: boolean) {
  const { error } = await supabase
    .from("transactions")
    .update({ status: settled ? "paid" : "pending" })
    .eq("id", id);
  if (error) throw error;
}

export async function createTransaction(input: NewTx) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");
  const { error } = await supabase.from("transactions").insert({
    ...input,
    status: input.status ?? "paid",
    user_id: userData.user.id,
  });
  if (error) throw error;
}

export async function updateTransaction(id: string, input: Partial<NewTx>) {
  const { error } = await supabase.from("transactions").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
}

/** Categorias já usadas, para sugerir no formulário e evitar variações do mesmo nome. */
export function existingCategories(rows: TxRow[] | undefined): string[] {
  const seen = new Map<string, string>();
  for (const r of rows ?? []) {
    const raw = r.category.trim();
    if (!raw) continue;
    const key = raw
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (!seen.has(key)) seen.set(key, raw);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
