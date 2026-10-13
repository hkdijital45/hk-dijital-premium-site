import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { transitionProposal, ProposalNotFoundError, ProposalTransitionError, type ProposalTransitionAction } from "@/lib/proposals/store";
import { notifyProposalAccepted, notifyProposalRejected } from "@/lib/notifications/events";

const VALID_ACTIONS: ProposalTransitionAction[] = ["send", "accept", "reject", "expire", "request_revision"];

async function authorize() {
  return (await requireModuleAccess("teklifler")) || (await requireModuleAccess("crm")) || (await requireModuleAccess("leads"));
}

// Explicit, validated lifecycle actions (Gönder / Kabul Edildi / Reddedildi
// / Süresi Doldu / Revizyon İste) — never a raw arbitrary status PATCH, so
// a proposal can never be marked accepted just by being opened.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await authorize();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz teklif kimliği." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  if (!VALID_ACTIONS.includes(action as ProposalTransitionAction)) {
    return NextResponse.json({ error: `Geçersiz aksiyon. Geçerli değerler: ${VALID_ACTIONS.join(", ")}` }, { status: 400 });
  }

  try {
    const proposal = await transitionProposal(id, action as ProposalTransitionAction);
    if (action === "accept") notifyProposalAccepted(proposal).catch(() => {});
    if (action === "reject") notifyProposalRejected(proposal).catch(() => {});
    return NextResponse.json({ proposal });
  } catch (error) {
    if (error instanceof ProposalNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof ProposalTransitionError) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Durum değiştirilemedi." }, { status: 500 });
  }
}
