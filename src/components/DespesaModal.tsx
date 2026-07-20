import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  existingCategories,
  fetchTransactions,
  updateTransaction,
  type TxRow,
} from "@/lib/transactions";

/** Edição de uma despesa já lançada — valor, categoria, data, vencimento e situação. */
export function DespesaModal({ row, onClose }: { row: TxRow; onClose: () => void }) {
  const qc = useQueryClient();
  const txQuery = useQuery({ queryKey: ["transactions"], queryFn: fetchTransactions });
  const categories = existingCategories(txQuery.data);

  const [form, setForm] = useState({
    description: row.description,
    amount: String(row.amount),
    category: row.category,
    occurred_at: row.occurred_at.slice(0, 10),
    due_date: row.due_date?.slice(0, 10) ?? "",
    status: row.status === "paid" ? ("paid" as const) : ("pending" as const),
  });

  const mutation = useMutation({
    mutationFn: () =>
      updateTransaction(row.id, {
        description: form.description.trim(),
        amount: Number(form.amount),
        category: form.category.trim() || "Outros",
        occurred_at: form.occurred_at,
        due_date: form.status === "pending" ? form.due_date || form.occurred_at : null,
        status: form.status,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Despesa atualizada");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dueBeforeDate =
    form.status === "pending" && !!form.due_date && form.due_date < form.occurred_at;
  const valid = form.description.trim().length > 0 && Number(form.amount) > 0 && !dueBeforeDate;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white">Editar despesa</h2>
        {row.is_recurring && (
          <p className="mt-1 text-xs text-[color:var(--brand-purple)]">
            Gerada por uma recorrência — editar aqui não altera o agendamento.
          </p>
        )}

        <div className="mt-4 space-y-3">
          <Field label="Descrição">
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className={inputCls}
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
              />
            </Field>
            <Field label="Categoria">
              <input
                list="categorias-despesa"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className={inputCls}
              />
              <datalist id="categorias-despesa">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <input
                type="date"
                value={form.occurred_at}
                onChange={(e) => setForm((f) => ({ ...f, occurred_at: e.target.value }))}
                className={inputCls}
              />
            </Field>
            {form.status === "pending" && (
              <Field label="Vencimento">
                <input
                  type="date"
                  min={form.occurred_at}
                  value={form.due_date || form.occurred_at}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                  className={`${inputCls} ${dueBeforeDate ? "border-[color:var(--expense)]" : ""}`}
                />
              </Field>
            )}
          </div>
          {dueBeforeDate && (
            <p className="text-[11px] font-medium text-[color:var(--expense)]">
              O vencimento não pode ser anterior à data da despesa.
            </p>
          )}

          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--text-secondary)]">
              Situação
            </p>
            <div className="flex gap-2">
              {(
                [
                  ["paid", "Pago"],
                  ["pending", "A pagar"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, status: k }))}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    form.status === k
                      ? "text-white"
                      : "bg-white/5 text-[color:var(--text-secondary)]"
                  }`}
                  style={
                    form.status === k
                      ? { background: k === "paid" ? "var(--income)" : "var(--brand-orange)" }
                      : undefined
                  }
                >
                  {label}
                </button>
              ))}
            </div>
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
            disabled={mutation.isPending || !valid}
            onClick={() => mutation.mutate()}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white gradient-brand disabled:opacity-50"
          >
            {mutation.isPending ? "Salvando..." : "Salvar alterações"}
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
