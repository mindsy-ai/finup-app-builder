import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Heart,
  LayoutGrid,
  Plus,
  Repeat,
  Table as TableIcon,
  Trash2,
  Users,
  UserX,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  bookClientRevenue,
  cancelFutureClientRevenue,
  createClient,
  deleteClient,
  fetchClients,
  updateClient,
  type ClientRow,
  type ClientStage,
  type ClientStatus,
  type NewClient,
} from "@/lib/clients";
import { fetchTransactions } from "@/lib/transactions";
import { formatBRL, formatDateBR, formatMonthYearPT, parseDateLocal } from "@/lib/format";
import { usePeriod } from "@/lib/period";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes · FinUp" },
      { name: "description", content: "Base de clientes e pipeline de vendas." },
    ],
  }),
  component: ClientesPage,
});

const STAGES: { key: ClientStage; label: string; color: string }[] = [
  { key: "prospeccao", label: "Prospecção", color: "var(--text-muted)" },
  { key: "proposta_enviada", label: "Proposta Enviada", color: "var(--brand-purple)" },
  { key: "negociacao", label: "Negociação", color: "var(--brand-orange)" },
  { key: "ativo", label: "Fechado — Ganhou", color: "var(--income)" },
];

const STATUS_META: Record<ClientStatus, { label: string; color: string; bg: string }> = {
  ativo: { label: "Ativo", color: "var(--income)", bg: "rgba(34,197,94,0.12)" },
  em_negociacao: {
    label: "Em negociação",
    color: "var(--brand-orange)",
    bg: "rgba(255,92,26,0.12)",
  },
  cancelado: { label: "Cancelado", color: "var(--expense)", bg: "rgba(239,68,68,0.12)" },
};

function probStyle(p: number) {
  if (p >= 70) return { color: "var(--income)", background: "rgba(34,197,94,0.1)" };
  if (p >= 50) return { color: "var(--brand-orange)", background: "rgba(255,92,26,0.1)" };
  return { color: "var(--text-secondary)", background: "rgba(161,161,170,0.12)" };
}

type ClientFormState = {
  name: string;
  nicho: string;
  owner: string;
  email: string;
  phone: string;
  stage: ClientStage;
  status: ClientStatus;
  probability: number;
  monthly_amount: string;
};

const EMPTY_FORM: ClientFormState = {
  name: "",
  nicho: "",
  owner: "",
  email: "",
  phone: "",
  stage: "prospeccao",
  status: "em_negociacao",
  probability: 50,
  monthly_amount: "",
};

