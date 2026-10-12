import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { getManualEvaluation, updateManualEvaluation, ManualEvaluationNotFoundError, ManualEvaluationValidationError } from "@/lib/manual-evaluations";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz kimlik." }, { status: 400 });
  try {
    const evaluation = await getManualEvaluation(id);
    return NextResponse.json({ evaluation });
  } catch (error) {
    if (error instanceof ManualEvaluationNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beklenmeyen hata." }, { status: 500 });
  }
}

// Also used to import a pasted Claude result (Phase 10): body.claudeImportText
// sets source to 'claude_import' and preserves the original text verbatim;
// sending `data` on its own continues to be a normal manual draft edit —
// unsaved input is never silently discarded, each PATCH only touches the
// fields actually sent.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz kimlik." }, { status: 400 });
  const body = await request.json().catch(() => ({}));

  try {
    const evaluation = await updateManualEvaluation(id, {
      title: body.title !== undefined ? String(body.title) : undefined,
      status: body.status === "submitted" ? "submitted" : body.status === "draft" ? "draft" : undefined,
      data: body.data && typeof body.data === "object" ? body.data : undefined,
      notes: body.notes !== undefined ? String(body.notes) : undefined,
      claudeImportText: body.claudeImportText !== undefined ? String(body.claudeImportText) : undefined
    });
    return NextResponse.json({ evaluation });
  } catch (error) {
    if (error instanceof ManualEvaluationNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof ManualEvaluationValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Değerlendirme güncellenemedi." }, { status: 500 });
  }
}
