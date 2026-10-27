// Integração por MCP (Claude, ChatGPT e outros assistentes). Regras puras (sem I/O).
// O assistente lê a apresentação (PDF) no próprio chat e manda perguntas num formato simples,
// com "depois de qual slide" cada uma entra. Aqui esse formato vira a mesma entrada do builder
// (interactionInputSchema), e o roteiro é reordenado sem perder as posições planejadas,
// mesmo antes de o PDF ser enviado na aba Slides.

import { z } from "zod";
import {
  ACCEPTED_ANSWERS_MAX,
  buildInteractionInput,
  CONTENT_BODY_MAX,
  DEFAULT_OPTION_POINTS,
  DEFAULT_QUIZ_TIMER_SECONDS,
  defaultSettings,
  hasOptions,
  INTERACTION_TYPE_META,
  INTERACTION_TYPES,
  interactionInputSchema,
  isScoredType,
  NOTES_MAX,
  optionsFromLabels,
  parseGuessAnswerKey,
  parseQuizTextAnswerKey,
  type AnswerKey,
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
      [
        "multiple_choice = enquete (uma escolha ou várias com max_choices, sem resposta certa)",
        "quiz = pergunta com uma resposta certa e pontos",
        "rating = nota numa escala",
        "word_cloud = nuvem de palavras (respostas curtas)",
        "open_text = pergunta aberta",
        "ranking = a plateia ordena as alternativas por preferência",
        "points_100 = cada pessoa distribui 100 pontos entre as alternativas (prioridades, orçamento)",
        "matrix_2x2 = cada pessoa posiciona os itens (options) em dois eixos de 0 a 100 (ex.: esforço × impacto)",
        "guess_number = adivinhe o número: quem chega mais perto de correct_number ganha mais pontos",
        "quiz_text = quiz de digitar: a pessoa escreve a resposta, comparada com accepted_answers (ignora maiúsculas, acentos e um erro de digitação)",
        "content = slide de conteúdo sem resposta (título, texto em body, vídeo em video_url)",
        "pin_image = marcar na imagem (só pelo painel, pois precisa de imagem enviada; aqui só dá para editar uma que já existe)",
      ].join("; ") + ".",
    ),
  question: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .describe("Texto da pergunta, como a plateia vai ler (em content, o título do slide)."),
  description: z.string().trim().max(1000).optional().describe("Texto de apoio opcional, abaixo da pergunta."),
  options: z
    .array(z.string().trim().min(1).max(200))
    .min(1)
    .max(8)
    .optional()
    .describe(
      "Alternativas: obrigatório em multiple_choice, ranking e points_100 (2 a 8) e quiz (2 a 6); em matrix_2x2 são os itens a posicionar (1 a 8).",
    ),
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
    .describe(
      `Tempo para responder, em segundos (5 a 300; null = sem limite). Vale para todo tipo menos content. Padrão: ${DEFAULT_QUIZ_TIMER_SECONDS} no quiz e no quiz_text, sem limite nos outros.`,
    ),
  speed_bonus: z
    .boolean()
    .optional()
    .describe("Só quiz e quiz_text com tempo: quem responde mais rápido ganha mais pontos, de 100% a 50% (padrão sim)."),
  shapes: z
    .boolean()
    .optional()
    .describe("Enquete e quiz: alternativas com forma e cor (estilo jogo), boas para telão. Padrão: sim no quiz, não na enquete."),
  max_choices: z
    .number()
    .int()
    .min(1)
    .max(8)
    .optional()
    .describe("Só multiple_choice: quantas alternativas cada pessoa pode marcar (1 = uma só, o padrão; até o número de alternativas)."),
  is_segment: z
    .boolean()
    .optional()
    .describe(
      "Só multiple_choice: pergunta de perfil usada para comparar grupos (ex.: \"Qual sua área?\"); o palestrante filtra os resultados das outras perguntas por alternativa. Padrão não.",
    ),
  hide_results: z
    .boolean()
    .optional()
    .describe("O telão esconde os resultados até o palestrante tocar em \"Revelar resultados\" (bom para não influenciar). Padrão não."),
  show_results_on_phone: z
    .boolean()
    .optional()
    .describe("Depois de responder, o celular mostra o gráfico ao vivo. Não vale em quiz, quiz_text e guess_number. Padrão não."),
  scale_min: z.number().int().min(0).max(1).optional().describe("Só rating: início da escala, 0 ou 1 (padrão 1)."),
  scale_max: z.number().int().min(2).max(10).optional().describe("Só rating: fim da escala, de 2 a 10 (padrão 5)."),
  min_label: z.string().trim().max(40).optional().describe("Só rating: legenda do menor valor."),
  max_label: z.string().trim().max(40).optional().describe("Só rating: legenda do maior valor."),
  max_length: z
    .number()
    .int()
    .optional()
    .describe("Tamanho máximo da resposta: word_cloud 5 a 50 (padrão 30); open_text 20 a 500 (padrão 280); quiz_text 5 a 60 (padrão 60)."),
  show_on_display: z.boolean().optional().describe("Só open_text: mostrar as respostas no telão (padrão sim)."),
  x_label: z.string().trim().max(40).optional().describe("Só matrix_2x2: nome do eixo horizontal (ex.: Esforço)."),
  x_low: z.string().trim().max(40).optional().describe("Só matrix_2x2: rótulo da ponta esquerda do eixo horizontal (ex.: Baixo)."),
  x_high: z.string().trim().max(40).optional().describe("Só matrix_2x2: rótulo da ponta direita do eixo horizontal (ex.: Alto)."),
  y_label: z.string().trim().max(40).optional().describe("Só matrix_2x2: nome do eixo vertical (ex.: Impacto)."),
  y_low: z.string().trim().max(40).optional().describe("Só matrix_2x2: rótulo da ponta de baixo do eixo vertical."),
  y_high: z.string().trim().max(40).optional().describe("Só matrix_2x2: rótulo da ponta de cima do eixo vertical."),
  number_min: z.number().finite().optional().describe("Só guess_number: menor número aceito (padrão 0)."),
  number_max: z.number().finite().optional().describe("Só guess_number: maior número aceito (padrão 100; maior que number_min)."),
  decimals: z.number().int().min(0).max(2).optional().describe("Só guess_number: casas decimais aceitas, 0 a 2 (padrão 0)."),
  unit: z.string().trim().max(10).optional().describe("Só guess_number: unidade mostrada ao lado do número (ex.: %, kg, anos)."),
  correct_number: z
    .number()
    .finite()
    .optional()
    .describe("Só guess_number (obrigatório ao criar): o número certo, entre number_min e number_max. A plateia não vê até a revelação."),
  max_points: z
    .number()
    .int()
    .min(0)
    .max(10000)
    .optional()
    .describe(`guess_number e quiz_text: pontos de quem acerta em cheio (padrão ${DEFAULT_OPTION_POINTS}).`),
  accepted_answers: z
    .array(z.string().trim().min(1).max(60))
    .min(1)
    .max(ACCEPTED_ANSWERS_MAX)
    .optional()
    .describe(
      `Só quiz_text (obrigatório ao criar): respostas aceitas como certas, 1 a ${ACCEPTED_ANSWERS_MAX} (ex.: ["Brasília", "DF"]). Maiúsculas, acentos e um erro de digitação em palavras longas já são tolerados.`,
    ),
  body: z
    .string()
    .trim()
    .max(CONTENT_BODY_MAX)
    .optional()
    .describe('Só content: texto do slide (parágrafos separados por linha em branco; linhas começando com "- " viram lista).'),
  video_url: z
    .string()
    .trim()
    .max(300)
    .optional()
    .describe("Só content: link de vídeo do YouTube ou do Vimeo (vazio remove)."),
  notes: z
    .string()
    .trim()
    .max(NOTES_MAX)
    .optional()
    .describe("Notas do palestrante: só ele vê, na sala ao vivo, quando o item está no telão (vazio remove)."),
  after_slide: afterSlideSchema.optional(),
};

