/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { uuidPattern } from "@/lib/meta-pixel-admin";

const editableFields = [
  "branch_name",
  "city",
  "district",
  "address",
  "phone",
  "whatsapp",
  "email",
  "google_maps_url",
  "website_url",
  "landing_page_url",
  "meta_ad_account_id",
  "google_ads_customer_id",
  "ga4_property_id",
  "search_console_site_url",
  "gtm_container_id",
  "monthly_ad_budget",
  "monthly_service_fee",
  "responsible_person",
  "status",
  "notes"
] as const;

function cleanString(value: unknown) {
  return String(value ?? "").trim();
}

function cleanNumber(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[^0-9,.-]/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStatus(value: unknown) {
  const raw = cleanString(value).toLocaleLowerCase("tr");
  if (["pasif", "passive", "inactive"].includes(raw)) return "passive";
  if (["kontrol gerekli", "kontrol", "needs_review", "review"].includes(raw)) return "needs_review";
  return "active";
}

function validatePayload(body: Record<string, any>) {
  const errors: string[] = [];
  if (body.branch_name !== undefined && !cleanString(body.branch_name)) errors.push("Şube adı boş bırakılamaz.");
  const email = cleanString(body.email);
  const maps = cleanString(body.google_maps_url);
  const website = cleanString(body.website_url);
  const landing = cleanString(body.landing_page_url);
  const searchConsole = cleanString(body.search_console_site_url);
  const gtm = cleanString(body.gtm_container_id);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("E-posta adresi geçerli görünmüyor.");
  for (const [label, value] of [["Google Maps URL", maps], ["Web sitesi", website], ["Landing Page URL", landing], ["Search Console URL", searchConsole]] as const) {
    if (value && !/^https?:\/\//i.test(value)) errors.push(`${label} http:// veya https:// ile başlamalı.`);
  }
  if (gtm && !gtm.startsWith("GTM-")) errors.push("GTM ID GTM- ile başlamalı.");
  return errors;
}

function patchPayload(body: Record<string, any>, profileId?: string | null) {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: profileId || null
  };
  for (const field of editableFields) {
    if (!(field in body)) continue;
    if (field === "monthly_ad_budget" || field === "monthly_service_fee") payload[field] = cleanNumber(body[field]);
    else if (field === "status") payload[field] = normalizeStatus(body[field]);
    else payload[field] = cleanString(body[field]);
  }
  if ("status" in payload) payload.is_active = payload.status !== "passive";
  return payload;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string; branchId: string }> }) {
  const session = await requireModuleAccess("musteriler");
  if (!session) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  const { id, branchId } = await context.params;
  if (!uuidPattern.test(id) || !uuidPattern.test(branchId)) return NextResponse.json({ error: "Geçerli bir müşteri ve şube seçin." }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const errors = validatePayload(body);
  if (errors.length) return NextResponse.json({ error: "Form doğrulama hatası", details: errors }, { status: 400 });
  try {
    const rows = await supabaseRest<any[]>(`customer_branches?id=eq.${encodeURIComponent(branchId)}&company_id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patchPayload(body, session.profileId || null))
    });
    const branch = rows[0];
    if (!branch) return NextResponse.json({ error: "Şube kaydı bulunamadı." }, { status: 404 });
    await recordActivity({
      session,
      action: "Güncelleme",
      entity: "Müşteri Şubesi",
      entityId: branchId,
      companyId: id,
      details: { message: "Müşteri şubesi güncellendi.", branch_name: branch.branch_name, status: branch.status, result: "Başarılı" }
    }).catch(() => null);
    return NextResponse.json({ ok: true, branch, message: branch.status === "passive" ? "Şube pasife alındı." : "Şube güncellendi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}
