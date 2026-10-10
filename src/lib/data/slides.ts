import "server-only";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { SessionRow } from "@/lib/supabase/types";
import { isSlideFormat, slidePath } from "@/lib/domain/deck";

export const SLIDES_BUCKET = "slides";

// O bucket é privado: o projetor (público) e o painel recebem URLs assinadas geradas aqui.
// 12 h cobre um dia de evento; recarregar a página gera novas.
const SIGNED_URL_SECONDS = 12 * 60 * 60;

export type DeckSession = Pick<SessionRow, "id" | "speaker_id" | "slides_batch" | "slide_count" | "slides_format">;

export function slidePaths(session: DeckSession): string[] {
  const { slides_batch: batch, slides_format: format } = session;
  if (!batch || !isSlideFormat(format)) return [];
  return Array.from({ length: session.slide_count }, (_, index) =>
    slidePath(session.speaker_id, session.id, batch, index, format),
  );
}

/** URLs assinadas dos slides, na ordem. Lista vazia quando a sessão não tem slides. */
export async function getSlideUrls(client: ServerSupabase | AdminSupabase, session: DeckSession): Promise<string[]> {
  const paths = slidePaths(session);
  if (paths.length === 0) return [];
  const { data, error } = await client.storage.from(SLIDES_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error) throw new Error(error.message);
  const byPath = new Map(data.map((item) => [item.path, item.signedUrl]));
  return paths.map((path) => byPath.get(path) ?? "");
}

type Bucket = ReturnType<(ServerSupabase | AdminSupabase)["storage"]["from"]>;

async function listFiles(bucket: Bucket, folder: string, depth: number, skip?: string): Promise<string[]> {
  const { data: entries } = await bucket.list(folder, { limit: 1000 });
  const files: string[] = [];
  for (const entry of entries ?? []) {
    const path = `${folder}/${entry.name}`;
    if (entry.id) files.push(path);
    else if (depth > 0 && entry.name !== skip) files.push(...(await listFiles(bucket, path, depth - 1)));
  }
  return files;
}

/**
 * Apaga arquivos de slides: de uma sessão ({speaker}/{sessão}) ou de um speaker inteiro ({speaker}).
 * `keepBatch` preserva o lote em uso; os demais (trocas de PDF, envios interrompidos) somem.
 */
export async function removeSlideFiles(
  client: ServerSupabase | AdminSupabase,
  folder: string,
  keepBatch?: string,
): Promise<void> {
  const bucket = client.storage.from(SLIDES_BUCKET);
  const files = await listFiles(bucket, folder, 2, keepBatch);
  for (let i = 0; i < files.length; i += 500) {
    await bucket.remove(files.slice(i, i + 500));
  }
}
