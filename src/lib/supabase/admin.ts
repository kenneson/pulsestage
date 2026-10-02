import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "./database.types";

export type AdminSupabase = ReturnType<typeof createAdminClient>;

/**
 * Cliente com a secret key: ignora o RLS.
 * Use APENAS nos fluxos do participante, sempre depois de validar o cookie assinado,
 * e para leituras públicas sanitizadas (sem is_correct, sem dados pessoais).
 */
export function createAdminClient() {
  return createClient<Database>(publicEnv.supabaseUrl, serverEnv().SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
