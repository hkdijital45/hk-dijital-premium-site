import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { validateHkProposalV1, parseProposalJson } from "@/lib/proposals/schema";
import { getProposal, importProposalAnalysis, ProposalNotFoundError, ProposalImmutableError } from "@/lib/proposals/store";
import { notifyProposalReady } from "@/lib/notifications/events";

// Claude Analizini İçe Aktar — validates the pasted/uploaded HK_PROPOSAL_V1
// JSON BEFORE ever persisting anything (never a partial/unsafe write).
// The user can paste Claude's ENTIRE response (Turkish analysis prose +
// the ÇIKTI B JSON block together) — parseProposalJson locates and
// extracts the real JSON object itself (fenced ```json block, or the
// first balanced {...} object), so there is no separate "isolate the
// JSON" step the user is forced through (confirmed this was previously
// required by inspecting a real saved claude_import.text that contained
// ONLY raw JSON — exactly the tedious extraction step being removed).
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
  const rawText = typeof body.text === "string" ? body.text : (body.json ? JSON.stringify(body.json) : "");
  if (!rawText.trim()) return NextResponse.json({ error: "Yapıştırılacak Claude çıktısı boş olamaz." }, { status: 400 });
  const parseResult = parseProposalJson(rawText);
  if (!parseResult.ok) return NextResponse.json({ error: parseResult.error }, { status: 400 });
  const parsed = parseResult.value;

  const validation = validateHkProposalV1(parsed);
  if (!validation.ok) return NextResponse.json({ error: "Şema doğrulaması başarısız.", details: validation.errors }, { status: 422 });

  try {
    const existing = await getProposal(id);
    const importedBusiness = (validation.data.business || {}) as Record<string, unknown>;
    const importedName = String(importedBusiness.name || importedBusiness.businessName || "").trim().toLocaleLowerCase("tr");
    const targetName = existing.target_label.trim().toLocaleLowerCase("tr");
    const nameMismatch = Boolean(importedName) && Boolean(targetName) && !importedName.includes(targetName) && !targetName.includes(importedName);

    const proposal = await importProposalAnalysis(id, { data: validation.data, claudeImportText: rawText });
    notifyProposalReady(proposal).catch(() => {});
    return NextResponse.json({ proposal, warnings: nameMismatch ? [`İçe aktarılan işletme adı ("${importedName}") seçili teklifin hedefiyle ("${existing.target_label}") eşleşmiyor görünüyor — lütfen doğru lead/müşteriyi seçtiğinizi onaylayın.`] : [] });
  } catch (error) {
    if (error instanceof ProposalNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof ProposalImmutableError) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "İçe aktarılamadı." }, { status: 500 });
  }
}
