import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { executeAiTask } from "@/lib/server/ai-router";
import { aggregateTokenUsage, runAgentCouncil } from "@/lib/server/agent-council-runner";
import {
  AGENT_COUNCIL_SCHEMA_VERSION,
  buildLeadIntelligencePrompt,
  computeAgentCouncilFingerprint,
  computeBusinessFingerprint,
  computeEvidenceFingerprint,
  deriveDeterministicIntelligence,
  parseLeadIntelligenceJson,
  validateLeadIntelligenceResult,
  type AgentCouncilResult,
  type AgentStatus,
  type LeadIntelligenceEvidence
} from "@/lib/lead-intelligence-schema";
import type { AdStatusValue } from "@/lib/lead-scoring";

// Agent Council runs up to 6 sequential-ish AI calls (bounded 3-way
// concurrency for the 5 specialists, then 1 Chief call) — the platform
// default function timeout is not enough headroom for that in the worst
// case (slow provider + fallback chain). Mirrors the existing precedent in
// growth-intelligence/gemini-visibility/scan/route.ts for the same reason.
export const maxDuration = 90;

const WORKSPACE_ID = "hk-dijital";

async function requireStaff() {
  return await requireModuleAccess("business_discovery") || requireModuleAccess("leads") || requireModuleAccess("maps");
}

type LeadIntelligenceRequestBody = {
  business?: {
    name?: string;
    sector?: string;
    city?: string;
    district?: string;
    address?: string;
    website?: string;
    phone?: string;
    whatsapp?: string;
    instagram?: string;
    googleRating?: number | null;
    reviewCount?: number;
    googlePlaceId?: string;
    metaAdsStatus?: AdStatusValue;
    googleAdsStatus?: AdStatusValue;
    metaPixelDetected?: boolean | null;
    googleTagDetected?: boolean | null;
  };
  leadId?: string;
  deep?: boolean;
  forceRefresh?: boolean;
  mode?: "standard" | "agent_council";
};

/** Level 2 / Agent Council evidence enrichment: real other businesses
 * already discovered/saved in the same sector+city (the existing leads
 * table — zero additional Google Places API calls, zero new
 * infrastructure). Built once and reused by every specialist that needs
 * market context — never re-fetched per agent. */
async function fetchPeerContext(sector: string, city: string, excludePlaceId?: string) {
  if (!sector || !city) return null;
  const rows = await supabaseRest<Array<{ google_rating: number | null; google_review_count: number | null; website: string | null; google_place_id: string | null }>>(
    `leads?sector=ilike.${encodeURIComponent(sector)}&city=ilike.${encodeURIComponent(city)}&deleted_at=is.null&select=google_rating,google_review_count,website,google_place_id&limit=50`
  ).catch(() => []);
  const peers = rows.filter((row) => !excludePlaceId || row.google_place_id !== excludePlaceId);
  if (!peers.length) return { count: 0, averageRating: null, averageReviewCount: null, withWebsiteRatio: null };
  const rated = peers.filter((row) => typeof row.google_rating === "number");
  const averageRating = rated.length ? Math.round((rated.reduce((sum, row) => sum + Number(row.google_rating || 0), 0) / rated.length) * 10) / 10 : null;
  const averageReviewCount = peers.length ? Math.round(peers.reduce((sum, row) => sum + Number(row.google_review_count || 0), 0) / peers.length) : null;
  const withWebsiteRatio = peers.length ? Math.round((peers.filter((row) => row.website).length / peers.length) * 100) / 100 : null;
  return { count: peers.length, averageRating, averageReviewCount, withWebsiteRatio };
}

async function buildEvidence(business: NonNullable<LeadIntelligenceRequestBody["business"]>, leadId: string | undefined, includePeers: boolean): Promise<LeadIntelligenceEvidence> {
  let existingLeadStatus: string | null = null;
  if (leadId) {
    const leads = await supabaseRest<Array<{ status?: string; pipeline_stage?: string }>>(`leads?id=eq.${encodeURIComponent(leadId)}&select=status,pipeline_stage&limit=1`).catch(() => []);
    existingLeadStatus = leads[0]?.pipeline_stage || leads[0]?.status || null;
  }
  const peers = includePeers ? (await fetchPeerContext(business.sector as string, business.city as string, business.googlePlaceId)) ?? undefined : undefined;
  return {
    name: business.name as string,
    sector: business.sector as string,
    city: business.city as string,
    district: business.district,
    address: business.address,
    website: business.website,
    phone: business.phone,
    whatsapp: business.whatsapp,
    instagram: business.instagram,
    googleRating: business.googleRating ?? null,
    reviewCount: business.reviewCount ?? 0,
    googlePlaceId: business.googlePlaceId,
    metaAdsStatus: business.metaAdsStatus,
    googleAdsStatus: business.googleAdsStatus,
    metaPixelDetected: business.metaPixelDetected ?? null,
    googleTagDetected: business.googleTagDetected ?? null,
    existingLeadStatus,
    peers
  };
}

