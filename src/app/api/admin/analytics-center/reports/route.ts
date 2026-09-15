import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { supabaseRest } from "@/lib/supabase";
import { uuidPattern } from "@/lib/meta-pixel-admin";

export async function GET(request: Request) {
  const session = await requireModuleAccess("analiz-raporlama");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  const companyId = new URL(request.url).searchParams.get("companyId") || "";
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  const reports = await supabaseRest<any[]>(
    `analytics_reports?company_id=eq.${encodeURIComponent(companyId)}&select=*,customer_documents(document_url,title)&order=created_at.desc&limit=25`
  ).catch(() => []);

  return NextResponse.json({ reports });
}
