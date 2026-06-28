import { useMemo } from "react";
import type { TxRow } from "@/lib/transactions";
import { MONTH_LABELS_PT } from "@/lib/format";

export type DashboardData = {
  receitaBruta: number;
  despesas: number;
  fluxoCaixa: number;
  lucroLiquido: number;
  varReceita: number;
  varDespesa: number;
  varFluxo: number;
  varLucro: number;
  monthly: { month: string; receita: number; despesa: number }[];
  byCategory: { name: string; value: number; color: string }[];
  totalDespesas: number;
  recent: TxRow[];
};

const PIE_COLORS = ["#7C3AFF", "#FF5C1A", "#22C55E", "#2DD4BF", "#A1A1AA"];

export function useDashboard(rows: TxRow[] | undefined, referenceDate = new Date()): DashboardData {
  return useMemo(() => {
    const list = rows ?? [];
    const refMonth = referenceDate.getMonth();
    const refYear = referenceDate.getFullYear();

    const inMonth = (r: TxRow, m: number, y: number) => {
      const d = new Date(r.occurred_at);
      return d.getMonth() === m && d.getFullYear() === y;
    };

    const monthRows = list.filter((r) => inMonth(r, refMonth, refYear));
    const prevMonthDate = new Date(refYear, refMonth - 1, 1);
    const prevRows = list.filter((r) => inMonth(r, prevMonthDate.getMonth(), prevMonthDate.getFullYear()));

    const sum = (rs: TxRow[], t: "income" | "expense") =>
      rs.filter((r) => r.type === t).reduce((acc, r) => acc + r.amount, 0);

    const receitaBruta = sum(monthRows, "income");
    const despesas = sum(monthRows, "expense");
    const fluxoCaixa = receitaBruta - despesas;
    const lucroLiquido = fluxoCaixa;

    const prevReceita = sum(prevRows, "income");
    const prevDespesa = sum(prevRows, "expense");
    const prevFluxo = prevReceita - prevDespesa;

    const pct = (curr: number, prev: number) =>
      prev === 0 ? (curr === 0 ? 0 : 100) : ((curr - prev) / Math.abs(prev)) * 100;

    // last 6 months series ending at reference month
    const monthly: { month: string; receita: number; despesa: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(refYear, refMonth - i, 1);
      const rs = list.filter((r) => inMonth(r, d.getMonth(), d.getFullYear()));
      monthly.push({
        month: MONTH_LABELS_PT[d.getMonth()],
        receita: sum(rs, "income"),
        despesa: sum(rs, "expense"),
      });
    }

    // expense by category (current month)
    const catMap = new Map<string, number>();
    monthRows
      .filter((r) => r.type === "expense")
      .forEach((r) => catMap.set(r.category, (catMap.get(r.category) ?? 0) + r.amount));
    const byCategory = Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value, color: PIE_COLORS[i % PIE_COLORS.length] }));

    return {
      receitaBruta,
      despesas,
      fluxoCaixa,
      lucroLiquido,
      varReceita: pct(receitaBruta, prevReceita),
      varDespesa: pct(despesas, prevDespesa),
      varFluxo: pct(fluxoCaixa, prevFluxo),
      varLucro: pct(lucroLiquido, prevFluxo),
      monthly,
      byCategory,
      totalDespesas: despesas,
      recent: list.slice(0, 6),
    };
  }, [rows, referenceDate]);
}
