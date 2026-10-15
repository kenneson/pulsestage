"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useTranslations } from "next-intl";
import {
  formatTicket,
  landingSchedule,
  RAFFLE_LANDING_MS,
  RAFFLE_SUSPENSE_MS,
  raffleDisplaySchema,
  reelSequence,
  type RaffleDisplay,
  type RaffleWinnerView,
} from "@/lib/domain/raffle";
import { playFanfare, playThump, playTick } from "@/lib/raffle/sound";
import { cn } from "@/lib/utils";
import { VolumeIcon } from "@/components/icons";

// Sorteio no telão. O ganhador já foi escolhido no servidor; o servidor só o entrega depois do
// suspense. Enquanto isso a roleta gira com os números de quem concorre; com o ganhador em mãos,
// desacelera até o número dele, para com uma batida e revela nome e avatar com fanfarra e confete.

type Phase =
  | { kind: "waiting" }
  | { kind: "rolling"; drawnAt: string }
  | { kind: "landing"; drawnAt: string; winner: RaffleWinnerView }
  | { kind: "revealed"; drawnAt: string; winner: RaffleWinnerView };

const LANDING_STEPS = 12;
const ROLL_MS = 85;

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function seedOf(id: string): number {
  let h = 0;
  for (const c of id) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
  return h;
}

const CONFETTI_COLORS = [
  "bg-shape-1",
  "bg-shape-2",
  "bg-shape-3",
  "bg-shape-4",
  "bg-shape-5",
  "bg-shape-6",
  "bg-shape-7",
  "bg-shape-8",
  "bg-primary",
] as const;

