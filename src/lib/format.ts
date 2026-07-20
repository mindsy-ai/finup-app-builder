export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatBRLCompact(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `R$${Math.round(value / 1000)}k`;
  }
  return formatBRL(value);
}

/**
 * Rótulo curto para eixos. Arredondar tudo para milhares gera rótulos
 * repetidos ("0k, 0k, 1k, 1k") quando a escala é pequena, então abaixo de
 * 10 mil mostramos o valor cheio.
 */
export function formatAxisBRL(value: number, max: number): string {
  if (max < 10000) return value === 0 ? "0" : String(Math.round(value));
  return `${Math.round(value / 1000)}k`;
}

/**
 * Parses date-only strings ("2026-07-05") as local dates. `new Date("2026-07-05")`
 * interprets them as UTC midnight, which shifts to the previous day in UTC-3.
 */
export function parseDateLocal(date: string | Date): Date {
  if (date instanceof Date) return date;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(date);
}

export function formatDateBR(date: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(
    parseDateLocal(date),
  );
}

export const MONTH_LABELS_PT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export const MONTH_NAMES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function formatMonthYearPT(date = new Date()): string {
  return `${MONTH_NAMES_PT[date.getMonth()]} ${date.getFullYear()}`;
}
