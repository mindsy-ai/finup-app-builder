import { createContext, useContext, useEffect, useMemo, useState } from "react";

type PeriodContextValue = {
  /** first day of the selected month */
  refDate: Date;
  prevMonth: () => void;
  nextMonth: () => void;
  resetMonth: () => void;
  /** salta direto para um mês/ano */
  setMonth: (year: number, month: number) => void;
  isCurrentMonth: boolean;
  /** true quando o mês selecionado ainda não começou */
  isFutureMonth: boolean;
};

const PeriodContext = createContext<PeriodContextValue | null>(null);

const STORAGE_KEY = "finup:period";

/** Mantém o período escolhido ao recarregar a página ou trocar de aba. */
function readStoredPeriod(): Date | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  const m = raw && /^(\d{4})-(\d{2})$/.exec(raw);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, 1);
}

export function PeriodProvider({ children }: { children: React.ReactNode }) {
  const now = new Date();
  const [refDate, setRefDate] = useState(
    () => readStoredPeriod() ?? new Date(now.getFullYear(), now.getMonth(), 1),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}`;
    window.sessionStorage.setItem(STORAGE_KEY, key);
  }, [refDate]);

  const value = useMemo<PeriodContextValue>(() => {
    const today = new Date();
    return {
      refDate,
      prevMonth: () => setRefDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)),
      nextMonth: () => setRefDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)),
      resetMonth: () => setRefDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      setMonth: (year: number, month: number) => setRefDate(new Date(year, month, 1)),
      isCurrentMonth:
        refDate.getMonth() === today.getMonth() && refDate.getFullYear() === today.getFullYear(),
      isFutureMonth:
        refDate.getFullYear() > today.getFullYear() ||
        (refDate.getFullYear() === today.getFullYear() && refDate.getMonth() > today.getMonth()),
    };
  }, [refDate]);

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

export function usePeriod(): PeriodContextValue {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error("usePeriod deve ser usado dentro de PeriodProvider");
  return ctx;
}