function ClientesPage() {
  const qc = useQueryClient();
  const clientsQuery = useQuery({ queryKey: ["clients"], queryFn: fetchClients });
  const txQuery = useQuery({ queryKey: ["transactions"], queryFn: fetchTransactions });

  const [view, setView] = useState<"pipeline" | "table">("pipeline");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<ClientFormState>(EMPTY_FORM);

  const { refDate } = usePeriod();
  const clients = clientsQuery.data ?? [];
  const rows = txQuery.data ?? [];
  const monthRows = rows.filter((r) => {
    const d = parseDateLocal(r.occurred_at);
    return d.getMonth() === refDate.getMonth() && d.getFullYear() === refDate.getFullYear();
  });

  const clientStats = useMemo(() => {
    const map = new Map<
      string,
      { ltv: number; monthly: number; recorrente: number; outros: number }
    >();
    for (const r of rows) {
      if (r.type !== "income" || !r.client_id) continue;
      const s = map.get(r.client_id) ?? { ltv: 0, monthly: 0, recorrente: 0, outros: 0 };
      s.ltv += r.amount;
      const d = parseDateLocal(r.occurred_at);
      if (d.getMonth() === refDate.getMonth() && d.getFullYear() === refDate.getFullYear())
        s.monthly += r.amount;
      if (r.entry_type === "recorrente") s.recorrente += r.amount;
      else s.outros += r.amount;
      map.set(r.client_id, s);
    }
    return map;
  }, [rows, refDate]);

  const enriched = clients.map((c) => {
    const stats = clientStats.get(c.id) ?? { ltv: 0, monthly: 0, recorrente: 0, outros: 0 };
    const revTotal = stats.recorrente + stats.outros;
    const recShare =
      revTotal > 0
        ? Math.round((stats.recorrente / revTotal) * 100)
        : c.monthly_amount > 0
          ? 100
          : 0;
    const revLabel =
      revTotal === 0 && c.monthly_amount === 0
        ? null
        : recShare >= 100
          ? { label: "Recorrência", color: "var(--brand-purple)", bg: "rgba(124,58,255,0.12)" }
          : recShare <= 0
            ? { label: "Serviços", color: "var(--brand-orange)", bg: "rgba(255,92,26,0.12)" }
            : { label: "Misto", color: "var(--income)", bg: "rgba(34,197,94,0.12)" };
    // como a recorrência do contrato está sendo tratada no mês visualizado
    const booked = monthRows.some(
      (t) => t.type === "income" && t.entry_type === "recorrente" && t.client_id === c.id,
    );
    const contractState =
      c.monthly_amount <= 0
        ? null
        : c.status === "ativo"
          ? booked
            ? { label: "Contabilizado", color: "var(--income)", bg: "rgba(34,197,94,0.12)" }
            : { label: "A lançar", color: "var(--brand-orange)", bg: "rgba(255,92,26,0.12)" }
          : c.status === "em_negociacao"
            ? {
                label: "Aguardando confirmação",
                color: "var(--text-secondary)",
                bg: "rgba(161,161,170,0.12)",
              }
            : { label: "Encerrado", color: "var(--expense)", bg: "rgba(239,68,68,0.12)" };
    return { ...c, ...stats, recShare, servShare: 100 - recShare, revLabel, booked, contractState };
  });

  const mrr = enriched
    .filter((c) => c.status === "ativo")
    .reduce((s, c) => s + c.monthly_amount, 0);
  const nActive = enriched.filter((c) => c.status === "ativo").length;
  const nCancel = enriched.filter((c) => c.status === "cancelado").length;
  const retencao = nActive + nCancel > 0 ? Math.round((nActive / (nActive + nCancel)) * 100) : null;

  const stages = STAGES.map((s) => ({
    ...s,
    clients: enriched.filter((c) => c.stage === s.key),
  }));

  const selected = enriched.find((c) => c.id === selectedId) ?? null;

  // contratos ativos cuja recorrência do mês ainda não virou receita
  const pendingActivation = enriched.filter(
    (c) => c.status === "ativo" && c.monthly_amount > 0 && !c.booked,
  );
  const negotiatingTotal = enriched
    .filter((c) => c.status === "em_negociacao")
    .reduce((s, c) => s + c.monthly_amount, 0);

  const bookPending = useMutation({
    mutationFn: async (items: ClientRow[]) => {
      for (const c of items) await bookClientRevenue(c, refDate);
      return items.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(n === 1 ? "Recorrência lançada" : `${n} recorrências lançadas`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** já existe recorrência lançada para este cliente no mês visualizado? */
  const hasRevenueThisMonth = (clientId: string) =>
    monthRows.some(
      (t) => t.type === "income" && t.entry_type === "recorrente" && t.client_id === clientId,
    );

  /**
   * O status do contrato decide o que acontece com a recorrência:
   * ativo lança a receita do mês, cancelado apaga o que ainda não aconteceu,
   * em negociação não movimenta nada — é possibilidade, não receita.
   */
  const applyStatusEffects = async (client: ClientRow) => {
    if (client.status === "ativo" && client.monthly_amount > 0 && !hasRevenueThisMonth(client.id)) {
      await bookClientRevenue(client, refDate);
      return "booked" as const;
    }
    if (client.status === "cancelado") {
      await cancelFutureClientRevenue(client.id, refDate);
      return "cancelled" as const;
    }
    return "none" as const;
  };

  const createMutation = useMutation({
    mutationFn: async (input: NewClient) => {
      const id = await createClient(input);
      return applyStatusEffects({ ...(input as ClientRow), id });
    },
    onSuccess: (effect) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(
        effect === "booked" ? "Cliente ativo — recorrência lançada no mês" : "Cliente adicionado",
      );
      closeForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<NewClient> }) => {
      await updateClient(id, input);
      return applyStatusEffects({ ...(input as ClientRow), id });
    },
    onSuccess: (effect) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(
        effect === "booked"
          ? "Contrato ativado — recorrência lançada no mês"
          : effect === "cancelled"
            ? "Contrato cancelado — meses futuros removidos"
            : "Cliente atualizado",
      );
      closeForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removal = useMutation({
    mutationFn: deleteClient,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Cliente excluído");
      setDeleting(false);
      setSelectedId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const openEdit = () => {
    if (!selected) return;
    setForm({
      name: selected.name,
      nicho: selected.nicho,
      owner: selected.owner,
      email: selected.email,
      phone: selected.phone,
      stage: selected.stage,
      status: selected.status,
      probability: selected.probability,
      monthly_amount: selected.monthly_amount > 0 ? String(selected.monthly_amount) : "",
    });
    setEditingId(selected.id);
    setShowForm(true);
  };

  const pending = createMutation.isPending || updateMutation.isPending;

  const submit = () => {
    if (!form.name.trim()) return;
    const input: NewClient = {
      name: form.name.trim(),
      nicho: form.nicho.trim(),
      owner: form.owner.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      stage: form.stage,
      status: form.status,
      probability: form.probability,
      monthly_amount: Number(form.monthly_amount) || 0,
    };
    if (editingId) updateMutation.mutate({ id: editingId, input });
    else createMutation.mutate(input);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold leading-tight text-white">Clientes</h1>
          <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
            Base de clientes e pipeline · {formatBRL(mrr)}/mês em recorrência ativa
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white gradient-brand"
        >
          <Plus className="h-4 w-4" />
          Novo Cliente
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniKpi
          label="Clientes Ativos"
          value={String(nActive)}
          icon={Users}
          color="var(--income)"
          bg="rgba(34,197,94,0.13)"
        />
        <MiniKpi
          label="MRR (Recorrência)"
          value={formatBRL(mrr)}
          icon={Repeat}
          color="var(--brand-purple)"
          bg="rgba(124,58,255,0.13)"
        />
        <MiniKpi
          label="Cancelados"
          value={String(nCancel)}
          icon={UserX}
          color="var(--expense)"
          bg="rgba(239,68,68,0.13)"
        />
        <MiniKpi
          label="Taxa de Retenção"
          value={retencao === null ? "—" : `${retencao}%`}
          icon={Heart}
          color="var(--brand-orange)"
          bg="rgba(255,92,26,0.13)"
        />
      </div>

      {(pendingActivation.length > 0 || negotiatingTotal > 0) && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] px-5 py-3.5">
          {pendingActivation.length > 0 && (
            <p className="text-xs text-[color:var(--text-secondary)]">
              <strong className="font-bold text-[color:var(--brand-orange)]">
                {formatBRL(pendingActivation.reduce((s, c) => s + c.monthly_amount, 0))}
              </strong>{" "}
              de contratos ativos ainda não lançados em {formatMonthYearPT(refDate)}
            </p>
          )}
          {negotiatingTotal > 0 && (
            <p className="text-xs text-[color:var(--text-secondary)]">
              <strong className="font-bold text-white">{formatBRL(negotiatingTotal)}</strong> em
              negociação — não conta como receita até o contrato virar ativo
            </p>
          )}
          {pendingActivation.length > 0 && (
            <button
              type="button"
              disabled={bookPending.isPending}
              onClick={() => bookPending.mutate(pendingActivation)}
              className="ml-auto rounded-md px-3 py-1.5 text-[11px] font-bold text-white gradient-brand disabled:opacity-50"
            >
              {bookPending.isPending ? "Lançando..." : "Lançar recorrências"}
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 rounded-[11px] bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setView("pipeline")}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
              view === "pipeline" ? "text-white" : "text-[color:var(--text-secondary)]"
            }`}
            style={view === "pipeline" ? { background: "var(--brand-purple)" } : undefined}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Pipeline
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
              view === "table" ? "text-white" : "text-[color:var(--text-secondary)]"
            }`}
            style={view === "table" ? { background: "var(--brand-purple)" } : undefined}
          >
            <TableIcon className="h-3.5 w-3.5" />
            Tabela
          </button>
        </div>
        <span className="text-[11px] text-[color:var(--text-secondary)]">
          Clique em um cliente para ver os detalhes
        </span>
      </div>

      {view === "pipeline" && (
        <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {stages.map((stage) => (
            <div key={stage.key} className="min-h-[120px] rounded-xl bg-white/[0.03] p-3">
              <div className="flex items-center justify-between px-1.5 pb-3 pt-1">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ background: stage.color }} />
                  <span className="text-xs font-bold text-white">{stage.label}</span>
                </div>
                <span className="rounded-full bg-[color:var(--bg-card)] px-2 py-0.5 text-[11px] font-bold text-[color:var(--text-secondary)]">
                  {stage.clients.length}
                </span>
              </div>
              {stage.clients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className="mb-2.5 block w-full rounded-[10px] border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-3.5 text-left transition-[filter] hover:brightness-110"
                >
                  <div className="mb-2.5 flex items-center gap-2.5">
                    <Avatar name={c.name} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-white">{c.name}</p>
                      <p className="text-[10px] text-[color:var(--text-secondary)]">{c.nicho}</p>
                    </div>
                  </div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-bold text-white tabular-nums">
                      {c.monthly_amount > 0 ? `${formatBRL(c.monthly_amount)}/mês` : "—"}
                    </span>
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                      style={probStyle(c.probability)}
                    >
                      {c.probability}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[10px] text-[color:var(--text-secondary)]">
                    <span className="truncate">{c.owner || "—"}</span>
                    {c.contractState && (
                      <span
                        className="flex-shrink-0 rounded-full px-1.5 py-px font-bold"
                        style={{ color: c.contractState.color, background: c.contractState.bg }}
                      >
                        {c.contractState.label}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {view === "table" && (
        <div className="overflow-hidden rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)]">
          <div className="grid grid-cols-[2.2fr_1.3fr_1.2fr_1.3fr_1fr] gap-3 border-b border-[color:var(--border-default)] bg-white/[0.03] px-5 py-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-secondary)]">
              Cliente
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-secondary)]">
              Nicho
            </span>
            <span className="text-right text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-secondary)]">
              Recorrência
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-secondary)]">
              Contrato
            </span>
            <span className="text-right text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-secondary)]">
              Status
            </span>
          </div>
          {enriched.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-[color:var(--text-muted)]">
              Nenhum cliente cadastrado.
            </p>
          )}
          {enriched.map((c) => {
            const sm = STATUS_META[c.status];
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className="grid w-full grid-cols-[2.2fr_1.3fr_1.2fr_1.3fr_1fr] items-center gap-3 border-b border-[color:var(--border-subtle)] px-5 py-3.5 text-left last:border-b-0 hover:bg-white/5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={c.name} />
                  <span className="truncate text-[13px] font-medium text-white">{c.name}</span>
                </div>
                <span className="text-xs font-medium text-[color:var(--text-secondary)]">
                  {c.nicho}
                </span>
                <span className="text-right text-sm font-bold text-white tabular-nums">
                  {c.monthly_amount > 0 ? `${formatBRL(c.monthly_amount)}/mês` : "—"}
                </span>
                <div>
                  {c.contractState ? (
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                      style={{ color: c.contractState.color, background: c.contractState.bg }}
                    >
                      {c.contractState.label}
                    </span>
                  ) : (
                    <span className="text-xs text-[color:var(--text-muted)]">—</span>
                  )}
                </div>
                <div className="flex justify-end">
                  <span
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold"
                    style={{ color: sm.color, background: sm.bg }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: sm.color }} />
                    {sm.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/55"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="h-full w-full max-w-[460px] overflow-y-auto border-l border-[color:var(--border-default)] bg-[color:var(--bg-primary)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 border-b border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-6">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <Avatar name={selected.name} size={52} />
                  <div>
                    <p className="text-lg font-bold text-white">{selected.name}</p>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                      style={{
                        color: STATUS_META[selected.status].color,
                        background: STATUS_META[selected.status].bg,
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: STATUS_META[selected.status].color }}
                      />
                      {STATUS_META[selected.status].label}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Fechar detalhes do cliente"
                  onClick={() => setSelectedId(null)}
                  className="rounded-lg bg-white/5 p-1.5 hover:bg-white/10"
                >
                  <X className="h-4 w-4 text-[color:var(--text-secondary)]" />
                </button>
              </div>
              {selected.nicho && (
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-[color:var(--text-secondary)]">
                  {selected.nicho}
                </span>
              )}
            </div>

            <div className="space-y-5 p-6">
              <div className="rounded-2xl border border-[color:var(--brand-purple)]/25 bg-gradient-to-br from-[color:var(--brand-purple)]/[0.14] to-[color:var(--brand-orange)]/10 p-5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.07em] text-[color:var(--text-secondary)]">
                  Total gerado no período
                </p>
                <p className="mb-1.5 text-[28px] font-black leading-none text-white tabular-nums">
                  {selected.ltv > 0 ? formatBRL(selected.ltv) : "—"}
                </p>
                <p className="text-xs text-[color:var(--text-secondary)]">
                  Cliente desde {selected.since ? formatDateBR(selected.since) : "—"} · Responsável:{" "}
                  {selected.owner || "—"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-secondary)]">
                    Recorrência Mensal
                  </p>
                  <p className="text-xl font-bold text-white tabular-nums">
                    {selected.monthly_amount > 0 ? formatBRL(selected.monthly_amount) : "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-secondary)]">
                    Faturado no período
                  </p>
                  <p className="text-xl font-bold text-white tabular-nums">
                    {selected.monthly > 0 ? formatBRL(selected.monthly) : "—"}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-bold text-white">Origem da receita recebida</p>
                <p className="mb-3 text-[11px] text-[color:var(--text-secondary)]">
                  Como esse cliente gera receita para o negócio
                </p>
                <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-4">
                  <div className="mb-3 flex h-2.5 gap-0.5 overflow-hidden rounded-md">
                    <div
                      style={{ width: `${selected.recShare}%`, background: "var(--brand-purple)" }}
                    />
                    <div
                      style={{ width: `${selected.servShare}%`, background: "var(--brand-orange)" }}
                    />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-white">
                      <span className="h-2 w-2 rounded-sm bg-[color:var(--brand-purple)]" />
                      Recorrência <strong>{selected.recShare}%</strong>
                    </span>
                    <span className="flex items-center gap-1.5 text-white">
                      <span className="h-2 w-2 rounded-sm bg-[color:var(--brand-orange)]" />
                      Serviços <strong>{selected.servShare}%</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-bold text-white">Informações do cliente</p>
                <div className="overflow-hidden rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)]">
                  <InfoRow label="E-mail" value={selected.email || "—"} />
                  <InfoRow label="Telefone" value={selected.phone || "—"} />
                  <InfoRow
                    label="Etapa no pipeline"
                    value={STAGES.find((s) => s.key === selected.stage)?.label ?? "—"}
                  />
                  <InfoRow label="Probabilidade" value={`${selected.probability}%`} />
                  <InfoRow label="Responsável" value={selected.owner || "—"} last />
                </div>
              </div>

              <div className="flex gap-2.5">
                <Link
                  to="/lancamentos"
                  className="flex-1 rounded-[10px] px-3 py-3 text-center text-xs font-bold text-white gradient-brand"
                >
                  Ver histórico
                </Link>
                <button
                  type="button"
                  onClick={openEdit}
                  className="flex-1 rounded-[10px] border border-[color:var(--border-default)] bg-[color:var(--bg-card)] px-3 py-3 text-center text-xs font-bold text-white"
                >
                  Editar cliente
                </button>
                <button
                  type="button"
                  aria-label="Excluir cliente"
                  title="Excluir cliente"
                  onClick={() => setDeleting(true)}
                  className="rounded-[10px] border border-[color:var(--border-default)] bg-[color:var(--bg-card)] px-3.5 py-3 text-[color:var(--text-secondary)] hover:border-[color:var(--expense)]/50 hover:text-[color:var(--expense)]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleting && selected && (
        <ConfirmDialog
          title="Excluir cliente"
          message={`“${selected.name}” será removido permanentemente. Os lançamentos vinculados a ele permanecem no histórico, mas ficam sem cliente associado.`}
          pending={removal.isPending}
          onConfirm={() => removal.mutate(selected.id)}
          onCancel={() => setDeleting(false)}
        />
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={closeForm}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-white">
              {editingId ? "Editar Cliente" : "Novo Cliente"}
            </h2>
            <div className="mt-4 space-y-3">
              <Field label="Nome">
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nicho">
                  <input
                    value={form.nicho}
                    onChange={(e) => setForm((f) => ({ ...f, nicho: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
                <Field label="Responsável">
                  <input
                    value={form.owner}
                    onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="E-mail">
                  <input
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
                <Field label="Telefone">
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Recorrência mensal (R$)">
                  <input
                    type="number"
                    min={0}
                    value={form.monthly_amount}
                    onChange={(e) => setForm((f) => ({ ...f, monthly_amount: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
                <Field label={`Probabilidade · ${form.probability}%`}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={form.probability}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, probability: Number(e.target.value) }))
                    }
                    className="mt-2.5 w-full accent-[color:var(--brand-purple)]"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Etapa">
                  <select
                    value={form.stage}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, stage: e.target.value as ClientStage }))
                    }
                    className={inputCls}
                  >
                    {STAGES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Status">
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value as ClientStatus }))
                    }
                    className={inputCls}
                  >
                    {Object.entries(STATUS_META).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-md border border-[color:var(--border-default)] px-4 py-2 text-sm font-medium text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={pending || !form.name.trim()}
                onClick={submit}
                className="rounded-md px-4 py-2 text-sm font-semibold text-white gradient-brand disabled:opacity-50"
              >
                {pending ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white gradient-brand"
      style={{ width: size, height: size }}
    >
      {initials || "?"}
    </div>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 ${last ? "" : "border-b border-[color:var(--border-subtle)]"}`}
    >
      <span className="text-xs text-[color:var(--text-secondary)]">{label}</span>
      <span className="text-xs font-medium text-white">{value}</span>
    </div>
  );
}

function MiniKpi({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-[18px]">
      <div className="mb-3 flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-[9px]"
          style={{ background: bg }}
        >
          <Icon className="h-[17px] w-[17px]" style={{ color }} />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[color:var(--text-secondary)]">
          {label}
        </p>
      </div>
      <p className="text-xl font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-primary)] px-3 py-2 text-sm text-white placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--brand-purple)] focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--text-secondary)]">
        {label}
      </span>
      {children}
    </label>
  );
}
