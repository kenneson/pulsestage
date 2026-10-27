import { useLocale, useTranslations } from "next-intl";
import type { InteractionSummary } from "@/lib/domain/interaction-summary";
import { formatPercent, formatScore, formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/domain/locale";

// Métricas de cada interação ao lado do gráfico (`ResultsView`) no analytics, e a linha-resumo do relatório.
// O gráfico já mostra médias do 100 pontos, posições da matriz, marcações, média e resposta do número e respostas
// do quiz de digitar; aqui vai o que ele não mostra (acertos, tempo, mediana e chute mais perto).
// Sem "use client": roda nos Server Components do analytics e do relatório.

type T = ReturnType<typeof useTranslations<"analytics.metrics">>;

/** Número no idioma de quem lê, com até `digits` casas. */
function formatNumber(value: number | null, locale: Locale, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
}

function withUnit(text: string, unit: string | null): string {
  return unit && text !== "—" ? `${text} ${unit}` : text;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-md border px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-display text-lg font-bold tabular-nums break-words">
        {value}
      </dd>
    </div>
  );
}

function StatGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">{children}</dl>;
}

function QuizLine({ t, rate, ms, locale }: { t: T; rate: number | null; ms: number | null; locale: Locale }) {
  return (
    <p className="text-sm text-muted-foreground">
      {ms === null
        ? t("correctRate", { rate: formatPercent(rate) })
        : t("correctRateTime", { rate: formatPercent(rate), time: formatSeconds(ms, locale) })}
    </p>
  );
}

/** O que acompanha o gráfico de cada tipo no analytics (o gráfico em si é o `ResultsView`). */
export function InteractionMetrics({ summary }: { summary: InteractionSummary }) {
  const t = useTranslations("analytics.metrics");
  const locale = useLocale();

  switch (summary.kind) {
    case "quiz":
      return <QuizLine t={t} rate={summary.correctRate} ms={summary.avgResponseMs} locale={locale} />;
    case "rating":
      return <p className="text-sm text-muted-foreground">{t("median", { value: formatScore(summary.median, locale) })}</p>;
    case "guess": {
      const digits = Math.max(summary.decimals, 1);
      return (
        <StatGrid>
          <Stat label={t("guess.median")} value={withUnit(formatNumber(summary.median, locale, digits), summary.unit)} />
          <Stat label={t("guess.closest")} value={withUnit(formatNumber(summary.closest, locale, summary.decimals), summary.unit)} />
          <Stat label={t("guess.hitRate")} value={formatPercent(summary.hitRate)} />
          <Stat label={t("guess.avgPoints")} value={formatNumber(summary.avgPoints, locale, 0)} />
        </StatGrid>
      );
    }
    case "quizText":
      // O gráfico já mostra a resposta certa e quantos acertaram; aqui, o tempo.
      return summary.avgResponseMs === null ? null : (
        <p className="text-sm text-muted-foreground">{t("avgTime", { time: formatSeconds(summary.avgResponseMs, locale) })}</p>
      );
    default:
      return null;
  }
}

/** Uma linha com o principal de cada interação (relatório em PDF). null quando não há o que resumir. */
export function SummaryLine({ summary }: { summary: InteractionSummary }) {
  const t = useTranslations("analytics.metrics");
  const locale = useLocale();
  const text = summaryText(t, summary, locale);
  return text ? <span className="text-xs text-muted-foreground break-words">{text}</span> : null;
}

const join = (parts: string[]) => parts.join(" · ");

function summaryText(t: T, s: InteractionSummary, locale: Locale): string | null {
  if (s.kind === "content" || s.total === 0) return null;
  switch (s.kind) {
    case "choice":
      return join(
        [...s.rows]
          .sort((a, b) => b.count - a.count)
          .slice(0, 4)
          .map((r) => `${r.label} ${formatPercent(r.pct)}`),
      );
    case "quiz":
      return join([
        t("correctRate", { rate: formatPercent(s.correctRate) }),
        ...s.rows.filter((r) => r.correct).map((r) => `✓ ${r.label}`),
      ]);
    case "rating":
      return join([
        t("mean", { value: formatScore(s.mean, locale) }),
        t("median", { value: formatScore(s.median, locale) }),
      ]);
    case "words":
      return s.words.length > 0 ? join(s.words.slice(0, 6).map((w) => w.word)) : null;
    case "texts":
      return t("answers", { count: s.total });
    case "ranking":
      return join(s.rows.slice(0, 4).map((r, index) => `${t("position", { n: index + 1 })} ${r.label}`));
    case "points":
      return join(s.rows.slice(0, 4).map((r) => `${r.label}: ${formatNumber(r.average, locale)}`));
    case "matrix":
      return join(
        s.rows.slice(0, 4).map((r) => `${r.label} (x ${formatNumber(r.x, locale, 0)}, y ${formatNumber(r.y, locale, 0)})`),
      );
    case "pin":
      return t("pins", { count: s.total });
    case "guess":
      return join([
        t("guess.answerShort", { value: withUnit(formatNumber(s.answer, locale, s.decimals), s.unit) }),
        t("guess.meanShort", { value: withUnit(formatNumber(s.mean, locale, Math.max(s.decimals, 1)), s.unit) }),
        t("guess.hitShort", { rate: formatPercent(s.hitRate) }),
      ]);
    case "quizText": {
      const top = s.answers[0];
      return join([
        t("correctRate", { rate: formatPercent(s.correctRate) }),
        ...(top ? [t("mostCommon", { text: top.text })] : []),
      ]);
    }
  }
}
