/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { uuidPattern } from "@/lib/meta-pixel-admin";

const allowedFields = [
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
  if (!cleanString(body.branch_name)) errors.push("Şube adı zorunludur.");
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

function branchPayload(companyId: string, body: Record<string, any>, profileId?: string | null) {
  const payload: Record<string, unknown> = {
    company_id: companyId,
    updated_at: new Date().toISOString()
  };
  for (const field of allowedFields) {
    if (field === "monthly_ad_budget" || field === "monthly_service_fee") payload[field] = cleanNumber(body[field]);
    else if (field === "status") payload[field] = normalizeStatus(body[field]);
    else payload[field] = cleanString(body[field]);
  }
  payload.is_active = payload.status !== "passive";
  payload.updated_by = profileId || null;
  return payload;
}

async function companyExists(companyId: string) {
  const rows = await supabaseRest<any[]>(`companies?id=eq.${encodeURIComponent(companyId)}&select=id,name&limit=1`);
  return rows[0] || null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("musteriler");
  if (!session) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  try {
    const company = await companyExists(id);
    if (!company) return NextResponse.json({ error: "Müşteri kaydı bulunamadı." }, { status: 404 });
    const branches = await supabaseRest<any[]>(`customer_branches?company_id=eq.${encodeURIComponent(id)}&select=*&order=branch_name.asc`);
    return NextResponse.json({ ok: true, branches });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("musteriler");
  if (!session) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const errors = validatePayload(body);
  if (errors.length) return NextResponse.json({ error: "Form doğrulama hatası", details: errors }, { status: 400 });
  try {
    const company = await companyExists(id);
    if (!company) return NextResponse.json({ error: "Müşteri kaydı bulunamadı." }, { status: 404 });
    const payload = {
      ...branchPayload(id, body, session.profileId || null),
      created_by: session.profileId || null,
      created_at: new Date().toISOString()
    };
    const rows = await supabaseRest<any[]>("customer_branches", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    await recordActivity({
      session,
      action: "Ekleme",
      entity: "Müşteri Şubesi",
      entityId: rows[0]?.id,
      companyId: id,
      details: { message: "Müşteri şubesi eklendi.", branch_name: rows[0]?.branch_name, result: "Başarılı" }
    }).catch(() => null);
    return NextResponse.json({ ok: true, branch: rows[0], message: "Şube kaydedildi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}
