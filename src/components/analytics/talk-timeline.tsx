"use client";

import { useState } from "react";
import { scaleLinear } from "d3-scale";
import type { Segment, SegmentKind, Timeline } from "@/lib/domain/timeline";
import { formatClock, formatSpan } from "@/lib/domain/timing";
import { cn } from "@/lib/utils";

// Linha do tempo da palestra: uma faixa com o que esteve no telão a cada momento.
// Cor por identidade (slides × perguntas, par validado para daltonismo); QR Code em neutro; pausa só com contorno.
// Mede ritmo (onde o tempo foi), não atenção.

export type TimelineInteractionMeta = { number: number; title: string; typeLabel: string };

const KIND_LABEL: Record<SegmentKind, string> = {
  slide: "Slides",
  interaction: "Perguntas",
  ranking: "Ranking do quiz",
  join: "QR Code / abertura",
  pause: "Pausa",
};

const KIND_STYLE: Record<SegmentKind, string> = {
  slide: "bg-timeline-slide",
  interaction: "bg-timeline-question",
  // Mesma família das perguntas (o ranking faz parte do quiz), mais clara.
  ranking: "bg-timeline-question/45",
  join: "bg-muted-foreground/25",
  pause: "border border-dashed border-muted-foreground/60 bg-transparent",
};

// Sessões sem registro de eventos: entre as perguntas não se sabe o que estava no telão.
const kindLabel = (kind: SegmentKind, recorded: boolean) => (kind === "join" && !recorded ? "Apresentação" : KIND_LABEL[kind]);

function describe(
  segment: Segment,
  meta: Record<string, TimelineInteractionMeta>,
  recorded: boolean,
): { short: string; long: string } {
  if (segment.kind === "slide" && segment.slide !== undefined) {
    return { short: `S${segment.slide + 1}`, long: `Slide ${segment.slide + 1}` };
  }
  if (segment.kind === "interaction" && segment.interactionId) {
    const m = meta[segment.interactionId];
    return m
      ? { short: `P${m.number}`, long: `${m.typeLabel}: ${m.title}` }
      : { short: "P", long: "Pergunta (excluída do roteiro)" };
  }
  return { short: "", long: kindLabel(segment.kind, recorded) };
}

