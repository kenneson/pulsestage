"use client";

import { sendReactionAction } from "@/features/participant/actions";
import { REACTIONS } from "@/lib/domain/reactions";
import { FloatingEmojis, useFloatingEmojis } from "@/components/reactions/floating-emojis";

/** Reações ao vivo no celular: o emoji sobe na hora (sem esperar o servidor) e vai para o telão. */
export function ReactionBar({ sessionId }: { sessionId: string }) {
  const { floats, spawn, remove } = useFloatingEmojis({ rise: 220, size: 30 });
  return (
    <div className="relative">
      <FloatingEmojis floats={floats} onDone={remove} className="inset-x-0 top-auto bottom-full h-56" />
      <div role="group" aria-label="Reagir" className="flex justify-between gap-1">
        {REACTIONS.map((r, index) => (
          <button
            key={r.key}
            type="button"
            aria-label={r.label}
            title={r.label}
            onClick={() => {
              spawn(r.emoji, 1, 10 + index * 20);
              void sendReactionAction(sessionId, r.key);
            }}
            className="grid size-12 place-items-center rounded-full bg-muted text-2xl leading-none transition-transform active:scale-90"
          >
            {r.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
