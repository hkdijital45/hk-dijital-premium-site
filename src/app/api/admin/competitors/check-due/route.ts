/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { buildActionResult } from "@/lib/action-result";
import { isCompetitorDue } from "@/lib/competitor-intelligence";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function POST() {
  const session = await requireModuleAccess("rakip-analizi");
  if (!session) return NextResponse.json({ success: false, message: "Rakip kontrol kuyruğu için yetki gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ success: false, message: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  try {
    const rows = await supabaseRest<any[]>("competitor_watchlist?status=neq.passive&select=*&order=last_checked_at.asc");
    const due = rows.filter((item) => isCompetitorDue(item));
    return NextResponse.json(buildActionResult({
      title: "Rakip kontrol kuyruğu hazırlandı",
      summary: `${due.length} rakip izleme kaydı kontrol için hazır görünüyor.`,
      entityType: "Rakip Kontrol Kuyruğu",
      status: "prepared",
      createdRecords: [{ label: "Kontrol edilecek rakip", count: due.length, status: "Hazırlandı" }],
      nextActions: ["Zamanı gelen rakipleri kontrol et.", "Yeni sinyal oluşursa müşteriye gönderilecek özeti güncelle.", "Bildirim ayarlarını gözden geçir."],
      checkLinks: [{ label: "Rakip Analizine Dön", href: "/hk-admin/rakip-analizi" }],
      customerVisibility: { showToCustomer: false, label: "Kontrol kuyruğu admin operasyon bilgisidir." },
      technicalDetails: { dueIds: due.map((item) => item.id) }
    }));
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json(buildActionResult({ title: "Kontrol kuyruğu hazırlanamadı", summary: safe.detail, status: "error", nextActions: ["competitor_watchlist migration durumunu kontrol et.", "Tekrar dene."], technicalDetails: { error: safe.detail } }), { status: 500 });
  }
}
