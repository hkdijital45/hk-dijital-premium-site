// HK Lead Intelligence V2 — Agent Council orchestration, extracted out of
// the route handler so it's directly unit-testable: Next.js route.ts files
// may only export GET/POST/config (maxDuration etc.), so this couldn't live
// there as an importable, injectable function. `executeTask` is passed in
// (never imported/defaulted here) so tests can supply a fake, network-free
// implementation instead of the real executeAiTask() — this file itself
// never touches the network, Supabase, or Next.js.
import {
  buildChiefAgentPrompt,
  buildDigitalPresenceAgentPrompt,
  buildGrowthAgentPrompt,
  buildLeadQualifierAgentPrompt,
  buildMarketAgentPrompt,
  buildSalesAgentPrompt,
  parseLeadIntelligenceJson,
  runWithConcurrencyLimit,
  validateChiefAgentResult,
  validateDigitalPresenceAgentResult,
  validateGrowthAgentResult,
  validateLeadQualifierAgentResult,
  validateMarketAgentResult,
  validateSalesAgentResult,
  type AgentCouncilResult,
  type AgentStatus,
  type ChiefAgentResult,
  type DigitalPresenceAgentResult,
  type GrowthAgentResult,
  type LeadIntelligenceEvidence,
  type LeadIntelligenceResult,
  type LeadQualifierAgentResult,
  type MarketAgentResult,
  type SalesAgentResult
} from "../lead-intelligence-schema.ts";
import type { AiRouterInput, AiRouterOptions, AiRouterResult } from "./ai-router.ts";

export type ExecuteAiTaskFn = (input: AiRouterInput, options?: AiRouterOptions) => Promise<AiRouterResult>;

export type TokenUsageSummary = { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null } | null;

/** Sums only genuinely-reported token fields across a batch of AI router
 * results — never estimates. Returns null (not zeros) when NONE of the
 * calls reported any token field, so the UI shows an honest "not reported"
 * message instead of a fabricated 0. */
export function aggregateTokenUsage(results: Array<AiRouterResult | null | undefined>): TokenUsageSummary {
  const reported = results.filter((result): result is AiRouterResult => Boolean(result) && (typeof result!.inputTokens === "number" || typeof result!.outputTokens === "number" || typeof result!.thinkingTokens === "number"));
  if (!reported.length) return null;
  const inputTokens = reported.reduce((sum, result) => sum + (result.inputTokens || 0), 0);
  const outputTokens = reported.reduce((sum, result) => sum + (result.outputTokens || 0) + (result.thinkingTokens || 0), 0);
  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
}

export const AGENT_ROLE_LABELS: Record<"leadQualifier" | "digitalPresence" | "market" | "growth" | "sales", string> = {
  leadQualifier: "Potansiyel Müşteri Analisti",
  digitalPresence: "Dijital Varlık Analisti",
  market: "Rakip ve Pazar Analisti",
  growth: "Büyüme Stratejisti",
  sales: "Satış Stratejisti"
};

// >=3 of 5 specialists must succeed before the Chief is allowed to run —
// below that, too little real signal exists to reconcile, so we return a
// recoverable error instead of a fabricated confident Chief result.
const MIN_SPECIALISTS_FOR_CHIEF = 3;

export type AgentCouncilRunOutcome =
  | { ok: false; logicalAiCallCount: number; specialists: AgentCouncilResult["specialists"]; tokenUsage: TokenUsageSummary; error: string }
  | { ok: true; logicalAiCallCount: number; specialists: AgentCouncilResult["specialists"]; chief: { status: AgentStatus; result: ChiefAgentResult | null; error?: string }; provider: string | null; model: string | null; tokenUsage: TokenUsageSummary };

/** Runs the real six-agent council: five specialists (bounded 3-way
 * concurrency — never uncontrolled Promise.all, never all six/five
 * serially) each as their OWN executeTask() call against a role-specific
 * evidence slice, then one Chief call that receives the five VALIDATED
 * results and reconciles them. Partial specialist failure is tolerated
 * (Chief still runs if >=3 of 5 succeeded); total failure returns a
 * recoverable error instead of a fabricated confident result.
 *
 * `logicalAiCallCount` counts real, distinct AI TASKS this function issued
 * — never provider-internal retry attempts (executeAiTask's own fallback
 * chain is invisible here, exactly as intended: one logical call, whatever
 * the router did underneath it). A full run is exactly 6 (5 specialists +
 * Chief); a run that stops before the Chief (too many specialist failures)
 * is exactly 5, never 6, since the Chief was never actually invoked. */
