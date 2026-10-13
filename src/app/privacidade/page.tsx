import type { Metadata } from "next";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Privacidade" };

// Mantenha este texto alinhado ao código: cookies em lib/participant/token.ts, contatos em
// participant_contacts (seção 0.4 da spec), entrada da IA em lib/ai/build-input.ts e perfil público/convites
// em lib/data/speaker-profile.ts e features/speaker-profile/actions.ts; assistentes (MCP) em lib/mcp/.

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
        <p className="mt-1 text-sm text-muted-foreground">Última atualização: 13 de outubro de 2026</p>
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
              <strong className="text-foreground">Nome (opcional).</strong> Aparece só no ranking do quiz, que o
              palestrante pode mostrar no telão da sala. Sem nome, você participa de forma anônima e aparece como
              “Participante” seguido de um código.
            </li>
            <li>
              <strong className="text-foreground">Avatar (opcional).</strong> Um desenho escolhido de uma lista fixa
              (nada de foto), mostrado ao lado do nome no ranking do quiz.
            </li>
            <li>
              <strong className="text-foreground">Número do sorteio.</strong> Se a sessão tiver sorteio, quem concorre
              recebe um número aleatório. Quem for sorteado tem nome (ou “Participante” e um código), número e avatar
              mostrados no telão; a mensagem do prêmio aparece só no celular de quem ganhou. Números e ganhadores são
              apagados junto com a sessão.
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
          <p>
            Se você enviar os slides de uma apresentação, o PDF é convertido em imagens no seu próprio navegador e só
            essas imagens são guardadas, num armazenamento privado. Elas aparecem para a plateia apenas na tela do
            projetor, por links temporários.
          </p>
          <p>
            Imagens que você anexa às alternativas de enquetes e quizzes são reduzidas no seu navegador (sem os
            metadados do arquivo, como a localização da foto) e guardadas num armazenamento público com endereço
            impossível de adivinhar, porque precisam abrir no celular de quem participa. Elas são apagadas quando nenhuma
            pergunta usa mais a imagem ou quando você exclui a conta.
          </p>
          <p>
            <strong className="text-foreground">Perfil público (opcional).</strong> Só existe se você publicar. Mostra
            nome, foto, mini-bio e o que você preencher (título, temas, cidade, formatos, públicos, experiência
            declarada e links), além de números calculados das suas sessões encerradas: quantidade de sessões
            verificadas, total de participantes, nota média da pesquisa (que você pode ocultar) e, nas sessões que
            você escolher, título, data e faixa de público. Nenhum dado de participante aparece. Ao desligar o perfil,
            ele sai do ar e do diretório na hora.
          </p>
        </Section>

        <Section title="Convites pelo perfil público">
          <p id="convites" className="scroll-mt-6">
            Quem usa “Convidar para palestrar” informa nome, e-mail, mensagem e, se quiser, instituição, data e cidade
            do evento. Esses dados vão só para o palestrante convidado, que é quem decide como responder (controlador);
            o e-mail do palestrante não é mostrado a quem convida. Para limitar abuso, guardamos junto com o convite um
            código derivado do endereço IP (um hash com segredo do servidor, sem o IP em si). Quando o aviso por
            e-mail está configurado, o convite também é enviado ao palestrante pelo serviço de e-mail (Resend). O convite é
            apagado quando o palestrante o exclui ou exclui a conta.
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

        <Section title="Assistentes de IA conectados (Claude, ChatGPT e outros)">
          <p id="assistentes" className="scroll-mt-6">
            O palestrante pode conectar a própria conta a um assistente de IA pelo protocolo MCP. A conexão só acontece
            depois que ele entra no PulseStage e clica em “Permitir acesso”, e pode ser revogada a qualquer momento em
            Integrações. O assistente age como o palestrante: pelas ferramentas do PulseStage, lê e cria sessões e
            perguntas e, quando o palestrante pede, recebe os resultados de uma sessão (números agregados, respostas
            abertas e comentários da pesquisa). Nomes, e-mails e telefones de participantes nunca são enviados por essas
            ferramentas. O que o assistente faz com esses dados segue a política da empresa dele (por exemplo, Anthropic
            ou OpenAI). O PDF da apresentação anexado no chat fica com o assistente; o PulseStage recebe só as perguntas.
          </p>
        </Section>

        <Section title="Com quem compartilhamos">
          <ul className="flex flex-col gap-1">
            <li>
              <strong className="text-foreground">Infraestrutura:</strong> Supabase (banco de dados e autenticação) e
              Vercel (hospedagem), que processam os dados apenas para operar o serviço. Quando configurado, o Resend
              entrega os avisos de convite por e-mail.
            </li>
            <li>
              <strong className="text-foreground">Inteligência artificial:</strong> quando o palestrante pede insights,
              enviamos ao provedor de IA configurado apenas resultados agregados e trechos de respostas abertas e
              comentários de feedback. Quando pede sugestões de perguntas, enviamos só o título, a descrição, a duração
              e as perguntas da sessão, sem nada da plateia. Nomes, e-mails e telefones nunca são enviados.
            </li>
          </ul>
        </Section>

        <Section title="Por quanto tempo guardamos">
          <p>
            Os dados de uma sessão ficam guardados enquanto ela existir. Quando o palestrante exclui a sessão, todas as
            respostas, participantes, contatos, avaliações, insights e slides dela são apagados definitivamente.
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
