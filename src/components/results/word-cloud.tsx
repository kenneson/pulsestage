"use client";

import { useEffect, useRef, useState } from "react";
import cloud from "d3-cloud";
import type { WordCount } from "@/lib/domain/results";
import { cn } from "@/lib/utils";

// Nuvem de palavras com d3-cloud: o d3 calcula onde cada palavra cabe; o React desenha o SVG.
// O layout é determinístico (mesma semente), então a nuvem só se rearranja quando as contagens mudam,
// e as palavras deslizam até a nova posição. Antes do layout (servidor, primeiro paint) aparece a lista simples.

type Variant = "compact" | "display";

// "emphasis" (0 a 1, pela contagem): o d3-cloud usa o campo `weight` para o peso da fonte.
type Placed = { text: string; count: number; emphasis: number; size: number; x: number; y: number; rotate: number };
type CloudWord = cloud.Word & { count: number; emphasis: number };

const SIZES: Record<Variant, readonly [number, number]> = { display: [24, 96], compact: [13, 40] };

function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const weightOf = (count: number, max: number) => (max > 1 ? (count - 1) / (max - 1) : 1);
const fontWeightOf = (weight: number) => (weight > 0.66 ? 700 : weight > 0.33 ? 600 : 400);

function runLayout(
  words: WordCount[],
  width: number,
  height: number,
  [min, max]: readonly [number, number],
  fontFamily: string,
  scale: number,
): Promise<Placed[]> {
  const top = words[0]?.count ?? 1;
  const input: CloudWord[] = words.map(({ word, count }) => {
    const emphasis = weightOf(count, top);
    return { text: word, count, emphasis, size: Math.round((min + emphasis * (max - min)) * scale) };
  });
  return new Promise((resolve) => {
    cloud<CloudWord>()
      .size([width, height])
      .words(input)
      .padding(4)
      .font(fontFamily)
      .fontWeight((d) => fontWeightOf(d.emphasis))
      .fontSize((d) => d.size ?? min)
      // Só palavras menores giram, e só algumas: no telão, a leitura de longe vem primeiro.
      .rotate((d) => (d.emphasis < 0.3 && hash(d.text ?? "") % 5 === 0 ? -90 : 0))
      .random(seeded(7))
      .spiral("archimedean")
      .on("end", (placed) =>
        resolve(
          placed.map((d) => ({
            text: d.text ?? "",
            count: d.count,
            emphasis: d.emphasis,
            size: d.size ?? min,
            x: d.x ?? 0,
            y: d.y ?? 0,
            rotate: d.rotate ?? 0,
          })),
        ),
      )
      .start();
  });
}

/** Tenta encaixar todas as palavras; se alguma ficar de fora, diminui as fontes e tenta de novo. */
async function layoutAll(
  words: WordCount[],
  width: number,
  height: number,
  sizes: readonly [number, number],
  fontFamily: string,
): Promise<Placed[]> {
  // O d3-cloud mede as palavras num canvas: com a fonte da página ainda carregando, as medidas sairiam erradas.
  await document.fonts?.ready;
  let best: Placed[] = [];
  for (const scale of [1, 0.85, 0.7, 0.55]) {
    const placed = await runLayout(words, width, height, sizes, fontFamily, scale);
    if (placed.length > best.length) best = placed;
    if (placed.length === words.length) break;
  }
  return best;
}

function WordList({ words, variant }: { words: WordCount[]; variant: Variant }) {
  const top = words[0]?.count ?? 1;
  const [min, max] = variant === "display" ? ([22, 88] as const) : ([13, 36] as const);
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 py-2">
      {words.map(({ word, count }) => {
        const weight = weightOf(count, top);
        return (
          <span
            key={word}
            title={`${word}: ${count}`}
            className={cn("leading-tight", weight > 0.66 ? "font-bold text-primary" : weight > 0.33 ? "font-semibold" : "text-muted-foreground")}
            style={{ fontSize: `${Math.round(min + weight * (max - min))}px` }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

export function WordCloud({ words, variant }: { words: WordCount[]; variant: Variant }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [placed, setPlaced] = useState<{ key: string; words: Placed[] } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry?.contentRect.width ?? 0)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const height = variant === "display" ? Math.min(560, Math.max(260, Math.round(width * 0.42))) : 260;
  const key = `${width}|${words.map((w) => `${w.word}:${w.count}`).join(",")}`;

  useEffect(() => {
    const el = box.current;
    if (!el || width < 120 || words.length === 0) return;
    let cancelled = false;
    const fontFamily = getComputedStyle(el).fontFamily || "sans-serif";
    void layoutAll(words, width, height, SIZES[variant], fontFamily).then((result) => {
      if (!cancelled) setPlaced({ key, words: result });
    });
    return () => {
      cancelled = true;
    };
    // `key` resume palavras, contagens e largura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, height, variant]);

  return (
    <div ref={box} className="w-full">
      {placed && width > 0 ? (
        <svg
          viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`}
          width="100%"
          height={height}
          role="img"
          aria-label={`Nuvem de palavras: ${words.map((w) => `${w.word} (${w.count})`).join(", ")}`}
        >
          {placed.words.map((w) => (
            <text
              key={w.text}
              textAnchor="middle"
              className={cn(
                "transition-[transform,font-size,opacity] duration-700 ease-out",
                w.emphasis > 0.66 ? "fill-primary" : w.emphasis > 0.33 ? "fill-foreground" : "fill-muted-foreground",
              )}
              // Transform em CSS (não no atributo) para a transição deslizar a palavra até a nova posição.
              style={{
                fontSize: w.size,
                fontWeight: fontWeightOf(w.emphasis),
                transform: `translate(${w.x}px, ${w.y}px) rotate(${w.rotate}deg)`,
              }}
            >
              <title>{`${w.text}: ${w.count}`}</title>
              {w.text}
            </text>
          ))}
        </svg>
      ) : (
        <WordList words={words} variant={variant} />
      )}
    </div>
  );
}
