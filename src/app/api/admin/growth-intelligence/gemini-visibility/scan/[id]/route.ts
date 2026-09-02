import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig } from "@/lib/supabase";
import { getScanWithAnswers } from "@/lib/gemini-visibility/scan";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("growth-intelligence");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const { id } = await params;
  try {
    const { scan, answers } = await getScanWithAnswers(id);
    return NextResponse.json({ scan, answers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tarama bulunamadı.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
