import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { serverEnv } from "@/lib/env.server";

/**
 * Hash do IP de quem faz a requisição, com o segredo do servidor e um propósito ("contact", "survey"):
 * serve para limitar abuso sem guardar o IP. Sem cabeçalho de IP (fora da Vercel), null.
 */
export async function requesterIpHash(purpose: string): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim();
  if (!ip) return null;
  return createHmac("sha256", serverEnv().PARTICIPANT_TOKEN_SECRET).update(`${purpose}:${ip}`).digest("base64url");
}
