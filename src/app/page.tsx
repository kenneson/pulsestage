import Link from "next/link";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme";
import { CueHero, CueLamp } from "@/components/landing/cue-hero";
import { CheckIcon } from "@/components/icons";
import { MAX_PARTICIPANTS_PER_SESSION } from "@/lib/domain/session";

const STEPS = [
  {
    title: "Crie a sessão",
    text: "Cadastre sua palestra ou aula e escreva as perguntas na ordem em que vai usá-las. Leva poucos minutos.",
  },
  {
    title: "A plateia entra pelo celular",
    text: "Mostre o QR Code ou o código na tela. Cada pessoa responde do próprio celular, sem instalar nada e sem criar conta.",
  },
  {
    title: "Veja e aprenda",
    text: "Os resultados aparecem ao vivo na tela. No fim, o público avalia a sessão e você recebe um relatório.",
  },
];

// Cada tipo de pergunta tem a sua cor em todo o produto (papel de revisão do roteiro).
const QUESTION_TYPES = [
  {
    paper: "bg-rev-blue",
    type: "Enquete",
    text: "Uma escolha entre alternativas. Boa para abrir a sessão e conhecer quem está na sala.",
    example: "Você já usa IA no seu trabalho?",
  },
  {
    paper: "bg-rev-pink",
    type: "Escala",
    text: "Uma nota entre dois extremos, como de 1 a 5.",
    example: "De 1 a 5, quanto isso se aplica ao seu dia?",
  },
  {
    paper: "bg-rev-yellow",
    type: "Nuvem de palavras",
    text: "Respostas curtas agrupadas: as palavras mais repetidas crescem na tela.",
    example: "Uma palavra para o seu momento profissional.",
  },
  {
    paper: "bg-rev-green",
    type: "Pergunta aberta",
    text: "Resposta livre. Você lê tudo no seu painel e escolhe o que comentar.",
    example: "O que você quer me perguntar?",
  },
  {
    paper: "bg-rev-gold",
    type: "Quiz",
    text: "Pergunta com resposta certa, pontos, tempo opcional e ranking dos participantes.",
    example: "Qual destes é um modelo de linguagem?",
  },
];

type RowState = "done" | "live" | "next" | "waiting";

const SESSION_PLAN: { n: number; at: string; type: string; ink: string; question: string; state: RowState }[] = [
  { n: 1, at: "0 min", type: "Enquete", ink: "text-rev-blue-ink", question: "Você já usa IA no seu trabalho?", state: "done" },
  { n: 2, at: "12 min", type: "Nuvem de palavras", ink: "text-rev-yellow-ink", question: "Uma palavra para o seu momento", state: "live" },
  { n: 3, at: "25 min", type: "Quiz", ink: "text-rev-gold-ink", question: "Qual destes é um modelo de linguagem?", state: "next" },
  { n: 4, at: "40 min", type: "Pergunta aberta", ink: "text-rev-green-ink", question: "O que você quer me perguntar?", state: "waiting" },
];

const ROW_STATE_LABEL: Record<RowState, string> = {
  done: "Encerrada",
  live: "No ar",
  next: "Próxima",
  waiting: "Aguardando",
};

