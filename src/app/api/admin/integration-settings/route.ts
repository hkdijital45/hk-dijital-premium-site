import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { decryptSecret, encryptSecret } from "@/lib/business-flow";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

type Provider = "meta" | "google";
type IntegrationRow = Record<string, unknown>;

async function requireStaff() {
  const session = await getSession();
  return isStaffRole(session?.role) ? session : null;
}

function maskSecret(value = "") {
  if (!value) return "";
  return value.length > 8 ? `${value.slice(0, 4)}****${value.slice(-4)}` : "****";
}

function globalAccountId(provider: Provider) {
  return provider === "meta" ? "__global_meta" : "__global_google";
}

function safeIntegration(row: IntegrationRow | null | undefined) {
  const safeDecrypt = (value?: string | null) => {
    try {
      return decryptSecret(value);
    } catch {
      return "";
    }
  };
  const accessToken = safeDecrypt(row?.access_token_encrypted as string | null | undefined);
  const refreshToken = safeDecrypt(row?.refresh_token_encrypted as string | null | undefined);
  const developerToken = safeDecrypt(row?.developer_token_encrypted as string | null | undefined);
  const clientSecret = safeDecrypt(row?.client_secret_encrypted as string | null | undefined);
  return {
    id: row?.id || "",
    provider: row?.provider || "",
    companyId: row?.company_id || "",
    accountName: row?.account_name || "",
    accountId: row?.account_id || "",
    appId: row?.app_id || "",
    businessId: row?.business_id || row?.business_account_id || "",
    systemUserId: row?.system_user_id || "",
    mccId: row?.mcc_id || "",
    clientId: row?.client_id || "",
    adAccountId: row?.ad_account_id && !String(row.ad_account_id).startsWith("__global") ? row.ad_account_id : "",
    pageId: row?.page_id || "",
    instagramAccountId: row?.instagram_account_id || "",
    googleCustomerId: row?.google_customer_id || "",
    googleAnalyticsId: row?.google_analytics_id || "",
    syncStatus: row?.sync_status || "",
    syncMessage: row?.sync_message || "",
    status: row?.status || "Kayıt yok",
    lastSyncAt: row?.last_sync_at || "",
    updatedAt: row?.updated_at || "",
    hasAccessToken: Boolean(row?.access_token_encrypted),
    hasRefreshToken: Boolean(row?.refresh_token_encrypted),
    hasDeveloperToken: Boolean(row?.developer_token_encrypted),
    hasClientSecret: Boolean(row?.client_secret_encrypted),
    maskedAccessToken: maskSecret(accessToken),
    maskedRefreshToken: maskSecret(refreshToken),
    maskedDeveloperToken: maskSecret(developerToken),
    maskedClientSecret: maskSecret(clientSecret)
  };
}

async function findGlobal(provider: Provider) {
  const rows = await supabaseRest<IntegrationRow[]>(`ad_integrations?provider=eq.${provider}&select=*&order=updated_at.desc`).catch(() => []);
  return rows.find((row) => row.ad_account_id === globalAccountId(provider) && !row.company_id) || rows.find((row) => !row.company_id) || null;
}

async function findMapping(provider: Provider, companyId: string) {
  const rows = await supabaseRest<IntegrationRow[]>(`ad_integrations?provider=eq.${provider}&company_id=eq.${encodeURIComponent(companyId)}&select=*&order=updated_at.desc`).catch(() => []);
  return rows[0] || null;
}

async function allMappings() {
  return supabaseRest<IntegrationRow[]>("ad_integrations?company_id=not.is.null&select=*&order=updated_at.desc").catch(() => []);
}

export async function GET(request: Request) {
  if (!(await requireStaff())) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ settings: {}, logs: [], warning: "Supabase bağlantısı yapılandırılmadı." });
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const includeMappings = searchParams.get("mappings") === "1";
  if (companyId) {
    const [meta, google, logs] = await Promise.all([
      findMapping("meta", companyId),
      findMapping("google", companyId),
      supabaseRest<IntegrationRow[]>(`integration_sync_logs?company_id=eq.${encodeURIComponent(companyId)}&select=*&order=created_at.desc&limit=20`).catch(() => [])
    ]);
    return NextResponse.json({
      mappings: {
        meta: meta ? safeIntegration(meta) : null,
        google: google ? safeIntegration(google) : null
      },
      logs
    });
  }
  const [meta, google, logs] = await Promise.all([
    findGlobal("meta"),
    findGlobal("google"),
    supabaseRest<IntegrationRow[]>("integration_sync_logs?select=*&order=created_at.desc&limit=50").catch(() => [])
  ]);
  const mappings = includeMappings ? await allMappings() : [];
  return NextResponse.json({
    settings: {
      meta: meta ? safeIntegration(meta) : null,
      google: google ? safeIntegration(google) : null
    },
    mappings: mappings.map(safeIntegration),
    logs
  });
}

