import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { listLinkedBusinesses } from "@/lib/business-relationships";
import { normalizeBusinessScope } from "@/lib/proposals/business-scope";
import { getProposal, updateProposal, ProposalNotFoundError, ProposalValidationError, ProposalImmutableError, PROPOSAL_STATUSES, type ProposalStatus } from "@/lib/proposals/store";

function isValidStatus(value: string): value is ProposalStatus {
  return (PROPOSAL_STATUSES as readonly string[]).includes(value);
}

async function authorize() {
  return (await requireModuleAccess("teklifler")) || (await requireModuleAccess("crm")) || (await requireModuleAccess("leads"));
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await authorize();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz teklif kimliği." }, { status: 400 });
  try {
    const proposal = await getProposal(id);
    return NextResponse.json({ proposal });
  } catch (error) {
    if (error instanceof ProposalNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beklenmeyen hata." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await authorize();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz teklif kimliği." }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  if (body.status !== undefined && !isValidStatus(String(body.status))) return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });

  try {
    // Teklif kapsamı: every business in scope must be the proposal's own
    // lead/customer or a business really linked to it (server-verified).
    if (body.questionnaire && typeof body.questionnaire === "object" && "businessScope" in body.questionnaire) {
      const existing = await getProposal(id);
      const ownerKey = existing.company_id ? `company:${existing.company_id}` : existing.lead_id ? `lead:${existing.lead_id}` : "";
      const scope = normalizeBusinessScope(body.questionnaire.businessScope);
      if (scope.length) {
        const linked = ownerKey ? await listLinkedBusinesses(existing.company_id ? { type: "company", id: existing.company_id } : { type: "lead", id: existing.lead_id as string }) : [];
        const allowed = new Set([ownerKey, ...linked.map((item) => `${item.entity.type}:${item.entity.id}`)]);
        const invalid = scope.find((item) => !allowed.has(item.key));
        if (invalid) return NextResponse.json({ error: `${invalid.name} bu teklifin işletmesine bağlı değil.` }, { status: 400 });
      }
      body.questionnaire.businessScope = scope;
    }
    const proposal = await updateProposal(id, {
      title: body.title !== undefined ? String(body.title) : undefined,
      status: body.status !== undefined ? (body.status as ProposalStatus) : undefined,
      questionnaire: body.questionnaire && typeof body.questionnaire === "object" ? body.questionnaire : undefined,
      data: body.data && typeof body.data === "object" ? body.data : undefined,
      validUntil: body.validUntil !== undefined ? body.validUntil : undefined
    });
    return NextResponse.json({ proposal });
  } catch (error) {
    if (error instanceof ProposalNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof ProposalImmutableError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof ProposalValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Teklif güncellenemedi." }, { status: 500 });
  }
}
