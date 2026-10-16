// Perfil público do palestrante ("portfólio verificado") e diretório. Regras puras (sem I/O).
// Os números verificados saem só de sessões que passaram pelo PulseStage e cumprem o critério abaixo;
// o que o speaker declara (experiência anterior, links) aparece separado e rotulado como declarado.

import { z } from "zod";
import { messageKey } from "./message-key.ts";

// ---------------------------------------------------------------------------
// Critério de verificação
// ---------------------------------------------------------------------------

/** Pessoas diferentes que responderam alguma interação. */
export const VERIFY_MIN_RESPONDERS = 5;
/** Tempo de palestra (sem pausas). */
export const VERIFY_MIN_TALK_SECONDS = 10 * 60;
/** Respostas de pesquisa para mostrar a nota de uma sessão. */
export const RATING_MIN_SESSION = 5;
/** Respostas de pesquisa (somando as sessões verificadas) para mostrar a nota do perfil. */
export const RATING_MIN_PROFILE = 10;
/** Sessões verificadas para entrar no diretório. */
export const DIRECTORY_MIN_VERIFIED = 1;

/** Fatos de uma sessão encerrada, como chegam de speaker_session_facts(). */
export type SessionFacts = {
  sessionId: string;
  speakerId: string;
  title: string;
  startedAt: string;
  endedAt: string;
  talkSeconds: number;
  participants: number;
  responders: number;
  surveyResponses: number;
  ratingSum: number;
  ratingCount: number;
  publicListed: boolean;
};

export function toSessionFacts(row: {
  session_id: string;
  speaker_id: string;
  title: string;
  started_at: string;
  ended_at: string;
  talk_seconds: number;
  participants: number;
  responders: number;
  survey_responses: number;
  rating_sum: number;
  rating_count: number;
  public_listed: boolean;
}): SessionFacts {
  return {
    sessionId: row.session_id,
    speakerId: row.speaker_id,
    title: row.title,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    talkSeconds: Number(row.talk_seconds),
    participants: Number(row.participants),
    responders: Number(row.responders),
    surveyResponses: Number(row.survey_responses),
    ratingSum: Number(row.rating_sum),
    ratingCount: Number(row.rating_count),
    publicListed: row.public_listed,
  };
}

export type Verification = { verified: true } | { verified: false; reason: string };

export function verifySession(f: Pick<SessionFacts, "responders" | "talkSeconds">): Verification {
  if (f.responders < VERIFY_MIN_RESPONDERS) {
    return {
      verified: false,
      reason: messageKey("verify.needResponders", { min: VERIFY_MIN_RESPONDERS, had: f.responders }),
    };
  }
  if (f.talkSeconds < VERIFY_MIN_TALK_SECONDS) {
    return {
      verified: false,
      reason: messageKey("verify.needTalkTime", { min: VERIFY_MIN_TALK_SECONDS / 60, had: Math.floor(f.talkSeconds / 60) }),
    };
  }
  return { verified: true };
}

export function isVerified(f: Pick<SessionFacts, "responders" | "talkSeconds">): boolean {
  return verifySession(f).verified;
}

