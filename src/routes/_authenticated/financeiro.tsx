import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  Banknote,
  Building2,
  Calculator,
  Check,
  Clock,
  Cloud,
  PiggyBank,
  Plus,
  Pencil,
  Repeat,
  Trash2,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  createTransaction,
  deleteTransaction,
  existingCategories,
  fetchTransactions,
  settleTransaction,
  type TxRow,
} from "@/lib/transactions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DespesaModal } from "@/components/DespesaModal";
import { dueLabel, effectiveStatus, reconcile, statusVisual } from "@/lib/status";
import { ReconciliationBar } from "@/components/ReconciliationBar";
import {
  createRecurringExpense,
  deleteRecurringExpense,
  fetchRecurringExpenses,
  materializeRecurringExpense,
  type RecurringExpenseRow,
} from "@/lib/recurring";
import { fetchClients } from "@/lib/clients";
import { useForecast } from "@/lib/forecast";
import { useDashboard } from "@/lib/dashboard";
import { ENTRY_TYPES, ENTRY_TYPE_BG, ENTRY_TYPE_COLOR, ENTRY_TYPE_ICON } from "@/lib/entryTypes";
import { formatBRL, formatDateBR, formatMonthYearPT, parseDateLocal } from "@/lib/format";
import { usePeriod } from "@/lib/period";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro · FinUp" },
      { name: "description", content: "Lucro, despesas, recorrências e contas a pagar." },
    ],
  }),
  component: FinanceiroPage,
});

