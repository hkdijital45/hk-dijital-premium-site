/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const blockedFields = new Set([
  "access_token_encrypted",
  "refresh_token_encrypted",
  "login_password",
  "sensitive_metadata"
]);

function sanitize(row: any = {}) {
  const next: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!blockedFields.has(key)) next[key] = value;
  }
  next.customer_id = row.customer_id || row.company_id || "";
  return next;
}

function sanitizeAsset(asset: any = {}) {
  const next: Record<string, any> = {};
  for (const [key, value] of Object.entries(asset)) {
    if (!blockedFields.has(key)) next[key] = value;
  }
  return next;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("musteriler");
  if (!session) {
    return NextResponse.json({ error: "Bu işlem için admin yetkisi gerekir." }, { status: 403 });
  }
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ integrations: [], assets: [], warning: "Supabase bağlantısı yapılandırılmadı." });
  }

  const { id } = await context.params;
  try {
    const rows = await supabaseRest<any[]>(`customer_integrations?company_id=eq.${encodeURIComponent(id)}&select=*&order=updated_at.desc`);
    const integrations = rows.map(sanitize);
    const assets = integrations.flatMap((row) => Array.isArray(row.integration_assets) ? row.integration_assets.map(sanitizeAsset) : []);
    return NextResponse.json({
      ok: true,
      customerId: id,
      integrations,
      assets,
      count: integrations.length,
      assetCount: assets.length,
      message: integrations.length ? "Müşteri entegrasyonları alındı." : "Bu müşteriye bağlı hesap bulunamadı."
    });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail, integrations: [], assets: [] }, { status: 500 });
  }
}
