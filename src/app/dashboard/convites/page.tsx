import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSpeakerProfile } from "@/lib/data/profile";
import { getOwnPublicProfile, listContactRequests } from "@/lib/data/speaker-profile";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { Alert } from "@/components/ui/misc";
import { ContactInbox } from "@/components/speaker-profile/contact-inbox";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile.invites");
  return { title: t("metaTitle") };
}

export default async function InvitesPage() {
  const [t, locale, profile] = await Promise.all([getTranslations("profile.invites"), getLocale(), getSpeakerProfile()]);
  const supabase = await createClient();
  const [settings, requests] = await Promise.all([getOwnPublicProfile(supabase, profile.id), listContactRequests(supabase)]);
  const receiving = Boolean(settings?.publicEnabled && settings.contactEnabled);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      {!receiving ? (
        <Alert tone="info">
          {t.rich(settings?.publicEnabled ? "notReceivingEnable" : "notReceivingPublish", {
            link: (c) => (
              <Link href="/dashboard/perfil-publico" className="font-medium text-primary hover:underline">
                {c}
              </Link>
            ),
          })}
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
          eventDate: r.eventDate ? formatDate(`${r.eventDate}T12:00:00Z`, "UTC", locale) : null,
          eventCity: r.eventCity,
          receivedAt: formatDateTime(r.createdAt, profile.timeZone, locale),
          read: r.readAt !== null,
          archived: r.archivedAt !== null,
        }))}
      />
    </div>
  );
}
