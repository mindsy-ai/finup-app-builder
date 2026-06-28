import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { formatBRLCompact } from "@/lib/format";

type Slice = { name: string; value: number; color: string };

export function CategoriaDonut({ data, total }: { data: Slice[]; total: number }) {
  const safe = data.length > 0 ? data : [{ name: "Sem dados", value: 1, color: "#2A2A2A" }];
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

  return (
    <div className="flex h-full flex-col rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-5">
      <div>
        <h3 className="text-base font-semibold text-white">Distribuição</h3>
        <p className="mt-0.5 text-xs text-[color:var(--text-secondary)]">Por categoria</p>
      </div>

      <div className="relative mx-auto mt-2 h-[180px] w-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={safe} dataKey="value" innerRadius={58} outerRadius={82} stroke="none" startAngle={90} endAngle={-270}>
              {safe.map((s, i) => (
                <Cell key={i} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[18px] font-bold text-white">{formatBRLCompact(total)}</div>
          <div className="text-[11px] text-[color:var(--text-secondary)]">despesas</div>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {data.length === 0 && <li className="text-xs text-[color:var(--text-muted)]">Sem despesas no período</li>}
        {data.map((s) => (
          <li key={s.name} className="flex items-center justify-between text-xs text-[color:var(--text-secondary)]">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.name}
            </span>
            <span className="text-white/80">{pct(s.value)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
