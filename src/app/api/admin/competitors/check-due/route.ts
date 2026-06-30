/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { buildActionResult } from "@/lib/action-result";
import { buildCompetitorSignals, enrichCompetitorDiscoveryResult, isCompetitorDue } from "@/lib/competitor-intelligence";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function POST() {
  const session = await requireModuleAccess("rakip-analizi");
  if (!session) return NextResponse.json({ success: false, message: "Rakip kontrol kuyruğu için yetki gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ success: false, message: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  try {
    const rows = await supabaseRest<any[]>("competitor_watchlist?status=neq.passive&select=*&order=last_checked_at.asc");
    const due = rows.filter((item) => isCompetitorDue(item));
    const now = new Date().toISOString();
    const updatedIds: string[] = [];
    let signalCount = 0;
    for (const item of due.slice(0, 25)) {
      const scored = enrichCompetitorDiscoveryResult(item, { sector: item.sector, city: item.city, district: item.district });
      const signals = buildCompetitorSignals(scored).map((signal) => ({
        ...signal,
        competitor_id: item.id,
        company_id: item.company_id || null,
        show_to_customer: Boolean(item.show_to_customer || item.show_customer_summary),
        customer_summary: scored.customer_summary,
        customer_recommendations: scored.customer_recommendations || [],
        customer_action_plan: scored.customer_action_plan || [],
        metadata: { checkMode: "due_check", competitor_score: scored.competitor_score, threat_score: scored.threat_score, opportunity_score: scored.opportunity_score }
      }));
      await supabaseRest<any[]>("competitor_signals", { method: "POST", body: JSON.stringify(signals) }).catch(() => []);
      signalCount += signals.length;
      await supabaseRest<any[]>(`competitor_watchlist?id=eq.${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          competitor_score: scored.competitor_score,
          threat_score: scored.threat_score,
          opportunity_score: scored.opportunity_score,
          score_breakdown: scored.score_breakdown,
          score_reason: scored.score_reason,
          agency_decision: scored.agency_decision,
          recommended_actions: scored.recommended_actions,
          customer_summary: scored.customer_summary,
          customer_recommendations: scored.customer_recommendations,
          customer_action_plan: scored.customer_action_plan,
          last_checked_at: now,
          last_maps_checked_at: now,
          last_meta_checked_at: now,
          updated_at: now
        })
      }).catch(() => []);
      updatedIds.push(item.id);
    }
    return NextResponse.json(buildActionResult({
      title: "Rakip kontrol kuyruğu çalıştırıldı",
      summary: `${due.length} rakip izleme kaydı değerlendirildi; ${updatedIds.length} kayıt skorlandı ve ${signalCount} takip sinyali hazırlandı.`,
      entityType: "Rakip Kontrol Kuyruğu",
      status: "success",
      createdRecords: [
        { label: "Kontrol edilen rakip", count: updatedIds.length, status: "Güncellendi" },
        { label: "Rakip sinyali", count: signalCount, status: "Oluşturuldu" }
      ],
      nextActions: ["Yeni sinyalleri kontrol et.", "Müşteriye gösterilecek özeti gerekiyorsa aç.", "Yüksek tehdit skorlarını görev veya rapora dönüştür."],
      checkLinks: [{ label: "Rakip Analizine Dön", href: "/hk-admin/rakip-analizi" }],
      customerVisibility: { showToCustomer: false, label: "Kontrol kuyruğu admin operasyon bilgisidir." },
      technicalDetails: { dueIds: due.map((item) => item.id), updatedIds }
    }));
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json(buildActionResult({ title: "Kontrol kuyruğu hazırlanamadı", summary: safe.detail, status: "error", nextActions: ["competitor_watchlist migration durumunu kontrol et.", "Tekrar dene."], technicalDetails: { error: safe.detail } }), { status: 500 });
  }
}
