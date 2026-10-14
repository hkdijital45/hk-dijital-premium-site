import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { archiveProposal, unarchiveProposal, ProposalNotFoundError } from "@/lib/proposals/store";

async function authorize() {
  return (await requireModuleAccess("teklifler")) || (await requireModuleAccess("crm")) || (await requireModuleAccess("leads"));
}

// Reversible archive — never deletes the row, never touches the related
// Lead/company or any analysis data. POST archives, DELETE on this same
// route restores (same resource, opposite direction — no separate
// "unarchive" URL needed).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await authorize();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz teklif kimliği." }, { status: 400 });
  try {
    const proposal = await archiveProposal(id, session.profileId || null);
    return NextResponse.json({ proposal });
  } catch (error) {
    if (error instanceof ProposalNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Arşivlenemedi." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await authorize();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz teklif kimliği." }, { status: 400 });
  try {
    const proposal = await unarchiveProposal(id);
    return NextResponse.json({ proposal });
  } catch (error) {
    if (error instanceof ProposalNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Arşivden çıkarılamadı." }, { status: 500 });
  }
}
