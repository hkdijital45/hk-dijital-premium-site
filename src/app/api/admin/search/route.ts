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
    const [leads, companies, campaigns, tasks, payments, documents, reports, logs, users] = await Promise.all([
      allowed.includes("leads") ? supabaseRest<any[]>("leads?select=*&order=created_at.desc&limit=100") : [],
      allowed.includes("musteriler") ? supabaseRest<any[]>("companies?select=*&order=created_at.desc&limit=100") : [],
      allowed.includes("kampanyalar") ? supabaseRest<any[]>("campaigns?select=*&order=created_at.desc&limit=100").catch(() => []) : [],
      allowed.includes("gorevler") ? supabaseRest<any[]>("agency_tasks?select=*&order=updated_at.desc&limit=100").catch(() => []) : [],
      allowed.includes("tahsilat") ? supabaseRest<any[]>("payment_records?select=*&order=updated_at.desc&limit=100").catch(() => []) : [],
      allowed.includes("belgeler") ? supabaseRest<any[]>("customer_documents?select=*&order=document_date.desc&limit=100").catch(() => []) : [],
      allowed.includes("raporlar") ? supabaseRest<any[]>("reports?select=*&order=created_at.desc&limit=100") : [],
      allowed.includes("sistem-loglari") ? supabaseRest<any[]>("activity_logs?deleted_at=is.null&select=*&order=created_at.desc&limit=100").catch(() => []) : [],
      allowed.includes("kullanicilar") ? supabaseRest<any[]>("users?deleted_at=is.null&select=id,full_name,email,role,is_active&order=created_at.desc&limit=100") : []
    ]);
    const companyName = (companyId?: string) => companies.find((company) => company.id === companyId)?.name || "";
    leads.filter((lead) => includes(`${lead.name} ${lead.company} ${lead.phone} ${lead.email} ${lead.notes} ${lead.status} ${lead.pipeline_stage} ${lead.next_action} ${JSON.stringify(lead.proposal_history || [])}`, query)).slice(0, 8).forEach((lead) => results.push({ id: `lead-${lead.id}`, type: "Lead", title: lead.company || lead.name || "İsimsiz başvuru", detail: `${lead.phone || lead.email || "İletişim yok"} · ${lead.pipeline_stage || lead.status || "Yeni Lead"}`, href: "/hk-admin/satis-hunisi" }));
    leads.flatMap((lead) => Array.isArray(lead.proposal_history) ? lead.proposal_history.map((proposal: any, index: number) => ({ ...proposal, lead, index })) : []).filter((proposal) => includes(`${proposal.title} ${proposal.text} ${proposal.package_type} ${proposal.lead?.company} ${proposal.lead?.name}`, query)).slice(0, 6).forEach((proposal) => results.push({ id: `proposal-${proposal.lead?.id}-${proposal.index}`, type: "Teklif", title: proposal.title || `${proposal.lead?.company || proposal.lead?.name || "Lead"} teklifi`, detail: proposal.package_type || proposal.created_at || "Teklif geçmişi", href: "/hk-admin/teklif-hazirlama" }));
    ["İlk temas", "Ücretsiz analiz", "Teklif takibi", "Ödeme hatırlatma", "Rapor bilgilendirme"].filter((template) => includes(template, query)).forEach((template) => results.push({ id: `whatsapp-template-${template}`, type: "WhatsApp Şablonu", title: template, detail: "Hazır temas mesajı", href: "/hk-admin/satis-hunisi" }));
    companies.filter((company) => includes(`${company.name} ${company.sector} ${company.city} ${company.notes}`, query)).slice(0, 8).forEach((company) => results.push({ id: `company-${company.id}`, type: "Müşteri", title: company.name, detail: `${company.sector || "Sektör yok"} · ${company.city || "Şehir yok"}`, href: "/hk-admin/musteriler" }));
    campaigns.filter((campaign) => includes(`${campaign.name} ${campaign.platform} ${campaign.objective} ${campaign.status} ${campaign.notes} ${companyName(campaign.company_id)}`, query)).slice(0, 8).forEach((campaign) => results.push({ id: `campaign-${campaign.id}`, type: "Kampanya", title: campaign.name || "İsimsiz kampanya", detail: `${companyName(campaign.company_id) || "Müşteri yok"} · ${campaign.platform || "Platform yok"} · ${campaign.status || "Durum yok"}`, href: "/hk-admin/kampanyalar" }));
    tasks.filter((task) => includes(`${task.title} ${task.description} ${task.notes} ${task.status} ${task.priority} ${companyName(task.company_id)}`, query)).slice(0, 8).forEach((task) => results.push({ id: `task-${task.id}`, type: "Görev", title: task.title || "İsimsiz görev", detail: `${companyName(task.company_id) || "Müşteri yok"} · ${task.status || "Durum yok"} · ${task.priority || "Öncelik yok"}`, href: "/hk-admin/gorevler" }));
    payments.filter((payment) => includes(`${payment.amount} ${payment.status} ${payment.service_period} ${payment.payment_note} ${companyName(payment.company_id)}`, query)).slice(0, 8).forEach((payment) => results.push({ id: `payment-${payment.id}`, type: "Tahsilat", title: `${Number(payment.amount || 0).toLocaleString("tr-TR")} TL`, detail: `${companyName(payment.company_id) || "Müşteri yok"} · ${payment.status || "Durum yok"} · ${payment.due_date || "Tarih yok"}`, href: "/hk-admin/tahsilat" }));
    documents.filter((document) => includes(`${document.title} ${document.document_type} ${document.description} ${companyName(document.company_id)}`, query)).slice(0, 8).forEach((document) => results.push({ id: `document-${document.id}`, type: "Belge", title: document.title || "İsimsiz belge", detail: `${companyName(document.company_id) || "Müşteri yok"} · ${document.document_type || "Belge"}`, href: "/hk-admin/belgeler" }));
    reports.filter((report) => includes(`${report.report_type} ${report.period} ${report.customer_note} ${report.internal_note}`, query)).slice(0, 8).forEach((report) => results.push({ id: `report-${report.id}`, type: "Rapor", title: report.report_type, detail: report.period || "Rapor dönemi belirtilmedi", href: "/hk-admin/raporlar" }));
    logs.filter((log) => includes(`${log.module} ${log.entity} ${log.action} ${log.action_type} ${log.actor_name} ${JSON.stringify(log.details || {})}`, query)).slice(0, 8).forEach((log) => results.push({ id: `log-${log.id}`, type: "Log", title: log.action_type || log.action || "Sistem hareketi", detail: `${log.module || log.entity || "Sistem"} · ${log.actor_name || "Sistem"}`, href: "/hk-admin/sistem-loglari" }));
    users.filter((user) => includes(`${user.full_name} ${user.email} ${user.role}`, query)).slice(0, 8).forEach((user) => results.push({ id: `user-${user.id}`, type: "Kullanıcı", title: user.full_name || user.email, detail: `${user.email} · ${user.role}`, href: "/hk-admin/kullanici-yonetimi" }));
  } catch (error) {
    console.error("[admin-search] Arama verileri yüklenemedi", error);
  }
  return NextResponse.json({ results: results.slice(0, 24) });
}
