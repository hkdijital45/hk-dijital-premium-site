import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import type { GeminiVisibilityScan } from "@/lib/gemini-visibility/types";

export async function POST(request: Request) {
  const session = await requireModuleAccess("growth-intelligence");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const scanId = String(body.scanId || "").trim();
  const title = String(body.title || "").trim();
  const rationale = String(body.rationale || "").trim();
  const recommendationKey = String(body.recommendationKey || "primary").trim();
  if (!scanId || !title) return NextResponse.json({ error: "scanId ve title zorunludur." }, { status: 400 });

  try {
    const scans = await supabaseRest<GeminiVisibilityScan[]>(`gemini_visibility_scans?id=eq.${encodeURIComponent(scanId)}&select=*&limit=1`);
    const scan = scans[0];
    if (!scan) return NextResponse.json({ error: "Tarama bulunamadı." }, { status: 404 });

    const automationKey = `gemini-visibility-${scanId}-${recommendationKey}`;
    const existing = await supabaseRest<Array<{ id: string }>>(`agency_tasks?automation_key=eq.${encodeURIComponent(automationKey)}&select=id&limit=1`);
    if (existing.length) return NextResponse.json({ ok: true, taskId: existing[0].id, alreadyExisted: true });

    const inserted = await supabaseRest<Array<{ id: string }>>("agency_tasks", {
      method: "POST",
      body: JSON.stringify({
        company_id: scan.company_id,
        title: `Gemini Görünürlüğü: ${title}`,
        description: [
          rationale || "Gemini Görünürlük Merkezi taramasından türetilen öneri.",
          `Kaynak tarama: ${scanId} (Skor: ${scan.score ?? "-"}/100, Seviye: ${scan.score_level || "-"})`
        ].join("\n\n"),
        status: "Yapılacak",
        priority: "Normal",
        automation_key: automationKey
      })
    });

    return NextResponse.json({ ok: true, taskId: inserted[0].id, alreadyExisted: false });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
