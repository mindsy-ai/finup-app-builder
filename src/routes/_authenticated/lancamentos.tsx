import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  fetchTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  settleTransaction,
  type EntryType,
  type NewTx,
} from "@/lib/transactions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { fetchRecurringExpenses } from "@/lib/recurring";
import { useForecast } from "@/lib/forecast";
import {
  dueLabel,
  effectiveStatus,
  reconcile,
  statusVisual,
  type EffectiveStatus,
} from "@/lib/status";
import { ReconciliationBar } from "@/components/ReconciliationBar";
import { fetchClients } from "@/lib/clients";
import {
  ENTRY_TYPES,
  ENTRY_TYPE_BG,
  ENTRY_TYPE_COLOR,
  ENTRY_TYPE_ICON,
  entryTypeLabel,
} from "@/lib/entryTypes";
import { formatBRL, formatDateBR, formatMonthYearPT, parseDateLocal } from "@/lib/format";
import { usePeriod } from "@/lib/period";

export const Route = createFileRoute("/_authenticated/lancamentos")({
  head: () => ({
    meta: [
      { title: "Lançamentos · FinUp" },
      { name: "description", content: "Serviços, vendas e comissões recebidos." },
    ],
  }),
  component: LancamentosPage,
});

type Filter = "all" | EntryType;
type StatusFilter = "all" | EffectiveStatus;

const emptyForm = {
  desc: "",
  client_id: "",
  entry_type: "servico" as EntryType,
  amount: "",
  date: new Date().toISOString().slice(0, 10),
  due_date: "",
  status: "paid" as "paid" | "pending",
};

