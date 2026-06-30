/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { buildActionResult } from "@/lib/action-result";
import { buildCompetitorCustomerSummary, buildCompetitorInternalAnalysis } from "@/lib/competitor-intelligence";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const writableFields = [
  "company_id", "branch_id", "competitor_name", "website_url", "instagram_url", "google_maps_url",
  "meta_ad_library_url", "sector", "city", "district", "address", "status", "monitoring_frequency",
  "notify_on_new_ads", "notify_on_price_change", "notify_on_review_change", "notify_on_website_change",
  "show_to_customer", "show_customer_summary", "customer_summary", "customer_recommendations",
  "customer_action_plan", "customer_visible_summary", "last_analysis_summary", "google_place_id",
  "google_rating", "google_review_count", "phone", "category", "latitude", "longitude",
  "competitor_score", "threat_score", "opportunity_score", "score_breakdown", "score_reason",
  "agency_decision", "recommended_actions", "discovery_source", "discovery_query", "maps_raw", "meta_raw",
  "last_maps_checked_at", "last_meta_checked_at", "last_ad_seen_at", "is_tracking", "archived_at",
  "deleted_at", "last_signal_at", "next_check_at", "notification_channels"
];

function nextCheckAt(frequency = "weekly") {
  const date = new Date();
  const days = frequency === "daily" ? 1 : frequency === "monthly" ? 30 : frequency === "biweekly" ? 14 : 7;
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function sanitizeCompetitor(body: Record<string, any>, defaults: Record<string, any>) {
  const row: Record<string, any> = {};
  writableFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) row[field] = body[field];
  });
  row.company_id = row.company_id || defaults.company_id || null;
  row.branch_id = row.branch_id || defaults.branch_id || null;
  row.competitor_name = row.competitor_name || body.name || "Rakip işletme";
  row.status = row.status || "active";
  row.monitoring_frequency = row.monitoring_frequency || "weekly";
  row.is_tracking = Boolean(row.is_tracking || defaults.is_tracking);
  row.show_to_customer = Boolean(row.show_to_customer || defaults.show_to_customer);
  row.show_customer_summary = Boolean(row.show_customer_summary || defaults.show_customer_summary);
  row.notify_on_new_ads = Boolean(row.notify_on_new_ads || defaults.notify);
  row.notify_on_review_change = Boolean(row.notify_on_review_change || defaults.notify);
  row.notify_on_price_change = Boolean(row.notify_on_price_change || defaults.notify);
  if (row.is_tracking && !row.next_check_at) row.next_check_at = nextCheckAt(row.monitoring_frequency);
  if (row.is_tracking && !row.notification_channels) row.notification_channels = ["system"];
  if (!row.customer_summary) {
    const customer = buildCompetitorCustomerSummary(row);
    row.customer_summary = customer.summary;
    row.customer_recommendations = customer.recommendations;
    row.customer_action_plan = customer.actionPlan;
  }
  row.internal_analysis = buildCompetitorInternalAnalysis(row);
  row.updated_at = new Date().toISOString();
  return row;
}

