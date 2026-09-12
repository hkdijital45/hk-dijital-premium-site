import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { executeAiTask } from "@/lib/server/ai-router";
import {
  buildLeadIntelligencePrompt,
  computeBusinessFingerprint,
  computeEvidenceFingerprint,
  deriveDeterministicIntelligence,
  parseLeadIntelligenceJson,
  validateLeadIntelligenceResult,
  type LeadIntelligenceEvidence
} from "@/lib/lead-intelligence-schema";
import type { AdStatusValue } from "@/lib/lead-scoring";

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
};

/** Level 2 evidence enrichment: real other businesses already discovered/
 * saved in the same sector+city (the existing leads table — zero
 * additional Google Places API calls, zero new infrastructure). This is
 * the "reuse existing competitor/Places infrastructure" the market
 * analyst needs, without a live nearby-search burning API quota per
 * analysis. Only runs for manually-triggered deep analysis, never
 * automatically for every discovery result. */
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
  const analysisLevel: "level1" | "level2" = body.deep ? "level2" : "level1";

  try {
    let existingLeadStatus: string | null = null;
    if (body.leadId) {
      const leads = await supabaseRest<Array<{ status?: string; pipeline_stage?: string }>>(`leads?id=eq.${encodeURIComponent(body.leadId)}&select=status,pipeline_stage&limit=1`).catch(() => []);
      existingLeadStatus = leads[0]?.pipeline_stage || leads[0]?.status || null;
    }

    const peers = analysisLevel === "level2" ? (await fetchPeerContext(businessSector, businessCity, business.googlePlaceId)) ?? undefined : undefined;

    const evidence: LeadIntelligenceEvidence = {
      name: businessName,
      sector: businessSector,
      city: businessCity,
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

    const deterministic = deriveDeterministicIntelligence(evidence);
    const evidenceFingerprint = computeEvidenceFingerprint(evidence, analysisLevel);

    const existingRows = await supabaseRest<Array<Record<string, unknown>>>(
      `lead_intelligence_profiles?workspace_id=eq.${WORKSPACE_ID}&business_fingerprint=eq.${encodeURIComponent(businessFingerprint)}&select=*&limit=1`
    ).catch(() => []);
    const existing = existingRows[0];

    if (existing && !body.forceRefresh && existing.evidence_fingerprint === evidenceFingerprint) {
      await recordActivity({ session, action: "Görüntüleme", entity: "Müşteri İstihbarat Motoru", entityId: existing.id as string, details: { event: "lead_intelligence_cache_hit", business: businessName } });
      return NextResponse.json({ profile: existing, fromCache: true, aiUsed: Boolean(existing.ai_used), backfilledFields: [] });
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
      result,
      evidence_fingerprint: evidenceFingerprint,
      schema_version: 1,
      ai_provider: generated.provider,
      ai_model: generated.model,
      ai_used: aiUsed,
      error_message: null,
      updated_at: new Date().toISOString(),
      last_analyzed_at: new Date().toISOString()
    };

    const saved = await supabaseRest<Array<Record<string, unknown>>>("lead_intelligence_profiles?on_conflict=workspace_id,business_fingerprint", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([row])
    });

    await recordActivity({ session, action: "Oluşturma", entity: "Müşteri İstihbarat Motoru", entityId: saved[0]?.id as string, details: { event: "lead_intelligence_completed", business: businessName, aiUsed, priority: result.priority } });

    return NextResponse.json({ profile: saved[0] || row, fromCache: false, aiUsed, backfilledFields });
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
