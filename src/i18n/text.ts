import type { useTranslations } from "next-intl";
import { anchorOf } from "@/lib/domain/deck";
import { talkSeconds, versusPlanned, type SessionClock } from "@/lib/domain/timing";

// Textos montados a partir das regras puras (durações, posição no roteiro, faixas de público), no idioma de
// quem lê. Recebem o `t` da área "domain": useTranslations("domain") no cliente, getTranslations("domain")
// no servidor. As funções equivalentes em lib/domain (em português) ficam para o MCP e a IA.

export type DomainT = ReturnType<typeof useTranslations<"domain">>;

/** "51 min", "1 h 05 min", "menos de 1 min". */
export function durationText(t: DomainT, totalSeconds: number): string {
  if (totalSeconds < 30) return t("duration.lessThanMinute");
  const minutes = Math.round(Math.max(0, totalSeconds) / 60);
  if (minutes < 60) return t("duration.minutes", { minutes });
  const rest = minutes % 60;
  return rest === 0
    ? t("duration.hours", { hours: minutes / 60 })
    : t("duration.hoursMinutes", { hours: Math.floor(minutes / 60), minutes: String(rest).padStart(2, "0") });
}

/** Trecho curto, com segundos: "45 s", "3 min 20 s", "1 h 02 min". */
export function spanText(t: DomainT, totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return t("duration.seconds", { seconds: s });
  if (s < 3600) {
    const rest = s % 60;
    const minutes = Math.floor(s / 60);
    return rest === 0 ? t("duration.minutes", { minutes }) : t("duration.minutesSeconds", { minutes, seconds: rest });
  }
  return durationText(t, s);
}

/** "51 min de palestra (previsto 45 min, 6 min a mais)". Null antes de a sessão terminar. */
export function durationSummaryText(t: DomainT, clock: SessionClock, plannedMinutes: number | null): string | null {
  if (!clock.endedAt) return null;
  const seconds = talkSeconds(clock, Date.parse(clock.endedAt));
  if (seconds === null) return null;
  const duration = durationText(t, seconds);
  const versus = versusPlanned(seconds, plannedMinutes);
  if (!versus || !plannedMinutes) return t("duration.talk", { duration });
  const diff = Math.abs(versus.diffMinutes);
  const detail =
    diff === 0 ? t("duration.onTime") : versus.diffMinutes > 0 ? t("duration.over", { minutes: diff }) : t("duration.under", { minutes: diff });
  return t("duration.talkVersus", { duration, planned: durationText(t, plannedMinutes * 60), detail });
}

/** Posição no roteiro: "Antes do 1º slide", "Depois do slide 3", "No fim". */
export function gapText(t: DomainT, afterSlide: number | null, slideCount: number): string {
  const anchor = anchorOf(afterSlide, slideCount);
  if (anchor >= slideCount) return t("deck.end");
  if (anchor === 0) return t("deck.beforeFirst");
  return t("deck.afterSlide", { slide: anchor });
}

/** Faixa de público do perfil público ("21 a 50 pessoas"). */
export function audienceRangeText(t: DomainT, participants: number): string {
  if (participants <= 20) return t("audienceRange.upTo20");
  if (participants <= 50) return t("audienceRange.from21to50");
  if (participants <= 100) return t("audienceRange.from51to100");
  if (participants <= 300) return t("audienceRange.from101to300");
  return t("audienceRange.over300");
}
