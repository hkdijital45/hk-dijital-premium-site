import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import {
  getAdEvaluationById, updateAdEvaluation, setAdEvaluationStatus, deleteAdEvaluation,
  AdEvaluationNotFoundError, AdEvaluationValidationError, AD_EVALUATION_STATUSES, type AdEvaluationStatus
} from "@/lib/marketing-intelligence/ad-evaluations";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz değerlendirme kimliği." }, { status: 400 });
  const companyId = new URL(request.url).searchParams.get("companyId") || "";
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  try {
    const evaluation = await getAdEvaluationById(companyId, id);
    return NextResponse.json({ evaluation });
  } catch (error) {
    if (error instanceof AdEvaluationNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beklenmeyen hata." }, { status: 500 });
  }
}

// Edit (internal/client report content, decision, next review) and
// status transitions (archive/unarchive). Never accepts campaign_id/
// metrics_snapshot changes here — the frozen snapshot and campaign
// binding are edited only through the existing update_ad_evaluation
// data-layer function from a validated source (MCP), not this UI route.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz değerlendirme kimliği." }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const companyId = String(body.companyId || "");
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  try {
    if (typeof body.status === "string") {
      if (!(AD_EVALUATION_STATUSES as readonly string[]).includes(body.status)) return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });
      const evaluation = await setAdEvaluationStatus(companyId, id, body.status as AdEvaluationStatus);
      return NextResponse.json({ evaluation });
    }
    const patch: Record<string, unknown> = {};
    if (body.internalReport && typeof body.internalReport === "object") patch.internalReport = body.internalReport;
    if (body.clientReport && typeof body.clientReport === "object") patch.clientReport = body.clientReport;
    if (typeof body.decision === "string" || body.decision === null) patch.decision = body.decision;
    if (typeof body.nextReviewAt === "string" || body.nextReviewAt === null) patch.nextReviewAt = body.nextReviewAt;
    if (typeof body.nextReviewNote === "string" || body.nextReviewNote === null) patch.nextReviewNote = body.nextReviewNote;
    let evaluation = await updateAdEvaluation(companyId, id, patch as never);
    if (body.regenerateReports === true) {
      const { generateAllAdEvaluationReports } = await import("@/lib/marketing-intelligence/ad-evaluation-reports");
      evaluation = await generateAllAdEvaluationReports(companyId, id, { force: true });
    }
    return NextResponse.json({ evaluation });
  } catch (error) {
    if (error instanceof AdEvaluationValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof AdEvaluationNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beklenmeyen hata." }, { status: 500 });
  }
}

// Real physical delete (ad_evaluations has no soft-delete column) —
// ownership-checked, deletes this evaluation's own stored report files,
// never touches another company's/evaluation's data.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz değerlendirme kimliği." }, { status: 400 });
  const companyId = new URL(request.url).searchParams.get("companyId") || "";
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  try {
    await deleteAdEvaluation(companyId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AdEvaluationNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beklenmeyen hata." }, { status: 500 });
  }
}
