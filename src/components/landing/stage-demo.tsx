"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatInt } from "@/lib/format";
import { ShapeGlyph, shapeBg } from "@/components/option-shape";
import { CheckIcon } from "@/components/icons";

// Palco da landing: telão (escuro, como o projetor de verdade) e celular da plateia, passando sozinhos
// por quatro cenas. Tudo simulado e rotulado como demonstração; nenhum dado real.
// Textos (e os exemplos fictícios de cada idioma) em landing.demo.

const SCENES = ["poll", "cloud", "quiz", "raffle"] as const;
type SceneId = (typeof SCENES)[number];

const SCENE_MS = 7000;

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Avança fases de uma cena com atrasos fixos; com movimento reduzido, vai direto à última. */
function usePhases(count: number, delays: number[]): number {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (reducedMotion()) {
      const id = window.setTimeout(() => setPhase(count - 1), 0);
      return () => window.clearTimeout(id);
    }
    const ids = delays.map((ms, i) => window.setTimeout(() => setPhase(i + 1), ms));
    return () => ids.forEach((id) => window.clearTimeout(id));
    // As cenas remontam a cada troca (key): os atrasos são fixos por cena.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return phase;
}

// ---------------------------------------------------------------------------
// Cenas: telão + celular
// ---------------------------------------------------------------------------

const POLL = [
  { label: "daily", pct: 46 },
  { label: "starting", pct: 31 },
  { label: "notYet", pct: 15 },
  { label: "curious", pct: 8 },
] as const;

function usePollScene() {
  const t = useTranslations("landing.demo.poll");
  const phase = usePhases(3, [500, 2600]);
  return {
    screen: (
      <div className="flex h-full flex-col justify-center gap-[4%] px-[7%]">
        <p className="text-[3.6cqw] font-semibold leading-tight">{t("question")}</p>
        <ul className="flex flex-col gap-[0.6em] text-[2.3cqw]">
          {POLL.map((o, i) => (
            <li key={o.label} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
              <span>{t(`options.${o.label}`)}</span>
              <span className="font-display font-bold tabular-nums">{phase > 0 ? o.pct : 0}%</span>
              <span className="col-span-2 h-[0.55em] overflow-hidden rounded-full bg-muted">
                <span
                  className={cn("block h-full origin-left rounded-full transition-transform duration-[1800ms] ease-out", i === 0 ? "bg-foreground" : "bg-foreground/35")}
                  style={{ transform: `scaleX(${phase > 0 ? o.pct / 100 : 0})` }}
                />
              </span>
            </li>
          ))}
        </ul>
        <p className="font-display text-[1.8cqw] text-muted-foreground tabular-nums">
          {phase > 0 ? t("responses", { count: 86 }) : t("waiting")}
        </p>
      </div>
    ),
    phone: (
      <div className="flex flex-col gap-1.5">
        <p className="text-[0.6rem] font-semibold leading-tight">{t("question")}</p>
        {POLL.map((o, i) => (
          <span
            key={o.label}
            className={cn(
              "rounded-md border px-1.5 py-1 text-[0.55rem] leading-tight transition-colors",
              phase > 0 && i === 0 ? "border-primary bg-primary/10" : "border-border",
            )}
          >
            {t(`options.${o.label}`)}
          </span>
        ))}
        <span className={cn("mt-0.5 flex items-center gap-1 text-[0.55rem] font-medium text-primary transition-opacity", phase > 1 ? "opacity-100" : "opacity-0")}>
          <CheckIcon width={10} height={10} /> {t("sent")}
        </span>
      </div>
    ),
  };
}

// Posições fixas (em %) para a nuvem montar sempre igual.
const WORDS = [
  { text: "w1", size: 2.6, x: 50, y: 46, strong: true },
  { text: "w2", size: 1.9, x: 24, y: 28 },
  { text: "w3", size: 1.7, x: 74, y: 26 },
  { text: "w4", size: 1.5, x: 22, y: 66 },
  { text: "w5", size: 1.3, x: 76, y: 68 },
  { text: "w6", size: 1.1, x: 48, y: 18 },
  { text: "w7", size: 1, x: 46, y: 80 },
  { text: "w8", size: 0.95, x: 88, y: 46 },
  { text: "w9", size: 0.9, x: 10, y: 46 },
] as const;

