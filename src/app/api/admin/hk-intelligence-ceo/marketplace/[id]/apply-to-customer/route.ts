import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("hk-intelligence-ceo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const companyId = String(body.companyId || body.company_id || "");
  const payload = {
    packageId: id,
    companyId,
    agentMemory: true,
    workflowDraft: true,
    taskDrafts: ["Paket uygulama görüşmesi", "İlk kampanya planı", "30 günlük rapor planı"],
    message: "Paket müşteri için uygulanabilir payload olarak hazırlandı."
  };
  if (!companyId || !hasSupabaseConfig()) return NextResponse.json({ ok: true, mode: "prepared_payload", payload });
  try {
    await supabaseRest("agent_memories", {
      method: "POST",
      body: JSON.stringify({
        company_id: companyId,
        memory_type: "marketplace_package",
        title: `Marketplace paketi uygulandı`,
        content: JSON.stringify(payload),
        tags: ["marketplace", "hk-ceo"],
        is_active: true
      })
    }).catch(() => null);
    return NextResponse.json({ ok: true, mode: "saved_memory", payload });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, detail: safe.detail, payload }, { status: 500 });
  }
}
