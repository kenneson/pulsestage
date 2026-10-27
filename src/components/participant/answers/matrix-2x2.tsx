"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import * as m from "motion/react-m";
import type { PublicInteraction } from "@/lib/domain/interactions";
import { matrixPosition, nudgeMatrix } from "@/lib/domain/participant-answers";
import { cn } from "@/lib/utils";
import { CheckIcon } from "@/components/icons";
import { shapeBg } from "@/components/option-shape";
import { SPRING } from "@/components/motion/presets";
import type { DraftChange } from "./shared";

type Position = { x: number; y: number };
type Positions = Record<string, Position>;

/** Próximo item ainda fora do quadro, depois de `fromId` (dá a volta); null se todos estão no quadro. */
function nextUnplaced(ids: readonly string[], positions: Positions, fromId: string | null): string | null {
  const start = fromId ? ids.indexOf(fromId) : -1;
  for (let step = 1; step <= ids.length; step++) {
    const id = ids[(start + step) % ids.length]!;
    if (id !== fromId && !positions[id]) return id;
  }
  return null;
}

/**
 * Matriz 2×2: um item de cada vez, toque (ou arraste) no quadro para posicionar; o seguinte entra sozinho.
 * Tocar num ponto já colocado o seleciona para mover. Dá para pular itens; o envio precisa de pelo menos um.
 * `x` cresce para a direita e `y` para cima (0–100), como no telão.
 */
export function MatrixAnswer({
  interaction,
  onChange,
  disabled,
}: {
  interaction: PublicInteraction;
  onChange: DraftChange;
  disabled: boolean;
}) {
  const t = useTranslations("participant.answer");
  const { settings, options } = interaction;
  const ids = options.map((o) => o.id);
  const [positions, setPositions] = useState<Positions>({});
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  const board = useRef<HTMLDivElement>(null);
  // Arrasto em andamento: qual item e se ele acabou de entrar no quadro (para passar ao seguinte ao soltar).
  const drag = useRef<{ id: string; placedNow: boolean } | null>(null);

  // Última posição gravada (os eventos do arrasto chegam antes de a tela renderizar de novo).
  const latest = useRef<Positions>({});

  function commit(next: Positions) {
    latest.current = next;
    setPositions(next);
    onChange(Object.keys(next).length > 0 ? { type: "matrix_2x2", positions: next } : null);
  }

  function pointAt(e: React.PointerEvent) {
    const rect = board.current?.getBoundingClientRect();
    return rect ? matrixPosition(e.clientX, e.clientY, rect) : { x: 50, y: 50 };
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    const dot = (e.target as HTMLElement).closest<HTMLElement>("[data-item]");
    const id = dot?.dataset.item ?? active;
    if (!id) return;
    e.preventDefault();
    board.current?.setPointerCapture(e.pointerId);
    drag.current = { id, placedNow: !latest.current[id] };
    setActive(id);
    // Tocar num ponto só o seleciona; tocar no quadro posiciona o item ativo.
    if (!dot) commit({ ...latest.current, [id]: pointAt(e) });
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    commit({ ...latest.current, [drag.current.id]: pointAt(e) });
  }

  function onPointerUp() {
    const current = drag.current;
    drag.current = null;
    if (current?.placedNow && latest.current[current.id]) setActive(nextUnplaced(ids, latest.current, current.id));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!active || disabled) return;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      commit({ ...latest.current, [active]: nudgeMatrix(latest.current[active] ?? { x: 50, y: 50 }, move[0], move[1]) });
    } else if ((e.key === "Enter" || e.key === " ") && !latest.current[active]) {
      e.preventDefault();
      commit({ ...latest.current, [active]: { x: 50, y: 50 } });
    }
  }

  function remove(id: string) {
    const next = { ...latest.current };
    delete next[id];
    commit(next);
    setActive(id);
  }

  const activeIndex = active ? ids.indexOf(active) : -1;
  const activeOption = activeIndex >= 0 ? options[activeIndex] : null;
  const pole = "pointer-events-none absolute max-w-[40%] rounded px-1 text-[0.7rem] leading-tight text-muted-foreground";

  return (
    <div className="flex flex-col gap-3">
      <p className="min-h-10 text-sm text-muted-foreground" aria-live="polite">
        {activeOption
          ? t.rich(positions[activeOption.id] ? "matrixMove" : "matrixPlace", {
              label: activeOption.label,
              b: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
            })
          : t("matrixDone")}
      </p>

      {settings.yLabel ? <p className="text-xs font-semibold text-foreground">↑ {settings.yLabel}</p> : null}
      <div
        ref={board}
        role="application"
        tabIndex={disabled ? -1 : 0}
        aria-label={t("matrixBoard")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className={cn(
          "relative aspect-square w-full touch-none select-none overflow-hidden rounded-xl border-2 bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring",
          disabled ? "opacity-60" : "cursor-crosshair",
        )}
      >
        {/* Quadrantes */}
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-dashed border-border" />
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
        {settings.yHigh ? <span className={cn(pole, "left-1/2 top-1 -translate-x-1/2 text-center")}>{settings.yHigh}</span> : null}
        {settings.yLow ? <span className={cn(pole, "bottom-1 left-1/2 -translate-x-1/2 text-center")}>{settings.yLow}</span> : null}
        {settings.xLow ? <span className={cn(pole, "left-1 top-1/2 -translate-y-1/2 pt-3")}>{settings.xLow}</span> : null}
        {settings.xHigh ? <span className={cn(pole, "right-1 top-1/2 -translate-y-1/2 pt-3 text-right")}>{settings.xHigh}</span> : null}

        {options.map((option, index) => {
          const position = positions[option.id];
          if (!position) return null;
          return (
            <m.span
              key={option.id}
              data-item={option.id}
              aria-hidden
              className={cn(
                "absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full font-display text-sm font-bold text-white shadow-md",
                shapeBg(index),
                active === option.id && "z-10 ring-4 ring-foreground ring-offset-2 ring-offset-card",
              )}
              style={{ left: `${position.x}%`, top: `${100 - position.y}%` }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={SPRING.snappy}
            >
              {index + 1}
            </m.span>
          );
        })}
      </div>
      {settings.xLabel ? <p className="text-right text-xs font-semibold text-foreground">{settings.xLabel} →</p> : null}

      <ul className="flex flex-col gap-2">
        {options.map((option, index) => {
          const placed = Boolean(positions[option.id]);
          const isActive = active === option.id;
          return (
            <li key={option.id} className="flex items-center gap-2">
              <button
                type="button"
                disabled={disabled}
                aria-pressed={isActive}
                onClick={() => setActive(option.id)}
                className={cn(
                  "flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl border-2 px-3 py-2 text-left text-sm font-medium transition-colors",
                  isActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                )}
              >
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-full font-display text-xs font-bold text-white", shapeBg(index))}>
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 break-words">{option.label}</span>
                {placed ? (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-primary">
                    <CheckIcon width={14} height={14} /> {t("matrixPlaced")}
                  </span>
                ) : null}
              </button>
              {placed ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => remove(option.id)}
                  className="min-h-12 shrink-0 px-2 text-xs text-muted-foreground underline"
                >
                  {t("matrixRemove")}
                </button>
              ) : isActive ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setActive(nextUnplaced(ids, positions, option.id))}
                  className="min-h-12 shrink-0 px-2 text-xs text-muted-foreground underline"
                >
                  {t("matrixSkip")}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
