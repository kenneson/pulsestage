// Integração por MCP (Claude, ChatGPT e outros assistentes). Regras puras (sem I/O).
// O assistente lê a apresentação (PDF) no próprio chat e manda perguntas num formato simples,
// com "depois de qual slide" cada uma entra. Aqui esse formato vira a mesma entrada do builder
// (interactionInputSchema), e o roteiro é reordenado sem perder as posições planejadas,
// mesmo antes de o PDF ser enviado na aba Slides.

import { z } from "zod";
import {
  buildInteractionInput,
  DEFAULT_OPTION_POINTS,
  DEFAULT_QUIZ_TIMER_SECONDS,
  defaultSettings,
  hasOptions,
  INTERACTION_TYPE_META,
  INTERACTION_TYPES,
  interactionInputSchema,
  optionsFromLabels,
  type InteractionType,
  type NormalizedSettings,
  type ParsedInteractionInput,
} from "./interactions.ts";
import { MAX_SLIDES, type Arrangement, type DeckInteraction } from "./deck.ts";

/** Perguntas por chamada de add_interactions. */
export const MCP_MAX_BATCH = 30;

export const afterSlideSchema = z
  .number()
  .int()
  .min(0)
  .max(MAX_SLIDES)
  .nullable()
  .describe(
    "Depois de qual slide a pergunta entra: 1 = depois do slide 1, 0 = antes do primeiro slide, null = no fim da apresentação. Use a numeração de páginas do PDF.",
  );

/** Formato simples para assistentes de IA (campos planos, com nomes explícitos). */
export const mcpInteractionShape = {
  type: z
    .enum(INTERACTION_TYPES)
    .describe(
      "multiple_choice = enquete (uma escolha, sem resposta certa); quiz = pergunta com uma resposta certa e pontos; rating = nota numa escala; word_cloud = nuvem de palavras (respostas curtas); open_text = pergunta aberta; ranking = a plateia ordena as alternativas por preferência.",
    ),
  question: z.string().trim().min(1).max(300).describe("Texto da pergunta, como a plateia vai ler."),
  description: z.string().trim().max(1000).optional().describe("Texto de apoio opcional, abaixo da pergunta."),
  options: z
    .array(z.string().trim().min(1).max(200))
    .min(2)
    .max(8)
    .optional()
    .describe("Alternativas (obrigatório em multiple_choice e ranking, de 2 a 8, e quiz, de 2 a 6)."),
  correct_option: z
    .number()
    .int()
    .min(1)
    .max(8)
    .optional()
    .describe("Só quiz: número da alternativa correta, começando em 1."),
  points: z
    .number()
    .int()
    .min(0)
    .max(10000)
    .optional()
    .describe(`Só quiz: pontos de quem acerta (padrão ${DEFAULT_OPTION_POINTS}).`),
  timer_seconds: z
    .number()
    .int()
    .min(5)
    .max(300)
    .nullable()
    .optional()
    .describe(`Só quiz: tempo para responder, em segundos (padrão ${DEFAULT_QUIZ_TIMER_SECONDS}; null = sem limite).`),
  speed_bonus: z
    .boolean()
    .optional()
    .describe("Só quiz com tempo: quem responde mais rápido ganha mais pontos, de 100% a 50% (padrão sim)."),
  shapes: z
    .boolean()
    .optional()
    .describe("Enquete e quiz: alternativas com forma e cor (estilo jogo), boas para telão. Padrão: sim no quiz, não na enquete."),
  scale_min: z.number().int().min(0).max(1).optional().describe("Só rating: início da escala, 0 ou 1 (padrão 1)."),
  scale_max: z.number().int().min(2).max(10).optional().describe("Só rating: fim da escala, de 2 a 10 (padrão 5)."),
  min_label: z.string().trim().max(40).optional().describe("Só rating: legenda do menor valor."),
  max_label: z.string().trim().max(40).optional().describe("Só rating: legenda do maior valor."),
  max_length: z
    .number()
    .int()
    .optional()
    .describe("word_cloud: tamanho máximo da resposta (5 a 50, padrão 30); open_text: 20 a 500, padrão 280."),
  show_on_display: z.boolean().optional().describe("Só open_text: mostrar as respostas no telão (padrão sim)."),
  after_slide: afterSlideSchema.optional(),
};

export const mcpInteractionSchema = z.object(mcpInteractionShape);
export type McpInteraction = z.infer<typeof mcpInteractionSchema>;

type Converted = { ok: true; input: ParsedInteractionInput; afterSlide: number | null } | { ok: false; error: string };

/**
 * Converte para a entrada do builder e valida com as mesmas regras do painel. `translate` transforma a chave
 * de validação ("validation.questionRequired") em texto no idioma do palestrante.
 */
