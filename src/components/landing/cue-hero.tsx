"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { JoinCodeForm } from "@/components/join-code-form";

// Demonstração da deixa: respostas simuladas, nunca dados reais. Rotulada como tal na tela.
const OPTIONS = [
  { label: "Sim, todo dia", target: 35 },
  { label: "Estou começando", target: 21 },
  { label: "Ainda não", target: 10 },
  { label: "Só por curiosidade", target: 7 },
] as const;
const TOTAL = OPTIONS.reduce((sum, o) => sum + o.target, 0);

type Phase = "idle" | "standby" | "go" | "done";

/** Luz de deixa: âmbar = atenção, verde = VAI. O texto ao lado diz o estado (nunca só a cor). */
export function CueLamp({ state, className }: { state: "off" | "standby" | "go"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-4 shrink-0 rounded-full border-2 transition-[background-color,box-shadow] duration-300",
        state === "off" && "border-foreground/25 bg-foreground/10",
        state === "standby" && "border-standby bg-standby shadow-[0_0_0_4px_color-mix(in_oklch,var(--standby)_30%,transparent)]",
        state === "go" && "border-primary bg-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_30%,transparent)]",
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

  return { phase, votes, call };
}

export function CueHero() {
  const { phase, votes, call } = useCueDemo();
  const lamp = phase === "standby" ? "standby" : phase === "idle" ? "off" : "go";
  const answered = votes.reduce((a, b) => a + b, 0);
  const leader = Math.max(...votes);
  const status =
    phase === "idle" ? "Em espera" : phase === "standby" ? "Atenção…" : phase === "go" ? "VAI: respostas chegando" : "Deixa executada";

  const cueButton = (
    <button
      type="button"
      onClick={call}
      disabled={phase === "standby" || phase === "go"}
      className={cn(
        "group inline-flex h-11 items-center gap-3 rounded-md border-2 border-foreground px-4 font-script text-base font-bold uppercase tracking-wide transition-colors",
        "hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-progress disabled:opacity-70 disabled:hover:bg-transparent disabled:hover:text-foreground",
      )}
    >
      <CueLamp state={lamp} />
      {phase === "done" ? "De novo" : "Vai"}
    </button>
  );

  return (
    <div className="relative grid overflow-hidden rounded-sm bg-card dark:border text-card-foreground shadow-[0_24px_48px_-28px_color-mix(in_oklch,var(--foreground)_35%,transparent)] md:grid-cols-[13rem_1fr]">
      {/* Furos do fichário do diretor de cena. */}
      <div aria-hidden className="absolute inset-y-0 left-3 hidden flex-col justify-around md:flex">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-4 rounded-full border border-foreground/15 bg-background shadow-[inset_0_1px_2px_color-mix(in_oklch,var(--foreground)_25%,transparent)]" />
        ))}
      </div>

      {/* Margem de deixas. */}
      <aside
        aria-label="Margem de deixas"
        className="flex items-center justify-between gap-4 border-b border-dashed px-5 py-4 font-script md:flex-col md:items-start md:justify-start md:border-b-0 md:border-r md:py-10 md:pl-12 md:pr-6"
      >
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Deixa 1 <span className="text-rev-blue-ink">· enquete</span>
          </span>
          <span role="status" aria-live="polite" className="text-sm font-bold">
            {status}
          </span>
        </div>
        {cueButton}
        <p className="hidden text-xs leading-relaxed text-muted-foreground md:block">
          Aperte para chamar a deixa, como faria no palco.
        </p>
      </aside>

      {/* Página do roteiro. */}
      <div className="flex flex-col gap-6 px-5 py-8 font-script sm:px-10 md:py-12 lg:px-16">
        <p className="text-sm font-bold uppercase underline decoration-1 underline-offset-4">Int. Auditório — noite</p>
        <p className="max-w-[58ch] text-base leading-relaxed">
          Duzentas pessoas, celulares no bolso. As luzes baixam e o palestrante sobe ao palco.
        </p>

        <div className="relative sm:pl-36">
          <span aria-hidden className="absolute left-0 top-[0.9em] hidden text-sm font-bold uppercase sm:block">
            Palestrante.
          </span>
          <h1 className="text-balance text-[clamp(2.1rem,4.4vw,3.9rem)] font-bold leading-[1.05] tracking-[-0.03em]">
            Seu público fala. Você entende.
            <br />
            <mark className="bg-highlight box-decoration-clone px-1 text-highlight-foreground">
              Sua próxima palestra fica melhor.
            </mark>
          </h1>
        </div>

        <div className="flex flex-col gap-5 sm:pl-36">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link href="/signup" className={buttonVariants({ size: "lg", className: "font-sans" })}>
            Criar minha sessão
          </Link>
          <span className="font-sans text-sm text-muted-foreground">
            Grátis durante o beta ·{" "}
            <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
              já tenho conta
            </Link>
          </span>
        </div>

          <div className="flex max-w-md flex-col gap-2 rounded-sm bg-muted/70 p-4 font-sans">
            <p className="text-sm font-medium">Vai assistir a uma palestra? Digite o código que aparece no telão.</p>
            <JoinCodeForm />
          </div>
        </div>

        <div className="flex max-w-[60ch] flex-col gap-3 border-t border-dashed pt-6">
          <p className="text-base leading-relaxed">
            Ela pergunta. A plateia responde pelo celular, sem app e sem cadastro, e o resultado aparece no telão na
            hora. No fim, o PulseStage entrega as notas do que funcionou.
          </p>

          {phase === "idle" ? (
            <div className="flex flex-col items-start gap-4 rounded-sm border border-dashed p-5">
              <p className="text-base italic leading-relaxed text-muted-foreground">
                (No telão, a pergunta espera a deixa. Aperte VAI para chamá-la.)
              </p>
              {cueButton}
            </div>
          ) : (
            <figure
              aria-label="Demonstração de enquete com respostas simuladas"
              className="flex min-h-[15.5rem] flex-col gap-3 rounded-sm border bg-background/60 p-4"
            >
              <figcaption className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-bold uppercase">Insert — telão</span>
                <span className="text-xs text-muted-foreground">demonstração · respostas simuladas</span>
              </figcaption>
              <p className="font-sans text-lg font-semibold leading-snug">Você já usa IA no seu trabalho?</p>
              <ul className="flex flex-col gap-2">
                {OPTIONS.map((o, i) => {
                  const count = votes[i] ?? 0;
                  const pct = answered > 0 ? count / answered : 0;
                  const leading = answered > 0 && count === leader;
                  return (
                    <li key={o.label} className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1">
                      <span className="font-sans text-sm">{o.label}</span>
                      <span className="text-sm tabular-nums">{Math.round(pct * 100)}%</span>
                      <span className="col-span-2 h-2.5 overflow-hidden rounded-full bg-rev-blue">
                        <span
                          className={cn(
                            "block h-full rounded-full transition-[width] duration-300 ease-out",
                            leading ? "bg-rev-blue-ink" : "bg-rev-blue-ink/55",
                          )}
                          style={{ width: `${Math.round(pct * 100)}%` }}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs tabular-nums text-muted-foreground">
                {answered} respostas
              </p>
            </figure>
          )}
        </div>

      </div>
    </div>
  );
}
