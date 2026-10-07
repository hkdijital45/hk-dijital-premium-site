import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Organic Growth Center must make ZERO AI-provider calls anywhere in its
// own execution path (handoff generation, article import, SEO/GEO
// validation, cannibalization, the Organic Growth cron) — Claude Project
// (the user's own interactive workspace) is the writer, never a
// server-side API call. This is a static source scan, not a mock: it
// fails loudly if anyone reintroduces runRealAgentProvider/an AI SDK
// import into these specific files, which is exactly the regression this
// guards against (a previous commit did exactly this, then was reverted).
const FORBIDDEN_PATTERNS = [/runRealAgentProvider/, /from "@\/lib\/agent-providers"/, /from "@\/lib\/gemini-client/, /from "@\/lib\/openai-client/, /api\.anthropic\.com/];

const ORGANIC_GROWTH_PATHS = [
  "src/lib/organic-growth",
  "src/app/api/admin/organic-growth"
];

function listTsFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...listTsFiles(full));
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

test("Organic Growth: no file under organic-growth lib/API paths references an AI-provider call", () => {
  const offenders: string[] = [];
  for (const base of ORGANIC_GROWTH_PATHS) {
    for (const file of listTsFiles(join(process.cwd(), base))) {
      const content = readFileSync(file, "utf-8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) offenders.push(`${file} matches ${pattern}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test("Organic Growth: the AI-generation autopilot route/module no longer exists (removed, not just disabled)", () => {
  const removedPaths = [
    "src/lib/organic-growth/autopilot.ts",
    "src/app/api/admin/organic-growth/autopilot"
  ];
  for (const path of removedPaths) {
    assert.throws(() => statSync(join(process.cwd(), path)), /ENOENT/);
  }
});

test("Organic Growth: vercel.json no longer schedules the AI-writing cron", () => {
  const vercelConfig = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf-8"));
  const organicGrowthCrons = vercelConfig.crons.filter((c: { path: string }) => c.path.includes("organic-growth"));
  assert.deepEqual(organicGrowthCrons, []);
});
