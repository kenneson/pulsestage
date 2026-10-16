import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

// Assinatura do cookie do participante (HMAC-SHA256), sem depender de cookies() nem do ambiente:
// recebe o segredo por parâmetro para poder ser testada no Node. O wrapper em token.ts lê o segredo e o cookie.
// Formato: base64url(JSON {p, s, iat}) + "." + base64url(HMAC(segredo, parte 1)).

const payloadSchema = z.object({ p: z.string(), s: z.string(), iat: z.number() });
type Payload = z.infer<typeof payloadSchema>;

function sign(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

function decode(secret: string, token: string): Payload | null {
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;
  const expected = Buffer.from(sign(secret, data));
  const received = Buffer.from(signature);
  // Comparação em tempo constante (o tamanho é checado antes, como timingSafeEqual exige).
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(Buffer.from(data, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Token assinado que liga o participante à sessão. `iat` só registra quando foi emitido. */
export function signParticipantToken(secret: string, sessionId: string, participantId: string, iat = Date.now()): string {
  const payload: Payload = { p: participantId, s: sessionId, iat };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(secret, data)}`;
}

/** participant_id do token, apenas se a assinatura bater e o token for desta sessão; senão null. */
export function verifyParticipantToken(secret: string, sessionId: string, token: string): string | null {
  const payload = decode(secret, token);
  return payload && payload.s === sessionId ? payload.p : null;
}
