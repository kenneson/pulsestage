import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { publicEnv, joinUrl } from "@/lib/env";
import { APP_TIME_ZONE, formatDateTime, isValidTimeZone, zonedToUtcIso } from "@/lib/datetime";
import { getOwnedSession, getSessionInteractions } from "@/lib/data/sessions";
import { listSurveyTemplates } from "@/lib/data/surveys";
import { loadSessionAnalytics } from "@/lib/data/analytics";
import { isInteractionType } from "@/lib/domain/interactions";
import { STATUS_LABEL, isSessionStatus } from "@/lib/domain/session";
import {
  afterSlideSchema,
  convertBatch,
  MCP_INSTRUCTIONS,
  MCP_MAX_BATCH,
  mcpInteractionSchema,
  mcpInteractionShape,
  mergeArrangement,
  planPromptText,
  relocate,
  toInteractionInput,
  toInteractionView,
} from "@/lib/domain/mcp";
import {
  createInteraction,
  deleteInteraction,
  foreignImage,
  saveArrangement,
  updateInteraction,
} from "@/features/interactions/core";
import { insertSession, isVisibleTemplate } from "@/features/sessions/core";
import type { SessionRow } from "@/lib/supabase/types";
import type { McpContext } from "./auth";
import { summarizeForAssistant } from "./results";
import { listSessionQuestions, loadReactions } from "@/lib/data/engagement";
import { tallyReactions } from "@/lib/domain/reactions";
import { DEFAULT_LOCALE, LOCALE_NAME, LOCALES, toLocale } from "@/lib/domain/locale";
import { getMessageTranslator } from "@/i18n/server";

// Servidor MCP do PulseStage: um por requisição (sem estado), já com o usuário autenticado.

const VERSION = "1.0.0";