function useCloudScene() {
  const t = useTranslations("landing.demo.cloud");
  const phase = usePhases(3, [400, 2800]);
  return {
    screen: (
      <div className="flex h-full flex-col px-[6%] pt-[5%]">
        <p className="text-center text-[3.3cqw] font-semibold leading-tight">
          {t("question")}
        </p>
        <div className="relative flex-1" aria-hidden>
          {WORDS.map((w, i) => (
            <span
              key={w.text}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-semibold transition-[opacity,transform] duration-700 ease-out",
                "strong" in w ? "text-primary" : i % 2 ? "text-foreground/70" : "text-foreground",
                phase > 0 ? "scale-100 opacity-100" : "scale-75 opacity-0",
              )}
              style={{
                left: `${w.x}%`,
                top: `${w.y}%`,
                fontSize: `${1.9 * w.size}cqw`,
                transitionDelay: `${i * 160}ms`,
              }}
            >
              {t(`words.${w.text}`)}
            </span>
          ))}
        </div>
      </div>
    ),
    phone: (
      <div className="flex flex-col gap-1.5">
        <p className="text-[0.6rem] font-semibold leading-tight">{t("question")}</p>
        <span className="rounded-md border px-1.5 py-1 font-medium text-[0.6rem]">
          {phase > 0 ? t("words.w1") : <span className="text-muted-foreground">{t("placeholder")}</span>}
        </span>
        <span className={cn("rounded-md bg-primary py-1 text-center text-[0.55rem] font-medium text-primary-foreground transition-opacity", phase > 1 ? "opacity-60" : "opacity-100")}>
          {phase > 1 ? t("sent") : t("send")}
        </span>
      </div>
    ),
  };
}

const RANKING = [
  { avatar: "🦉", name: "Carla", from: 3, points: 1950 },
  { avatar: "🦊", name: "Ana", from: 1, points: 1820 },
  { avatar: "🐼", name: "Bruno", from: 2, points: 1610 },
  // Sem nome: "Participante" (área domain) e o código.
  { avatar: "🐙", name: null, from: 4, points: 1240 },
];
const QUIZ_OPTIONS = ["GPT", "Excel", "Linux", "HTML"];

function useQuizScene() {
  const t = useTranslations("landing.demo.quiz");
  const tDomain = useTranslations("domain");
  const locale = useLocale();
  const phase = usePhases(3, [700, 1900]);
  return {
    screen: (
      <div className="flex h-full flex-col justify-center gap-[5%] px-[8%]">
        <p className="text-center text-[3.6cqw] font-semibold">{t("leaderboard")}</p>
        <ol className="relative" style={{ height: `${RANKING.length * 2.6}em` }} aria-label={t("leaderboardLabel")}>
          {RANKING.map((r, i) => {
            const position = phase > 1 ? i : r.from - 1;
            return (
              <li
                key={r.from}
                className={cn(
                  "absolute inset-x-0 flex h-[2.15em] items-center gap-[0.6em] rounded-md px-[0.7em] text-[2.3cqw] transition-transform duration-700 ease-out",
                  i === 0 && phase > 1 ? "bg-primary/20" : "bg-muted",
                )}
                style={{ transform: `translateY(${position * 2.6}em)` }}
              >
                <span className="w-[1.6em] font-display font-bold tabular-nums">{t("place", { n: position + 1 })}</span>
                <span aria-hidden className="text-[1.25em] leading-none">{r.avatar}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{r.name ?? `${tDomain("anonymousParticipant")} 7F2A`}</span>
                <span className="font-display font-bold tabular-nums">{formatInt(r.points, locale)}</span>
              </li>
            );
          })}
        </ol>
      </div>
    ),
    phone: (
      <div className="flex flex-col gap-1.5">
        <p className="text-[0.6rem] font-semibold leading-tight">{t("question")}</p>
        <div className="grid grid-cols-2 gap-1">
          {QUIZ_OPTIONS.map((label, i) => (
            <span
              key={label}
              className={cn(
                "flex items-center gap-1 rounded-md px-1 py-1.5 text-[0.55rem] font-semibold text-white transition-shadow",
                shapeBg(i),
                phase > 0 && i === 0 && "ring-2 ring-foreground ring-offset-1 ring-offset-card",
              )}
            >
              <ShapeGlyph index={i} className="size-2.5 text-white" />
              {label}
            </span>
          ))}
        </div>
        <span className={cn("rounded-md bg-primary/15 py-1 text-center text-[0.55rem] font-semibold text-primary transition-opacity", phase > 0 ? "opacity-100" : "opacity-0")}>
          {t("correct", { points: formatInt(950, locale) })}
        </span>
      </div>
    ),
  };
}

const TICKETS = [42, 317, 88, 205, 761, 133, 509, 64, 274, 690, 412, 156];

