import Link from "next/link";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme";
import { CueHero, CueLamp } from "@/components/landing/cue-hero";
import { CheckIcon } from "@/components/icons";

// Papéis de revisão do roteiro: cada tipo de interação tem a sua cor em todo o produto.
const REVISION_PAGES = [
  {
    paper: "bg-rev-blue",
    ink: "text-rev-blue-ink",
    color: "Página azul",
    type: "Enquete",
    text: "Uma escolha entre alternativas. Boa para abrir a sessão e conhecer quem está na sala.",
    example: "Você já usa IA no seu trabalho?",
  },
  {
    paper: "bg-rev-pink",
    ink: "text-rev-pink-ink",
    color: "Página rosa",
    type: "Escala",
    text: "Uma nota entre dois extremos, com rótulos nas pontas.",
    example: "De 1 a 5, quanto isso se aplica ao seu dia?",
  },
  {
    paper: "bg-rev-yellow",
    ink: "text-rev-yellow-ink",
    color: "Página amarela",
    type: "Nuvem de palavras",
    text: "Respostas curtas agrupadas: o que mais se repete cresce no telão.",
    example: "Uma palavra para o seu momento profissional.",
  },
  {
    paper: "bg-rev-green",
    ink: "text-rev-green-ink",
    color: "Página verde",
    type: "Pergunta aberta",
    text: "Resposta livre. Você lê tudo na sala ao vivo e escolhe o que comentar.",
    example: "O que você quer me perguntar?",
  },
  {
    paper: "bg-rev-gold",
    ink: "text-rev-gold-ink",
    color: "Página dourada",
    type: "Quiz",
    text: "Pergunta com resposta certa, pontos, tempo opcional e ranking.",
    example: "Qual destes é um modelo de linguagem?",
  },
];

type CueState = "done" | "go" | "standby" | "hold";

const CUE_SHEET: { cue: number; at: string; type: string; ink: string; question: string; state: CueState }[] = [
  { cue: 1, at: "0 min", type: "Enquete", ink: "text-rev-blue-ink", question: "Você já usa IA no seu trabalho?", state: "done" },
  { cue: 2, at: "12 min", type: "Nuvem de palavras", ink: "text-rev-yellow-ink", question: "Uma palavra para o seu momento", state: "go" },
  { cue: 3, at: "25 min", type: "Quiz", ink: "text-rev-gold-ink", question: "Qual destes é um modelo de linguagem?", state: "standby" },
  { cue: 4, at: "40 min", type: "Pergunta aberta", ink: "text-rev-green-ink", question: "O que você quer me perguntar?", state: "hold" },
];

const CUE_STATE_LABEL: Record<CueState, string> = {
  done: "Executada",
  go: "VAI",
  standby: "Atenção",
  hold: "Em espera",
};

// Exemplo ilustrativo (dados simulados) do que o analytics mostra depois da sessão.
const PULSE = [
  { minute: 0, rate: 0.82, label: "Enquete" },
  { minute: 12, rate: 0.91, label: "Nuvem" },
  { minute: 25, rate: 0.58, label: "Quiz" },
  { minute: 40, rate: 0.66, label: "Aberta" },
  { minute: 52, rate: 0.74, label: "Escala" },
];

const NOTES: { text: string; confidence: "alta" | "média" | "baixa"; sample: string }[] = [
  {
    text: "A nuvem de palavras teve a maior participação da sessão. Repita o formato no meio da próxima.",
    confidence: "alta",
    sample: "64 respostas",
  },
  {
    text: "A participação caiu no quiz dos 25 minutos. Os 20 segundos de tempo podem ter sido curtos.",
    confidence: "média",
    sample: "22 respostas",
  },
  {
    text: "Alguns comentários pedem mais exemplos práticos. Vale confirmar na próxima sessão.",
    confidence: "baixa",
    sample: "3 comentários",
  },
];

const SCORECARD = [
  { label: "Utilidade", value: "8,6", scale: "/10" },
  { label: "Clareza", value: "4,4", scale: "/5" },
  { label: "Engajamento", value: "4,1", scale: "/5" },
  { label: "Conteúdo", value: "4,5", scale: "/5" },
  { label: "Aplicabilidade", value: "3,9", scale: "/5" },
];

function ActHeading({ act, title, children }: { act: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h2 className="font-script text-[clamp(1.9rem,3.4vw,3rem)] font-bold leading-[1.05] tracking-[-0.03em] text-balance">
        <span className="text-muted-foreground dark:bg-highlight dark:px-1.5 dark:text-highlight-foreground">{act}.</span> {title}
      </h2>
      <p className="text-lg leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-grid min-w-7 place-items-center rounded border bg-card px-1.5 pb-0.5 font-script text-sm font-bold text-foreground shadow-[inset_0_-2px_0_var(--border)]">
      {children}
    </kbd>
  );
}

