import "server-only";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env.server";
import { signParticipantToken, verifyParticipantToken } from "./token-core";

// Cookie HTTP-only assinado (HMAC-SHA256) que identifica o participante numa sessão.
// Participantes não têm conta: esta é a única credencial deles. A assinatura fica em token-core.ts (testável).

const PARTICIPANT_COOKIE_PREFIX = "ps_p_";
const FEEDBACK_COOKIE_PREFIX = "ps_fb_";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};

export async function setParticipantCookie(sessionId: string, participantId: string): Promise<void> {
  const store = await cookies();
  const token = signParticipantToken(serverEnv().PARTICIPANT_TOKEN_SECRET, sessionId, participantId);
  store.set(PARTICIPANT_COOKIE_PREFIX + sessionId, token, cookieOptions);
}

/** Retorna o participant_id do cookie, apenas se a assinatura e a sessão baterem. */
export async function getParticipantIdFromCookie(sessionId: string): Promise<string | null> {
  const store = await cookies();
  const token = store.get(PARTICIPANT_COOKIE_PREFIX + sessionId)?.value;
  if (!token) return null;
  return verifyParticipantToken(serverEnv().PARTICIPANT_TOKEN_SECRET, sessionId, token);
}

export async function markFeedbackSent(sessionId: string): Promise<void> {
  const store = await cookies();
  store.set(FEEDBACK_COOKIE_PREFIX + sessionId, "1", cookieOptions);
}

export async function hasSentFeedback(sessionId: string): Promise<boolean> {
  const store = await cookies();
  return store.get(FEEDBACK_COOKIE_PREFIX + sessionId)?.value === "1";
}
