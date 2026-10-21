import { useLocale, useTranslations } from "next-intl";
import type { PublicInteraction } from "@/lib/domain/interactions";
import { optionBars, ratingBars, ratingStats, wordList, type Bar, type ResultsSnapshot } from "@/lib/domain/results";
import { formatInt, formatPercent, formatScore } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ShapeGlyph, shapeBg, shapeText } from "@/components/option-shape";
import { optionImageSrc } from "@/lib/option-images/url";
import { WordCloud } from "./word-cloud";
import { rankingResults } from "@/lib/domain/ranking";
import { AnimatedBarFill, AnimatedItem, AnimatedList, AnimatedNumber } from "@/components/motion/animated";
import { STAGGER_S } from "@/components/motion/presets";

// Sem "use client": roda no telão e na sala ao vivo (cliente, idioma da sessão via SessionIntl) e na análise
// (Server Component, idioma do painel). Só useTranslations/useLocale, nunca idioma fixo.
// `animated` (telão e sala ao vivo): barras crescem com mola, números contam e listas reordenam deslizando.
// Sem ele (análise, relatório), tudo estático. O Motion fica nos componentes de `components/motion/animated`.

type Variant = "compact" | "display";

/** Forma (posição) e imagem de cada alternativa, pela chave da barra (id da opção). */
type Decor = { index: number; imagePath: string | null };

