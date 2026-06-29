/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("hk-intelligence-ceo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const taskPayload = {
    company_id: body.company_id || body.companyId || null,
    title: body.title || "HK Intelligence önerisini uygula",
    description: body.description || `Öneri kaydı: ${id}`,
    status: "Açık",
    priority: body.priority || "Normal",
    source: "hk_intelligence_ceo",
    metadata: { recommendation_id: id, ...(body.metadata || {}) }
  };
  if (!hasSupabaseConfig()) return NextResponse.json({ ok: true, mode: "prepared_payload", task: taskPayload });
  try {
    const rows = await supabaseRest<any[]>("agency_tasks", { method: "POST", body: JSON.stringify(taskPayload) }).catch(() => []);
    return NextResponse.json({ ok: true, mode: rows[0] ? "created_task" : "prepared_payload", task: rows[0] || taskPayload });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, detail: safe.detail, task: taskPayload }, { status: 500 });
  }
}
