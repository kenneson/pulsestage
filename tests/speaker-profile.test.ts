import { test } from "node:test";
import assert from "node:assert/strict";
import {
  audienceRange,
  contactRequestSchema,
  filterDirectory,
  normalizeUrl,
  parseTopics,
  profileStats,
  publicProfileSchema,
  publicSessions,
  sessionRating,
  slugify,
  slugSchema,
  topTopics,
  verifySession,
  type DirectoryEntry,
  type SessionFacts,
} from "../src/lib/domain/speaker-profile.ts";

function facts(over: Partial<SessionFacts> = {}): SessionFacts {
  return {
    sessionId: "s1",
    speakerId: "u1",
    title: "Palestra",
    startedAt: "2026-05-10T19:00:00.000Z",
    endedAt: "2026-05-10T20:00:00.000Z",
    talkSeconds: 3600,
    participants: 40,
    responders: 30,
    surveyResponses: 12,
    ratingSum: 108,
    ratingCount: 12,
    publicListed: true,
    ...over,
  };
}

test("verifySession exige 5 pessoas respondendo e 10 minutos de palestra", () => {
  assert.deepEqual(verifySession({ responders: 5, talkSeconds: 600 }), { verified: true });
  const few = verifySession({ responders: 4, talkSeconds: 3600 });
  assert.equal(few.verified, false);
  assert.match(few.verified ? "" : few.reason, /5 pessoas.*teve 4/);
  const short = verifySession({ responders: 50, talkSeconds: 599 });
  assert.match(short.verified ? "" : short.reason, /10 minutos.*teve 9/);
});

test("audienceRange mostra faixas, não o número exato", () => {
  assert.equal(audienceRange(5), "até 20 pessoas");
  assert.equal(audienceRange(20), "até 20 pessoas");
  assert.equal(audienceRange(21), "21 a 50 pessoas");
  assert.equal(audienceRange(100), "51 a 100 pessoas");
  assert.equal(audienceRange(300), "101 a 300 pessoas");
  assert.equal(audienceRange(301), "mais de 300 pessoas");
});

test("sessionRating só com respostas suficientes", () => {
  assert.equal(sessionRating({ surveyResponses: 4, ratingSum: 40, ratingCount: 4 }), null);
  assert.equal(sessionRating({ surveyResponses: 5, ratingSum: 0, ratingCount: 0 }), null);
  assert.equal(sessionRating({ surveyResponses: 5, ratingSum: 43, ratingCount: 5 }), 8.6);
});

test("profileStats soma só sessões verificadas e respeita a opção de ocultar notas", () => {
  const list = [
    facts({ sessionId: "a", participants: 40, startedAt: "2026-03-01T10:00:00.000Z" }),
    facts({ sessionId: "b", participants: 100, surveyResponses: 0, ratingSum: 0, ratingCount: 0, startedAt: "2026-04-01T10:00:00.000Z" }),
    facts({ sessionId: "c", participants: 999, responders: 2, startedAt: "2025-01-01T10:00:00.000Z" }),
  ];
  const stats = profileStats(list, true);
  assert.equal(stats.verifiedSessions, 2);
  assert.equal(stats.peopleReached, 140);
  assert.equal(stats.rating, 9);
  assert.equal(stats.ratingResponses, 12);
  assert.equal(stats.since, "2026-03-01T10:00:00.000Z");
  assert.equal(profileStats(list, false).rating, null);
  assert.equal(profileStats([facts({ surveyResponses: 9, ratingCount: 9, ratingSum: 90 })], true).rating, null);
});

test("publicSessions lista só as verificadas e marcadas, mais recentes primeiro", () => {
  const list = publicSessions(
    [
      facts({ sessionId: "old", endedAt: "2026-01-01T00:00:00.000Z" }),
      facts({ sessionId: "hidden", publicListed: false }),
      facts({ sessionId: "unverified", responders: 1 }),
      facts({ sessionId: "new", endedAt: "2026-06-01T00:00:00.000Z" }),
    ],
    true,
  );
  assert.deepEqual(list.map((s) => s.id), ["new", "old"]);
  assert.equal(list[0].rating, 9);
  assert.equal(publicSessions([facts()], false)[0].rating, null);
});

test("slugify e slugSchema", () => {
  assert.equal(slugify("  João da Silva Ávila "), "joao-da-silva-avila");
  assert.equal(slugify("Ana"), "ana");
  assert.equal(slugify("Jo"), "");
  assert.equal(slugify("!!!"), "");
  assert.equal(slugify("a".repeat(60)).length, 40);
  assert.equal(slugSchema.parse(" Maria-Souza "), "maria-souza");
  assert.equal(slugSchema.safeParse("-maria").success, false);
  assert.equal(slugSchema.safeParse("maria--souza").success, false);
  assert.equal(slugSchema.safeParse("admin").success, false);
  assert.equal(slugSchema.safeParse("ma").success, false);
});

test("parseTopics separa, limpa e tira repetidos sem olhar acentos", () => {
  assert.deepEqual(parseTopics("Inteligência Artificial, inteligencia artificial;\n  Liderança  ,,Educação"), [
    "Inteligência Artificial",
    "Liderança",
    "Educação",
  ]);
});

