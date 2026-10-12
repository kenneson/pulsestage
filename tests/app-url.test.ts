import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAppUrl } from "../src/lib/domain/app-url.ts";

test("sem NEXT_PUBLIC_APP_URL, usa o domínio de produção da Vercel", () => {
  assert.equal(resolveAppUrl({ productionHost: "pulsestage.vercel.app" }), "https://pulsestage.vercel.app");
  assert.equal(resolveAppUrl({}), "http://localhost:3000");
});

test("endereço de um deploy ou branch da Vercel vira o domínio de produção (público)", () => {
  const productionHost = "pulsestage.vercel.app";
  assert.equal(
    resolveAppUrl({ explicit: "https://pulsestage-abc123-kennesons-projects.vercel.app/", productionHost }),
    "https://pulsestage.vercel.app",
  );
  assert.equal(
    resolveAppUrl({ explicit: "https://pulsestage-git-main-kennesons-projects.vercel.app", productionHost }),
    "https://pulsestage.vercel.app",
  );
});

test("domínio próprio e o próprio domínio de produção são respeitados", () => {
  assert.equal(
    resolveAppUrl({ explicit: "https://pulsestage.com.br/", productionHost: "pulsestage.vercel.app" }),
    "https://pulsestage.com.br",
  );
  assert.equal(
    resolveAppUrl({ explicit: "https://PulseStage.vercel.app", productionHost: "pulsestage.vercel.app" }),
    "https://PulseStage.vercel.app",
  );
});

test("sem https:// no valor, completa (senão o QR vira texto de busca)", () => {
  assert.equal(resolveAppUrl({ explicit: "pulsestage.com.br" }), "https://pulsestage.com.br");
  assert.equal(resolveAppUrl({ explicit: "http://localhost:3000/" }), "http://localhost:3000");
});

test("fora da Vercel (sem domínio de produção), mantém o valor configurado", () => {
  assert.equal(
    resolveAppUrl({ explicit: "https://pulsestage-abc123.vercel.app" }),
    "https://pulsestage-abc123.vercel.app",
  );
});