export function toInteractionInput(
  item: McpInteraction,
  translate: (message: string) => string = (m) => m,
  /** Na edição, as configurações atuais da pergunta: o que o assistente omitir continua como está. */
  current?: NormalizedSettings,
): Converted {
  // Parte dos mesmos padrões do painel (ou do que a pergunta já tem); o que o assistente informar substitui.
  const defaults = current ?? defaultSettings(item.type);
  const optionStyle = item.shapes === undefined ? defaults.optionStyle : item.shapes ? "shapes" : "text";
  const labels = item.options ?? [];
  let correctIndex: number | null = null;
  if (item.type === "quiz") {
    if (item.correct_option === undefined) return { ok: false, error: "Informe correct_option (a alternativa certa)." };
    if (item.correct_option > labels.length) {
      return { ok: false, error: `correct_option ${item.correct_option} não existe (há ${labels.length} alternativas).` };
    }
    correctIndex = item.correct_option - 1;
  }
  const timerSeconds = item.timer_seconds === undefined ? defaults.timerSeconds : item.timer_seconds;
  const settings: NormalizedSettings = {
    ...defaults,
    optionStyle,
    timerSeconds,
    speedBonus: timerSeconds !== null && (item.speed_bonus ?? defaults.speedBonus),
    min: item.scale_min ?? defaults.min,
    max: item.scale_max ?? defaults.max,
    minLabel: item.min_label === undefined ? defaults.minLabel : item.min_label || null,
    maxLabel: item.max_label === undefined ? defaults.maxLabel : item.max_label || null,
    maxLength: item.max_length ?? defaults.maxLength,
    showOnDisplay: item.show_on_display ?? defaults.showOnDisplay,
  };
  const options = hasOptions(item.type)
    ? optionsFromLabels(item.type, labels, correctIndex).map((o) =>
        item.type === "quiz" && item.points !== undefined ? { ...o, points: item.points } : o,
      )
    : [];
  const raw = buildInteractionInput({
    type: item.type,
    title: item.question,
    description: item.description,
    settings,
    options,
  });
  const parsed = interactionInputSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? ` (${issue.path.join(".")})` : "";
    return { ok: false, error: `${issue ? translate(issue.message) : "Dados inválidos."}${where}` };
  }
  return { ok: true, input: parsed.data, afterSlide: item.after_slide ?? null };
}

/** Valida um lote inteiro antes de gravar qualquer coisa: ou entram todas, ou nenhuma. */
export function convertBatch(
  items: readonly McpInteraction[],
  translate: (message: string) => string = (m) => m,
): { ok: true; items: { input: ParsedInteractionInput; afterSlide: number | null }[] } | { ok: false; error: string } {
  const out: { input: ParsedInteractionInput; afterSlide: number | null }[] = [];
  for (const [index, item] of items.entries()) {
    const converted = toInteractionInput(item, translate);
    if (!converted.ok) return { ok: false, error: `Interação ${index + 1} (“${item.question.slice(0, 60)}”): ${converted.error}` };
    out.push({ input: converted.input, afterSlide: converted.afterSlide });
  }
  return { ok: true, items: out };
}

// ---------------------------------------------------------------------------
// Ordem do roteiro
// ---------------------------------------------------------------------------

const keyOf = (afterSlide: number | null) => (afterSlide === null ? Number.POSITIVE_INFINITY : afterSlide);

/**
 * Ordena pelo ponto da apresentação (sem limitar ao número de slides: a posição planejada vale
 * quando o PDF chegar). Empates mantêm a ordem recebida.
 */
function byAnchor(items: readonly DeckInteraction[]): Arrangement {
  const ordered = items
    .map((item, order) => ({ item, order }))
    .sort((a, b) => keyOf(a.item.afterSlide) - keyOf(b.item.afterSlide) || a.order - b.order)
    .map((e) => e.item);
  return { ids: ordered.map((i) => i.id), afterSlides: ordered.map((i) => i.afterSlide) };
}

/** Perguntas novas entram no roteiro existente, cada uma no seu ponto (depois das que já estão lá). */
export function mergeArrangement(existing: readonly DeckInteraction[], added: readonly DeckInteraction[]): Arrangement {
  return byAnchor([...existing, ...added]);
}

/** Muda uma pergunta de lugar: vai para o fim do ponto escolhido. null quando ela não existe. */
export function relocate(
  interactions: readonly DeckInteraction[],
  id: string,
  afterSlide: number | null,
): Arrangement | null {
  if (!interactions.some((i) => i.id === id)) return null;
  return byAnchor([...interactions.filter((i) => i.id !== id), { id, afterSlide }]);
}

// ---------------------------------------------------------------------------
// Visão para o assistente
// ---------------------------------------------------------------------------

