"use client";

import { useLocale, useTranslations } from "next-intl";
import * as m from "motion/react-m";
import type { PublicInteraction } from "@/lib/domain/interactions";
import { matrixPoints, type ResultsSnapshot } from "@/lib/domain/results";
import { formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ShapeGlyph, shapeText } from "@/components/option-shape";
import { SPRING } from "@/components/motion/presets";

// Matriz 2×2: cada item vira um ponto na posição média (0–100 nos dois eixos) com a forma e a cor da sua
// posição; a legenda repete forma, nome e coordenadas (a cor nunca vem sozinha). x = 100 fica à direita
// (xLow à esquerda, xHigh à direita) e y = 100 em cima (yLow embaixo, yHigh em cima), como no celular.
// Animado (telão e sala ao vivo), o ponto desliza com mola quando a média muda.

type Variant = "compact" | "display";

export function MatrixBoard({
  interaction,
  snapshot,
  variant,
  animated = false,
}: {
  interaction: Pick<PublicInteraction, "options" | "settings">;
  snapshot: ResultsSnapshot;
  variant: Variant;
  animated?: boolean;
}) {
  const t = useTranslations("results");
  const locale = useLocale();
  const big = variant === "display";
  const { settings } = interaction;
  const points = matrixPoints(interaction.options, snapshot);
  const xName = settings.xLabel ?? t("matrix.xAxis");
  const yName = settings.yLabel ?? t("matrix.yAxis");

  const board = (
    <div className={cn("grid grid-cols-[auto_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto]", big ? "gap-3" : "gap-1.5")}>
      {/* Eixo vertical: ponta alta em cima, nome no meio, ponta baixa embaixo. */}
      <div
        className={cn(
          "flex flex-col items-center justify-between text-muted-foreground",
          big ? "text-xl max-md:text-xs" : "text-[11px]",
        )}
      >
        <span className="max-w-[4.5rem] text-center leading-tight">{settings.yHigh}</span>
        <span className="font-semibold text-foreground [writing-mode:vertical-rl] rotate-180">{yName}</span>
        <span className="max-w-[4.5rem] text-center leading-tight">{settings.yLow}</span>
      </div>
      <div
        role="img"
        aria-label={t("matrix.label", { count: points.length })}
        className={cn(
          "relative aspect-square w-full rounded-2xl border bg-muted/40",
          big ? "max-h-[58vh] max-w-[58vh] max-md:max-h-none max-md:max-w-none" : "",
        )}
      >
        {/* Quadrantes */}
        <span aria-hidden className="absolute inset-y-0 left-1/2 border-l border-dashed border-foreground/25" />
        <span aria-hidden className="absolute inset-x-0 top-1/2 border-t border-dashed border-foreground/25" />
        {points.length === 0 ? (
          <p
            className={cn(
              "absolute inset-0 grid place-items-center p-4 text-center text-muted-foreground",
              big ? "text-2xl" : "text-sm",
            )}
          >
            {t("waiting")}
          </p>
        ) : null}
        {points.map((point) => {
          const position = { left: `${point.x}%`, top: `${100 - point.y}%` };
          const glyph = (
            <span className="relative block">
              <ShapeGlyph
                index={point.index}
                className={cn(
                  shapeText(point.index),
                  "drop-shadow-[0_0_2px_var(--background)]",
                  big ? "size-11 max-md:size-7" : "size-6",
                )}
              />
              {big ? (
                <span
                  className={cn(
                    "absolute top-1/2 max-w-[12rem] -translate-y-1/2 truncate rounded-md bg-background/85 px-2 py-0.5 text-xl font-medium max-md:hidden",
                    // Na metade direita, o nome vai para a esquerda do ponto (não sai do quadro).
                    point.x > 55 ? "right-full mr-2" : "left-full ml-2",
                  )}
                >
                  {point.label}
                </span>
              ) : null}
            </span>
          );
          return animated ? (
            <m.div
              key={point.key}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              initial={{ left: "50%", top: "50%", opacity: 0, scale: 0.4 }}
              animate={{ ...position, opacity: 1, scale: 1 }}
              transition={SPRING.soft}
            >
              {glyph}
            </m.div>
          ) : (
            <div key={point.key} className="absolute -translate-x-1/2 -translate-y-1/2" style={position}>
              {glyph}
            </div>
          );
        })}
      </div>
      <span aria-hidden />
      <div
        className={cn(
          "grid grid-cols-[1fr_auto_1fr] items-start gap-2 text-muted-foreground",
          big ? "text-xl max-md:text-xs" : "text-[11px]",
        )}
      >
        <span className="leading-tight">{settings.xLow}</span>
        <span className="font-semibold text-foreground">{xName}</span>
        <span className="text-right leading-tight">{settings.xHigh}</span>
      </div>
    </div>
  );

  // Legenda: todos os itens, na ordem do roteiro (os ainda sem posição aparecem esmaecidos).
  const byKey = new Map(points.map((p) => [p.key, p]));
  const legend = (
    <ul className={cn("grid content-start", big ? "gap-4 text-2xl max-md:gap-2 max-md:text-base" : "gap-2 text-sm")}>
      {interaction.options.map((option, index) => {
        const point = byKey.get(option.id);
        return (
          <li key={option.id} className={cn("grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3", !point && "opacity-50")}>
            <ShapeGlyph index={index} className={cn(shapeText(index), big ? "size-8 max-md:size-5" : "size-5")} />
            <span className="min-w-0 font-medium break-words">{option.label}</span>
            {point ? (
              <span className={cn("col-start-2 text-muted-foreground tabular-nums", big ? "text-lg max-md:text-xs" : "text-xs")}>
                {t("matrix.coords", {
                  xName,
                  yName,
                  x: formatInt(Math.round(point.x), locale),
                  y: formatInt(Math.round(point.y), locale),
                })}
                {" · "}
                {t("matrix.people", { count: point.count })}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div
      className={cn(
        "grid w-full min-w-0",
        big ? "items-center gap-10 md:grid-cols-[minmax(0,auto)_minmax(16rem,1fr)] max-md:gap-6" : "gap-4",
      )}
    >
      <div className={cn("w-full min-w-0", big ? "md:w-[min(64vh,42rem)]" : "mx-auto max-w-sm")}>{board}</div>
      {legend}
    </div>
  );
}