function Bars({
  bars,
  variant,
  highlightKey,
  decor,
  shapes = false,
  animated = false,
}: {
  bars: Bar[];
  variant: Variant;
  highlightKey?: string | null;
  decor?: Map<string, Decor>;
  shapes?: boolean;
  animated?: boolean;
}) {
  const locale = useLocale();
  const big = variant === "display";
  const max = Math.max(...bars.map((b) => b.pct), 0);
  return (
    <ul className={cn("flex flex-col", big ? "gap-6" : "gap-3")}>
      {bars.map((bar, index) => {
        const leading = bar.pct > 0 && bar.pct === max;
        const correct = highlightKey === bar.key;
        const d = decor?.get(bar.key);
        const revealed = highlightKey !== undefined && highlightKey !== null;
        const fill =
          shapes && d ? shapeBg(d.index) : correct ? "bg-primary" : leading ? "bg-foreground" : "bg-foreground/35";
        return (
          <li
            key={bar.key}
            className={cn("grid gap-1.5 transition-opacity duration-500", revealed && !correct && shapes && "opacity-50")}
          >
            <div className={cn("flex items-center justify-between gap-4", big ? "text-3xl" : "text-sm")}>
              <span className={cn("flex min-w-0 items-center font-medium", big ? "gap-4" : "gap-2", correct && "text-primary")}>
                {shapes && d ? <ShapeGlyph index={d.index} className={cn(shapeText(d.index), big ? "size-9" : "size-4")} /> : null}
                {d?.imagePath ? (
                  // eslint-disable-next-line @next/next/no-img-element -- imagem pública do Storage
                  <img
                    src={optionImageSrc(d.imagePath)}
                    alt=""
                    className={cn("shrink-0 rounded-md border bg-muted object-cover", big ? "size-20" : "size-8")}
                  />
                ) : null}
                <span className="min-w-0">
                  {bar.label}
                  {correct ? " ✓" : ""}
                </span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {animated ? <AnimatedNumber value={bar.pct} from={0} format="percent" locale={locale} /> : formatPercent(bar.pct)}
                {big ? null : <span className="ml-2 text-xs">({formatInt(bar.count, locale)})</span>}
              </span>
            </div>
            <div className={cn("w-full overflow-hidden rounded-full bg-muted", big ? "h-6" : "h-2.5")}>
              {animated ? (
                <AnimatedBarFill pct={bar.pct} delay={index * STAGGER_S} className={cn("transition-colors duration-500", fill)} />
              ) : (
                <div className={cn("h-full rounded-full", fill)} style={{ width: `${Math.round(bar.pct * 100)}%` }} />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function WordCloudResults({ snapshot, variant }: { snapshot: ResultsSnapshot; variant: Variant }) {
  const words = wordList(snapshot, variant === "display" ? 40 : 30);
  if (words.length === 0) return <Waiting variant={variant} />;
  return <WordCloud words={words} variant={variant} />;
}

function OpenTexts({ snapshot, variant, animated }: { snapshot: ResultsSnapshot; variant: Variant; animated: boolean }) {
  if (snapshot.recent.length === 0) return <Waiting variant={variant} />;
  const items = snapshot.recent.slice(0, variant === "display" ? 8 : 50);
  const listClass = cn("grid gap-2", variant === "display" && "gap-4 md:grid-cols-2");
  const itemClass = cn("rounded-lg border bg-background px-3 py-2", variant === "display" ? "text-2xl" : "text-sm");
  // Resposta nova entra no topo e empurra as outras.
  if (animated) {
    return (
      <AnimatedList className={listClass}>
        {items.map((entry) => (
          <AnimatedItem key={entry.id} className={itemClass}>
            {entry.text}
          </AnimatedItem>
        ))}
      </AnimatedList>
    );
  }
  return (
    <ul className={listClass}>
      {items.map((entry) => (
        <li key={entry.id} className={itemClass}>
          {entry.text}
        </li>
      ))}
    </ul>
  );
}

/** Ranking: alternativas da preferida para a menos preferida, com a posição média. */
function RankingResults({
  interaction,
  snapshot,
  variant,
  animated,
}: {
  interaction: PublicInteraction;
  snapshot: ResultsSnapshot;
  variant: Variant;
  animated: boolean;
}) {
  const t = useTranslations("results");
  const locale = useLocale();
  if (snapshot.total === 0) return <Waiting variant={variant} />;
  const big = variant === "display";
  const rows = rankingResults(interaction.options, snapshot);
  // Animado, a alternativa que muda de posição desliza até o novo lugar.
  const List = animated ? AnimatedList : "ol";
  const Item = animated ? AnimatedItem : "li";
  return (
    <List {...(animated ? { as: "ol" as const } : {})} className={cn("flex flex-col", big ? "gap-5" : "gap-3")}>
      {rows.map((row, index) => (
        <Item key={row.key} className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5">
          <span
            className={cn(
              "row-span-2 grid place-items-center rounded-full font-display font-bold tabular-nums",
              big ? "size-16 text-3xl" : "size-8 text-sm",
              index === 0 ? "bg-primary text-primary-foreground" : "bg-muted",
            )}
          >
            {t("position", { position: index + 1 })}
          </span>
          <div className={cn("flex items-baseline justify-between gap-4", big ? "text-3xl" : "text-sm")}>
            <span className="min-w-0 font-medium">{row.label}</span>
            <span className={cn("shrink-0 tabular-nums text-muted-foreground", big ? "text-2xl" : "text-xs")}>
              {t("averagePosition", { value: formatScore(row.averagePosition, locale) })}
            </span>
          </div>
          <div className={cn("w-full overflow-hidden rounded-full bg-muted", big ? "h-5" : "h-2")}>
            {animated ? (
              <AnimatedBarFill pct={row.share} className={index === 0 ? "bg-primary" : "bg-foreground/35"} />
            ) : (
              <div
                className={cn("h-full rounded-full", index === 0 ? "bg-primary" : "bg-foreground/35")}
                style={{ width: `${Math.round(row.share * 100)}%` }}
              />
            )}
          </div>
        </Item>
      ))}
    </List>
  );
}

function Waiting({ variant }: { variant: Variant }) {
  const t = useTranslations("results");
  return (
    <p className={cn("py-6 text-center text-muted-foreground", variant === "display" ? "text-3xl" : "text-sm")}>
      {t("waiting")}
    </p>
  );
}

export function ResultsView({
  interaction,
  snapshot,
  variant = "compact",
  correctOptionId,
  hideOpenText = false,
  animated = false,
}: {
  interaction: PublicInteraction;
  snapshot: ResultsSnapshot;
  variant?: Variant;
  correctOptionId?: string | null;
  hideOpenText?: boolean;
  /** telão e sala ao vivo; só dentro de componente cliente com MotionProvider */
  animated?: boolean;
}) {
  const t = useTranslations("results");
  const locale = useLocale();
  const { settings } = interaction;

  switch (interaction.type) {
    case "multiple_choice":
    case "quiz":
      return (
        <Bars
          bars={optionBars(interaction.options, snapshot)}
          variant={variant}
          highlightKey={correctOptionId}
          shapes={settings.optionStyle === "shapes"}
          animated={animated}
          decor={new Map(interaction.options.map((o, index) => [o.id, { index, imagePath: o.imagePath }]))}
        />
      );
    case "rating": {
      const stats = ratingStats(settings.min, settings.max, snapshot);
      return (
        <div className="grid gap-4">
          <p className={cn("font-semibold tabular-nums", variant === "display" ? "text-center text-7xl" : "text-3xl")}>
            {animated && stats.mean !== null ? (
              <AnimatedNumber value={stats.mean} from={0} format="score" locale={locale} />
            ) : (
              formatScore(stats.mean, locale)
            )}
            <span className={cn("ml-2 font-normal text-muted-foreground", variant === "display" ? "text-3xl" : "text-base")}>
              {t("mean", { count: stats.total })}
            </span>
          </p>
          <Bars bars={ratingBars(settings.min, settings.max, snapshot)} variant={variant} animated={animated} />
          {settings.minLabel || settings.maxLabel ? (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{settings.minLabel ? `${settings.min} = ${settings.minLabel}` : ""}</span>
              <span>{settings.maxLabel ? `${settings.max} = ${settings.maxLabel}` : ""}</span>
            </div>
          ) : null}
        </div>
      );
    }
    case "word_cloud":
      return <WordCloudResults snapshot={snapshot} variant={variant} />;
    case "open_text":
      if (hideOpenText) {
        return (
          <p className="py-6 text-center text-3xl text-muted-foreground">
            {t("received", { count: snapshot.total })}
          </p>
        );
      }
      return <OpenTexts snapshot={snapshot} variant={variant} animated={animated} />;
    case "ranking":
      return <RankingResults interaction={interaction} snapshot={snapshot} variant={variant} animated={animated} />;
  }
}
