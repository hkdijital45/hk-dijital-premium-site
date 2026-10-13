// HK_PROPOSAL_V1 — the structured JSON contract Claude Project must return
// after a manual (API-free) analysis run. Hand-rolled validator, same
// convention as every other validated contract in this codebase
// (validateManualEvaluationInput, validateContactAndSocials) — no new
// dependency (zod etc. not already present in this project).
export const HK_PROPOSAL_SCHEMA_VERSION = "HK_PROPOSAL_V1";

export type ProposalBudgetScenario = {
  name: string; // "Başlangıç" | "Önerilen" | "Büyüme"
  monthlyBudget: number;
  dailyBudget?: number;
  googleAllocation?: number;
  metaAllocation?: number;
  objective: string;
  testingLimitations?: string;
  expectedLearning?: string;
  risks?: string;
};

export type ProposalCompetitor = {
  name: string;
  website?: string;
  notes?: string;
  verified: boolean; // false => an estimate/assumption, never presented as fact
  sourceUrl?: string;
  accessDate?: string;
};

export type HkProposalV1 = {
  schema_version: string;
  business: Record<string, unknown>;
  market_analysis: Record<string, unknown>;
  competitors: ProposalCompetitor[];
  google_ads_strategy: Record<string, unknown>;
  meta_ads_strategy: Record<string, unknown>;
  audience_strategy: Record<string, unknown>;
  budget_scenarios: ProposalBudgetScenario[];
  recommended_services: string[];
  implementation_plan: Array<{ day?: string; action: string }>;
  roadmap_90_days: Array<{ phase?: string; action: string }>;
  risks: string[];
  assumptions: string[];
  sources: Array<{ url?: string; accessDate?: string; note?: string }>;
  customer_proposal: Record<string, unknown>;
  internal_recommendations: Record<string, unknown>;
};

const REQUIRED_TOP_LEVEL_KEYS: Array<keyof HkProposalV1> = [
  "schema_version", "business", "market_analysis", "competitors",
  "google_ads_strategy", "meta_ads_strategy", "audience_strategy",
  "budget_scenarios", "recommended_services", "implementation_plan",
  "roadmap_90_days", "risks", "assumptions", "sources",
  "customer_proposal", "internal_recommendations"
];

