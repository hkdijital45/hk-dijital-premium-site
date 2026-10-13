import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { createProposalRevision, ProposalNotFoundError, ProposalTransitionError } from "@/lib/proposals/store";

async function authorize() {
  return (await requireModuleAccess("teklifler")) || (await requireModuleAccess("crm")) || (await requireModuleAccess("leads"));
}

// Creates a NEW row (previous_proposal_id-linked, version+1) for an
// already-sent proposal that needs changes — the original sent snapshot
// is never touched.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await authorize();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz teklif kimliği." }, { status: 400 });

  try {
    const proposal = await createProposalRevision(id);
    return NextResponse.json({ proposal });
  } catch (error) {
    if (error instanceof ProposalNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof ProposalTransitionError) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Revizyon oluşturulamadı." }, { status: 500 });
  }
}
