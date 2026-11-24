/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { auditConvertedLeads } from "@/lib/lead-conversion";

// Salt okunur: dönüştürülmüş lead'lerin müşteri bağlantı tutarlılığını raporlar. Hiçbir kaydı değiştirmez.
export async function GET() {
  const session = await getSession();
  if (!isStaffRole(session?.role)) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  try {
    const [leads, companies, customers] = await Promise.all([
      supabaseRest<any[]>("leads?select=id,name,company,status,pipeline_stage,company_id,deleted_at&limit=5000"),
      supabaseRest<any[]>("companies?select=id,name,status&limit=5000"),
      supabaseRest<any[]>("customers?select=id,company_id,source_lead_id&limit=5000")
    ]);
    const issues = auditConvertedLeads(leads, companies, customers);
    return NextResponse.json({ ok: true, checked: leads.length, issues });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}
