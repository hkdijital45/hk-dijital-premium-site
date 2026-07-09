/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { requireModuleAccess } from "@/lib/permissions";
import { CUSTOMER_MODULE_REGISTRY, CUSTOMER_PLATFORM_REGISTRY, normalizeModuleKeys, normalizePlatformKeys } from "@/lib/customer-portal-registry";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { uuidPattern } from "@/lib/meta-pixel-admin";

async function loadIntegration(companyId: string) {
  const rows = await supabaseRest<any[]>(`customer_integrations?company_id=eq.${encodeURIComponent(companyId)}&select=*&limit=1`).catch(() => []);
  return rows[0] || null;
}

function settingsFrom(row: any = {}) {
  const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    enabled_platforms: normalizePlatformKeys(metadata.enabled_platforms),
    enabled_customer_modules: normalizeModuleKeys(metadata.enabled_customer_modules),
    updated_at: metadata.portal_settings_updated_at || row?.updated_at || null
  };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("musteriler");
  if (!session) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  try {
    const row = await loadIntegration(id);
    return NextResponse.json({
      ok: true,
      settings: settingsFrom(row),
      platforms: CUSTOMER_PLATFORM_REGISTRY,
      modules: CUSTOMER_MODULE_REGISTRY
    });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("musteriler");
  if (!session) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const enabledPlatforms = normalizePlatformKeys(body.enabled_platforms);
  const enabledModules = normalizeModuleKeys(body.enabled_customer_modules);

  try {
    const companyRows = await supabaseRest<any[]>(`companies?id=eq.${encodeURIComponent(id)}&select=id,name&limit=1`);
    if (!companyRows[0]) return NextResponse.json({ error: "Müşteri kaydı bulunamadı." }, { status: 404 });

    const existing = await loadIntegration(id);
    const metadata = {
      ...(existing?.metadata && typeof existing.metadata === "object" ? existing.metadata : {}),
      enabled_platforms: enabledPlatforms,
      enabled_customer_modules: enabledModules,
      portal_settings_updated_at: new Date().toISOString(),
      portal_settings_updated_by: session.profileId || null
    };

    const rows = await supabaseRest<any[]>("customer_integrations?on_conflict=company_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        company_id: id,
        metadata,
        updated_by: session.profileId || null,
        created_by: existing?.created_by || session.profileId || null,
        updated_at: new Date().toISOString()
      })
    });

    await recordActivity({
      session,
      action: "Güncelleme",
      entity: "Müşteri Panel Yetkileri",
      entityId: id,
      companyId: id,
      details: {
        message: `${companyRows[0].name || "Müşteri"} için platform ve panel yetkileri güncellendi.`,
        enabled_platforms: enabledPlatforms,
        enabled_customer_modules: enabledModules
      }
    }).catch(() => null);

    return NextResponse.json({ ok: true, integration: rows[0], settings: settingsFrom(rows[0]), message: "Müşteri platform ve panel yetkileri kaydedildi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}
