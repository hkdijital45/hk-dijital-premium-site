/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { getSession, isStaffRole } from "@/lib/auth";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const allowedActions = new Set(["approve", "request_missing_info", "mark_invalid", "sync", "request_reauth", "deactivate", "view_details"]);
const secretKeys = new Set(["access_token", "refresh_token", "access_token_encrypted", "refresh_token_encrypted", "client_secret", "app_secret", "login_password"]);

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function safeObject(value: any): any {
  if (Array.isArray(value)) return value.map(safeObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !secretKeys.has(key) && !key.toLocaleLowerCase("tr-TR").includes("token") && !key.toLocaleLowerCase("tr-TR").includes("secret"))
    .map(([key, item]) => [key, safeObject(item)]));
}

function assetKey(asset: any) {
  return clean(asset?.id)
    || `${clean(asset?.provider || asset?.platform)}-${clean(asset?.account_type || asset?.asset_type)}-${clean(asset?.provider_account_id || asset?.account_id || asset?.asset_id)}`;
}

function actionPatch(action: string, session: any) {
  const now = new Date().toISOString();
  const adminId = session?.profileId || null;
  if (action === "approve") return { status: "connected", admin_review_status: "approved", note: "Bağlantı onaylandı.", metadata: { reviewed_at: now, reviewed_by_admin: adminId, customer_visible_notice: "Bağlantı HK Dijital ekibi tarafından onaylandı." } };
  if (action === "request_missing_info") return { status: "missing_info_required", admin_review_status: "missing_info", note: "Eksik bilgi istendi.", metadata: { missing_info_requested_at: now, requested_by_admin: adminId, customer_visible_notice: "HK Dijital ekibi bu bağlantı için ek bilgi istedi." } };
  if (action === "mark_invalid") return { status: "invalid", admin_review_status: "error", note: "Bağlantı hatalı işaretlendi.", metadata: { invalid_at: now, marked_by_admin: adminId, customer_visible_notice: "Bu bağlantı hatalı görünüyor. Lütfen yeniden bağlayın veya bilgileri kontrol edin." } };
  if (action === "sync") return { status: undefined, admin_review_status: undefined, note: "Senkronizasyon kontrolü tamamlandı.", metadata: { last_sync_requested_at: now, last_sync_requested_by: adminId, last_sync_status: "sync_not_available", last_sync_message: "Bu bağlantı için güvenli senkronizasyon isteği kaydedildi. Gerçek provider API erişimi varsa ilgili servis katmanı veriyi çeker.", customer_visible_notice: "HK Dijital ekibi bağlantı senkronizasyonunu kontrol etti." }, last_synced_at: now };
  if (action === "request_reauth") return { status: "reauth_required", admin_review_status: "reauth_required", note: "Yetki yenileme isteği gönderildi.", metadata: { reauth_requested_at: now, requested_by_admin: adminId, customer_visible_notice: "Yetki yenileme gerekiyor. Lütfen hesabınızı yeniden bağlayın." } };
  if (action === "deactivate") return { status: "inactive", admin_review_status: "inactive", note: "Bağlantı pasifleştirildi.", metadata: { deactivated_at: now, deactivated_by_admin: adminId, customer_visible_notice: "Bu bağlantı HK Dijital tarafından geçici olarak pasifleştirildi." } };
  return { status: undefined, admin_review_status: undefined, note: "Bağlantı detayı hazırlandı.", metadata: {} };
}

async function requireStaff() {
  const session = await getSession();
  return session && isStaffRole(session.role) ? session : null;
}

export async function POST(request: Request, context: { params: Promise<{ id: string; integrationId: string }> }) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Bu işlem için admin yetkisi gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });

  const { id, integrationId } = await context.params;
  if (!uuidPattern.test(id) || !uuidPattern.test(integrationId)) return NextResponse.json({ error: "Geçerli müşteri ve bağlantı kaydı seçin." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const action = clean(body.action);
  if (!allowedActions.has(action)) return NextResponse.json({ error: "Geçerli bir bağlantı aksiyonu seçin." }, { status: 400 });

  try {
    const rows = await supabaseRest<any[]>(`customer_integrations?id=eq.${encodeURIComponent(integrationId)}&company_id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    const row = rows[0];
    if (!row) return NextResponse.json({ error: "Bağlantı kaydı bulunamadı." }, { status: 404 });

    const targetKey = clean(body.assetKey);
    const assets = Array.isArray(row.integration_assets) ? row.integration_assets : [];
    const targetAsset = targetKey ? assets.find((asset: any) => assetKey(asset) === targetKey) : null;
    const patch = actionPatch(action, session);
    const now = new Date().toISOString();
    const historyItem = { action, at: now, by: "admin", admin_id: session.profileId || null, note: clean(body.note || patch.note) };

    if (action === "view_details") {
      return NextResponse.json({
        ok: true,
        message: "Bağlantı detayı hazırlandı.",
        detail: safeObject(targetAsset || row)
      });
    }

    let nextAssets = assets;
    let rowPatch: Record<string, any> = { updated_at: now, updated_by: session.profileId || null };
    if (targetAsset) {
      nextAssets = assets.map((asset: any) => {
        if (assetKey(asset) !== targetKey) return asset;
        const metadata = { ...(asset.metadata || {}), ...(patch.metadata || {}) };
        metadata.action_history = [...(Array.isArray(metadata.action_history) ? metadata.action_history : []), historyItem].slice(-20);
        return {
          ...asset,
          ...(patch.status ? { status: patch.status } : {}),
          ...(patch.admin_review_status ? { admin_review_status: patch.admin_review_status } : {}),
          ...(patch.last_synced_at ? { last_synced_at: patch.last_synced_at } : {}),
          metadata,
          updated_at: now
        };
      });
      rowPatch.integration_assets = nextAssets;
    } else {
      const metadata = { ...(row.metadata || {}), ...(patch.metadata || {}) };
      metadata.action_history = [...(Array.isArray(metadata.action_history) ? metadata.action_history : []), historyItem].slice(-20);
      rowPatch = {
        ...rowPatch,
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.admin_review_status ? { admin_review_status: patch.admin_review_status } : {}),
        ...(patch.last_synced_at ? { last_synced_at: patch.last_synced_at } : {}),
        metadata
      };
    }

    const updated = await supabaseRest<any[]>(`customer_integrations?id=eq.${encodeURIComponent(integrationId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(rowPatch)
    });

    await recordActivity({
      session,
      action: "Güncelleme",
      entity: "Müşteri Bağlantı Bilgileri",
      entityId: integrationId,
      companyId: id,
      details: { message: patch.note, integration_action: action, asset_key: targetKey || null }
    }).catch(() => null);

    return NextResponse.json({
      ok: true,
      message: patch.note,
      credential: safeObject(updated[0]),
      detail: safeObject(targetAsset ? nextAssets.find((asset: any) => assetKey(asset) === targetKey) : updated[0])
    });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}