/** Faixa de público: o perfil mostra a faixa, não o número exato de cada sessão. */
export function audienceRange(participants: number): string {
  if (participants <= 20) return "até 20 pessoas";
  if (participants <= 50) return "21 a 50 pessoas";
  if (participants <= 100) return "51 a 100 pessoas";
  if (participants <= 300) return "101 a 300 pessoas";
  return "mais de 300 pessoas";
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Nota 0–10 da sessão (perguntas de utilidade, satisfação e recomendação), com respostas suficientes. */
export function sessionRating(f: Pick<SessionFacts, "surveyResponses" | "ratingSum" | "ratingCount">): number | null {
  if (f.surveyResponses < RATING_MIN_SESSION || f.ratingCount === 0) return null;
  return round1(f.ratingSum / f.ratingCount);
}

export type ProfileStats = {
  verifiedSessions: number;
  /** Participantes somados das sessões verificadas. */
  peopleReached: number;
  /** Nota 0–10 de todas as respostas das sessões verificadas (null sem respostas suficientes ou se o speaker ocultou). */
  rating: number | null;
  ratingResponses: number;
  /** Data da primeira sessão verificada. */
  since: string | null;
};

export function profileStats(facts: readonly SessionFacts[], showRatings: boolean): ProfileStats {
  const verified = facts.filter(isVerified);
  let peopleReached = 0;
  let ratingSum = 0;
  let ratingCount = 0;
  let ratingResponses = 0;
  let since: string | null = null;
  for (const f of verified) {
    peopleReached += f.participants;
    ratingSum += f.ratingSum;
    ratingCount += f.ratingCount;
    if (f.ratingCount > 0) ratingResponses += f.surveyResponses;
    if (since === null || f.startedAt < since) since = f.startedAt;
  }
  const rating =
    showRatings && ratingResponses >= RATING_MIN_PROFILE && ratingCount > 0 ? round1(ratingSum / ratingCount) : null;
  return { verifiedSessions: verified.length, peopleReached, rating, ratingResponses, since };
}

export type PublicSession = {
  id: string;
  title: string;
  date: string;
  audience: string;
  rating: number | null;
};

/** Sessões verificadas que o speaker marcou como públicas, da mais recente para a mais antiga. */
export function publicSessions(facts: readonly SessionFacts[], showRatings: boolean): PublicSession[] {
  return facts
    .filter((f) => f.publicListed && isVerified(f))
    .sort((a, b) => b.endedAt.localeCompare(a.endedAt))
    .map((f) => ({
      id: f.sessionId,
      title: f.title,
      date: f.startedAt,
      audience: audienceRange(f.participants),
      rating: showRatings ? sessionRating(f) : null,
    }));
}

// ---------------------------------------------------------------------------
// Endereço (slug), temas e textos
// ---------------------------------------------------------------------------

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const RESERVED_SLUGS = new Set(["admin", "api", "pulsestage", "suporte", "ajuda", "palestrantes", "dashboard", "login"]);

/** Tira acentos e deixa só letras e números separados por hífen. */
export function toKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Sugestão de endereço a partir do nome ("" quando não sobra o suficiente). */
export function slugify(name: string): string {
  const key = toKey(name).slice(0, 40).replace(/-+$/g, "");
  return SLUG_RE.test(key) ? key : "";
}

export const slugSchema = z
  .string({ error: "validation.slugRequired" })
  .trim()
  .toLowerCase()
  .regex(SLUG_RE, "validation.slugFormat")
  .refine((s) => !s.includes("--"), "validation.slugDoubleHyphen")
  .refine((s) => !RESERVED_SLUGS.has(s), "validation.slugReserved");

export const MAX_TOPICS = 10;
export const TOPIC_MAX_LENGTH = 40;

/** Temas separados por vírgula ou linha; sem repetidos (ignorando acentos e maiúsculas). */
export function parseTopics(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[,\n;]/)) {
    const topic = raw.replace(/\s+/g, " ").trim();
    const key = toKey(topic);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(topic);
  }
  return out;
}

/** Endereço do tema no diretório (/palestrantes/tema/[chave]). */
export const topicKey = toKey;

export const FORMATS = ["presencial", "online"] as const;
export type Format = (typeof FORMATS)[number];

export const AUDIENCES = ["universidades", "escolas", "empresas", "eventos"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const ORG_KINDS = ["universidade", "escola", "empresa", "evento", "outro"] as const;
export type OrgKind = (typeof ORG_KINDS)[number];

export const BR_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export function isState(value: unknown): value is (typeof BR_STATES)[number] {
  return typeof value === "string" && (BR_STATES as readonly string[]).includes(value);
}

/** Completa "https://" e aceita só http(s). Devolve null quando não é um endereço válido. */
export function normalizeUrl(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function urlField(message: string, host?: RegExp) {
  return z
    .string()
    .trim()
    .max(200, "validation.urlTooLong")
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const url = normalizeUrl(v);
      if (!url || (host && !host.test(new URL(url).hostname))) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return url;
    });
}

/** Formulário "Perfil público" do painel. Listas chegam como arrays (checkboxes) e os temas como texto. */
export const publicProfileSchema = z.object({
  publicEnabled: z.boolean(),
  slug: slugSchema,
  headline: z.string().trim().max(120, "validation.headlineTooLong").optional(),
  topics: z
    .string()
    .optional()
    .transform((v) => parseTopics(v ?? ""))
    .refine((list) => list.length <= MAX_TOPICS, messageKey("validation.maxTopics", { max: MAX_TOPICS }))
    .refine((list) => list.every((t) => t.length <= TOPIC_MAX_LENGTH), messageKey("validation.topicTooLong", { max: TOPIC_MAX_LENGTH })),
  city: z.string().trim().max(80, "validation.cityTooLong").optional(),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .refine((v) => v === undefined || isState(v), "validation.invalidState"),
  formats: z.array(z.enum(FORMATS, { error: "validation.invalidFormat" })),
  audiences: z.array(z.enum(AUDIENCES, { error: "validation.invalidAudience" })),
  experience: z.string().trim().max(600, "validation.experienceTooLong").optional(),
  websiteUrl: urlField("validation.invalidWebsite"),
  linkedinUrl: urlField("validation.invalidLinkedin", /(^|\.)linkedin\.com$/i),
  contactEnabled: z.boolean(),
  showRatings: z.boolean(),
  promoteOnSurvey: z.boolean(),
});
export type PublicProfileInput = z.infer<typeof publicProfileSchema>;

// ---------------------------------------------------------------------------
// Pedido de contato ("Convidar para palestrar")
// ---------------------------------------------------------------------------

/** Pedidos por origem (hash do IP) por hora e por palestrante por dia. */
export const CONTACT_LIMIT_PER_HOUR = 3;
export const CONTACT_LIMIT_PER_DAY = 30;

