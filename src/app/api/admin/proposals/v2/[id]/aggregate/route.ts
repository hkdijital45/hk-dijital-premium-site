import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { getProposal, updateProposal, ProposalNotFoundError, ProposalImmutableError } from "@/lib/proposals/store";
import { collectLeadProposalContext, mergeContextIntoQuestionnaire, buildContextFindingsBlocks } from "@/lib/proposals/context-collector";
import type { ProposalQuestionnaire } from "@/lib/proposals/prompt";

async function authorize() {
  return (await requireModuleAccess("teklifler")) || (await requireModuleAccess("crm")) || (await requireModuleAccess("leads"));
}

// "Lead'den Otomatik Teklif Oluştur" / "Lead Verilerini Yenile" — both
// call this same endpoint. It is always safe to re-run: existing
// non-empty questionnaire fields are never overwritten
// (mergeContextIntoQuestionnaire only fills gaps), so a second call
// after manual edits never destroys them.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await authorize();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz teklif kimliği." }, { status: 400 });

  try {
    const proposal = await getProposal(id);
    if (!proposal.lead_id) {
      return NextResponse.json({ error: "Otomatik veri toplama yalnızca bir lead'e bağlı tekliflerde çalışır — bu teklif doğrudan bir müşteriye bağlı." }, { status: 400 });
    }

    const context = await collectLeadProposalContext(proposal.lead_id);
    const { questionnaire, filledFields } = mergeContextIntoQuestionnaire(
      proposal.questionnaire as Partial<ProposalQuestionnaire>,
      context
    );

    const updated = await updateProposal(id, { questionnaire });
    const findings = buildContextFindingsBlocks(context);
    // Only redacted/formatted text + metadata leaves the server — never
    // the raw pre-audit row, which also carries internal-only sales
    // fields (sales_notes/sales_script/etc.) that must not reach this
    // client-facing response.
    return NextResponse.json({
      proposal: updated,
      filledFields,
      findings,
      completeness: context.completeness,
      sources: context.sources,
      notes: context.notes
    });
  } catch (error) {
    if (error instanceof ProposalNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof ProposalImmutableError) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Veri toplanamadı." }, { status: 500 });
  }
}
