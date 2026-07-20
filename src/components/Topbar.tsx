import {
  ArrowLeft,
  Bell,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { fetchTransactions } from "@/lib/transactions";
import { fetchClients } from "@/lib/clients";
import {
  formatBRL,
  formatDateBR,
  formatMonthYearPT,
  MONTH_LABELS_PT,
  parseDateLocal,
} from "@/lib/format";
import { usePeriod } from "@/lib/period";
import { daysUntilDue, dueLabel, effectiveStatus, statusVisual } from "@/lib/status";
import { supabase } from "@/integrations/supabase/client";
import { FinUpLogo } from "./FinUpLogo";

/** normaliza para busca: minúsculas e sem acentos */
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function Topbar() {
  const [initials, setInitials] = useState("");
  const [mobileSearch, setMobileSearch] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email ?? "";
      const fullName = (data.user?.user_metadata?.name as string) ?? email;
      const parts = fullName.split(/[\s@.]+/).filter(Boolean);
      setInitials(((parts[0]?.[0] ?? "U") + (parts[1]?.[0] ?? "")).toUpperCase());
    });
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-[56px] flex-shrink-0 items-center gap-2 border-b border-[color:var(--border-default)] bg-[color:var(--bg-nav)] px-4 sm:h-[62px] sm:gap-4 sm:px-7 print:hidden">
      {/* Mobile: logo à esquerda, já que o menu lateral não existe aqui */}
      <div className="flex items-center lg:hidden">
        <FinUpLogo />
      </div>

      {/* Desktop: campo de busca sempre visível */}
      <div className="hidden lg:flex lg:min-w-0 lg:flex-1">
        <GlobalSearch />
      </div>

      <div className="ml-auto flex flex-shrink-0 items-center gap-1.5 sm:gap-2.5">
        {/* Mobile: busca vira tela cheia — um campo de 90px não serve para nada */}
        <button
          type="button"
          aria-label="Buscar"
          onClick={() => setMobileSearch(true)}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-[color:var(--border-default)] bg-[color:var(--bg-card)] text-[color:var(--text-secondary)] lg:hidden"
        >
          <Search className="h-[18px] w-[18px]" />
        </button>
        <Notifications />
        <MonthSelector />
        {initials && (
          <div className="hidden h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white gradient-brand sm:flex">
            {initials}
          </div>
        )}
      </div>

      {mobileSearch && <MobileSearchOverlay onClose={() => setMobileSearch(false)} />}
    </header>
  );
}

/** Busca em tela cheia no mobile, com o teclado abrindo direto no campo. */
function MobileSearchOverlay({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-[color:var(--bg-primary)] lg:hidden">
      <div className="flex h-[56px] items-center gap-2 border-b border-[color:var(--border-default)] px-3">
        <button
          type="button"
          aria-label="Fechar busca"
          onClick={onClose}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] text-[color:var(--text-secondary)]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <GlobalSearch inputRef={inputRef} onNavigate={onClose} variant="overlay" />
      </div>
    </div>
  );
}

