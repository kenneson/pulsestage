import "server-only";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { OPTION_IMAGES_BUCKET } from "@/lib/domain/gamification";

// Imagens das alternativas. Duplicar uma sessão ou copiar perguntas da biblioteca reaproveita o
// mesmo arquivo; por isso só sai do Storage a imagem que nenhuma alternativa usa mais.

/** Apaga as imagens que não aparecem em nenhuma alternativa. Em caso de erro, mantém os arquivos. */
export async function removeUnusedOptionImages(client: ServerSupabase | AdminSupabase, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { data, error } = await client.from("interaction_options").select("image_path").in("image_path", paths);
  if (error) return;
  const used = new Set(data.map((r) => r.image_path));
  const unused = paths.filter((p) => !used.has(p));
  if (unused.length > 0) await client.storage.from(OPTION_IMAGES_BUCKET).remove(unused);
}

/** Imagens usadas pelas alternativas das interações informadas (antes de excluí-las). */
export async function optionImagesOf(
  client: ServerSupabase | AdminSupabase,
  filter: { interactionId: string } | { sessionId: string },
): Promise<string[]> {
  const query =
    "interactionId" in filter
      ? client.from("interaction_options").select("image_path").eq("interaction_id", filter.interactionId)
      : client
          .from("interaction_options")
          .select("image_path, interactions!inner(session_id)")
          .eq("interactions.session_id", filter.sessionId);
  const { data, error } = await query.not("image_path", "is", null);
  if (error) return [];
  return [...new Set(data.map((r) => r.image_path).filter((p): p is string => p !== null))];
}

/** Exclusão de conta: apaga a pasta inteira do speaker. */
export async function removeAllOptionImages(admin: AdminSupabase, speakerId: string): Promise<void> {
  const bucket = admin.storage.from(OPTION_IMAGES_BUCKET);
  for (;;) {
    const { data, error } = await bucket.list(speakerId, { limit: 1000 });
    if (error || !data || data.length === 0) return;
    const { error: removeError } = await bucket.remove(data.map((f) => `${speakerId}/${f.name}`));
    if (removeError) return;
  }
}
