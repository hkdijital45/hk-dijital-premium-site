import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getOrCreatePreparation, savePreparation, buildLeadPreAuditPrompt, LeadPreAuditPrepValidationError, LeadNotFoundError } from "@/lib/lead-pre-audit-preparation";

async function requireCrmAccess() {
  return await requireModuleAccess("crm") || requireModuleAccess("leads");
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireCrmAccess();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  try {
    const preparation = await getOrCreatePreparation(id);
    return NextResponse.json({ preparation, prompt: buildLeadPreAuditPrompt(id) });
  } catch (error) {
    if (error instanceof LeadNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Hazırlık verisi alınamadı." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireCrmAccess();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  for (const field of ["social_observations", "business_notes", "advertising_status", "potential_reason", "focus_notes", "competitor_reference", "status"]) {
    if (field in body) patch[field] = body[field];
  }
  try {
    const preparation = await savePreparation(id, patch as never);
    return NextResponse.json({ preparation });
  } catch (error) {
    if (error instanceof LeadPreAuditPrepValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof LeadNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Hazırlık verisi kaydedilemedi." }, { status: 500 });
  }
}
