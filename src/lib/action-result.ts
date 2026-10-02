import type { z } from "zod";

export type ActionFailure = { ok: false; error: string; code?: string };
export type ActionResult<T = null> = { ok: true; data: T } | ActionFailure;

export function ok<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

export function fail(error: string, code?: string): ActionFailure {
  return code ? { ok: false, error, code } : { ok: false, error };
}

export function firstIssue(error: z.ZodError, fallback = "Dados inválidos."): string {
  return error.issues[0]?.message ?? fallback;
}

/** Converte FormData em objeto, tratando strings vazias como ausentes. */
export function formValues<K extends string>(formData: FormData, keys: readonly K[]): Record<K, string | undefined> {
  const out = {} as Record<K, string | undefined>;
  for (const key of keys) {
    const value = formData.get(key);
    out[key] = typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
  }
  return out;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
