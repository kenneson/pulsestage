import Link from "next/link";
import { Logo } from "@/components/logo";
import { JoinCodeForm } from "@/components/join-code-form";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme";

const STEPS = [
  { title: "Interaja", text: "Enquetes, quizzes, nuvem de palavras e perguntas abertas, ao vivo pelo celular da audiência." },
  { title: "Entenda", text: "Resultados em tempo real, feedback pós-evento e um sinal de participação ao longo da sessão." },
  { title: "Melhore", text: "Insights baseados em evidências e a evolução das suas avaliações entre palestras." },
];

const HOW_IT_WORKS = [
  {
    title: "Monte em minutos",
    text: "Crie a sessão e adicione enquetes, quizzes, escalas, nuvens de palavras e perguntas abertas na ordem da sua apresentação.",
  },
  {
    title: "Mostre o QR Code",
    text: "A audiência entra pelo celular em segundos. Sem baixar app, sem criar conta, com nome opcional.",
  },
  {
    title: "Apresente ao vivo",
    text: "Ative cada interação com um clique e veja as respostas chegarem no projetor em tempo real.",
  },
  {
    title: "Melhore a próxima",
    text: "Ao encerrar, o público avalia a sessão. Analytics e insights com IA mostram o que funcionou e o que ajustar.",
  },
];

const INTERACTION_TYPES = ["Enquete", "Quiz com ranking", "Escala de notas", "Nuvem de palavras", "Pergunta aberta"];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <a href="#como-funciona" className={buttonVariants({ variant: "ghost", className: "hidden sm:inline-flex" })}>
            Como funciona
          </a>
          <ThemeToggle />
          <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
            Entrar
          </Link>
          <Link href="/signup" className={buttonVariants()}>
            Criar conta
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-6 py-12 md:py-20">
        <section className="grid items-center gap-12 md:grid-cols-[1.3fr_1fr]">
          <div className="flex flex-col gap-6">
            <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
              Seu público fala.
              <br />
              Você entende.
              <br />
              <span className="text-primary">Sua próxima palestra fica melhor.</span>
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Interação em tempo real para palestrantes, professores e facilitadores, com analytics que mostram o que
              realmente aconteceu durante a sua apresentação.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/signup" className={buttonVariants({ size: "lg" })}>
                Começar grátis
              </Link>
              <Link href="/login" className={buttonVariants({ size: "lg", variant: "outline" })}>
                Já tenho conta
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border bg-card p-6 shadow-sm">
            <p className="font-medium">Vai participar de uma sessão?</p>
            <p className="text-sm text-muted-foreground">Digite o código que aparece na tela do palestrante.</p>
            <JoinCodeForm />
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <div key={step.title} className="flex flex-col gap-2 rounded-xl border p-6">
              <span className="text-sm font-medium text-primary">0{index + 1}</span>
              <h2 className="text-lg font-semibold">{step.title}</h2>
              <p className="text-sm text-muted-foreground">{step.text}</p>
            </div>
          ))}
        </section>

        <section id="como-funciona" className="flex scroll-mt-8 flex-col gap-8">
          <div className="flex max-w-2xl flex-col gap-3">
            <p className="text-sm font-medium text-primary">Como funciona</p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Da ideia ao palco em quatro passos</h2>
            <p className="text-muted-foreground">
              Você cuida do conteúdo. O PulseStage cuida da interação, dos resultados e do que aprender com eles.
            </p>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((step, index) => (
              <li key={step.title} className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-sm">
                <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Cinco formatos de interação:</span>
            {INTERACTION_TYPES.map((type) => (
              <span key={type} className="rounded-full border px-3 py-1 text-sm">
                {type}
              </span>
            ))}
          </div>
        </section>

        <section className="flex flex-col items-center gap-4 rounded-2xl border bg-muted/40 px-6 py-12 text-center">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Pronto para ouvir sua audiência?</h2>
          <p className="max-w-lg text-muted-foreground">
            Crie sua conta e monte a primeira sessão em menos de cinco minutos. Dá para entrar com o Google.
          </p>
          <Link href="/signup" className={buttonVariants({ size: "lg" })}>
            Começar grátis
          </Link>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        PulseStage · Audience → Interaction → Data → Insight → Improvement ·{" "}
        <Link href="/privacidade" className="underline hover:text-foreground">
          Privacidade
        </Link>
      </footer>
    </div>
  );
}
