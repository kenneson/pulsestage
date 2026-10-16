import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isLocale,
  isLocalizablePath,
  localeOrDefault,
  localizedPath,
  matchAcceptLanguage,
  splitLocalePrefix,
  toLocale,
} from "../src/lib/domain/locale.ts";
import { normalizeTerm } from "../src/lib/domain/words.ts";
import { messageKey, parseMessageKey } from "../src/lib/domain/message-key.ts";

test("toLocale junta variantes regionais", () => {
  assert.equal(toLocale("es-CO"), "es-419");
  assert.equal(toLocale("es_CL"), "es-419");
  assert.equal(toLocale("es"), "es-419");
  assert.equal(toLocale("en-GB"), "en-US");
  assert.equal(toLocale("pt-PT"), "pt-BR");
  assert.equal(toLocale("en-US"), "en-US");
  assert.equal(toLocale("fr-FR"), null);
  assert.equal(toLocale(null), null);
});

test("matchAcceptLanguage respeita os pesos e pula idiomas sem suporte", () => {
  assert.equal(matchAcceptLanguage("es-CL,es;q=0.9,en;q=0.8"), "es-419");
  assert.equal(matchAcceptLanguage("fr-FR,fr;q=0.9,en-US;q=0.8,pt;q=0.7"), "en-US");
  assert.equal(matchAcceptLanguage("en;q=0.5, pt-BR"), "pt-BR");
  assert.equal(matchAcceptLanguage("de"), null);
  assert.equal(matchAcceptLanguage(""), null);
});

test("prefixos de idioma nas URLs públicas", () => {
  assert.deepEqual(splitLocalePrefix("/es"), { locale: "es-419", path: "/" });
  assert.deepEqual(splitLocalePrefix("/en/palestrantes"), { locale: "en-US", path: "/palestrantes" });
  assert.deepEqual(splitLocalePrefix("/estatisticas"), { locale: null, path: "/estatisticas" });
  assert.equal(localizedPath("es-419", "/"), "/es");
  assert.equal(localizedPath("en-US", "/p/ana"), "/en/p/ana");
  assert.equal(localizedPath("pt-BR", "/privacidade"), "/privacidade");
  assert.equal(isLocalizablePath("/palestrantes/tema/ia"), true);
  assert.equal(isLocalizablePath("/dashboard"), false);
  assert.equal(isLocalizablePath("/pesquisa"), false);
});

test("nuvem de palavras usa as palavras vazias do idioma", () => {
  assert.equal(normalizeTerm("la productividad", "es-419"), "productividad");
  assert.equal(normalizeTerm("the future", "en-US"), "future");
  assert.equal(normalizeTerm("Inteligencia Artificial", "es-419"), "inteligencia artificial");
  assert.equal(normalizeTerm("de que", "es-419"), null);
});

test("messageKey leva parâmetros e parseMessageKey devolve", () => {
  const msg = messageKey("validation.invalidAnswerIn", { label: "Nota | geral = 10?" });
  assert.deepEqual(parseMessageKey(msg), { key: "validation.invalidAnswerIn", params: { label: "Nota | geral = 10?" } });
  assert.deepEqual(parseMessageKey("validation.questionRequired"), { key: "validation.questionRequired", params: {} });
  assert.equal(parseMessageKey("Texto qualquer."), null);
  assert.equal(parseMessageKey("Invalid input"), null);
});

test("isLocale aceita só os códigos exatos", () => {
  assert.ok(isLocale("pt-BR"));
  assert.ok(isLocale("es-419"));
  assert.ok(isLocale("en-US"));
  assert.ok(!isLocale("pt"));
  assert.ok(!isLocale("en-us"));
  assert.ok(!isLocale(null));
  assert.ok(!isLocale(42));
});

test("localeOrDefault normaliza e cai no português", () => {
  assert.equal(localeOrDefault("es-CO"), "es-419");
  assert.equal(localeOrDefault("en"), "en-US");
  assert.equal(localeOrDefault("fr-FR"), "pt-BR");
  assert.equal(localeOrDefault(""), "pt-BR");
  assert.equal(localeOrDefault(null), "pt-BR");
  assert.equal(localeOrDefault(undefined), "pt-BR");
});
