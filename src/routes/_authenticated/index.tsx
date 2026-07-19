import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Download, Landmark, PiggyBank, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { fetchTransactions, type TxRow } from "@/lib/transactions";
import { useDashboard } from "@/lib/dashboard";
import { useForecast } from "@/lib/forecast";
import { fetchClients } from "@/lib/clients";
import { fetchRecurringExpenses } from "@/lib/recurring";
import { formatBRL, formatMonthYearPT, parseDateLocal } from "@/lib/format";
import { reconcile } from "@/lib/status";
import { ReconciliationBar } from "@/components/ReconciliationBar";
import { usePeriod } from "@/lib/period";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ReceitaDespesaChart } from "@/components/dashboard/ReceitaDespesaChart";
import { CategoriaDonut } from "@/components/dashboard/CategoriaDonut";
import { TransacoesRecentes } from "@/components/dashboard/TransacoesRecentes";
import { LancamentoModal } from "@/components/dashboard/LancamentoModal";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard · FinUp" },
      { name: "description", content: "Resumo financeiro do seu negócio." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [open, setOpen] = useState(false);
  const { refDate, isFutureMonth } = usePeriod();
  const query = useQuery({ queryKey: ["transactions"], queryFn: fetchTransactions });
  const clientsQuery = useQuery({ queryKey: ["clients"], queryFn: fetchClients });
  const recurringQuery = useQuery({
    queryKey: ["recurring-expenses"],
    queryFn: fetchRecurringExpenses,
  });
  const dash = useDashboard(query.data, refDate);
  const forecast = useForecast(query.data, recurringQuery.data, clientsQuery.data, refDate);
  const monthRows = (query.data ?? []).filter((r) => {
    const d = parseDateLocal(r.occurred_at);
    return d.getMonth() === refDate.getMonth() && d.getFullYear() === refDate.getFullYear();
  });

  // Realtime: refetch on any change to user's transactions
  useEffect(() => {
    const channel = supabase
      .channel("transactions-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        query.refetch();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold leading-tight text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
            {formatMonthYearPT(refDate)} · Resumo financeiro
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportCsv(query.data ?? [])}
            className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border-default)] bg-transparent px-3.5 py-2 text-sm font-medium text-white hover:bg-white/5"
          >
            <Download className="h-4 w-4" />
            Exportar
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white gradient-brand"
          >
            <Plus className="h-4 w-4" />
            Lançamento
          </button>
        </div>
      </div>

      {forecast.hasPending && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/[0.05] px-5 py-3.5">
          <p className="text-xs font-bold text-white">
            {isFutureMonth ? "Previsto para" : "Ainda previsto em"} {formatMonthYearPT(refDate)}
          </p>
          {forecast.pendingIncomeTotal > 0 && (
            <p className="text-xs text-[color:var(--text-secondary)]">
              Receita recorrente:{" "}
              <strong className="font-bold text-[color:var(--income)]">
                +{formatBRL(forecast.pendingIncomeTotal)}
              </strong>
            </p>
          )}
          {forecast.pendingExpenseTotal > 0 && (
            <p className="text-xs text-[color:var(--text-secondary)]">
              Despesas recorrentes:{" "}
              <strong className="font-bold text-[color:var(--brand-orange)]">
                −{formatBRL(forecast.pendingExpenseTotal)}
              </strong>
            </p>
          )}
          <p className="text-xs text-[color:var(--text-secondary)]">
            Lucro projetado:{" "}
            <strong className="font-bold text-white">
              {formatBRL(forecast.projectedIncome - forecast.projectedExpense)}
            </strong>
          </p>
          <Link
            to="/financeiro"
            className="ml-auto text-xs font-bold text-[color:var(--brand-purple)] hover:underline"
          >
            Revisar →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Receita Bruta"
          value={dash.receitaBruta}
          variation={dash.varReceita}
          accent="purple"
          icon={TrendingUp}
        />
        <KpiCard
          label="Despesas"
          value={dash.despesas}
          variation={dash.varDespesa}
          accent="orange"
          icon={TrendingDown}
          invert
        />
        <KpiCard
          label="Fluxo de Caixa"
          value={dash.fluxoCaixa}
          variation={dash.varFluxo}
          accent="green"
          icon={Landmark}
        />
        <KpiCard
          label="Lucro Líquido"
          value={dash.lucroLiquido}
          variation={dash.varLucro}
          accent="teal"
          icon={PiggyBank}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-10">
        <div className="lg:col-span-7">
          <ReceitaDespesaChart data={dash.monthly} />
        </div>
        <div className="lg:col-span-3">
          <CategoriaDonut data={dash.byCategory} total={dash.totalDespesas} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ReconciliationBar
          data={reconcile(monthRows.filter((r) => r.type === "income"))}
          flow="income"
          title="Recebimentos"
          subtitle="Quanto do faturamento já entrou no caixa"
        />
        <ReconciliationBar
          data={reconcile(monthRows.filter((r) => r.type === "expense"))}
          flow="expense"
          title="Pagamentos"
          subtitle="Quanto das despesas já saiu do caixa"
        />
      </div>

      <TransacoesRecentes rows={dash.recent} />

      <LancamentoModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function exportCsv(rows: TxRow[]) {
  if (rows.length === 0) {
    toast.info("Nenhuma transação para exportar");
    return;
  }
  const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["Data", "Tipo", "Descrição", "Categoria", "Cliente", "Status", "Valor"];
  const lines = rows.map((r) =>
    [
      r.occurred_at,
      r.type === "income" ? "Receita" : "Despesa",
      r.description,
      r.category,
      r.client?.name ?? "",
      r.status === "paid" ? "Pago" : r.status === "pending" ? "Pendente" : "Atrasado",
      r.amount.toFixed(2).replace(".", ","),
    ]
      .map(esc)
      .join(";"),
  );
  const blob = new Blob(["﻿" + [header.join(";"), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `finup-transacoes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("CSV exportado");
}