function json(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function error(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function links(session: Pick<SessionRow, "id" | "join_code">) {
  const base = `${publicEnv.appUrl}/dashboard/sessions/${session.id}`;
  return {
    edit: base,
    slides_tab: `${base}?aba=slides`,
    live_room: `${base}/live`,
    projector: `${publicEnv.appUrl}/session/${session.id}/display`,
    join: joinUrl(session.join_code),
  };
}

const sessionIdSchema = z.uuid().describe("id da sessão (de list_sessions ou create_session)");
const interactionIdSchema = z.uuid().describe("id da interação (de get_session)");
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use AAAA-MM-DD.")
  .describe("Data da sessão, AAAA-MM-DD, no fuso do palestrante.");
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM.").describe("Horário de início, HH:MM (24 h).");

async function speakerPrefs(ctx: McpContext) {
  const { data } = await ctx.supabase
    .from("profiles")
    .select("time_zone, default_survey_template_id, default_duration_minutes, locale")
    .eq("id", ctx.userId)
    .maybeSingle();
  const timeZone = data?.time_zone && isValidTimeZone(data.time_zone) ? data.time_zone : APP_TIME_ZONE;
  const locale = toLocale(data?.locale) ?? DEFAULT_LOCALE;
  // Sem padrão no perfil, o mesmo do formulário do painel: o modelo "geral" da plataforma, no idioma do perfil.
  let surveyTemplateId = data?.default_survey_template_id ?? null;
  if (!surveyTemplateId) {
    const { data: general } = await ctx.supabase
      .from("survey_templates")
      .select("id")
      .is("owner_id", null)
      .eq("slug", "geral")
      .eq("locale", locale)
      .maybeSingle();
    surveyTemplateId = general?.id ?? null;
  }
  // Erros das regras do painel (validação, core.*) no idioma do palestrante.
  const translate = (await getMessageTranslator(locale)).message;
  return { timeZone, surveyTemplateId, duration: data?.default_duration_minutes ?? null, locale, translate };
}

/** Sessão do usuário que ainda pode ser editada. */
async function editableSession(ctx: McpContext, sessionId: string): Promise<SessionRow | string> {
  const session = await getOwnedSession(ctx.supabase, sessionId);
  if (!session) return "Sessão não encontrada (confira o id com list_sessions).";
  if (session.status === "completed") return "A sessão já foi encerrada e não pode ser editada.";
  return session;
}

async function sessionView(ctx: McpContext, session: SessionRow) {
  const interactions = await getSessionInteractions(ctx.supabase, session.id);
  const prefs = await speakerPrefs(ctx);
  return {
    id: session.id,
    title: session.title,
    description: session.description,
    status: session.status,
    status_label: isSessionStatus(session.status) ? STATUS_LABEL[session.status] : session.status,
    scheduled_at: session.scheduled_at ? formatDateTime(session.scheduled_at, prefs.timeZone) : null,
    planned_minutes: session.estimated_duration_minutes,
    language: session.locale,
    language_name: LOCALE_NAME[toLocale(session.locale) ?? DEFAULT_LOCALE],
    join_code: session.join_code,
    slides:
      session.slide_count > 0
        ? `${session.slide_count} slides enviados`
        : "PDF ainda não enviado: as posições (after_slide) ficam guardadas e valem quando o PDF for enviado na aba Slides.",
    slide_count: session.slide_count,
    interactions: interactions
      .map((i) => (isInteractionType(i.type) ? toInteractionView({ ...i, type: i.type }, session.slide_count) : null))
      .filter((v) => v !== null),
    links: links(session),
  };
}

export function buildMcpServer(ctx: McpContext): McpServer {
  const server = new McpServer({ name: "pulsestage", title: "PulseStage", version: VERSION }, { instructions: MCP_INSTRUCTIONS });

  // ---- Leitura ------------------------------------------------------------

  server.registerTool(
    "list_sessions",
    {
      title: "Listar sessões",
      description: "Lista as sessões do palestrante (mais recentes primeiro), com status, data, código e número de perguntas.",
      inputSchema: {
        status: z.enum(["draft", "live", "paused", "completed"]).optional().describe("Filtrar por status."),
        limit: z.number().int().min(1).max(50).optional().describe("Quantas sessões (padrão 20)."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ status, limit }) => {
      let query = ctx.supabase
        .from("sessions")
        .select("id, title, status, scheduled_at, join_code, slide_count, created_at, interactions(count)")
        .eq("is_test", false)
        .order("created_at", { ascending: false })
        .limit(limit ?? 20);
      if (status) query = query.eq("status", status);
      const { data, error: dbError } = await query;
      if (dbError) return error("Não foi possível listar as sessões.");
      const { timeZone } = await speakerPrefs(ctx);
      return json(
        data.map((s) => ({
          id: s.id,
          title: s.title,
          status: s.status,
          status_label: isSessionStatus(s.status) ? STATUS_LABEL[s.status] : s.status,
          scheduled_at: s.scheduled_at ? formatDateTime(s.scheduled_at, timeZone) : null,
          join_code: s.join_code,
          slide_count: s.slide_count,
          interactions: s.interactions[0]?.count ?? 0,
          link: `${publicEnv.appUrl}/dashboard/sessions/${s.id}`,
        })),
      );
    },
  );

  server.registerTool(
    "get_session",
    {
      title: "Ver sessão",
      description:
        "Mostra a sessão com o roteiro completo: cada interação com tipo, texto, alternativas (no quiz, qual é a certa), depois de qual slide entra e os links (editar, aba Slides, sala ao vivo, entrada da plateia).",
      inputSchema: { session_id: sessionIdSchema },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ session_id }) => {
      const session = await getOwnedSession(ctx.supabase, session_id);
      if (!session) return error("Sessão não encontrada (confira o id com list_sessions).");
      return json(await sessionView(ctx, session));
    },
  );

  server.registerTool(
    "list_survey_templates",
    {
      title: "Listar modelos de pesquisa",
      description: "Modelos de pesquisa pós-evento disponíveis (da plataforma e do palestrante), para usar em create_session.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const templates = await listSurveyTemplates(ctx.supabase);
      const { surveyTemplateId } = await speakerPrefs(ctx);
      return json(
        templates.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          questions: t.questions.length,
          mine: !t.isPlatform,
          default: t.id === surveyTemplateId,
        })),
      );
    },
  );

  server.registerTool(
    "get_session_results",
    {
      title: "Resultados da sessão",
      description:
        "Resultados de uma sessão já apresentada: participação, respostas de cada interação (votos, acertos do quiz, médias, palavras, respostas abertas, ordem do ranking), perguntas da plateia com curtidas, reações e a pesquisa pós-evento (nota 0 a 10, dimensões e comentários). Sem dados pessoais.",
      inputSchema: { session_id: sessionIdSchema },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ session_id }) => {
      const bundle = await loadSessionAnalytics(ctx.supabase, session_id);
      if (!bundle) return error("Sessão não encontrada (confira o id com list_sessions).");
      if (bundle.session.status === "draft") return error("A sessão ainda não foi apresentada: não há resultados.");
      const [questions, reactions] = await Promise.all([
        listSessionQuestions(ctx.supabase, session_id),
        loadReactions(ctx.supabase, session_id),
      ]);
      return json(summarizeForAssistant(bundle, { questions, reactions: tallyReactions(reactions) }));
    },
  );

  // ---- Escrita ------------------------------------------------------------

  server.registerTool(
    "create_session",
    {
      title: "Criar sessão",
      description:
        "Cria uma sessão (aula, palestra ou treinamento) em rascunho. Depois, use add_interactions para gravar as perguntas. Devolve o id e os links.",
      inputSchema: {
        title: z.string().trim().min(1).max(200).describe("Título da sessão."),
        description: z.string().trim().max(2000).optional().describe("Descrição curta (aparece para o palestrante)."),
        date: dateSchema.optional(),
        time: timeSchema.optional(),
        duration_minutes: z.number().int().min(1).max(1440).optional().describe("Duração prevista em minutos."),
        survey_template_id: z
          .uuid()
          .optional()
          .describe("Modelo de pesquisa pós-evento (de list_survey_templates). Sem ele, usa o padrão do palestrante."),
        language: z
          .enum(LOCALES)
          .optional()
          .describe(
            "Idioma da sessão (telão e celular da plateia): pt-BR, es-419 (espanhol latino) ou en-US. Sem ele, o do perfil. Escreva as perguntas neste idioma.",
          ),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ title, description, date, time, duration_minutes, survey_template_id, language }) => {
      const prefs = await speakerPrefs(ctx);
      let scheduledAt: string | null = null;
      if (date) {
        scheduledAt = zonedToUtcIso(date, time ?? "00:00", prefs.timeZone);
        if (!scheduledAt) return error("Data ou horário inválidos.");
      }
      const templateId = survey_template_id ?? prefs.surveyTemplateId;
      if (!(await isVisibleTemplate(ctx.supabase, templateId))) return error("Modelo de pesquisa inválido.");

      const created = await insertSession(ctx.supabase, {
        speakerId: ctx.userId,
        title,
        description: description ?? null,
        scheduledAt,
        duration: duration_minutes ?? prefs.duration,
        joinCode: null,
        surveyTemplateId: templateId,
        locale: language ?? prefs.locale,
      });
      if (!created.ok) return error(prefs.translate(created.error));
      const session = await getOwnedSession(ctx.supabase, created.data.id);
      if (!session) return error("A sessão foi criada, mas não foi possível lê-la.");
      return json({ created: true, ...(await sessionView(ctx, session)) });
    },
  );

  server.registerTool(
    "update_session",
    {
      title: "Editar sessão",
      description: "Muda título, descrição, data, horário, duração ou modelo de pesquisa de uma sessão ainda não encerrada.",
      inputSchema: {
        session_id: sessionIdSchema,
        title: z.string().trim().min(1).max(200).optional(),
        description: z.string().trim().max(2000).optional(),
        date: dateSchema.optional(),
        time: timeSchema.optional(),
        duration_minutes: z.number().int().min(1).max(1440).optional(),
        survey_template_id: z.uuid().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ session_id, title, description, date, time, duration_minutes, survey_template_id }) => {
      const session = await editableSession(ctx, session_id);
      if (typeof session === "string") return error(session);
      const patch: {
        title?: string;
        description?: string | null;
        scheduled_at?: string;
        estimated_duration_minutes?: number;
        survey_template_id?: string;
      } = {};
      if (title !== undefined) patch.title = title;
      if (description !== undefined) patch.description = description || null;
      if (duration_minutes !== undefined) patch.estimated_duration_minutes = duration_minutes;
      if (date) {
        const { timeZone } = await speakerPrefs(ctx);
        const iso = zonedToUtcIso(date, time ?? "00:00", timeZone);
        if (!iso) return error("Data ou horário inválidos.");
        patch.scheduled_at = iso;
      }
      if (survey_template_id) {
        if (!(await isVisibleTemplate(ctx.supabase, survey_template_id))) return error("Modelo de pesquisa inválido.");
        patch.survey_template_id = survey_template_id;
      }
      if (Object.keys(patch).length === 0) return error("Nada para mudar.");
      const { error: dbError } = await ctx.supabase.from("sessions").update(patch).eq("id", session.id);
      if (dbError) return error("Não foi possível salvar a sessão.");
      const updated = await getOwnedSession(ctx.supabase, session.id);
      return json(updated ? await sessionView(ctx, updated) : { updated: true });
    },
  );

  server.registerTool(
    "add_interactions",
    {
      title: "Adicionar interações",
      description: `Grava de 1 a ${MCP_MAX_BATCH} interações numa sessão, cada uma no ponto da apresentação indicado por after_slide (número da página do PDF depois da qual ela entra). Todas são validadas antes: se uma tiver erro, nenhuma é gravada. Mostre a proposta à pessoa e grave só depois de ela aprovar.`,
      inputSchema: {
        session_id: sessionIdSchema,
        interactions: z.array(mcpInteractionSchema).min(1).max(MCP_MAX_BATCH).describe("Interações na ordem da apresentação."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ session_id, interactions }) => {
      const session = await editableSession(ctx, session_id);
      if (typeof session === "string") return error(session);
      const prefs = await speakerPrefs(ctx);
      const batch = convertBatch(interactions, prefs.translate);
      if (!batch.ok) return error(`${batch.error} Nada foi gravado.`);

      const existing = await getSessionInteractions(ctx.supabase, session.id);
      const created: { id: string; afterSlide: number | null }[] = [];
      for (const item of batch.items) {
        const result = await createInteraction(ctx.supabase, session.id, item.input);
        if (!result.ok) {
          return error(
            `${prefs.translate(result.error)} ${created.length} de ${batch.items.length} interações foram gravadas antes do erro (no fim do roteiro); confira com get_session.`,
          );
        }
        created.push({ id: result.data.id, afterSlide: item.afterSlide });
      }
      const arranged = await saveArrangement(
        ctx.supabase,
        session.id,
        mergeArrangement(
          existing.map((i) => ({ id: i.id, afterSlide: i.after_slide })),
          created,
        ),
      );
      const view = await sessionView(ctx, session);
      return json({
        added: created.length,
        positioned: arranged,
        ...(arranged ? {} : { warning: "As perguntas foram gravadas no fim do roteiro: não foi possível posicioná-las." }),
        next_step:
          session.slide_count > 0
            ? "Pronto: as perguntas já estão entre os slides da sessão."
            : `Abra ${links(session).slides_tab} e envie o mesmo PDF: as perguntas aparecem depois dos slides indicados.`,
        session: view,
      });
    },
  );

  server.registerTool(
    "update_interaction",
    {
      title: "Editar interação",
      description:
        "Substitui o conteúdo de uma interação (mesmos campos de add_interactions). Se já houver respostas, o tipo, as alternativas e a resposta certa não podem mudar; só os textos. after_slide, se informado, também a move.",
      inputSchema: { session_id: sessionIdSchema, interaction_id: interactionIdSchema, ...mcpInteractionShape },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ session_id, interaction_id, ...item }) => {
      const session = await editableSession(ctx, session_id);
      if (typeof session === "string") return error(session);
      const prefs = await speakerPrefs(ctx);
      const converted = toInteractionInput(item, prefs.translate);
      if (!converted.ok) return error(converted.error);

      // Mantém as alternativas existentes (mesmo id) pela posição, preservando imagens e respostas.
      const current = (await getSessionInteractions(ctx.supabase, session.id)).find((i) => i.id === interaction_id);
      if (!current) return error("Interação não encontrada (confira com get_session).");
      const input = converted.input;
      if ("options" in input) {
        const previous = [...current.options].sort((a, b) => a.position - b.position);
        input.options = input.options.map((o, index) => ({
          ...o,
          id: previous[index]?.id,
          imagePath: previous[index]?.image_path ?? null,
        }));
      }
      if (foreignImage(input, session.speaker_id)) return error("Imagem inválida.");
      const saved = await updateInteraction(ctx.supabase, session.id, interaction_id, input);
      if (!saved.ok) return error(prefs.translate(saved.error));

      if (item.after_slide !== undefined) {
        const all = await getSessionInteractions(ctx.supabase, session.id);
        const arrangement = relocate(
          all.map((i) => ({ id: i.id, afterSlide: i.after_slide })),
          interaction_id,
          item.after_slide,
        );
        if (arrangement) await saveArrangement(ctx.supabase, session.id, arrangement);
      }
      return json({ updated: true, session: await sessionView(ctx, session) });
    },
  );

  server.registerTool(
    "move_interaction",
    {
      title: "Mover interação",
      description: "Muda o ponto da apresentação em que a interação entra (after_slide).",
      inputSchema: { session_id: sessionIdSchema, interaction_id: interactionIdSchema, after_slide: afterSlideSchema },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ session_id, interaction_id, after_slide }) => {
      const session = await editableSession(ctx, session_id);
      if (typeof session === "string") return error(session);
      const all = await getSessionInteractions(ctx.supabase, session.id);
      const arrangement = relocate(
        all.map((i) => ({ id: i.id, afterSlide: i.after_slide })),
        interaction_id,
        after_slide,
      );
      if (!arrangement) return error("Interação não encontrada (confira com get_session).");
      if (!(await saveArrangement(ctx.supabase, session.id, arrangement))) return error("Não foi possível mover.");
      return json({ moved: true, session: await sessionView(ctx, session) });
    },
  );

  server.registerTool(
    "delete_interaction",
    {
      title: "Excluir interação",
      description: "Exclui uma interação do roteiro (e as respostas dela, se houver). Confirme com a pessoa antes.",
      inputSchema: { session_id: sessionIdSchema, interaction_id: interactionIdSchema },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ session_id, interaction_id }) => {
      const session = await editableSession(ctx, session_id);
      if (typeof session === "string") return error(session);
      const deleted = await deleteInteraction(ctx.supabase, session.id, interaction_id);
      if (!deleted.ok) return error((await speakerPrefs(ctx)).translate(deleted.error));
      return json({ deleted: true, session: await sessionView(ctx, session) });
    },
  );

  // ---- Prompt -------------------------------------------------------------

  server.registerPrompt(
    "plan_from_slides",
    {
      title: "Planejar interações a partir dos slides",
      description: "Lê a apresentação anexada (PDF) e propõe perguntas no ponto certo de cada slide antes de gravar no PulseStage.",
      argsSchema: {
        audience: z.string().max(200).optional().describe("Quem é a plateia (ex.: alunos do 2º ano, equipe de vendas)."),
        duration: z.string().max(50).optional().describe("Duração da apresentação (ex.: 50 minutos)."),
        goal: z.string().max(300).optional().describe("O que a plateia deve levar da sessão."),
      },
    },
    ({ audience, duration, goal }) => ({
      messages: [{ role: "user", content: { type: "text", text: planPromptText({ audience, duration, goal }) } }],
    }),
  );

  return server;
}
