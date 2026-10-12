"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ShapeGlyph, shapeBg } from "@/components/option-shape";
import { CheckIcon } from "@/components/icons";

// Palco da landing: telão (escuro, como o projetor de verdade) e celular da plateia, passando sozinhos
// por quatro cenas. Tudo simulado e rotulado como demonstração; nenhum dado real.

const SCENES = [
  { id: "poll", label: "Enquete" },
  { id: "cloud", label: "Nuvem de palavras" },
  { id: "quiz", label: "Quiz e ranking" },
  { id: "raffle", label: "Sorteio" },
] as const;
type SceneId = (typeof SCENES)[number]["id"];

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
  { label: "Sim, todo dia", pct: 46 },
  { label: "Estou começando", pct: 31 },
  { label: "Ainda não", pct: 15 },
  { label: "Só por curiosidade", pct: 8 },
];

function usePollScene() {
  const phase = usePhases(3, [500, 2600]);
  return {
    screen: (
      <div className="flex h-full flex-col justify-center gap-[4%] px-[7%]">
        <p className="text-[3.6cqw] font-semibold leading-tight">Você já usa IA no seu trabalho?</p>
        <ul className="flex flex-col gap-[0.6em] text-[2.3cqw]">
          {POLL.map((o, i) => (
            <li key={o.label} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
              <span>{o.label}</span>
              <span className="font-script font-bold tabular-nums">{phase > 0 ? o.pct : 0}%</span>
              <span className="col-span-2 h-[0.55em] overflow-hidden rounded-full bg-muted">
                <span
                  className={cn("block h-full origin-left rounded-full transition-transform duration-[1800ms] ease-out", i === 0 ? "bg-foreground" : "bg-foreground/35")}
                  style={{ transform: `scaleX(${phase > 0 ? o.pct / 100 : 0})` }}
                />
              </span>
            </li>
          ))}
        </ul>
        <p className="font-script text-[1.8cqw] text-muted-foreground tabular-nums">
          {phase > 0 ? "86 respostas" : "Aguardando respostas…"}
        </p>
      </div>
    ),
    phone: (
      <div className="flex flex-col gap-1.5">
        <p className="text-[0.6rem] font-semibold leading-tight">Você já usa IA no seu trabalho?</p>
        {POLL.map((o, i) => (
          <span
            key={o.label}
            className={cn(
              "rounded-md border px-1.5 py-1 text-[0.55rem] leading-tight transition-colors",
              phase > 0 && i === 0 ? "border-primary bg-primary/10" : "border-border",
            )}
          >
            {o.label}
          </span>
        ))}
        <span className={cn("mt-0.5 flex items-center gap-1 text-[0.55rem] font-medium text-primary transition-opacity", phase > 1 ? "opacity-100" : "opacity-0")}>
          <CheckIcon width={10} height={10} /> Resposta enviada
        </span>
      </div>
    ),
  };
}

// Posições fixas (em %) para a nuvem montar sempre igual.
const WORDS = [
  { text: "colaboração", size: 2.6, x: 50, y: 46, strong: true },
  { text: "foco", size: 1.9, x: 24, y: 28 },
  { text: "aprender", size: 1.7, x: 74, y: 26 },
  { text: "tempo", size: 1.5, x: 22, y: 66 },
  { text: "criatividade", size: 1.3, x: 76, y: 68 },
  { text: "dados", size: 1.1, x: 48, y: 18 },
  { text: "clientes", size: 1, x: 46, y: 80 },
  { text: "equipe", size: 0.95, x: 88, y: 46 },
  { text: "futuro", size: 0.9, x: 10, y: 46 },
];

function useCloudScene() {
  const phase = usePhases(3, [400, 2800]);
  return {
    screen: (
      <div className="flex h-full flex-col px-[6%] pt-[5%]">
        <p className="text-center text-[3.3cqw] font-semibold leading-tight">
          Uma palavra para o seu momento profissional
        </p>
        <div className="relative flex-1" aria-hidden>
          {WORDS.map((w, i) => (
            <span
              key={w.text}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-semibold transition-[opacity,transform] duration-700 ease-out",
                w.strong ? "text-primary" : i % 2 ? "text-foreground/70" : "text-foreground",
                phase > 0 ? "scale-100 opacity-100" : "scale-75 opacity-0",
              )}
              style={{
                left: `${w.x}%`,
                top: `${w.y}%`,
                fontSize: `${1.9 * w.size}cqw`,
                transitionDelay: `${i * 160}ms`,
              }}
            >
              {w.text}
            </span>
          ))}
        </div>
      </div>
    ),
    phone: (
      <div className="flex flex-col gap-1.5">
        <p className="text-[0.6rem] font-semibold leading-tight">Uma palavra para o seu momento profissional</p>
        <span className="rounded-md border px-1.5 py-1 font-medium text-[0.6rem]">
          {phase > 0 ? "colaboração" : <span className="text-muted-foreground">Uma palavra…</span>}
        </span>
        <span className={cn("rounded-md bg-primary py-1 text-center text-[0.55rem] font-medium text-primary-foreground transition-opacity", phase > 1 ? "opacity-60" : "opacity-100")}>
          {phase > 1 ? "Enviado" : "Enviar resposta"}
        </span>
      </div>
    ),
  };
}