export async function runAgentCouncil(
  params: { evidence: LeadIntelligenceEvidence; deterministic: LeadIntelligenceResult; createdBy: string | null },
  executeTask: ExecuteAiTaskFn
): Promise<AgentCouncilRunOutcome> {
  const { evidence, deterministic, createdBy } = params;
  type SpecialistKey = keyof typeof AGENT_ROLE_LABELS;
  const specialistJobs: Array<{ key: SpecialistKey; run: () => Promise<AiRouterResult> }> = [
    { key: "leadQualifier", run: async () => executeTask({ taskType: "strategy", module: "lead-intelligence-council-lead-qualifier", prompt: buildLeadQualifierAgentPrompt(evidence), fallbackText: JSON.stringify(deterministic.specialists.leadQualifier), createdBy }, { timeoutMs: 18_000 }) },
    { key: "digitalPresence", run: async () => executeTask({ taskType: "strategy", module: "lead-intelligence-council-digital-presence", prompt: buildDigitalPresenceAgentPrompt(evidence), fallbackText: JSON.stringify(deterministic.specialists.digitalPresence), createdBy }, { timeoutMs: 18_000 }) },
    { key: "market", run: async () => executeTask({ taskType: "strategy", module: "lead-intelligence-council-market", prompt: buildMarketAgentPrompt(evidence), fallbackText: JSON.stringify(deterministic.specialists.market), createdBy }, { timeoutMs: 18_000 }) },
    { key: "growth", run: async () => executeTask({ taskType: "strategy", module: "lead-intelligence-council-growth", prompt: buildGrowthAgentPrompt(evidence), fallbackText: JSON.stringify(deterministic.specialists.growth), createdBy }, { timeoutMs: 18_000 }) },
    { key: "sales", run: async () => executeTask({ taskType: "strategy", module: "lead-intelligence-council-sales", prompt: buildSalesAgentPrompt(evidence), fallbackText: JSON.stringify(deterministic.specialists.sales), createdBy }, { timeoutMs: 18_000 }) }
  ];

  const settled = await runWithConcurrencyLimit(specialistJobs.map((job) => async () => ({ key: job.key, generated: await job.run() })), 3);

  const specialists: AgentCouncilResult["specialists"] = {
    leadQualifier: { status: "failed", result: null },
    digitalPresence: { status: "failed", result: null },
    market: { status: "failed", result: null },
    growth: { status: "failed", result: null },
    sales: { status: "failed", result: null }
  };
  let leadQualifierResult: LeadQualifierAgentResult | null = null;
  let digitalPresenceResult: DigitalPresenceAgentResult | null = null;
  let marketResult: MarketAgentResult | null = null;
  let growthResult: GrowthAgentResult | null = null;
  let salesResult: SalesAgentResult | null = null;
  let anyProvider: string | null = null;
  let anyModel: string | null = null;
  const failedAgents: string[] = [];
  const rawResults: AiRouterResult[] = [];

  for (let i = 0; i < settled.length; i += 1) {
    const outcome = settled[i];
    const key = specialistJobs[i].key;
    if (outcome.status === "rejected") { specialists[key] = { status: "failed", result: null, error: "Sağlayıcı yanıt vermedi." }; failedAgents.push(AGENT_ROLE_LABELS[key]); continue; }
    const { generated } = outcome.value;
    rawResults.push(generated);
    anyProvider = anyProvider || generated.provider;
    anyModel = anyModel || generated.model;
    const parsed = parseLeadIntelligenceJson(generated.text);
    try {
      if (key === "leadQualifier") { const v = validateLeadQualifierAgentResult(parsed, deterministic); leadQualifierResult = v.result; specialists.leadQualifier = { status: "completed", result: v.result }; }
      else if (key === "digitalPresence") { const v = validateDigitalPresenceAgentResult(parsed, deterministic); digitalPresenceResult = v.result; specialists.digitalPresence = { status: "completed", result: v.result }; }
      else if (key === "market") { const v = validateMarketAgentResult(parsed, deterministic); marketResult = v.result; specialists.market = { status: "completed", result: v.result }; }
      else if (key === "growth") { const v = validateGrowthAgentResult(parsed, deterministic); growthResult = v.result; specialists.growth = { status: "completed", result: v.result }; }
      else if (key === "sales") { const v = validateSalesAgentResult(parsed, deterministic); salesResult = v.result; specialists.sales = { status: "completed", result: v.result }; }
    } catch {
      specialists[key] = { status: "failed", result: null, error: "Yanıt doğrulanamadı." };
      failedAgents.push(AGENT_ROLE_LABELS[key]);
    }
  }

  const successCount = Object.values(specialists).filter((entry) => entry.status === "completed").length;
  if (successCount < MIN_SPECIALISTS_FOR_CHIEF) {
    return {
      ok: false,
      logicalAiCallCount: specialistJobs.length,
      specialists,
      tokenUsage: aggregateTokenUsage(rawResults),
      error: `Ajan Kurulu tamamlanamadı. 5 uzman analizinden yalnızca ${successCount}'si başarıyla sonuçlandı.`
    };
  }

  const chiefPrompt = buildChiefAgentPrompt({ evidence, leadQualifier: leadQualifierResult, digitalPresence: digitalPresenceResult, market: marketResult, growth: growthResult, sales: salesResult, failedAgents });
  let chief: { status: AgentStatus; result: ChiefAgentResult | null; error?: string };
  try {
    const chiefGenerated = await executeTask({ taskType: "strategy", module: "lead-intelligence-council-chief", prompt: chiefPrompt, fallbackText: JSON.stringify(deterministic), createdBy }, { timeoutMs: 20_000 });
    rawResults.push(chiefGenerated);
    anyProvider = anyProvider || chiefGenerated.provider;
    anyModel = anyModel || chiefGenerated.model;
    const parsed = parseLeadIntelligenceJson(chiefGenerated.text);
    const v = validateChiefAgentResult(parsed, deterministic);
    chief = { status: "completed", result: v.result };
  } catch {
    chief = { status: "failed", result: null, error: "Baş Stratejist yanıtı alınamadı." };
  }

  return {
    ok: true,
    logicalAiCallCount: specialistJobs.length + 1,
    specialists,
    chief,
    provider: anyProvider,
    model: anyModel,
    tokenUsage: aggregateTokenUsage(rawResults)
  };
}
