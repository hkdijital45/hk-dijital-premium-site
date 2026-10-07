// Organik Büyüme Merkezi — autonomous SEO/GEO content generation.
// Turns the existing "copy a prompt into Claude, paste the JSON back"
// workflow (claude-prompts.ts + import-article/route.ts) into a real,
// scheduled (or manually triggered) end-to-end pipeline:
//   pick opportunity -> check cannibalization -> fill brief (if missing)
//   -> write article -> quality gate -> save as DRAFT -> notify admin.
// NEVER publishes. NEVER fabricates a draft from a failed/demo AI call.
import { supabaseRest } from "@/lib/supabase";
import { runRealAgentProvider } from "@/lib/agent-providers";
import type { AgentProviderKey } from "@/lib/agent-hub";
import {
  listContentPlanItems, updateContentPlanItem, getOrganicGrowthSettings,
  startGenerationRun, finishGenerationRun
} from "@/lib/organic-growth/data";
import { detectCannibalization, type CannibalizationCandidate } from "@/lib/organic-growth/cannibalization";
import {
  buildBriefPrompt, parseBriefImport, buildArticlePrompt, parseArticleImport, AUTOPILOT_SYSTEM_PROMPT
} from "@/lib/organic-growth/claude-prompts";
import { insertArticleAsDraft } from "@/lib/organic-growth/article-import";
import { runQualityGate } from "@/lib/organic-growth/quality-gate";
import type { ContentPlanItem } from "@/lib/organic-growth/types";

const CANDIDATE_POOL_SIZE = 5;