function useRaffleScene() {
  const t = useTranslations("landing.demo.raffle");
  const phase = usePhases(3, [2600, 3400]);
  const [roll, setRoll] = useState(0);
  useEffect(() => {
    if (phase > 0 || reducedMotion()) return;
    const id = window.setInterval(() => setRoll((n) => n + 1), 90);
    return () => window.clearInterval(id);
  }, [phase]);
  const number = phase > 0 ? 42 : TICKETS[roll % TICKETS.length]!;
  return {
    screen: (
      <div className="flex h-full flex-col items-center justify-center gap-[4%] text-center">
        <p className="text-[2.4cqw] text-muted-foreground">{phase > 1 ? t("prize") : t("drawing")}</p>
        {phase > 1 ? (
          <>
            <span aria-hidden className="grid size-[3.2em] place-items-center rounded-full bg-muted text-[5cqw] leading-none">
              🦉
            </span>
            <p className="text-[4.6cqw] font-semibold leading-none">Carla</p>
            <p className="font-display text-[3cqw] font-bold text-primary tabular-nums">{t("winnerNumber", { number: "042" })}</p>
          </>
        ) : (
          <span
            className={cn(
              "rounded-xl border-2 border-dashed px-[0.5em] font-display text-[12cqw] font-bold leading-tight tabular-nums",
              phase > 0 ? "border-primary text-primary" : "border-standby text-standby",
            )}
          >
            {String(number).padStart(3, "0")}
          </span>
        )}
      </div>
    ),
    phone:
      phase > 1 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border-2 border-primary bg-primary/10 p-2 text-center">
          <span aria-hidden className="text-base leading-none">🎉</span>
          <p className="text-[0.65rem] font-semibold">{t("youWon")}</p>
          <p className="text-[0.55rem]">{t("prize")}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-0.5 rounded-lg border-2 border-dashed border-primary/60 p-2 text-center">
          <p className="text-[0.55rem] text-muted-foreground">{t("luckyNumber")}</p>
          <p className="font-display text-xl font-bold text-primary tabular-nums">042</p>
          <p className="text-[0.5rem] text-muted-foreground">{t("watchScreen")}</p>
        </div>
      ),
  };
}

type Views = { screen: React.ReactNode; phone: React.ReactNode };

function Frame({ screen, phone }: Views) {
  return (
    <div className="relative">
      {/* Telão: coxia escura, como a tela do projetor de verdade. */}
      <div className="dark @container aspect-video overflow-hidden rounded-md bg-background text-foreground border shadow-[0_30px_60px_-30px_color-mix(in_oklch,var(--foreground)_55%,transparent)]">
        {screen}
      </div>
      {/* Celular da plateia. */}
      <div className="absolute -bottom-8 -right-2 hidden w-[30%] max-w-44 rounded-[1.4rem] border-[5px] border-foreground bg-card p-2 pt-3 text-card-foreground shadow-[0_24px_40px_-20px_color-mix(in_oklch,var(--foreground)_60%,transparent)] sm:-right-6 sm:block lg:-right-16">
        <span aria-hidden className="mx-auto mb-2 block h-1 w-8 rounded-full bg-foreground/20" />
        {phone}
      </div>
    </div>
  );
}

const PollStage = () => <Frame {...usePollScene()} />;
const CloudStage = () => <Frame {...useCloudScene()} />;
const QuizStage = () => <Frame {...useQuizScene()} />;
const RaffleStage = () => <Frame {...useRaffleScene()} />;
const STAGES: Record<SceneId, () => React.ReactNode> = {
  poll: PollStage,
  cloud: CloudStage,
  quiz: QuizStage,
  raffle: RaffleStage,
};

export function StageDemo() {
  const t = useTranslations("landing.demo");
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto || reducedMotion()) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % SCENES.length), SCENE_MS);
    return () => window.clearTimeout(id);
  }, [index, auto]);

  const scene = SCENES[index]!;
  const Stage = STAGES[scene];
  return (
    <figure className="flex flex-col gap-4" aria-label={t("ariaLabel")}>
      <div role="tablist" aria-label={t("scenesLabel")} className="flex flex-wrap gap-1.5">
        {SCENES.map((s, i) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={i === index}
            onClick={() => {
              setAuto(false);
              setIndex(i);
            }}
            className={cn(
              "relative h-8 overflow-hidden rounded-md border px-3 text-xs font-medium transition-colors",
              i === index ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
            )}
          >
            {t(`scenes.${s}`)}
            {i === index && auto ? (
              <span
                aria-hidden
                key={`p${index}`}
                className="stage-progress absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary"
                style={{ animationDuration: `${SCENE_MS}ms` }}
              />
            ) : null}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={t(`scenes.${scene}`)} className="pb-8">
        <Stage key={scene} />
      </div>
      <figcaption className="text-xs text-muted-foreground">
        {t("caption")}
      </figcaption>
    </figure>
  );
}
