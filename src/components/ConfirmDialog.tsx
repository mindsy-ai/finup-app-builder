import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

type Props = {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  /** opções extras da ação, como "remover também o agendamento" */
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Confirmação explícita antes de ações irreversíveis. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Excluir",
  destructive = true,
  pending,
  children,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2.5">
          {destructive && (
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-[rgba(239,68,68,0.12)]">
              <AlertTriangle className="h-[18px] w-[18px] text-[color:var(--expense)]" />
            </span>
          )}
          <h2 className="text-base font-bold text-white">{title}</h2>
        </div>
        <p className="text-sm leading-relaxed text-[color:var(--text-secondary)]">{message}</p>
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[color:var(--border-default)] px-4 py-2 text-sm font-medium text-white hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            type="button"
            autoFocus
            disabled={pending}
            onClick={onConfirm}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{
              background: destructive ? "var(--expense)" : undefined,
              backgroundImage: destructive ? undefined : "linear-gradient(135deg,#FF1C74,#FF8C42)",
            }}
          >
            {pending ? "Excluindo..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