// Preference order for the REAL automated call — anthropic/openai are
// tried first only when actually configured; gemini is the provider this
// application already runs in production for every other automated
// module (see src/lib/ai-task-routing.ts's defaultIntelligenceProviderPriority).
function pickAvailableProvider(): AgentProviderKey | null {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

async function callAi(provider: AgentProviderKey, prompt: string, expectedOutputSize: "medium" | "long") {
  const result = await runRealAgentProvider({
    provider,
    taskType: "content_generation",
    systemPrompt: AUTOPILOT_SYSTEM_PROMPT,
    prompt,
    complexity: "normal",
    expectedOutputSize
  });
  // A real provider call that genuinely failed (missing config, network,
  // auth, rate limit) silently falls back to a FABRICATED "demo" string
  // inside runRealAgentProvider — that fallback exists for UI demos
  // elsewhere, but an autopilot must never save demo text as a real
  // draft. Treat "demo" exactly like a hard failure.
  if (result.provider === "demo") {
    throw new Error(result.errorMessage || "AI sağlayıcısına ulaşılamadı.");
  }
  return result;
}

async function fetchPublishedPostCandidates(): Promise<CannibalizationCandidate[]> {
  const rows = await supabaseRest<Array<{ id: string; title: string; slug: string; primary_keyword: string; search_intent: string }>>(
    "blog_posts?select=id,title,slug,primary_keyword,search_intent&status=eq.published&limit=300"
  ).catch(() => []);
  return rows.map((row) => ({ id: row.id, title: row.title, slug: row.slug, primaryTopic: row.primary_keyword || "", searchIntent: row.search_intent || "", targetService: "", topicClusterId: null }));
}

function itemToCandidate(item: ContentPlanItem): CannibalizationCandidate {
  return {
    id: item.id,
    title: item.working_title,
    slug: "",
    primaryTopic: item.primary_topic || "",
    searchIntent: item.search_intent || "",
    targetService: item.target_service || "",
    topicClusterId: item.topic_cluster_id
  };
}

export type AutopilotOutcome =
  | { status: "skipped"; reason: string }
  | { status: "success"; contentPlanItemId: string; blogPostId: string; step: string; provider: string; model: string; warnings: string[] }
  | { status: "failed"; step: string; error: string; contentPlanItemId?: string };

/**
 * Runs exactly one generation attempt. Idempotency for the scheduled
 * ("cron") path is enforced by startGenerationRun() itself — a second
 * cron call on the same calendar day fails on the DB's unique partial
 * index (organic_generation_runs_one_cron_per_day) before any AI call is
 * ever made. A "manual" trigger always runs (an admin intentionally
 * clicked a button) and is never blocked by that lock.
 */
export async function runOrganicGrowthAutopilot(trigger: "cron" | "manual", actorEmail?: string | null): Promise<AutopilotOutcome> {
  const settings = await getOrganicGrowthSettings();
  if (trigger === "cron" && !settings.automation_enabled) {
    return { status: "skipped", reason: "Otomasyon ayarlardan kapatılmış." };
  }

  let run;
  try {
    run = await startGenerationRun({ trigger, created_by: actorEmail || null });
  } catch {
    // Unique-index violation: a cron run already started/ran today.
    return { status: "skipped", reason: "Bugün için zaten bir otonom üretim çalışması başlatıldı." };
  }

  const fail = async (step: string, error: string, contentPlanItemId?: string): Promise<AutopilotOutcome> => {
    await finishGenerationRun(run.id, { status: "failed", step, error, content_plan_item_id: contentPlanItemId || null });
    return { status: "failed", step, error, contentPlanItemId };
  };

  const provider = pickAvailableProvider();
  if (!provider) {
    return fail("provider-check", "Hiçbir AI sağlayıcısı (Anthropic/Gemini/OpenAI) yapılandırılmamış.");
  }

  try {
    const [planned, briefReady, publishedCandidates] = await Promise.all([
      listContentPlanItems({ status: "PLANNED" }, 50),
      listContentPlanItems({ status: "BRIEF_READY" }, 50),
      fetchPublishedPostCandidates()
    ]);
    // Priority desc (high > medium > low), then earliest planned date —
    // already the backlog's natural editorial order.
    const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const backlog = [...briefReady, ...planned]
      .sort((a, b) => (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1))
      .slice(0, CANDIDATE_POOL_SIZE);

    if (!backlog.length) {
      await finishGenerationRun(run.id, { status: "skipped", step: "candidate-selection", reasoning: "İçerik planında PLANNED/BRIEF_READY öğe yok." });
      return { status: "skipped", reason: "İçerik planında bekleyen bir fırsat (PLANNED/BRIEF_READY) bulunamadı." };
    }

    const otherBacklogAsCandidates = backlog.map(itemToCandidate);

    let chosen: ContentPlanItem | null = null;
    for (const item of backlog) {
      const pool = [itemToCandidate(item), ...publishedCandidates, ...otherBacklogAsCandidates.filter((c) => c.id !== item.id)];
      const conflicts = detectCannibalization(pool).filter((c) => c.aId === item.id || c.bId === item.id);
      const highSeverityAgainstPublished = conflicts.find((c) => {
        const otherId = c.aId === item.id ? c.bId : c.aId;
        return c.severity === "high" && publishedCandidates.some((p) => p.id === otherId);
      });
      if (highSeverityAgainstPublished) {
        const conflictTitle = highSeverityAgainstPublished.aId === item.id ? highSeverityAgainstPublished.bTitle : highSeverityAgainstPublished.aTitle;
        await updateContentPlanItem(item.id, {
          status: "UPDATE_REQUIRED",
          editorial_notes: `${item.editorial_notes ? item.editorial_notes + "\n\n" : ""}[Otopilot ${new Date().toISOString().slice(0, 10)}] Yayınlanmış "${conflictTitle}" ile yüksek örtüşme tespit edildi (${highSeverityAgainstPublished.reasons.join(" ")}); yeni makale yerine bu kaydın güncellenmesi önerilir.`
        });
        continue;
      }
      chosen = item;
      break;
    }

    if (!chosen) {
      await finishGenerationRun(run.id, { status: "skipped", step: "cannibalization", reasoning: "Tüm adaylar mevcut yayınlarla çakıştığı için UPDATE_REQUIRED olarak işaretlendi." });
      return { status: "skipped", reason: "Değerlendirilen fırsatların tamamı mevcut yayınlarla örtüştüğü için güncelleme önerisine çevrildi." };
    }

    const warnings: string[] = [];

    // Step 1: fill the brief if genuinely missing.
    let workingItem = chosen;
    if (!workingItem.primary_question && !(workingItem.must_cover_points || []).length) {
      const briefPrompt = buildBriefPrompt({
        workingTitle: workingItem.working_title,
        primaryTopic: workingItem.primary_topic,
        searchIntent: workingItem.search_intent,
        targetService: workingItem.target_service,
        targetGeography: workingItem.target_geography,
        targetAudience: workingItem.target_audience,
        articleType: workingItem.article_type,
        rationale: workingItem.rationale,
        ctaObjective: workingItem.cta_objective,
        existingRelatedContent: publishedCandidates.slice(0, 15).map((p) => p.title)
      });
      let briefResult;
      try {
        briefResult = await callAi(provider, briefPrompt, "medium");
      } catch (error) {
        return fail("brief-generation", error instanceof Error ? error.message : String(error), chosen.id);
      }
      const parsedBrief = parseBriefImport(briefResult.text);
      if (!parsedBrief.valid) {
        return fail("brief-parse", parsedBrief.errors.join(" ") || "Brief JSON ayrıştırılamadı.", chosen.id);
      }
      const updated = await updateContentPlanItem(workingItem.id, { ...parsedBrief.brief, status: "BRIEF_READY" });
      if (!updated) return fail("brief-save", "Brief kaydedilemedi.", chosen.id);
      workingItem = updated;
    }

    // Step 2: write the article from the (now-complete) brief.
    const articlePrompt = buildArticlePrompt({
      workingTitle: workingItem.working_title,
      primaryTopic: workingItem.primary_topic,
      searchIntent: workingItem.search_intent,
      targetAudience: workingItem.target_audience,
      targetService: workingItem.target_service,
      targetLocation: workingItem.target_geography,
      pillarOrSupporting: workingItem.pillar_or_supporting || undefined,
      funnelStage: workingItem.funnel_stage,
      whyThisArticle: workingItem.why_this_article,
      primaryQuestion: workingItem.primary_question,
      secondaryQuestions: workingItem.secondary_questions,
      contentAngle: workingItem.content_angle,
      mustCoverPoints: workingItem.must_cover_points,
      existingRelatedContent: workingItem.existing_related_content,
      internalLinkTargets: workingItem.internal_link_targets,
      ctaObjective: workingItem.cta_objective,
      seoRequirements: workingItem.seo_requirements,
      geoRequirements: workingItem.geo_requirements,
      factsSources: workingItem.facts_sources,
      editorialNotes: workingItem.editorial_notes
    });
    let articleResult;
    try {
      articleResult = await callAi(provider, articlePrompt, "long");
    } catch (error) {
      return fail("article-generation", error instanceof Error ? error.message : String(error), chosen.id);
    }
    const parsedArticle = parseArticleImport(articleResult.text);
    if (!parsedArticle.valid) {
      return fail("article-parse", parsedArticle.errors.join(" ") || "Makale JSON ayrıştırılamadı.", chosen.id);
    }

    const gateWarnings = runQualityGate({
      title: parsedArticle.article.title,
      content: parsedArticle.article.content,
      wordCount: parsedArticle.article.content.split(/\s+/).filter(Boolean).length,
      minWordCount: settings.min_word_count
    });
    warnings.push(...gateWarnings.map((w) => w.message));
    if (parsedArticle.article.flagged_claims?.length) {
      warnings.push(...parsedArticle.article.flagged_claims.map((c) => `Doğrulama gerekli: ${c}`));
    }

    const { post } = await insertArticleAsDraft(parsedArticle.article, workingItem.id);
    if (warnings.length) {
      await updateContentPlanItem(workingItem.id, {
        editorial_notes: `${workingItem.editorial_notes ? workingItem.editorial_notes + "\n\n" : ""}[Otopilot kalite uyarıları] ${warnings.join(" | ")}`
      });
    }

    await finishGenerationRun(run.id, {
      status: "success",
      step: "complete",
      content_plan_item_id: workingItem.id,
      blog_post_id: post.id,
      provider: articleResult.provider,
      model: articleResult.model,
      reasoning: warnings.length ? `${warnings.length} kalite uyarısıyla tamamlandı.` : "Sorunsuz tamamlandı."
    });

    await createDraftReadyNotification(workingItem, post.id, warnings.length > 0);

    return { status: "success", contentPlanItemId: workingItem.id, blogPostId: post.id, step: "complete", provider: articleResult.provider, model: articleResult.model, warnings };
  } catch (error) {
    return fail("unexpected", error instanceof Error ? error.message : String(error));
  }
}

async function createDraftReadyNotification(item: ContentPlanItem, blogPostId: string, hasWarnings: boolean) {
  await supabaseRest("agency_notifications", {
    method: "POST",
    body: JSON.stringify({
      company_id: null,
      notification_type: hasWarnings ? "organic_growth_draft_review" : "organic_growth_draft_ready",
      title: hasWarnings ? "Yeni SEO/GEO taslağı — incelemede uyarı var" : "Yeni SEO/GEO taslağı hazır",
      message: `"${item.working_title}" otonom olarak oluşturuldu ve taslak olarak kaydedildi.`,
      priority: hasWarnings ? "Yüksek" : "Normal",
      source_module: "organic_growth",
      source_entity_type: "blog_post",
      source_entity_id: blogPostId,
      action_url: "/hk-admin/organik-buyume-merkezi",
      show_to_customer: false,
      metadata: { content_plan_item_id: item.id }
    })
  }).catch(() => null);
}
