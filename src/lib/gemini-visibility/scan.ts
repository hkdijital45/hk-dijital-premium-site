import "server-only";

import { callGeminiGenerate } from "@/lib/gemini-client";
import { createAgentRunLog } from "@/lib/agent-hub";
import { supabaseRest } from "@/lib/supabase";
import type { HKAIModel } from "@/lib/hk-ai-router";
import { findCachedAnswer } from "./cache";
import { textMentionsAnyName } from "./name-matching";
import { resolveAnalysisModel, resolveScanModel, scanModelFallback } from "./model";
import {
  BATCH_ANALYSIS_RESPONSE_SCHEMA, buildBatchAnalysisPrompt, NATURAL_QUESTION_SYSTEM_INSTRUCTION,
  type BatchAnalysisItem, type BatchAnalysisResult
} from "./prompts";
import { computeGeminiVisibilityScore } from "./scoring";
import { allowedQuestionCount, getQuotaStatus } from "./quota";
import {
  MAX_CONCURRENT_GEMINI_REQUESTS, type GeminiVisibilityAnswer, type GeminiVisibilityProfile,
  type GeminiVisibilityQuestion, type GeminiVisibilityScan
} from "./types";

async function runWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function next(): Promise<void> {
    const current = cursor++;
    if (current >= items.length) return;
    results[current] = await worker(items[current]);
    return next();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
  return results;
}

async function loadProfile(profileId: string): Promise<GeminiVisibilityProfile> {
  const rows = await supabaseRest<GeminiVisibilityProfile[]>(`gemini_visibility_profiles?id=eq.${encodeURIComponent(profileId)}&select=*&limit=1`);
  if (!rows[0]) throw new Error("Gemini görünürlük profili bulunamadı.");
  return rows[0];
}

async function loadActiveQuestions(profileId: string): Promise<GeminiVisibilityQuestion[]> {
  return supabaseRest<GeminiVisibilityQuestion[]>(
    `gemini_visibility_questions?profile_id=eq.${encodeURIComponent(profileId)}&is_active=eq.true&deleted_at=is.null&select=*&order=created_at.asc`
  );
}

async function findPreviousScan(profileId: string, excludeScanId: string): Promise<GeminiVisibilityScan | null> {
  const rows = await supabaseRest<GeminiVisibilityScan[]>(
    `gemini_visibility_scans?profile_id=eq.${encodeURIComponent(profileId)}&id=neq.${encodeURIComponent(excludeScanId)}&status=in.(completed,partial)&select=*&order=started_at.desc&limit=1`
  );
  return rows[0] || null;
}

type PendingAnswer = {
  question: GeminiVisibilityQuestion;
  rawResponse: string | null;
  citation: string | null;
  responseMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  status: "completed" | "failed" | "cached";
  cached: boolean;
  error: string | null;
  cachedAnswer?: GeminiVisibilityAnswer;
};