function patchForAction(action: string, payload: Record<string, any>) {
  const now = new Date().toISOString();
  if (action === "track") return { is_tracking: true, status: "active", next_check_at: nextCheckAt(payload.monitoring_frequency || "weekly"), monitoring_frequency: payload.monitoring_frequency || "weekly", notification_channels: payload.notification_channels || ["system"], updated_at: now };
  if (action === "untrack") return { is_tracking: false, updated_at: now };
  if (action === "show_to_customer") return { show_to_customer: true, show_customer_summary: true, updated_at: now };
  if (action === "hide_from_customer") return { show_to_customer: false, show_customer_summary: false, updated_at: now };
  if (action === "archive") return { status: "archived", archived_at: now, updated_at: now };
  if (action === "passive") return { status: "passive", updated_at: now };
  if (action === "delete") return { status: "deleted", deleted_at: now, updated_at: now };
  if (action === "enable_notifications") return { notify_on_new_ads: true, notify_on_review_change: true, notify_on_price_change: true, is_tracking: true, notification_channels: payload.notification_channels || ["system"], next_check_at: nextCheckAt(payload.monitoring_frequency || "weekly"), updated_at: now };
  if (action === "disable_notifications") return { notify_on_new_ads: false, notify_on_review_change: false, notify_on_price_change: false, notification_channels: [], updated_at: now };
  if (action === "create_summary") return { show_customer_summary: Boolean(payload.show_to_customer), updated_at: now };
  return { updated_at: now };
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("rakip-analizi");
  if (!session) return NextResponse.json({ success: false, message: "Toplu rakip işlemi için yetki gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ success: false, message: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  const competitorIds = Array.isArray(body.competitorIds) ? body.competitorIds.filter(Boolean) : [];
  const competitors = Array.isArray(body.competitors) ? body.competitors : [];
  const payload = body.payload || {};

  try {
    if (action === "save") {
      const defaults = {
        company_id: body.companyId || null,
        branch_id: body.branchId || null,
        is_tracking: Boolean(payload.track),
        show_to_customer: Boolean(payload.showToCustomer),
        show_customer_summary: Boolean(payload.showToCustomer),
        notify: Boolean(payload.notify)
      };
      const rows = competitors.map((item: any) => sanitizeCompetitor(item, defaults));
      const created = rows.length ? await supabaseRest<any[]>("competitor_watchlist", { method: "POST", body: JSON.stringify(rows) }) : [];
      return NextResponse.json(buildActionResult({
        title: "Rakipler kaydedildi",
        summary: `${created.length || rows.length} rakip seçili müşteri için rakip listesine eklendi.`,
        entityType: "Rakip Toplu İşlem",
        companyId: body.companyId || rows[0]?.company_id,
        branchId: body.branchId || rows[0]?.branch_id,
        status: "success",
        createdRecords: [{ label: "Rakip kaydı", count: created.length || rows.length, status: "Oluşturuldu", href: "/hk-admin/rakip-analizi" }],
        nextActions: ["Takip ayarlarını kontrol et.", "Yeni sinyalleri düzenli izle.", "Müşteriye gönderilecek özeti hazırla."],
        checkLinks: [{ label: "Rakip Analizine Dön", href: "/hk-admin/rakip-analizi" }, { label: "Müşteri Profilini Aç", href: `/hk-admin/musteriler?companyId=${body.companyId || rows[0]?.company_id || ""}` }],
        customerVisibility: { showToCustomer: Boolean(payload.showToCustomer), label: payload.showToCustomer ? "Seçili rakipler müşteriye açık." : "Seçili rakipler sadece admin tarafında görünüyor." },
        technicalDetails: { createdIds: created.map((item) => item.id), action }
      }));
    }

    if (!competitorIds.length) {
      return NextResponse.json(buildActionResult({ title: "Seçili rakip yok", summary: "Toplu işlem için en az bir kayıtlı rakip seçmelisin.", status: "warning", nextActions: ["Rakip listesinden kayıt seç.", "Toplu işlemi tekrar çalıştır."] }), { status: 400 });
    }

    const patch = patchForAction(action, payload);
    await Promise.all(competitorIds.map((id: string) => supabaseRest<any[]>(`competitor_watchlist?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) }).catch(() => [])));
    const actionLabel = {
      track: "izlemeye alındı",
      untrack: "takibi kapatıldı",
      show_to_customer: "müşteriye açıldı",
      hide_from_customer: "müşteriden gizlendi",
      archive: "arşivlendi",
      passive: "pasife alındı",
      delete: "silindi olarak işaretlendi",
      enable_notifications: "bildirimleri açıldı",
      disable_notifications: "bildirimleri kapatıldı",
      create_summary: "müşteri özeti hazırlandı",
      create_task: "görev taslağı hazırlandı",
      export_csv: "CSV dışa aktarım hazırlandı"
    }[action] || "güncellendi";

    return NextResponse.json(buildActionResult({
      title: "Toplu rakip işlemi tamamlandı",
      summary: `${competitorIds.length} rakip için ${actionLabel}.`,
      entityType: "Rakip Toplu İşlem",
      status: action === "create_task" || action === "export_csv" ? "prepared" : "success",
      createdRecords: [{ label: "Etkilenen rakip", count: competitorIds.length, status: "Güncellendi" }],
      nextActions: ["Takip edilen rakipler panelini kontrol et.", "Yeni sinyal oluştuysa görev veya müşteri notuna dönüştür.", "Müşteriye gösterim durumunu doğrula."],
      checkLinks: [{ label: "Rakip Analizine Dön", href: "/hk-admin/rakip-analizi" }, { label: "Görevleri Gör", href: "/hk-admin/gorevler" }],
      customerVisibility: { showToCustomer: action === "show_to_customer", label: action === "show_to_customer" ? "Seçili rakipler müşteriye açık." : "Müşteri görünürlüğü işlem sonucuna göre güncellendi." },
      technicalDetails: { competitorIds, action, patch }
    }));
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json(buildActionResult({ title: "Toplu rakip işlemi tamamlanamadı", summary: safe.detail, status: "error", nextActions: ["Migration kolonlarının yüklü olduğundan emin ol.", "Tekrar dene."], technicalDetails: { error: safe.detail, action } }), { status: 500 });
  }
}
