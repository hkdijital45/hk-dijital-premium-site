/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { operationsAssistantQuestion } from "@/lib/business-flow";
import { supabaseRest } from "@/lib/supabase";

export async function POST(request: Request) {
  const session = await getSession();
  if (!isStaffRole(session?.role)) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const [leads, companies, reports, campaigns] = await Promise.all([
    supabaseRest<any[]>("leads?select=*&order=created_at.desc&limit=100").catch(() => []),
    supabaseRest<any[]>("companies?select=*&order=created_at.desc&limit=100").catch(() => []),
    supabaseRest<any[]>("reports?select=*&order=created_at.desc&limit=100").catch(() => []),
    supabaseRest<any[]>("campaigns?select=*&order=created_at.desc&limit=100").catch(() => [])
  ]);
  const result = await operationsAssistantQuestion(body.question || "Bugün hangi işlere öncelik vermeliyim?", { leads, companies, reports, campaigns });
  return NextResponse.json({ ok: true, answer: result.text, provider: result.provider, model: result.model, mode: result.mode });
}
