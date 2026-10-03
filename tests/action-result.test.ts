import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "../src/lib/action-result.ts";

test("safeNextPath aceita só caminhos internos", () => {
  assert.equal(safeNextPath("/dashboard/sessions"), "/dashboard/sessions");
  assert.equal(safeNextPath("https://evil.com"), "/dashboard");
  assert.equal(safeNextPath("//evil.com"), "/dashboard");
  assert.equal(safeNextPath("/\\evil.com"), "/dashboard"); // navegadores leem como //evil.com
  assert.equal(safeNextPath(undefined), "/dashboard");
});
