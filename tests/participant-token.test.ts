import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { signParticipantToken, verifyParticipantToken } from "../src/lib/participant/token-core.ts";

const SECRET = "s".repeat(32);
const SESSION = "11111111-2222-4333-8444-555555555555";
const OTHER_SESSION = "66666666-7777-4888-8999-aaaaaaaaaaaa";
const PARTICIPANT = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

test("token assinado devolve o participante da sessão", () => {
  const token = signParticipantToken(SECRET, SESSION, PARTICIPANT);
  assert.equal(verifyParticipantToken(SECRET, SESSION, token), PARTICIPANT);
});

test("token de outra sessão não vale", () => {
  const token = signParticipantToken(SECRET, OTHER_SESSION, PARTICIPANT);
  assert.equal(verifyParticipantToken(SECRET, SESSION, token), null);
});

test("token adulterado não vale", () => {
  const token = signParticipantToken(SECRET, SESSION, PARTICIPANT);
  const [data = "", signature = ""] = token.split(".");
  // Troca o participante mantendo a assinatura antiga.
  const forged = Buffer.from(JSON.stringify({ p: "outro", s: SESSION, iat: 0 })).toString("base64url");
  assert.equal(verifyParticipantToken(SECRET, SESSION, `${forged}.${signature}`), null);
  // Assinatura alterada (mesmo tamanho).
  const flipped = (signature[0] === "A" ? "B" : "A") + signature.slice(1);
  assert.equal(verifyParticipantToken(SECRET, SESSION, `${data}.${flipped}`), null);
  // Assinatura de outro tamanho, sem assinatura e lixo.
  assert.equal(verifyParticipantToken(SECRET, SESSION, `${data}.${signature}x`), null);
  assert.equal(verifyParticipantToken(SECRET, SESSION, data), null);
  assert.equal(verifyParticipantToken(SECRET, SESSION, ""), null);
});

test("segredo errado não vale", () => {
  const token = signParticipantToken(SECRET, SESSION, PARTICIPANT);
  assert.equal(verifyParticipantToken("x".repeat(32), SESSION, token), null);
});

test("payload assinado mas fora do formato não vale", () => {
  const data = Buffer.from(JSON.stringify({ p: PARTICIPANT })).toString("base64url");
  const signature = createHmac("sha256", SECRET).update(data).digest("base64url");
  assert.equal(verifyParticipantToken(SECRET, SESSION, `${data}.${signature}`), null);
});

test("o formato do token não mudou (cookies já emitidos continuam válidos)", () => {
  const token = signParticipantToken(SECRET, SESSION, PARTICIPANT, 1_700_000_000_000);
  const [data = ""] = token.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(data, "base64url").toString("utf8")), {
    p: PARTICIPANT,
    s: SESSION,
    iat: 1_700_000_000_000,
  });
});
