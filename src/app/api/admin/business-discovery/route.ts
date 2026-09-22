import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import {
  DiscoveryApiError, DiscoveryConfigError,
  businessesFromBody, saveDiscoveredBusinessesAsLeads, searchDiscoveryBusinesses
} from "@/lib/business-discovery";
import { getSafeSupabaseError } from "@/lib/supabase";

// Thin HTTP wrapper — all search/enrich/dedupe/save logic lives in
// src/lib/business-discovery.ts, reused as-is by the MCP
// search_customer_discovery/save_discovery_as_lead tools (see
// src/lib/instagram-intelligence/mcp/protocol.ts) so the admin UI and
// Claude never run different business logic for the same operation.
async function requireStaff() {
  return await requireModuleAccess("business_discovery") || requireModuleAccess("maps");
}

export async function POST(request: Request) {
  if (!(await requireStaff())) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const body = await request.json();
  const districtLabel = String(body.district || "").trim() || "Tüm ilçeler";
  const mapsFailure = (message: string, apiError?: string, status = 502) =>
    NextResponse.json({ businesses: [], count: 0, districtLabel, error: message, apiError: apiError || message }, { status });

  try {
    const result = await searchDiscoveryBusinesses({
      keyword: body.keyword,
      city: body.city,
      district: body.district,
      neighborhood: body.neighborhood,
      sector: body.sector,
      businessType: body.businessType,
      minimumRating: body.minimumRating ?? body.minRating,
      minimumReviewCount: body.minimumReviewCount ?? body.minReviewCount,
      website: body.website ?? body.websiteStatus,
      phone: body.phone ?? body.phoneStatus,
      instagram: body.instagram ?? body.instagramStatus,
      hideSaved: body.hideSaved,
      highOpportunity: body.highOpportunity,
      highAdPotential: body.highAdPotential,
      limit: body.limit ?? body.requestedCount ?? body.count
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DiscoveryConfigError) return mapsFailure("Google Maps API anahtarı yapılandırılmamış. Sistem yöneticisiyle iletişime geçin.", undefined, 503);
    if (error instanceof DiscoveryApiError) {
      if (error.status === 400) return NextResponse.json({ error: error.message }, { status: 400 });
      return mapsFailure(error.message, error.apiError, error.status);
    }
    console.error("[business-discovery] İşletme araması çöktü", error);
    return mapsFailure("İşletme araması sırasında beklenmeyen bir hata oluştu.", error instanceof Error ? error.message : String(error));
  }
}

export async function PUT(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const body = await request.json();
  const businesses = Array.isArray(body.businesses) ? businessesFromBody(body.businesses) : [];
  if (!businesses.length) return NextResponse.json({ error: "Kaydedilecek işletme seçin." }, { status: 400 });

  try {
    const result = await saveDiscoveredBusinessesAsLeads(
      businesses,
      { sector: body.sector, city: body.city, district: body.district, neighborhood: body.neighborhood, notes: body.notes },
      session
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DiscoveryConfigError) return NextResponse.json({ error: error.message }, { status: 503 });
    if (error instanceof DiscoveryApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    const safe = getSafeSupabaseError(error);
    console.error("[business-discovery] Lead kayıt hatası", safe.detail);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}
