import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { supabaseRest, getSafeSupabaseError } from "@/lib/supabase";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { CONTENT_PLAN_TABLE, type ContentPlanItem } from "@/lib/content-plan/types";
import { buildContentPlanDocumentPayload, type ContentPlanPdfMode } from "@/lib/content-plan/pdf-payload";
import { generatePdfBuffer, safeFileNameSegment } from "@/lib/server/document-generator";

// İçerik Takip → "30 Günlük Planı İndir": a real PDF built from this
// exact company's own social_content_plan_items rows only — never touches
// or mutates any row (read-only), and never another company's data
// (company_id is taken from the authenticated staff request body, always
// re-verified against a real companies row server-side, never trusted
// blindly from the client beyond that check). Reuses the canonical
// document-generator.ts PDF engine (Turkish-glyph-safe font, HK Dijital
// branding/logo) already used by every other export in the app — no
// parallel PDF implementation.
export async function POST(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const companyId = String(body.companyId || "");
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  const mode: ContentPlanPdfMode = body.mode === "internal" ? "internal" : "customer";

  try {
    const companies = await supabaseRest<Array<{ id: string; name: string }>>(`companies?id=eq.${encodeURIComponent(companyId)}&select=id,name&limit=1`);
    const company = companies[0];
    if (!company) return NextResponse.json({ error: "Müşteri kaydı bulunamadı." }, { status: 404 });

    // The company's full current plan on file — not the UI's transient
    // search/quick-filter selection, so the PDF is never accidentally
    // incomplete because of whatever filter happened to be active.
    const items = await supabaseRest<ContentPlanItem[]>(
      `${CONTENT_PLAN_TABLE}?company_id=eq.${encodeURIComponent(companyId)}&select=*&order=scheduled_date.asc`
    );
    if (!items.length) return NextResponse.json({ error: "Bu müşteri için indirilecek içerik planı bulunamadı." }, { status: 404 });

    const payload = buildContentPlanDocumentPayload(company.name, items, mode);
    const buffer = await generatePdfBuffer(payload);

    const sorted = [...items].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
    const startDate = sorted[0].scheduled_date;
    const endDate = sorted[sorted.length - 1].scheduled_date;
    const slug = safeFileNameSegment(company.name).toLocaleLowerCase("en");
    const suffix = mode === "internal" ? "-ic-operasyon" : "";
    const filename = `${slug}-instagram-icerik-plani${suffix}-${startDate}-${endDate}.pdf`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}
