import { useMemo } from "react";
import type { TxRow } from "@/lib/transactions";
import { MONTH_LABELS_PT, parseDateLocal } from "@/lib/format";

export type DashboardData = {
  receitaBruta: number;
  despesas: number;
  fluxoCaixa: number;
  lucroLiquido: number;
  varReceita: number | null;
  varDespesa: number | null;
  varFluxo: number | null;
  varLucro: number | null;
  monthly: { month: string; receita: number; despesa: number }[];
  byCategory: { name: string; value: number; color: string }[];
  totalDespesas: number;
  recent: TxRow[];
};

const PIE_COLORS = ["#7C3AFF", "#FF5C1A", "#22C55E", "#2DD4BF", "#A1A1AA"];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function useDashboard(rows: TxRow[] | undefined, referenceDate = new Date()): DashboardData {
  return useMemo(() => {
    const list = rows ?? [];
    const refMonth = referenceDate.getMonth();
    const refYear = referenceDate.getFullYear();

    const inMonth = (r: TxRow, m: number, y: number) => {
      const d = parseDateLocal(r.occurred_at);
      return d.getMonth() === m && d.getFullYear() === y;
    };

    const monthRows = list.filter((r) => inMonth(r, refMonth, refYear));
    const prevMonthDate = new Date(refYear, refMonth - 1, 1);
    const prevRows = list.filter((r) =>
      inMonth(r, prevMonthDate.getMonth(), prevMonthDate.getFullYear()),
    );

    const sum = (rs: TxRow[], t: "income" | "expense") =>
      rs.filter((r) => r.type === t).reduce((acc, r) => acc + r.amount, 0);
    // cash flow only counts money that actually moved (paid), while profit includes pending
    const sumPaid = (rs: TxRow[], t: "income" | "expense") =>
      rs.filter((r) => r.type === t && r.status === "paid").reduce((acc, r) => acc + r.amount, 0);

    const receitaBruta = sum(monthRows, "income");
    const despesas = sum(monthRows, "expense");
    const fluxoCaixa = sumPaid(monthRows, "income") - sumPaid(monthRows, "expense");
    const lucroLiquido = receitaBruta - despesas;

    const prevReceita = sum(prevRows, "income");
    const prevDespesa = sum(prevRows, "expense");
    const prevFluxo = sumPaid(prevRows, "income") - sumPaid(prevRows, "expense");
    const prevLucro = prevReceita - prevDespesa;

    // null = sem base de comparação (mês anterior zerado); a UI mostra "—" em vez de um % enganoso
    const pct = (curr: number, prev: number): number | null =>
      prev === 0 ? null : ((curr - prev) / Math.abs(prev)) * 100;

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

    // expense by category (current month) — agrupa ignorando caixa/acento, para que
    // "Software" e "software" não virem duas fatias distintas
    const catMap = new Map<string, { label: string; value: number }>();
    monthRows
      .filter((r) => r.type === "expense")
      .forEach((r) => {
        const raw = r.category.trim() || "Outros";
        const key = raw
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        const entry = catMap.get(key);
        if (entry) entry.value += r.amount;
        else catMap.set(key, { label: capitalize(raw), value: r.amount });
      });
    const byCategory = Array.from(catMap.values())
      .sort((a, b) => b.value - a.value)
      .map((c, i) => ({ name: c.label, value: c.value, color: PIE_COLORS[i % PIE_COLORS.length] }));

    return {
      receitaBruta,
      despesas,
      fluxoCaixa,
      lucroLiquido,
      varReceita: pct(receitaBruta, prevReceita),
      varDespesa: pct(despesas, prevDespesa),
      varFluxo: pct(fluxoCaixa, prevFluxo),
      varLucro: pct(lucroLiquido, prevLucro),
      monthly,
      byCategory,
      totalDespesas: despesas,
      recent: monthRows.slice(0, 6),
    };
  }, [rows, referenceDate]);
}