// Conservative, additional per-user cap on how many Agent Council RUNS can
// be *started* in a short window — distinct from executeAiTask's own
// request-level rate limit, which already governs the 6 calls a single run
// makes. In-memory, per serverless instance — the same accepted pattern
// server/ai-router.ts already uses for its own rate limiting; a persisted
// per-lead "pending" marker (below) is what actually protects against
// unsafe concurrent execution across instances, not this counter.
const COUNCIL_START_WINDOW_MS = 10 * 60_000;
const COUNCIL_START_MAX = 3;
const councilStarts = new Map<string, number[]>();
function checkCouncilStartLimit(key: string): boolean {
  const now = Date.now();
  const hits = (councilStarts.get(key) || []).filter((ts) => now - ts < COUNCIL_START_WINDOW_MS);
  if (hits.length >= COUNCIL_START_MAX) { councilStarts.set(key, hits); return false; }
  hits.push(now);
  councilStarts.set(key, hits);
  return true;
}

// A "pending" council run older than this is treated as abandoned (crashed
// function, timeout) rather than a permanent lock — self-healing, no
// manual cleanup needed.
const COUNCIL_PENDING_STALE_MS = maxDuration * 1000 + 15_000;

function emptyAgentCouncilShell(evidenceFingerprint: string, councilFingerprint: string): AgentCouncilResult {
  const pendingEntry = { status: "pending" as AgentStatus, result: null };
  return {
    version: AGENT_COUNCIL_SCHEMA_VERSION,
    specialists: { leadQualifier: { ...pendingEntry }, digitalPresence: { ...pendingEntry }, market: { ...pendingEntry }, growth: { ...pendingEntry }, sales: { ...pendingEntry } },
    chief: { ...pendingEntry },
    runMetadata: { startedAt: new Date().toISOString(), completedAt: null, logicalAiCallCount: 0, provider: null, model: null, evidenceFingerprint, councilFingerprint, tokenUsage: null }
  };
}

async function upsertProfile(row: Record<string, unknown>) {
  const saved = await supabaseRest<Array<Record<string, unknown>>>("lead_intelligence_profiles?on_conflict=workspace_id,business_fingerprint", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([row])
  });
  return saved[0] || row;
}

