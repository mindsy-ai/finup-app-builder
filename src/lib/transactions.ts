import { supabase } from "@/integrations/supabase/client";

export type TxRow = {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  occurred_at: string;
  status: "paid" | "pending" | "overdue";
};

export async function fetchTransactions(): Promise<TxRow[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("id, type, amount, category, description, occurred_at, status")
    .order("occurred_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })) as TxRow[];
}

export type NewTx = {
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  occurred_at: string;
  status?: "paid" | "pending" | "overdue";
};

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
