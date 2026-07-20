import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FileDown } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchTransactions } from "@/lib/transactions";
import { fetchClients } from "@/lib/clients";
import { fetchRecurringExpenses } from "@/lib/recurring";
import { occursInMonth } from "@/lib/forecast";
import { useDashboard } from "@/lib/dashboard";
import { ReceitaDespesaChart } from "@/components/dashboard/ReceitaDespesaChart";
import {
  formatBRL,
  formatBRLCompact,
  formatMonthYearPT,
  MONTH_LABELS_PT,
  parseDateLocal,
} from "@/lib/format";
import { usePeriod } from "@/lib/period";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios · FinUp" },
      { name: "description", content: "DRE, projeções e comparativos financeiros." },
    ],
  }),
  component: RelatoriosPage,
});

type Tab = "dre" | "comp" | "proj";

function growthRate(series: number[]): number {
  const valid = series.filter((v) => v > 0);
  if (valid.length < 2) return 0;
  const rates: number[] = [];
  for (let i = 1; i < valid.length; i++) rates.push((valid[i] - valid[i - 1]) / valid[i - 1]);
  return rates.reduce((s, r) => s + r, 0) / rates.length;
}

function RelatoriosPage() {
  const txQuery = useQuery({ queryKey: ["transactions"], queryFn: fetchTransactions });
  const clientsQuery = useQuery({ queryKey: ["clients"], queryFn: fetchClients });
  const recurringQuery = useQuery({
    queryKey: ["recurring-expenses"],
    queryFn: fetchRecurringExpenses,
  });
  const { refDate } = usePeriod();
  const dash = useDashboard(txQuery.data, refDate);
  const [tab, setTab] = useState<Tab>("dre");

  const rows = txQuery.data ?? [];
  const monthRows = useMemo(
    () =>
      rows.filter((r) => {
        const d = parseDateLocal(r.occurred_at);
        return d.getMonth() === refDate.getMonth() && d.getFullYear() === refDate.getFullYear();
      }),
    [rows, refDate],
  );

  const expenseByCategory = (pattern: RegExp) =>
    monthRows
      .filter((r) => r.type === "expense" && pattern.test(r.category))
      .reduce((s, r) => s + r.amount, 0);

  const impostos = expenseByCategory(/imposto/i);
  const marketing = expenseByCategory(/marketing/i);
  const receitaLiquida = dash.receitaBruta - impostos;
  const custosOperacionais = dash.despesas - impostos - marketing;
  const resultadoOperacional = receitaLiquida - custosOperacionais - marketing;
  const margemLiquida = dash.receitaBruta > 0 ? (dash.lucroLiquido / dash.receitaBruta) * 100 : 0;

  // margem do mês anterior, para o delta em pontos percentuais
  const prevMonthly = dash.monthly[dash.monthly.length - 2];
  const prevMargem =
    prevMonthly && prevMonthly.receita > 0
      ? ((prevMonthly.receita - prevMonthly.despesa) / prevMonthly.receita) * 100
      : null;
  const margemDelta = prevMargem === null ? null : margemLiquida - prevMargem;

  const dreRows = [
    { label: "Receita Bruta", value: dash.receitaBruta, bold: true },
    { label: "(-) Impostos", value: -impostos, bold: false },
    { label: "Receita Líquida", value: receitaLiquida, bold: true, shade: true },
    { label: "(-) Custos Operacionais", value: -custosOperacionais, bold: false },
    { label: "(-) Marketing", value: -marketing, bold: false },
    { label: "Resultado Operacional", value: resultadoOperacional, bold: true, shade: true },
    { label: "Lucro Líquido", value: dash.lucroLiquido, bold: true, highlight: true },
  ];

  const receitaMedia = dash.monthly.reduce((s, m) => s + m.receita, 0) / (dash.monthly.length || 1);
  const despesaMedia = dash.monthly.reduce((s, m) => s + m.despesa, 0) / (dash.monthly.length || 1);
  const lucroAcumulado = dash.monthly.reduce((s, m) => s + (m.receita - m.despesa), 0);

  const revGrowth = growthRate(dash.monthly.map((m) => m.receita));
  const expGrowth = growthRate(dash.monthly.map((m) => m.despesa));
  const lastRev = dash.monthly[dash.monthly.length - 1]?.receita ?? 0;
  const lastExp = dash.monthly[dash.monthly.length - 1]?.despesa ?? 0;

  const activeMRR = (clientsQuery.data ?? [])
    .filter((c) => c.status === "ativo")
    .reduce((s, c) => s + c.monthly_amount, 0);

  /**
   * A projeção parte do que já está comprometido — lançamentos com data futura já
   * registrados e recorrências agendadas — e só usa a tendência histórica para o
   * que exceder isso. Assim um contrato já fechado para o mês que vem aparece.
   */
  const projRows = [1, 2, 3].map((i) => {
    const d = new Date(refDate.getFullYear(), refDate.getMonth() + i, 1);

    const monthTx = rows.filter((r) => {
      const td = parseDateLocal(r.occurred_at);
      return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
    });
    const bookedRev = monthTx.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
    const bookedExp = monthTx.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);

    // compromissos ainda não lançados naquele mês
    const bookedRecurringNames = new Set(
      monthTx
        .filter((r) => r.type === "expense" && r.is_recurring)
        .map((r) => r.description.trim()),
    );
    const committedExp = (recurringQuery.data ?? [])
      .filter((r) => occursInMonth(r, d) && !bookedRecurringNames.has(r.name.trim()))
      .reduce((s, r) => s + r.amount, 0);

    const bookedRecurringIncome = monthTx
      .filter((r) => r.type === "income" && r.entry_type === "recorrente")
      .reduce((s, r) => s + r.amount, 0);
    const committedRev = Math.max(0, activeMRR - bookedRecurringIncome);

    const trendRev = lastRev * Math.pow(1 + revGrowth, i);
    const trendExp = lastExp * Math.pow(1 + expGrowth, i);

    // o comprometido é o piso; a tendência só complementa se for maior
    const rev = Math.max(bookedRev + committedRev, trendRev);
    const exp = Math.max(bookedExp + committedExp, trendExp);

    return {
      month: `${MONTH_LABELS_PT[d.getMonth()]} ${d.getFullYear()}`,
      short: MONTH_LABELS_PT[d.getMonth()],
      rev,
      exp,
      net: rev - exp,
      // o selo sinaliza lançamentos já registrados naquele mês; recorrências
      // existem em todos os meses e não distinguiriam nada
      bookedTotal: bookedRev + bookedExp,
    };
  });
  const projChart = [
    { month: MONTH_LABELS_PT[refDate.getMonth()], rev: lastRev, projetado: false },
    ...projRows.map((p) => ({ month: p.short, rev: p.rev, projetado: true })),
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
        <div>
          <h1 className="text-xl font-bold leading-tight text-white sm:text-2xl">Relatórios</h1>
          <p className="mt-0.5 text-[13px] text-[color:var(--text-secondary)] sm:mt-1 sm:text-sm">
            DRE, projeções e comparativos · {formatMonthYearPT(refDate)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white gradient-brand print:hidden"
        >
          <FileDown className="h-4 w-4" />
          Exportar PDF
        </button>
      </div>

      <div className="flex w-fit gap-1.5 rounded-[11px] bg-white/5 p-1">
        {(
          [
            ["dre", "DRE"],
            ["comp", "Comparativo"],
            ["proj", "Projeções"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
              tab === key ? "text-white" : "text-[color:var(--text-secondary)]"
            }`}
            style={tab === key ? { background: "var(--brand-purple)" } : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "dre" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
          <div className="overflow-hidden rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)]">
            <div className="border-b border-[color:var(--border-default)] px-5 py-4">
              <p className="text-sm font-bold text-white">Demonstrativo de Resultado (DRE)</p>
              <p className="mt-0.5 text-xs text-[color:var(--text-secondary)]">
                {formatMonthYearPT(refDate)}
              </p>
            </div>
            {dreRows.map((r) => (
              <div
                key={r.label}
                className={`flex items-center justify-between px-5 ${r.bold ? "py-3.5" : "py-2.5"} ${
                  r.shade ? "bg-white/[0.03]" : ""
                } ${r.highlight ? "bg-[color:var(--income)]/[0.06]" : ""} border-b border-[color:var(--border-subtle)] last:border-b-0`}
              >
                <span className={`text-[13px] ${r.bold ? "font-bold" : "font-medium"} text-white`}>
                  {r.label}
                </span>
                <span
                  className={`text-[13px] tabular-nums ${r.bold ? "font-bold" : "font-medium"}`}
                  style={{
                    color: r.highlight ? "var(--income)" : r.value < 0 ? "var(--expense)" : "white",
                  }}
                >
                  {r.value < 0 ? "- " : ""}
                  {formatBRL(Math.abs(r.value))}
                </span>
              </div>
            ))}
          </div>
          <div className="space-y-3.5">
            <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-5">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.07em] text-[color:var(--text-secondary)]">
                Margem Líquida
              </p>
              <p className="text-[30px] font-black leading-none text-[color:var(--income)]">
                {margemLiquida.toFixed(1).replace(".", ",")}%
              </p>
              {margemDelta !== null && (
                <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">
                  {margemDelta >= 0 ? "↑" : "↓"}{" "}
                  {Math.abs(margemDelta).toFixed(1).replace(".", ",")} p.p. vs mês anterior
                </p>
              )}
            </div>
            <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-5">
              <p className="mb-3.5 text-sm font-bold text-white">Despesas por Categoria</p>
              <div className="space-y-3">
                {dash.byCategory.map((c) => (
                  <div key={c.name}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-white">{c.name}</span>
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
                {dash.byCategory.length === 0 && (
                  <p className="text-xs text-[color:var(--text-muted)]">Sem despesas no período.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "comp" && (
        <div className="space-y-4">
          <ReceitaDespesaChart data={dash.monthly} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <CompKpi label="Receita Média" value={formatBRL(receitaMedia)} tone="income" />
            <CompKpi label="Despesa Média" value={formatBRL(despesaMedia)} tone="expense" />
            <CompKpi label="Lucro Acumulado" value={formatBRL(lucroAcumulado)} tone="income" />
          </div>
        </div>
      )}

      {tab === "proj" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-5">
            <p className="text-sm font-bold text-white">Projeção de Fluxo de Caixa</p>
            <p className="mt-0.5 mb-4 text-xs text-[color:var(--text-secondary)]">
              Próximos 3 meses · lançamentos e recorrências já confirmados, complementados pela
              tendência dos últimos 6 meses
            </p>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projChart} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="#2A2A2A" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#52525B", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#52525B", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => formatBRLCompact(v)}
                  />
                  <Tooltip
                    formatter={(v: number) => [formatBRL(v), "Receita"]}
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
                    dataKey="rev"
                    stroke="var(--brand-purple)"
                    strokeWidth={2.5}
                    strokeDasharray="6 5"
                    dot={{ r: 4, fill: "var(--brand-orange)", strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)]">
            <div className="border-b border-[color:var(--border-default)] px-5 py-4">
              <p className="text-sm font-bold text-white">Detalhamento da Projeção</p>
            </div>
            {projRows.map((p) => (
              <div
                key={p.month}
                className="flex items-center justify-between border-b border-[color:var(--border-subtle)] px-5 py-3.5 last:border-b-0"
              >
                <span className="flex items-center gap-2 text-[13px] font-medium text-white">
                  {p.month}
                  {p.bookedTotal > 0 && (
                    <span
                      title="Já existem lançamentos registrados para este mês"
                      className="rounded-full bg-[rgba(34,197,94,0.12)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.04em] text-[color:var(--income)]"
                    >
                      Já lançado
                    </span>
                  )}
                </span>
                <div className="flex gap-6">
                  <div className="text-right">
                    <p className="text-[9px] text-[color:var(--text-secondary)]">Receita</p>
                    <p className="text-[13px] font-bold text-[color:var(--brand-purple)] tabular-nums">
                      {formatBRL(p.rev)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-[color:var(--text-secondary)]">Despesa</p>
                    <p className="text-[13px] font-bold text-[color:var(--brand-orange)] tabular-nums">
                      {formatBRL(p.exp)}
                    </p>
                  </div>
                  <div className="min-w-[74px] text-right">
                    <p className="text-[9px] text-[color:var(--text-secondary)]">Saldo</p>
                    <p
                      className="text-[13px] font-bold tabular-nums"
                      style={{ color: p.net >= 0 ? "var(--income)" : "var(--expense)" }}
                    >
                      {p.net >= 0 ? "+" : ""}
                      {formatBRL(p.net)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CompKpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "income" | "expense";
}) {
  return (
    <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-[18px]">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.07em] text-[color:var(--text-secondary)]">
        {label}
      </p>
      <p
        className="text-[22px] font-bold leading-none tabular-nums"
        style={{ color: tone === "income" ? "var(--income)" : "var(--expense)" }}
      >
        {value}
      </p>
    </div>
  );
}
