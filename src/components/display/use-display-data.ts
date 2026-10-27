"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { revealedAnswerSchema, type RevealedAnswer } from "@/lib/domain/answer-reveal";
import { snapshotFromRow, type ResultsSnapshot } from "@/lib/domain/results";

// Leituras do telão por GET (secret key no servidor): resposta revelada e resultados de um grupo.
// Só buscam enquanto o palestrante liga o recurso; desligado, voltam a null na hora.

const answerResponseSchema = z.object({ answer: revealedAnswerSchema });

/** Resposta certa da pergunta no ar depois de "Revelar resposta". */
export function useRevealedAnswer(sessionId: string, interactionId: string | null, enabled: boolean): RevealedAnswer | null {
  const [state, setState] = useState<{ key: string; answer: RevealedAnswer } | null>(null);
  const key = enabled && interactionId ? interactionId : null;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    let retry: number | undefined;
    const load = (attempt: number) => {
      void fetch(`/api/session/${sessionId}/answer?interaction=${key}`, { cache: "no-store" })
        .then(async (res) => (res.ok ? answerResponseSchema.parse(await res.json()).answer : null))
        .catch(() => null)
        .then((answer) => {
          if (cancelled) return;
          if (answer) setState({ key, answer });
          // O estado ao vivo pode chegar antes da gravação ser visível: tenta de novo algumas vezes.
          else if (attempt < 3) retry = window.setTimeout(() => load(attempt + 1), 1200);
        });
    };
    load(0);
    return () => {
      cancelled = true;
      window.clearTimeout(retry);
    };
  }, [sessionId, key]);

  return key && state?.key === key ? state.answer : null;
}

const segmentResponseSchema = z.object({
  snapshot: z.object({ total: z.number(), counts: z.unknown(), recent: z.unknown() }),
  group: z.string(),
});

/** Intervalo entre releituras do grupo: cada resposta nova pede uma, no máximo a cada 1,5 s. */
const SEGMENT_MIN_GAP_MS = 1500;
const SEGMENT_POLL_MS = 6000;

export type SegmentView = { snapshot: ResultsSnapshot; group: string };

/**
 * Resultados da pergunta no ar só do grupo escolhido em "Comparar grupos". `version` muda a cada resposta
 * (o total do agregado público): relê com um intervalo mínimo, e também de tempos em tempos.
 */
export function useSegmentResults(
  sessionId: string,
  interactionId: string | null,
  optionId: string | null,
  version: number,
): SegmentView | null {
  const [state, setState] = useState<{ key: string; view: SegmentView } | null>(null);
  const lastLoad = useRef(0);
  const listener = useRef<(() => void) | null>(null);
  const pending = useRef<number | undefined>(undefined);
  const firstVersion = useRef(true);
  const key = interactionId && optionId ? `${interactionId}:${optionId}` : null;

  // Releitura periódica (cobre respostas moderadas e eventos perdidos).
  useEffect(() => {
    if (!key || !interactionId) return;
    let cancelled = false;
    const load = () => {
      lastLoad.current = Date.now();
      void fetch(`/api/session/${sessionId}/segment-results?interaction=${interactionId}`, { cache: "no-store" })
        .then(async (res) => (res.ok ? segmentResponseSchema.parse(await res.json()) : null))
        .catch(() => null)
        .then((data) => {
          if (cancelled || !data) return;
          setState({ key, view: { snapshot: snapshotFromRow(data.snapshot), group: data.group } });
        });
    };
    load();
    const interval = window.setInterval(load, SEGMENT_POLL_MS);
    const onVersion = () => {
      // Resposta nova: relê respeitando o intervalo mínimo desde a última leitura.
      const wait = Math.max(0, lastLoad.current + SEGMENT_MIN_GAP_MS - Date.now());
      window.clearTimeout(pending.current);
      pending.current = window.setTimeout(load, wait);
    };
    listener.current = onVersion;
    return () => {
      cancelled = true;
      listener.current = null;
      window.clearInterval(interval);
      window.clearTimeout(pending.current);
    };
  }, [sessionId, key, interactionId]);

  useEffect(() => {
    if (firstVersion.current) {
      firstVersion.current = false;
      return;
    }
    listener.current?.();
  }, [version]);

  return key && state?.key === key ? state.view : null;
}