export default function Home() {
  const chartMax = 60;
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 md:px-6">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2">
          <a href="#ato-1" className={cn(buttonVariants({ variant: "ghost" }), "hidden sm:inline-flex")}>
            Como funciona
          </a>
          <ThemeToggle />
          <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
            Entrar
          </Link>
          <Link href="/signup" className={cn(buttonVariants(), "hidden sm:inline-flex")}>
            Criar conta
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-2 md:px-6 md:pb-28">
          <CueHero />
        </section>

        {/* Ato I: os cinco papéis de revisão. */}
        <section id="ato-1" className="scroll-mt-6 border-t bg-muted/40">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 md:px-6 md:py-28 lg:grid-cols-[2fr_3fr] lg:gap-16">
            <ActHeading act="Ato I" title="Antes: escreva o roteiro">
              Monte a sessão na ordem em que vai apresentar. Cada pergunta é uma deixa, e cada tipo de interação tem a
              sua cor, do roteiro ao telão.
            </ActHeading>
            <ol className="flex flex-col">
              {REVISION_PAGES.map((page, index) => (
                <li
                  key={page.type}
                  className={cn(
                    "group relative -mt-2 first:mt-0 rounded-sm px-5 dark:border dark:border-foreground/10 pb-5 pt-4 text-rev-foreground shadow-[0_10px_24px_-18px_color-mix(in_oklch,var(--foreground)_45%,transparent)] transition-transform duration-300 ease-out hover:-translate-y-1 focus-within:-translate-y-1",
                    page.paper,
                  )}
                  style={{ marginLeft: `${index * 0.75}rem`, zIndex: REVISION_PAGES.length - index }}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="font-script text-xl font-bold">{page.type}</h3>
                    <span className={cn("font-script text-xs font-bold uppercase tracking-widest", page.ink)}>{page.color}</span>
                  </div>
                  <p className="mt-1 max-w-[52ch] text-sm leading-relaxed">{page.text}</p>
                  <p className="mt-2 font-script text-sm italic opacity-80">“{page.example}”</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Ato II: a folha de deixas. */}
        <section className="border-t">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 md:px-6 md:py-28 lg:grid-cols-[3fr_2fr] lg:gap-16">
            <div className="flex flex-col gap-10 lg:order-2">
              <ActHeading act="Ato II" title="Durante: chame as deixas">
                Você conduz. O PulseStage cuida de levar cada pergunta ao celular da plateia e cada resposta ao telão.
              </ActHeading>
              <ul className="flex flex-col gap-4 text-base leading-relaxed">
                <li>
                  <strong className="font-semibold">A plateia entra em segundos</strong> pelo QR Code ou por um código
                  curto, como <span className="font-script font-bold">IA2026</span>. Sem conta, sem app, nome opcional.
                </li>
                <li>
                  <strong className="font-semibold">O telão mostra tudo ao vivo</strong>: a pergunta, os votos chegando, a
                  nuvem crescendo e o ranking do quiz.
                </li>
                <li>
                  <strong className="font-semibold">
                    A seta <Kbd>→</Kbd> chama a próxima deixa
                  </strong>
                  , então o passador de slides também serve. Pausar e retomar ficam a um clique.
                </li>
              </ul>
            </div>

            <div className="overflow-hidden rounded-sm bg-card dark:border shadow-[0_24px_48px_-32px_color-mix(in_oklch,var(--foreground)_40%,transparent)] lg:order-1">
              <div className="flex items-center justify-between border-b px-5 py-3 font-script text-sm">
                <span className="font-bold uppercase">Folha de deixas</span>
                <span className="text-muted-foreground">exemplo</span>
              </div>
              <table className="w-full font-script text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-widest text-muted-foreground">
                    <th scope="col" className="px-5 py-2 font-normal">Deixa</th>
                    <th scope="col" className="hidden px-2 py-2 font-normal sm:table-cell">Quando</th>
                    <th scope="col" className="px-2 py-2 font-normal">Pergunta</th>
                    <th scope="col" className="px-5 py-2 text-right font-normal">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {CUE_SHEET.map((row) => (
                    <tr key={row.cue} className={cn("border-b last:border-b-0", row.state === "go" && "bg-primary/[0.07]")}>
                      <td className="px-5 py-4 align-top text-2xl font-bold tabular-nums">{row.cue}</td>
                      <td className="hidden px-2 py-4 align-top tabular-nums text-muted-foreground sm:table-cell">{row.at}</td>
                      <td className="px-2 py-4 align-top">
                        <span className={cn("block text-xs font-bold uppercase tracking-widest", row.ink)}>{row.type}</span>
                        <span className={cn("font-sans text-base", row.state === "done" && "text-muted-foreground")}>{row.question}</span>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <span className="flex items-center justify-end gap-2 whitespace-nowrap font-bold">
                          {row.state === "done" ? (
                            <CheckIcon className="text-muted-foreground" />
                          ) : (
                            <CueLamp state={row.state === "hold" ? "off" : row.state} />
                          )}
                          <span className={cn("sr-only sm:not-sr-only", (row.state === "done" || row.state === "hold") && "text-muted-foreground")}>
                            {CUE_STATE_LABEL[row.state]}
                          </span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Ato III: as notas do diretor. */}
        <section className="border-t bg-muted/40">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 md:px-6 md:py-28 lg:grid-cols-[2fr_3fr] lg:gap-16">
            <div className="flex flex-col gap-8">
              <ActHeading act="Ato III" title="Depois: as notas do diretor">
                Ao encerrar, a plateia avalia a sessão pelo celular. Você recebe o que aconteceu de verdade: onde o
                público participou, o que achou e o que testar na próxima.
              </ActHeading>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Os números medem participação, não atenção. E cada nota da IA diz com quantas respostas foi tirada:
                pouca amostra, traço fraco.
              </p>
            </div>

            <article className="flex flex-col gap-8 rounded-sm bg-card p-6 dark:border font-script shadow-[0_24px_48px_-32px_color-mix(in_oklch,var(--foreground)_40%,transparent)] sm:p-8">
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-4">
                <h3 className="text-lg font-bold uppercase">Notas — “IA no trabalho”</h3>
                <span className="text-xs text-muted-foreground">exemplo com dados simulados</span>
              </header>

              <figure className="flex flex-col gap-3">
                <figcaption className="text-sm font-bold">Sinal de participação ao longo da sessão</figcaption>
                <svg viewBox="0 0 300 120" role="img" aria-label="Participação por deixa: 82%, 91%, 58%, 66% e 74%" className="h-auto w-full">
                  {[0.25, 0.5, 0.75, 1].map((g) => (
                    <line key={g} x1="0" x2="300" y1={100 - g * 90} y2={100 - g * 90} stroke="var(--border)" strokeWidth="1" />
                  ))}
                  <line x1="0" x2="300" y1="100" y2="100" stroke="var(--foreground)" strokeOpacity="0.35" strokeWidth="1" />
                  {PULSE.map((p) => {
                    const x = 14 + (p.minute / chartMax) * 270;
                    const h = p.rate * 90;
                    const low = p.rate < 0.6;
                    return (
                      <g key={p.minute}>
                        <rect x={x - 9} y={100 - h} width="18" height={h} rx="2" fill={low ? "var(--standby)" : "var(--primary)"} />
                        <text x={x} y={94 - h} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--foreground)">
                          {Math.round(p.rate * 100)}%
                        </text>
                        <text x={x} y="113" textAnchor="middle" fontSize="8" fill="var(--muted-foreground)">
                          {p.minute}′
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </figure>

              <ol className="flex flex-col gap-4">
                {NOTES.map((note, index) => (
                  <li key={index} className="grid grid-cols-[1.5rem_1fr] gap-x-2">
                    <span className="font-bold tabular-nums">{index + 1}.</span>
                    <div className="flex flex-col gap-1">
                      <p
                        className={cn(
                          "text-base leading-relaxed underline decoration-2 underline-offset-[6px]",
                          note.confidence === "alta" && "decoration-foreground",
                          note.confidence === "média" && "decoration-foreground/50",
                          note.confidence === "baixa" && "decoration-foreground/40 decoration-dashed decoration-1",
                        )}
                      >
                        {note.text}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        confiança {note.confidence} · {note.sample}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t pt-5 sm:grid-cols-3 xl:grid-cols-5">
                {SCORECARD.map((s) => (
                  <div key={s.label} className="flex flex-col">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</dt>
                    <dd className="text-xl font-bold tabular-nums">
                      {s.value}
                      <span className="text-sm font-normal text-muted-foreground">{s.scale}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          </div>
        </section>

        {/* Fecho. */}
        <section className="border-t">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-8 px-4 py-24 md:px-6 md:py-32">
            <h2 className="max-w-4xl font-script text-[clamp(2.6rem,6vw,5.5rem)] font-bold leading-[0.98] tracking-[-0.035em] text-balance">
              A próxima deixa é sua.
            </h2>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              Para quem sobe ao palco, dá aula ou conduz treinamentos. Crie a primeira sessão em poucos minutos, com Google
              ou e-mail. Grátis durante o beta.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/signup" className={buttonVariants({ size: "lg" })}>
                Criar minha sessão
              </Link>
              <Link href="/login" className={buttonVariants({ size: "lg", variant: "outline" })}>
                Entrar
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground md:px-6">
          <span className="font-script">PulseStage · plateia → interação → dados → melhoria</span>
          <Link href="/privacidade" className="underline-offset-4 hover:text-foreground hover:underline">
            Privacidade
          </Link>
        </div>
      </footer>
    </div>
  );
}
