import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { loadLibrary } from "@/lib/data/library";
import { listOwnedSessions } from "@/lib/data/sessions";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { LibraryTable } from "@/components/library/library-table";
import { PlusIcon } from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.library");
  return { title: t("metaTitle") };
}

export default async function LibraryPage() {
  const supabase = await createClient();
  const [items, sessions, t] = await Promise.all([
    loadLibrary(supabase),
    listOwnedSessions(supabase),
    getTranslations("dashboard.library"),
  ]);
  const openSessions = sessions.filter((s) => s.status !== "completed").map((s) => ({ id: s.id, title: s.title }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("intro")}</p>
        </div>
        <Link href="/dashboard/sessions/new" className={buttonVariants()}>
          <PlusIcon /> {t("newSession")}
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Link href="/dashboard/sessions/new" className={buttonVariants({ variant: "outline" })}>
              {t("createSession")}
            </Link>
          }
        />
      ) : (
        <LibraryTable items={items} sessions={openSessions} />
      )}
    </div>
  );
}