export const mcpInteractionSchema = z.object(mcpInteractionShape);
export type McpInteraction = z.infer<typeof mcpInteractionSchema>;

type Converted = { ok: true; input: ParsedInteractionInput; afterSlide: number | null } | { ok: false; error: string };

/** Na edição, o que a pergunta já tem: o que o assistente omitir continua como está. */
export type McpCurrent = { settings: NormalizedSettings; answerKey?: unknown; notes?: string | null };

const orKeep = (value: string | undefined, current: string | null) => (value === undefined ? current : value || null);

/**
 * Converte para a entrada do builder e valida com as mesmas regras do painel. `translate` transforma a chave
 * de validação ("validation.questionRequired") em texto no idioma do palestrante.
 */
export function toInteractionInput(
  item: McpInteraction,
  translate: (message: string) => string = (m) => m,
  /** Na edição (mesmo tipo), as configurações, o gabarito e as notas atuais. */
  current?: McpCurrent,
): Converted {
  // Imagem só chega pelo painel (o assistente não envia arquivos).
  if (item.type === "pin_image" && !current?.settings.imagePath) {
    return {
      ok: false,
      error: "pin_image precisa de uma imagem enviada no painel: crie a pergunta lá; depois dá para editar os textos por aqui.",
    };
  }
  // Parte dos mesmos padrões do painel (ou do que a pergunta já tem); o que o assistente informar substitui.
  const defaults = current?.settings ?? defaultSettings(item.type);
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

  let answerKey: AnswerKey | null = null;
  if (item.type === "guess_number") {
    const value = item.correct_number ?? parseGuessAnswerKey(current?.answerKey)?.value;
    if (value === undefined) return { ok: false, error: "Informe correct_number (o número certo)." };
    answerKey = { value };
  }
  if (item.type === "quiz_text") {
    const accepted = item.accepted_answers ?? parseQuizTextAnswerKey(current?.answerKey)?.accepted;
    if (!accepted) return { ok: false, error: "Informe accepted_answers (as respostas aceitas)." };
    answerKey = { accepted };
  }

  const timerSeconds = item.timer_seconds === undefined ? defaults.timerSeconds : item.timer_seconds;
  const settings: NormalizedSettings = {
    ...defaults,
    optionStyle,
    timerSeconds,
    speedBonus: timerSeconds !== null && (item.speed_bonus ?? defaults.speedBonus),
    hideResults: item.hide_results ?? defaults.hideResults,
    // Nunca em tipos que pontuam (o celular mostra o "Acertou!", não o gráfico).
    showResultsOnPhone: !isScoredType(item.type) && (item.show_results_on_phone ?? defaults.showResultsOnPhone),
    maxChoices: item.max_choices ?? defaults.maxChoices,
    isSegment: item.is_segment ?? defaults.isSegment,
    min: item.scale_min ?? defaults.min,
    max: item.scale_max ?? defaults.max,
    minLabel: orKeep(item.min_label, defaults.minLabel),
    maxLabel: orKeep(item.max_label, defaults.maxLabel),
    maxLength: item.max_length ?? defaults.maxLength,
    showOnDisplay: item.show_on_display ?? defaults.showOnDisplay,
    xLabel: orKeep(item.x_label, defaults.xLabel),
    xLow: orKeep(item.x_low, defaults.xLow),
    xHigh: orKeep(item.x_high, defaults.xHigh),
    yLabel: orKeep(item.y_label, defaults.yLabel),
    yLow: orKeep(item.y_low, defaults.yLow),
    yHigh: orKeep(item.y_high, defaults.yHigh),
    numMin: item.number_min ?? defaults.numMin,
    numMax: item.number_max ?? defaults.numMax,
    decimals: item.decimals ?? defaults.decimals,
    unit: orKeep(item.unit, defaults.unit),
    maxPoints: item.max_points ?? defaults.maxPoints,
    body: item.body ?? defaults.body,
    videoUrl: orKeep(item.video_url, defaults.videoUrl),
  };
  const options = hasOptions(item.type)
    ? optionsFromLabels(item.type, labels, correctIndex).map((o) =>
        item.type === "quiz" && item.points !== undefined ? { ...o, points: item.points } : o,
      )
    : [];
  const notes = item.notes ?? current?.notes ?? undefined;
  const raw = buildInteractionInput({
    type: item.type,
    title: item.question,
    description: item.description,
    notes: notes || undefined,
    settings,
    options,
    answerKey,
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
  /** guess_number: o número certo (só o dono vê; a plateia não) */
  correct_number?: number;
  /** quiz_text: respostas aceitas */
  accepted_answers?: string[];
  /** notas do palestrante */
  notes?: string;
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
    answer_key?: unknown;
    speaker_notes?: string | null;
    options: { label: string; is_correct: boolean; points: number; position: number }[];
  },
  slideCount: number,
): McpInteractionView {
  const options = [...row.options].sort((a, b) => a.position - b.position);
  const guess = row.type === "guess_number" ? parseGuessAnswerKey(row.answer_key) : null;
  const accepted = row.type === "quiz_text" ? parseQuizTextAnswerKey(row.answer_key) : null;
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
    ...(guess ? { correct_number: guess.value } : {}),
    ...(accepted ? { accepted_answers: accepted.accepted } : {}),
    ...(row.speaker_notes ? { notes: row.speaker_notes } : {}),
  };
}

