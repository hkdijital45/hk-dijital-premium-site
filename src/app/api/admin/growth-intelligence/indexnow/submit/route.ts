import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { submitUrlsToIndexNow } from "@/lib/growth-intelligence/indexnow";
import { DEFAULT_WORKSPACE_ID } from "@/lib/growth-intelligence/types";
import { SITE_URL } from "@/lib/metadata";

export async function POST(request: Request) {
  const session = await requireModuleAccess("growth-intelligence");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const urls = Array.isArray(body.urls) ? body.urls.map((item) => String(item)).filter(Boolean) : [];
    if (!urls.length) return NextResponse.json({ error: "Gönderilecek URL yok." }, { status: 400 });

    const siteHost = new URL(SITE_URL).host;
    const batchId = crypto.randomUUID();
    const result = await submitUrlsToIndexNow(urls, siteHost);

    const rows = urls.map((url) => ({
      workspace_id: DEFAULT_WORKSPACE_ID,
      url,
      batch_id: batchId,
      status: result.ok ? "submitted" : "failed",
      response_code: result.status,
      response_body: result.message,
      submitted_at: new Date().toISOString()
    }));
    await supabaseRest("growth_indexnow_submissions", { method: "POST", body: JSON.stringify(rows) });

    return NextResponse.json({ ...result, batchId, submittedCount: urls.length });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