function GlobalSearch({
  inputRef,
  onNavigate,
  variant = "inline",
}: {
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onNavigate?: () => void;
  variant?: "inline" | "overlay";
} = {}) {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(variant === "overlay");
  const boxRef = useRef<HTMLDivElement>(null);

  const txQuery = useQuery({ queryKey: ["transactions"], queryFn: fetchTransactions });
  const clientsQuery = useQuery({ queryKey: ["clients"], queryFn: fetchClients });

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const q = norm(term.trim());
  const clientHits = q
    ? (clientsQuery.data ?? [])
        .filter((c) => norm(c.name).includes(q) || norm(c.nicho).includes(q))
        .slice(0, 4)
    : [];
  const txHits = q
    ? (txQuery.data ?? [])
        .filter(
          (t) =>
            norm(t.description).includes(q) ||
            norm(t.category).includes(q) ||
            norm(t.client?.name ?? "").includes(q),
        )
        .slice(0, 5)
    : [];

  const go = (to: "/clientes" | "/lancamentos" | "/financeiro") => {
    setOpen(false);
    setTerm("");
    navigate({ to });
    onNavigate?.();
  };

  const overlay = variant === "overlay";

  return (
    <div
      ref={boxRef}
      className={overlay ? "relative min-w-0 flex-1" : "relative w-full min-w-0 lg:w-[340px]"}
    >
      <div className="flex items-center gap-2 rounded-[10px] border border-[color:var(--border-default)] bg-[color:var(--bg-card)] px-3.5 py-2 focus-within:border-[color:var(--brand-purple)]">
        <Search className="h-[18px] w-[18px] flex-shrink-0 text-[color:var(--text-secondary)]" />
        <input
          ref={inputRef}
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Buscar clientes, lançamentos…"
          className="w-full bg-transparent text-[13px] text-white placeholder:text-[color:var(--text-secondary)] focus:outline-none"
        />
        {term && (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={() => {
              setTerm("");
              setOpen(false);
            }}
          >
            <X className="h-3.5 w-3.5 text-[color:var(--text-secondary)]" />
          </button>
        )}
      </div>

      {open && q && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 min-w-[280px] overflow-hidden rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] shadow-2xl">
          {clientHits.length === 0 && txHits.length === 0 && (
            <p className="px-4 py-5 text-center text-xs text-[color:var(--text-muted)]">
              Nada encontrado para “{term.trim()}”.
            </p>
          )}
          {clientHits.length > 0 && (
            <>
              <p className="border-b border-[color:var(--border-subtle)] bg-white/[0.03] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-secondary)]">
                Clientes
              </p>
              {clientHits.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => go("/clientes")}
                  className="flex w-full items-center justify-between gap-3 border-b border-[color:var(--border-subtle)] px-4 py-2.5 text-left hover:bg-white/5"
                >
                  <span className="truncate text-[13px] font-medium text-white">{c.name}</span>
                  <span className="flex-shrink-0 text-[11px] text-[color:var(--text-secondary)]">
                    {c.nicho || "Cliente"}
                  </span>
                </button>
              ))}
            </>
          )}
          {txHits.length > 0 && (
            <>
              <p className="border-b border-[color:var(--border-subtle)] bg-white/[0.03] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-secondary)]">
                Lançamentos
              </p>
              {txHits.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => go(t.type === "income" ? "/lancamentos" : "/financeiro")}
                  className="flex w-full items-center justify-between gap-3 border-b border-[color:var(--border-subtle)] px-4 py-2.5 text-left last:border-b-0 hover:bg-white/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-white">
                      {t.description}
                    </span>
                    <span className="text-[11px] text-[color:var(--text-secondary)]">
                      {formatDateBR(t.occurred_at)} · {t.client?.name ?? t.category}
                    </span>
                  </span>
                  <span
                    className="flex-shrink-0 text-[12px] font-bold tabular-nums"
                    style={{ color: t.type === "income" ? "var(--income)" : "var(--expense)" }}
                  >
                    {t.type === "income" ? "+" : "−"}
                    {formatBRL(t.amount)}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const txQuery = useQuery({ queryKey: ["transactions"], queryFn: fetchTransactions });

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // alerta tanto contas a pagar quanto recebimentos inadimplentes
  const alerts = (txQuery.data ?? [])
    .filter((t) => t.status !== "paid")
    .map((t) => ({ ...t, days: daysUntilDue(t), effective: effectiveStatus(t) }))
    .filter((t) => t.days <= 7)
    .sort((a, b) => a.days - b.days)
    .slice(0, 8);
  const overdueCount = alerts.filter((a) => a.effective === "overdue").length;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        aria-label="Notificações"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-[color:var(--border-default)] bg-[color:var(--bg-card)] text-[color:var(--text-secondary)] hover:brightness-110"
      >
        <Bell className="h-[19px] w-[19px]" />
        {alerts.length > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
            style={
              overdueCount > 0
                ? { background: "var(--expense)" }
                : { backgroundImage: "linear-gradient(135deg,#FF1C74,#FF8C42)" }
            }
          >
            {alerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-[320px] overflow-hidden rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] shadow-2xl">
          <p className="border-b border-[color:var(--border-default)] px-4 py-3 text-xs font-bold text-white">
            Notificações
          </p>
          {alerts.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-[color:var(--text-muted)]">
              Nenhum alerta. Contas em dia ✓
            </p>
          )}
          {alerts.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 border-b border-[color:var(--border-subtle)] px-4 py-2.5 last:border-b-0"
            >
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full"
                style={{
                  background:
                    a.days < 0
                      ? "var(--expense)"
                      : a.days <= 3
                        ? "var(--brand-orange)"
                        : "var(--income)",
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium text-white">
                  {a.description}
                </span>
                <span className="text-[11px] text-[color:var(--text-secondary)]">
                  <span
                    className="font-bold"
                    style={{ color: statusVisual(a.effective, a.type).color }}
                  >
                    {statusVisual(a.effective, a.type).label}
                  </span>{" "}
                  · {dueLabel(a)}
                </span>
              </span>
              <span
                className="flex-shrink-0 text-[12px] font-bold tabular-nums"
                style={{ color: a.type === "income" ? "var(--income)" : "white" }}
              >
                {a.type === "income" ? "+" : "−"}
                {formatBRL(a.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MonthSelector() {
  const { refDate, prevMonth, nextMonth, resetMonth, setMonth, isCurrentMonth, isFutureMonth } =
    usePeriod();
  const [open, setOpen] = useState(false);
  const [yearCursor, setYearCursor] = useState(refDate.getFullYear());
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    if (open) setYearCursor(refDate.getFullYear());
  }, [open, refDate]);

  const today = new Date();

  return (
    <div ref={boxRef} className="relative">
      <div
        className={`flex items-center overflow-hidden rounded-[10px] border bg-[color:var(--bg-card)] ${
          isFutureMonth
            ? "border-[color:var(--brand-purple)]/50"
            : "border-[color:var(--border-default)]"
        }`}
      >
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={prevMonth}
          className="flex h-[38px] w-7 items-center justify-center text-[color:var(--text-secondary)] hover:bg-white/5 hover:text-white sm:w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Escolher período"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 px-1.5 py-2 text-xs font-semibold text-white hover:bg-white/5 sm:px-2.5"
        >
          <Calendar className="hidden h-3.5 w-3.5 text-[color:var(--text-secondary)] sm:block" />
          <span className="whitespace-nowrap">
            <span className="sm:hidden">
              {formatMonthYearPT(refDate).slice(0, 3)}/{refDate.getFullYear()}
            </span>
            <span className="hidden sm:inline">{formatMonthYearPT(refDate)}</span>
          </span>
          <ChevronDown className="h-3 w-3 text-[color:var(--text-secondary)]" />
        </button>
        <button
          type="button"
          aria-label="Próximo mês"
          onClick={nextMonth}
          className="flex h-[38px] w-7 items-center justify-center text-[color:var(--text-secondary)] hover:bg-white/5 hover:text-white sm:w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-[260px] rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Ano anterior"
              onClick={() => setYearCursor((y) => y - 1)}
              className="rounded-md p-1 text-[color:var(--text-secondary)] hover:bg-white/5 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold text-white tabular-nums">{yearCursor}</span>
            <button
              type="button"
              aria-label="Próximo ano"
              onClick={() => setYearCursor((y) => y + 1)}
              className="rounded-md p-1 text-[color:var(--text-secondary)] hover:bg-white/5 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {MONTH_LABELS_PT.map((m, i) => {
              const selected = refDate.getFullYear() === yearCursor && refDate.getMonth() === i;
              const isToday = today.getFullYear() === yearCursor && today.getMonth() === i;
              const future =
                yearCursor > today.getFullYear() ||
                (yearCursor === today.getFullYear() && i > today.getMonth());
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMonth(yearCursor, i);
                    setOpen(false);
                  }}
                  className={`rounded-lg py-2 text-xs font-bold transition-colors ${
                    selected
                      ? "text-white gradient-brand"
                      : isToday
                        ? "bg-white/10 text-white"
                        : future
                          ? "text-[color:var(--brand-purple)] hover:bg-white/5"
                          : "text-[color:var(--text-secondary)] hover:bg-white/5"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-[color:var(--border-subtle)] pt-2.5">
            <span className="text-[10px] text-[color:var(--text-muted)]">
              Meses futuros mostram previsões
            </span>
            {!isCurrentMonth && (
              <button
                type="button"
                onClick={() => {
                  resetMonth();
                  setOpen(false);
                }}
                className="text-[11px] font-bold text-[color:var(--brand-purple)] hover:underline"
              >
                Hoje
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
