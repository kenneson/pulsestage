"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Float = { id: number; emoji: string; left: number; drift: number; rise: number; duration: number; size: number };

/** Emojis que sobem e somem (reações). `spawn` aceita vários de uma vez; o resto do layout não mexe. */
export function useFloatingEmojis({ rise = 180, size = 32, spread = 1 }: { rise?: number; size?: number; spread?: number } = {}) {
  const [floats, setFloats] = useState<Float[]>([]);
  const nextId = useRef(0);

  const spawn = useCallback(
    (emoji: string, count = 1, origin?: number) => {
      const created: Float[] = Array.from({ length: count }, (_, i) => ({
        id: nextId.current++,
        emoji,
        // origin em % (0–100); sem origin, espalha pela largura toda
        left: origin ?? 5 + ((nextId.current * 37 + i * 53) % 90),
        drift: (((nextId.current * 29 + i * 17) % 61) - 30) * spread,
        rise: rise * (0.75 + ((nextId.current * 13 + i * 7) % 50) / 100),
        duration: 1400 + ((nextId.current * 31 + i * 11) % 900) + i * 90,
        size: size * (0.85 + ((nextId.current * 19 + i * 3) % 40) / 100),
      }));
      setFloats((list) => [...list.slice(-60), ...created]);
    },
    [rise, size, spread],
  );

  const remove = useCallback((id: number) => setFloats((list) => list.filter((f) => f.id !== id)), []);

  return { floats, spawn, remove };
}

export function FloatingEmojis({
  floats,
  onDone,
  className,
}: {
  floats: Float[];
  onDone: (id: number) => void;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {floats.map((f) => (
        <span
          key={f.id}
          className="reaction-float absolute bottom-0 leading-none"
          style={
            {
              left: `${f.left}%`,
              fontSize: f.size,
              "--drift": `${f.drift}px`,
              "--rise": `${f.rise}px`,
              "--duration": `${f.duration}ms`,
              animationDelay: `${(f.id % 4) * 60}ms`,
            } as React.CSSProperties
          }
          onAnimationEnd={() => onDone(f.id)}
        >
          {f.emoji}
        </span>
      ))}
    </div>
  );
}