// Exemplo ilustrativo (dados simulados) do relatório depois da sessão.
const PULSE = [
  { minute: 0, rate: 0.82 },
  { minute: 12, rate: 0.91 },
  { minute: 25, rate: 0.58 },
  { minute: 40, rate: 0.66 },
  { minute: 52, rate: 0.74 },
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

const AUDIENCES = [
  {
    who: "Palestrantes",
    text: "Quebre o gelo na abertura, puxe a plateia no meio e descubra depois o que realmente marcou.",
  },
  {
    who: "Professores",
    text: "Confira na hora se a turma entendeu, com quiz e perguntas anônimas que todo mundo tem coragem de responder.",
  },
  {
    who: "Treinadores e facilitadores",
    text: "Colete a opinião do grupo em segundos e leve dados concretos para o relatório do treinamento.",
  },
];

const FAQ = [
  {
    q: "A plateia precisa baixar algum aplicativo?",
    a: "Não. As pessoas apontam a câmera do celular para o QR Code ou digitam o código no navegador. Não precisam de conta, e o nome é opcional.",
  },
  {
    q: "Quanto custa?",
    a: "Nada durante o beta. Você cria sua conta com Google ou e-mail e usa todos os recursos.",
  },
  {
    q: "Funciona junto com meus slides?",
    a: "Sim. O PulseStage abre em uma aba própria: você alterna entre os slides e a tela de resultados, ou usa uma segunda tela para o projetor. A seta do teclado, ou o passador de slides, avança para a próxima pergunta.",
  },
  {
    q: "Quantas pessoas podem participar?",
    a: `Até ${MAX_PARTICIPANTS_PER_SESSION.toLocaleString("pt-BR")} participantes por sessão. Cada pessoa responde uma vez por pergunta.`,
  },
  {
    q: "E os dados de quem participa?",
    a: "A participação pode ser anônima. Contato só é guardado com autorização e fica separado das respostas. A análise com IA usa apenas dados agregados, nunca nomes ou contatos.",
  },
];

function SectionHeading({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="reveal flex max-w-2xl flex-col gap-4">
      <h2 className="font-script text-[clamp(1.8rem,3.2vw,2.75rem)] font-bold leading-[1.08] tracking-[-0.03em] text-balance">
        {title}
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

/** Escalona itens lado a lado na revelação por rolagem (ver .reveal em globals.css). */
const stagger = (i: number) => ({ "--i": i }) as React.CSSProperties;

const paperShadow = "shadow-[0_24px_48px_-32px_color-mix(in_oklch,var(--foreground)_40%,transparent)]";

export default function Home() {
  const chartMax = 60;
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="site-header sticky top-0 z-30">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <Logo />
          <nav className="flex items-center gap-1 sm:gap-2">
            <a href="#como-funciona" className={cn(buttonVariants({ variant: "ghost" }), "hidden sm:inline-flex")}>
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
      </div>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 md:px-6 md:pb-24">
          <CueHero />
        </section>

        {/* Como funciona: três passos (a ordem importa). */}
        <section id="como-funciona" className="border-t">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-20 md:px-6 md:py-24">
            <SectionHeading title="Como funciona">
              Três passos, do cadastro ao relatório. Você continua apresentando do seu jeito.
            </SectionHeading>
            <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
              {STEPS.map((step, index) => (
                <li key={step.title} className="reveal flex flex-col gap-3 border-t-2 border-foreground pt-5" style={stagger(index)}>
                  <span className="font-script text-5xl font-bold leading-none tabular-nums" aria-hidden>
                    {index + 1}
                  </span>
                  <h3 className="text-xl font-semibold">{step.title}</h3>
                  <p className="leading-relaxed text-muted-foreground">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Tipos de pergunta. */}
        <section className="border-t bg-muted/40">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 md:px-6 md:py-24 lg:grid-cols-[2fr_3fr] lg:gap-16">
            <SectionHeading title="Cinco tipos de pergunta">
              Misture os formatos ao longo da apresentação. Cada tipo tem a sua cor, no seu painel e na tela do projetor.
            </SectionHeading>
            <ol className="flex flex-col">
              {QUESTION_TYPES.map((item, index) => (
                <li
                  key={item.type}
                  className={cn(
                    "reveal-page group relative -mt-2 first:mt-0 rounded-sm px-5 pb-5 pt-4 text-rev-foreground shadow-[0_10px_24px_-18px_color-mix(in_oklch,var(--foreground)_45%,transparent)] transition-transform duration-200 ease-out hover:-translate-y-1 dark:border dark:border-foreground/10",
                    item.paper,
                  )}
                  style={{ marginLeft: `${index * 0.75}rem`, zIndex: QUESTION_TYPES.length - index }}
                >
                  <h3 className="font-script text-xl font-bold">{item.type}</h3>
                  <p className="mt-1 max-w-[52ch] text-sm leading-relaxed">{item.text}</p>
                  <p className="mt-2 font-script text-sm italic opacity-80">Ex.: “{item.example}”</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Durante a apresentação. */}
        <section className="border-t">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 md:px-6 md:py-24 lg:grid-cols-[3fr_2fr] lg:gap-16">
            <div className="flex flex-col gap-10 lg:order-2">
              <SectionHeading title="Durante a apresentação, você no controle">
                Um painel no seu notebook mostra a pergunta no ar, quantas pessoas estão participando e as respostas
                chegando.
              </SectionHeading>
              <ul className="reveal flex flex-col gap-4 text-base leading-relaxed">
                <li className="flex items-start gap-2.5">
                  <CheckIcon className="mt-1 shrink-0 text-primary" />
                  <span>
                    <strong className="font-semibold">Tela do projetor separada:</strong> mostra a pergunta, os votos, a
                    nuvem de palavras e o ranking do quiz, em letras grandes.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckIcon className="mt-1 shrink-0 text-primary" />
                  <span>
                    <strong className="font-semibold">
                      Avance com a seta <Kbd>→</Kbd>
                    </strong>{" "}
                    do teclado ou com o passador de slides.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckIcon className="mt-1 shrink-0 text-primary" />
                  <span>
                    <strong className="font-semibold">Pause e retome</strong> a qualquer momento. Ninguém responde
                    enquanto a sessão está pausada.
                  </span>
                </li>
              </ul>
            </div>

            <div className={cn("reveal overflow-hidden rounded-sm bg-card dark:border lg:order-1", paperShadow)}>
              <div className="flex items-center justify-between border-b px-5 py-3 text-sm">
                <span className="font-script font-bold uppercase">Roteiro da sessão</span>
                <span className="text-xs text-muted-foreground">exemplo</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-5 py-2 font-normal">#</th>
                    <th scope="col" className="hidden px-2 py-2 font-normal sm:table-cell">Quando</th>
                    <th scope="col" className="px-2 py-2 font-normal">Pergunta</th>
                    <th scope="col" className="px-5 py-2 text-right font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {SESSION_PLAN.map((row) => (
                    <tr key={row.n} className={cn("border-b last:border-b-0", row.state === "live" && "bg-primary/[0.07]")}>
                      <td className="px-5 py-4 align-top font-script text-2xl font-bold tabular-nums">{row.n}</td>
                      <td className="hidden px-2 py-4 align-top font-script tabular-nums text-muted-foreground sm:table-cell">
                        {row.at}
                      </td>
                      <td className="px-2 py-4 align-top">
                        <span className={cn("block font-script text-xs font-bold uppercase tracking-wider", row.ink)}>{row.type}</span>
                        <span className={cn("text-base", row.state === "done" && "text-muted-foreground")}>{row.question}</span>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <span className="flex items-center justify-end gap-2 whitespace-nowrap font-medium">
                          {row.state === "done" ? (
                            <CheckIcon className="text-muted-foreground" />
                          ) : (
                            <CueLamp state={row.state === "live" ? "go" : row.state === "next" ? "standby" : "off"} pulse />
                          )}
                          <span
                            className={cn(
                              "sr-only sm:not-sr-only",
                              (row.state === "done" || row.state === "waiting") && "text-muted-foreground",
                            )}
                          >
                            {ROW_STATE_LABEL[row.state]}
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

        {/* Depois: o relatório. */}
        <section className="border-t bg-muted/40">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 md:px-6 md:py-24 lg:grid-cols-[2fr_3fr] lg:gap-16">
            <div className="flex flex-col gap-6">
              <SectionHeading title="Depois: o relatório da sessão">
                Ao encerrar, a plateia responde uma pesquisa pelo celular: satisfação, atenção, didática, treinamento ou
                um modelo seu. Você vê seus pontos fortes e fracos, onde o público mais participou e sugestões da IA para
                a próxima vez.
              </SectionHeading>
              <p className="reveal text-sm leading-relaxed text-muted-foreground">
                Os números medem participação, não atenção. E cada sugestão da IA mostra em quantas respostas se baseia:
                quanto menos respostas, mais fraco o sublinhado.
              </p>
            </div>

            <article className={cn("reveal flex flex-col gap-8 rounded-sm bg-card p-6 dark:border sm:p-8", paperShadow)}>
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-4">
                <h3 className="font-script text-lg font-bold uppercase">Relatório: “IA no trabalho”</h3>
                <span className="text-xs text-muted-foreground">exemplo com dados simulados</span>
              </header>

              <figure className="flex flex-col gap-3">
                <figcaption className="text-sm font-semibold">Participação em cada pergunta</figcaption>
                <svg
                  viewBox="0 0 300 120"
                  role="img"
                  aria-label="Participação por pergunta: 82%, 91%, 58%, 66% e 74%"
                  className="h-auto w-full font-script"
                >
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
                        <rect
                          className="reveal-bar"
                          x={x - 9}
                          y={100 - h}
                          width="18"
                          height={h}
                          rx="2"
                          fill={low ? "var(--standby)" : "var(--primary)"}
                        />
                        <text x={x} y={94 - h} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--foreground)">
                          {Math.round(p.rate * 100)}%
                        </text>
                        <text x={x} y="113" textAnchor="middle" fontSize="8" fill="var(--muted-foreground)">
                          {p.minute} min
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </figure>

              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold">Sugestões da IA</p>
                <ol className="flex flex-col gap-4">
                  {NOTES.map((note, index) => (
                    <li key={index} className="grid grid-cols-[1.5rem_1fr] gap-x-2">
                      <span className="font-script font-bold tabular-nums">{index + 1}.</span>
                      <div className="flex flex-col gap-1">
                        <p
                          className={cn(
                            "leading-relaxed underline decoration-2 underline-offset-[6px]",
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
              </div>

              <div className="flex flex-col gap-3 border-t pt-5">
                <p className="text-sm font-semibold">Avaliação do público</p>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 xl:grid-cols-5">
                  {SCORECARD.map((s) => (
                    <div key={s.label} className="flex flex-col">
                      <dt className="text-xs text-muted-foreground">{s.label}</dt>
                      <dd className="font-script text-xl font-bold tabular-nums">
                        {s.value}
                        <span className="text-sm font-normal text-muted-foreground">{s.scale}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </article>
          </div>
        </section>

        {/* Para quem é. */}
        <section className="border-t">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-20 md:px-6 md:py-24">
            <SectionHeading title="Para quem apresenta para um público">
              Funciona em auditório, sala de aula, reunião ou treinamento, presencial ou online com tela compartilhada.
            </SectionHeading>
            <dl className="grid gap-10 md:grid-cols-3 md:gap-8">
              {AUDIENCES.map((a, index) => (
                <div key={a.who} className="reveal flex flex-col gap-2 border-t pt-5" style={stagger(index)}>
                  <dt className="font-script text-xl font-bold">{a.who}</dt>
                  <dd className="leading-relaxed text-muted-foreground">{a.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Perguntas frequentes. */}
        <section className="border-t bg-muted/40">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 md:px-6 md:py-24 lg:grid-cols-[2fr_3fr] lg:gap-16">
            <SectionHeading title="Perguntas frequentes">O essencial antes de usar na sua próxima apresentação.</SectionHeading>
            <div className="reveal flex flex-col divide-y rounded-sm bg-card dark:border">
              {FAQ.map((item) => (
                <details key={item.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                    {item.q}
                    <span
                      aria-hidden
                      className="grid size-6 shrink-0 place-items-center rounded-full border text-sm transition-transform duration-200 ease-out group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-[60ch] leading-relaxed text-muted-foreground">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Chamada final. */}
        <section className="border-t">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-8 px-4 py-24 md:px-6 md:py-28">
            <h2 className="reveal max-w-4xl font-script text-[clamp(2.4rem,5.5vw,5rem)] font-bold leading-none tracking-[-0.035em] text-balance">
              Pronto para ouvir a sua plateia?
            </h2>
            <p className="reveal max-w-xl text-lg leading-relaxed text-muted-foreground">
              Crie a primeira sessão em poucos minutos, com Google ou e-mail. Grátis durante o beta.
            </p>
            <div className="reveal flex flex-wrap items-center gap-4">
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
          <span>PulseStage · interação ao vivo para palestras e aulas</span>
          <Link href="/privacidade" className="underline-offset-4 hover:text-foreground hover:underline">
            Privacidade
          </Link>
        </div>
      </footer>
    </div>
  );
}