function LancamentosPage() {
  const qc = useQueryClient();
  const txQuery = useQuery({ queryKey: ["transactions"], queryFn: fetchTransactions });
  const clientsQuery = useQuery({ queryKey: ["clients"], queryFn: fetchClients });

  const [filter, setFilter] = useState<Filter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { refDate } = usePeriod();
  const entries = useMemo(
    () =>
      (txQuery.data ?? []).filter((t) => {
        if (t.type !== "income") return false;
        const d = parseDateLocal(t.occurred_at);
        return d.getMonth() === refDate.getMonth() && d.getFullYear() === refDate.getFullYear();
      }),
    [txQuery.data, refDate],
  );

  const filtered = entries
    .filter((e) => filter === "all" || e.entry_type === filter)
    .filter((e) => statusFilter === "all" || effectiveStatus(e) === statusFilter);

  const recurringQuery = useQuery({
    queryKey: ["recurring-expenses"],
    queryFn: fetchRecurringExpenses,
  });
  const forecast = useForecast(txQuery.data, recurringQuery.data, clientsQuery.data, refDate);

  const reconciliation = reconcile(entries);
  const overdueRows = entries.filter((e) => effectiveStatus(e) === "overdue");

  const summary = ENTRY_TYPES.map((t) => {
    const rows = entries.filter((e) => e.entry_type === t.key);
    const total = rows.reduce((s, r) => s + r.amount, 0);
    return { ...t, total, count: rows.length };
  });

  const totalPeriod = entries.reduce((s, e) => s + e.amount, 0);

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const mutation = useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: NewTx }) =>
      id ? updateTransaction(id, input) : createTransaction(input),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(v.id ? "Lançamento atualizado" : "Lançamento adicionado");
      closeForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removal = useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Lançamento excluído");
      setDeletingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const settle = useMutation({
    mutationFn: ({ id, settled }: { id: string; settled: boolean }) =>
      settleTransaction(id, settled),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(v.settled ? "Recebimento confirmado" : "Marcado como a receber");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (row: (typeof entries)[number]) => {
    setForm({
      desc: row.description,
      client_id: row.client_id ?? "",
      entry_type: row.entry_type ?? "servico",
      amount: String(row.amount),
      date: row.occurred_at.slice(0, 10),
      due_date: row.due_date?.slice(0, 10) ?? "",
      status: row.status === "paid" ? "paid" : "pending",
    });
    setEditingId(row.id);
    setShowForm(true);
  };

  // vencimento antes da data do lançamento criaria um inadimplente instantâneo
  const dueBeforeDate = form.status === "pending" && !!form.due_date && form.due_date < form.date;
  const canSubmit = !!form.desc.trim() && Number(form.amount) > 0 && !dueBeforeDate;

  const submit = () => {
    if (!canSubmit) return;
    mutation.mutate({
      id: editingId,
      input: {
        type: "income",
        description: form.desc.trim(),
        category: entryTypeLabel(form.entry_type),
        amount: Number(form.amount),
        occurred_at: form.date,
        status: form.status,
        // vencimento só faz sentido enquanto não recebido
        due_date: form.status === "pending" ? form.due_date || form.date : null,
        client_id: form.client_id || null,
        entry_type: form.entry_type,
      },
    });
  };

  const deletingRow = entries.find((e) => e.id === deletingId) ?? null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
        <div>
          <h1 className="text-xl font-bold leading-tight text-white sm:text-2xl">Lançamentos</h1>
          <p className="mt-0.5 text-[13px] text-[color:var(--text-secondary)] sm:mt-1 sm:text-sm">
            Serviços, vendas e comissões recebidos · {formatMonthYearPT(refDate)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => (showForm ? closeForm() : setShowForm(true))}
          className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white gradient-brand"
        >
          <Plus className="h-4 w-4" />
          Novo Lançamento
        </button>
      </div>

      {showForm && (
        <div className="space-y-4 rounded-2xl border border-[color:var(--brand-purple)]/30 bg-[color:var(--bg-card)] p-5">
          <p className="text-sm font-bold text-white">
            {editingId ? "Editar lançamento" : "Novo lançamento"}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Descrição">
              <input
                value={form.desc}
                onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))}
                placeholder="Ex: Gestão de tráfego"
                className={inputCls}
              />
            </Field>
            <Field label="Cliente">
              <select
                value={form.client_id}
                onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
                className={inputCls}
              >
                <option value="">—</option>
                {(clientsQuery.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Valor (R$)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0,00"
                className={inputCls}
              />
            </Field>
            <Field label="Data">
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className={inputCls}
              />
            </Field>
            {form.status === "pending" && (
              <Field label="Vencimento">
                <input
                  type="date"
                  min={form.date}
                  value={form.due_date || form.date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                  aria-invalid={dueBeforeDate}
                  className={`${inputCls} ${dueBeforeDate ? "border-[color:var(--expense)]" : ""}`}
                />
                {dueBeforeDate && (
                  <span className="mt-1 block text-[10px] font-medium text-[color:var(--expense)]">
                    O vencimento não pode ser anterior à data do lançamento.
                  </span>
                )}
              </Field>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-7">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-secondary)]">
                Tipo
              </p>
              <div className="flex gap-1.5">
                {ENTRY_TYPES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, entry_type: t.key }))}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors ${
                      form.entry_type === t.key
                        ? "text-white"
                        : "bg-white/5 text-[color:var(--text-secondary)]"
                    }`}
                    style={
                      form.entry_type === t.key
                        ? { background: ENTRY_TYPE_COLOR[t.key] }
                        : undefined
                    }
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-secondary)]">
                Status
              </p>
              <div className="flex gap-1.5">
                {(["paid", "pending"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, status: s }))}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors ${
                      form.status === s
                        ? "text-white"
                        : "bg-white/5 text-[color:var(--text-secondary)]"
                    }`}
                    style={
                      form.status === s
                        ? { background: s === "paid" ? "var(--income)" : "var(--brand-orange)" }
                        : undefined
                    }
                  >
                    {s === "paid" ? "Recebido" : "Pendente"}
                  </button>
                ))}
              </div>
            </div>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-md border border-[color:var(--border-default)] px-4 py-2 text-sm font-semibold text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={mutation.isPending || !canSubmit}
                onClick={submit}
                className="rounded-md px-5 py-2 text-sm font-semibold text-white gradient-brand disabled:opacity-50"
              >
                {mutation.isPending ? "Salvando..." : editingId ? "Salvar alterações" : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        {summary.map((s) => {
          const Icon = ENTRY_TYPE_ICON[s.key];
          return (
            <div
              key={s.key}
              className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-[18px]"
            >
              <div className="mb-3.5 flex items-center gap-2.5">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-[9px]"
                  style={{ background: ENTRY_TYPE_BG[s.key] }}
                >
                  <Icon className="h-[17px] w-[17px]" style={{ color: ENTRY_TYPE_COLOR[s.key] }} />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[color:var(--text-secondary)]">
                  {s.label}
                </p>
              </div>
              <p className="mb-1.5 text-xl font-bold leading-none text-white tabular-nums">
                {formatBRL(s.total)}
              </p>
              <p className="text-[11px] text-[color:var(--text-secondary)]">
                {s.count} {s.count === 1 ? "lançamento" : "lançamentos"}
              </p>
            </div>
          );
        })}
      </div>

      {forecast.pendingIncomeTotal > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/[0.05] px-5 py-3.5">
          <p className="text-xs font-bold text-white">
            Receita recorrente prevista em {formatMonthYearPT(refDate)}
          </p>
          <p className="text-xs text-[color:var(--text-secondary)]">
            <strong className="font-bold text-[color:var(--income)]">
              +{formatBRL(forecast.pendingIncomeTotal)}
            </strong>{" "}
            de contratos ativos ainda não lançados
          </p>
        </div>
      )}

      <ReconciliationBar
        data={reconciliation}
        flow="income"
        title="Conciliação de recebimentos"
        subtitle={`Quanto do faturamento de ${formatMonthYearPT(refDate)} já entrou de fato`}
      />

      {overdueRows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--expense)]/35 bg-[rgba(239,68,68,0.06)] px-5 py-3.5">
          <p className="flex items-center gap-2 text-xs text-white">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-[color:var(--expense)]" />
            <span>
              <strong className="font-bold">
                {overdueRows.length}{" "}
                {overdueRows.length === 1
                  ? "recebimento inadimplente"
                  : "recebimentos inadimplentes"}
              </strong>{" "}
              — {formatBRL(overdueRows.reduce((s, r) => s + r.amount, 0))} vencidos e não recebidos
            </span>
          </p>
          <button
            type="button"
            onClick={() => setStatusFilter("overdue")}
            className="text-xs font-bold text-[color:var(--expense)] hover:underline"
          >
            Ver apenas inadimplentes →
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3">
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 lg:mx-0 lg:flex-wrap lg:rounded-[11px] lg:bg-white/5 lg:p-1 [&::-webkit-scrollbar]:hidden">
          {(["all", ...ENTRY_TYPES.map((t) => t.key)] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`flex-shrink-0 rounded-lg bg-white/5 px-3.5 py-2 text-xs font-bold transition-colors lg:bg-transparent lg:py-1.5 ${
                filter === f ? "text-white" : "text-[color:var(--text-secondary)]"
              }`}
              style={filter === f ? { background: "var(--brand-purple)" } : undefined}
            >
              {f === "all" ? "Todos" : entryTypeLabel(f)}
            </button>
          ))}
        </div>

        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 lg:mx-0 lg:flex-wrap lg:rounded-[11px] lg:bg-white/5 lg:p-1 [&::-webkit-scrollbar]:hidden">
          {(
            [
              ["all", "Todas"],
              ["settled", "Recebidos"],
              ["pending", "A receber"],
              ["overdue", "Inadimplentes"],
            ] as [StatusFilter, string][]
          ).map(([key, label]) => {
            const active = statusFilter === key;
            const color =
              key === "settled"
                ? "var(--income)"
                : key === "pending"
                  ? "var(--brand-orange)"
                  : key === "overdue"
                    ? "var(--expense)"
                    : "var(--brand-purple)";
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`flex-shrink-0 rounded-lg bg-white/5 px-3.5 py-2 text-xs font-bold transition-colors lg:bg-transparent lg:py-1.5 ${
                  active ? "text-white" : "text-[color:var(--text-secondary)]"
                }`}
                style={active ? { background: color } : undefined}
              >
                {label}
              </button>
            );
          })}
        </div>

        <span className="text-xs text-[color:var(--text-secondary)]">
          Total do período:{" "}
          <strong className="font-bold text-white">{formatBRL(totalPeriod)}</strong>
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)]">
        <div className="hidden grid-cols-[44px_2.2fr_1.2fr_1fr_1fr_0.9fr_72px] gap-3 border-b border-[color:var(--border-default)] bg-white/[0.03] px-5 py-3 lg:grid">
          <span />
          <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-secondary)]">
            Descrição
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-secondary)]">
            Cliente
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-secondary)]">
            Tipo
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-secondary)]">
            Recebimento
          </span>
          <span className="text-right text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-secondary)]">
            Valor
          </span>
          <span className="text-right text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-secondary)]">
            Ações
          </span>
        </div>
        {filtered.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-[color:var(--text-muted)]">
            Nenhum lançamento neste filtro.
          </div>
        )}
        {filtered.map((e) => {
          const type = e.entry_type ?? "servico";
          const TypeIcon = ENTRY_TYPE_ICON[type];
          const status = effectiveStatus(e);
          const sv = statusVisual(status, "income");
          const settleButton = (
            <>
              {status === "settled" ? (
                <button
                  type="button"
                  title="Desfazer confirmação"
                  disabled={settle.isPending}
                  onClick={() => settle.mutate({ id: e.id, settled: false })}
                  className="inline-flex items-center gap-1 rounded-full bg-[rgba(34,197,94,0.12)] px-2.5 py-1 text-[10px] font-bold text-[color:var(--income)] hover:bg-[rgba(34,197,94,0.2)] disabled:opacity-50"
                >
                  <Check className="h-3 w-3" />
                  {formatDateBR(e.occurred_at)}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={settle.isPending}
                  onClick={() => settle.mutate({ id: e.id, settled: true })}
                  className="rounded-full border px-2.5 py-1 text-[10px] font-bold transition-colors disabled:opacity-50"
                  style={{ borderColor: `${sv.color}66`, color: sv.color }}
                >
                  Confirmar
                </button>
              )}
            </>
          );
          const actionButtons = (
            <>
              <button
                type="button"
                aria-label={`Editar ${e.description}`}
                title="Editar"
                onClick={() => openEdit(e)}
                className="rounded-md p-2 text-[color:var(--text-secondary)] hover:bg-white/5 hover:text-white lg:p-1.5"
              >
                <Pencil className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Excluir ${e.description}`}
                title="Excluir"
                onClick={() => setDeletingId(e.id)}
                className="rounded-md p-2 text-[color:var(--text-secondary)] hover:bg-[rgba(239,68,68,0.12)] hover:text-[color:var(--expense)] lg:p-1.5"
              >
                <Trash2 className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
              </button>
            </>
          );
          const rowBg = status === "overdue" ? "bg-[rgba(239,68,68,0.04)]" : "";

          return (
            <div key={e.id}>
              {/* Mobile: card em três faixas — identidade, situação, ações */}
              <div
                className={`border-b border-[color:var(--border-subtle)] px-4 py-3.5 lg:hidden ${rowBg}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
                    style={{ background: ENTRY_TYPE_BG[type] }}
                  >
                    <TypeIcon
                      className="h-[18px] w-[18px]"
                      style={{ color: ENTRY_TYPE_COLOR[type] }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-white">
                        {e.description}
                      </p>
                      <span className="flex-shrink-0 text-[15px] font-bold text-white tabular-nums">
                        {formatBRL(e.amount)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-[color:var(--text-secondary)]">
                      {e.client?.name ?? "Sem cliente"} · {entryTypeLabel(e.entry_type)}
                    </p>
                    <p
                      className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold"
                      style={{ color: sv.color }}
                    >
                      <span
                        className="h-[6px] w-[6px] flex-shrink-0 rounded-full"
                        style={{ background: sv.color }}
                      />
                      {sv.label}
                      {status !== "settled" && (
                        <span className="font-medium text-[color:var(--text-secondary)]">
                          · {dueLabel(e)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2 pl-12">
                  {settleButton}
                  <div className="flex gap-1">{actionButtons}</div>
                </div>
              </div>

              {/* Desktop: mantém a tabela */}
              <div
                className={`hidden grid-cols-[44px_2.2fr_1.2fr_1fr_1fr_0.9fr_72px] items-center gap-3 border-b border-[color:var(--border-subtle)] px-5 py-3.5 lg:grid ${rowBg}`}
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-[9px]"
                  style={{ background: ENTRY_TYPE_BG[type] }}
                >
                  <TypeIcon
                    className="h-[17px] w-[17px]"
                    style={{ color: ENTRY_TYPE_COLOR[type] }}
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-white">{e.description}</p>
                  <span
                    className="inline-flex items-center gap-1.5 text-[10px] font-bold"
                    style={{ color: sv.color }}
                  >
                    <span
                      className="h-[5px] w-[5px] rounded-full"
                      style={{ background: sv.color }}
                    />
                    {sv.label}
                    {status !== "settled" && (
                      <span className="font-medium text-[color:var(--text-secondary)]">
                        · {dueLabel(e)}
                      </span>
                    )}
                  </span>
                </div>
                <span className="truncate text-xs font-medium text-[color:var(--text-secondary)]">
                  {e.client?.name ?? "—"}
                </span>
                <div>
                  <span
                    className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                    style={{ background: ENTRY_TYPE_BG[type], color: ENTRY_TYPE_COLOR[type] }}
                  >
                    {entryTypeLabel(e.entry_type)}
                  </span>
                </div>
                <div className="flex justify-start">{settleButton}</div>
                <span className="text-right text-sm font-bold text-white tabular-nums">
                  {formatBRL(e.amount)}
                </span>
                <div className="flex justify-end gap-1">{actionButtons}</div>
              </div>
            </div>
          );
        })}
      </div>

      {deletingRow && (
        <ConfirmDialog
          title="Excluir lançamento"
          message={`“${deletingRow.description}” de ${formatBRL(deletingRow.amount)} será removido permanentemente e sairá de todos os totais e relatórios.`}
          pending={removal.isPending}
          onConfirm={() => removal.mutate(deletingRow.id)}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-primary)] px-3 py-2 text-sm text-white placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--brand-purple)] focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-secondary)]">
        {label}
      </span>
      {children}
    </label>
  );
}
