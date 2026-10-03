"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { JoinCodeForm } from "@/components/join-code-form";
import { CheckIcon } from "@/components/icons";

// Demonstração no hero: respostas simuladas, nunca dados reais. Rotulada como tal na tela.
const OPTIONS = [
  { label: "Sim, todo dia", target: 35 },
  { label: "Estou começando", target: 21 },
  { label: "Ainda não", target: 10 },
  { label: "Só por curiosidade", target: 7 },
] as const;
const TOTAL = OPTIONS.reduce((sum, o) => sum + o.target, 0);

type Phase = "idle" | "standby" | "go" | "done";

/** Posição da linha na entrada em sequência do roteiro (ver .script-line em globals.css). */
const line = (n: number) => ({ "--line": n }) as React.CSSProperties;

/** Luz de deixa: âmbar = atenção, verde = VAI. O texto ao lado diz o estado (nunca só a cor). */
export function CueLamp({
  state,
  pulse = false,
  className,
}: {
  state: "off" | "standby" | "go";
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-4 shrink-0 rounded-full border-2 transition-[background-color,box-shadow] duration-300",
        state === "off" && "border-foreground/25 bg-foreground/10",
        state === "standby" && "border-standby bg-standby shadow-[0_0_0_4px_color-mix(in_oklch,var(--standby)_30%,transparent)]",
        state === "go" && "border-primary bg-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_30%,transparent)]",
        state === "go" && pulse && "cue-live",
        className,
      )}
    />
  );
}

function useCueDemo() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [votes, setVotes] = useState<number[]>(() => OPTIONS.map(() => 0));
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  function call() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setVotes(OPTIONS.map(() => 0));
    setPhase("standby");

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timers.current.push(
      window.setTimeout(() => {
        setPhase("go");
        if (reduce) {
          setVotes(OPTIONS.map((o) => o.target));
          setPhase("done");
          return;
        }
        // Cada voto cai numa opção sorteada entre as que ainda não chegaram ao alvo.
        const current = OPTIONS.map(() => 0);
        let cast = 0;
        const tick = () => {
          const open = OPTIONS.map((o, i) => o.target - (current[i] ?? 0)).flatMap((left, i) => Array<number>(left).fill(i));
          const pick = open[Math.floor(Math.random() * open.length)];
          if (pick === undefined) return;
          current[pick] = (current[pick] ?? 0) + 1;
          cast++;
          setVotes([...current]);
          if (cast >= TOTAL) {
            setPhase("done");
            return;
          }
          // Começa rápido e desacelera, como a plateia respondendo.
          timers.current.push(window.setTimeout(tick, 18 + (cast / TOTAL) * 70));
        };
        tick();
      }, 900),
    );
  }

  const callRef = useRef(call);
  useEffect(() => {
    callRef.current = call;
  });

  // Roda a demonstração uma vez sozinha, depois que o hero termina de entrar.
  useEffect(() => {
    const start = window.setTimeout(() => callRef.current(), 1600);
    return () => window.clearTimeout(start);
  }, []);

  return { phase, votes, call };
}

const FACTS = [
  "A plateia entra pelo QR Code ou por um código, sem baixar app",
  "As respostas aparecem no telão na hora",
  "No fim, você recebe a avaliação do público e um relatório",
];

