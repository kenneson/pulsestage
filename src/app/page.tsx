import Link from "next/link";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme";
import { StageDemo } from "@/components/landing/stage-demo";
import { JoinCodeForm } from "@/components/join-code-form";
import { ShapeGlyph, shapeBg } from "@/components/option-shape";
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

const HERO_FACTS = [
  "Alunos e participantes entram pelo QR Code, sem app e sem cadastro",
  "Seus slides e as perguntas numa sequência só, no mesmo passador",
  "Quiz com ranking, sorteio de prêmios e relatório com IA no fim",
];

// Fatos do produto (limites e recursos), não números de uso.
const PRODUCT_FACTS = [
  { value: "0", text: "apps para a plateia instalar" },
  { value: MAX_PARTICIPANTS_PER_SESSION.toLocaleString("pt-BR"), text: "pessoas por sessão" },
  { value: "5", text: "tipos de pergunta para misturar" },
  { value: "1", text: "tela para slides e perguntas" },
];

// Uma faixa de deck: slides (escuros, como no telão) e perguntas no papel do seu tipo.
const DECK: ({ kind: "slide"; n: number; title: string } | { kind: "question"; paper: string; type: string; text: string })[] = [
  { kind: "slide", n: 1, title: "Abertura" },
  { kind: "question", paper: "bg-rev-blue", type: "Enquete", text: "Você já usa IA no trabalho?" },
  { kind: "slide", n: 2, title: "O que muda" },
  { kind: "slide", n: 3, title: "Na prática" },
  { kind: "question", paper: "bg-rev-yellow", type: "Nuvem", text: "Uma palavra para o seu momento" },
  { kind: "slide", n: 4, title: "Riscos" },
  { kind: "question", paper: "bg-rev-gold", type: "Quiz", text: "Qual destes é um modelo de linguagem?" },
  { kind: "slide", n: 5, title: "Próximos passos" },
  { kind: "slide", n: 6, title: "Obrigado!" },
];

const SLIDE_POINTS = [
  "Envie o PDF exportado do PowerPoint, Google Slides, Keynote ou Canva. O arquivo é convertido no seu navegador.",
  "Arraste cada pergunta para o ponto exato da apresentação em que ela deve entrar.",
  "No palco, o passador ou a seta do teclado avança tudo: slide, pergunta, resultado, próximo slide.",
  "Surgiu uma dúvida na sala? Crie uma pergunta nova durante a palestra e lance na hora.",
];

const GAME_POINTS = [
  { title: "Avatares", text: "Cada pessoa escolhe um bichinho ao entrar e aparece com ele no ranking." },
  { title: "Formas e cores", text: "Alternativas no estilo dos jogos de quiz, com forma, cor e até imagem." },
  { title: "Bônus de velocidade", text: "No quiz com tempo, quem acerta primeiro leva mais pontos." },
  { title: "Ranking animado", text: "O telão mostra quem subiu e quem caiu depois de cada pergunta." },
  { title: "Sorteio de prêmios", text: "Roleta de números com suspense, som e confete. Físico ou digital." },
  { title: "Incentivo à pesquisa", text: "Se quiser, só concorre ao sorteio quem responde a pesquisa no fim." },
];

const QUIZ_TILES = ["GPT", "Excel", "Linux", "HTML"];

const RANKING = [
  { avatar: "🦉", name: "Carla", points: "1.950", move: "↑2" },
  { avatar: "🦊", name: "Ana", points: "1.820", move: "↓1" },
  { avatar: "🐼", name: "Bruno", points: "1.610", move: "↓1" },
];

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
    who: "Universidades e faculdades",
    text: "Aulas expositivas com a turma inteira participando, verificação de entendimento em tempo real e avaliação da disciplina no fim.",
  },
  {
    who: "Escolas: fundamental e médio",
    text: "Quiz com ranking, avatares e sorteio deixam a revisão divertida. Os alunos respondem pelo celular, sem criar conta e com o nome que quiserem.",
  },
  {
    who: "Empresas e treinamentos",
    text: "Treinamentos, onboarding e reuniões gerais com a opinião de todos em segundos e um relatório pronto para o RH.",
  },
  {
    who: "Palestrantes e eventos",
    text: "Quebre o gelo na abertura, puxe a plateia no meio e descubra depois o que realmente marcou.",
  },
];