const RANKING = [
  { avatar: "🦉", name: "Carla", from: 3, points: 1950 },
  { avatar: "🦊", name: "Ana", from: 1, points: 1820 },
  { avatar: "🐼", name: "Bruno", from: 2, points: 1610 },
  { avatar: "🐙", name: "Participante 7F2A", from: 4, points: 1240 },
];
const QUIZ_OPTIONS = ["GPT", "Excel", "Linux", "HTML"];

function useQuizScene() {
  const phase = usePhases(3, [700, 1900]);
  return {
    screen: (
      <div className="flex h-full flex-col justify-center gap-[5%] px-[8%]">
        <p className="text-center text-[3.6cqw] font-semibold">Ranking do quiz</p>
        <ol className="relative" style={{ height: `${RANKING.length * 2.6}em` }} aria-label="Ranking simulado">
          {RANKING.map((r, i) => {
            const position = phase > 1 ? i : r.from - 1;
            return (
              <li
                key={r.name}
                className={cn(
                  "absolute inset-x-0 flex h-[2.15em] items-center gap-[0.6em] rounded-md px-[0.7em] text-[2.3cqw] transition-transform duration-700 ease-out",
                  i === 0 && phase > 1 ? "bg-primary/20" : "bg-muted",
                )}
                style={{ transform: `translateY(${position * 2.6}em)` }}
              >
                <span className="w-[1.6em] font-script font-bold tabular-nums">{position + 1}º</span>
                <span aria-hidden className="text-[1.25em] leading-none">{r.avatar}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
                <span className="font-script font-bold tabular-nums">{r.points.toLocaleString("pt-BR")}</span>
              </li>
            );
          })}
        </ol>
      </div>
    ),
    phone: (
      <div className="flex flex-col gap-1.5">
        <p className="text-[0.6rem] font-semibold leading-tight">Qual destes é um modelo de linguagem?</p>
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
          Certa! +950 pts
        </span>
      </div>
    ),
  };
}

const TICKETS = [42, 317, 88, 205, 761, 133, 509, 64, 274, 690, 412, 156];

function useRaffleScene() {
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
        <p className="text-[2.4cqw] text-muted-foreground">{phase > 1 ? "Livro autografado" : "Sorteando"}</p>
        {phase > 1 ? (
          <>
            <span aria-hidden className="grid size-[3.2em] place-items-center rounded-full bg-muted text-[5cqw] leading-none">
              🦉
            </span>
            <p className="text-[4.6cqw] font-semibold leading-none">Carla</p>
            <p className="font-script text-[3cqw] font-bold text-primary tabular-nums">nº 042 · Parabéns!</p>
          </>
        ) : (
          <span
            className={cn(
              "rounded-xl border-2 border-dashed px-[0.5em] font-script text-[12cqw] font-bold leading-tight tabular-nums",
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
          <p className="text-[0.65rem] font-semibold">Você ganhou!</p>
          <p className="text-[0.55rem]">Livro autografado</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-0.5 rounded-lg border-2 border-dashed border-primary/60 p-2 text-center">
          <p className="text-[0.55rem] text-muted-foreground">Seu número da sorte</p>
          <p className="font-script text-xl font-bold text-primary tabular-nums">042</p>
          <p className="text-[0.5rem] text-muted-foreground">Fique de olho no telão.</p>
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
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto || reducedMotion()) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % SCENES.length), SCENE_MS);
    return () => window.clearTimeout(id);
  }, [index, auto]);

  const scene = SCENES[index]!;
  const Stage = STAGES[scene.id];
  return (
    <figure className="flex flex-col gap-4" aria-label="Demonstração do PulseStage com dados simulados">
      <div role="tablist" aria-label="Cenas da demonstração" className="flex flex-wrap gap-1.5">
        {SCENES.map((s, i) => (
          <button
            key={s.id}
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
            {s.label}
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
      <div role="tabpanel" aria-label={scene.label} className="pb-8">
        <Stage key={scene.id} />
      </div>
      <figcaption className="text-xs text-muted-foreground">
        Telão e celular da plateia · demonstração com dados simulados
      </figcaption>
    </figure>
  );
}
