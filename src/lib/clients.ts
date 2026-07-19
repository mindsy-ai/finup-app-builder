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

export async function createClient(input: NewClient) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");
  const { error } = await supabase.from("clients").insert({ ...input, user_id: userData.user.id });
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
