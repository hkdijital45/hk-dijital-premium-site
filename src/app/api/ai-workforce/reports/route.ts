import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { AI_WORKFORCE_MODULE } from "@/lib/ai-workforce-schema";

// Reads the existing `reports` table (shared with HK Admin's Rapor Merkezi /
// Müşteri Keşfi reports) rather than a separate AI Workforce reports table.
export async function GET() {
  const session = await requireModuleAccess(AI_WORKFORCE_MODULE);
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ reports: [] });

  const reports = await supabaseRest<unknown[]>(
    "reports?select=id,company_id,report_type,source_module,source_identifier,created_at,updated_at&order=created_at.desc&limit=100"
  ).catch(() => []);
  return NextResponse.json({ reports });
}
