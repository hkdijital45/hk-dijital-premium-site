import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { supabaseRest } from "@/lib/supabase";
import { getAdStrategyById, AdStrategyNotFoundError } from "@/lib/marketing-intelligence/ad-strategies";
import { buildAdStrategyDocumentPayload, type AdStrategyDocumentMode } from "@/lib/marketing-intelligence/ad-strategy-document";
import { generatePdfBuffer, generateDocxBuffer, safeFileNameSegment, DOCUMENT_MIME_TYPES } from "@/lib/server/document-generator";

// Always exports the EXACT currently-saved row (re-read from the DB by
// id+companyId right here) — never a cached/stale/previous Claude
// response. Reuses the canonical document-generator.ts engine (same one
// every other export in the app uses) — no parallel PDF/DOCX
// implementation.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz strateji kimliği." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const companyId = String(body.companyId || "");
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  const mode: AdStrategyDocumentMode = body.mode === "internal" ? "internal" : "client";
  const format: "pdf" | "docx" = body.format === "docx" ? "docx" : "pdf";

  try {
    const [strategy, companies] = await Promise.all([
      getAdStrategyById(companyId, id),
      supabaseRest<Array<{ name: string }>>(`companies?id=eq.${encodeURIComponent(companyId)}&select=name&limit=1`)
    ]);
    const companyName = companies[0]?.name || "Müşteri";

    const payload = buildAdStrategyDocumentPayload(companyName, strategy, mode);
    const buffer = format === "docx" ? await generateDocxBuffer(payload) : await generatePdfBuffer(payload);

    const slug = safeFileNameSegment(companyName).toLocaleLowerCase("en");
    const suffix = mode === "internal" ? "dahili-rapor" : "musteri-raporu";
    const filename = `${slug}-reklam-stratejisi-${suffix}-v${strategy.version}.${format}`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": DOCUMENT_MIME_TYPES[format],
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    if (error instanceof AdStrategyNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Belge oluşturulamadı." }, { status: 500 });
  }
}
