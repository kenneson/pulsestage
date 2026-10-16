import "server-only";
import { serverEnv } from "@/lib/env.server";
import { requesterIpHash as ipHash } from "@/lib/request-ip";
import { publicEnv } from "@/lib/env";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/domain/locale";
import type { ContactRequestInput } from "@/lib/domain/speaker-profile";

/** Hash do IP de quem envia o convite: limita abuso sem guardar o IP. */
export async function requesterIpHash(): Promise<string | null> {
  return ipHash("contact");
}

/**
 * Avisa o palestrante por e-mail (Resend), se configurado. Falhas não impedem o convite: ele já
 * está gravado na caixa do painel. O e-mail do palestrante nunca aparece para quem convida;
 * a resposta vai direto para quem convidou (reply_to). Texto no idioma do perfil do palestrante.
 */
export async function notifySpeakerByEmail(
  to: string,
  speakerName: string | null,
  locale: Locale,
  input: ContactRequestInput,
): Promise<void> {
  const { RESEND_API_KEY, CONTACT_EMAIL_FROM } = serverEnv();
  if (!RESEND_API_KEY || !CONTACT_EMAIL_FROM) return;

  const [t, tDomain] = await Promise.all([
    getTranslations({ locale, namespace: "email.contactRequest" }),
    getTranslations({ locale, namespace: "domain" }),
  ]);
  // Data do evento é só uma data (sem horário): formatada ao meio-dia UTC para não mudar de dia.
  const eventDate = input.eventDate
    ? new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${input.eventDate}T12:00:00Z`))
    : null;

  const lines = [
    speakerName ? t("greeting", { name: speakerName }) : t("greetingNoName"),
    "",
    t("intro", { name: input.name }),
    "",
    input.organization
      ? input.orgKind
        ? t("organizationKind", { organization: input.organization, kind: tDomain(`orgKinds.${input.orgKind}`) })
        : t("organization", { organization: input.organization })
      : null,
    eventDate ? t("eventDate", { date: eventDate }) : null,
    input.eventCity ? t("eventCity", { city: input.eventCity }) : null,
    "",
    input.message,
    "",
    t("reply", { name: input.name, email: input.email }),
    t("inbox", { url: `${publicEnv.appUrl}/dashboard/convites` }),
  ].filter((line): line is string => line !== null);
  const subject = t("subject", { from: input.organization ?? input.name }).slice(0, 150);

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: CONTACT_EMAIL_FROM,
        to: [to],
        reply_to: input.email,
        subject,
        text: lines.join("\n"),
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Sem e-mail, o convite continua no painel.
  }
}
