import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError } from "@/lib/supabase";
import { regenerateContentItem } from "@/lib/social-autopilot/orchestrator";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json({ result: await regenerateContentItem(id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : getSafeSupabaseError(error).detail }, { status: 400 });
  }
}
