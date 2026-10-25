import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { listOwnedSessions } from "@/lib/data/sessions";
import { getSpeakerProfile } from "@/lib/data/profile";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { SessionList } from "@/components/sessions/session-list";
import { PlusIcon } from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.sessions");
  return { title: t("metaTitle") };
}

export default async function SessionsPage() {
  const supabase = await createClient();
  const [sessions, { timeZone }, t] = await Promise.all([
    listOwnedSessions(supabase),
    getSpeakerProfile(),
    getTranslations("dashboard.sessions"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <Link href="/dashboard/sessions/new" className={buttonVariants({ className: "max-md:h-11" })}>
          <PlusIcon /> {t("newSession")}
        </Link>
      </div>
      {sessions.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Link href="/dashboard/sessions/new" className={buttonVariants()}>
              <PlusIcon /> {t("newSession")}
            </Link>
          }
        />
      ) : (
        <SessionList sessions={sessions} timeZone={timeZone} duplicable />
      )}
    </div>
  );
}
