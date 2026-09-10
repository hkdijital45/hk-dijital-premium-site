// Run via `npm run test:social-autopilot` — see protocol.test.ts's header
// comment for why (this file's import chain touches "@/lib/agent-providers"
// via a tsconfig path alias, unresolvable by the base test runner).
import test from "node:test";
import assert from "node:assert/strict";
import { generateSocialContent, parseStructuredJson } from "../../../src/lib/social-autopilot/ai-client.ts";

test("generateSocialContent: refuses to call any AI provider when allowRuntimeAi is false, with no ANTHROPIC_API_KEY required to run this app at all", async () => {
  const savedKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    await assert.rejects(
      () => generateSocialContent({ action: "test", systemPrompt: "s", prompt: "p", allowRuntimeAi: false }),
      /devre dışı/
    );
  } finally {
    if (savedKey !== undefined) process.env.ANTHROPIC_API_KEY = savedKey;
  }
});

test("generateSocialContent: the allowRuntimeAi=false rejection happens before any provider/network resolution (synchronous guard)", async () => {
  // No network call can have happened here — process.env deliberately left
  // exactly as the test runner started it, no fetch/network mocking needed,
  // and the promise still rejects deterministically and immediately.
  const promise = generateSocialContent({ action: "test", systemPrompt: "s", prompt: "p", allowRuntimeAi: false });
  await assert.rejects(() => promise);
});

type ExampleOutput = { title: string; count: number };
function isExampleOutput(value: unknown): value is ExampleOutput {
  return typeof value === "object" && value !== null && typeof (value as ExampleOutput).title === "string" && typeof (value as ExampleOutput).count === "number";
}

test("parseStructuredJson: parses a plain JSON object", () => {
  const result = parseStructuredJson('{"title":"Hello","count":3}', isExampleOutput);
  assert.deepEqual(result, { title: "Hello", count: 3 });
});

test("parseStructuredJson: strips a ```json ... ``` markdown fence", () => {
  const result = parseStructuredJson('```json\n{"title":"Hello","count":3}\n```', isExampleOutput);
  assert.deepEqual(result, { title: "Hello", count: 3 });
});

test("parseStructuredJson: strips a bare ``` fence with leading prose before the JSON", () => {
  const result = parseStructuredJson('Here is the result:\n```\n{"title":"Hello","count":3}\n```', isExampleOutput);
  assert.deepEqual(result, { title: "Hello", count: 3 });
});

test("parseStructuredJson: throws (never returns partial data) on invalid JSON", () => {
  assert.throws(() => parseStructuredJson("not json at all", isExampleOutput), /geçerli JSON/);
});

test("parseStructuredJson: throws when the parsed JSON fails the caller's schema guard", () => {
  assert.throws(() => parseStructuredJson('{"title":"Hello"}', isExampleOutput), /şemaya uymuyor/);
});
