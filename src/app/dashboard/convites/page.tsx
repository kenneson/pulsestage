import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSpeakerProfile } from "@/lib/data/profile";
import { getOwnPublicProfile, listContactRequests } from "@/lib/data/speaker-profile";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { Alert } from "@/components/ui/misc";
import { ContactInbox } from "@/components/speaker-profile/contact-inbox";

export const metadata: Metadata = { title: "Convites" };

export default async function InvitesPage() {
  const profile = await getSpeakerProfile();
  const supabase = await createClient();
  const [settings, requests] = await Promise.all([getOwnPublicProfile(supabase, profile.id), listContactRequests(supabase)]);
  const receiving = Boolean(settings?.publicEnabled && settings.contactEnabled);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Convites</h1>
        <p className="text-muted-foreground">
          Pedidos enviados por instituições e empresas pelo botão “Convidar para palestrar” do seu perfil público. Seu
          e-mail não aparece para quem convida: você responde quando quiser.
        </p>
      </div>
      {!receiving ? (
        <Alert tone="info">
          Você não está recebendo convites agora.{" "}
          <Link href="/dashboard/perfil-publico" className="font-medium text-primary hover:underline">
            {settings?.publicEnabled ? "Ligue “Receber convites pelo perfil”" : "Publique seu perfil"}
          </Link>{" "}
          para começar.
        </Alert>
      ) : null}
      <ContactInbox
        items={requests.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          organization: r.organization,
          orgKind: r.orgKind,
          message: r.message,
          // Data do evento é só uma data (sem horário): formatada ao meio-dia UTC para não mudar de dia.
          eventDate: r.eventDate ? formatDate(`${r.eventDate}T12:00:00Z`, "UTC") : null,
          eventCity: r.eventCity,
          receivedAt: formatDateTime(r.createdAt, profile.timeZone),
          read: r.readAt !== null,
          archived: r.archivedAt !== null,
        }))}
      />
    </div>
  );
}