export type ProposalValidationResult =
  | { ok: true; data: HkProposalV1 }
  | { ok: false; errors: string[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Rejects malformed JSON safely (never throws), checks the schema version,
 * every required top-level field (type-checked, not just "present"), and
 * every budget scenario / competitor's own required shape. Errors are
 * plain Turkish sentences, collected (not fail-fast) so a real editor can
 * show the user everything wrong at once. */
export function validateHkProposalV1(raw: unknown): ProposalValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(raw)) return { ok: false, errors: ["Gönderilen içerik geçerli bir JSON nesnesi değil."] };

  if (raw.schema_version !== HK_PROPOSAL_SCHEMA_VERSION) {
    return { ok: false, errors: [`Şema sürümü uyumsuz: "${String(raw.schema_version ?? "belirtilmemiş")}" bekleniyordu "${HK_PROPOSAL_SCHEMA_VERSION}".`] };
  }

  for (const key of REQUIRED_TOP_LEVEL_KEYS) {
    if (!(key in raw)) errors.push(`Zorunlu alan eksik: ${key}`);
  }

  const arrayFields: Array<keyof HkProposalV1> = ["competitors", "budget_scenarios", "recommended_services", "implementation_plan", "roadmap_90_days", "risks", "assumptions", "sources"];
  for (const field of arrayFields) {
    if (field in raw && !Array.isArray(raw[field])) errors.push(`"${field}" bir dizi (array) olmalı.`);
  }

  const objectFields: Array<keyof HkProposalV1> = ["business", "market_analysis", "google_ads_strategy", "meta_ads_strategy", "audience_strategy", "customer_proposal", "internal_recommendations"];
  for (const field of objectFields) {
    if (field in raw && !isPlainObject(raw[field])) errors.push(`"${field}" bir nesne (object) olmalı.`);
  }

  if (Array.isArray(raw.budget_scenarios)) {
    raw.budget_scenarios.forEach((scenario: unknown, index: number) => {
      if (!isPlainObject(scenario)) { errors.push(`budget_scenarios[${index}] bir nesne olmalı.`); return; }
      if (typeof scenario.name !== "string" || !scenario.name.trim()) errors.push(`budget_scenarios[${index}].name zorunlu bir metin olmalı.`);
      if (scenario.monthlyBudget !== undefined && typeof scenario.monthlyBudget !== "number") errors.push(`budget_scenarios[${index}].monthlyBudget sayısal olmalı.`);
      if (typeof scenario.objective !== "string" || !scenario.objective.trim()) errors.push(`budget_scenarios[${index}].objective zorunlu bir metin olmalı.`);
    });
  }

  if (Array.isArray(raw.competitors)) {
    raw.competitors.forEach((competitor: unknown, index: number) => {
      if (!isPlainObject(competitor)) { errors.push(`competitors[${index}] bir nesne olmalı.`); return; }
      if (typeof competitor.name !== "string" || !competitor.name.trim()) errors.push(`competitors[${index}].name zorunlu bir metin olmalı (rakip adı uydurulamaz — veri yoksa bu öğeyi eklemeyin).`);
      if (typeof competitor.verified !== "boolean") errors.push(`competitors[${index}].verified true/false olarak belirtilmeli (doğrulanmış gerçek mi, yoksa tahmin mi?).`);
      if (competitor.verified === true && !competitor.sourceUrl) errors.push(`competitors[${index}]: "verified: true" ise bir sourceUrl (kaynak bağlantısı) zorunludur.`);
    });
  }

  if (Array.isArray(raw.sources)) {
    raw.sources.forEach((source: unknown, index: number) => {
      if (!isPlainObject(source)) { errors.push(`sources[${index}] bir nesne olmalı.`); return; }
      if (source.url && typeof source.url === "string" && !/^https?:\/\//i.test(source.url)) errors.push(`sources[${index}].url geçerli bir http(s) bağlantısı olmalı.`);
    });
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, data: raw as unknown as HkProposalV1 };
}

/** Finds the first balanced top-level {...} object in arbitrary text by
 * brace-counting (ignores braces inside string literals so a quoted "{"
 * in an analysis paragraph never confuses the scan). Used so a user can
 * paste Claude's ENTIRE response — the Turkish analysis prose AND the
 * JSON block together — without manually isolating the JSON, per the
 * brief's "no separate JSON paste" requirement. */
function extractFirstJsonObject(text: string): string | null {
  // Scans the WHOLE text from index 0 (not from the first literal "{"),
  // tracking string state the entire way — a quoted brace in analysis
  // prose that appears before the real JSON object (e.g. müşteri
  // "{örnek}" dedi...) would otherwise be mistaken for the object's
  // opening brace.
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') { inString = true; continue; }
    if (char === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (char === "}") {
      if (depth > 0) depth--;
      if (depth === 0 && start !== -1) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Safe, tolerant parse used by the paste/upload import UI before handing
 * the result to validateHkProposalV1. Tries, in order: (1) the text is
 * already pure JSON — the common case for an already-isolated paste and
 * every pre-existing saved record; (2) a ```json fenced code block
 * inside a larger pasted response (ÇIKTI A analysis text + ÇIKTI B JSON,
 * pasted together in one go); (3) the first balanced {...} object found
 * anywhere in the text. Never throws, never guesses field values — it
 * only locates where the real JSON starts and ends. */
export function parseProposalJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const direct = text.trim();
  try {
    return { ok: true, value: JSON.parse(direct) };
  } catch { /* fall through to extraction below */ }

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try {
      return { ok: true, value: JSON.parse(fenceMatch[1].trim()) };
    } catch { /* fenced block itself wasn't valid JSON — fall through */ }
  }

  const extracted = extractFirstJsonObject(text);
  if (extracted) {
    try {
      return { ok: true, value: JSON.parse(extracted) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? `Yanıt içinde bir JSON bloğu bulundu ama geçerli değil: ${error.message}` : "Yanıt içinde bir JSON bloğu bulundu ama geçerli değil." };
    }
  }

  return { ok: false, error: "Yapıştırılan metinde geçerli bir JSON nesnesi bulunamadı. Claude'un tam yanıtını (analiz metni + JSON) veya yalnızca JSON bloğunu yapıştırabilirsiniz." };
}
