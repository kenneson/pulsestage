import { useTranslations } from "next-intl";
import { pinHeat, type ResultsSnapshot } from "@/lib/domain/results";
import { pinHotRegion } from "@/lib/domain/result-display";
import { optionImageSrc } from "@/lib/option-images/url";
import { cn } from "@/lib/utils";

// "Marcar na imagem": a imagem com o mapa de calor das marcações. Rampa sequencial (estilo "plasma") do azul
// (poucas) passando por magenta e laranja até o amarelo (muitas), dos tokens chart-1 e highlight (fora da cor
// da marca, que muda o primary): a claridade sobe junto, então continua legível para daltonismo, e a
// intensidade também cresce em opacidade e tamanho. A legenda diz em palavras qual área foi mais marcada.
// Coordenadas: x, y de 0 a 1 a partir do canto superior esquerdo (gy conta de cima para baixo).

type Variant = "compact" | "display";

/** Cor da intensidade (0–1) entre chart-1 e highlight, pelo caminho longo do matiz (azul → magenta → laranja → amarelo). */
function heatColor(intensity: number): string {
  return `color-mix(in oklch longer hue, var(--highlight) ${Math.round(intensity * 100)}%, var(--chart-1))`;
}

export function PinHeatmap({
  imagePath,
  snapshot,
  variant,
  animated = false,
}: {
  imagePath: string | null;
  snapshot: ResultsSnapshot;
  variant: Variant;
  animated?: boolean;
}) {
  const t = useTranslations("results.pin");
  const big = variant === "display";
  const heat = pinHeat(snapshot);
  const region = pinHotRegion(heat);
  const marks = heat.cells.reduce((acc, cell) => acc + cell.count, 0);
  const cellPct = 100 / heat.grid;

  return (
    <figure className={cn("grid justify-items-center", big ? "gap-5" : "gap-3")}>
      <div className="relative w-fit max-w-full overflow-hidden rounded-2xl border bg-muted">
        {imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagem pública do Storage
          <img
            src={optionImageSrc(imagePath)}
            alt={t("alt")}
            className={cn("block w-auto max-w-full brightness-[.82]", big ? "max-h-[56vh]" : "max-h-80")}
          />
        ) : (
          <div className={cn("aspect-[4/3]", big ? "h-[56vh]" : "h-56")} />
        )}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {heat.cells.map((cell) => {
            // Cada célula vira uma mancha radial maior que a célula; mais marcações = maior e mais opaca.
            const size = cellPct * (2.2 + cell.intensity * 1.6);
            return (
              <span
                key={`${cell.gx}:${cell.gy}`}
                className={cn(
                  "absolute aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full",
                  animated && "transition-[opacity,width,background] duration-700 ease-(--ease-out)",
                )}
                style={{
                  left: `${(cell.gx + 0.5) * cellPct}%`,
                  top: `${(cell.gy + 0.5) * cellPct}%`,
                  width: `${size}%`,
                  opacity: 0.55 + cell.intensity * 0.45,
                  background: `radial-gradient(closest-side, ${heatColor(cell.intensity)} 0%, ${heatColor(cell.intensity)} 35%, transparent 100%)`,
                }}
              />
            );
          })}
        </div>
      </div>
      <figcaption
        className={cn(
          "flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-muted-foreground",
          big ? "text-2xl max-md:text-base" : "text-xs",
        )}
      >
        <span className="tabular-nums">{t("count", { count: marks })}</span>
        {region ? <span className="font-medium text-foreground">{t("hot", { region: t(`regions.${region}`) })}</span> : null}
        <span className="flex items-center gap-2" aria-hidden>
          {t("less")}
          <span
            className={cn("rounded-full", big ? "h-3 w-40" : "h-2 w-20")}
            style={{ background: `linear-gradient(to right in oklch longer hue, ${heatColor(0)}, ${heatColor(1)})` }}
          />
          {t("more")}
        </span>
      </figcaption>
    </figure>
  );
}
