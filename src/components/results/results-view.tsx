import type { PublicInteraction } from "@/lib/domain/interactions";
import { optionBars, ratingBars, ratingStats, wordList, type Bar, type ResultsSnapshot } from "@/lib/domain/results";
import { formatInt, formatPercent, formatScore, plural } from "@/lib/format";
import { cn } from "@/lib/utils";

type Variant = "compact" | "display";

function Bars({ bars, variant, highlightKey }: { bars: Bar[]; variant: Variant; highlightKey?: string | null }) {
  const big = variant === "display";
  const max = Math.max(...bars.map((b) => b.pct), 0);
  return (
    <ul className={cn("flex flex-col", big ? "gap-6" : "gap-3")}>
      {bars.map((bar) => {
        const leading = bar.pct > 0 && bar.pct === max;
        const correct = highlightKey === bar.key;
        return (
          <li key={bar.key} className="grid gap-1.5">
            <div className={cn("flex items-baseline justify-between gap-4", big ? "text-3xl" : "text-sm")}>
              <span className={cn("font-medium", correct && "text-emerald-600 dark:text-emerald-400")}>
                {bar.label}
                {correct ? " ✓" : ""}
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
                  correct ? "bg-emerald-500" : leading ? "bg-primary" : "bg-primary/50",
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

function WordCloud({ snapshot, variant }: { snapshot: ResultsSnapshot; variant: Variant }) {
  const words = wordList(snapshot, variant === "display" ? 40 : 30);
  if (words.length === 0) return <Waiting variant={variant} />;
  const max = words[0]?.count ?? 1;
  const [minSize, maxSize] = variant === "display" ? ([22, 88] as const) : ([13, 36] as const);
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 py-2">
      {words.map(({ word, count }) => {
        const weight = max > 1 ? (count - 1) / (max - 1) : 1;
        return (
          <span
            key={word}
            title={`${word}: ${count}`}
            className={cn("leading-tight", weight > 0.66 ? "font-bold text-primary" : weight > 0.33 ? "font-semibold" : "text-muted-foreground")}
            style={{ fontSize: `${Math.round(minSize + weight * (maxSize - minSize))}px` }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
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
      return <Bars bars={optionBars(interaction.options, snapshot)} variant={variant} highlightKey={correctOptionId} />;
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
      return <WordCloud snapshot={snapshot} variant={variant} />;
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
