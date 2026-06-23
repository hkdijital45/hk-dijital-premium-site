/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { decryptSecret, encryptSecret, maskedSecretState } from "./secret-storage";
import { supabaseRest } from "./supabase";

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function safePixelSettings(row: any = {}) {
  return {
    id: row.id || null,
    company_id: row.company_id || null,
    provider: "meta",
    pixel_id: row.pixel_id || "",
    dataset_id: row.dataset_id || "",
    test_event_code: row.test_event_code || "",
    pixel_enabled: Boolean(row.pixel_enabled),
    capi_enabled: Boolean(row.capi_enabled),
    pixel_status: row.pixel_status || "Bekliyor",
    capi_status: row.capi_status || "Bekliyor",
    last_pixel_test_at: row.last_pixel_test_at || null,
    last_capi_test_at: row.last_capi_test_at || null,
    last_event_at: row.last_event_at || null,
    sync_message: row.sync_message || "",
    token_state: maskedSecretState(row.conversion_api_token_encrypted),
    token_saved: Boolean(row.conversion_api_token_encrypted)
  };
}

export async function getCompanyPixelSettings(companyId: string) {
  const rows = await supabaseRest<any[]>(`ad_integrations?company_id=eq.${companyId}&provider=eq.meta&select=*&limit=1`);
  return rows[0] || null;
}

export async function saveCompanyPixelSettings(body: any) {
  const current = await getCompanyPixelSettings(body.company_id);
  const encryptedToken = String(body.conversion_api_token || "").trim()
    ? encryptSecret(String(body.conversion_api_token).trim())
    : current?.conversion_api_token_encrypted || null;
  const payload = {
    company_id: body.company_id,
    provider: "meta",
    pixel_id: String(body.pixel_id || "").trim() || null,
    dataset_id: String(body.dataset_id || "").trim() || null,
    conversion_api_token_encrypted: encryptedToken,
    test_event_code: String(body.test_event_code || "").trim() || null,
    pixel_enabled: Boolean(body.pixel_enabled),
    capi_enabled: Boolean(body.capi_enabled),
    updated_at: new Date().toISOString()
  };
  const rows = await supabaseRest<any[]>("ad_integrations?on_conflict=company_id,provider", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload)
  });
  return rows[0];
}

export async function updatePixelTestState(companyId: string, patch: Record<string, unknown>) {
  const rows = await supabaseRest<any[]>(`ad_integrations?company_id=eq.${companyId}&provider=eq.meta`, {
    method: "PATCH",
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
  });
  return rows[0];
}

export async function logPixelTest(companyId: string, source: string, result: string, message: string) {
  await supabaseRest("integration_sync_logs", {
    method: "POST",
    body: JSON.stringify({ company_id: companyId, provider: "meta", source, result, message })
  }).catch(() => undefined);
}

export async function sendMetaTestEvent(row: any, website = "https://www.hkdijital.com.tr") {
  const datasetId = row.dataset_id || row.pixel_id;
  if (!datasetId) throw new Error("Pixel ID veya Dataset ID eksik.");
  if (!row.conversion_api_token_encrypted) throw new Error("Conversion API token eksik.");
  if (!row.test_event_code) throw new Error("Test Event Code eksik.");
  const accessToken = decryptSecret(row.conversion_api_token_encrypted);
  if (!accessToken) throw new Error("Conversion API token çözümlenemedi.");
  const eventTime = Math.floor(Date.now() / 1000);
  const testEmailHash = createHash("sha256").update("pixel-test@hkdijital.invalid").digest("hex");
  const response = await fetch(`https://graph.facebook.com/v22.0/${encodeURIComponent(datasetId)}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: accessToken,
      test_event_code: row.test_event_code,
      data: [{
        event_name: "Lead",
        event_time: eventTime,
        action_source: "website",
        event_source_url: website,
        user_data: { em: [testEmailHash] },
        custom_data: { test_event: true, source: "HK Operating System" }
      }]
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || "Meta API hatası";
    if (message.toLocaleLowerCase("tr").includes("permission")) throw new Error("Yetki eksik. Meta token izinlerini kontrol edin.");
    throw new Error(message);
  }
  return data;
}