function FinanceiroPage() {
  const qc = useQueryClient();
  const txQuery = useQuery({ queryKey: ["transactions"], queryFn: fetchTransactions });
  const recurringQuery = useQuery({
    queryKey: ["recurring-expenses"],
    queryFn: fetchRecurringExpenses,
  });
  const clientsQuery = useQuery({ queryKey: ["clients"], queryFn: fetchClients });
  const { refDate, isFutureMonth } = usePeriod();
  const dash = useDashboard(txQuery.data, refDate);
  const [showNewConta, setShowNewConta] = useState(false);
  const [deletingPayable, setDeletingPayable] = useState<string | null>(null);
  const [deletingRecurring, setDeletingRecurring] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<TxRow | null>(null);
  const [alsoDeleteSchedule, setAlsoDeleteSchedule] = useState(false);
  const [alsoDeleteLaunched, setAlsoDeleteLaunched] = useState(false);

  const rows = txQuery.data ?? [];
  const monthRows = useMemo(
    () =>
      rows.filter((r) => {
        const d = parseDateLocal(r.occurred_at);
        return d.getMonth() === refDate.getMonth() && d.getFullYear() === refDate.getFullYear();
      }),
    [rows, refDate],
  );

  const incomeRows = monthRows.filter((r) => r.type === "income");
  const monthExpenses = monthRows
    .filter((r) => r.type === "expense")
    .sort(
      (a, b) => parseDateLocal(b.occurred_at).getTime() - parseDateLocal(a.occurred_at).getTime(),
    );

  // Uma recorrência só entra nos totais depois de virar transação. A previsão cruza
  // agendamentos e contratos ativos com o que já foi lançado no mês visualizado.
  const forecast = useForecast(txQuery.data, recurringQuery.data, clientsQuery.data, refDate);
  const recurringStatus = forecast.expectedExpenses;
  const recurringTotal = recurringStatus.reduce((s, r) => s + r.amount, 0);
  const pendingRecurring = recurringStatus.filter((r) => !r.launched);
  const pendingRecurringTotal = forecast.pendingExpenseTotal;

  /**
   * "Contas a Pagar" é a mesma transação filtrada por pendente — excluir aqui já
   * some de lá. O agendamento, porém, vive em outra tabela: sem removê-lo junto,
   * ele volta a gerar a despesa no mês seguinte.
   */
  const removeTx = useMutation({
    mutationFn: async ({ id, alsoSchedule }: { id: string; alsoSchedule?: string }) => {
      await deleteTransaction(id);
      if (alsoSchedule) await deleteRecurringExpense(alsoSchedule);
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["recurring-expenses"] });
      toast.success(v.alsoSchedule ? "Despesa e recorrência excluídas" : "Despesa excluída");
      setDeletingPayable(null);
      setAlsoDeleteSchedule(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeRecurring = useMutation({
    mutationFn: async ({ id, alsoTxIds }: { id: string; alsoTxIds: string[] }) => {
      await deleteRecurringExpense(id);
      for (const txId of alsoTxIds) await deleteTransaction(txId);
      return alsoTxIds.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["recurring-expenses"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(
        n > 0
          ? `Recorrência e ${n} ${n === 1 ? "despesa" : "despesas"} excluídas`
          : "Recorrência excluída",
      );
      setDeletingRecurring(null);
      setAlsoDeleteLaunched(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const settle = useMutation({
    mutationFn: ({ id, settled }: { id: string; settled: boolean }) =>
      settleTransaction(id, settled),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Pagamento confirmado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const materialize = useMutation({
    mutationFn: async (items: RecurringExpenseRow[]) => {
      for (const r of items) await materializeRecurringExpense(r, refDate);
      return items.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["recurring-expenses"] });
      toast.success(n === 1 ? "Despesa lançada" : `${n} despesas lançadas`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payables = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            r.type === "expense" &&
            (r.status === "pending" || r.status === "overdue") &&
            r.due_date,
        )
        .sort(
          (a, b) => parseDateLocal(a.due_date!).getTime() - parseDateLocal(b.due_date!).getTime(),
        ),
    [rows],
  );
  const payablesTotal = payables.reduce((s, r) => s + r.amount, 0);
  const dueSoonCount = payables.filter((p) => {
    const diff = daysDiff(p.due_date!);
    return diff <= 7;
  }).length;

  const profitSources = ENTRY_TYPES.map((t) => {
    const total = incomeRows
      .filter((r) => r.entry_type === t.key)
      .reduce((s, r) => s + r.amount, 0);
    const count = incomeRows.filter((r) => r.entry_type === t.key).length;
    return { ...t, total, count };
  });
  const incomeTotal = incomeRows.reduce((s, r) => s + r.amount, 0);
  const recorrenteTotal = profitSources.find((p) => p.key === "recorrente")?.total ?? 0;
  const variavelTotal = incomeTotal - recorrenteTotal;
  const recorrenteCount = profitSources.find((p) => p.key === "recorrente")?.count ?? 0;

  const netLine = dash.monthly.map((m) => ({ month: m.month, net: m.receita - m.despesa }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold leading-tight text-white">Financeiro</h1>
          <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
            Lucro, despesas, recorrências e contas a pagar · {formatMonthYearPT(refDate)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewConta(true)}
          className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white gradient-brand"
        >
          <Plus className="h-4 w-4" />
          Nova Conta
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniKpi
          label="Lucro Líquido"
          value={formatBRL(dash.lucroLiquido)}
          icon={PiggyBank}
          color="var(--income)"
          bg="rgba(34,197,94,0.13)"
        />
        <MiniKpi
          label="Despesas Totais"
          value={formatBRL(dash.despesas)}
          hint={
            pendingRecurringTotal > 0 ? `+${formatBRL(pendingRecurringTotal)} a lançar` : undefined
          }
          hintTone="warn"
          icon={Banknote}
          color="var(--brand-orange)"
          bg="rgba(255,92,26,0.13)"
        />
        <MiniKpi
          label="Recorrentes"
          value={formatBRL(recurringTotal)}
          hint={
            pendingRecurring.length > 0
              ? `${pendingRecurring.length} a lançar`
              : recurringStatus.length > 0
                ? "tudo lançado"
                : undefined
          }
          hintTone={pendingRecurring.length > 0 ? "warn" : "ok"}
          icon={Repeat}
          color="var(--brand-purple)"
          bg="rgba(124,58,255,0.13)"
        />
        <MiniKpi
          label="Contas a Pagar"
          value={formatBRL(payablesTotal)}
          hint={dueSoonCount > 0 ? `${dueSoonCount} vencendo em 7 dias` : undefined}
          icon={Clock}
          color="var(--expense)"
          bg="rgba(239,68,68,0.13)"
        />
      </div>

      {forecast.hasPending && (
        <div className="rounded-2xl border border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/[0.05] p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[color:var(--brand-purple)]" />
            <p className="text-sm font-bold text-white">
              {isFutureMonth ? "Previsão para" : "Projeção de fechamento de"}{" "}
              {formatMonthYearPT(refDate)}
            </p>
            <span className="rounded-full bg-[color:var(--brand-purple)]/[0.14] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.05em] text-[color:var(--brand-purple)]">
              Recorrências ainda não lançadas
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ForecastCell
              label="Receita"
              booked={forecast.bookedIncome}
              pending={forecast.pendingIncomeTotal}
              total={forecast.projectedIncome}
              color="var(--income)"
            />
            <ForecastCell
              label="Despesas"
              booked={forecast.bookedExpense}
              pending={forecast.pendingExpenseTotal}
              total={forecast.projectedExpense}
              color="var(--brand-orange)"
            />
            <ForecastCell
              label="Lucro projetado"
              booked={forecast.bookedIncome - forecast.bookedExpense}
              pending={forecast.pendingIncomeTotal - forecast.pendingExpenseTotal}
              total={forecast.projectedIncome - forecast.projectedExpense}
              color="var(--brand-purple)"
              emphasize
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ReconciliationBar
          data={reconcile(monthRows.filter((r) => r.type === "income"))}
          flow="income"
          title="Recebimentos"
          subtitle={`Entradas de ${formatMonthYearPT(refDate)}`}
        />
        <ReconciliationBar
          data={reconcile(monthRows.filter((r) => r.type === "expense"))}
          flow="expense"
          title="Pagamentos"
          subtitle={`Saídas de ${formatMonthYearPT(refDate)}`}
        />
      </div>

      {/* Origem dos lucros */}
      <div className="rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-6">
        <p className="mb-1 text-[15px] font-bold text-white">Origem dos Lucros</p>
        <p className="mb-5 text-xs text-[color:var(--text-secondary)]">
          De onde vem o faturamento · {formatMonthYearPT(refDate)} · {formatBRL(incomeTotal)}
        </p>

        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[color:var(--brand-purple)]/35 bg-[color:var(--brand-purple)]/[0.06] p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-sm bg-[color:var(--brand-purple)]" />
              <span className="text-xs font-bold text-white">Lucro Recorrente</span>
              <span className="rounded-full bg-[color:var(--brand-purple)]/[0.14] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.05em] text-[color:var(--brand-purple)]">
                Previsível · MRR
              </span>
            </div>
            <div className="mb-1.5 flex items-end gap-2.5">
              <span className="text-[28px] font-black leading-none text-white tabular-nums">
                {formatBRL(recorrenteTotal)}
              </span>
              <span className="mb-0.5 text-sm font-bold text-[color:var(--brand-purple)]">
                {incomeTotal > 0 ? Math.round((recorrenteTotal / incomeTotal) * 100) : 0}%
              </span>
            </div>
            <p className="text-[11px] text-[color:var(--text-secondary)]">
              Contratos mensais fixos · {recorrenteCount}{" "}
              {recorrenteCount === 1 ? "lançamento" : "lançamentos"} no mês
            </p>
          </div>
          <div className="rounded-xl border border-[color:var(--brand-orange)]/35 bg-[color:var(--brand-orange)]/[0.06] p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-sm bg-[color:var(--brand-orange)]" />
              <span className="text-xs font-bold text-white">Lucro Variável</span>
              <span className="rounded-full bg-[color:var(--brand-orange)]/[0.12] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.05em] text-[color:var(--brand-orange)]">
                Pontual
              </span>
            </div>
            <div className="mb-1.5 flex items-end gap-2.5">
              <span className="text-[28px] font-black leading-none text-white tabular-nums">
                {formatBRL(variavelTotal)}
              </span>
              <span className="mb-0.5 text-sm font-bold text-[color:var(--brand-orange)]">
                {incomeTotal > 0 ? Math.round((variavelTotal / incomeTotal) * 100) : 0}%
              </span>
            </div>
            <p className="text-[11px] text-[color:var(--text-secondary)]">
              Serviços únicos, produtos e comissões
            </p>
          </div>
        </div>

        <div className="mb-3 flex h-3 gap-0.5 overflow-hidden rounded-md">
          {profitSources.map((s) => (
            <div
              key={s.key}
              style={{
                width: incomeTotal > 0 ? `${(s.total / incomeTotal) * 100}%` : "0%",
                background: ENTRY_TYPE_COLOR[s.key],
              }}
            />
          ))}
          {incomeTotal === 0 && <div className="w-full bg-white/5" />}
        </div>

        <div className="grid grid-cols-1 gap-x-7 sm:grid-cols-2">
          {profitSources.map((s) => {
            const Icon = ENTRY_TYPE_ICON[s.key];
            const isRec = s.key === "recorrente";
            return (
              <div
                key={s.key}
                className="flex items-center gap-3 border-b border-[color:var(--border-subtle)] py-2.5"
              >
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
                  style={{ background: ENTRY_TYPE_BG[s.key] }}
                >
                  <Icon className="h-[18px] w-[18px]" style={{ color: ENTRY_TYPE_COLOR[s.key] }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-semibold text-white">{s.label}</span>
                    <span
                      className="rounded-full px-1.5 py-px text-[8px] font-bold uppercase tracking-[0.04em]"
                      style={{ background: ENTRY_TYPE_BG[s.key], color: ENTRY_TYPE_COLOR[s.key] }}
                    >
                      {isRec ? "Recorrente" : "Variável"}
                    </span>
                  </div>
                  <p className="text-[11px] text-[color:var(--text-secondary)]">
                    {s.count} {s.count === 1 ? "lançamento" : "lançamentos"} no mês
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold leading-none text-white tabular-nums">
                    {formatBRL(s.total)}
                  </p>
                  <p
                    className="mt-1 text-[10px] font-bold"
                    style={{ color: ENTRY_TYPE_COLOR[s.key] }}
                  >
                    {incomeTotal > 0 ? Math.round((s.total / incomeTotal) * 100) : 0}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-5">
          <p className="text-sm font-bold text-white">Evolução do Lucro Líquido</p>
          <p className="mt-0.5 mb-4 text-xs text-[color:var(--text-secondary)]">
            Receita - Despesas · últimos 6 meses
          </p>
          <div className="mb-3 flex items-end gap-3">
            <span
              className="text-[28px] font-black leading-none tabular-nums"
              style={{ color: dash.lucroLiquido >= 0 ? "var(--income)" : "var(--expense)" }}
            >
              {formatBRL(dash.lucroLiquido)}
            </span>
            {dash.varLucro !== null && (
              <span
                className={`mb-0.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  dash.varLucro >= 0
                    ? "bg-[rgba(34,197,94,0.1)] text-[color:var(--income)]"
                    : "bg-[rgba(239,68,68,0.1)] text-[color:var(--expense)]"
                }`}
              >
                {dash.varLucro >= 0 ? "↑" : "↓"}{" "}
                {Math.abs(dash.varLucro).toFixed(1).replace(".", ",")}%
              </span>
            )}
          </div>
          <div className="h-[110px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={netLine} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <Tooltip
                  formatter={(v: number) => [formatBRL(v), "Lucro líquido"]}
                  contentStyle={{
                    background: "#1A1A1A",
                    border: "1px solid #2A2A2A",
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  stroke="var(--income)"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-5">
          <p className="text-sm font-bold text-white">Despesas por Categoria</p>
          <p className="mt-0.5 mb-4 text-xs text-[color:var(--text-secondary)]">
            Total de {formatBRL(dash.totalDespesas)} no mês
          </p>
          <div className="space-y-3">
            {dash.byCategory.length === 0 && (
              <p className="text-xs text-[color:var(--text-muted)]">Sem despesas no período.</p>
            )}
            {dash.byCategory.map((c) => (
              <div key={c.name}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-white">{c.name}</span>
                  <span className="font-bold text-[color:var(--text-secondary)]">
                    {formatBRL(c.value)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${dash.totalDespesas > 0 ? (c.value / dash.totalDespesas) * 100 : 0}%`,
                      background: c.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)]">
          <div className="flex items-center justify-between border-b border-[color:var(--border-default)] px-5 py-4">
            <div>
              <p className="text-sm font-bold text-white">Despesas Recorrentes</p>
              <p className="mt-0.5 text-xs text-[color:var(--text-secondary)]">
                Agendamento · só entra nas despesas depois de lançada
              </p>
            </div>
            <span className="text-xs font-bold text-white tabular-nums">
              {formatBRL(recurringTotal)}/mês
            </span>
          </div>

          {pendingRecurring.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--border-default)] bg-[rgba(255,92,26,0.07)] px-5 py-3">
              <p className="text-[11px] text-[color:var(--brand-orange)]">
                <strong className="font-bold">{formatBRL(pendingRecurringTotal)}</strong> ainda não
                contabilizados em {formatMonthYearPT(refDate)}
              </p>
              <button
                type="button"
                disabled={materialize.isPending}
                onClick={() => materialize.mutate(pendingRecurring)}
                className="rounded-md px-3 py-1.5 text-[11px] font-bold text-white gradient-brand disabled:opacity-50"
              >
                {materialize.isPending ? "Lançando..." : "Lançar todas"}
              </button>
            </div>
          )}

          {recurringStatus.length === 0 && (
            <p className="px-5 py-8 text-center text-xs text-[color:var(--text-muted)]">
              Nenhuma despesa recorrente cadastrada. Use “+ Nova Conta”.
            </p>
          )}
          {recurringStatus.map((r) => {
            const { icon: Icon, color, bg } = recurringVisual(r.category, r.name);
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 border-b border-[color:var(--border-subtle)] px-5 py-3 last:border-b-0"
              >
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
                  style={{ background: bg }}
                >
                  <Icon className="h-[18px] w-[18px]" style={{ color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-white">{r.name}</p>
                  <p className="text-[11px] text-[color:var(--text-secondary)]">
                    {r.frequency} · vence {formatDateBR(r.dueDate)}
                  </p>
                </div>
                {r.launched ? (
                  <span className="flex items-center gap-1 rounded-full bg-[rgba(34,197,94,0.12)] px-2.5 py-1 text-[10px] font-bold text-[color:var(--income)]">
                    <Check className="h-3 w-3" />
                    Lançada
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={materialize.isPending}
                    onClick={() => materialize.mutate([r])}
                    className="rounded-full border border-[color:var(--brand-orange)]/40 px-2.5 py-1 text-[10px] font-bold text-[color:var(--brand-orange)] hover:bg-[rgba(255,92,26,0.1)] disabled:opacity-50"
                  >
                    Lançar
                  </button>
                )}
                <span className="min-w-[64px] text-right text-sm font-bold text-white tabular-nums">
                  {formatBRL(r.amount)}
                </span>
                <button
                  type="button"
                  aria-label={`Excluir recorrência ${r.name}`}
                  title="Excluir recorrência"
                  onClick={() => setDeletingRecurring(r.id)}
                  className="rounded-md p-1.5 text-[color:var(--text-secondary)] hover:bg-[rgba(239,68,68,0.12)] hover:text-[color:var(--expense)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)]">
          <div className="flex items-center justify-between border-b border-[color:var(--border-default)] px-5 py-4">
            <div>
              <p className="text-sm font-bold text-white">Contas a Pagar</p>
              <p className="mt-0.5 text-xs text-[color:var(--text-secondary)]">
                Todas em aberto · independe do mês selecionado
              </p>
            </div>
            <span className="text-xs font-bold text-[color:var(--brand-orange)] tabular-nums">
              {formatBRL(payablesTotal)} em aberto
            </span>
          </div>
          {payables.length === 0 && (
            <p className="px-5 py-8 text-center text-xs text-[color:var(--text-muted)]">
              Nenhuma conta pendente. Use “+ Nova Conta”.
            </p>
          )}
          {payables.map((p) => {
            const status = effectiveStatus(p);
            const sv = statusVisual(status, "expense");
            return (
              <div
                key={p.id}
                className={`flex items-center gap-3 border-b border-[color:var(--border-subtle)] px-5 py-3 last:border-b-0 ${
                  status === "overdue" ? "bg-[rgba(239,68,68,0.04)]" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-white">{p.description}</p>
                  <p className="text-[11px]" style={{ color: sv.color }}>
                    {dueLabel(p)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={settle.isPending}
                  onClick={() => settle.mutate({ id: p.id, settled: true })}
                  className="whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-bold transition-colors hover:bg-white/5 disabled:opacity-50"
                  style={{ borderColor: `${sv.color}66`, color: sv.color }}
                >
                  Confirmar pagamento
                </button>
                <span className="min-w-[70px] text-right text-sm font-bold text-white tabular-nums">
                  {formatBRL(p.amount)}
                </span>
                <button
                  type="button"
                  aria-label={`Excluir conta ${p.description}`}
                  title="Excluir conta"
                  onClick={() => setDeletingPayable(p.id)}
                  className="rounded-md p-1.5 text-[color:var(--text-secondary)] hover:bg-[rgba(239,68,68,0.12)] hover:text-[color:var(--expense)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Toda despesa do mês, paga ou não — sem isso uma despesa liquidada
          ficaria invisível e impossível de corrigir ou remover. */}
      <div className="overflow-hidden rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border-default)] px-5 py-4">
          <div>
            <p className="text-sm font-bold text-white">Todas as Despesas</p>
            <p className="mt-0.5 text-xs text-[color:var(--text-secondary)]">
              Tudo que compõe as despesas de {formatMonthYearPT(refDate)}
            </p>
          </div>
          <span className="text-xs font-bold text-white tabular-nums">
            {formatBRL(dash.despesas)}
          </span>
        </div>

        <div className="grid grid-cols-[2.2fr_1.2fr_1fr_1fr_0.9fr_72px] gap-3 border-b border-[color:var(--border-default)] bg-white/[0.03] px-5 py-3">
          {["Descrição", "Categoria", "Data", "Situação", "Valor", "Ações"].map((h, i) => (
            <span
              key={h}
              className={`text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-secondary)] ${
                i >= 4 ? "text-right" : ""
              }`}
            >
              {h}
            </span>
          ))}
        </div>

        {monthExpenses.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-[color:var(--text-muted)]">
            Nenhuma despesa em {formatMonthYearPT(refDate)}.
          </p>
        )}

        {monthExpenses.map((d) => {
          const st = effectiveStatus(d);
          const sv = statusVisual(st, "expense");
          return (
            <div
              key={d.id}
              className={`grid grid-cols-[2.2fr_1.2fr_1fr_1fr_0.9fr_72px] items-center gap-3 border-b border-[color:var(--border-subtle)] px-5 py-3.5 last:border-b-0 ${
                st === "overdue" ? "bg-[rgba(239,68,68,0.04)]" : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-[13px] font-medium text-white">{d.description}</p>
                {d.is_recurring && (
                  <span
                    title="Gerada por uma recorrência"
                    className="flex-shrink-0 rounded-full bg-[rgba(124,58,255,0.14)] px-1.5 py-px text-[9px] font-bold text-[color:var(--brand-purple)]"
                  >
                    REC
                  </span>
                )}
              </div>
              <span className="truncate text-xs text-[color:var(--text-secondary)]">
                {d.category}
              </span>
              <span className="text-xs text-[color:var(--text-secondary)]">
                {formatDateBR(d.occurred_at)}
              </span>
              <div>
                <button
                  type="button"
                  title={st === "settled" ? "Marcar como a pagar" : "Confirmar pagamento"}
                  disabled={settle.isPending}
                  onClick={() => settle.mutate({ id: d.id, settled: st !== "settled" })}
                  className="rounded-full px-2.5 py-1 text-[10px] font-bold transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ color: sv.color, background: sv.bg }}
                >
                  {sv.label}
                </button>
              </div>
              <span className="text-right text-sm font-bold text-white tabular-nums">
                {formatBRL(d.amount)}
              </span>
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  aria-label={`Editar despesa ${d.description}`}
                  title="Editar"
                  onClick={() => setEditingExpense(d)}
                  className="rounded-md p-1.5 text-[color:var(--text-secondary)] hover:bg-white/5 hover:text-white"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Excluir despesa ${d.description}`}
                  title="Excluir"
                  onClick={() => setDeletingPayable(d.id)}
                  className="rounded-md p-1.5 text-[color:var(--text-secondary)] hover:bg-[rgba(239,68,68,0.12)] hover:text-[color:var(--expense)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {editingExpense && (
        <DespesaModal row={editingExpense} onClose={() => setEditingExpense(null)} />
      )}

      {showNewConta && <NovaContaModal onClose={() => setShowNewConta(false)} />}

      {deletingPayable &&
        (() => {
          const tx = rows.find((p) => p.id === deletingPayable);
          // agendamento de onde essa despesa veio, se ainda existir
          const schedule = tx?.is_recurring
            ? (recurringQuery.data ?? []).find((r) => r.name.trim() === tx.description.trim())
            : undefined;
          const isPayable = tx?.status !== "paid" && !!tx?.due_date;
          return (
            <ConfirmDialog
              title="Excluir despesa"
              message={`“${tx?.description}” será removida permanentemente e sairá de todos os totais e relatórios${
                isPayable ? ", inclusive de Contas a Pagar" : ""
              }.`}
              pending={removeTx.isPending}
              onConfirm={() =>
                removeTx.mutate({
                  id: deletingPayable,
                  alsoSchedule: alsoDeleteSchedule && schedule ? schedule.id : undefined,
                })
              }
              onCancel={() => {
                setDeletingPayable(null);
                setAlsoDeleteSchedule(false);
              }}
            >
              {schedule && (
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/[0.06] p-3">
                  <input
                    type="checkbox"
                    checked={alsoDeleteSchedule}
                    onChange={(e) => setAlsoDeleteSchedule(e.target.checked)}
                    className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[color:var(--brand-purple)]"
                  />
                  <span className="text-xs text-white">
                    Excluir também a recorrência “{schedule.name}”
                    <span className="mt-0.5 block text-[11px] text-[color:var(--text-secondary)]">
                      Sem isso ela volta a gerar esta despesa nos próximos meses.
                    </span>
                  </span>
                </label>
              )}
            </ConfirmDialog>
          );
        })()}

      {deletingRecurring &&
        (() => {
          const r = recurringStatus.find((x) => x.id === deletingRecurring);
          const geradas = rows.filter(
            (t) =>
              t.type === "expense" && t.is_recurring && t.description.trim() === r?.name.trim(),
          );
          const total = geradas.reduce((s, t) => s + t.amount, 0);
          return (
            <ConfirmDialog
              title="Excluir recorrência"
              message={`“${r?.name}” deixa de ser agendada e não gera mais despesas nos próximos meses.`}
              pending={removeRecurring.isPending}
              onConfirm={() =>
                removeRecurring.mutate({
                  id: deletingRecurring,
                  alsoTxIds: alsoDeleteLaunched ? geradas.map((t) => t.id) : [],
                })
              }
              onCancel={() => {
                setDeletingRecurring(null);
                setAlsoDeleteLaunched(false);
              }}
            >
              {geradas.length > 0 && (
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[color:var(--expense)]/30 bg-[rgba(239,68,68,0.06)] p-3">
                  <input
                    type="checkbox"
                    checked={alsoDeleteLaunched}
                    onChange={(e) => setAlsoDeleteLaunched(e.target.checked)}
                    className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[color:var(--expense)]"
                  />
                  <span className="text-xs text-white">
                    Excluir também as {geradas.length}{" "}
                    {geradas.length === 1 ? "despesa já lançada" : "despesas já lançadas"} (
                    {formatBRL(total)})
                    <span className="mt-0.5 block text-[11px] text-[color:var(--text-secondary)]">
                      Sem isso elas continuam contando nos totais e no histórico.
                    </span>
                  </span>
                </label>
              )}
            </ConfirmDialog>
          );
        })()}
    </div>
  );
}

function daysDiff(date: string): number {
  const due = parseDateLocal(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function recurringVisual(
  category: string,
  name: string,
): { icon: LucideIcon; color: string; bg: string } {
  const text = `${category} ${name}`.toLowerCase();
  if (/infra|aws|cloud|servidor|hospedagem/.test(text))
    return { icon: Cloud, color: "var(--brand-orange)", bg: "rgba(255,92,26,0.1)" };
  if (/contab|contador|financ/.test(text))
    return { icon: Calculator, color: "var(--text-secondary)", bg: "rgba(161,161,170,0.12)" };
  if (/aluguel|escrit|coworking|sala/.test(text))
    return { icon: Building2, color: "var(--brand-orange)", bg: "rgba(255,92,26,0.1)" };
  return { icon: Repeat, color: "var(--brand-purple)", bg: "rgba(124,58,255,0.12)" };
}

function ForecastCell({
  label,
  booked,
  pending,
  total,
  color,
  emphasize,
}: {
  label: string;
  booked: number;
  pending: number;
  total: number;
  color: string;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-4">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-secondary)]">
        {label}
      </p>
      <p
        className={`mb-2 leading-none tabular-nums ${emphasize ? "text-[24px] font-black" : "text-[20px] font-bold"}`}
        style={{ color: emphasize ? color : "white" }}
      >
        {formatBRL(total)}
      </p>
      <p className="text-[11px] text-[color:var(--text-secondary)]">
        {formatBRL(booked)} lançado
        {pending !== 0 && (
          <>
            {" · "}
            <strong className="font-bold" style={{ color }}>
              {pending > 0 ? "+" : ""}
              {formatBRL(pending)} previsto
            </strong>
          </>
        )}
      </p>
    </div>
  );
}

function MiniKpi({
  label,
  value,
  hint,
  hintTone = "neutral",
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: string;
  hint?: string;
  hintTone?: "neutral" | "warn" | "ok";
  icon: LucideIcon;
  color: string;
  bg: string;
}) {
  const hintClass =
    hintTone === "warn"
      ? "bg-[rgba(255,92,26,0.12)] text-[color:var(--brand-orange)]"
      : hintTone === "ok"
        ? "bg-[rgba(34,197,94,0.12)] text-[color:var(--income)]"
        : "bg-white/5 text-[color:var(--text-secondary)]";
  return (
    <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-[18px]">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div
          className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px]"
          style={{ background: bg }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        {hint && (
          <span
            className={`rounded-full px-2.5 py-1 text-right text-[11px] font-bold ${hintClass}`}
          >
            {hint}
          </span>
        )}
      </div>
      <p className="mb-1.5 text-[21px] font-bold leading-none text-white tabular-nums">{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[color:var(--text-secondary)]">
        {label}
      </p>
    </div>
  );
}

type ContaKind = "pagar" | "recorrente";

function NovaContaModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const txQuery = useQuery({ queryKey: ["transactions"], queryFn: fetchTransactions });
  const categories = existingCategories(txQuery.data);
  const [kind, setKind] = useState<ContaKind>("pagar");
  const [form, setForm] = useState({
    name: "",
    amount: "",
    category: "",
    due_date: new Date().toISOString().slice(0, 10),
    frequency: "Mensal",
  });

  const payableMutation = useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Conta a pagar adicionada");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recurringMutation = useMutation({
    mutationFn: createRecurringExpense,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring-expenses"] });
      toast.success("Despesa recorrente adicionada");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = payableMutation.isPending || recurringMutation.isPending;
  const valid = form.name.trim().length > 0 && Number(form.amount) > 0;

  const submit = () => {
    if (!valid) return;
    if (kind === "pagar") {
      payableMutation.mutate({
        type: "expense",
        description: form.name.trim(),
        category: form.category.trim() || "Outros",
        amount: Number(form.amount),
        occurred_at: form.due_date,
        due_date: form.due_date,
        status: "pending",
      });
    } else {
      recurringMutation.mutate({
        name: form.name.trim(),
        amount: Number(form.amount),
        category: form.category.trim() || "Outros",
        frequency: form.frequency,
        next_due_date: form.due_date,
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white">Nova Conta</h2>
        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
          Cadastre uma conta a pagar ou uma despesa recorrente.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(
            [
              ["pagar", "Conta a pagar"],
              ["recorrente", "Despesa recorrente"],
            ] as [ContaKind, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                kind === k
                  ? "border-[color:var(--brand-purple)] bg-[rgba(124,58,255,0.15)] text-white"
                  : "border-[color:var(--border-default)] text-[color:var(--text-secondary)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          <Field label={kind === "pagar" ? "Descrição" : "Nome"}>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputCls}
              placeholder={kind === "pagar" ? "Ex: Fornecedor Gráfica" : "Ex: AWS — Infraestrutura"}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className={inputCls}
                placeholder="0,00"
              />
            </Field>
            <Field label={kind === "pagar" ? "Vencimento" : "Próximo vencimento"}>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                className={inputCls}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <input
                list="categorias-existentes"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className={inputCls}
                placeholder="Infraestrutura, Software…"
              />
              <datalist id="categorias-existentes">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            {kind === "recorrente" && (
              <Field label="Frequência">
                <select
                  value={form.frequency}
                  onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
                  className={inputCls}
                >
                  {["Mensal", "Trimestral", "Semestral", "Anual"].map((fr) => (
                    <option key={fr} value={fr}>
                      {fr}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[color:var(--border-default)] px-4 py-2 text-sm font-medium text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending || !valid}
            onClick={submit}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white gradient-brand disabled:opacity-50"
          >
            {pending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
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
