/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { buildActionResult } from "@/lib/action-result";
import { discoverGoogleMapsCompetitors, enrichMetaAdSignals } from "@/lib/competitor-intelligence";
import { requireModuleAccess } from "@/lib/permissions";

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("rakip-analizi");
  if (!session) return NextResponse.json({ success: false, message: "Rakip keşfi için yetki gerekir." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const input = {
    companyName: String(body.companyName || ""),
    sector: String(body.sector || ""),
    niche: String(body.niche || ""),
    city: String(body.city || ""),
    district: String(body.district || ""),
    address: String(body.address || ""),
    website: String(body.website || ""),
    phone: String(body.phone || ""),
    branchName: String(body.branchName || ""),
    limit: numberValue(body.limit, 10),
    radius: String(body.radius || "5 km"),
    competitorType: String(body.competitorType || "all"),
    minimumRating: numberValue(body.minimumRating, 0),
    minimumReviewCount: numberValue(body.minimumReviewCount, 0),
    preferActiveAds: Boolean(body.preferActiveAds),
    preferWebsite: Boolean(body.preferWebsite),
    preferInstagram: Boolean(body.preferInstagram)
  };
  if (!input.sector || !input.city || !input.district) {
    return NextResponse.json(buildActionResult({
      title: "Rakip keşfi başlatılamadı",
      summary: "Rakip bulmak için sektör, il ve ilçe gerekli. Eksik bilgileri tamamlamak ister misin?",
      status: "warning",
      nextActions: ["Müşteri profilindeki sektör bilgisini kontrol et.", "İl ve ilçe bilgisini tamamla.", "Tekrar Google Maps’ten Rakip Bul butonunu kullan."],
      checkLinks: [{ label: "Müşteri Profilini Aç", href: "/hk-admin/musteriler" }]
    }), { status: 400 });
  }
  const maps = await discoverGoogleMapsCompetitors(input);
  const filtered = maps.results.filter((item: any) => {
    if (Number(item.google_rating || 0) < input.minimumRating) return false;
    if (Number(item.google_review_count || 0) < input.minimumReviewCount) return false;
    if (input.preferWebsite && !item.website_url) return false;
    if (input.preferInstagram && !item.instagram_url) return false;
    return true;
  });
  const meta = ["all", "meta", "instagram"].includes(input.competitorType) || input.preferActiveAds
    ? await enrichMetaAdSignals(filtered, input)
    : { source: "not_requested", warning: "", results: filtered };
  const results = meta.results
    .filter((item: any) => !input.preferActiveAds || item.active_ad_signal)
    .sort((a: any, b: any) => Number(b.competitor_score || 0) - Number(a.competitor_score || 0))
    .slice(0, input.limit);
  const warnings = [maps.warning, meta.warning].filter(Boolean);
  return NextResponse.json({
    success: true,
    message: "Rakip keşfi tamamlandı.",
    mode: maps.source === "google_maps" ? "real" : "fallback",
    dataSources: { googleMaps: maps.source, meta: meta.source },
    warnings,
    results,
    actionResult: {
      title: "Rakip keşfi tamamlandı",
      summary: `${input.city}/${input.district} bölgesinde ${input.sector} için ${results.length} rakip bulundu ve skorlandı.`,
      entityType: "Rakip Keşfi",
      status: "prepared",
      createdRecords: [{ label: "Bulunan rakip", count: results.length, status: maps.source === "google_maps" ? "Gerçek Google Maps verisi" : "Yedek akış" }],
      nextActions: ["En güçlü rakipleri incele.", "Seçilenleri rakip listesine kaydet.", "Müşteriye gönderilecek özeti kontrol et."],
      checkLinks: [{ label: "Rakip Analizine Dön", href: "/hk-admin/rakip-analizi" }],
      customerVisibility: { showToCustomer: false, label: "Keşif sonuçları kaydedilmeden müşteri paneline açılmaz." },
      technicalDetails: { dataSources: { googleMaps: maps.source, meta: meta.source }, warningCount: warnings.length }
    }
  });
}