export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });

  const body: LeadIntelligenceRequestBody = await request.json().catch(() => ({}));
  const business = body.business;
  if (!business?.name || !business.sector || !business.city) {
    return NextResponse.json({ error: "İşletme adı, sektör ve şehir bilgisi zorunludur." }, { status: 400 });
  }

  const businessName = business.name;
  const businessSector = business.sector;
  const businessCity = business.city;
  const businessFingerprint = computeBusinessFingerprint({ name: businessName, phone: business.phone, city: businessCity, district: business.district, googlePlaceId: business.googlePlaceId });

  if (body.mode === "agent_council") {
    if (!body.leadId) return NextResponse.json({ error: "Ajan Kurulu yalnızca kaydedilmiş bir lead için çalıştırılabilir." }, { status: 400 });
    const rateLimitKey = session.email || "anonymous";
    if (!checkCouncilStartLimit(rateLimitKey)) {
      return NextResponse.json({ error: "Ajan Kurulu başlatma limiti aşıldı. Kısa süre sonra tekrar deneyin." }, { status: 429 });
    }

    try {
      const evidence = await buildEvidence(business, body.leadId, true);
      const deterministic = deriveDeterministicIntelligence(evidence);
      const evidenceFingerprint = computeEvidenceFingerprint(evidence, "level2");
      const councilFingerprint = computeAgentCouncilFingerprint(evidenceFingerprint);

      const existingRows = await supabaseRest<Array<Record<string, unknown>>>(
        `lead_intelligence_profiles?workspace_id=eq.${WORKSPACE_ID}&business_fingerprint=eq.${encodeURIComponent(businessFingerprint)}&select=*&limit=1`
      ).catch(() => []);
      const existing = existingRows[0];
      const existingCouncil = existing?.result && typeof existing.result === "object" ? (existing.result as Record<string, unknown>).agentCouncil as AgentCouncilResult | undefined : undefined;

      if (existingCouncil && !body.forceRefresh && existingCouncil.runMetadata.councilFingerprint === councilFingerprint && existingCouncil.chief.status === "completed") {
        await recordActivity({ session, action: "Görüntüleme", entity: "Ajan Kurulu", entityId: existing?.id as string, details: { event: "lead_agent_council_cache_hit", business: businessName } });
        return NextResponse.json({ profile: existing, fromCache: true, logicalAiCallCount: 0, agentCouncil: existingCouncil });
      }

      if (existingCouncil && !existingCouncil.runMetadata.completedAt) {
        const startedAt = Date.parse(existingCouncil.runMetadata.startedAt);
        if (Number.isFinite(startedAt) && Date.now() - startedAt < COUNCIL_PENDING_STALE_MS) {
          return NextResponse.json({ error: "Bu lead için Ajan Kurulu analizi zaten çalışıyor." }, { status: 409 });
        }
      }

      const baseResult = (existing?.result && typeof existing.result === "object" ? existing.result : deterministic) as Record<string, unknown>;
      const pendingShell = emptyAgentCouncilShell(evidenceFingerprint, councilFingerprint);
      await upsertProfile({
        workspace_id: WORKSPACE_ID, lead_id: body.leadId, google_place_id: business.googlePlaceId || null,
        business_fingerprint: businessFingerprint, business_name: businessName, sector: businessSector, city: businessCity, district: business.district || null,
        analysis_level: existing?.analysis_level || "level1", status: existing?.status || "completed",
        opportunity_score: existing?.opportunity_score ?? null, confidence: existing?.confidence ?? null, priority: existing?.priority ?? null,
        summary: existing?.summary ?? null, recommended_services: existing?.recommended_services ?? [], final_recommendation: existing?.final_recommendation ?? null, red_flags: existing?.red_flags ?? [],
        result: { ...baseResult, agentCouncil: pendingShell },
        evidence_fingerprint: existing?.evidence_fingerprint ?? null, schema_version: 1,
        ai_provider: existing?.ai_provider ?? null, ai_model: existing?.ai_model ?? null, ai_used: existing?.ai_used ?? false, error_message: null,
        updated_at: new Date().toISOString(), last_analyzed_at: existing?.last_analyzed_at ?? null
      });

      await recordActivity({ session, action: "Oluşturma", entity: "Ajan Kurulu", details: { event: "lead_agent_council_requested", business: businessName } });
      await recordActivity({ session, action: "Oluşturma", entity: "Ajan Kurulu", details: { event: "lead_agent_council_started", business: businessName } });

      const councilRun = await runAgentCouncil({ evidence, deterministic, createdBy: session.email || null }, executeAiTask);

      for (const [key, entry] of Object.entries(councilRun.specialists)) {
        await recordActivity({ session, action: entry.status === "completed" ? "Oluşturma" : "Oluşturma", entity: "Ajan Kurulu", details: { event: entry.status === "completed" ? "lead_agent_specialist_completed" : "lead_agent_specialist_failed", agent: key } }).catch(() => null);
      }

      if (!councilRun.ok) {
        await upsertProfile({
          workspace_id: WORKSPACE_ID, lead_id: body.leadId, google_place_id: business.googlePlaceId || null,
          business_fingerprint: businessFingerprint, business_name: businessName, sector: businessSector, city: businessCity, district: business.district || null,
          analysis_level: existing?.analysis_level || "level1", status: existing?.status || "completed",
          opportunity_score: existing?.opportunity_score ?? null, confidence: existing?.confidence ?? null, priority: existing?.priority ?? null,
          summary: existing?.summary ?? null, recommended_services: existing?.recommended_services ?? [], final_recommendation: existing?.final_recommendation ?? null, red_flags: existing?.red_flags ?? [],
          result: { ...baseResult, agentCouncil: { ...pendingShell, specialists: councilRun.specialists, chief: { status: "failed", result: null, error: councilRun.error }, runMetadata: { ...pendingShell.runMetadata, completedAt: new Date().toISOString(), logicalAiCallCount: councilRun.logicalAiCallCount, tokenUsage: councilRun.tokenUsage } } },
          evidence_fingerprint: existing?.evidence_fingerprint ?? null, schema_version: 1,
          ai_provider: existing?.ai_provider ?? null, ai_model: existing?.ai_model ?? null, ai_used: existing?.ai_used ?? false, error_message: councilRun.error,
          updated_at: new Date().toISOString(), last_analyzed_at: existing?.last_analyzed_at ?? null
        });
        await recordActivity({ session, action: "Oluşturma", entity: "Ajan Kurulu", details: { event: "lead_agent_council_failed", business: businessName, reason: councilRun.error } });
        return NextResponse.json({ error: councilRun.error }, { status: 502 });
      }

      const finalCouncil: AgentCouncilResult = {
        version: AGENT_COUNCIL_SCHEMA_VERSION,
        specialists: councilRun.specialists,
        chief: councilRun.chief,
        runMetadata: { startedAt: pendingShell.runMetadata.startedAt, completedAt: new Date().toISOString(), logicalAiCallCount: councilRun.logicalAiCallCount, provider: councilRun.provider, model: councilRun.model, evidenceFingerprint, councilFingerprint, tokenUsage: councilRun.tokenUsage }
      };

      const saved = await upsertProfile({
        workspace_id: WORKSPACE_ID, lead_id: body.leadId, google_place_id: business.googlePlaceId || null,
        business_fingerprint: businessFingerprint, business_name: businessName, sector: businessSector, city: businessCity, district: business.district || null,
        analysis_level: existing?.analysis_level || "level1", status: existing?.status || "completed",
        opportunity_score: existing?.opportunity_score ?? null, confidence: existing?.confidence ?? null, priority: existing?.priority ?? null,
        summary: existing?.summary ?? null, recommended_services: existing?.recommended_services ?? [], final_recommendation: existing?.final_recommendation ?? null, red_flags: existing?.red_flags ?? [],
        result: { ...baseResult, agentCouncil: finalCouncil },
        evidence_fingerprint: existing?.evidence_fingerprint ?? null, schema_version: 1,
        ai_provider: existing?.ai_provider ?? null, ai_model: existing?.ai_model ?? null, ai_used: existing?.ai_used ?? false, error_message: null,
        updated_at: new Date().toISOString(), last_analyzed_at: existing?.last_analyzed_at ?? null
      });

      await recordActivity({ session, action: "Oluşturma", entity: "Ajan Kurulu", entityId: saved.id as string, details: { event: "lead_agent_council_completed", business: businessName, logicalAiCallCount: councilRun.logicalAiCallCount } });

      return NextResponse.json({ profile: saved, fromCache: false, logicalAiCallCount: councilRun.logicalAiCallCount, agentCouncil: finalCouncil });
    } catch (error) {
      const safe = getSafeSupabaseError(error);
      console.error("[lead-intelligence] Ajan Kurulu hatası", safe.detail);
      await recordActivity({ session, action: "Oluşturma", entity: "Ajan Kurulu", details: { event: "lead_agent_council_failed", business: businessName } }).catch(() => null);
      return NextResponse.json({ error: safe.title || "Ajan Kurulu analizi başarısız oldu.", supabaseError: safe.detail }, { status: 500 });
    }
  }

  const analysisLevel: "level1" | "level2" = body.deep ? "level2" : "level1";

  try {
    const evidence = await buildEvidence(business, body.leadId, analysisLevel === "level2");
    const deterministic = deriveDeterministicIntelligence(evidence);
    const evidenceFingerprint = computeEvidenceFingerprint(evidence, analysisLevel);

    const existingRows = await supabaseRest<Array<Record<string, unknown>>>(
      `lead_intelligence_profiles?workspace_id=eq.${WORKSPACE_ID}&business_fingerprint=eq.${encodeURIComponent(businessFingerprint)}&select=*&limit=1`
    ).catch(() => []);
    const existing = existingRows[0];

    if (existing && !body.forceRefresh && existing.evidence_fingerprint === evidenceFingerprint) {
      await recordActivity({ session, action: "Görüntüleme", entity: "Müşteri İstihbarat Motoru", entityId: existing.id as string, details: { event: "lead_intelligence_cache_hit", business: businessName } });
      return NextResponse.json({ profile: existing, fromCache: true, aiUsed: Boolean(existing.ai_used), logicalAiCallCount: 0, backfilledFields: [] });
    }

    await recordActivity({ session, action: "Oluşturma", entity: "Müşteri İstihbarat Motoru", details: { event: "lead_intelligence_requested", business: businessName, level: analysisLevel } });

    const prompt = buildLeadIntelligencePrompt(evidence, deterministic);
    const generated = await executeAiTask({
      taskType: "strategy",
      module: "lead-intelligence",
      prompt,
      fallbackText: JSON.stringify(deterministic),
      createdBy: session.email || null
    }, { timeoutMs: 20_000 });

    const aiUsed = generated.provider !== "demo";
    const parsed = parseLeadIntelligenceJson(generated.text);
    const { result, backfilledFields } = validateLeadIntelligenceResult(parsed, deterministic);

    // Preserve any previously-run Agent Council alongside this fresh
    // Level 1/2 result — a new standard analysis must never silently
    // discard an existing, more expensive council run for the same lead.
    const previousCouncil = existing?.result && typeof existing.result === "object" ? (existing.result as Record<string, unknown>).agentCouncil : undefined;
    // Additive, loosely-typed observability envelope (kept OUTSIDE the
    // strict LeadIntelligenceResult shape so this never risks a regression
    // in the well-tested V1 validator/backfill logic) — real values only,
    // never estimated when the router doesn't report them.
    const meta = { mode: generated.mode, tokenUsage: aggregateTokenUsage([generated]), respondedAt: new Date().toISOString() };

    const row = {
      workspace_id: WORKSPACE_ID,
      lead_id: body.leadId || null,
      google_place_id: business.googlePlaceId || null,
      business_fingerprint: businessFingerprint,
      business_name: businessName,
      sector: businessSector,
      city: businessCity,
      district: business.district || null,
      analysis_level: analysisLevel,
      status: "completed",
      opportunity_score: (() => {
        const match = deterministic.summary.match(/(\d+)\/100/);
        return match ? Number(match[1]) : null;
      })(),
      confidence: result.confidence,
      priority: result.priority,
      summary: result.summary,
      recommended_services: result.specialists.growth.recommendedServices,
      final_recommendation: result.finalRecommendation,
      red_flags: result.redFlags,
      result: { ...result, meta, ...(previousCouncil ? { agentCouncil: previousCouncil } : {}) },
      evidence_fingerprint: evidenceFingerprint,
      schema_version: 1,
      ai_provider: generated.provider,
      ai_model: generated.model,
      ai_used: aiUsed,
      error_message: null,
      updated_at: new Date().toISOString(),
      last_analyzed_at: new Date().toISOString()
    };

    const saved = await upsertProfile(row);

    await recordActivity({ session, action: "Oluşturma", entity: "Müşteri İstihbarat Motoru", entityId: saved.id as string, details: { event: "lead_intelligence_completed", business: businessName, aiUsed, priority: result.priority } });

    return NextResponse.json({ profile: saved, fromCache: false, aiUsed, logicalAiCallCount: 1, backfilledFields });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    console.error("[lead-intelligence] Analiz hatası", safe.detail);
    await recordActivity({ session, action: "Oluşturma", entity: "Müşteri İstihbarat Motoru", details: { event: "lead_intelligence_failed", business: businessName } }).catch(() => null);
    return NextResponse.json({ error: safe.title || "Müşteri istihbarat analizi başarısız oldu.", supabaseError: safe.detail }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });

  const url = new URL(request.url);
  const leadId = url.searchParams.get("leadId");
  const googlePlaceId = url.searchParams.get("googlePlaceId");
  if (!leadId && !googlePlaceId) return NextResponse.json({ error: "leadId veya googlePlaceId gerekli." }, { status: 400 });

  const filter = leadId ? `lead_id=eq.${encodeURIComponent(leadId)}` : `google_place_id=eq.${encodeURIComponent(googlePlaceId as string)}`;
  const rows = await supabaseRest<Array<Record<string, unknown>>>(`lead_intelligence_profiles?workspace_id=eq.${WORKSPACE_ID}&${filter}&select=*&limit=1`).catch(() => []);
  return NextResponse.json({ profile: rows[0] || null });
}