export const contactRequestSchema = z.object({
  name: z.string({ error: "validation.nameRequired" }).trim().min(2, "validation.nameRequired").max(120, "validation.nameTooLong"),
  email: z
    .string({ error: "validation.emailRequired" })
    .trim()
    .toLowerCase()
    .max(254, "validation.emailTooLong")
    .pipe(z.email({ error: "validation.invalidEmail" })),
  organization: z.string().trim().max(160, "validation.organizationTooLong").optional(),
  orgKind: z.enum(ORG_KINDS, { error: "validation.invalidOrgKind" }).optional(),
  message: z
    .string({ error: "validation.messageRequired" })
    .trim()
    .min(10, "validation.messageTooShort")
    .max(2000, "validation.messageMax"),
  eventDate: z.iso.date({ error: "validation.invalidDate" }).optional(),
  eventCity: z.string().trim().max(80, "validation.cityTooLong").optional(),
});
export type ContactRequestInput = z.infer<typeof contactRequestSchema>;

// ---------------------------------------------------------------------------
// Diretório
// ---------------------------------------------------------------------------

export type DirectoryEntry = {
  slug: string;
  name: string;
  avatarUrl: string | null;
  headline: string | null;
  topics: string[];
  city: string | null;
  state: string | null;
  formats: Format[];
  audiences: Audience[];
  stats: ProfileStats;
};

export type DirectoryFilters = {
  q?: string;
  tema?: string;
  uf?: string;
  formato?: string;
  publico?: string;
};

export const DIRECTORY_PAGE_SIZE = 24;

export function inDirectory(stats: Pick<ProfileStats, "verifiedSessions">): boolean {
  return stats.verifiedSessions >= DIRECTORY_MIN_VERIFIED;
}

/** Filtra e ordena: mais sessões verificadas primeiro, depois mais pessoas alcançadas, depois nome. */
export function filterDirectory(entries: readonly DirectoryEntry[], filters: DirectoryFilters): DirectoryEntry[] {
  const q = filters.q ? toKey(filters.q) : "";
  const tema = filters.tema ? toKey(filters.tema) : "";
  const uf = filters.uf?.toUpperCase();
  return entries
    .filter((e) => inDirectory(e.stats))
    .filter((e) => !tema || e.topics.some((t) => toKey(t) === tema))
    .filter((e) => !uf || e.state === uf)
    .filter((e) => !filters.formato || e.formats.includes(filters.formato as Format))
    .filter((e) => !filters.publico || e.audiences.includes(filters.publico as Audience))
    .filter((e) => {
      if (!q) return true;
      const haystack = toKey([e.name, e.headline ?? "", e.city ?? "", ...e.topics].join(" "));
      return q.split("-").every((word) => haystack.includes(word));
    })
    .sort(
      (a, b) =>
        b.stats.verifiedSessions - a.stats.verifiedSessions ||
        b.stats.peopleReached - a.stats.peopleReached ||
        a.name.localeCompare(b.name, "pt-BR"),
    );
}

/** Temas mais comuns do diretório (para links de tema), com a grafia mais usada. */
export function topTopics(entries: readonly DirectoryEntry[], limit = 20): { key: string; label: string; count: number }[] {
  const byKey = new Map<string, { labels: Map<string, number>; count: number }>();
  for (const e of entries) {
    if (!inDirectory(e.stats)) continue;
    for (const t of e.topics) {
      const key = toKey(t);
      if (!key) continue;
      const item = byKey.get(key) ?? { labels: new Map(), count: 0 };
      item.count += 1;
      item.labels.set(t, (item.labels.get(t) ?? 0) + 1);
      byKey.set(key, item);
    }
  }
  return [...byKey.entries()]
    .map(([key, item]) => ({
      key,
      label: [...item.labels.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? key,
      count: item.count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"))
    .slice(0, limit);
}

const optionalParam = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (Array.isArray(v) ? v[0] : v), schema.optional().catch(undefined));

/** Filtros do diretório vindos da URL: valores inválidos são ignorados (não dão erro). */
const directoryParamsSchema = z.object({
  q: optionalParam(z.string().trim().min(1).max(80)),
  tema: optionalParam(z.string().trim().min(1).max(60)),
  uf: optionalParam(z.string().trim().toUpperCase().refine(isState)),
  formato: optionalParam(z.enum(FORMATS)),
  publico: optionalParam(z.enum(AUDIENCES)),
  pagina: optionalParam(z.coerce.number().int().min(1).max(1000)),
});

export function parseDirectoryParams(
  raw: Record<string, string | string[] | undefined>,
): DirectoryFilters & { pagina: number } {
  const parsed = directoryParamsSchema.parse(raw);
  return { q: parsed.q, tema: parsed.tema, uf: parsed.uf, formato: parsed.formato, publico: parsed.publico, pagina: parsed.pagina ?? 1 };
}
