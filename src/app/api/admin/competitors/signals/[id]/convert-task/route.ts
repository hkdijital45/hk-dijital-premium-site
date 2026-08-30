import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("rakip-analizi");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const { id } = await params;
  try {
    const signals = await supabaseRest<Array<{ id: string; title: string; summary: string | null; company_id: string | null }>>(
      `competitor_signals?id=eq.${encodeURIComponent(id)}&select=id,title,summary,company_id&limit=1`
    );
    const signal = signals[0];
    if (!signal) return NextResponse.json({ error: "Sinyal bulunamadı." }, { status: 404 });

    const existing = await supabaseRest<Array<{ id: string }>>(
      `agency_tasks?automation_key=eq.${encodeURIComponent(`competitor-signal-${signal.id}`)}&select=id&limit=1`
    );
    if (existing.length) return NextResponse.json({ ok: true, taskId: existing[0].id, alreadyExisted: true });

    const inserted = await supabaseRest<Array<{ id: string }>>("agency_tasks", {
      method: "POST",
      body: JSON.stringify({
        company_id: signal.company_id,
        title: `Rakip sinyali: ${signal.title}`,
        description: signal.summary || "Rakip istihbarat sinyali için değerlendirme gerekiyor.",
        status: "Yapılacak",
        priority: "Normal",
        automation_key: `competitor-signal-${signal.id}`
      })
    });

    return NextResponse.json({ ok: true, taskId: inserted[0].id, alreadyExisted: false });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
