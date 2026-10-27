import "server-only";
import type { AdminSupabase } from "@/lib/supabase/admin";
import { getPublicInteractions } from "@/lib/data/public";
import type { JourneyResponse } from "@/lib/domain/participant-journey";

// Ritmo próprio: o roteiro inteiro para o celular de quem participa (cookie assinado já validado na rota).
// A visão pública (`toPublicInteraction`) nunca leva alternativa certa, pontos, gabarito nem notas.

/** Null = sessão inexistente. Fora do ritmo próprio ou em rascunho, o roteiro vem vazio. */
export async function getJourneyForParticipant(
  admin: AdminSupabase,
  sessionId: string,
  participantId: string,
): Promise<JourneyResponse | null> {
  const { data: session, error } = await admin.from("sessions").select("status, pace").eq("id", sessionId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!session) return null;
  // Antes do início, o roteiro fica guardado (quem entra cedo espera, como no modo ao vivo).
  if (session.pace !== "self" || session.status === "draft") return { status: session.status, items: [], answered: [] };

  const [items, responses] = await Promise.all([
    getPublicInteractions(admin, sessionId),
    admin.from("responses").select("interaction_id").eq("session_id", sessionId).eq("participant_id", participantId),
  ]);
  if (responses.error) throw new Error(responses.error.message);
  return {
    status: session.status,
    items: items.map((item) => ({ ...item, activatedAt: null })),
    answered: [...new Set(responses.data.map((r) => r.interaction_id))],
  };
}
