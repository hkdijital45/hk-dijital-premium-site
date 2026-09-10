import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError } from "@/lib/supabase";
import { getItem } from "@/lib/social-autopilot/control/content";
import { ControlError } from "@/lib/social-autopilot/control/protocol";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json({ item: await getItem(id) });
  } catch (error) {
    if (error instanceof ControlError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
