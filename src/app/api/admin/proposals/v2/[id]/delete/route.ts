import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { deleteProposal, restoreProposal, ProposalNotFoundError } from "@/lib/proposals/store";

async function authorize() {
  return (await requireModuleAccess("teklifler")) || (await requireModuleAccess("crm")) || (await requireModuleAccess("leads"));
}

// Soft delete (SİL) — never a real DROP. POST deletes (client confirms
// via AdminConfirmDialog first), DELETE on this same route restores —
// same POST/DELETE symmetry as the sibling .../archive route.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await authorize();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz teklif kimliği." }, { status: 400 });
  try {
    const proposal = await deleteProposal(id, session.profileId || null);
    return NextResponse.json({ proposal });
  } catch (error) {
    if (error instanceof ProposalNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Silinemedi." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await authorize();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz teklif kimliği." }, { status: 400 });
  try {
    const proposal = await restoreProposal(id);
    return NextResponse.json({ proposal });
  } catch (error) {
    if (error instanceof ProposalNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Geri yüklenemedi." }, { status: 500 });
  }
}
