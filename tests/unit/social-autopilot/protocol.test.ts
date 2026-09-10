// Run via `npm run test:social-autopilot` (node --conditions=react-server
// --import tsx --test), NOT the base `npm test`/`test:unit`/`test:security`
// scripts — this file's import chain touches src/lib/secure-compare.ts via
// the "@/lib/..." tsconfig path alias, which plain
// `node --experimental-strip-types` (the base test runner) cannot resolve.
// Kept in its own tests/unit/social-autopilot/ subdirectory so the base
// scripts' flat `tests/unit/*.test.ts` glob never picks it up.
import test from "node:test";
import assert from "node:assert/strict";
import { tools, sanitize, validateArguments, ControlError, type Tool } from "../../../src/lib/social-autopilot/control/protocol.ts";

test("tool catalogue: preserves the real 37-tool count (no padding, no trimming)", () => {
  assert.equal(tools.length, 37);
});

test("tool catalogue: every tool name is unique", () => {
  const names = tools.map((tool) => tool.name);
  assert.equal(new Set(names).size, names.length);
});

test("tool catalogue: permission tiers are exactly READ_ONLY, WRITE_SAFE or WRITE_PUBLISH", () => {
  for (const tool of tools) assert.ok(["READ_ONLY", "WRITE_SAFE", "WRITE_PUBLISH"].includes(tool.permission), `${tool.name} has an invalid permission`);
});

test("tool catalogue: publish/resume/daily-cycle tools are gated WRITE_PUBLISH", () => {
  const publishTier = new Set(["instagram_publish_now", "autopilot_resume", "autopilot_run_daily_cycle"]);
  for (const name of publishTier) {
    const tool = tools.find((t) => t.name === name);
    assert.ok(tool, `${name} missing from catalogue`);
    assert.equal(tool!.permission, "WRITE_PUBLISH");
  }
});

test("tool catalogue: read-only analytics/status tools never carry write permission", () => {
  const readOnlyTier = ["instagram_get_profile", "autopilot_get_status", "autopilot_get_readiness", "content_get_today", "instagram_get_publish_queue"];
  for (const name of readOnlyTier) {
    const tool = tools.find((t) => t.name === name);
    assert.equal(tool!.permission, "READ_ONLY");
  }
});

test("tool catalogue: no tool exposes a generic SQL/shell/filesystem/arbitrary-HTTP-proxy surface", () => {
  const dangerousNamePattern = /sql|shell|exec_command|run_command|filesystem|read_file|write_file|http_request|fetch_url|proxy/i;
  for (const tool of tools) assert.ok(!dangerousNamePattern.test(tool.name), `${tool.name} looks like a generic/dangerous passthrough tool`);
});

test("tool catalogue: content-creation tools take a bounded structured object, not arbitrary code/strings", () => {
  for (const name of ["content_generate_carousel", "content_generate_static", "content_prepare_reel", "strategy_import"]) {
    const tool = tools.find((t) => t.name === name)!;
    const schemaKeys = Object.keys(tool.inputSchema.properties);
    assert.ok(schemaKeys.every((key) => tool.inputSchema.properties[key].type === "object"), `${name} should only accept structured object input`);
  }
});

test("validateArguments: rejects an unknown argument", () => {
  const tool: Tool = tools.find((t) => t.name === "content_preview")!;
  assert.throws(() => validateArguments(tool, { id: "11111111-1111-1111-1111-111111111111", unexpected: "value" }), ControlError);
});

test("validateArguments: rejects a missing required argument", () => {
  const tool: Tool = tools.find((t) => t.name === "content_preview")!;
  assert.throws(() => validateArguments(tool, {}), ControlError);
});

test("validateArguments: rejects a malformed uuid", () => {
  const tool: Tool = tools.find((t) => t.name === "content_preview")!;
  assert.throws(() => validateArguments(tool, { id: "not-a-uuid" }), ControlError);
});

test("validateArguments: accepts a well-formed argument set", () => {
  const tool: Tool = tools.find((t) => t.name === "content_preview")!;
  assert.doesNotThrow(() => validateArguments(tool, { id: "11111111-1111-1111-1111-111111111111" }));
});

test("validateArguments: rejects a non-object arguments payload", () => {
  const tool: Tool = tools.find((t) => t.name === "autopilot_get_status")!;
  assert.throws(() => validateArguments(tool, "not-an-object" as unknown as Record<string, unknown>), ControlError);
});

test("sanitize: redacts a configured secret value found anywhere in output text", () => {
  const env = { SOME_API_SECRET: "sk-super-secret-value-123" };
  const result = sanitize({ message: "token was sk-super-secret-value-123 during the call" }, env) as { message: string };
  assert.ok(!result.message.includes("sk-super-secret-value-123"));
  assert.ok(result.message.includes("[REDACTED]"));
});

test("sanitize: redacts Bearer tokens and access_token query params even without a matching env var", () => {
  const result = sanitize({ note: "Authorization: Bearer abc.def.ghi and url?access_token=xyz123" }, {}) as { note: string };
  assert.ok(!result.note.includes("abc.def.ghi"));
  assert.ok(!result.note.includes("xyz123"));
});

test("sanitize: strips known credential-shaped object keys entirely", () => {
  const result = sanitize({ access_token_encrypted: "shhh", password: "shhh", ig_user_id: "123", username: "hkdijital" }, {}) as Record<string, unknown>;
  assert.ok(!("access_token_encrypted" in result));
  assert.ok(!("password" in result));
  assert.equal(result.username, "hkdijital");
});

test("ControlError: carries a stable code and HTTP-style status", () => {
  const error = new ControlError("NOT_READY", "Content not ready.", 409);
  assert.equal(error.code, "NOT_READY");
  assert.equal(error.status, 409);
  assert.equal(error.message, "Content not ready.");
});
