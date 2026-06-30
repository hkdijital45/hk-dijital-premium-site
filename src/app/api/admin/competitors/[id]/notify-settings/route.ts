/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { buildActionResult } from "@/lib/action-result";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("rakip-analizi");
  if (!session) return NextResponse.json({ success: false, message: "Bildirim ayarı için yetki gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ success: false, message: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const settings = {
    system: body.system !== false,
    discord: Boolean(body.discord),
    emailDraft: Boolean(body.emailDraft),
    whatsappCopy: body.whatsappCopy !== false,
    notify_on_new_ads: Boolean(body.notify_on_new_ads),
    notify_on_post_change: Boolean(body.notify_on_post_change),
    notify_on_review_change: Boolean(body.notify_on_review_change),
    notify_on_website_change: Boolean(body.notify_on_website_change),
    notify_on_price_change: Boolean(body.notify_on_price_change)
  };
  try {
    await supabaseRest<any[]>(`competitor_watchlist?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        notification_settings: settings,
        notify_on_new_ads: settings.notify_on_new_ads,
        notify_on_price_change: settings.notify_on_price_change,
        notify_on_review_change: settings.notify_on_review_change,
        updated_at: new Date().toISOString()
      })
    });
    return NextResponse.json(buildActionResult({
      title: "Rakip bildirim ayarları güncellendi",
      summary: "Yeni reklam, paylaşım, yorum, web sitesi ve fiyat/kampanya değişimi bildirim tercihleri kaydedildi.",
      entityType: "Rakip",
      entityId: id,
      status: "success",
      createdRecords: [{ label: "Bildirim ayarı", count: 1, status: "Güncellendi" }],
      nextActions: ["Zamanı gelen kontrolleri çalıştır.", "WhatsApp özetini gerektiğinde kopyala."],
      checkLinks: [{ label: "Rakip Analizine Dön", href: "/hk-admin/rakip-analizi" }],
      customerVisibility: { showToCustomer: false, label: "Bildirim ayarları müşteriye gösterilmez." },
      technicalDetails: { competitorId: id, settings }
    }));
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json(buildActionResult({ title: "Bildirim ayarı kaydedilemedi", summary: safe.detail, status: "error", nextActions: ["Migration kolonlarını kontrol et.", "Tekrar dene."], technicalDetails: { error: safe.detail } }), { status: 500 });
  }
}
