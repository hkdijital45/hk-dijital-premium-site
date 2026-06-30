/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { buildActionResult } from "@/lib/action-result";
import { buildCompetitorCustomerSummary, buildCompetitorInternalAnalysis, buildCompetitorSignals, competitorDisplayName, enrichCompetitorDiscoveryResult } from "@/lib/competitor-intelligence";
import { recordActivity } from "@/lib/activity-log";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("rakip-analizi");
  if (!session) return NextResponse.json({ success: false, message: "Rakip kontrolü için yetki gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ success: false, message: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const rows = await supabaseRest<any[]>(`competitor_watchlist?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    const current = rows[0];
    if (!current) return NextResponse.json({ success: false, message: "Rakip kaydı bulunamadı." }, { status: 404 });
    const customer = buildCompetitorCustomerSummary(current);
    const internal = buildCompetitorInternalAnalysis(current);
    const signals = buildCompetitorSignals(current);
    const scored = enrichCompetitorDiscoveryResult(current, { sector: current.sector, city: current.city, district: current.district });
    const now = new Date().toISOString();
    const signalRows = signals.map((signal) => ({
      ...signal,
      competitor_id: id,
      company_id: current.company_id,
      show_to_customer: Boolean(current.show_to_customer || current.show_customer_summary),
      customer_summary: customer.summary,
      customer_recommendations: customer.recommendations,
      customer_action_plan: customer.actionPlan,
      metadata: { mode: body.mode || "manual_check", source: "local-fallback" }
    }));
    await supabaseRest<any[]>("competitor_signals", { method: "POST", body: JSON.stringify(signalRows) }).catch(() => []);
    const patch = {
      last_checked_at: now,
      last_post_seen_at: now,
      last_review_count: Number(current.last_review_count || 0) + 1,
      last_price_signal: "Kampanya/fiyat değişimi manuel doğrulama bekliyor.",
      last_analysis_summary: `${competitorDisplayName(current)} için reklam, sosyal medya, Google yorum ve web sitesi sinyalleri kontrol edildi.`,
      customer_visible_summary: customer.summary,
      customer_summary: customer.summary,
      customer_recommendations: customer.recommendations,
      customer_action_plan: customer.actionPlan,
      internal_analysis: internal,
      competitor_score: scored.competitor_score,
      threat_score: scored.threat_score,
      opportunity_score: scored.opportunity_score,
      score_breakdown: scored.score_breakdown,
      score_reason: scored.score_reason,
      agency_decision: scored.agency_decision,
      recommended_actions: scored.recommended_actions,
      analysis_payload: { signals, generatedAt: now, source: "local-fallback", note: "Gerçek harici API entegrasyonu yoksa güvenli yerel kontrol sonucu üretilir." },
      updated_at: now
    };
    const updated = await supabaseRest<any[]>(`competitor_watchlist?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
    const competitor = updated[0] || { ...current, ...patch };
    await recordActivity({ session, action: "Rakip Kontrolü", entity: "Rakip", companyId: current.company_id, details: { message: `${competitorDisplayName(current)} kontrol edildi.`, competitorId: id } }).catch(() => null);
    return NextResponse.json(buildActionResult({
      title: "Rakip kontrolü tamamlandı",
      summary: `${competitorDisplayName(current)} için reklam, paylaşım, Google yorum, web sitesi ve fiyat/kampanya sinyalleri kontrol edildi.`,
      entityType: "Rakip",
      entityId: id,
      companyId: current.company_id,
      branchId: current.branch_id,
      status: "success",
      createdRecords: [{ label: "Rakip sinyali", count: signalRows.length, status: "Oluşturuldu" }, { label: "Müşteri özeti", count: 1, status: "Hazırlandı" }],
      nextActions: ["Müşteriye gönderilecek özeti düzenle.", "Gerekirse görev oluştur.", "WhatsApp özetini müşteriye göndermeden önce kontrol et."],
      checkLinks: [{ label: "Rakip Analizine Dön", href: "/hk-admin/rakip-analizi" }, { label: "Müşteri Profilini Aç", href: `/hk-admin/musteriler?companyId=${current.company_id}` }],
      customerVisibility: { showToCustomer: Boolean(competitor.show_to_customer || competitor.show_customer_summary), label: competitor.show_to_customer || competitor.show_customer_summary ? "Müşteri özeti müşteri panelinde görünür." : "Özet sadece admin tarafında görünüyor." },
      technicalDetails: { competitorId: id, signalCount: signalRows.length, source: "local-fallback" }
    }));
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json(buildActionResult({ title: "Rakip kontrolü tamamlanamadı", summary: safe.detail, status: "error", nextActions: ["Rakip kaydını kontrol et.", "competitor_signals migration durumunu kontrol et.", "Tekrar dene."], technicalDetails: { error: safe.detail } }), { status: 500 });
  }
}
