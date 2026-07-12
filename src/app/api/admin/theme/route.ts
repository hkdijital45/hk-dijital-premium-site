import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

const colorPattern = /^#[0-9a-f]{6}$/i;
const themeKeys = ["background", "surface", "text", "mutedText", "primaryButton", "secondaryButton", "accent", "sidebar", "header", "border", "success", "warning", "danger"];

export async function GET() {
  const session = await requireModuleAccess("tema-ayarlari");
  if (!session) return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  const rows = await supabaseRest<Array<{ value?: unknown }>>("site_settings?key=eq.admin_theme&select=value&limit=1").catch(() => []);
  return NextResponse.json({ theme: rows[0]?.value || null });
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("tema-ayarlari");
  if (!session) return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  const input = await request.json().catch(() => ({}));
  const theme = Object.fromEntries([
    ["name", String(input.name || "HK Cyan").slice(0, 40)],
    ["scope", Array.isArray(input.scope) ? input.scope.map(String).filter((item: string) => ["website", "login", "admin", "customer"].includes(item)) : ["website", "login", "admin", "customer"]],
    ...themeKeys.map((key) => [key, colorPattern.test(String(input[key] || "")) ? input[key] : undefined])
  ].filter(([, value]) => value !== undefined));
  try {
    const rows = await supabaseRest<Array<{ value?: unknown }>>("site_settings?on_conflict=key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ key: "admin_theme", value: theme, updated_at: new Date().toISOString() })
    });
    await recordActivity({ session, action: "Güncelleme", entity: "Tema Ayarları", details: { message: "Admin teması güncellendi" } });
    return NextResponse.json({ ok: true, theme: rows[0]?.value || theme, message: "Tema ayarları kaydedildi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}