export function CueHero() {
  const { phase, votes, call } = useCueDemo();
  const lamp = phase === "standby" ? "standby" : phase === "idle" ? "off" : "go";
  const answered = votes.reduce((a, b) => a + b, 0);
  const leader = Math.max(...votes);
  const status =
    phase === "idle"
      ? "Pronta para abrir"
      : phase === "standby"
        ? "Abrindo a votação…"
        : phase === "go"
          ? "No ar: respostas chegando"
          : "Votação encerrada";

  return (
    <div className="grid gap-10 rounded-sm bg-card p-6 text-card-foreground shadow-[0_24px_48px_-28px_color-mix(in_oklch,var(--foreground)_35%,transparent)] dark:border sm:p-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:p-14">
      <div className="flex flex-col gap-6">
        <h1
          className="script-line text-balance font-script text-[clamp(2.1rem,4.2vw,3.6rem)] font-bold leading-[1.05] tracking-[-0.03em]"
          style={line(0)}
        >
          Enquetes, quiz e perguntas{" "}
          <mark className="highlighter box-decoration-clone px-1 text-highlight-foreground">ao vivo</mark> para palestras e
          aulas.
        </h1>
        <p className="script-line max-w-[56ch] text-lg leading-relaxed text-muted-foreground" style={line(1)}>
          Você projeta a pergunta, a plateia responde pelo celular e o resultado aparece na tela em segundos. Depois,
          o PulseStage mostra o que funcionou para a sua próxima apresentação ser melhor.
        </p>
        <ul className="script-line flex flex-col gap-2" style={line(2)}>
          {FACTS.map((fact) => (
            <li key={fact} className="flex items-start gap-2.5">
              <CheckIcon className="mt-1 shrink-0 text-primary" />
              <span>{fact}</span>
            </li>
          ))}
        </ul>
        <div className="script-line flex flex-wrap items-center gap-x-5 gap-y-3" style={line(3)}>
          <Link href="/signup" className={buttonVariants({ size: "lg" })}>
            Criar minha sessão
          </Link>
          <span className="text-sm text-muted-foreground">
            Grátis durante o beta ·{" "}
            <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
              já tenho conta
            </Link>
          </span>
        </div>
        <div className="script-line flex max-w-md flex-col gap-2 rounded-sm bg-muted/70 p-4" style={line(4)}>
          <p className="text-sm font-medium">Vai participar de uma palestra? Digite o código que aparece na tela.</p>
          <JoinCodeForm />
        </div>
      </div>

      {/* Demonstração: o que a plateia vê no telão. */}
      <figure
        aria-label="Demonstração de enquete com respostas simuladas"
        className="script-line flex flex-col gap-4 self-start rounded-sm border bg-background/60 p-5 sm:p-6"
        style={line(2)}
      >
        <figcaption className="flex flex-col gap-1">
          <span className="font-script text-sm font-bold uppercase">Experimente: é assim que aparece no telão</span>
          <span className="text-xs text-muted-foreground">Demonstração com respostas simuladas.</span>
        </figcaption>

        <p className="text-xl font-semibold leading-snug">Você já usa IA no seu trabalho?</p>
        <ul className="flex flex-col gap-3">
          {OPTIONS.map((o, i) => {
            const count = votes[i] ?? 0;
            const pct = answered > 0 ? count / answered : 0;
            const leading = answered > 0 && count === leader;
            return (
              <li key={o.label} className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1.5">
                <span className="text-sm">{o.label}</span>
                <span className="font-script text-sm font-bold tabular-nums">{Math.round(pct * 100)}%</span>
                <span className="col-span-2 h-3 overflow-hidden rounded-full bg-rev-blue">
                  <span
                    className={cn(
                      "block h-full origin-left rounded-full transition-transform duration-300 ease-out",
                      leading ? "bg-rev-blue-ink" : "bg-rev-blue-ink/55",
                    )}
                    style={{ transform: `scaleX(${pct})` }}
                  />
                </span>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed pt-4">
          <span role="status" aria-live="polite" className="flex items-center gap-2 text-sm">
            <CueLamp state={lamp} pulse={phase === "go"} />
            <span className="font-medium">{status}</span>
            <span className="font-script tabular-nums text-muted-foreground">· {answered} respostas</span>
          </span>
          <button
            type="button"
            onClick={call}
            disabled={phase === "standby" || phase === "go"}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-md border-2 border-foreground px-4 text-sm font-semibold",
              "transition-[color,background-color,scale] duration-150 ease-out active:scale-[0.97]",
              "hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:cursor-progress disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-foreground",
            )}
          >
            {phase === "done" ? "Simular de novo" : "Simular votação"}
          </button>
        </div>
      </figure>
    </div>
  );
}
