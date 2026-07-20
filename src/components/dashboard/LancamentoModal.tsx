import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createTransaction,
  existingCategories,
  fetchTransactions,
  type NewTx,
} from "@/lib/transactions";

export function LancamentoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const txQuery = useQuery({ queryKey: ["transactions"], queryFn: fetchTransactions });
  const categories = existingCategories(txQuery.data);
  const [form, setForm] = useState<NewTx>({
    type: "income",
    amount: 0,
    category: "",
    description: "",
    occurred_at: new Date().toISOString().slice(0, 10),
    status: "paid",
  });

  const mutation = useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Lançamento criado");
      onClose();
      setForm((f) => ({ ...f, amount: 0, description: "", category: "" }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) return null;

  const set = <K extends keyof NewTx>(k: K, v: NewTx[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-5 pb-[calc(20px+env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-2xl sm:p-6 sm:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white">Novo Lançamento</h2>
        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
          Registre uma receita ou despesa.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["income", "expense"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set("type", t)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                form.type === t
                  ? t === "income"
                    ? "border-[color:var(--income)] bg-[rgba(34,197,94,0.15)] text-[color:var(--income)]"
                    : "border-[color:var(--expense)] bg-[rgba(239,68,68,0.15)] text-[color:var(--expense)]"
                  : "border-[color:var(--border-default)] text-[color:var(--text-secondary)]"
              }`}
            >
              {t === "income" ? "Receita" : "Despesa"}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          <Field label="Descrição">
            <input
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className={inputCls}
              placeholder="Ex: Repasse Meta Ads"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.amount || ""}
                onChange={(e) => set("amount", Number(e.target.value))}
                className={inputCls}
                placeholder="0,00"
              />
            </Field>
            <Field label="Data">
              <input
                type="date"
                value={form.occurred_at}
                onChange={(e) => set("occurred_at", e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Categoria">
            <input
              list="categorias-dashboard"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className={inputCls}
              placeholder="Marketing, Operacional, Outros…"
            />
            <datalist id="categorias-dashboard">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
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
            disabled={mutation.isPending || !form.description || form.amount <= 0}
            onClick={() => mutation.mutate({ ...form, category: form.category || "Outros" })}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white gradient-brand disabled:opacity-50"
          >
            {mutation.isPending ? "Salvando..." : "Salvar"}
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
