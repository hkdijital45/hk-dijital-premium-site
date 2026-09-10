import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { supabaseRest, getSafeSupabaseError } from "@/lib/supabase";
import { SOCIAL_WORKSPACE_ID } from "@/lib/social-autopilot/types";
import type { PrivacyBlacklistEntry } from "@/lib/social-autopilot/types";

const VALID_KINDS = new Set(["name", "handle", "domain", "phone", "email"]);

export async function GET() {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  try {
    const entries = await supabaseRest<PrivacyBlacklistEntry[]>(`social_privacy_blacklist?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&order=created_at.desc`);
    return NextResponse.json({ entries });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.value !== "string" || !body.value.trim() || !VALID_KINDS.has(body.kind)) {
    return NextResponse.json({ error: "value ve geçerli bir kind (name/handle/domain/phone/email) zorunludur." }, { status: 400 });
  }
  try {
    const rows = await supabaseRest<PrivacyBlacklistEntry[]>("social_privacy_blacklist", {
      method: "POST",
      body: JSON.stringify({ workspace_id: SOCIAL_WORKSPACE_ID, kind: body.kind, value: body.value.trim(), label: body.label || "" })
    });
    return NextResponse.json({ entry: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== "string") return NextResponse.json({ error: "id zorunludur." }, { status: 400 });
  try {
    const rows = await supabaseRest<PrivacyBlacklistEntry[]>(`social_privacy_blacklist?id=eq.${encodeURIComponent(body.id)}&select=*`, {
      method: "PATCH", body: JSON.stringify({ active: Boolean(body.active) })
    });
    return NextResponse.json({ entry: rows[0] || null });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
