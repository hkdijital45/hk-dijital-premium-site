/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { operationsAssistantQuestion } from "@/lib/business-flow";
import { supabaseRest } from "@/lib/supabase";

export async function POST(request: Request) {
  const session = await getSession();
  if (!isStaffRole(session?.role)) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const [leads, companies, reports, campaigns, payments, tasks, activities, integrations] = await Promise.all([
    supabaseRest<any[]>("leads?select=*&order=created_at.desc&limit=100").catch(() => []),
    supabaseRest<any[]>("companies?select=*&order=created_at.desc&limit=100").catch(() => []),
    supabaseRest<any[]>("reports?select=*&order=created_at.desc&limit=100").catch(() => []),
    supabaseRest<any[]>("campaigns?select=*&order=created_at.desc&limit=100").catch(() => []),
    supabaseRest<any[]>("payment_records?select=id,company_id,amount,status,due_date,paid_at,updated_at&order=due_date.asc&limit=200").catch(() => []),
    supabaseRest<any[]>("agency_tasks?select=id,company_id,title,status,priority,due_date,updated_at&order=due_date.asc&limit=200").catch(() => []),
    supabaseRest<any[]>("activity_logs?select=id,company_id,module,action,action_type,status,created_at&order=created_at.desc&limit=100").catch(() => []),
    supabaseRest<any[]>("ad_integrations?select=id,company_id,provider,pixel_enabled,pixel_status,capi_enabled,capi_status,status,sync_status,sync_message,last_sync_at&order=updated_at.desc&limit=200").catch(() => [])
  ]);
  const result = await operationsAssistantQuestion(body.question || "Bugün hangi işlere öncelik vermeliyim?", { leads, companies, reports, campaigns, payments, tasks, activities, integrations });
  return NextResponse.json({ ok: true, answer: result.text, provider: result.provider, model: result.model, mode: result.mode });
}