const FAQ = [
  {
    q: "A plateia precisa baixar algum aplicativo?",
    a: "Não. As pessoas apontam a câmera do celular para o QR Code ou digitam o código no navegador. Não precisam de conta, e o nome é opcional.",
  },
  {
    q: "Quanto custa?",
    a: "Nada durante o beta. Você cria sua conta com Google ou e-mail e usa todos os recursos, sem cartão de crédito.",
  },
  {
    q: "Funciona junto com meus slides?",
    a: "Sim. Envie o PDF da apresentação e apresente pelo PulseStage: slides e perguntas ficam na mesma sequência e o passador avança tudo, sem trocar de janela. Animações e vídeos dos slides não são mantidos; se precisar deles, apresente pelo seu programa e alterne para a tela de resultados na hora de cada pergunta.",
  },
  {
    q: "Como funciona o sorteio?",
    a: "Você cadastra os prêmios e escolhe quem concorre: todos que entraram ou só quem respondeu a pesquisa no fim. Cada pessoa recebe um número no celular. O ganhador é escolhido pelo servidor e revelado no telão com animação; a mensagem do prêmio, como um cupom, aparece só no celular de quem ganhou.",
  },
  {
    q: "Quantas pessoas podem participar?",
    a: `Até ${MAX_PARTICIPANTS_PER_SESSION.toLocaleString("pt-BR")} participantes por sessão. Cada pessoa responde uma vez por pergunta.`,
  },
  {
    q: "Consigo levar os resultados para fora?",
    a: "Sim. Cada sessão gera um relatório em PDF e exporta as respostas e a pesquisa em planilha (CSV). Você também pode duplicar uma sessão para repetir a palestra.",
  },
  {
    q: "E os dados de quem participa?",
    a: "A participação pode ser anônima. Contato só é guardado com autorização e fica separado das respostas. A análise com IA usa apenas dados agregados, nunca nomes ou contatos.",
  },
];

function SectionHeading({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="reveal flex max-w-2xl flex-col gap-4">
      <h2 className="font-display text-[clamp(1.8rem,3.2vw,2.75rem)] font-bold leading-[1.08] tracking-[-0.02em] text-balance">
        {title}
      </h2>
      <p className="text-lg leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-grid min-w-7 place-items-center rounded border bg-card px-1.5 pb-0.5 font-display text-sm font-bold text-foreground shadow-[inset_0_-2px_0_var(--border)]">
      {children}
    </kbd>
  );
}

