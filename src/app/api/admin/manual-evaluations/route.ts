import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import {
  createManualEvaluation,
  listManualEvaluations,
  ManualEvaluationValidationError,
  MANUAL_EVALUATION_MODULES,
  type ManualEvaluationModule
} from "@/lib/manual-evaluations";
import { assertUnitLinkedTo, BusinessRelationshipNotFoundError } from "@/lib/business-relationships";
import { BusinessRelationshipValidationError } from "@/lib/business-relationships-shared";

function isValidModule(value: string): value is ManualEvaluationModule {
  return (MANUAL_EVALUATION_MODULES as readonly string[]).includes(value);
}

export async function GET(request: Request) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const evaluationModule = searchParams.get("module") || "";
  if (!isValidModule(evaluationModule)) return NextResponse.json({ error: "Geçersiz modül." }, { status: 400 });
  const companyId = searchParams.get("companyId") || undefined;
  const leadId = searchParams.get("leadId") || undefined;
  if (companyId && !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçersiz müşteri kimliği." }, { status: 400 });
  if (leadId && !uuidPattern.test(leadId)) return NextResponse.json({ error: "Geçersiz aday kimliği." }, { status: 400 });
  const businessUnitId = searchParams.get("businessUnitId") || undefined;
  if (businessUnitId && !uuidPattern.test(businessUnitId)) return NextResponse.json({ error: "Geçersiz işletme kimliği." }, { status: 400 });

  try {
    const evaluations = await listManualEvaluations(evaluationModule, { companyId, leadId, businessUnitId });
    return NextResponse.json({ evaluations });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beklenmeyen hata." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const evaluationModule = String(body.module || "");
  if (!isValidModule(evaluationModule)) return NextResponse.json({ error: "Geçersiz modül." }, { status: 400 });
  const companyId = body.companyId ? String(body.companyId) : null;
  const leadId = body.leadId ? String(body.leadId) : null;
  if (companyId && !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçersiz müşteri kimliği." }, { status: 400 });
  if (leadId && !uuidPattern.test(leadId)) return NextResponse.json({ error: "Geçersiz aday kimliği." }, { status: 400 });
  if (!body.data || typeof body.data !== "object") return NextResponse.json({ error: "Geçersiz veri." }, { status: 400 });
  const businessUnitId = body.businessUnitId ? String(body.businessUnitId) : null;
  if (businessUnitId && !uuidPattern.test(businessUnitId)) return NextResponse.json({ error: "Geçersiz işletme kimliği." }, { status: 400 });

  try {
    // Report attribution: the selected branch/related brand must really be
    // linked to this lead/customer (or be the selected BAĞIMSIZ business).
    if (businessUnitId) {
      await assertUnitLinkedTo(businessUnitId, companyId ? { type: "company", id: companyId } : leadId ? { type: "lead", id: leadId } : null);
    }
    const evaluation = await createManualEvaluation({
      module: evaluationModule,
      companyId,
      leadId,
      businessUnitId,
      targetLabel: body.targetLabel ? String(body.targetLabel) : "",
      title: body.title ? String(body.title) : "",
      status: body.status === "submitted" ? "submitted" : "draft",
      data: body.data,
      notes: body.notes ? String(body.notes) : "",
      createdBy: session.profileId || null
    });
    return NextResponse.json({ evaluation });
  } catch (error) {
    if (error instanceof BusinessRelationshipNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof BusinessRelationshipValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof ManualEvaluationValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Değerlendirme kaydedilemedi." }, { status: 500 });
  }
}
