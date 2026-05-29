import { NextResponse } from "next/server";
import { getSiteContent, saveSiteContent } from "@/lib/content";
import { isAdminAuthenticated } from "@/lib/auth";
import type { Lead, LeadStatus } from "@/lib/types";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const statuses: LeadStatus[] = ["Yeni", "Görüşülecek", "Teklif Hazırlanıyor", "Teklif Gönderildi", "Takipte", "Kazanıldı", "Kaybedildi"];

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
  const payload = await request.json();
  if (hasSupabaseConfig()) {
    const rows = await supabaseRest("leads", {
      method: "POST",
      body: JSON.stringify({
        source: payload.source === "contact" ? "contact" : "quote",
        name: payload.name || "",
        company: payload.company || "",
        phone: payload.phone || "",
        email: payload.email || "",
        instagram: payload.instagram || "",
        website: payload.website || "",
        business_type: payload.businessType || "",
        goal: payload.goal || "",
        budget: payload.budget || "",
        recommended_package: payload.recommendedPackage || "",
        message: payload.note || "",
        status: "Yeni"
      })
    });
    return NextResponse.json({ ok: true, lead: Array.isArray(rows) ? rows[0] : rows });
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
    businessType: payload.businessType || "",
    goal: payload.goal || "",
    budget: payload.budget || "",
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
