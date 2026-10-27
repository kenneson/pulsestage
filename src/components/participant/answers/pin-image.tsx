"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import * as m from "motion/react-m";
import type { PublicInteraction } from "@/lib/domain/interactions";
import { fractionInBox } from "@/lib/domain/participant-answers";
import { optionImageSrc } from "@/lib/option-images/url";
import { cn } from "@/lib/utils";
import { MapPinIcon } from "@/components/icons";
import { SPRING } from "@/components/motion/presets";
import type { DraftChange } from "./shared";

type Pin = { x: number; y: number };

const clamp01 = (v: number) => Math.min(1, Math.max(0, Math.round(v * 10000) / 10000));

/**
 * Marcar na imagem: toque para pôr o alfinete; tocar de novo (ou arrastar) muda o lugar. Envia `x, y` de 0 a 1
 * a partir do canto superior esquerdo da imagem.
 */
export function PinImageAnswer({
  interaction,
  onChange,
  disabled,
}: {
  interaction: PublicInteraction;
  onChange: DraftChange;
  disabled: boolean;
}) {
  const t = useTranslations("participant.answer");
  const [pin, setPin] = useState<Pin | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const { imagePath } = interaction.settings;

  function place(next: Pin) {
    setPin(next);
    onChange({ type: "pin_image", x: next.x, y: next.y });
  }

  function pointAt(e: React.PointerEvent) {
    const rect = area.current?.getBoundingClientRect();
    return rect ? fractionInBox(e.clientX, e.clientY, rect) : { x: 0.5, y: 0.5 };
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-0.02, 0], ArrowRight: [0.02, 0], ArrowUp: [0, -0.02], ArrowDown: [0, 0.02] };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      const from = pin ?? { x: 0.5, y: 0.5 };
      place({ x: clamp01(from.x + move[0]), y: clamp01(from.y + move[1]) });
    } else if ((e.key === "Enter" || e.key === " ") && !pin) {
      e.preventDefault();
      place({ x: 0.5, y: 0.5 });
    }
  }

  if (!imagePath) return <p className="text-sm text-muted-foreground">{t("pinNoImage")}</p>;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {pin ? t("pinMove") : t("pinPlace")}
      </p>
      <div
        ref={area}
        role="application"
        tabIndex={disabled ? -1 : 0}
        aria-label={t("pinArea")}
        onPointerDown={(e) => {
          if (disabled) return;
          e.preventDefault();
          area.current?.setPointerCapture(e.pointerId);
          dragging.current = true;
          place(pointAt(e));
        }}
        onPointerMove={(e) => {
          if (dragging.current) place(pointAt(e));
        }}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onKeyDown={onKeyDown}
        className={cn(
          "relative w-full touch-none select-none overflow-hidden rounded-xl border-2 bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring",
          disabled ? "opacity-60" : "cursor-crosshair",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- imagem pública do Storage */}
        <img src={optionImageSrc(imagePath)} alt="" draggable={false} className="pointer-events-none block h-auto w-full" />
        {pin ? (
          <span
            aria-hidden
            className="pointer-events-none absolute"
            style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
          >
            {/* Ponto exato e o alfinete com a ponta nele. */}
            <span className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-white" />
            <m.span
              className="absolute -translate-x-1/2 -translate-y-full text-primary drop-shadow-[0_2px_2px_rgb(0_0_0/0.45)]"
              initial={{ y: -8, opacity: 0.6 }}
              animate={{ y: 0, opacity: 1 }}
              transition={SPRING.snappy}
            >
              <MapPinIcon width={40} height={40} className="fill-white" strokeWidth={2.25} />
            </m.span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
