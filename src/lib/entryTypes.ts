import { Repeat, MousePointerClick, Package, Coins, type LucideIcon } from "lucide-react";
import type { EntryType } from "@/lib/transactions";

export const ENTRY_TYPES: { key: EntryType; label: string }[] = [
  { key: "recorrente", label: "Recorrência" },
  { key: "servico", label: "Serviço" },
  { key: "venda", label: "Venda" },
  { key: "comissao", label: "Comissão" },
];

export const ENTRY_TYPE_COLOR: Record<EntryType, string> = {
  recorrente: "var(--brand-purple)",
  servico: "var(--brand-orange)",
  venda: "var(--income)",
  comissao: "var(--teal)",
};

export const ENTRY_TYPE_BG: Record<EntryType, string> = {
  recorrente: "rgba(124,58,255,0.12)",
  servico: "rgba(255,92,26,0.12)",
  venda: "rgba(34,197,94,0.12)",
  comissao: "rgba(45,212,191,0.12)",
};

export const ENTRY_TYPE_ICON: Record<EntryType, LucideIcon> = {
  recorrente: Repeat,
  servico: MousePointerClick,
  venda: Package,
  comissao: Coins,
};

export function entryTypeLabel(t: EntryType | null): string {
  return ENTRY_TYPES.find((e) => e.key === t)?.label ?? "Outro";
}
