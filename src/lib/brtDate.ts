// Utilitários de data no fuso horário de Brasília (America/Sao_Paulo).
// Todas as métricas do painel usam o dia comercial brasileiro, não o fuso do navegador.
export const BRT_TZ = "America/Sao_Paulo";

function brtParts(date: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) p[part.type] = part.value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour === "24" ? "0" : p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

/** Offset (em minutos) do fuso de Brasília para uma data específica. */
function brtOffsetMinutes(date: Date) {
  const { year, month, day, hour, minute, second } = brtParts(date);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return (asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000;
}

/** Instante UTC correspondente à meia-noite (BRT) do dia com `offsetDays` de diferença. */
export function brtStartOfDay(offsetDays = 0, base: Date = new Date()): Date {
  const { year, month, day } = brtParts(base);
  const guess = new Date(Date.UTC(year, month - 1, day + offsetDays, 0, 0, 0));
  const offset = brtOffsetMinutes(guess);
  return new Date(guess.getTime() - offset * 60000);
}

/** Instante UTC correspondente ao primeiro dia do mês (BRT). */
export function brtStartOfMonth(base: Date = new Date()): Date {
  const { year, month } = brtParts(base);
  const guess = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const offset = brtOffsetMinutes(guess);
  return new Date(guess.getTime() - offset * 60000);
}

/** Chave "dd/mm" no fuso de Brasília, usada para agrupar gráficos. */
export function brtDayKey(value: string | number | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const { day, month } = brtParts(date);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

/** Data formatada (dd/mm/aaaa) no fuso de Brasília. */
export function formatBrtDate(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { timeZone: BRT_TZ });
}

/** Data e hora formatadas no fuso de Brasília. */
export function formatBrtDateTime(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { timeZone: BRT_TZ });
}

/** Data e hora curtas (dd/mm/aaaa hh:mm) no fuso de Brasília. */
export function formatBrtShort(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleDateString("pt-BR", { timeZone: BRT_TZ })} ${date.toLocaleTimeString("pt-BR", { timeZone: BRT_TZ, hour: "2-digit", minute: "2-digit" })}`;
}

/** Hora (hh:mm:ss) no fuso de Brasília. */
export function formatBrtTime(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("pt-BR", { timeZone: BRT_TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
