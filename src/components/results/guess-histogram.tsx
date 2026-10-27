"use client";

import { useLocale, useTranslations } from "next-intl";
import * as m from "motion/react-m";
import type { NormalizedSettings } from "@/lib/domain/interactions";
import { guessStats, type ResultsSnapshot } from "@/lib/domain/results";
import { axisPosition } from "@/lib/domain/result-display";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/motion/animated";
import { SPRING, STAGGER_S } from "@/components/motion/presets";

// "Adivinhe o número": histograma dos palpites, a média (linha tracejada) e, depois de "Revelar resposta",
// o número certo (linha cheia em primary, com ✓). A coluna do número certo também muda de cor.

type Variant = "compact" | "display";

function formatter(locale: string, decimals: number) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: decimals });
}

export function GuessHistogram({
  settings,
  snapshot,
  variant,
  answer = null,
  animated = false,
}: {
  settings: Pick<NormalizedSettings, "numMin" | "numMax" | "decimals" | "unit">;
  snapshot: ResultsSnapshot;
  variant: Variant;
  /** número certo, só depois de revelar */
  answer?: number | null;
  animated?: boolean;
}) {
  const t = useTranslations("results");
  const locale = useLocale();
  const big = variant === "display";
  const stats = guessStats(settings, snapshot);
  const exact = formatter(locale, settings.decimals);
  const meanFormat = formatter(locale, Math.max(1, settings.decimals));
  const withUnit = (text: string) => (settings.unit ? `${text} ${settings.unit}` : text);
  const fmt = (value: number) => withUnit(exact.format(value));
  const answerAt = answer !== null ? axisPosition(answer, settings) : null;
  const meanAt = stats.mean !== null ? axisPosition(stats.mean, settings) : null;
  const answerBucket =
    answer !== null
      ? stats.buckets.findIndex((b, i) => answer >= b.from && (answer < b.to || i === stats.buckets.length - 1))
      : -1;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => settings.numMin + (settings.numMax - settings.numMin) * f);

  return (
    <div className={cn("grid w-full min-w-0", big ? "gap-6" : "gap-3")}>
      {/* Números principais: média e (revelado) a resposta. */}
      <div className={cn("flex flex-wrap items-end justify-center", big ? "gap-x-16 gap-y-3" : "justify-between gap-x-6 gap-y-1")}>
        <p className="grid">
          <span className={cn("text-muted-foreground", big ? "text-2xl max-md:text-base" : "text-xs")}>{t("guess.mean")}</span>
          <span className={cn("font-display font-bold tabular-nums", big ? "text-6xl max-md:text-4xl" : "text-2xl")}>
            {stats.mean === null ? (
              "—"
            ) : animated ? (
              <>
                <AnimatedNumber value={stats.mean} format="score" locale={locale} />
                {settings.unit ? ` ${settings.unit}` : null}
              </>
            ) : (
              withUnit(meanFormat.format(stats.mean))
            )}
          </span>
        </p>
        {answer !== null ? (
          <m.p
            className="grid text-primary"
            initial={animated ? { opacity: 0, scale: 0.6 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={SPRING.snappy}
          >
            <span className={cn(big ? "text-2xl max-md:text-base" : "text-xs")}>{t("guess.answer")}</span>
            <span className={cn("font-display font-bold tabular-nums", big ? "text-6xl max-md:text-4xl" : "text-2xl")}>
              {fmt(answer)} ✓
            </span>
          </m.p>
        ) : null}
        <p className={cn("text-muted-foreground tabular-nums", big ? "text-2xl max-md:text-base" : "text-xs")}>
          {t("guess.count", { count: stats.total })}
        </p>
      </div>

      <div
        role="img"
        aria-label={t("guess.chart", { from: fmt(settings.numMin), to: fmt(settings.numMax) })}
        className={cn("relative w-full border-b border-foreground/30", big ? "h-[34vh] max-md:h-48" : "h-32")}
      >
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {stats.buckets.map((bucket, index) => {
            const height = stats.maxCount > 0 ? (bucket.count / stats.maxCount) * 100 : 0;
            const correct = index === answerBucket;
            const fill = correct ? "bg-primary" : "bg-foreground/35";
            return (
              <div key={bucket.index} className="relative flex h-full min-w-0 flex-1 items-end">
                <span className="sr-only">
                  {t("guess.bucket", { from: fmt(bucket.from), to: fmt(bucket.to), count: bucket.count })}
                </span>
                {animated ? (
                  <m.div
                    aria-hidden
                    className={cn("w-full rounded-t-sm transition-colors duration-500", fill)}
                    initial={{ height: "0%" }}
                    animate={{ height: `${height}%` }}
                    transition={{ ...SPRING.bar, delay: index * (STAGGER_S / 3) }}
                  />
                ) : (
                  <div aria-hidden className={cn("w-full rounded-t-sm", fill)} style={{ height: `${height}%` }} />
                )}
              </div>
            );
          })}
        </div>
        {meanAt !== null ? (
          <Marker at={meanAt} animated={animated} className="border-l-2 border-dashed border-foreground/70" />
        ) : null}
        {answerAt !== null ? <Marker at={answerAt} animated={animated} className="border-l-4 border-primary" /> : null}
      </div>

      <div className={cn("relative h-6 text-muted-foreground tabular-nums", big ? "h-9 text-xl max-md:text-xs" : "text-[11px]")}>
        {ticks.map((value, index) => (
          <span
            key={index}
            className={cn(
              "absolute top-0 whitespace-nowrap",
              index === 0 ? "left-0" : index === ticks.length - 1 ? "right-0" : "-translate-x-1/2",
              // No celular, só as pontas e o meio (os outros rótulos se encostariam).
              (index === 1 || index === 3) && "max-md:hidden",
            )}
            style={index === 0 || index === ticks.length - 1 ? undefined : { left: `${index * 25}%` }}
          >
            {fmt(value)}
          </span>
        ))}
      </div>
    </div>
  );
}

function Marker({ at, animated, className }: { at: number; animated: boolean; className: string }) {
  const left = `${at * 100}%`;
  if (!animated) return <span aria-hidden className={cn("absolute -top-2 bottom-0", className)} style={{ left }} />;
  return (
    <m.span
      aria-hidden
      className={cn("absolute -top-2 bottom-0", className)}
      initial={{ left, opacity: 0 }}
      animate={{ left, opacity: 1 }}
      transition={SPRING.soft}
    />
  );
}
