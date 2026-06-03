import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { scoreDiscoveredBusiness } from "@/lib/lead-scoring";

const allowedSources = new Set(["Meta Analiz", "Google Ads Analiz", "Sosyal Medya Denetimi", "Sosyal İstihbarat Merkezi"]);

function clean(value: unknown) {
  return String(value || "").trim();
}

function firstUrl(links: any = {}) {
  return clean(links.metaAdLibrary || links.googleSearch || links.googleMaps || links.website || links.sourceUrl);
}

function buildNotes(body: any) {
  const links = body.links || {};
  const platforms = Array.isArray(body.platforms) ? body.platforms.map((item: any) => `${clean(item.platform)}: ${clean(item.username || item.profileUrl || item.profileImageUrl)}`).filter(Boolean).join(", ") : "";
  return [
    `Arama kaynağı: ${clean(body.source) || "-"}`,
    `Seçim: ${clean(body.city) || "-"} / ${clean(body.district) || "-"} / ${clean(body.sector) || "-"}`,
    `Platform: ${platforms || clean(body.platform) || "-"}`,
    body.leadScore ? `Lead Score: ${body.leadScore}/100 (${clean(body.leadTemperature) || "-"})` : "",
    body.profileImageUrl ? `Profil görseli: ${clean(body.profileImageUrl)}` : "",
    `Özet: ${clean(body.summary) || "-"}`,
    `AI fırsat notu: ${clean(body.aiNote) || clean(body.opportunityNote) || "-"}`,
    links.metaAdLibrary ? `Meta Ad Library: ${links.metaAdLibrary}` : "",
    links.googleMaps ? `Google Maps: ${links.googleMaps}` : "",
    links.googleSearch ? `Google arama: ${links.googleSearch}` : "",
    links.website ? `Website: ${links.website}` : ""
  ].filter(Boolean).join("\n");
}

async function duplicateExists(record: Record<string, any>) {
  const checks = [
    record.website ? `website=eq.${encodeURIComponent(record.website)}` : "",
    record.phone ? `phone=eq.${encodeURIComponent(record.phone)}` : "",
    record.email ? `email=eq.${encodeURIComponent(record.email)}` : "",
    record.google_place_id ? `google_place_id=eq.${encodeURIComponent(record.google_place_id)}` : ""
  ].filter(Boolean);

  for (const query of checks) {
    const rows = await supabaseRest<Array<{ id: string }>>(`leads?select=id&${query}&limit=1`);
    if (rows.length) return true;
  }

  if (record.company && record.source) {
    const rows = await supabaseRest<Array<{ id: string }>>(
      `leads?select=id&company=eq.${encodeURIComponent(record.company)}&source=eq.${encodeURIComponent(record.source)}&limit=1`
    );
    if (rows.length) return true;
  }

  return false;
}

function stripOptionalAnalysisColumns(record: Record<string, any>) {
  const fallback = { ...record };
  delete fallback.city;
  delete fallback.district;
  delete fallback.sector;
  delete fallback.source_url;
  return fallback;
}

export async function POST(request: Request) {
  const session = await (requireModuleAccess("crm") || requireModuleAccess("leads"));
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const source = clean(body.source);
  if (!allowedSources.has(source)) return NextResponse.json({ error: "Geçersiz analiz kaynağı." }, { status: 400 });

  const company = clean(body.businessName || body.pageName || body.name || body.company_name || body.company);
  if (!company) return NextResponse.json({ error: "İşletme adı zorunludur." }, { status: 400 });

  const website = clean(body.website);
  const phone = clean(body.phone);
  const email = clean(body.email);
  const address = clean(body.address);
  const googleRating = body.googleRating ?? body.google_rating ?? null;
  const googleReviewCount = Number(body.googleReviewCount ?? body.google_review_count ?? 0);
  const googlePlaceId = clean(body.googlePlaceId || body.google_place_id || body.placeId);
  const scores = scoreDiscoveredBusiness({
    name: company,
    website,
    phone,
    address,
    googleRating,
    reviewCount: googleReviewCount,
    placeId: googlePlaceId,
    category: clean(body.sector)
  });
  const leadScore = Number(body.leadScore || 0);

  const record = {
    source,
    name: company,
    company,
    phone,
    email,
    website,
    business_type: clean(body.sector),
    city: clean(body.city),
    district: clean(body.district),
    sector: clean(body.sector),
    status: "Yeni",
    message: clean(body.summary),
    notes: buildNotes(body),
    address,
    google_rating: googleRating === null || googleRating === "" ? null : Number(googleRating),
    google_review_count: googleReviewCount,
    google_place_id: googlePlaceId,
    source_url: firstUrl(body.links),
    digital_maturity_score: scores.digitalMaturityScore,
    lead_heat_score: leadScore > 0 ? Math.max(0, Math.min(100, leadScore)) : scores.leadHeatScore,
    local_opportunity_notes: clean(body.aiNote) || clean(body.opportunityNote),
    ai_analysis: {},
    proposal_history: []
  };

  try {
    if (await duplicateExists(record)) {
      return NextResponse.json({ error: "Bu kayıt CRM’de zaten var.", duplicate: true }, { status: 409 });
    }

    let rows;
    try {
      rows = await supabaseRest<any[]>("leads", { method: "POST", body: JSON.stringify(record) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("schema cache") && !message.includes("column")) throw error;
      rows = await supabaseRest<any[]>("leads", { method: "POST", body: JSON.stringify(stripOptionalAnalysisColumns(record)) });
    }

    await recordActivity({
      session,
      action: "Oluşturma",
      entity: "Başvuru",
      entityId: rows?.[0]?.id,
      details: { message: `${source} sonucu CRM'e kaydedildi`, source, company }
    });

    return NextResponse.json({ ok: true, lead: rows?.[0] || record, message: "Kayıt CRM’e eklendi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    console.error("[analysis-to-crm] Kayıt hatası", safe.detail);
    return NextResponse.json({ error: "Kayıt CRM’e eklenirken hata oluştu.", supabaseError: safe.detail }, { status: 500 });
  }
}