export type McpInteractionView = {
  id: string;
  type: InteractionType;
  type_label: string;
  question: string;
  description: string | null;
  after_slide: number | null;
  position_label: string;
  options?: { label: string; correct?: boolean; points?: number }[];
  settings: Record<string, unknown>;
};

/** "Antes do 1º slide", "Depois do slide 4" ou "No fim" (sem depender do PDF já estar enviado). */
export function positionLabel(afterSlide: number | null, slideCount: number): string {
  if (afterSlide === null) return "No fim";
  if (afterSlide === 0) return "Antes do 1º slide";
  if (slideCount > 0 && afterSlide >= slideCount) return "No fim (depois do último slide)";
  return `Depois do slide ${afterSlide}`;
}

export function toInteractionView(
  row: {
    id: string;
    type: InteractionType;
    title: string;
    description: string | null;
    after_slide: number | null;
    settings: unknown;
    options: { label: string; is_correct: boolean; points: number; position: number }[];
  },
  slideCount: number,
): McpInteractionView {
  const options = [...row.options].sort((a, b) => a.position - b.position);
  return {
    id: row.id,
    type: row.type,
    type_label: INTERACTION_TYPE_META[row.type].label,
    question: row.title,
    description: row.description,
    after_slide: row.after_slide,
    position_label: positionLabel(row.after_slide, slideCount),
    ...(options.length > 0
      ? {
          options: options.map((o) =>
            row.type === "quiz" ? { label: o.label, correct: o.is_correct, points: o.points } : { label: o.label },
          ),
        }
      : {}),
    settings: typeof row.settings === "object" && row.settings !== null ? (row.settings as Record<string, unknown>) : {},
  };
}

// ---------------------------------------------------------------------------
// Textos para o assistente
// ---------------------------------------------------------------------------

export const MCP_INSTRUCTIONS = `PulseStage cria interações ao vivo (enquete, quiz, escala, nuvem de palavras e pergunta aberta) para aulas, palestras e treinamentos. A plateia responde pelo celular e os resultados aparecem no telão.

Fluxo recomendado quando a pessoa anexar uma apresentação (PDF) no chat:
1. Leia os slides e entenda o tema, o público e a sequência.
2. Proponha um roteiro curto antes de gravar: para cada pergunta, o tipo, o texto, as alternativas e depois de qual slide ela entra (numeração das páginas do PDF). Espere a confirmação.
3. Crie a sessão com create_session (ou use uma existente) e grave tudo de uma vez com add_interactions, informando after_slide.
4. Diga à pessoa para abrir o link da aba Slides e enviar o mesmo PDF: as perguntas já aparecem nos lugares certos.

Ranking serve para a plateia ordenar prioridades (3 a 5 alternativas). Durante a sessão, a plateia também pode mandar perguntas ao palestrante e reagir com emojis; isso é ligado na própria sessão (não precisa criar).

Boas práticas: uma interação a cada 5 a 8 slides (cerca de 1 a cada 5 a 10 minutos); abrir com algo leve (enquete ou nuvem sobre a experiência da plateia); quiz logo depois de um conteúdo explicado, com distratores plausíveis; escala para medir confiança ou concordância; terminar com pergunta aberta ou nuvem. Perguntas curtas, que caibam no celular. Não invente dados que não estão nos slides.

Idiomas: a sessão tem um idioma (pt-BR, es-419 = espanhol latino neutro, en-US = inglês americano), que vale para o telão e o celular da plateia. Ao criar, use language no idioma em que a pessoa conversa com você (ou o que ela pedir) e escreva as perguntas nesse idioma.

O MCP não inicia nem encerra sessões ao vivo: isso é feito no app. Sessões encerradas não podem ser editadas, mas get_session_results traz os resultados para análise.`;

export function planPromptText(args: { audience?: string; duration?: string; goal?: string }): string {
  const context = [
    args.audience ? `Público: ${args.audience}.` : null,
    args.duration ? `Duração: ${args.duration}.` : null,
    args.goal ? `Objetivo: ${args.goal}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return `Use a apresentação (PDF) que anexei para planejar interações no PulseStage. ${context}

1. Resuma em poucas linhas a sequência dos slides (número da página e assunto).
2. Proponha entre 4 e 8 interações: tipo, pergunta, alternativas (no quiz, marque a certa) e depois de qual slide entra (after_slide = número da página do PDF). Varie os tipos e explique em uma linha por que cada uma ajuda naquele ponto.
3. Espere eu aprovar ou ajustar.
4. Depois de aprovado: crie a sessão (create_session) ou pergunte se devo usar uma existente (list_sessions), grave com add_interactions e me passe o link da aba Slides para eu enviar o PDF.`;
}
