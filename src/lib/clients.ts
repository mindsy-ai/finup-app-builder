import { supabase } from "@/integrations/supabase/client";

export type ClientStatus = "ativo" | "em_negociacao" | "cancelado";
export type ClientStage = "prospeccao" | "proposta_enviada" | "negociacao" | "ativo" | "cancelado";

export type ClientRow = {
  id: string;
  name: string;
  nicho: string;
  status: ClientStatus;
  stage: ClientStage;
  probability: number;
  owner: string;
  since: string | null;
  monthly_amount: number;
  email: string;
  phone: string;
};

export async function fetchClients(): Promise<ClientRow[]> {
  const { data, error } = await supabase
    .from("clients")
    .select(
      "id, name, nicho, status, stage, probability, owner, since, monthly_amount, email, phone",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((c) => ({
    ...c,
    monthly_amount: Number(c.monthly_amount),
  })) as ClientRow[];
}

export type NewClient = {
  name: string;
  nicho?: string;
  status?: ClientStatus;
  stage?: ClientStage;
  probability?: number;
  owner?: string;
  since?: string | null;
  monthly_amount?: number;
  email?: string;
  phone?: string;
};

export async function createClient(input: NewClient): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");
  const { data, error } = await supabase
    .from("clients")
    .insert({ ...input, user_id: userData.user.id })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Descrição padrão da recorrência de um cliente, usada para reconhecê-la depois. */
export const clientRevenueDescription = (name: string) => `Recorrência — ${name.trim()}`;

/**
 * Lança a recorrência do cliente no mês de referência.
 *
 * Um contrato ativo é receita ganha por competência: entra no lucro assim que
 * existe, mesmo antes de o dinheiro cair. Por isso nasce como "a receber" —
 * confirmar o recebimento é que o leva para o fluxo de caixa.
 */
export async function bookClientRevenue(client: ClientRow, refDate: Date) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");

  const lastDay = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate();
  const today = new Date();
  const sameMonth =
    today.getFullYear() === refDate.getFullYear() && today.getMonth() === refDate.getMonth();
  const day = sameMonth ? Math.min(today.getDate(), lastDay) : 1;
  const occurredAt = toISODate(new Date(refDate.getFullYear(), refDate.getMonth(), day));

  const { error } = await supabase.from("transactions").insert({
    user_id: userData.user.id,
    type: "income",
    description: clientRevenueDescription(client.name),
    category: "Recorrência",
    amount: client.monthly_amount,
    occurred_at: occurredAt,
    due_date: occurredAt,
    status: "pending",
    client_id: client.id,
    entry_type: "recorrente",
    is_recurring: true,
  });
  if (error) throw error;
}

/**
 * Ao cancelar um contrato, some com o que ainda não aconteceu.
 *
 * O que já foi faturado — meses anteriores e o mês corrente — permanece: o
 * cliente esteve ativo e aquilo foi ganho de verdade.
 */
export async function cancelFutureClientRevenue(clientId: string, refDate: Date) {
  const firstOfNextMonth = toISODate(new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1));
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("client_id", clientId)
    .eq("entry_type", "recorrente")
    .eq("status", "pending")
    .gte("occurred_at", firstOfNextMonth);
  if (error) throw error;
}

export async function updateClient(id: string, input: Partial<NewClient>) {
  const { error } = await supabase.from("clients").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteClient(id: string) {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}
