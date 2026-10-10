"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { setActiveInteractionAction } from "@/features/interactions/actions";
import { showSlideAction } from "@/features/slides/actions";
import {
  deckIndexOf,
  initialCursor,
  nextItem,
  previousSlide,
  type DeckItem,
} from "@/lib/domain/deck";
import type { LiveState } from "@/lib/realtime/schemas";
import type { ActionResult } from "@/lib/action-result";

/** Interação mais recente aberta, para retomar a apresentação de onde parou. */
export function lastActivatedOf(interactions: readonly { id: string; activatedAt: string | null }[]) {
  let last: { id: string; at: string } | null = null;
  for (const i of interactions) {
    if (i.activatedAt && (!last || i.activatedAt > last.at)) last = { id: i.id, at: i.activatedAt };
  }
  return last;
}

/**
 * Navegação pelo deck (slides + interações), usada pela sala ao vivo e pelo projetor do dono.
 * O cursor é o último item levado ao telão; segue o realtime quando outra janela muda o telão.
 * Teclado: → e PageDown avançam; ← e PageUp voltam ao slide anterior (passadores enviam essas teclas).
 */
export function useDeckControls({
  sessionId,
  deck,
  live,
  lastActivated,
  enabled,
}: {
  sessionId: string;
  deck: DeckItem[];
  live: LiveState | null;
  lastActivated: { id: string; at: string } | null;
  /** só com a sessão ao vivo */
  enabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const activeId = live?.active_interaction_id ?? null;
  const slideAt = live?.current_slide_changed_at ?? null;

  const [cursor, setCursor] = useState(() =>
    initialCursor(
      deck,
      { activeInteractionId: activeId, currentSlide: live?.current_slide ?? null, currentSlideChangedAt: slideAt },
      lastActivated,
    ),
  );

  // Mudanças vindas do realtime (inclusive de outra janela) movem o cursor.
  const [seen, setSeen] = useState({ activeId, slideAt });
  if (seen.activeId !== activeId || seen.slideAt !== slideAt) {
    setSeen({ activeId, slideAt });
    if (activeId && activeId !== seen.activeId) {
      const index = deckIndexOf(deck, { kind: "interaction", id: activeId });
      if (index >= 0) setCursor(index);
    } else if (slideAt !== seen.slideAt && live?.current_slide !== null && live?.current_slide !== undefined) {
      const index = deckIndexOf(deck, { kind: "slide", index: live.current_slide });
      if (index >= 0) setCursor(index);
    }
  }

  const run = useCallback(
    (task: () => Promise<ActionResult>) =>
      startTransition(async () => {
        const result = await task();
        if (!result.ok) toast.error(result.error);
      }),
    [],
  );

  const goTo = useCallback(
    (item: DeckItem) => {
      const index = deckIndexOf(deck, item);
      if (index >= 0) setCursor(index);
      run(() =>
        item.kind === "slide" ? showSlideAction(sessionId, item.index) : setActiveInteractionAction(sessionId, item.id),
      );
    },
    [deck, run, sessionId],
  );

  const showJoinScreen = useCallback(() => run(() => showSlideAction(sessionId, null)), [run, sessionId]);
  // Para de receber respostas; com slides, o telão volta para o slide que estava por trás.
  const closeActive = useCallback(() => run(() => setActiveInteractionAction(sessionId, null)), [run, sessionId]);

  const next = enabled ? nextItem(deck, cursor) : null;
  const previous = enabled ? previousSlide(deck, cursor) : null;

  // Atalhos de teclado e passador de slides.
  const keys = useRef<{ next: (() => void) | null; previous: (() => void) | null }>({ next: null, previous: null });
  useEffect(() => {
    keys.current = {
      next: next && !pending ? () => goTo(next) : null,
      previous: previous && !pending ? () => goTo(previous) : null,
    };
  });
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (document.querySelector("dialog[open]") || event.altKey || event.ctrlKey || event.metaKey) return;
      const action =
        event.key === "ArrowRight" || event.key === "PageDown"
          ? keys.current.next
          : event.key === "ArrowLeft" || event.key === "PageUp"
            ? keys.current.previous
            : null;
      if (!action) return;
      event.preventDefault();
      action();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return { cursor, next, previous, goTo, showJoinScreen, closeActive, pending };
}
