import { useLocale, useTranslations } from "next-intl";
import { acceptsResponses, type PublicInteraction } from "@/lib/domain/interactions";
import {
  choiceBars,
  optionBars,
  pointsBars,
  ratingBars,
  ratingStats,
  textAnswerBars,
  wordList,
  type Bar,
  type ResultsSnapshot,
} from "@/lib/domain/results";
import { isRevealedText, revealedOptionId, textCorrectShare, type RevealedAnswer } from "@/lib/domain/answer-reveal";
import { formatInt, formatPercent, formatScore } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ShapeGlyph, shapeBg, shapeText } from "@/components/option-shape";
import { optionImageSrc } from "@/lib/option-images/url";
import { WordCloud } from "./word-cloud";
import { rankingResults } from "@/lib/domain/ranking";
import { AnimatedBarFill, AnimatedItem, AnimatedList, AnimatedNumber } from "@/components/motion/animated";
import { STAGGER_S } from "@/components/motion/presets";
import { MatrixBoard } from "./matrix-board";
import { GuessHistogram } from "./guess-histogram";
import { PinHeatmap } from "./pin-heatmap";
import { ContentSlide } from "./content-slide";

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
  isCorrect,
  decor,
  shapes = false,
  animated = false,
}: {
  bars: Bar[];
  variant: Variant;
  highlightKey?: string | null;
  /** várias certas (quiz de digitar): decide por barra */
  isCorrect?: (key: string) => boolean;
  decor?: Map<string, Decor>;
  shapes?: boolean;
  animated?: boolean;
}) {
  const locale = useLocale();
  const big = variant === "display";
  const max = Math.max(...bars.map((b) => b.pct), 0);
  return (
    <ul className={cn("flex flex-col", big ? "gap-6 [@media(max-height:800px)]:gap-3" : "gap-3")}>
      {bars.map((bar, index) => {
        const leading = bar.pct > 0 && bar.pct === max;
        const correct = isCorrect ? isCorrect(bar.key) : highlightKey === bar.key;
        const d = decor?.get(bar.key);
        const revealed = Boolean(isCorrect) || (highlightKey !== undefined && highlightKey !== null);
        const fill =
          shapes && d ? shapeBg(d.index) : correct ? "bg-primary" : leading ? "bg-foreground" : "bg-foreground/35";
        return (
          <li
            key={bar.key}
            className={cn("grid gap-1.5 transition-opacity duration-500", revealed && !correct && shapes && "opacity-50")}
          >
            <div className={cn("flex items-center justify-between gap-4", big ? "text-3xl max-md:text-lg md:[@media(max-height:800px)]:text-2xl" : "text-sm")}>
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
            <div className={cn("w-full overflow-hidden rounded-full bg-muted", big ? "h-6 [@media(max-height:800px)]:h-4" : "h-2.5")}>
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
          {/* Celular: a posição média desce para baixo do nome (ao lado, apertava o nome e o fazia quebrar). */}
          <div
            className={cn(
              "flex items-baseline justify-between gap-4 max-md:flex-col max-md:items-start max-md:gap-0.5",
              big ? "text-3xl" : "text-sm",
            )}
          >
            <span className="min-w-0 font-medium max-md:break-words">{row.label}</span>
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
    <p className={cn("py-6 text-center text-muted-foreground", variant === "display" ? "text-3xl max-md:text-xl" : "text-sm")}>
      {t("waiting")}
    </p>
  );
}

/** "Esconder resultados": só o total, até o palestrante revelar. */
function HiddenResults({ snapshot, variant, animated }: { snapshot: ResultsSnapshot; variant: Variant; animated: boolean }) {
  const t = useTranslations("results.hidden");
  const locale = useLocale();
  const big = variant === "display";
  return (
    <div className={cn("grid justify-items-center text-center", big ? "gap-3 py-6" : "gap-1 py-4")}>
      <p className={cn("font-display font-bold tabular-nums", big ? "text-9xl max-md:text-7xl" : "text-5xl")}>
        {animated ? <AnimatedNumber value={snapshot.total} locale={locale} /> : formatInt(snapshot.total, locale)}
      </p>
      <p className={cn("text-muted-foreground", big ? "text-3xl max-md:text-xl" : "text-sm")}>
        {t("responses", { count: snapshot.total })}
      </p>
      <p
        className={cn(
          "mt-2 rounded-full bg-standby/15 font-semibold text-standby",
          big ? "px-6 py-2 text-2xl max-md:text-base" : "px-3 py-1 text-xs",
        )}
      >
        {t("title")}
      </p>
    </div>
  );
}

/** 100 pontos: média de pontos por pessoa em cada alternativa, da maior para a menor (reordena deslizando). */
function PointsResults({ interaction, snapshot, variant, animated }: { interaction: PublicInteraction; snapshot: ResultsSnapshot; variant: Variant; animated: boolean }) {
  const t = useTranslations("results.points");
  const locale = useLocale();
  if (snapshot.total === 0) return <Waiting variant={variant} />;
  const big = variant === "display";
  const bars = pointsBars(interaction.options, snapshot);
  const List = animated ? AnimatedList : "ul";
  const Item = animated ? AnimatedItem : "li";
  return (
    <div className={cn("grid", big ? "gap-6 [@media(max-height:800px)]:gap-3" : "gap-3")}>
      <p className={cn("text-muted-foreground", big ? "text-center text-2xl max-md:text-base" : "text-xs")}>
        {t("caption", { count: snapshot.total })}
      </p>
      <List className={cn("flex flex-col", big ? "gap-6 [@media(max-height:800px)]:gap-3" : "gap-3")}>
        {bars.map((bar, index) => {
          const fill = index === 0 ? "bg-foreground" : "bg-foreground/35";
          return (
            <Item key={bar.key} className="grid gap-1.5">
              <div className={cn("flex items-baseline justify-between gap-4", big ? "text-3xl max-md:text-lg" : "text-sm")}>
                <span className="min-w-0 font-medium break-words">{bar.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {animated ? <AnimatedNumber value={bar.average} from={0} format="score" locale={locale} /> : formatScore(bar.average, locale)}
                  <span className={cn("ml-1", big ? "text-xl max-md:text-sm" : "text-xs")}>{t("unit")}</span>
                </span>
              </div>
              <div className={cn("w-full overflow-hidden rounded-full bg-muted", big ? "h-6 max-md:h-3" : "h-2.5")}>
                {animated ? (
                  <AnimatedBarFill pct={bar.pct} delay={index * STAGGER_S} className={fill} />
                ) : (
                  <div className={cn("h-full rounded-full", fill)} style={{ width: `${Math.round(bar.pct * 100)}%` }} />
                )}
              </div>
            </Item>
          );
        })}
      </List>
    </div>
  );
}

/** Colunas da grade de imagens pelo número de alternativas (2–8), para caber numa tela de projetor. */
function gridColumns(count: number, big: boolean): string {
  if (!big) return count <= 4 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3";
  if (count <= 3) return count === 2 ? "md:grid-cols-2" : "md:grid-cols-3";
  if (count === 4) return "md:grid-cols-4";
  return count <= 6 ? "md:grid-cols-3" : "md:grid-cols-4";
}

/** Enquete ou quiz no estilo grade de imagens: a imagem é a alternativa; a barra fica embaixo. */
function ImageGrid({
  interaction,
  bars,
  variant,
  correctKey,
  animated,
}: {
  interaction: PublicInteraction;
  bars: Bar[];
  variant: Variant;
  correctKey: string | null;
  animated: boolean;
}) {
  const locale = useLocale();
  const big = variant === "display";
  const max = Math.max(...bars.map((b) => b.pct), 0);
  const rows = Math.ceil(bars.length / (bars.length <= 3 ? bars.length : bars.length === 4 || bars.length > 6 ? 4 : 3));
  const images = new Map(interaction.options.map((o) => [o.id, o.imagePath]));
  return (
    <ul className={cn("grid", big ? "gap-6 max-md:grid-cols-2 max-md:gap-3" : "gap-3", gridColumns(bars.length, big))}>
      {bars.map((bar, index) => {
        const image = images.get(bar.key) ?? null;
        const correct = correctKey === bar.key;
        const leading = bar.pct > 0 && bar.pct === max;
        const fill = correct ? "bg-primary" : leading ? "bg-foreground" : "bg-foreground/35";
        return (
          <li
            key={bar.key}
            className={cn(
              "relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card transition-opacity duration-500",
              correct && "border-primary ring-2 ring-primary",
              correctKey !== null && !correct && "opacity-50",
            )}
          >
            <div className={cn("relative w-full bg-muted", big ? (rows > 1 ? "h-[22vh]" : "h-[38vh]") + " max-md:h-32" : "aspect-[4/3]")}>
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element -- imagem pública do Storage
                <img src={optionImageSrc(image)} alt={bar.label} className="absolute inset-0 size-full object-cover" />
              ) : null}
              {correct ? (
                <span
                  className={cn(
                    "absolute top-2 right-2 grid place-items-center rounded-full bg-primary font-bold text-primary-foreground",
                    big ? "size-12 text-2xl" : "size-7 text-sm",
                  )}
                  aria-hidden
                >
                  ✓
                </span>
              ) : null}
            </div>
            <div className={cn("grid", big ? "gap-2 p-4 max-md:p-2" : "gap-1.5 p-2.5")}>
              <div className={cn("flex items-baseline justify-between gap-3", big ? "text-2xl max-md:text-sm" : "text-xs")}>
                <span className={cn("min-w-0 truncate font-medium", correct && "text-primary")}>{bar.label}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {animated ? <AnimatedNumber value={bar.pct} from={0} format="percent" locale={locale} /> : formatPercent(bar.pct)}
                </span>
              </div>
              <div className={cn("w-full overflow-hidden rounded-full bg-muted", big ? "h-4 max-md:h-2" : "h-2")}>
                {animated ? (
                  <AnimatedBarFill pct={bar.pct} delay={index * STAGGER_S} className={cn("transition-colors duration-500", fill)} />
                ) : (
                  <div className={cn("h-full rounded-full", fill)} style={{ width: `${Math.round(bar.pct * 100)}%` }} />
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Quiz de digitar: antes de revelar, só quantas pessoas responderam; depois, as respostas mais frequentes. */
function QuizTextResults({
  snapshot,
  variant,
  revealed,
  answer,
  animated,
}: {
  snapshot: ResultsSnapshot;
  variant: Variant;
  revealed: boolean;
  answer: RevealedAnswer | null;
  animated: boolean;
}) {
  const t = useTranslations("results.quizText");
  const locale = useLocale();
  const big = variant === "display";
  if (!revealed) {
    return (
      <div className={cn("grid justify-items-center text-center", big ? "gap-3 py-6" : "gap-1 py-4")}>
        <p className={cn("font-display font-bold tabular-nums", big ? "text-9xl max-md:text-7xl" : "text-5xl")}>
          {animated ? <AnimatedNumber value={snapshot.total} locale={locale} /> : formatInt(snapshot.total, locale)}
        </p>
        <p className={cn("text-muted-foreground", big ? "text-3xl max-md:text-xl" : "text-sm")}>
          {t("answered", { count: snapshot.total })}
        </p>
        <p className={cn("text-muted-foreground", big ? "mt-4 text-2xl max-md:text-base" : "text-xs")}>{t("hint")}</p>
      </div>
    );
  }
  // No telão, as 5 mais frequentes (cabe numa tela de 720 px com o título e o cronômetro).
  const bars = textAnswerBars(snapshot, big ? 5 : 8);
  const share = textCorrectShare(snapshot.counts, snapshot.total, answer);
  const accepted = answer?.kind === "text" ? answer.accepted : null;
  return (
    <div className={cn("grid", big ? "gap-8 max-md:gap-4 [@media(max-height:800px)]:gap-4" : "gap-3")}>
      {accepted ? (
        <div className={cn("grid justify-items-center text-center", big ? "gap-2" : "gap-0.5")}>
          <p className={cn("font-semibold text-primary", big ? "text-4xl max-md:text-2xl" : "text-base")}>
            {t("accepted", { answers: accepted.join(" / ") })} ✓
          </p>
          {share !== null ? (
            <p className={cn("text-muted-foreground", big ? "text-2xl max-md:text-base" : "text-xs")}>
              {t("share", { rate: formatPercent(share) })}
            </p>
          ) : null}
        </div>
      ) : null}
      {bars.length === 0 ? (
        <Waiting variant={variant} />
      ) : (
        <Bars
          bars={bars}
          variant={variant}
          animated={animated}
          isCorrect={answer ? (key) => isRevealedText(key, answer) : undefined}
        />
      )}
    </div>
  );
}

export function ResultsView({
  interaction,
  snapshot,
  variant = "compact",
  correctOptionId,
  hideOpenText = false,
  animated = false,
  hidden = false,
  revealed,
  answer = null,
}: {
  interaction: PublicInteraction;
  snapshot: ResultsSnapshot;
  variant?: Variant;
  /** alternativa certa do quiz (sala ao vivo e análise); `answer` tem prioridade */
  correctOptionId?: string | null;
  hideOpenText?: boolean;
  /** telão e sala ao vivo; só dentro de componente cliente com MotionProvider */
  animated?: boolean;
  /** "Esconder resultados" ainda não revelados: só o total e "Resultados em breve" */
  hidden?: boolean;
  /**
   * quiz de digitar: false = só quantas pessoas responderam (telão antes de "Revelar resposta").
   * Sem valor (sala ao vivo, análise), mostra as respostas.
   */
  revealed?: boolean;
  /** resposta revelada (GET /api/session/[id]/answer, ou o gabarito na sala ao vivo e na análise) */
  answer?: RevealedAnswer | null;
}) {
  const t = useTranslations("results");
  const locale = useLocale();
  const { settings } = interaction;

  if (hidden && acceptsResponses(interaction.type)) {
    return <HiddenResults snapshot={snapshot} variant={variant} animated={animated} />;
  }

  switch (interaction.type) {
    case "multiple_choice":
    case "quiz": {
      const correct = revealedOptionId(answer) ?? correctOptionId ?? null;
      const multi = interaction.type === "multiple_choice" && settings.maxChoices > 1;
      const bars = multi ? choiceBars(interaction.options, snapshot) : optionBars(interaction.options, snapshot);
      const chart =
        settings.optionStyle === "images" ? (
          <ImageGrid interaction={interaction} bars={bars} variant={variant} correctKey={correct} animated={animated} />
        ) : (
          <Bars
            bars={bars}
            variant={variant}
            highlightKey={correct}
            shapes={settings.optionStyle === "shapes"}
            animated={animated}
            decor={new Map(interaction.options.map((o, index) => [o.id, { index, imagePath: o.imagePath }]))}
          />
        );
      if (!multi) return chart;
      return (
        <div className={cn("grid", variant === "display" ? "gap-6" : "gap-3")}>
          {chart}
          <p className={cn("text-muted-foreground", variant === "display" ? "text-center text-2xl max-md:text-sm" : "text-xs")}>
            {t("multiNote", { max: settings.maxChoices })}
          </p>
        </div>
      );
    }
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
    case "points_100":
      return <PointsResults interaction={interaction} snapshot={snapshot} variant={variant} animated={animated} />;
    case "matrix_2x2":
      return <MatrixBoard interaction={interaction} snapshot={snapshot} variant={variant} animated={animated} />;
    case "pin_image":
      return <PinHeatmap imagePath={settings.imagePath} snapshot={snapshot} variant={variant} animated={animated} />;
    case "guess_number":
      return (
        <GuessHistogram
          settings={settings}
          snapshot={snapshot}
          variant={variant}
          answer={answer?.kind === "number" ? answer.value : null}
          animated={animated}
        />
      );
    case "quiz_text":
      return (
        <QuizTextResults
          snapshot={snapshot}
          variant={variant}
          revealed={revealed ?? true}
          answer={answer}
          animated={animated}
        />
      );
    case "content":
      return <ContentSlide interaction={interaction} variant={variant} />;
  }
}
