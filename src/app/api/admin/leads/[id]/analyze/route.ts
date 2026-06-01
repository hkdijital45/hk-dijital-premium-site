import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { analyzeLead } from "@/lib/lead-analysis";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function POST(_request: Request, context: RouteContext<"/api/admin/leads/[id]/analyze">) {
  const session = await getSession();
  if (!isStaffRole(session?.role)) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı. Canlı ortamda kaydetme çalışmaz." }, { status: 503 });
  const { id } = await context.params;

  try {
    const leads = await supabaseRest<any[]>(`leads?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    const lead = leads[0];
    if (!lead) return NextResponse.json({ error: "Potansiyel müşteri kaydı bulunamadı." }, { status: 404 });
    const analysis = await analyzeLead(lead);
    const updated = await supabaseRest<any[]>(`leads?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ ai_analysis: analysis, updated_at: new Date().toISOString() })
    });
    await recordActivity({ session, action: "Güncelleme", entity: "Lead AI Analizi", entityId: id, companyId: lead.company_id, details: { message: "Potansiyel müşteri AI analizi oluşturuldu", provider: analysis.provider } });
    return NextResponse.json({ analysis, lead: updated[0] || { ...lead, ai_analysis: analysis }, message: "AI analizi oluşturuldu ve kaydedildi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    console.error("[lead-analysis] Analiz kayıt hatası", safe.detail);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}
