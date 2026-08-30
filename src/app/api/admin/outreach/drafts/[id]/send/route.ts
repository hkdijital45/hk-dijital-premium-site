import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase";
import { sendOutreachDraft } from "@/lib/lead-outreach";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !isStaffRole(session.role)) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const { id } = await context.params;
  return NextResponse.json(await sendOutreachDraft(id));
}
