import { test } from "node:test";
import assert from "node:assert/strict";
import { oauthReturnTarget } from "../src/lib/domain/oauth-return.ts";

const params = (query: string) => new URLSearchParams(query);

test("código na página inicial segue para a troca em /auth/callback", () => {
  assert.equal(oauthReturnTarget("/", params("code=abc-123")), "/auth/callback?code=abc-123&next=%2Fdashboard");
  assert.equal(oauthReturnTarget("/es", params("code=x")), "/auth/callback?code=x&next=%2Fdashboard");
});

test("erro do provedor na página inicial volta ao login com aviso", () => {
  assert.equal(oauthReturnTarget("/", params("error=access_denied&error_description=cancelado")), "/login?error=google");
});

test("fora da página inicial ou sem código, nada muda", () => {
  assert.equal(oauthReturnTarget("/join/ABC", params("code=x")), null);
  assert.equal(oauthReturnTarget("/", params("")), null);
  assert.equal(oauthReturnTarget("/", params("error=x")), null);
});
