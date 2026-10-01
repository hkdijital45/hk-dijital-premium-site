import { NextResponse } from "next/server";
import { recordActionFailure, recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { requireModuleAccess } from "@/lib/permissions";
import { checkLeadDuplicate } from "@/lib/lead-duplicate-check";

async function requireCrmAccess() {
  return await requireModuleAccess("crm") || requireModuleAccess("leads");
}

export const MANUAL_SOURCE_DETAILS = ["Google Maps", "Instagram", "Tavsiye", "Web Araştırması", "Fiziksel Olarak Görüldü", "Diğer"] as const;

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// "+ Yeni Lead" — the one way a manual lead gets created. source is
// always forced to "Manuel Giriş" here (never client-settable) so the
// Manuel Leadler folder stays trustworthy; Müşteri Keşfi's own transfer
// path writes its own source value directly via its existing route,
// untouched by this one.
export async function POST(request: Request) {
  const session = await requireCrmAccess();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const company = cleanString(body.company);
  const sector = cleanString(body.sector || body.business_type);
  if (!company) return NextResponse.json({ error: "İşletme adı zorunludur." }, { status: 400 });
  if (!sector) return NextResponse.json({ error: "Sektör zorunludur." }, { status: 400 });

  const manualSourceDetail = cleanString(body.source_detail);
  if (manualSourceDetail && !(MANUAL_SOURCE_DETAILS as readonly string[]).includes(manualSourceDetail)) {
    return NextResponse.json({ error: "Geçersiz manuel kaynak." }, { status: 400 });
  }

  const payload = {
    company, name: cleanString(body.name) || company,
    sector, business_type: sector,
    city: cleanString(body.city) || null,
    district: cleanString(body.district) || null,
    instagram: cleanString(body.instagram) || null,
    phone: cleanString(body.phone) || null,
    website: cleanString(body.website) || null,
    google_maps_url: cleanString(body.google_maps_url) || null,
    notes: cleanString(body.note) || null
  };

  try {
    const duplicate = await checkLeadDuplicate({ phone: payload.phone, instagram: payload.instagram, website: payload.website, company: payload.company, district: payload.district });
    if (duplicate.exactMatch && body.force !== true) {
      return NextResponse.json({ error: "Bu işletme Lead Merkezi'nde zaten bulunuyor olabilir.", duplicate: duplicate.exactMatch }, { status: 409 });
    }

    const rows = await supabaseRest<any[]>("leads", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        source: "Manuel Giriş",
        source_detail: manualSourceDetail || null,
        status: "Yeni Başvuru",
        updated_at: new Date().toISOString()
      })
    }).catch(async (writeError) => {
      // source_detail is new (same migration as lead_pre_audit_preparations)
      // — if it hasn't been applied yet in this environment, degrade
      // gracefully rather than failing the whole create.
      const message = writeError instanceof Error ? writeError.message : String(writeError);
      if (message.includes("schema cache") || message.includes("Could not find") || message.includes("column")) {
        return supabaseRest<any[]>("leads", {
          method: "POST",
          body: JSON.stringify({ ...payload, source: "Manuel Giriş", status: "Yeni Başvuru", updated_at: new Date().toISOString() })
        });
      }
      throw writeError;
    });

    const lead = rows[0];
    await recordActivity({ session, action: "Oluşturma", entity: "Manuel Lead", entityId: lead.id, companyId: lead.company_id, details: { message: "Manuel lead oluşturuldu", company } });
    return NextResponse.json({ ok: true, lead, possibleMatches: duplicate.possibleMatches });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Lead Merkezi", action: "Manuel lead oluşturma", error }).catch(() => null);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}
