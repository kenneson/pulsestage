import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PlusIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Guia" };

// Manual de uso. Os nomes entre aspas são os rótulos reais dos botões: ao renomear um botão, atualize aqui.

const SECTIONS = [
  { id: "criar", title: "1. Criar a sessão" },
  { id: "roteiro", title: "2. Montar o roteiro" },
  { id: "slides", title: "3. Apresentar com seus slides" },
  { id: "ao-vivo", title: "4. Apresentar ao vivo" },
  { id: "participantes", title: "5. O que a audiência vê" },
  { id: "encerrar", title: "6. Encerrar e aplicar a pesquisa" },
  { id: "analytics", title: "7. Analisar os resultados" },
  { id: "dicas", title: "Dicas" },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="flex flex-col gap-3 text-muted-foreground [&_li]:ml-5 [&_ol>li]:list-decimal [&_strong]:text-foreground [&_ul>li]:list-disc">
        {children}
      </div>
    </section>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border bg-muted px-1.5 py-0.5 font-script text-xs text-foreground">{children}</kbd>;
}

export default function GuidePage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Guia de uso</h1>
          <p className="text-muted-foreground">Do cadastro da sessão à análise depois da palestra.</p>
        </div>
        <Link href="/dashboard/sessions/new" className={buttonVariants()}>
          <PlusIcon /> Nova sessão
        </Link>
      </div>

      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Seções do guia" className="lg:sticky lg:top-24 lg:self-start">
          <ol className="flex flex-col gap-1 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="block rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="flex max-w-3xl flex-col gap-10">
          <Section id="criar" title="1. Criar a sessão">
            <ol className="flex flex-col gap-1">
              <li>
                Clique em <strong>“Nova sessão”</strong>.
              </li>
              <li>Preencha título, descrição, data, horário e duração estimada. Só o título é obrigatório.</li>
              <li>
                <strong>Código de entrada (opcional):</strong> escolha um código fácil de ditar, como <code>IA2026</code>.
                Em branco, o sistema gera um automaticamente. Depois que a sessão começa, o código não muda.
              </li>
            </ol>
          </Section>

          <Section id="roteiro" title="2. Montar o roteiro">
            <p>Na página da sessão, adicione as interações na ordem em que vai usá-las na apresentação.</p>
            <ul className="flex flex-col gap-1">
              <li>
                <strong>Enquete:</strong> uma escolha entre alternativas. Boa para abrir a palestra e conhecer o público.
              </li>
              <li>
                <strong>Escala:</strong> nota entre um mínimo e um máximo (ex.: 1 a 5), com rótulos opcionais nas pontas.
              </li>
              <li>
                <strong>Nuvem de palavras:</strong> respostas curtas agrupadas por frequência. Palavras repetidas crescem
                na tela.
              </li>
              <li>
                <strong>Pergunta aberta:</strong> resposta livre. Você lê as respostas na sala ao vivo.
              </li>
              <li>
                <strong>Quiz:</strong> marque a alternativa correta, defina os pontos e, se quiser, o tempo para
                responder. Gera ranking.
              </li>
            </ul>
            <p>
              Use o ícone de olho para <strong>pré-visualizar</strong> como o participante verá cada pergunta, as setas
              para <strong>subir ou descer</strong> na ordem e o lápis para editar. Para reaproveitar perguntas de outras
              sessões, clique em <strong>“Da biblioteca”</strong>; para repetir uma palestra inteira, use{" "}
              <strong>“Duplicar”</strong> no topo da sessão. Sem ideias? <strong>“Gerar com IA”</strong> sugere perguntas
              a partir do título e da descrição: revise e use <strong>“Adicionar ao roteiro”</strong> nas que servirem.
            </p>
          </Section>

          <Section id="slides" title="3. Apresentar com seus slides">
            <p>
              Opcional, mas evita trocar de janela no palco: na aba <strong>“Slides”</strong> da sessão, clique em{" "}
              <strong>“Escolher PDF”</strong> e envie o PDF da apresentação (no PowerPoint: Arquivo → Exportar → PDF; no
              Google Slides: Arquivo → Fazer download → PDF). O PDF é convertido no seu navegador e só as imagens dos
              slides são enviadas. Animações, transições e vídeos não são mantidos.
            </p>
            <p>
              Em cada pergunta, escolha em que ponto ela entra: <em>Antes do 1º slide</em>, <em>Depois do slide 3</em>{" "}
              etc. Na sala ao vivo, o roteiro vira uma sequência só: slide, pergunta, próximo slide. Use{" "}
              <strong>“Trocar PDF”</strong> para enviar uma versão nova; as perguntas continuam nos mesmos pontos.
            </p>
          </Section>

          <Section id="ao-vivo" title="4. Apresentar ao vivo">
            <ol className="flex flex-col gap-1">
              <li>
                Clique em <strong>“Iniciar sessão”</strong>. Você vai para a <strong>sala ao vivo</strong>, seu painel de
                controle durante a palestra.
              </li>
              <li>
                Clique em <strong>“Tela do projetor”</strong>. Ela abre em outra aba: arraste-a para o projetor ou para a
                tela compartilhada e deixe em tela cheia (<Kbd>F11</Kbd>). Sem interação ativa, ela mostra o QR Code e o
                código de entrada.
              </li>
              <li>
                Para lançar uma pergunta, clique nela na lista ou em <strong>“Próxima”</strong>. Também funcionam a seta{" "}
                <Kbd>→</Kbd> e o <Kbd>PageDown</Kbd> (as teclas do passador de slides) com a sala ao vivo em foco.
              </li>
              <li>
                Com slides enviados, <strong>“Próxima”</strong> percorre slides e perguntas na ordem do roteiro e{" "}
                <strong>“Anterior”</strong> (<Kbd>←</Kbd> ou <Kbd>PageUp</Kbd>) volta ao slide anterior. Ao encerrar uma
                pergunta, o telão volta para o slide que estava por trás. <strong>“Mostrar no telão”</strong>, ao lado do
                QR Code, exibe o código de entrada de novo.
              </li>
              <li>
                Vai usar uma tela só, espelhada no projetor? Abra a tela do projetor logado na sua conta: nela, o passador
                e as setas também avançam a apresentação, e quem tiver o link sem estar logado só assiste.
              </li>
              <li>
                Os resultados aparecem em tempo real no projetor e na sala. Clique em <strong>“Encerrar”</strong> para
                parar de receber respostas daquela interação.
              </li>
              <li>
                No quiz, <strong>“Mostrar resposta”</strong> destaca a alternativa correta na sua sala ao vivo, para você
                comentar o resultado com a plateia.
              </li>
            </ol>
            <p>
              <strong>“Pausar”</strong> congela a sessão (ninguém responde) e <strong>“Retomar”</strong> volta ao normal.
              O número de “conectados agora” é aproximado; os participantes que entraram de fato aparecem no total ao lado.
            </p>
          </Section>

          <Section id="participantes" title="5. O que a audiência vê">
            <ul className="flex flex-col gap-1">
              <li>Quem participa entra pelo QR Code ou pelo código, sem criar conta. O nome é opcional.</li>
              <li>A pergunta ativa aparece sozinha no celular e muda quando você avança. Não é preciso recarregar.</li>
              <li>Cada pessoa responde uma vez por interação.</li>
              <li>
                O participante pode deixar e-mail ou telefone para receber materiais, só com autorização explícita. Esse
                contato fica separado das respostas.
              </li>
            </ul>
          </Section>

          <Section id="encerrar" title="6. Encerrar e aplicar a pesquisa">
            <p>
              Ao final, clique em <strong>“Encerrar sessão”</strong>. Os celulares mostram o link da pesquisa e o
              projetor exibe um QR Code para ela. Deixe essa tela no ar por um minuto.
            </p>
            <p>
              A pesquisa é sobre a palestra ou aula como um todo. Escolha o modelo em <strong>“Pesquisa pós-evento”</strong>,
              no formulário da sessão: <em>Avaliação geral</em> (padrão), <em>Satisfação e NPS</em>,{" "}
              <em>Atenção e engajamento</em>, <em>Didática (aulas)</em>, <em>Treinamento corporativo</em> ou um modelo
              seu.
            </p>
            <p>
              Em <strong>“Pesquisas”</strong>, no menu, você cria seus modelos do zero ou duplica um pronto. As perguntas
              podem ser escala de 1 a 5, nota de 0 a 10, múltipla escolha ou texto livre. Marque cada pergunta de nota
              com uma dimensão (clareza, atenção, didática etc.) para ela entrar no scorecard e na evolução. Uma sessão
              encerrada não pode ser reaberta, e editar um modelo depois não altera relatórios antigos.
            </p>
          </Section>

          <Section id="analytics" title="7. Analisar os resultados">
            <p>
              No <strong>analytics da sessão</strong> você encontra:
            </p>
            <ul className="flex flex-col gap-1">
              <li>
                <strong>Participação:</strong> quem respondeu algo dividido por quem entrou.
              </li>
              <li>
                <strong>Sinal de participação:</strong> para cada interação, respostas divididas pelos participantes
                presentes naquele momento. Mostra onde o público se envolveu mais. Mede participação, não atenção.
              </li>
              <li>
                <strong>Resultados por interação</strong>, <strong>ranking do quiz</strong> e as respostas abertas, com
                busca.
              </li>
              <li>
                <strong>Scorecard:</strong> seus pontos mais fortes e os pontos para melhorar, segundo a pesquisa, e a
                média de cada dimensão.
              </li>
              <li>
                <strong>Resultados da pesquisa:</strong> cada pergunta com a distribuição das respostas, o NPS nas notas
                de 0 a 10 e os comentários, com busca.
              </li>
              <li>
                <strong>Insights:</strong> clique em <strong>“Gerar insights”</strong> para uma análise com IA (pontos
                fortes, pontos de atenção e recomendações). Ela recebe só dados agregados e trechos de respostas, nunca
                nomes ou contatos. Com menos de 10 respostas, a confiança indicada é baixa.
              </li>
            </ul>
            <p>
              Na aba <strong>“Evolução”</strong>, compare suas avaliações entre sessões encerradas e veja se as mudanças
              surtiram efeito. Para compartilhar, use <strong>“Exportar”</strong> no analytics: relatório em PDF para o
              organizador ou cliente, e CSV das respostas e da pesquisa para planilhas.
            </p>
          </Section>

          <Section id="dicas" title="Dicas">
            <ul className="flex flex-col gap-1">
              <li>
                Faça um ensaio: inicie a sessão e responda por uma janela anônima ou pelo celular. Depois crie uma sessão
                nova para valer.
              </li>
              <li>Comece com uma pergunta fácil (enquete ou nuvem de palavras) para quebrar o gelo.</li>
              <li>Uma interação a cada 10 ou 15 minutos mantém o público envolvido sem quebrar o ritmo.</li>
              <li>Deixe o QR Code visível nos primeiros minutos: quem chega atrasado também entra.</li>
              <li>
                Prefere apresentar pelo PowerPoint ou Google Slides, com animações? Clique em{" "}
                <strong>“Baixar QR Code”</strong> (na página da sessão ou na sala ao vivo) e cole a imagem num slide. Na
                hora de cada pergunta, alterne dos slides para a tela do projetor com <Kbd>Alt</Kbd>+<Kbd>Tab</Kbd>. Sem
                trocar de janela, só enviando o PDF na aba <strong>“Slides”</strong>.
              </li>
              <li>
                Peça para responderem a pesquisa ainda na sala. A taxa de resposta cai muito depois que o público
                sai.
              </li>
            </ul>
          </Section>
        </article>
      </div>
    </div>
  );
}