test("normalizeUrl completa https e recusa outros protocolos", () => {
  assert.equal(normalizeUrl("meusite.com.br"), "https://meusite.com.br/");
  assert.equal(normalizeUrl("http://a.com/x"), "http://a.com/x");
  assert.equal(normalizeUrl("javascript:alert(1)"), null);
  assert.equal(normalizeUrl("localhost"), null);
  assert.equal(normalizeUrl(""), null);
});

test("publicProfileSchema valida o LinkedIn e limita os temas", () => {
  const base = {
    publicEnabled: true,
    slug: "ana-lima",
    formats: ["online"],
    audiences: ["escolas"],
    contactEnabled: true,
    showRatings: true,
    promoteOnSurvey: false,
  };
  const ok = publicProfileSchema.parse({ ...base, topics: "IA, Educação", linkedinUrl: "linkedin.com/in/ana", state: "sp" });
  assert.deepEqual(ok.topics, ["IA", "Educação"]);
  assert.equal(ok.linkedinUrl, "https://linkedin.com/in/ana");
  assert.equal(ok.state, "SP");
  assert.equal(ok.websiteUrl, null);
  assert.equal(publicProfileSchema.safeParse({ ...base, linkedinUrl: "https://evil.com/linkedin.com" }).success, false);
  assert.equal(publicProfileSchema.safeParse({ ...base, state: "XX" }).success, false);
  assert.equal(publicProfileSchema.safeParse({ ...base, topics: Array.from({ length: 11 }, (_, i) => `t${i}`).join(",") }).success, false);
  assert.equal(publicProfileSchema.safeParse({ ...base, formats: ["hibrido"] }).success, false);
});

test("contactRequestSchema", () => {
  const parsed = contactRequestSchema.parse({ name: "Carla", email: " Carla@Escola.org ", message: "Gostaria de um convite." });
  assert.equal(parsed.email, "carla@escola.org");
  assert.equal(contactRequestSchema.safeParse({ name: "Carla", email: "x", message: "Gostaria de um convite." }).success, false);
  assert.equal(contactRequestSchema.safeParse({ name: "Carla", email: "c@a.com", message: "oi" }).success, false);
  assert.equal(
    contactRequestSchema.safeParse({ name: "Carla", email: "c@a.com", message: "Convite para a semana", eventDate: "2026-13-01" }).success,
    false,
  );
});

function entry(over: Partial<DirectoryEntry> & { verified?: number } = {}): DirectoryEntry {
  const { verified = 1, ...rest } = over;
  return {
    slug: "x",
    name: "X",
    avatarUrl: null,
    headline: null,
    topics: [],
    city: null,
    state: null,
    formats: [],
    audiences: [],
    stats: { verifiedSessions: verified, peopleReached: 10, rating: null, ratingResponses: 0, since: null },
    ...rest,
  };
}

test("filterDirectory: só verificados, filtros combinados e ordem por sessões", () => {
  const list = [
    entry({ slug: "a", name: "Ana", topics: ["Inteligência Artificial"], state: "SP", formats: ["online"], verified: 2 }),
    entry({ slug: "b", name: "Bruno", topics: ["Liderança"], state: "RJ", audiences: ["empresas"], verified: 5 }),
    entry({ slug: "c", name: "Carla", topics: ["inteligencia artificial"], state: "SP", verified: 0 }),
  ];
  assert.deepEqual(filterDirectory(list, {}).map((e) => e.slug), ["b", "a"]);
  assert.deepEqual(filterDirectory(list, { tema: "inteligencia-artificial" }).map((e) => e.slug), ["a"]);
  assert.deepEqual(filterDirectory(list, { uf: "sp" }).map((e) => e.slug), ["a"]);
  assert.deepEqual(filterDirectory(list, { formato: "online" }).map((e) => e.slug), ["a"]);
  assert.deepEqual(filterDirectory(list, { publico: "empresas" }).map((e) => e.slug), ["b"]);
  assert.deepEqual(filterDirectory(list, { q: "inteligência" }).map((e) => e.slug), ["a"]);
  assert.deepEqual(filterDirectory(list, { q: "bruno lideranca" }).map((e) => e.slug), ["b"]);
});

test("topTopics agrupa grafias e ignora perfis fora do diretório", () => {
  const list = [
    entry({ topics: ["IA", "Liderança"] }),
    entry({ topics: ["ia"] }),
    entry({ topics: ["IA"] }),
    entry({ topics: ["Escondido"], verified: 0 }),
  ];
  assert.deepEqual(topTopics(list), [
    { key: "ia", label: "IA", count: 3 },
    { key: "lideranca", label: "Liderança", count: 1 },
  ]);
});

test("parseDirectoryParams ignora valores inválidos", async () => {
  const { parseDirectoryParams } = await import("../src/lib/domain/speaker-profile.ts");
  assert.deepEqual(parseDirectoryParams({ q: " ia ", uf: "sp", formato: "online", publico: "x", pagina: "2" }), {
    q: "ia",
    tema: undefined,
    uf: "SP",
    formato: "online",
    publico: undefined,
    pagina: 2,
  });
  assert.equal(parseDirectoryParams({ uf: "XX", pagina: "-1", q: ["a", "b"] }).uf, undefined);
  assert.equal(parseDirectoryParams({ pagina: "abc" }).pagina, 1);
  assert.equal(parseDirectoryParams({ q: ["abc", "d"] }).q, "abc");
});
