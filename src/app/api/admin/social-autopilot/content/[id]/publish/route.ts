import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError } from "@/lib/supabase";
import { execute } from "@/lib/social-autopilot/control/services";
import { ControlError } from "@/lib/social-autopilot/control/protocol";

// Controlled manual "publish now" action — reuses the exact same
// instagram_publish_now tool Claude MCP calls, including its
// publicationAllowed() precheck (NODE_ENV=production AND
// INSTAGRAM_PUBLISH_ENABLED=true AND test_mode off), so this can never send
// a real Instagram publish during development or with test mode active.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json({ result: await execute("instagram_publish_now", { id }) });
  } catch (error) {
    if (error instanceof ControlError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
