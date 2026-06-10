/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { adminNavigationItems, getAdminHref } from "@/lib/admin-navigation";
import { getAllowedModules, requireModuleAccess } from "@/lib/permissions";
import { supabaseRest } from "@/lib/supabase";

function includes(value: unknown, query: string) {
  return String(value || "").toLocaleLowerCase("tr").includes(query);
}

export async function GET(request: Request) {
  const session = await requireModuleAccess("genel-arama");
  if (!session) return NextResponse.json({ error: "Bu sayfaya erişim yetkiniz yok." }, { status: 403 });
  const query = new URL(request.url).searchParams.get("q")?.trim().toLocaleLowerCase("tr") || "";
  if (query.length < 2) return NextResponse.json({ results: [] });
  const allowed = getAllowedModules(session);
  const results: any[] = adminNavigationItems
    .filter((item) => allowed.includes(item.module))
    .filter((item) => includes(item.label, query))
    .map((item) => ({ id: `module-${item.slug || "dashboard"}`, type: "Modül", title: item.label, detail: "Yönetim modülü", href: getAdminHref(item.slug) }));
  try {
    const [leads, companies, reports, users] = await Promise.all([
      allowed.includes("leads") ? supabaseRest<any[]>("leads?select=*&order=created_at.desc&limit=100") : [],
      allowed.includes("musteriler") ? supabaseRest<any[]>("companies?select=*&order=created_at.desc&limit=100") : [],
      allowed.includes("raporlar") ? supabaseRest<any[]>("reports?select=*&order=created_at.desc&limit=100") : [],
      allowed.includes("kullanicilar") ? supabaseRest<any[]>("users?deleted_at=is.null&select=id,full_name,email,role,is_active&order=created_at.desc&limit=100") : []
    ]);
    leads.filter((lead) => includes(`${lead.name} ${lead.company} ${lead.phone} ${lead.email} ${lead.notes} ${JSON.stringify(lead.proposal_history || [])}`, query)).slice(0, 8).forEach((lead) => results.push({ id: `lead-${lead.id}`, type: "Lead", title: lead.company || lead.name || "İsimsiz başvuru", detail: lead.phone || lead.email || lead.status, href: "/hk-admin/leads" }));
    companies.filter((company) => includes(`${company.name} ${company.sector} ${company.city} ${company.notes}`, query)).slice(0, 8).forEach((company) => results.push({ id: `company-${company.id}`, type: "Müşteri", title: company.name, detail: `${company.sector || "Sektör yok"} · ${company.city || "Şehir yok"}`, href: "/hk-admin/musteriler" }));
    reports.filter((report) => includes(`${report.report_type} ${report.period} ${report.customer_note} ${report.internal_note}`, query)).slice(0, 8).forEach((report) => results.push({ id: `report-${report.id}`, type: "Rapor", title: report.report_type, detail: report.period || "Rapor dönemi belirtilmedi", href: "/hk-admin/raporlar" }));
    users.filter((user) => includes(`${user.full_name} ${user.email} ${user.role}`, query)).slice(0, 8).forEach((user) => results.push({ id: `user-${user.id}`, type: "Kullanıcı", title: user.full_name || user.email, detail: `${user.email} · ${user.role}`, href: "/hk-admin/kullanici-yonetimi" }));
  } catch (error) {
    console.error("[admin-search] Arama verileri yüklenemedi", error);
  }
  return NextResponse.json({ results: results.slice(0, 24) });
}
