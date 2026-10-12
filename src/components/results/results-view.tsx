import type { PublicInteraction } from "@/lib/domain/interactions";
import { optionBars, ratingBars, ratingStats, wordList, type Bar, type ResultsSnapshot } from "@/lib/domain/results";
import { formatInt, formatPercent, formatScore, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ShapeGlyph, shapeBg, shapeText } from "@/components/option-shape";
import { optionImageSrc } from "@/lib/option-images/url";
import { WordCloud } from "./word-cloud";

type Variant = "compact" | "display";

/** Forma (posição) e imagem de cada alternativa, pela chave da barra (id da opção). */
type Decor = { index: number; imagePath: string | null };

function Bars({
  bars,
  variant,
  highlightKey,
  decor,
  shapes = false,
}: {
  bars: Bar[];
  variant: Variant;
  highlightKey?: string | null;
  decor?: Map<string, Decor>;
  shapes?: boolean;
}) {
  const big = variant === "display";
  const max = Math.max(...bars.map((b) => b.pct), 0);
  return (
    <ul className={cn("flex flex-col", big ? "gap-6" : "gap-3")}>
      {bars.map((bar) => {
        const leading = bar.pct > 0 && bar.pct === max;
        const correct = highlightKey === bar.key;
        const d = decor?.get(bar.key);
        const revealed = highlightKey !== undefined && highlightKey !== null;
        return (
          <li key={bar.key} className={cn("grid gap-1.5", revealed && !correct && shapes && "opacity-50")}>
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
                {formatPercent(bar.pct)}
                {big ? null : <span className="ml-2 text-xs">({formatInt(bar.count)})</span>}
              </span>
            </div>
            <div className={cn("w-full overflow-hidden rounded-full bg-muted", big ? "h-6" : "h-2.5")}>
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-700 ease-out",
                  shapes && d
                    ? shapeBg(d.index)
                    : correct
                      ? "bg-primary"
                      : leading
                        ? "bg-foreground"
                        : "bg-foreground/35",
                )}
                style={{ width: `${Math.round(bar.pct * 100)}%` }}
              />
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

function OpenTexts({ snapshot, variant }: { snapshot: ResultsSnapshot; variant: Variant }) {
  if (snapshot.recent.length === 0) return <Waiting variant={variant} />;
  const items = snapshot.recent.slice(0, variant === "display" ? 8 : 50);
  return (
    <ul className={cn("grid gap-2", variant === "display" && "gap-4 md:grid-cols-2")}>
      {items.map((entry) => (
        <li
          key={entry.id}
          className={cn("rounded-lg border bg-background px-3 py-2", variant === "display" ? "text-2xl" : "text-sm")}
        >
          {entry.text}
        </li>
      ))}
    </ul>
  );
}

function Waiting({ variant }: { variant: Variant }) {
  return (
    <p className={cn("py-6 text-center text-muted-foreground", variant === "display" ? "text-3xl" : "text-sm")}>
      Aguardando respostas…
    </p>
  );
}

export function ResultsView({
  interaction,
  snapshot,
  variant = "compact",
  correctOptionId,
  hideOpenText = false,
}: {
  interaction: PublicInteraction;
  snapshot: ResultsSnapshot;
  variant?: Variant;
  correctOptionId?: string | null;
  hideOpenText?: boolean;
}) {
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
          decor={new Map(interaction.options.map((o, index) => [o.id, { index, imagePath: o.imagePath }]))}
        />
      );
    case "rating": {
      const stats = ratingStats(settings.min, settings.max, snapshot);
      return (
        <div className="grid gap-4">
          <p className={cn("font-semibold tabular-nums", variant === "display" ? "text-center text-7xl" : "text-3xl")}>
            {formatScore(stats.mean)}
            <span className={cn("ml-2 font-normal text-muted-foreground", variant === "display" ? "text-3xl" : "text-base")}>
              média · {plural(stats.total, "resposta", "respostas")}
            </span>
          </p>
          <Bars bars={ratingBars(settings.min, settings.max, snapshot)} variant={variant} />
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
            {plural(snapshot.total, "resposta recebida", "respostas recebidas")}
          </p>
        );
      }
      return <OpenTexts snapshot={snapshot} variant={variant} />;
  }
}
