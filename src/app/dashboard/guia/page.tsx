import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PlusIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Guia" };

// Manual de uso. Os nomes entre aspas são os rótulos reais dos botões: ao renomear um botão, atualize aqui.

const SECTIONS = [
  { id: "criar", title: "1. Criar a sessão" },
  { id: "roteiro", title: "2. Montar o roteiro" },
  { id: "ao-vivo", title: "3. Apresentar ao vivo" },
  { id: "participantes", title: "4. O que a audiência vê" },
  { id: "encerrar", title: "5. Encerrar e aplicar a pesquisa" },
  { id: "analytics", title: "6. Analisar os resultados" },
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
              para <strong>subir ou descer</strong> na ordem e o lápis para editar.
            </p>
          </Section>

          <Section id="ao-vivo" title="3. Apresentar ao vivo">
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
                Para lançar uma pergunta, clique nela na lista ou em <strong>“Próxima”</strong>. Também funciona a seta
                <Kbd>→</Kbd> do teclado, útil com passador de slides.
              </li>
              <li>
                Os resultados aparecem em tempo real no projetor e na sala. Clique em <strong>“Encerrar”</strong> para
                parar de receber respostas daquela interação.
              </li>
              <li>
                No quiz, <strong>“Mostrar resposta”</strong> destaca a alternativa correta no projetor.
              </li>
            </ol>
            <p>
              <strong>“Pausar”</strong> congela a sessão (ninguém responde) e <strong>“Retomar”</strong> volta ao normal.
              O número de “conectados agora” é aproximado; os participantes que entraram de fato aparecem no total ao lado.
            </p>
          </Section>

          <Section id="participantes" title="4. O que a audiência vê">
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

          <Section id="encerrar" title="5. Encerrar e aplicar a pesquisa">
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

          <Section id="analytics" title="6. Analisar os resultados">
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
              surtiram efeito.
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
