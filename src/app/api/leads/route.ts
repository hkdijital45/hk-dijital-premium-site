import { NextResponse } from "next/server";
import { getSiteContent, saveSiteContent } from "@/lib/content";
import { isAdminAuthenticated } from "@/lib/auth";
import type { Lead, LeadStatus } from "@/lib/types";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { isGenericBusinessCategory, sanitizeBusinessCategory } from "@/lib/business-category";
import { normalizePlatformSelection } from "@/lib/platform-selection";

const statuses: LeadStatus[] = ["Yeni", "Görüşülecek", "Teklif Hazırlanıyor", "Teklif Gönderildi", "Takipte", "Kazanıldı", "Kaybedildi", "Dönüştürüldü"];

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
  const content = await getSiteContent();
  if (hasSupabaseConfig()) {
    const leads = await supabaseRest("leads?select=*&order=created_at.desc");
    return NextResponse.json({ leads });
  }
  return NextResponse.json({ leads: content.leads ?? [] });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  if (payload.is_test === true) {
    return NextResponse.json({ error: "Test kaydı yalnızca admin tarafından oluşturulabilir." }, { status: 403 });
  }
  const name = String(payload.name || "").trim();
  const company = String(payload.company || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const phone = String(payload.phone || "").replace(/\D/g, "");
  if (!name && !company) return NextResponse.json({ error: "Ad soyad veya firma adı zorunludur." }, { status: 400 });
  if (!email && phone.length < 10) return NextResponse.json({ error: "Geçerli bir e-posta veya telefon numarası girin." }, { status: 400 });
  const source = payload.source === "contact" ? "İletişim Formu" : payload.source === "wizard" ? "Teklif Sihirbazı" : "Teklif Formu";
  if (source !== "İletişim Formu" && Object.prototype.hasOwnProperty.call(payload, "businessType") && isGenericBusinessCategory(payload.businessType)) {
    return NextResponse.json({ error: "Geçerli bir işletme sektörü belirtilmelidir." }, { status: 400 });
  }
  if (hasSupabaseConfig()) {
    try {
      const recentThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const contactFilter = email ? `email=eq.${encodeURIComponent(email)}` : `phone=eq.${encodeURIComponent(phone)}`;
      const existing = await supabaseRest<any[]>(`leads?${contactFilter}&source=eq.${encodeURIComponent(source)}&created_at=gte.${encodeURIComponent(recentThreshold)}&select=*&order=created_at.desc&limit=1`).catch(() => []);
      if (existing[0]) return NextResponse.json({ ok: true, lead: existing[0], duplicatePrevented: true, message: "Talebiniz daha önce alındı; ikinci kayıt oluşturulmadı." });
      const rows = await supabaseRest("leads", {
        method: "POST",
        body: JSON.stringify({
          source,
          name,
          company,
          phone,
          email,
          instagram: payload.instagram || "",
          website: payload.website || "",
          business_type: sanitizeBusinessCategory(payload.businessType),
          goal: payload.goal || "",
          budget: payload.budget || "",
          recommended_package: payload.recommendedPackage || "",
          requested_platforms: normalizePlatformSelection(payload.platforms ?? payload.platformNeed),
          message: payload.note || "",
          status: "Yeni"
        })
      });
      if (source === "İletişim Formu") {
        await supabaseRest("contact_forms", {
          method: "POST",
          body: JSON.stringify({
            name: payload.name || "",
            company: payload.company || "",
            phone: payload.phone || "",
            email: payload.email || "",
            message: payload.note || payload.message || "",
            source,
            status: "Yeni"
          })
        }).catch((error) => console.error("İletişim formu Supabase hatası:", error instanceof Error ? error.message : error));
      }
      return NextResponse.json({ ok: true, lead: Array.isArray(rows) ? rows[0] : rows });
    } catch (error) {
      const safeError = getSafeSupabaseError(error);
      console.error("Lead kaydı Supabase hatası:", safeError.detail);
      return NextResponse.json({ error: safeError.title, supabaseError: safeError.detail }, { status: 500 });
    }
  }

  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı. Canlı ortamda kaydetme çalışmaz." }, { status: 500 });
  }

  const content = await getSiteContent();
  const lead: Lead = {
    id: crypto.randomUUID(),
    source: payload.source === "contact" ? "contact" : "quote",
    name: payload.name || "",
    company: payload.company || "",
    phone: payload.phone || "",
    email: payload.email || "",
    instagram: payload.instagram || "",
    website: payload.website || "",
    businessType: sanitizeBusinessCategory(payload.businessType),
    goal: payload.goal || "",
    budget: payload.budget || "",
    requestedPlatforms: normalizePlatformSelection(payload.platforms ?? payload.platformNeed),
    recommendedPackage: payload.recommendedPackage || "",
    alternativePackage: payload.alternativePackage || "",
    note: payload.note || "",
    internalNotes: "",
    followUpDate: "",
    status: "Yeni",
    createdAt: new Date().toISOString()
  };
  content.leads = [lead, ...(content.leads ?? [])];
  await saveSiteContent(content);
  return NextResponse.json({ ok: true, lead });
}

export async function PUT(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
  const payload = await request.json();
  if (hasSupabaseConfig()) {
    await supabaseRest(`leads?id=eq.${payload.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: statuses.includes(payload.status) ? payload.status : undefined,
        notes: payload.internalNotes,
        follow_up_date: payload.followUpDate || null,
        updated_at: new Date().toISOString()
      })
    });
    return NextResponse.json({ ok: true });
  }
  const content = await getSiteContent();
  content.leads = (content.leads ?? []).map((lead) =>
    lead.id === payload.id
      ? {
          ...lead,
          status: statuses.includes(payload.status) ? payload.status : lead.status,
          internalNotes: payload.internalNotes ?? lead.internalNotes,
          followUpDate: payload.followUpDate ?? lead.followUpDate
        }
      : lead
  );
  await saveSiteContent(content);
  return NextResponse.json({ ok: true, leads: content.leads });
}