// ---------------------------------------------------------------------------
// Textos para o assistente
// ---------------------------------------------------------------------------

export const MCP_INSTRUCTIONS = `PulseStage cria interações ao vivo (enquete, quiz, escala, nuvem de palavras, pergunta aberta, ranking, 100 pontos, matriz 2×2, adivinhe o número, quiz de digitar e slides de conteúdo) para aulas, palestras e treinamentos. A plateia responde pelo celular e os resultados aparecem no telão.

Fluxo recomendado quando a pessoa anexar uma apresentação (PDF) no chat:
1. Leia os slides e entenda o tema, o público e a sequência.
2. Proponha um roteiro curto antes de gravar: para cada pergunta, o tipo, o texto, as alternativas e depois de qual slide ela entra (numeração das páginas do PDF). Espere a confirmação.
3. Crie a sessão com create_session (ou use uma existente) e grave tudo de uma vez com add_interactions, informando after_slide.
4. Diga à pessoa para abrir o link da aba Slides e enviar o mesmo PDF: as perguntas já aparecem nos lugares certos.

Ranking serve para a plateia ordenar prioridades (3 a 5 alternativas); points_100, para mostrar o peso de cada uma (distribuir 100 pontos); matrix_2x2, para posicionar itens em dois eixos (ex.: esforço × impacto, com x_label/y_label e as pontas). Quiz, quiz_text (digitar a resposta, com accepted_answers) e guess_number (chutar um número, com correct_number e a faixa) dão pontos e entram no mesmo ranking. Uma enquete com is_segment (ex.: área ou cargo) permite comparar os grupos nos resultados. content é um slide sem resposta (texto em body ou vídeo do YouTube/Vimeo em video_url), útil para instruções ou transições. Use notes para lembretes do palestrante (só ele vê). pin_image precisa de imagem: crie pelo painel. Durante a sessão, a plateia também pode mandar perguntas ao palestrante e reagir com emojis; isso é ligado na própria sessão (não precisa criar).

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
