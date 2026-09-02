import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { getScanWithAnswers } from "@/lib/gemini-visibility/scan";
import { buildGeminiVisibilityReportPayload } from "@/lib/gemini-visibility/report";
import { generateDocxBuffer, generatePdfBuffer } from "@/lib/server/document-generator";
import type { GeminiVisibilityProfile } from "@/lib/gemini-visibility/types";

export async function GET(request: Request, { params }: { params: Promise<{ scanId: string }> }) {
  const session = await requireModuleAccess("growth-intelligence");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const { scanId } = await params;
  const format = new URL(request.url).searchParams.get("format") === "docx" ? "docx" : "pdf";

  try {
    const { scan, answers } = await getScanWithAnswers(scanId);
    const [profiles, companies] = await Promise.all([
      supabaseRest<GeminiVisibilityProfile[]>(`gemini_visibility_profiles?id=eq.${encodeURIComponent(scan.profile_id)}&select=*&limit=1`),
      supabaseRest<Array<{ name: string }>>(`companies?id=eq.${encodeURIComponent(scan.company_id)}&select=name&limit=1`)
    ]);
    if (!profiles[0]) return NextResponse.json({ error: "Profil bulunamadı." }, { status: 404 });

    const payload = buildGeminiVisibilityReportPayload(companies[0]?.name || "Müşteri", profiles[0], scan, answers);
    const buffer = format === "docx" ? await generateDocxBuffer(payload) : await generatePdfBuffer(payload);
    const contentType = format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf";
    const fileName = `gemini-gorunurluk-raporu.${format}`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rapor oluşturulamadı.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