async function callOneQuestion(profile: GeminiVisibilityProfile, question: GeminiVisibilityQuestion, model: HKAIModel): Promise<PendingAnswer> {
  const started = Date.now();
  try {
    const result = await callGeminiGenerate({
      model,
      instructions: NATURAL_QUESTION_SYSTEM_INSTRUCTION,
      input: question.question_text,
      reasoning: "low",
      maxOutputTokens: 800,
      allowWeb: true,
      timeoutMs: 25_000,
      fallbackModel: scanModelFallback(model)
    });
    await createAgentRunLog({
      customer_id: profile.company_id,
      task_type: "seo_analysis",
      requested_provider: "gemini",
      selected_provider: "gemini",
      actual_provider: "gemini",
      provider_mode: "gemini_visibility_scan",
      status: "completed",
      input_summary: question.question_text.slice(0, 500),
      output_summary: result.text.slice(0, 700),
      response_ms: result.responseMs,
      tokens_used: result.totalTokens,
      model: result.model
    }).catch(() => null);
    return {
      question, rawResponse: result.text, citation: result.citations[0] || null,
      responseMs: result.responseMs, inputTokens: result.inputTokens, outputTokens: result.outputTokens,
      status: "completed", cached: false, error: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gemini isteği başarısız oldu.";
    await createAgentRunLog({
      customer_id: profile.company_id,
      task_type: "seo_analysis",
      requested_provider: "gemini",
      actual_provider: "gemini",
      provider_mode: "gemini_visibility_scan",
      status: "failed",
      input_summary: question.question_text.slice(0, 500),
      error_message: message.slice(0, 400),
      response_ms: Date.now() - started
    }).catch(() => null);
    return {
      question, rawResponse: null, citation: null, responseMs: Date.now() - started,
      inputTokens: null, outputTokens: null, status: "failed", cached: false, error: message
    };
  }
}

async function runBatchAnalysis(profile: GeminiVisibilityProfile, items: BatchAnalysisItem[]): Promise<{ results: Map<number, BatchAnalysisResult>; error: string | null }> {
  if (!items.length) return { results: new Map(), error: null };
  const model = resolveAnalysisModel();
  try {
    const result = await callGeminiGenerate({
      model,
      instructions: "Sen bir metin analiz motorusun. Sadece istenen JSON şemasıyla yanıt ver, başka hiçbir açıklama ekleme.",
      input: buildBatchAnalysisPrompt(profile, items),
      reasoning: "medium",
      maxOutputTokens: 4000,
      allowWeb: false,
      timeoutMs: 45_000,
      responseSchema: BATCH_ANALYSIS_RESPONSE_SCHEMA
    });
    await createAgentRunLog({
      customer_id: profile.company_id,
      task_type: "seo_analysis",
      requested_provider: "gemini",
      actual_provider: "gemini",
      provider_mode: "gemini_visibility_batch_analysis",
      status: "completed",
      input_summary: `Toplu analiz: ${items.length} yanıt`,
      response_ms: result.responseMs,
      tokens_used: result.totalTokens,
      model: result.model
    }).catch(() => null);
    const parsed = JSON.parse(result.text) as { results?: BatchAnalysisResult[] };
    const map = new Map<number, BatchAnalysisResult>();
    for (const entry of parsed.results || []) map.set(entry.index, entry);
    return { results: map, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Toplu analiz isteği başarısız oldu.";
    await createAgentRunLog({
      customer_id: profile.company_id,
      task_type: "seo_analysis",
      requested_provider: "gemini",
      actual_provider: "gemini",
      provider_mode: "gemini_visibility_batch_analysis",
      status: "failed",
      error_message: message.slice(0, 400)
    }).catch(() => null);
    return { results: new Map(), error: message };
  }
}

export type RunScanOptions = {
  triggeredBy: "manual" | "cron";
  forceRefresh?: boolean;
  createdBy?: string | null;
};

export async function runGeminiVisibilityScan(profileId: string, options: RunScanOptions): Promise<GeminiVisibilityScan> {
  const profile = await loadProfile(profileId);
  const questions = (await loadActiveQuestions(profileId)).slice(0, 15);
  if (!questions.length) throw new Error("Aktif soru bulunamadı. Önce en az bir soru ekleyin.");

  const model = resolveScanModel();

  // Cache lookup happens before quota accounting — cache hits are free.
  const cacheLookups = options.forceRefresh
    ? questions.map(() => null)
    : await Promise.all(questions.map((question) => findCachedAnswer(question.id, model)));

  const cacheHitIndices = new Set<number>();
  cacheLookups.forEach((cached, index) => { if (cached) cacheHitIndices.add(index); });
  const missQuestions = questions.filter((_, index) => !cacheHitIndices.has(index));

  const quota = await getQuotaStatus(profile.company_id);
  const allowedMisses = allowedQuestionCount(missQuestions.length, quota);
  const quotaTruncated = allowedMisses < missQuestions.length;
  const questionsToCall = missQuestions.slice(0, allowedMisses);
  const skippedForQuota = missQuestions.slice(allowedMisses);

  if (!cacheHitIndices.size && !questionsToCall.length) {
    throw new Error("Aylık Gemini görünürlük kotası doldu. Yeni tarama başlatılamıyor.");
  }

  let scan: GeminiVisibilityScan;
  try {
    const created = await supabaseRest<GeminiVisibilityScan[]>("gemini_visibility_scans", {
      method: "POST",
      body: JSON.stringify({
        profile_id: profile.id,
        company_id: profile.company_id,
        status: "running",
        model,
        questions_total: questions.length,
        triggered_by: options.triggeredBy,
        forced_refresh: Boolean(options.forceRefresh),
        created_by: options.createdBy || null
      })
    });
    scan = created[0];
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("duplicate key") || message.includes("gemini_visibility_scans_running_lock")) {
      throw new Error("Bu müşteri için zaten bir tarama çalışıyor. Lütfen tamamlanmasını bekleyin.");
    }
    throw error;
  }

  const answerRows: GeminiVisibilityAnswer[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let liveCalls = 0;

  try {
    // Cached answers: copy forward verbatim, no new Gemini call.
    for (let index = 0; index < questions.length; index += 1) {
      const cached = cacheLookups[index];
      if (!cached) continue;
      const inserted = await supabaseRest<GeminiVisibilityAnswer[]>("gemini_visibility_answers", {
        method: "POST",
        body: JSON.stringify({
          scan_id: scan.id, company_id: profile.company_id, question_id: questions[index].id,
          question_text_snapshot: questions[index].question_text, category: questions[index].category, model,
          status: "cached", cached: true,
          raw_response: cached.raw_response, brand_mentioned: cached.brand_mentioned,
          alternate_name_mentioned: cached.alternate_name_mentioned, recommended: cached.recommended,
          position: cached.position, competitors_mentioned: cached.competitors_mentioned,
          citation: cached.citation, sentiment: cached.sentiment
        })
      });
      answerRows.push(inserted[0]);
    }

    // Live Gemini calls for cache misses within quota, bounded concurrency.
    const liveResults = await runWithConcurrency(questionsToCall, MAX_CONCURRENT_GEMINI_REQUESTS, (question) => callOneQuestion(profile, question, model));
    liveCalls = liveResults.length;

    const analysisItems: BatchAnalysisItem[] = [];
    const pendingByIndex = new Map<number, { question: GeminiVisibilityQuestion; brandMentioned: boolean; altMentioned: boolean }>();

    liveResults.forEach((pending, index) => {
      totalInputTokens += pending.inputTokens || 0;
      totalOutputTokens += pending.outputTokens || 0;
      if (pending.status === "completed" && pending.rawResponse) {
        const brandMentioned = textMentionsAnyName(pending.rawResponse, [profile.business_name]);
        const altMentioned = textMentionsAnyName(pending.rawResponse, profile.alternate_names);
        analysisItems.push({ index, question: pending.question.question_text, rawResponse: pending.rawResponse });
        pendingByIndex.set(index, { question: pending.question, brandMentioned, altMentioned });
      }
    });

    const { results: analysisResults, error: analysisError } = await runBatchAnalysis(profile, analysisItems);

    for (let index = 0; index < liveResults.length; index += 1) {
      const pending = liveResults[index];
      if (pending.status === "failed") {
        const inserted = await supabaseRest<GeminiVisibilityAnswer[]>("gemini_visibility_answers", {
          method: "POST",
          body: JSON.stringify({
            scan_id: scan.id, company_id: profile.company_id, question_id: pending.question.id,
            question_text_snapshot: pending.question.question_text, category: pending.question.category, model,
            status: "failed", cached: false, error: pending.error, response_ms: pending.responseMs
          })
        });
        answerRows.push(inserted[0]);
        continue;
      }
      const derived = pendingByIndex.get(index);
      const analysis = analysisResults.get(index);
      const inserted = await supabaseRest<GeminiVisibilityAnswer[]>("gemini_visibility_answers", {
        method: "POST",
        body: JSON.stringify({
          scan_id: scan.id, company_id: profile.company_id, question_id: pending.question.id,
          question_text_snapshot: pending.question.question_text, category: pending.question.category, model,
          status: "completed", cached: false,
          raw_response: pending.rawResponse, response_ms: pending.responseMs,
          input_tokens: pending.inputTokens, output_tokens: pending.outputTokens,
          brand_mentioned: derived?.brandMentioned ?? null, alternate_name_mentioned: derived?.altMentioned ?? null,
          recommended: analysis?.recommended ?? null, position: analysis?.position ?? null,
          competitors_mentioned: analysis?.competitors ?? [], citation: pending.citation,
          sentiment: analysis?.sentiment ?? null
        })
      });
      answerRows.push(inserted[0]);
    }

    const completedCount = answerRows.filter((row) => row.status === "completed" || row.status === "cached").length;
    const failedCount = answerRows.filter((row) => row.status === "failed").length;
    const scoring = computeGeminiVisibilityScore(answerRows);
    const previousScan = await findPreviousScan(profile.id, scan.id);
    const scoreChange = previousScan?.score != null ? scoring.score - previousScan.score : null;

    const partial = quotaTruncated || failedCount > 0 || Boolean(analysisError);
    const status = completedCount === 0 ? "failed" : partial ? "partial" : "completed";
    const errorNotes = [
      quotaTruncated ? `Kota nedeniyle ${skippedForQuota.length} soru sorulamadı.` : null,
      analysisError ? `Toplu analiz hatası: ${analysisError}` : null,
      failedCount > 0 ? `${failedCount} soru Gemini hatası nedeniyle tamamlanamadı.` : null
    ].filter(Boolean).join(" ");

    const updated = await supabaseRest<GeminiVisibilityScan[]>(`gemini_visibility_scans?id=eq.${encodeURIComponent(scan.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status, questions_completed: completedCount, questions_failed: failedCount,
        score: scoring.score, score_breakdown: scoring.breakdown, score_level: scoring.level,
        unmeasured_components: scoring.unmeasuredComponents, previous_scan_id: previousScan?.id || null,
        score_change: scoreChange, finished_at: new Date().toISOString(),
        error: errorNotes || null,
        usage_json: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens, totalCalls: liveCalls }
      })
    });
    return updated[0];
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tarama sırasında beklenmeyen hata oluştu.";
    await supabaseRest(`gemini_visibility_scans?id=eq.${encodeURIComponent(scan.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "failed", error: message, finished_at: new Date().toISOString() })
    }).catch(() => null);
    throw error;
  }
}

export async function getScanWithAnswers(scanId: string): Promise<{ scan: GeminiVisibilityScan; answers: GeminiVisibilityAnswer[] }> {
  const [scans, answers] = await Promise.all([
    supabaseRest<GeminiVisibilityScan[]>(`gemini_visibility_scans?id=eq.${encodeURIComponent(scanId)}&select=*&limit=1`),
    supabaseRest<GeminiVisibilityAnswer[]>(`gemini_visibility_answers?scan_id=eq.${encodeURIComponent(scanId)}&select=*&order=created_at.asc`)
  ]);
  if (!scans[0]) throw new Error("Tarama bulunamadı.");
  return { scan: scans[0], answers };
}
