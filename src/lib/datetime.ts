export const APP_TIME_ZONE = process.env.NEXT_PUBLIC_APP_TIME_ZONE || "America/Sao_Paulo";

/** Diferença (ms) entre o horário de parede no fuso e UTC para um instante. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - date.getTime();
}

/** Converte data ("2026-10-10") e hora ("19:00") no fuso do app para ISO UTC. */
export function zonedToUtcIso(date: string, time: string, timeZone = APP_TIME_ZONE): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time || "00:00");
  if (!d || !t) return null;
  const wall = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  if (Number.isNaN(wall)) return null;
  const first = wall - zoneOffsetMs(new Date(wall), timeZone);
  const result = wall - zoneOffsetMs(new Date(first), timeZone);
  return new Date(result).toISOString();
}

/** Inverso de zonedToUtcIso, para preencher formulários. */
export function utcToZonedParts(iso: string | null, timeZone = APP_TIME_ZONE): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: APP_TIME_ZONE, dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}

export function formatDate(iso: string | null): string {
  if (!iso) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: APP_TIME_ZONE, dateStyle: "medium" }).format(new Date(iso));
}

export function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: APP_TIME_ZONE, day: "2-digit", month: "short" }).format(
    new Date(iso),
  );
}
