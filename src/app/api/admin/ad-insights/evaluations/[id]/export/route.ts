import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { supabaseRest } from "@/lib/supabase";
import { getAdEvaluationById, updateAdEvaluationStoragePaths, AdEvaluationNotFoundError, type AdEvaluationRecord } from "@/lib/marketing-intelligence/ad-evaluations";
import { buildAdEvaluationDocumentPayload, type AdEvaluationDocumentMode } from "@/lib/marketing-intelligence/ad-evaluation-document";
import { generatePdfBuffer, generateDocxBuffer, safeFileNameSegment, DOCUMENT_MIME_TYPES } from "@/lib/server/document-generator";
import { adEvaluationStoragePath, uploadAdEvaluationFile, signAdEvaluationFileUrl } from "@/lib/marketing-intelligence/ad-evaluation-storage";

const PATH_FIELD: Record<string, keyof AdEvaluationRecord> = {
  "internal-pdf": "internal_pdf_path", "internal-docx": "internal_docx_path",
  "client-pdf": "client_pdf_path", "client-docx": "client_docx_path"
};

// GET so the admin UI can use this directly as a download link/redirect.
// Reuses the already-generated, already-stored file when one exists for
// this evaluation (section 29/30: never produce duplicate files for the
// same evaluation+mode+format); only generates + uploads once, the first
// time a given export is requested, then signs a short-lived URL and
// redirects — same private-bucket pattern as team_attachments.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz değerlendirme kimliği." }, { status: 400 });
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId") || "";
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  const mode: AdEvaluationDocumentMode = searchParams.get("mode") === "internal" ? "internal" : "client";
  const format: "pdf" | "docx" = searchParams.get("format") === "docx" ? "docx" : "pdf";
  const force = searchParams.get("force") === "true";

  try {
    const evaluation = await getAdEvaluationById(companyId, id);
    const key = `${mode}-${format}`;
    const pathField = PATH_FIELD[key];
    const existingPath = evaluation[pathField] as string | null;

    if (existingPath && !force) {
      const url = await signAdEvaluationFileUrl(existingPath);
      return NextResponse.redirect(url);
    }

    const [companies, campaigns] = await Promise.all([
      supabaseRest<Array<{ name: string }>>(`companies?id=eq.${encodeURIComponent(companyId)}&select=name&limit=1`),
      evaluation.campaign_id
        ? supabaseRest<Array<{ name: string }>>(`campaigns?id=eq.${encodeURIComponent(evaluation.campaign_id)}&select=name&limit=1`).catch(() => [])
        : Promise.resolve([])
    ]);
    const companyName = companies[0]?.name || "Müşteri";
    const campaignName = campaigns[0]?.name || evaluation.meta_campaign_id || "Kampanya";

    const payload = buildAdEvaluationDocumentPayload(companyName, campaignName, evaluation, mode);
    const buffer = format === "docx" ? await generateDocxBuffer(payload) : await generatePdfBuffer(payload);

    const fileName = `${mode === "internal" ? "internal-report" : "client-report"}.${format}`;
    const storagePath = adEvaluationStoragePath(companyId, evaluation.campaign_id, id, fileName);
    await uploadAdEvaluationFile(storagePath, buffer, DOCUMENT_MIME_TYPES[format]);
    await updateAdEvaluationStoragePaths(companyId, id, { [pathField]: storagePath } as Partial<AdEvaluationRecord>);

    const url = await signAdEvaluationFileUrl(storagePath);
    return NextResponse.redirect(url);
  } catch (error) {
    if (error instanceof AdEvaluationNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Rapor dosyası oluşturulamadı." }, { status: 500 });
  }
}

// Direct-download variant (no storage round trip) — kept for parity with
// the creative-reports export route's POST+attachment pattern, used when
// the UI wants an immediate Content-Disposition download instead of a
// redirect (e.g. opened in the same tab after a fetch). Still persists to
// storage first, same as GET, so later re-downloads reuse the file too.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz değerlendirme kimliği." }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const companyId = String(body.companyId || "");
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  const mode: AdEvaluationDocumentMode = body.mode === "internal" ? "internal" : "client";
  const format: "pdf" | "docx" = body.format === "docx" ? "docx" : "pdf";

  try {
    const evaluation = await getAdEvaluationById(companyId, id);
    const [companies, campaigns] = await Promise.all([
      supabaseRest<Array<{ name: string }>>(`companies?id=eq.${encodeURIComponent(companyId)}&select=name&limit=1`),
      evaluation.campaign_id
        ? supabaseRest<Array<{ name: string }>>(`campaigns?id=eq.${encodeURIComponent(evaluation.campaign_id)}&select=name&limit=1`).catch(() => [])
        : Promise.resolve([])
    ]);
    const companyName = companies[0]?.name || "Müşteri";
    const campaignName = campaigns[0]?.name || evaluation.meta_campaign_id || "Kampanya";

    const payload = buildAdEvaluationDocumentPayload(companyName, campaignName, evaluation, mode);
    const buffer = format === "docx" ? await generateDocxBuffer(payload) : await generatePdfBuffer(payload);

    const fileName = `${mode === "internal" ? "internal-report" : "client-report"}.${format}`;
    const storagePath = adEvaluationStoragePath(companyId, evaluation.campaign_id, id, fileName);
    const pathField = PATH_FIELD[`${mode}-${format}`];
    await uploadAdEvaluationFile(storagePath, buffer, DOCUMENT_MIME_TYPES[format]);
    await updateAdEvaluationStoragePaths(companyId, id, { [pathField]: storagePath } as Partial<AdEvaluationRecord>);

    const slug = safeFileNameSegment(companyName).toLocaleLowerCase("en");
    const suffix = mode === "internal" ? "reklam-degerlendirme-dahili" : "reklam-performans-musteri";
    const dateSegment = new Date().toISOString().slice(0, 10);
    const filename = `${slug}-${suffix}-${dateSegment}.${format}`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: { "Content-Type": DOCUMENT_MIME_TYPES[format], "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" }
    });
  } catch (error) {
    if (error instanceof AdEvaluationNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Belge oluşturulamadı." }, { status: 500 });
  }
}
