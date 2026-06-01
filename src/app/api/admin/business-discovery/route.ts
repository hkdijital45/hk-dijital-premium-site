import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { scoreDiscoveredBusiness, type DiscoveredBusiness } from "@/lib/lead-scoring";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

async function requireStaff() {
  const session = await getSession();
  return isStaffRole(session?.role) ? session : null;
}

function textSearchUrl(query: string) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("Google Maps API anahtarı eksik.");
  const params = new URLSearchParams({ query, key, language: "tr", region: "tr" });
  return `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`;
}

async function getPlaceDetails(placeId: string) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("Google Maps API anahtarı eksik.");
  const params = new URLSearchParams({
    place_id: placeId,
    fields: "formatted_phone_number,website",
    key,
    language: "tr"
  });
  const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`, { cache: "no-store" });
  if (!response.ok) return {};
  const data = await response.json();
  return data.result || {};
}

export async function POST(request: Request) {
  if (!(await requireStaff())) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!process.env.GOOGLE_MAPS_API_KEY) return NextResponse.json({ error: "Google Maps API anahtarı eksik." }, { status: 503 });

  const body = await request.json();
  const keyword = String(body.keyword || "").trim();
  const city = String(body.city || "").trim();
  const district = String(body.district || "").trim();
  const sector = String(body.sector || "").trim();
  if (!keyword && !sector) return NextResponse.json({ error: "Anahtar kelime veya sektör girin." }, { status: 400 });
  if (!city) return NextResponse.json({ error: "Şehir seçin veya yazın." }, { status: 400 });

  const query = [keyword, sector, district, city].filter(Boolean).join(" ");
  try {
    const response = await fetch(textSearchUrl(query), { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !["OK", "ZERO_RESULTS"].includes(data.status)) {
      console.error("[business-discovery] Google Maps arama hatası", { status: data.status, error: data.error_message });
      return NextResponse.json({ error: data.error_message || "Google Maps işletme araması başarısız oldu." }, { status: 502 });
    }
    const baseResults = (data.results || []).slice(0, 12);
    const businesses = await Promise.all(baseResults.map(async (place: any) => {
      const details = await getPlaceDetails(place.place_id).catch(() => ({}));
      return {
        name: place.name,
        address: place.formatted_address || "",
        phone: details.formatted_phone_number || "",
        website: details.website || "",
        googleRating: place.rating ?? null,
        reviewCount: Number(place.user_ratings_total || 0),
        placeId: place.place_id,
        category: Array.isArray(place.types) ? place.types.slice(0, 3).join(", ") : sector
      };
    }));
    return NextResponse.json({ businesses, count: businesses.length });
  } catch (error) {
    console.error("[business-discovery] İşletme araması çöktü", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "İşletme araması başarısız oldu." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı. Canlı ortamda kaydetme çalışmaz." }, { status: 503 });

  const body = await request.json();
  const businesses = Array.isArray(body.businesses) ? body.businesses : [];
  if (!businesses.length) return NextResponse.json({ error: "Kaydedilecek işletme seçin." }, { status: 400 });

  try {
    const existing = await supabaseRest<Array<{ google_place_id?: string }>>("leads?select=google_place_id&google_place_id=not.is.null");
    const knownPlaceIds = new Set(existing.map((lead) => lead.google_place_id).filter(Boolean));
    const rows = businesses.filter((business: DiscoveredBusiness) => !business.placeId || !knownPlaceIds.has(business.placeId)).map((business: DiscoveredBusiness) => {
      const scores = scoreDiscoveredBusiness(business);
      return {
        source: "Müşteri Bulucu",
        company: business.name || "",
        phone: business.phone || "",
        website: business.website || "",
        business_type: business.category || body.sector || "",
        address: business.address || "",
        google_rating: business.googleRating ?? null,
        google_review_count: Number(business.reviewCount || 0),
        google_place_id: business.placeId || "",
        digital_maturity_score: scores.digitalMaturityScore,
        lead_heat_score: scores.leadHeatScore,
        notes: [body.notes, "Google Maps işletme keşfi ile kaydedildi."].filter(Boolean).join("\n"),
        status: "Yeni"
      };
    });
    if (!rows.length) return NextResponse.json({ leads: [], count: 0, skipped: businesses.length, message: "Seçilen işletmeler daha önce CRM listesine eklenmiş." });
    const leads = await supabaseRest<any[]>("leads", { method: "POST", body: JSON.stringify(rows) });
    await recordActivity({ session, action: "Oluşturma", entity: "Müşteri Bulucu", details: { message: `${leads.length} işletme CRM listesine eklendi`, count: leads.length } });
    return NextResponse.json({ leads, count: leads.length, skipped: businesses.length - leads.length, message: `${leads.length} işletme CRM listesine eklendi.` });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    console.error("[business-discovery] Lead kayıt hatası", safe.detail);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}
