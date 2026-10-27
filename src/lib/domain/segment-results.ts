// "Comparar grupos" no telão: resultados só de quem escolheu uma alternativa da enquete de perfil.
// Regras puras (sem I/O); o servidor lê as respostas com a secret key e devolve só o agregado.

import { z } from "zod";
import { snapshotFromResponses, type ResultsSnapshot } from "./results.ts";

const choiceValueSchema = z.union([
  z.object({ optionId: z.string() }),
  z.object({ optionIds: z.array(z.string()) }),
]);

/** Pessoas que escolheram `optionId` na enquete de perfil (uma escolha ou várias). */
export function segmentMembers(
  responses: readonly { participant_id: string; value: unknown }[],
  optionId: string,
): Set<string> {
  const members = new Set<string>();
  for (const r of responses) {
    const parsed = choiceValueSchema.safeParse(r.value);
    if (!parsed.success) continue;
    const chosen = "optionId" in parsed.data ? [parsed.data.optionId] : parsed.data.optionIds;
    if (chosen.includes(optionId)) members.add(r.participant_id);
  }
  return members;
}

/** O filtro vale para esta pergunta? Na própria enquete de perfil, não (mostraria 100% numa alternativa). */
export function segmentApplies(input: {
  segmentOptionId: string | null;
  segmentInteractionId: string | null;
  interactionId: string;
}): boolean {
  return Boolean(input.segmentOptionId && input.segmentInteractionId && input.segmentInteractionId !== input.interactionId);
}

export type SegmentResponse = {
  id: string;
  participant_id: string;
  aggregate_key: string | null;
  value: unknown;
  created_at: string;
  moderation?: string;
};

/** Snapshot recalculado só com as respostas do grupo (mesmas regras do banco). */
export function segmentSnapshot(responses: readonly SegmentResponse[], members: ReadonlySet<string>): ResultsSnapshot {
  return snapshotFromResponses(responses.filter((r) => members.has(r.participant_id)));
}
