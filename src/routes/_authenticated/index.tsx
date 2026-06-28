import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { fetchTransactions } from "@/lib/transactions";
import { useDashboard } from "@/lib/dashboard";
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
  const query = useQuery({ queryKey: ["transactions"], queryFn: fetchTransactions });
  const dash = useDashboard(query.data);

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
          <p className="mt-1 text-sm text-[color:var(--text-secondary)]">Junho 2026 · Resumo financeiro</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Receita Bruta" value={dash.receitaBruta} variation={dash.varReceita} accent="purple" />
        <KpiCard label="Despesas" value={dash.despesas} variation={dash.varDespesa} accent="orange" />
        <KpiCard label="Fluxo de Caixa" value={dash.fluxoCaixa} variation={dash.varFluxo} accent="green" />
        <KpiCard label="Lucro Líquido" value={dash.lucroLiquido} variation={dash.varLucro} accent="teal" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-10">
        <div className="lg:col-span-7">
          <ReceitaDespesaChart data={dash.monthly} />
        </div>
        <div className="lg:col-span-3">
          <CategoriaDonut data={dash.byCategory} total={dash.totalDespesas} />
        </div>
      </div>

      <TransacoesRecentes rows={dash.recent} />

      <LancamentoModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
