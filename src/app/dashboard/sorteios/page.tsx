import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getRaffleState } from "@/lib/data/raffle";
import { getSpeakerProfile } from "@/lib/data/profile";
import { formatDateTime } from "@/lib/datetime";
import { PRIZE_KIND_LABEL, RAFFLE_ELIGIBILITY_META, isRaffleEligibility } from "@/lib/domain/raffle";
import { plural } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { StatusBadge } from "@/components/sessions/status-badge";
import { WinnerList } from "@/components/raffle/winner-list";

export const metadata: Metadata = { title: "Sorteios" };

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

  const [{ timeZone }, states] = await Promise.all([
    getSpeakerProfile(),
    Promise.all(sessions.map((s) => getRaffleState(supabase, s.id, s.raffle_eligibility))),
  ]);
  const pending = states.reduce(
    (sum, state) =>
      sum + state.prizes.reduce((n, p) => n + p.winners.filter((w) => !w.forfeitedAt && !w.deliveredAt).length, 0),
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Sorteios</h1>
        <p className="text-muted-foreground">
          Os sorteios das suas sessões, com os ganhadores e o controle de entrega dos prêmios. Para criar um, abra a
          sessão e use a aba “Sorteio”.
        </p>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          title="Nenhuma sessão com sorteio"
          description="Na página da sessão, a aba “Sorteio” liga o sorteio e cadastra os prêmios."
          action={
            <Link href="/dashboard/sessions" className={buttonVariants({ variant: "outline" })}>
              Ver sessões
            </Link>
          }
        />
      ) : (
        <>
          {pending > 0 ? (
            <p className="text-sm">
              <span className="font-display font-bold tabular-nums">{pending}</span>{" "}
              {pending === 1 ? "prêmio sorteado ainda não marcado como entregue." : "prêmios sorteados ainda não marcados como entregues."}
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
                      {mode ? <span className="text-xs text-muted-foreground">{RAFFLE_ELIGIBILITY_META[mode].label}</span> : null}
                    </div>
                    <CardTitle className="mt-2">{session.title}</CardTitle>
                    <CardDescription>
                      {formatDateTime(session.scheduled_at, timeZone)} · {plural(state.entrants, "pessoa concorrendo", "pessoas concorrendo")}
                    </CardDescription>
                  </div>
                  <Link href={`/dashboard/sessions/${session.id}?aba=sorteio`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Editar prêmios
                  </Link>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {state.prizes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum prêmio cadastrado.</p>
                  ) : (
                    state.prizes.map((prize) => (
                      <div key={prize.id} className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{prize.name}</span>
                          <Badge variant="outline">{PRIZE_KIND_LABEL[prize.kind]}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {prize.winners.filter((w) => !w.forfeitedAt).length} de{" "}
                            {plural(prize.quantity, "ganhador", "ganhadores")}
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