/** Confete em CSS (desligado com movimento reduzido). Posições fixas por índice. */
function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {Array.from({ length: 90 }, (_, i) => {
        // Pseudoaleatório estável por índice (sem correlação entre peças vizinhas).
        const r = (n: number) => {
          const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
          return x - Math.floor(x);
        };
        return (
          <span
            key={i}
            className={cn("confetti-piece rounded-[2px]", CONFETTI_COLORS[i % CONFETTI_COLORS.length])}
            style={
              {
                left: `${r(1) * 100}%`,
                "--drift": `${(r(2) - 0.5) * 30}vw`,
                "--spin": `${Math.round(r(3) * 900)}deg`,
                "--dur": `${2.6 + r(4) * 2.4}s`,
                "--delay": `${r(5) * 0.8}s`,
                width: `${8 + r(6) * 8}px`,
                height: `${12 + r(7) * 10}px`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

function AvatarBubble({ winner, className }: { winner: RaffleWinnerView; className?: string }) {
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-full bg-muted leading-none", className)}>
      {winner.avatar ?? <span className="font-display text-muted-foreground">{winner.name.charAt(0).toUpperCase()}</span>}
    </span>
  );
}

function Ticket({ value, digits, spinning }: { value: string; digits: number; spinning: boolean }) {
  return (
    <div
      className={cn(
        "rounded-3xl border-4 border-dashed px-14 py-8 font-display text-[11rem] font-bold leading-none tabular-nums",
        spinning ? "border-standby text-standby" : "border-primary text-primary",
      )}
      style={{ minWidth: `${digits * 0.7 + 1.5}em` }}
      aria-hidden
    >
      {value}
    </div>
  );
}

export function RaffleStage({
  sessionId,
  version,
  drawnAt,
  feedbackUrl,
  soundOn,
}: {
  sessionId: string;
  /** muda a cada "Mostrar no telão" */
  version: string | null;
  /** muda a cada sorteio (realtime) */
  drawnAt: string | null;
  feedbackUrl: string;
  soundOn: boolean;
}) {
  const t = useTranslations("display.raffle");
  const tDomain = useTranslations("domain");
  const [data, setData] = useState<RaffleDisplay | null>(null);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "waiting" });
  const [shown, setShown] = useState<number | null>(null);
  const handled = useRef<string | null>(null);
  const timers = useRef<number[]>([]);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  // Busca ao abrir, a cada sorteio e periodicamente (contagem de quem concorre; ganhador após o suspense).
  const waitingWinner = Boolean(data?.latest && !data.latest.winner);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(`/api/session/${sessionId}/raffle`, { cache: "no-store" })
        .then(async (res) => (res.ok ? raffleDisplaySchema.parse(await res.json()) : null))
        .catch(() => null)
        .then((next) => {
          if (cancelled) return;
          setFailed(next === null);
          if (next) setData(next);
        });
    void load();
    const id = window.setInterval(load, waitingWinner ? 700 : 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [sessionId, version, drawnAt, waitingWinner]);

  // Máquina de fases a partir do sorteio mais recente.
  const latest = data?.latest ?? null;
  useEffect(() => {
    if (!latest || !data) return;
    if (handled.current === latest.drawnAt) return;
    if (!latest.winner) {
      later(() => setPhase((p) => (p.kind === "rolling" && p.drawnAt === latest.drawnAt ? p : { kind: "rolling", drawnAt: latest.drawnAt })), 0);
      return;
    }
    handled.current = latest.drawnAt;
    const winner = latest.winner;
    const age = data.serverNow - Date.parse(latest.drawnAt);
    // Tela reaberta bem depois do sorteio, ou movimento reduzido: mostra direto.
    if (age > RAFFLE_SUSPENSE_MS + RAFFLE_LANDING_MS + 4000 || reducedMotion()) {
      later(() => {
        setShown(winner.number);
        setPhase({ kind: "revealed", drawnAt: latest.drawnAt, winner });
        if (age < 20_000) playFanfare();
      }, 0);
      return;
    }
    const sequence = reelSequence(data.numbers, winner.number, LANDING_STEPS, seedOf(winner.id));
    const times = landingSchedule(sequence.length, RAFFLE_LANDING_MS);
    later(() => setPhase({ kind: "landing", drawnAt: latest.drawnAt, winner }), 0);
    sequence.forEach((n, i) =>
      later(() => {
        setShown(n);
        if (i === sequence.length - 1) playThump();
        else playTick(i);
      }, times[i]!),
    );
    later(() => {
      setPhase({ kind: "revealed", drawnAt: latest.drawnAt, winner });
      playFanfare();
    }, RAFFLE_LANDING_MS + 700);
  }, [latest, data, later]);

  // Roleta girando enquanto o servidor ainda não revelou o ganhador.
  const numbers = data?.numbers;
  const rolling = phase.kind === "rolling" && latest?.drawnAt === phase.drawnAt;
  useEffect(() => {
    if (!rolling || !numbers || numbers.length === 0 || reducedMotion()) return;
    let i = 0;
    const id = window.setInterval(() => {
      setShown(numbers[Math.floor(Math.random() * numbers.length)]!);
      if (i++ % 2 === 0) playTick(0);
    }, ROLL_MS);
    return () => window.clearInterval(id);
  }, [rolling, numbers]);

  if (!data) {
    return (
      <p className="text-center text-3xl text-muted-foreground">
        {failed ? t("loadFailed") : t("loading")}
      </p>
    );
  }

  const prizeName = (id: string) => data.prizes.find((p) => p.id === id)?.name ?? t("prizeFallback");
  const maxNumber = Math.max(999, ...data.numbers, shown ?? 0);
  const digits = maxNumber > 999 ? 4 : 3;
  const current = latest && phase.kind !== "waiting" && phase.drawnAt === latest.drawnAt ? phase : null;
  const soundHint = !soundOn ? (
    <p className="fixed bottom-16 right-10 flex items-center gap-2 text-lg text-muted-foreground">
      <VolumeIcon width={20} height={20} /> {t("soundHint")}
    </p>
  ) : null;

  // ---- Sorteando: roleta e desaceleração --------------------------------------
  if (latest && (!current || current.kind === "rolling" || current.kind === "landing")) {
    return (
      <div className="flex flex-col items-center gap-10 text-center" aria-live="polite">
        <p className="text-3xl text-muted-foreground">{t("drawing")}</p>
        <h1 className="max-w-5xl text-6xl font-semibold leading-tight">{prizeName(latest.prizeId)}</h1>
        <Ticket value={shown === null ? "?".repeat(digits) : formatTicket(shown, maxNumber)} digits={digits} spinning={current?.kind !== "landing"} />
        <p className="text-2xl text-muted-foreground">
          {t("entrants", { count: data.entrants + 1 })}
        </p>
        {soundHint}
      </div>
    );
  }

  // ---- Ganhador revelado ------------------------------------------------------
  if (latest && current?.kind === "revealed") {
    const winner = current.winner;
    return (
      <div className="relative isolate flex flex-col items-center gap-6 text-center" aria-live="polite">
        <Confetti />
        <p className="text-3xl text-muted-foreground">{prizeName(latest.prizeId)}</p>
        <AvatarBubble winner={winner} className="raffle-pop size-48 text-[8rem]" />
        <h1 className="raffle-pop max-w-5xl text-7xl font-semibold leading-tight">{winner.name}</h1>
        <p className="font-display text-6xl font-bold tabular-nums text-primary">
          {t("ticket", { number: formatTicket(winner.number, maxNumber) })}
        </p>
        <p className="text-4xl">{t("congrats")}</p>
        {soundHint}
      </div>
    );
  }

  // ---- Antes do sorteio: prêmios e quem concorre -----------------------------
  const survey = data.eligibility === "survey";
  const surveyOpen = data.status === "completed";
  return (
    <div className="flex w-full max-w-6xl flex-col items-center gap-10 text-center">
      <h1 className="text-7xl font-semibold">{t("title")}</h1>
      <ul className="flex flex-wrap justify-center gap-5">
        {data.prizes.map((prize) => (
          <li key={prize.id} className="flex min-w-72 max-w-md flex-col gap-2 rounded-2xl border bg-card px-7 py-5 text-left">
            <span className="text-lg text-muted-foreground">
              {t("prizeMeta", { kind: tDomain(`prizeKinds.${prize.kind}`), quantity: prize.quantity })}
            </span>
            <span className="text-3xl font-semibold leading-snug">{prize.name}</span>
            {prize.description ? <span className="text-xl text-muted-foreground">{prize.description}</span> : null}
            {prize.winners.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-2">
                {prize.winners.map((w) => (
                  <li key={w.id} className="flex items-center gap-3 text-xl">
                    <AvatarBubble winner={w} className="size-10 text-2xl" />
                    <span className="min-w-0 flex-1 truncate">{w.name}</span>
                    <span className="font-display font-bold tabular-nums">
                      {t("ticket", { number: formatTicket(w.number, maxNumber) })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-10">
        {survey && surveyOpen ? (
          <div className="rounded-3xl bg-white p-4">
            <QRCodeSVG value={feedbackUrl} size={200} marginSize={0} />
          </div>
        ) : null}
        <div className="flex flex-col gap-3 text-left">
          <p className="text-5xl">
            {t.rich("entrantsBig", {
              count: data.entrants,
              num: (chunks) => <span className="font-display font-bold tabular-nums text-primary">{chunks}</span>,
            })}
          </p>
          <p className="max-w-xl text-2xl text-muted-foreground">
            {survey
              ? surveyOpen
                ? t("hintSurveyOpen")
                : t("hintSurveyLater")
              : t("hintEveryone")}
          </p>
        </div>
      </div>
      {soundHint}
    </div>
  );
}
