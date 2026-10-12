import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { serverEnv } from "@/lib/env.server";
import { publicEnv } from "@/lib/env";
import { ORG_KIND_LABEL, type ContactRequestInput } from "@/lib/domain/speaker-profile";

/** Hash do IP de quem envia o convite (com segredo do servidor): limita abuso sem guardar o IP. */
export async function requesterIpHash(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim();
  if (!ip) return null;
  return createHmac("sha256", serverEnv().PARTICIPANT_TOKEN_SECRET).update(`contact:${ip}`).digest("base64url");
}

/**
 * Avisa o palestrante por e-mail (Resend), se configurado. Falhas não impedem o convite: ele já
 * está gravado na caixa do painel. O e-mail do palestrante nunca aparece para quem convida;
 * a resposta vai direto para quem convidou (reply_to).
 */
export async function notifySpeakerByEmail(to: string, speakerName: string, input: ContactRequestInput): Promise<void> {
  const { RESEND_API_KEY, CONTACT_EMAIL_FROM } = serverEnv();
  if (!RESEND_API_KEY || !CONTACT_EMAIL_FROM) return;

  const lines = [
    `Olá, ${speakerName}!`,
    "",
    `${input.name} enviou um convite pelo seu perfil público no PulseStage.`,
    "",
    input.organization ? `Instituição: ${input.organization}${input.orgKind ? ` (${ORG_KIND_LABEL[input.orgKind]})` : ""}` : null,
    input.eventDate ? `Data do evento: ${input.eventDate.split("-").reverse().join("/")}` : null,
    input.eventCity ? `Cidade: ${input.eventCity}` : null,
    "",
    input.message,
    "",
    `Responda este e-mail para falar com ${input.name} (${input.email}).`,
    `Seus convites: ${publicEnv.appUrl}/dashboard/convites`,
  ].filter((line): line is string => line !== null);

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: CONTACT_EMAIL_FROM,
        to: [to],
        reply_to: input.email,
        subject: `Convite para palestrar: ${input.organization ?? input.name}`.slice(0, 150),
        text: lines.join("\n"),
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Sem e-mail, o convite continua no painel.
  }
}
