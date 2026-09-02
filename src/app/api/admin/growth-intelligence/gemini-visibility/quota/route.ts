import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig } from "@/lib/supabase";
import { getQuotaStatus } from "@/lib/gemini-visibility/quota";

export async function GET(request: Request) {
  const session = await requireModuleAccess("growth-intelligence");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const companyId = new URL(request.url).searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId zorunludur." }, { status: 400 });

  try {
    const quota = await getQuotaStatus(companyId);
    return NextResponse.json({ quota });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kota bilgisi alınamadı.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
