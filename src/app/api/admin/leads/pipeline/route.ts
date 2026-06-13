/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const pipelineStages = ["Yeni Lead", "İletişim Kuruldu", "Toplantı Yapıldı", "Teklif Gönderildi", "Takipte", "Kazanıldı", "Kaybedildi", "Kazandı"];

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!isStaffRole(session?.role)) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });

  try {
    const body = await request.json();
    const id = String(body.id || "");
    const status = String(body.status || "");
    if (!id) return NextResponse.json({ error: "Lead ID eksik." }, { status: 400 });
    if (!pipelineStages.includes(status)) return NextResponse.json({ error: "Geçerli pipeline aşaması seçin." }, { status: 400 });

    const rows = await supabaseRest<any[]>(`leads?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: status === "Kazandı" ? "Kazanıldı" : status, pipeline_stage: status === "Kazandı" ? "Kazanıldı" : status, updated_at: new Date().toISOString() })
    });

    return NextResponse.json({ ok: true, lead: rows[0], message: "Lead pipeline aşaması güncellendi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}