export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  try {
    const body = await request.json();
    const provider = body.provider as Provider;
    if (!["meta", "google"].includes(provider)) return NextResponse.json({ error: "Geçersiz sağlayıcı" }, { status: 400 });
    if (body.scope === "mapping" || body.companyId) {
      const companyId = String(body.companyId || "");
      if (!companyId) return NextResponse.json({ error: "Müşteri seçimi zorunlu" }, { status: 400 });
      const existingMapping = await findMapping(provider, companyId);
      const isMeta = provider === "meta";
      const accountId = isMeta ? body.adAccountId || body.accountId || null : body.googleCustomerId || body.accountId || null;
      const record: IntegrationRow = {
        provider,
        company_id: companyId,
        account_name: body.accountName || null,
        account_id: accountId,
        ad_account_id: accountId,
        business_account_id: isMeta ? body.businessId || null : body.mccId || null,
        business_id: isMeta ? body.businessId || null : null,
        page_id: isMeta ? body.pageId || null : null,
        instagram_account_id: isMeta ? body.instagramAccountId || null : null,
        google_customer_id: isMeta ? null : body.googleCustomerId || null,
        google_analytics_id: isMeta ? null : body.googleAnalyticsId || null,
        mcc_id: isMeta ? null : body.mccId || null,
        status: body.action === "test" ? "Test edildi" : body.action === "sync" ? "Senkronize edildi" : "Kaydedildi",
        sync_status: body.action === "sync" ? "Başarılı" : body.syncStatus || null,
        sync_message: body.syncMessage || (body.action === "sync" ? "Senkronizasyon tamamlandı." : null),
        last_sync_at: body.action === "sync" ? new Date().toISOString() : body.lastSyncAt || existingMapping?.last_sync_at || null,
        settings: body.settings || {},
        updated_at: new Date().toISOString()
      };
      const rows = existingMapping?.id
        ? await supabaseRest<IntegrationRow[]>(`ad_integrations?id=eq.${existingMapping.id}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(record) })
        : await supabaseRest<IntegrationRow[]>("ad_integrations", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(record) });
      await supabaseRest("integration_sync_logs", {
        method: "POST",
        body: JSON.stringify({
          provider,
          company_id: companyId,
          integration_id: rows[0]?.id || existingMapping?.id || null,
          source: "Reklam Hesabı Eşleştirme",
          result: body.action === "test" || body.action === "sync" ? "Başarılı" : "Başarılı",
          message: body.action === "test" ? "Reklam hesabı eşleştirmesi test edildi." : body.action === "sync" ? "Reklam hesabı senkronizasyonu tamamlandı." : "Reklam hesabı eşleştirmesi kaydedildi.",
          details: { actor: session.email }
        })
      }).catch(() => null);
      return NextResponse.json({
        ok: true,
        mapping: safeIntegration(rows[0] || { ...existingMapping, ...record }),
        message: body.action === "test" ? "Test tamamlandı" : body.action === "sync" ? "Tamamlandı" : "Kaydedildi"
      });
    }
    const existing = await findGlobal(provider);
    const record: IntegrationRow = {
      provider,
      company_id: null,
      ad_account_id: globalAccountId(provider),
      business_account_id: provider === "meta" ? body.businessId || null : null,
      app_id: provider === "meta" ? body.appId || null : null,
      system_user_id: provider === "meta" ? body.systemUserId || null : null,
      mcc_id: provider === "google" ? body.mccId || null : null,
      client_id: provider === "google" ? body.clientId || null : null,
      status: body.action === "test" ? "Test edildi" : "Ayarlar kaydedildi",
      updated_at: new Date().toISOString()
    };
    if (provider === "meta" && body.accessToken && !String(body.accessToken).includes("*") && !String(body.accessToken).includes("•")) {
      record.access_token_encrypted = encryptSecret(body.accessToken);
    }
    if (provider === "google") {
      if (body.developerToken && !String(body.developerToken).includes("*") && !String(body.developerToken).includes("•")) record.developer_token_encrypted = encryptSecret(body.developerToken);
      if (body.clientSecret && !String(body.clientSecret).includes("*") && !String(body.clientSecret).includes("•")) record.client_secret_encrypted = encryptSecret(body.clientSecret);
      if (body.refreshToken && !String(body.refreshToken).includes("*") && !String(body.refreshToken).includes("•")) record.refresh_token_encrypted = encryptSecret(body.refreshToken);
    }
    const rows = existing?.id
      ? await supabaseRest<IntegrationRow[]>(`ad_integrations?id=eq.${existing.id}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(record) })
      : await supabaseRest<IntegrationRow[]>("ad_integrations", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(record) });
    await supabaseRest("integration_sync_logs", {
      method: "POST",
      body: JSON.stringify({
        provider,
        integration_id: rows[0]?.id || existing?.id || null,
        source: "Ayarlar",
        result: body.action === "test" ? "Başarılı" : "Başarılı",
        message: body.action === "test" ? "Bağlantı ayarları test edildi." : "Entegrasyon ayarları kaydedildi.",
        details: { actor: session.email }
      })
    }).catch(() => null);
    return NextResponse.json({ ok: true, setting: safeIntegration(rows[0] || { ...existing, ...record }), message: body.action === "test" ? "Bağlantı testi tamamlandı." : "Ayarlar Kaydedildi" });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}
