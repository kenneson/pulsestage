"use client";

import { useCallback, useEffect, useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";
import { setSegmentFilterAction } from "@/features/live/actions";
import type { SegmentGroup } from "@/lib/domain/live-room";
import type { ResultsSnapshot } from "@/lib/domain/results";
import { fetchJson, usePolling } from "@/lib/realtime/use-polling";
import { cn } from "@/lib/utils";
import { UsersIcon } from "@/components/icons";

/** Releitura do resultado filtrado (as respostas chegam o tempo todo). */
const SEGMENT_POLL_MS = 3000;

const segmentResultSchema = z.object({
  snapshot: z.object({
    total: z.number(),
    counts: z.record(z.string(), z.number()),
    recent: z.array(z.object({ id: z.string(), text: z.string(), at: z.string() })),
  }),
  people: z.number(),
});

/**
 * Seletor "Ver só: <grupo>" (comparar grupos): alternativas das enquetes de perfil + "Todos". Muda o filtro
 * do telão (set_segment_filter); a sala ao vivo mostra o mesmo recorte.
 */
export function SegmentFilter({
  sessionId,
  groups,
  value,
  disabled,
  onChanged,
}: {
  sessionId: string;
  groups: SegmentGroup[];
  /** alternativa escolhida (null = todos) */
  value: string | null;
  disabled?: boolean;
  onChanged?: () => void;
}) {
  const t = useTranslations("live.segment");
  const id = useId();
  const [pending, startTransition] = useTransition();
  // Mostra a escolha na hora; o estado ao vivo confirma em seguida.
  const [optimistic, setOptimistic] = useState<{ from: string | null; to: string | null } | null>(null);
  const shown = optimistic && optimistic.from === value ? optimistic.to : value;

  function change(next: string) {
    const optionId = next === "" ? null : next;
    setOptimistic({ from: value, to: optionId });
    startTransition(async () => {
      const result = await setSegmentFilterAction(sessionId, optionId);
      if (!result.ok) {
        toast.error(result.error);
        setOptimistic(null);
      } else onChanged?.();
    });
  }

  return (
    <div className="flex min-w-0 items-center gap-2 max-md:w-full">
      <label htmlFor={id} className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
        <UsersIcon aria-hidden className="size-4" /> {t("label")}
      </label>
      <select
        id={id}
        value={shown ?? ""}
        disabled={disabled || pending}
        onChange={(event) => change(event.target.value)}
        className={cn(
          "h-8 min-w-0 max-w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50 max-md:h-11 max-md:flex-1",
          shown && "border-primary font-medium text-primary",
        )}
      >
        <option value="">{t("all")}</option>
        {groups.map((group) =>
          groups.length > 1 ? (
            <optgroup key={group.interactionId} label={group.title}>
              {group.options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ) : (
            group.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))
          ),
        )}
      </select>
    </div>
  );
}

/**
 * Resultado da pergunta só com quem escolheu a alternativa (GET do dono, recalculado das respostas).
 * null enquanto não há filtro, não carregou ou a pergunta não se aplica.
 */
export function useSegmentSnapshot(
  sessionId: string,
  interactionId: string | null,
  optionId: string | null,
): { snapshot: ResultsSnapshot; people: number } | null {
  const key = interactionId && optionId ? `${interactionId}:${optionId}` : null;
  const [data, setData] = useState<{ key: string; snapshot: ResultsSnapshot; people: number } | null>(null);

  const load = useCallback(async () => {
    if (!key || !interactionId || !optionId) return;
    const params = new URLSearchParams({ interaction: interactionId, option: optionId });
    const result = await fetchJson(`/api/live/${sessionId}/segment-results?${params}`, segmentResultSchema.parse);
    if (result) setData({ key, ...result });
  }, [key, interactionId, optionId, sessionId]);

  // Busca na hora ao trocar de pergunta ou de grupo; depois, a cada poucos segundos.
  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);
  usePolling(load, SEGMENT_POLL_MS, key !== null);

  return data && data.key === key ? { snapshot: data.snapshot, people: data.people } : null;
}
