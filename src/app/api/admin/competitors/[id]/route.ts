/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { buildActionResult } from "@/lib/action-result";
import { competitorDisplayName } from "@/lib/competitor-intelligence";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const allowedFields = [
  "competitor_name", "website_url", "instagram_url", "google_maps_url", "meta_ad_library_url",
  "sector", "city", "district", "address", "status", "monitoring_frequency",
  "notify_on_new_ads", "notify_on_price_change", "notify_on_review_change", "notify_on_website_change",
  "show_to_customer", "show_customer_summary", "customer_summary", "customer_recommendations",
  "customer_action_plan", "customer_visible_summary", "last_analysis_summary",
  "google_place_id", "google_rating", "google_review_count", "phone", "category", "latitude", "longitude",
  "competitor_score", "threat_score", "opportunity_score", "score_breakdown", "score_reason",
  "agency_decision", "recommended_actions", "discovery_source", "discovery_query", "maps_raw", "meta_raw",
  "last_maps_checked_at", "last_meta_checked_at", "last_ad_seen_at"
];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("rakip-analizi");
  if (!session) return NextResponse.json({ success: false, message: "Rakip güncellemek için yetki gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ success: false, message: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  allowedFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) patch[field] = body[field];
  });
  try {
    const rows = await supabaseRest<any[]>(`competitor_watchlist?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
    const competitor = rows[0] || { id, ...patch };
    return NextResponse.json(buildActionResult({
      title: "Rakip kaydı güncellendi",
      summary: `${competitorDisplayName(competitor)} bilgileri güncellendi.`,
      entityType: "Rakip",
      entityId: id,
      companyId: competitor.company_id,
      branchId: competitor.branch_id,
      status: "success",
      createdRecords: [{ label: "Rakip kaydı", count: 1, status: "Güncellendi" }],
      nextActions: ["Rakip kontrolü çalıştır.", "Müşteri özetinin güncel olduğundan emin ol."],
      checkLinks: [{ label: "Rakip Analizine Dön", href: "/hk-admin/rakip-analizi" }],
      customerVisibility: { showToCustomer: Boolean(competitor.show_to_customer || competitor.show_customer_summary), label: competitor.show_to_customer || competitor.show_customer_summary ? "Müşteri görünürlüğü açık." : "Sadece admin tarafında görünüyor." },
      technicalDetails: { competitorId: id, patch }
    }));
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json(buildActionResult({ title: "Rakip güncellenemedi", summary: safe.detail, status: "error", nextActions: ["Alanları kontrol et.", "Migration kolonlarının yüklendiğinden emin ol."], technicalDetails: { error: safe.detail } }), { status: 500 });
  }
}
