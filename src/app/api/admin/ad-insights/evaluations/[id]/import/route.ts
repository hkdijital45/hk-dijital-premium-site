import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { saveParsedEvaluation, AdEvaluationNotFoundError, AdEvaluationValidationError } from "@/lib/marketing-intelligence/ad-evaluations";
import { parseAdEvaluationResponse } from "@/lib/marketing-intelligence/ad-evaluation-parser";

// "Claude Sonucunu İçe Aktar" — parses the pasted Claude output (delimited
// format from ad-evaluation-prompt.ts) and saves internal/client reports +
// decision. Never crashes on a malformed paste: parseAdEvaluationResponse
// always returns a result (ok:false + warnings on failure), and the raw
// text is always persisted via claude_raw_response regardless, so nothing
// the user pasted is ever lost even if structured parsing failed.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz değerlendirme kimliği." }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const companyId = String(body.companyId || "");
  const rawResponse = String(body.rawResponse || "");
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  if (!rawResponse.trim()) return NextResponse.json({ error: "Yapıştırılacak Claude çıktısı boş olamaz." }, { status: 400 });

  try {
    const parsed = parseAdEvaluationResponse(rawResponse);
    const evaluation = await saveParsedEvaluation(companyId, id, {
      claudeRawResponse: rawResponse,
      internalReport: parsed.internalReport,
      clientReport: parsed.clientReport,
      decision: parsed.decision,
      nextReviewAt: parsed.nextReviewAt,
      nextReviewNote: parsed.nextReviewNote
    });
    return NextResponse.json({ evaluation, ok: parsed.ok, warnings: parsed.warnings });
  } catch (error) {
    if (error instanceof AdEvaluationNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof AdEvaluationValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beklenmeyen hata." }, { status: 500 });
  }
}
