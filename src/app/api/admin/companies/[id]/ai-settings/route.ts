import { NextResponse } from "next/server";
import { defaultAiContexts, getCustomerAiSettings, upsertCustomerAiSettings } from "@/lib/customer-ai-settings";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig } from "@/lib/supabase";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("musteriler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 403 });
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Müşteri ID zorunludur." }, { status: 400 });

  try {
    const settings = await getCustomerAiSettings(id);
    return NextResponse.json({ settings, contexts: defaultAiContexts, configured: hasSupabaseConfig() });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.detail }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("musteriler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 403 });
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Müşteri ID zorunludur." }, { status: 400 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });

  try {
    const body = await request.json().catch(() => ({}));
    const settings = await upsertCustomerAiSettings(id, {
      assistant_enabled: body.assistant_enabled !== false,
      real_ai_enabled: Boolean(body.real_ai_enabled),
      provider: String(body.provider || "demo"),
      allowed_contexts: Array.isArray(body.allowed_contexts) ? body.allowed_contexts.map(String) : ["general"],
      daily_message_limit: Number(body.daily_message_limit || 20),
      welcome_message: String(body.welcome_message || ""),
      admin_note: String(body.admin_note || "")
    });
    return NextResponse.json({ settings, message: "HK Asistan ayarları kaydedildi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.detail }, { status: 500 });
  }
}
