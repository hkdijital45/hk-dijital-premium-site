import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { validateHkProposalV1 } from "@/lib/proposals/schema";
import { getProposal, importProposalAnalysis, ProposalNotFoundError, ProposalImmutableError } from "@/lib/proposals/store";

// Claude Analizini İçe Aktar — validates the pasted/uploaded HK_PROPOSAL_V1
// JSON BEFORE ever persisting anything (never a partial/unsafe write).
// Business-identity mismatch (the imported business name looks nothing
// like this proposal's own target) is reported as a warning for the UI
// to show and require explicit confirmation on — it does not block the
// import outright (a Claude Project may legitimately phrase the business
// name differently), but it is never silently ignored.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("teklifler") || await requireModuleAccess("crm") || await requireModuleAccess("leads");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz teklif kimliği." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const rawText = typeof body.text === "string" ? body.text : "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText || JSON.stringify(body.json ?? {}));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? `Geçersiz JSON: ${error.message}` : "Geçersiz JSON." }, { status: 400 });
  }

  const validation = validateHkProposalV1(parsed);
  if (!validation.ok) return NextResponse.json({ error: "Şema doğrulaması başarısız.", details: validation.errors }, { status: 422 });

  try {
    const existing = await getProposal(id);
    const importedBusiness = (validation.data.business || {}) as Record<string, unknown>;
    const importedName = String(importedBusiness.name || importedBusiness.businessName || "").trim().toLocaleLowerCase("tr");
    const targetName = existing.target_label.trim().toLocaleLowerCase("tr");
    const nameMismatch = Boolean(importedName) && Boolean(targetName) && !importedName.includes(targetName) && !targetName.includes(importedName);

    const proposal = await importProposalAnalysis(id, { data: validation.data, claudeImportText: rawText || JSON.stringify(body.json) });
    return NextResponse.json({ proposal, warnings: nameMismatch ? [`İçe aktarılan işletme adı ("${importedName}") seçili teklifin hedefiyle ("${existing.target_label}") eşleşmiyor görünüyor — lütfen doğru lead/müşteriyi seçtiğinizi onaylayın.`] : [] });
  } catch (error) {
    if (error instanceof ProposalNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof ProposalImmutableError) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "İçe aktarılamadı." }, { status: 500 });
  }
}
