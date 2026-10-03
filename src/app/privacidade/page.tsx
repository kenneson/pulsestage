import type { Metadata } from "next";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Privacidade" };

// Mantenha este texto alinhado ao código: cookies em lib/participant/token.ts, contatos em
// participant_contacts (seção 0.4 da spec) e entrada da IA em lib/ai/build-input.ts.

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-5 py-8">
      <Logo />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Política de privacidade</h1>
        <p className="mt-1 text-sm text-muted-foreground">Última atualização: 2 de outubro de 2026</p>
      </div>

      <div className="flex flex-col gap-8 text-muted-foreground [&_li]:ml-5 [&_li]:list-disc">
        <p>
          O PulseStage permite que palestrantes façam enquetes, quizzes e perguntas ao vivo e recebam avaliações
          depois da apresentação. Coletamos o mínimo necessário para isso funcionar, e você pode participar sem se
          identificar.
        </p>

        <Section title="Quem decide sobre os seus dados">
          <p>
            Quando você participa de uma sessão, quem decide como usar as respostas e o contato que você informar é o
            palestrante ou organizador daquela sessão (controlador). O PulseStage guarda e processa esses dados em nome
            dele (operador). Para a conta do palestrante, o PulseStage é o controlador.
          </p>
        </Section>

        <Section title="O que coletamos de quem participa">
          <ul className="flex flex-col gap-1">
            <li>
              <strong className="text-foreground">Nome (opcional).</strong> Aparece só no ranking do quiz. Sem nome,
              você participa de forma anônima.
            </li>
            <li>
              <strong className="text-foreground">Respostas e avaliação.</strong> O que você responde nas interações e
              no feedback pós-evento.
            </li>
            <li>
              <strong className="text-foreground">E-mail e telefone (opcionais).</strong> Só são gravados se você
              marcar a autorização, para que o palestrante envie materiais e comunicações sobre aquela sessão. Ficam
              guardados separados das suas respostas.
            </li>
          </ul>
          <p>Não pedimos cadastro, não usamos anúncios e não rastreamos você entre sites.</p>
        </Section>

        <Section title="O que coletamos de palestrantes">
          <p>
            Nome, e-mail e senha da conta (a senha é guardada pelo serviço de autenticação, nunca em texto puro). Se
            você entrar com o Google, recebemos dele apenas nome, e-mail e foto do perfil, sem acesso a mais nada da sua
            conta. Também guardamos as sessões, interações e resultados que você cria.
          </p>
        </Section>

        <Section title="Cookies e armazenamento no navegador">
          <ul className="flex flex-col gap-1">
            <li>
              <strong className="text-foreground">Participação</strong> (<code>ps_p_…</code>, 30 dias): identifica
              você dentro de uma sessão para evitar respostas duplicadas. É assinado e não contém dados pessoais.
            </li>
            <li>
              <strong className="text-foreground">Avaliação enviada</strong> (<code>ps_fb_…</code>, 30 dias): evita
              que a mesma avaliação seja enviada duas vezes.
            </li>
            <li>
              <strong className="text-foreground">Login</strong>: mantém o palestrante conectado.
            </li>
            <li>
              <strong className="text-foreground">Tema</strong> (armazenamento local): lembra se você escolheu o
              modo claro ou escuro.
            </li>
          </ul>
          <p>Todos são necessários para o funcionamento; não usamos cookies de análise ou publicidade.</p>
        </Section>

        <Section title="Com quem compartilhamos">
          <ul className="flex flex-col gap-1">
            <li>
              <strong className="text-foreground">Infraestrutura:</strong> Supabase (banco de dados e autenticação) e
              Vercel (hospedagem), que processam os dados apenas para operar o serviço.
            </li>
            <li>
              <strong className="text-foreground">Inteligência artificial:</strong> quando o palestrante pede insights,
              enviamos ao provedor de IA configurado apenas resultados agregados e trechos de respostas abertas e
              comentários de feedback. Nomes, e-mails e telefones nunca são enviados.
            </li>
          </ul>
        </Section>

        <Section title="Por quanto tempo guardamos">
          <p>
            Os dados de uma sessão ficam guardados enquanto ela existir. Quando o palestrante exclui a sessão, todas as
            respostas, participantes, contatos, avaliações e insights dela são apagados definitivamente.
          </p>
        </Section>

        <Section title="Seus direitos">
          <p>
            Pela LGPD, você pode pedir acesso, correção ou exclusão dos seus dados e revogar a autorização de contato.
            Para dados de uma sessão, fale com o palestrante ou organizador dela, que pode excluir a sessão inteira a
            qualquer momento.
          </p>
        </Section>
      </div>
    </main>
  );
}
