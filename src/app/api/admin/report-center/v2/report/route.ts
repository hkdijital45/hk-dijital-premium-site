import { NextResponse } from "next/server";
import { reportCenterErrorResponse, requireReportTypeAccess, unauthorized } from "@/lib/report-center-v2/access";
import { loadReport, viewerPayload } from "@/lib/report-center-v2/server";
import { ownerFromParams, variantFromParams } from "@/lib/report-center-v2/params";

// "Raporu Görüntüle" — the report's real stored content, built with the
// same builder as its PDF (so the screen and the PDF never disagree).
// The report is loaded by id and rejected unless it belongs to the
// selected lead / customer / business.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const access = await requireReportTypeAccess(params.get("type"));
  if (!access) return unauthorized();
  try {
    const loaded = await loadReport(access.def.key, params.get("id") || "", ownerFromParams(params), params.get("business") || "all");
    const variant = variantFromParams(params, loaded.variants);
    const payload = await loaded.build(variant);
    const empty = !payload.executiveSummary && !payload.sections.length && !payload.headlineMetrics?.length;
    return NextResponse.json({
      title: loaded.title,
      variant,
      variants: loaded.variants,
      storedFile: Boolean(loaded.def.storedFile),
      hasStoredFile: Boolean(loaded.storedUrl),
      empty,
      document: viewerPayload(payload)
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return reportCenterErrorResponse(error, "Rapor görüntülenemedi.");
  }
}