export function TalkTimeline({
  timeline,
  interactions,
  slideUrls,
  recorded,
}: {
  timeline: Timeline;
  interactions: Record<string, TimelineInteractionMeta>;
  slideUrls: string[];
  /** false: sessão anterior ao registro de eventos (só perguntas) */
  recorded: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const span = Math.max(1, timeline.span);
  const x = scaleLinear().domain([0, span]).range([0, 100]);
  // Marcações em minutos inteiros; em sessões de até 3 min, em segundos (0:30, 1:00…).
  const short = span < 180;
  const ticks = short
    ? scaleLinear().domain([0, span]).ticks(6).filter((t) => t < span)
    : scaleLinear().domain([0, span / 60]).ticks(8).filter((m) => Number.isInteger(m) && m * 60 < span).map((m) => m * 60);
  const kinds = (["slide", "interaction", "ranking", "join", "pause"] as const).filter((k) => timeline.totals[k] > 0);
  const topSlides = timeline.slides.slice(0, 5);
  const longestSlide = topSlides[0]?.seconds ?? 1;
  const active = hovered !== null ? timeline.segments[hovered] : null;

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground" aria-label="Legenda">
        {kinds.map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span aria-hidden className={cn("inline-block h-3 w-5 rounded-[4px]", KIND_STYLE[k])} />
            {kindLabel(k, recorded)} <span className="font-display tabular-nums text-foreground">{formatSpan(timeline.totals[k])}</span>
          </li>
        ))}
      </ul>

      <div className="relative pt-1">
        {active ? (
          <div
            role="status"
            className="pointer-events-none absolute top-9 z-10 w-max max-w-72 -translate-x-1/2 rounded-md border bg-card px-3 py-2 text-sm text-card-foreground shadow-md"
            style={{ left: `${Math.min(88, Math.max(12, x((active.start + active.end) / 2)))}%` }}
          >
            <p className="truncate font-medium">{describe(active, interactions, recorded).long}</p>
            <p className="font-display text-xs text-muted-foreground tabular-nums">
              {formatClock(active.start)}–{formatClock(active.end)} · {formatSpan(active.end - active.start)}
            </p>
          </div>
        ) : null}

        <div className="relative h-6" onMouseLeave={() => setHovered(null)}>
          {timeline.segments.map((segment, index) => {
            const { long } = describe(segment, interactions, recorded);
            return (
              <button
                key={`${segment.start}-${index}`}
                type="button"
                aria-label={`${long}, de ${formatClock(segment.start)} a ${formatClock(segment.end)}`}
                onMouseEnter={() => setHovered(index)}
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered(null)}
                className={cn(
                  "absolute top-0 h-6 rounded-[4px] outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-ring",
                  KIND_STYLE[segment.kind],
                  hovered !== null && hovered !== index && "opacity-50",
                )}
                // 2px de folga entre trechos vizinhos.
                style={{ left: `${x(segment.start)}%`, width: `max(2px, calc(${x(segment.end) - x(segment.start)}% - 2px))` }}
              />
            );
          })}
        </div>

        {/* Rótulos diretos só nos trechos largos; o resto fica no tooltip e na tabela. */}
        <div className="relative h-4 text-[11px] text-muted-foreground" aria-hidden>
          {timeline.segments.map((segment, index) =>
            x(segment.end) - x(segment.start) >= 6 && describe(segment, interactions, recorded).short ? (
              <span
                key={`l${index}`}
                className="absolute top-0.5 -translate-x-1/2 font-display"
                style={{ left: `${x((segment.start + segment.end) / 2)}%` }}
              >
                {describe(segment, interactions, recorded).short}
              </span>
            ) : null,
          )}
        </div>

        <div className="relative mt-1 h-4 border-t text-[11px] text-muted-foreground" aria-hidden>
          {ticks.map((t) => (
            <span
              key={t}
              className={cn(
                "absolute top-1 whitespace-nowrap tabular-nums",
                t === 0 ? "" : x(t) > 94 ? "-translate-x-full" : "-translate-x-1/2",
              )}
              style={{ left: `${x(t)}%` }}
            >
              {short ? formatClock(t) : `${t / 60} min`}
            </span>
          ))}
        </div>
      </div>

      {!recorded ? (
        <p className="text-sm text-muted-foreground">
          Sessão apresentada antes do registro de slides e pausas: aparecem só as perguntas. As próximas sessões mostram
          tudo o que passou pelo telão.
        </p>
      ) : null}

      {topSlides.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Slides em que você mais ficou</p>
          <ol className="flex flex-col gap-2">
            {topSlides.map(({ slide, seconds }) => (
              <li key={slide} className="grid grid-cols-[4rem_5rem_1fr_auto] items-center gap-3 text-sm">
                {slideUrls[slide] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage
                  <img src={slideUrls[slide]} alt="" loading="lazy" className="aspect-video w-16 rounded border bg-muted object-cover" />
                ) : (
                  <span className="aspect-video w-16 rounded border bg-muted" />
                )}
                <span>Slide {slide + 1}</span>
                <span className="h-2 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-timeline-slide" style={{ width: `${(seconds / longestSlide) * 100}%` }} />
                </span>
                <span className="font-display tabular-nums">{formatSpan(seconds)}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver em tabela</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 pr-4 font-medium">Início</th>
                <th className="py-1 pr-4 font-medium">Duração</th>
                <th className="py-1 font-medium">No telão</th>
              </tr>
            </thead>
            <tbody>
              {timeline.segments.map((segment, index) => (
                <tr key={`t${index}`} className="border-t">
                  <td className="py-1 pr-4 font-display tabular-nums">{formatClock(segment.start)}</td>
                  <td className="py-1 pr-4 tabular-nums">{formatSpan(segment.end - segment.start)}</td>
                  <td className="py-1">{describe(segment, interactions, recorded).long}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
