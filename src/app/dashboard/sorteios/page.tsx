import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getRaffleState } from "@/lib/data/raffle";
import { getSpeakerProfile } from "@/lib/data/profile";
import { formatDateTime } from "@/lib/datetime";
import { isRaffleEligibility } from "@/lib/domain/raffle";
import { formatInt } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { StatusBadge } from "@/components/sessions/status-badge";
import { WinnerList } from "@/components/raffle/winner-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.raffles");
  return { title: t("metaTitle") };
}

const MAX_SESSIONS = 30;

/** Todos os sorteios do speaker: prêmios, ganhadores e o que já foi entregue. */
export default async function RafflesPage() {
  const supabase = await createClient();
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("id, title, status, scheduled_at, raffle_eligibility")
    .not("raffle_eligibility", "is", null)
    .order("scheduled_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(MAX_SESSIONS);
  if (error) throw new Error(error.message);

  const [{ timeZone }, t, tDomain, tStates, locale] = await Promise.all([
    getSpeakerProfile(),
    getTranslations("dashboard.raffles"),
    getTranslations("domain"),
    getTranslations("common.states"),
    getLocale(),
  ]);
  const anonymous = tDomain("anonymousParticipant");
  const states = await Promise.all(sessions.map((s) => getRaffleState(supabase, s.id, s.raffle_eligibility, anonymous)));
  const pending = states.reduce(
    (sum, state) =>
      sum + state.prizes.reduce((n, p) => n + p.winners.filter((w) => !w.forfeitedAt && !w.deliveredAt).length, 0),
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Link href="/dashboard/sessions" className={buttonVariants({ variant: "outline" })}>
              {t("seeSessions")}
            </Link>
          }
        />
      ) : (
        <>
          {pending > 0 ? (
            <p className="text-sm">
              <span className="font-display font-bold tabular-nums">{formatInt(pending, locale)}</span>{" "}
              {t("pendingDeliveries", { count: pending })}
            </p>
          ) : null}
          {sessions.map((session, index) => {
            const state = states[index]!;
            const mode = isRaffleEligibility(session.raffle_eligibility) ? session.raffle_eligibility : null;
            return (
              <Card key={session.id}>
                <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={session.status} />
                      {mode ? <span className="text-xs text-muted-foreground">{tDomain(`raffleEligibility.${mode}.label`)}</span> : null}
                    </div>
                    <CardTitle className="mt-2">{session.title}</CardTitle>
                    <CardDescription>
                      {session.scheduled_at ? formatDateTime(session.scheduled_at, timeZone, locale) : tStates("noDate")} ·{" "}
                      {t("entrants", { count: state.entrants })}
                    </CardDescription>
                  </div>
                  <Link href={`/dashboard/sessions/${session.id}?aba=sorteio`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    {t("editPrizes")}
                  </Link>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {state.prizes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("noPrizes")}</p>
                  ) : (
                    state.prizes.map((prize) => (
                      <div key={prize.id} className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{prize.name}</span>
                          <Badge variant="outline">{tDomain(`prizeKinds.${prize.kind}`)}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {t("winners", {
                              drawn: prize.winners.filter((w) => !w.forfeitedAt).length,
                              count: prize.quantity,
                            })}
                          </span>
                        </div>
                        <WinnerList winners={prize.winners} />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
