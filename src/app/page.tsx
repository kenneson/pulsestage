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

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
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
