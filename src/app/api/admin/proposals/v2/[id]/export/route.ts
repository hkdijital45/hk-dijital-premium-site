import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { getProposal, ProposalNotFoundError } from "@/lib/proposals/store";
import { buildProposalDocumentPayload, buildProposalFileName, type ProposalDocumentMode } from "@/lib/proposals/document";
import { generatePdfBuffer, generateDocxBuffer, DOCUMENT_MIME_TYPES } from "@/lib/server/document-generator";

// Real document generation via the same shared corporate engine every
// other export in the app uses — internal-only fields (risks,
// assumptions, internal_recommendations, raw sources/claude_import text)
// are structurally excluded for mode=client in buildProposalDocumentPayload
// itself (the export layer), never just visually hidden.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("teklifler") || await requireModuleAccess("crm") || await requireModuleAccess("leads");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz teklif kimliği." }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const mode: ProposalDocumentMode = body.mode === "internal" ? "internal" : "client";
  const format: "pdf" | "docx" = body.format === "docx" ? "docx" : "pdf";

  try {
    const proposal = await getProposal(id);
    const payload = buildProposalDocumentPayload(proposal, mode);
    const buffer = format === "docx" ? await generateDocxBuffer(payload) : await generatePdfBuffer(payload);
    const filename = buildProposalFileName(proposal, mode, format);
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: { "Content-Type": DOCUMENT_MIME_TYPES[format], "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" }
    });
  } catch (error) {
    if (error instanceof ProposalNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Belge oluşturulamadı." }, { status: 500 });
  }
}
