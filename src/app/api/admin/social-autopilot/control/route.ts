import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError } from "@/lib/supabase";
import { execute } from "@/lib/social-autopilot/control/services";
import { ControlError } from "@/lib/social-autopilot/control/protocol";

const ACTIONS = new Set(["autopilot_pause", "autopilot_resume"]);

// Dashboard's "OTOMATİK YAYINI DURDUR" emergency-stop button and its resume
// counterpart. autopilot_pause sets emergency_pause=true, which
// publication-safety.ts's publicationAllowed() checks on every single
// precheck (queue processing AND instagram_publish_now) — so this takes
// effect immediately, before any in-flight or future publish attempt.
export async function POST(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "";
  if (!ACTIONS.has(action)) return NextResponse.json({ error: "Geçersiz aksiyon." }, { status: 400 });
  try {
    return NextResponse.json({ result: await execute(action, {}) });
  } catch (error) {
    if (error instanceof ControlError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
