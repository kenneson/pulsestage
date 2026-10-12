import type { ReactNode } from "react";
import { optionShape, type OptionShape } from "@/lib/domain/gamification";
import { cn } from "@/lib/utils";

// Formas das alternativas no estilo "Formas e cores" (Kahoot). Preenchidas, para ler de longe no telão.
// A cor vem de --shape-N (globals.css); as classes ficam escritas por extenso para o Tailwind encontrá-las.

const PATHS: Record<OptionShape["key"], ReactNode> = {
  triangle: <path d="M12 3 22.5 20.5h-21z" />,
  diamond: <path d="M12 1.5 22.5 12 12 22.5 1.5 12z" />,
  circle: <circle cx="12" cy="12" r="10" />,
  square: <rect x="2.5" y="2.5" width="19" height="19" rx="1.5" />,
  star: <path d="m12 1.8 3.1 6.4 7 .9-5.1 4.9 1.3 6.9L12 17.6l-6.3 3.3 1.3-6.9-5.1-4.9 7-.9z" />,
  hexagon: <path d="M12 1.5 21.1 6.8v10.4L12 22.5l-9.1-5.3V6.8z" />,
  pentagon: <path d="m12 1.8 10.2 7.4-3.9 12H5.7l-3.9-12z" />,
  heart: <path d="M12 21.5S1.8 15.4 1.8 8.6A5.4 5.4 0 0 1 12 6.2a5.4 5.4 0 0 1 10.2 2.4c0 6.8-10.2 12.9-10.2 12.9z" />,
};

const BG = [
  "bg-shape-1",
  "bg-shape-2",
  "bg-shape-3",
  "bg-shape-4",
  "bg-shape-5",
  "bg-shape-6",
  "bg-shape-7",
  "bg-shape-8",
] as const;

const TEXT = [
  "text-shape-1",
  "text-shape-2",
  "text-shape-3",
  "text-shape-4",
  "text-shape-5",
  "text-shape-6",
  "text-shape-7",
  "text-shape-8",
] as const;

/** Classe de fundo (preenchimento da alternativa) da posição `index`. */
export function shapeBg(index: number): string {
  return BG[optionShape(index).color - 1]!;
}

/** Classe de cor do texto/ícone da posição `index`. */
export function shapeText(index: number): string {
  return TEXT[optionShape(index).color - 1]!;
}

/** Forma da alternativa na posição `index`, na cor atual (currentColor). Decorativa: o texto vem ao lado. */
export function ShapeGlyph({ index, className }: { index: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={cn("size-5 shrink-0", className)}>
      {PATHS[optionShape(index).key]}
    </svg>
  );
}