/** Posição da linha na entrada em sequência do hero (ver .script-line em globals.css). */
const line = (n: number) => ({ "--line": n }) as React.CSSProperties;

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
            <a href="#como-funciona" className={cn(buttonVariants({ variant: "ghost" }), "hidden md:inline-flex")}>
              Como funciona
            </a>
            <a href="#recursos" className={cn(buttonVariants({ variant: "ghost" }), "hidden md:inline-flex")}>
              Recursos
            </a>
            <Link href="/palestrantes" className={cn(buttonVariants({ variant: "ghost" }), "hidden md:inline-flex")}>
              Palestrantes
            </Link>
            <ThemeToggle />
            <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
              Entrar
            </Link>
            <Link href="/signup" className={cn(buttonVariants(), "hidden sm:inline-flex")}>
              Criar conta grátis
            </Link>
          </nav>
        </header>
      </div>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 md:px-6 md:pb-20">
          <div className="flex flex-col gap-10 rounded-sm bg-card p-6 text-card-foreground shadow-[0_24px_48px_-28px_color-mix(in_oklch,var(--foreground)_35%,transparent)] dark:border sm:p-10 lg:gap-14 lg:p-14">
            <h1
              className="script-line max-w-5xl text-balance font-display text-[clamp(2.4rem,5.6vw,5rem)] font-extrabold leading-[1.02] tracking-[-0.025em]"
              style={line(0)}
            >
              Aulas, palestras e treinamentos com{" "}
              <mark className="highlighter box-decoration-clone rounded-md px-1.5 text-highlight-foreground">todo mundo participando</mark>.
            </h1>

            <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:gap-14">
              <div className="flex flex-col gap-6">
                <p className="script-line max-w-[58ch] text-lg leading-relaxed text-muted-foreground" style={line(1)}>
                  Enquetes, quiz, nuvem de palavras e sorteio respondidos pelo celular, com o resultado no telão em
                  segundos e seus slides na mesma tela. Para universidades, escolas e empresas. Depois, um relatório
                  mostra o que funcionou para a próxima ser ainda melhor.
                </p>
                <div className="script-line flex flex-wrap items-center gap-x-5 gap-y-3" style={line(2)}>
                  <Link href="/signup" className={buttonVariants({ size: "lg" })}>
                    Criar minha sessão grátis
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    Grátis durante o beta, sem cartão ·{" "}
                    <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
                      já tenho conta
                    </Link>
                  </span>
                </div>
              </div>
              <ul className="script-line flex flex-col gap-2.5" style={line(3)}>
                {HERO_FACTS.map((fact) => (
                  <li key={fact} className="flex items-start gap-2.5">
                    <CheckIcon className="mt-1 shrink-0 text-primary" />
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="slide-in-right mx-auto w-full max-w-4xl">
              <StageDemo />
            </div>

            <div className="script-line flex flex-col gap-3 border-t border-dashed pt-6 sm:flex-row sm:items-center sm:justify-between" style={line(4)}>
              <p className="text-sm font-medium">Vai participar de uma aula ou palestra? Digite o código que aparece na tela.</p>
              <div className="w-full sm:max-w-sm">
                <JoinCodeForm />
              </div>
            </div>
          </div>
        </section>

        {/* Fatos do produto. */}
        <section aria-label="O PulseStage em números do produto" className="mx-auto w-full max-w-6xl px-4 pb-16 md:px-6 md:pb-20">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
            {PRODUCT_FACTS.map((fact, index) => (
              <div key={fact.text} className="reveal flex flex-col gap-1 border-t-2 border-foreground pt-4" style={stagger(index)}>
                <dt className="sr-only">{fact.text}</dt>
                <dd className="font-display text-[clamp(2.4rem,5vw,3.75rem)] font-bold leading-none tabular-nums">{fact.value}</dd>
                <dd className="text-muted-foreground">{fact.text}</dd>
              </div>
            ))}
          </dl>
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
                  <span className="font-display text-5xl font-bold leading-none tabular-nums" aria-hidden>
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
                  <h3 className="font-display text-xl font-bold">{item.type}</h3>
                  <p className="mt-1 max-w-[52ch] text-sm leading-relaxed">{item.text}</p>
                  <p className="mt-2 font-display text-sm italic opacity-80">Ex.: “{item.example}”</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Slides e perguntas na mesma sequência. */}
        <section id="recursos" className="border-t">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 md:px-6 md:py-24 lg:grid-cols-[2fr_3fr] lg:gap-16">
            <div className="flex flex-col gap-8">
              <SectionHeading title="Seus slides e suas perguntas numa sequência só">
                Nada de trocar de janela no meio da palestra. Você apresenta pelo PulseStage e a interação entra no
                momento certo.
              </SectionHeading>
              <ul className="reveal flex flex-col gap-4 leading-relaxed">
                {SLIDE_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-2.5">
                    <CheckIcon className="mt-1 shrink-0 text-primary" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <figure className={cn("reveal flex flex-col gap-6 self-center rounded-sm bg-card p-6 dark:border sm:p-8", paperShadow)}>
              <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Exemplo de sequência da apresentação">
                {DECK.map((item, index) =>
                  item.kind === "slide" ? (
                    <li key={`s${item.n}`} className="flex flex-col gap-1.5">
                      <span className="dark flex aspect-video flex-col justify-between rounded-sm border bg-background p-2 text-foreground">
                        <span className="text-xs font-semibold leading-tight">{item.title}</span>
                        <span aria-hidden className="flex flex-col gap-1">
                          <span className="h-0.5 w-3/4 rounded-full bg-foreground/30" />
                          <span className="h-0.5 w-1/2 rounded-full bg-foreground/30" />
                        </span>
                      </span>
                      <span className="font-display text-xs text-muted-foreground">Slide {item.n}</span>
                    </li>
                  ) : (
                    <li key={`q${index}`} className="flex flex-col gap-1.5">
                      <span className={cn("flex aspect-video flex-col justify-between rounded-sm p-2 text-rev-foreground", item.paper)}>
                        <span className="font-display text-[0.65rem] font-bold uppercase tracking-wider">{item.type}</span>
                        <span className="text-xs font-medium leading-tight">{item.text}</span>
                      </span>
                      <span className="font-display text-xs text-muted-foreground">Pergunta</span>
                    </li>
                  ),
                )}
              </ol>
              <figcaption className="flex flex-wrap items-center gap-3 border-t border-dashed pt-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Kbd>→</Kbd> ou o passador avança
                </span>
                <span aria-hidden>·</span>
                <span>arraste as perguntas para mudar a ordem</span>
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Gamificação e sorteio. */}
        <section className="border-t bg-muted/40">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-20 md:px-6 md:py-24">
            <SectionHeading title="Quiz, ranking e sorteio: a sala inteira quer jogar">
              Recursos de jogo para a plateia participar do começo ao fim, e um sorteio para fechar a palestra em clima
              de festa.
            </SectionHeading>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Celular: alternativas com forma e cor. */}
              <div className={cn("reveal flex flex-col gap-3 rounded-sm bg-card p-5 dark:border", paperShadow)} style={stagger(0)}>
                <p className="font-semibold leading-snug">Qual destes é um modelo de linguagem?</p>
                <div className="grid grid-cols-2 gap-2" aria-hidden>
                  {QUIZ_TILES.map((label, i) => (
                    <span
                      key={label}
                      className={cn(
                        "flex min-h-14 items-center gap-2 rounded-lg px-3 font-semibold text-white",
                        shapeBg(i),
                        i === 0 && "ring-4 ring-foreground ring-offset-2 ring-offset-card",
                      )}
                    >
                      <ShapeGlyph index={i} className="size-5 text-white" />
                      {label}
                    </span>
                  ))}
                </div>
                <p className="rounded-md bg-primary/15 py-2 text-center text-sm font-semibold text-primary">Certa! +950 pontos</p>
                <p className="mt-auto text-xs text-muted-foreground">No celular da plateia · exemplo</p>
              </div>

              {/* Telão: ranking. */}
              <div className="reveal dark flex flex-col gap-3 rounded-sm border bg-background p-5 text-foreground" style={stagger(1)}>
                <p className="text-center text-lg font-semibold">Ranking do quiz</p>
                <ol className="flex flex-col gap-2">
                  {RANKING.map((r, i) => (
                    <li
                      key={r.name}
                      className={cn("flex items-center gap-3 rounded-md px-3 py-2", i === 0 ? "bg-primary/20" : "bg-muted")}
                    >
                      <span className="w-6 font-display font-bold tabular-nums">{i + 1}º</span>
                      <span aria-hidden className="text-xl leading-none">
                        {r.avatar}
                      </span>
                      <span className="flex-1 font-semibold">{r.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{r.move}</span>
                      <span className="font-display font-bold tabular-nums">{r.points}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-auto text-xs text-muted-foreground">No telão · exemplo</p>
              </div>

              {/* Sorteio. */}
              <div className="reveal dark flex flex-col items-center gap-3 rounded-sm border bg-background p-5 text-center text-foreground" style={stagger(2)}>
                <p className="text-sm text-muted-foreground">Sorteando: Livro autografado</p>
                <span className="rounded-xl border-4 border-dashed border-primary px-6 font-display text-6xl font-bold leading-tight text-primary tabular-nums">
                  042
                </span>
                <p className="flex items-center gap-2 text-lg font-semibold">
                  <span aria-hidden className="text-2xl leading-none">
                    🦉
                  </span>
                  Carla · Parabéns!
                </p>
                <p className="mt-auto text-xs text-muted-foreground">No telão · exemplo</p>
              </div>
            </div>

            <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {GAME_POINTS.map((point, index) => (
                <div key={point.title} className="reveal flex flex-col gap-1 border-t pt-4" style={stagger(index % 3)}>
                  <dt className="font-display text-lg font-bold">{point.title}</dt>
                  <dd className="leading-relaxed text-muted-foreground">{point.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Depois: o relatório. */}
        <section className="border-t">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 md:px-6 md:py-24 lg:grid-cols-[2fr_3fr] lg:gap-16">
            <div className="flex flex-col gap-6">
              <SectionHeading title="Depois: o relatório da sessão">
                Ao encerrar, a plateia responde uma pesquisa pelo celular. Você vê seus pontos fortes e fracos, onde o
                público mais participou, quanto tempo ficou em cada slide e sugestões da IA para a próxima vez. Tudo
                exportável em PDF e planilha.
              </SectionHeading>
              <p className="reveal text-sm leading-relaxed text-muted-foreground">
                Os números medem participação, não atenção. E cada sugestão da IA mostra em quantas respostas se baseia:
                quanto menos respostas, mais fraco o sublinhado.
              </p>
            </div>

            <article className={cn("reveal flex flex-col gap-8 rounded-sm bg-card p-6 dark:border sm:p-8", paperShadow)}>
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-4">
                <h3 className="font-display text-lg font-bold uppercase">Relatório: “IA no trabalho”</h3>
                <span className="text-xs text-muted-foreground">exemplo com dados simulados</span>
              </header>

              <figure className="flex flex-col gap-3">
                <figcaption className="text-sm font-semibold">Participação em cada pergunta</figcaption>
                <svg
                  viewBox="0 0 300 120"
                  role="img"
                  aria-label="Participação por pergunta: 82%, 91%, 58%, 66% e 74%"
                  className="h-auto w-full font-display"
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
                      <span className="font-display font-bold tabular-nums">{index + 1}.</span>
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
                      <dd className="font-display text-xl font-bold tabular-nums">
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
        <section className="border-t bg-muted/40">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-20 md:px-6 md:py-24">
            <SectionHeading title="Da sala de aula ao auditório">
              Funciona em sala de aula, auditório, reunião ou treinamento, presencial ou online com tela compartilhada.
            </SectionHeading>
            <dl className="grid gap-10 sm:grid-cols-2 md:gap-8 lg:grid-cols-4">
              {AUDIENCES.map((a, index) => (
                <div key={a.who} className="reveal flex flex-col gap-2 border-t pt-5" style={stagger(index)}>
                  <dt className="font-display text-xl font-bold">{a.who}</dt>
                  <dd className="leading-relaxed text-muted-foreground">{a.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Perguntas frequentes. */}
        <section className="border-t">
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

        {/* Chamada final: o palco escuro, como o telão. */}
        <section className="dark border-t bg-background text-foreground">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-8 px-4 py-24 md:px-6 md:py-32">
            <h2 className="reveal max-w-4xl font-display text-[clamp(2.6rem,6vw,5.5rem)] font-bold leading-[0.98] tracking-[-0.025em] text-balance">
              Sua próxima aula ou palestra começa aqui.
            </h2>
            <p className="reveal max-w-xl text-lg leading-relaxed text-muted-foreground">
              Crie a primeira sessão em poucos minutos, com Google ou e-mail. Grátis durante o beta, sem cartão de
              crédito.
            </p>
            <div className="reveal flex flex-wrap items-center gap-4">
              <Link href="/signup" className={buttonVariants({ size: "lg" })}>
                Criar minha sessão grátis
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
          <span className="flex gap-4">
            <Link href="/palestrantes" className="underline-offset-4 hover:text-foreground hover:underline">
              Encontre um palestrante
            </Link>
            <Link href="/privacidade" className="underline-offset-4 hover:text-foreground hover:underline">
              Privacidade
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
