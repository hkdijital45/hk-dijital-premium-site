/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { buildActionResult } from "@/lib/action-result";
import { recordActivity } from "@/lib/activity-log";
import { buildCompetitorCustomerSummary, buildCompetitorInternalAnalysis, competitorDisplayName } from "@/lib/competitor-intelligence";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const allowedFields = [
  "company_id", "branch_id", "competitor_name", "website_url", "instagram_url", "google_maps_url",
  "meta_ad_library_url", "sector", "city", "district", "address", "status", "monitoring_frequency",
  "notify_on_new_ads", "notify_on_price_change", "notify_on_review_change", "show_to_customer",
  "show_customer_summary", "customer_summary", "customer_recommendations", "customer_action_plan"
];

function sanitize(body: Record<string, any>) {
  const row: Record<string, any> = {};
  allowedFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) row[field] = body[field];
  });
  row.competitor_name = row.competitor_name || body.name || "Yeni rakip";
  row.status = row.status || "active";
  row.monitoring_frequency = row.monitoring_frequency || "weekly";
  row.updated_at = new Date().toISOString();
  if (!row.customer_summary) {
    const customer = buildCompetitorCustomerSummary(row);
    row.customer_summary = customer.summary;
    row.customer_recommendations = customer.recommendations;
    row.customer_action_plan = customer.actionPlan;
  }
  row.internal_analysis = buildCompetitorInternalAnalysis(row);
  return row;
}

export async function GET(request: Request) {
  const session = await requireModuleAccess("rakip-analizi");
  if (!session) return NextResponse.json({ success: false, message: "Rakip analizi yetkisi gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ success: true, competitors: [], message: "Supabase bağlantısı yapılandırılmadı." });
  const url = new URL(request.url);
  const filters = [
    "select=*",
    "order=updated_at.desc"
  ];
  const companyId = url.searchParams.get("companyId");
  const branchId = url.searchParams.get("branchId");
  const status = url.searchParams.get("status");
  const visible = url.searchParams.get("visible");
  if (companyId) filters.push(`company_id=eq.${encodeURIComponent(companyId)}`);
  if (branchId) filters.push(`branch_id=eq.${encodeURIComponent(branchId)}`);
  if (status && status !== "all") filters.push(`status=eq.${encodeURIComponent(status)}`);
  if (visible === "true") filters.push("show_to_customer=eq.true");
  try {
    const competitors = await supabaseRest<any[]>(`competitor_watchlist?${filters.join("&")}`);
    return NextResponse.json({ success: true, competitors });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ success: false, message: safe.detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("rakip-analizi");
  if (!session) return NextResponse.json({ success: false, message: "Rakip kaydetmek için yetki gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ success: false, message: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  try {
    const row = sanitize(body);
    const created = await supabaseRest<any[]>("competitor_watchlist", { method: "POST", body: JSON.stringify(row) });
    const competitor = created[0] || row;
    await recordActivity({ session, action: "Rakip Kaydı", entity: "Rakip", companyId: competitor.company_id, details: { message: `${competitorDisplayName(competitor)} rakip listesine eklendi.` } }).catch(() => null);
    return NextResponse.json(buildActionResult({
      title: "Rakip kaydı oluşturuldu",
      summary: `${competitorDisplayName(competitor)} rakip listesine eklendi. Artık reklam, paylaşım, yorum ve fiyat/kampanya sinyalleri izlenebilir.`,
      entityType: "Rakip",
      entityId: competitor.id,
      companyId: competitor.company_id,
      branchId: competitor.branch_id,
      status: "success",
      createdRecords: [{ label: "Rakip kaydı", count: 1, status: "Oluşturuldu", href: "/hk-admin/rakip-analizi" }],
      nextActions: ["Rakibi kontrol et.", "Bildirim ayarlarını aç.", "Müşteriye gösterilecek sade özeti gözden geçir."],
      checkLinks: [{ label: "Rakip Analizine Dön", href: "/hk-admin/rakip-analizi" }, { label: "Müşteri Profilini Aç", href: `/hk-admin/musteriler?companyId=${competitor.company_id || ""}` }],
      customerVisibility: { showToCustomer: Boolean(competitor.show_to_customer || competitor.show_customer_summary), label: competitor.show_to_customer ? "Bu rakip müşteriye açık." : "Bu rakip şu anda sadece admin tarafında görünüyor." },
      technicalDetails: { competitorId: competitor.id }
    }));
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json(buildActionResult({ title: "Rakip kaydı oluşturulamadı", summary: safe.detail, status: "error", nextActions: ["Zorunlu müşteri ve rakip adı alanlarını kontrol et.", "Migration dosyasının yüklendiğinden emin ol."], technicalDetails: { error: safe.detail } }), { status: 500 });
  }
}
