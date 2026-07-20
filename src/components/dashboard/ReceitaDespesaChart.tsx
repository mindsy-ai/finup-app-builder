import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAxisBRL, formatBRLCompact } from "@/lib/format";

type Datum = { month: string; receita: number; despesa: number };

export function ReceitaDespesaChart({ data }: { data: Datum[] }) {
  const max = Math.max(0, ...data.flatMap((d) => [d.receita, d.despesa]));
  return (
    <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Receita vs Despesas</h3>
          <p className="mt-0.5 text-xs text-[color:var(--text-secondary)]">
            Últimos 6 meses{max >= 10000 ? " · em mil R$" : ""}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-[color:var(--text-secondary)]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-[color:var(--brand-purple)]" />
            Receita
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-[color:var(--brand-orange)]" />
            Despesa
          </span>
        </div>
      </div>
      <div className="mt-4 h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={6} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
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
              tickFormatter={(v: number) => formatAxisBRL(v, max)}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{
                background: "#1A1A1A",
                border: "1px solid #2A2A2A",
                borderRadius: 8,
                color: "#FFFFFF",
                fontSize: 12,
              }}
              formatter={(v: number, name) => [
                formatBRLCompact(v),
                name === "receita" ? "Receita" : "Despesa",
              ]}
              labelStyle={{ color: "#A1A1AA" }}
            />
            <Legend content={() => null} />
            <Bar dataKey="receita" fill="#7C3AFF" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="despesa" fill="#FF5C1A" radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
