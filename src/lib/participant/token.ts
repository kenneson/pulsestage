import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { serverEnv } from "@/lib/env.server";

// Cookie HTTP-only assinado (HMAC-SHA256) que identifica o participante numa sessão.
// Participantes não têm conta: esta é a única credencial deles.

const PARTICIPANT_COOKIE_PREFIX = "ps_p_";
const FEEDBACK_COOKIE_PREFIX = "ps_fb_";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const payloadSchema = z.object({ p: z.string(), s: z.string(), iat: z.number() });
type Payload = z.infer<typeof payloadSchema>;

function sign(data: string): string {
  return createHmac("sha256", serverEnv().PARTICIPANT_TOKEN_SECRET).update(data).digest("base64url");
}

function encode(payload: Payload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

function decode(token: string): Payload | null {
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;
  const expected = Buffer.from(sign(data));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(Buffer.from(data, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};

export async function setParticipantCookie(sessionId: string, participantId: string): Promise<void> {
  const store = await cookies();
  store.set(PARTICIPANT_COOKIE_PREFIX + sessionId, encode({ p: participantId, s: sessionId, iat: Date.now() }), cookieOptions);
}

/** Retorna o participant_id do cookie, apenas se a assinatura e a sessão baterem. */
export async function getParticipantIdFromCookie(sessionId: string): Promise<string | null> {
  const store = await cookies();
  const token = store.get(PARTICIPANT_COOKIE_PREFIX + sessionId)?.value;
  if (!token) return null;
  const payload = decode(token);
  return payload && payload.s === sessionId ? payload.p : null;
}

export async function markFeedbackSent(sessionId: string): Promise<void> {
  const store = await cookies();
  store.set(FEEDBACK_COOKIE_PREFIX + sessionId, "1", cookieOptions);
}

export async function hasSentFeedback(sessionId: string): Promise<boolean> {
  const store = await cookies();
  return store.get(FEEDBACK_COOKIE_PREFIX + sessionId)?.value === "1";
}
