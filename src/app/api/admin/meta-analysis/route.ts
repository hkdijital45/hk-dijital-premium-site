import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";

function demoMetaResults(city: string, district: string, sector: string) {
  return [
    {
      id: "meta-demo-1",
      name: `${district} ${sector} Reklam Gözlemi`,
      active: true,
      activeStatus: "Aktif reklam sinyali",
      summary: `${sector} işletmeleri için mesaj, randevu ve hızlı teklif odaklı kreatifler öne çıkıyor. Kısa video ve carousel formatı test edilmeli.`,
      platform: "Facebook / Instagram",
      category: sector,
      cta: "Mesaj Gönder",
      startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString().slice(0, 10),
      adUrl: ""
    },
    {
      id: "meta-demo-2",
      name: `${city} Rakip İçerik Sinyali`,
      active: false,
      activeStatus: "Pasif / araştırma önerilir",
      summary: `Bölgedeki rakiplerin kampanya dili daha çok fiyat ve kampanya çağrısı üzerine. HK önerisi: güven, sosyal kanıt ve lokasyon avantajı birlikte anlatılmalı.`,
      platform: "Instagram",
      category: sector,
      cta: "Detay Al",
      startDate: "",
      adUrl: ""
    }
  ];
}

function normalizeMetaAd(ad: any, sector: string) {
  const snapshot = ad.snapshot || {};
  return {
    id: ad.id || ad.ad_archive_id || crypto.randomUUID(),
    name: ad.page_name || snapshot.page_name || "Meta reklam kaydı",
    active: String(ad.ad_delivery_stop_time || "").length === 0,
    activeStatus: ad.ad_delivery_stop_time ? "Yayını bitmiş" : "Aktif",
    summary: snapshot.body?.text || snapshot.title || ad.creative_body || "Reklam metni özeti alınamadı.",
    platform: Array.isArray(ad.publisher_platforms) ? ad.publisher_platforms.join(" / ") : "Facebook / Instagram",
    category: sector,
    cta: snapshot.cta_text || ad.cta_type || "",
    startDate: ad.ad_delivery_start_time || "",
    adUrl: ad.ad_snapshot_url || ""
  };
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("meta-analiz");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const city = String(body.city || "Manisa");
  const district = String(body.district || "Yunusemre");
  const sector = String(body.sector || "Restoran");
  const token = process.env.META_AD_LIBRARY_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;

  if (!token) {
    return NextResponse.json({
      warning: "Meta API bağlantısı bulunamadı. Demo sonuçlar gösteriliyor.",
      results: demoMetaResults(city, district, sector)
    });
  }

  try {
    const params = new URLSearchParams({
      access_token: token,
      ad_reached_countries: "TR",
      search_terms: `${sector} ${district} ${city}`,
      fields: "id,page_name,ad_delivery_start_time,ad_delivery_stop_time,ad_snapshot_url,publisher_platforms,creative_body,snapshot",
      limit: "12"
    });
    const response = await fetch(`https://graph.facebook.com/v20.0/ads_archive?${params}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      console.error("[meta-analysis] Meta API hatası", data);
      return NextResponse.json({
        warning: "Meta API bağlantısı bulunamadı. Demo sonuçlar gösteriliyor.",
        results: demoMetaResults(city, district, sector)
      });
    }
    const results = Array.isArray(data.data) ? data.data.map((item: any) => normalizeMetaAd(item, sector)) : [];
    return NextResponse.json({ results });
  } catch (error) {
    console.error("[meta-analysis] Analiz hatası", error);
    return NextResponse.json({ error: "Analiz sırasında bir hata oluştu." }, { status: 500 });
  }
}
