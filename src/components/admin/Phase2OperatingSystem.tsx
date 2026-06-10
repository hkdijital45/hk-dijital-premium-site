"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { BarChart3, Bot, CheckCircle2, FileText, Link2, RefreshCw, Send, ShieldCheck, Sparkles, Users } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/reports/report-insights";

function parseNumber(value: unknown) {
  const normalized = String(value || "").replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateDigitalMaturityScore(lead: any) {
  let score = 20;
  if (lead.website) score += 15;
  if (lead.instagram) score += 12;
  if (lead.phone) score += 8;
  if (lead.email) score += 8;
  if (lead.google_rating) score += Math.min(12, Number(lead.google_rating) * 2);
  if (lead.google_review_count) score += Math.min(15, Math.log10(Number(lead.google_review_count) + 1) * 10);
  if (lead.goal) score += 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function calculateLeadHeatScore(lead: any) {
  let score = 15;
  const text = `${lead.goal || ""} ${lead.message || ""} ${lead.notes || ""}`.toLocaleLowerCase("tr-TR");
  if (lead.phone) score += 15;
  if (lead.email) score += 10;
  if (lead.budget) score += 15;
  if (text.includes("acil") || text.includes("hemen")) score += 15;
  if (text.includes("reklam") || text.includes("lead") || text.includes("whatsapp")) score += 15;
  if (["Teklif Gönderildi", "Takipte"].includes(lead.status)) score += 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function forecastKpis(input: any) {
  const budget = parseNumber(input.budget);
  const platform = String(input.platform || "Meta").toLocaleLowerCase("tr-TR");
  const cpm = platform.includes("google") ? 55 : 35;
  const cpc = platform.includes("google") ? 12 : 8;
  const reach = budget ? Math.round((budget / cpm) * 1000 * 0.72) : 0;
  const clicks = budget ? Math.round(budget / cpc) : 0;
  const leads = clicks ? Math.max(1, Math.round(clicks * 0.035)) : 0;
  const messages = clicks ? Math.max(1, Math.round(clicks * 0.05)) : 0;
  return { reach, clicks, leads, messages, costPerLead: leads ? budget / leads : 0 };
}

function executiveSummary(data: { leads?: any[]; companies?: any[]; reports?: any[]; campaigns?: any[] }) {
  const leads = data.leads || [];
  const companies = data.companies || [];
  const campaigns = data.campaigns || [];
  const won = leads.filter((lead) => ["Kazandı", "Kazanıldı", "Dönüştürüldü", "Müşteri Oldu"].includes(lead.status)).length;
  return {
    totalLeads: leads.length,
    activeCustomers: companies.filter((company) => company.status !== "Pasif").length,
    proposalValue: leads.reduce((sum, lead) => sum + parseNumber(lead.budget), 0),
    conversionRate: leads.length ? (won / leads.length) * 100 : 0,
    metaManagedBudget: campaigns.filter((item) => String(item.platform || "").toLocaleLowerCase("tr-TR").includes("meta")).reduce((sum, item) => sum + parseNumber(item.budget || item.spent), 0),
    googleManagedBudget: campaigns.filter((item) => String(item.platform || "").toLocaleLowerCase("tr-TR").includes("google")).reduce((sum, item) => sum + parseNumber(item.budget || item.spent), 0)
  };
}

function Card({ title, description, icon: Icon, children }: any) {
  return <section className="rounded-[8px] border border-white/10 bg-white/[0.05] p-5 shadow-[0_24px_80px_rgba(15,23,42,.24)]"><div className="mb-4 flex items-start gap-3"><div className="grid size-10 place-items-center rounded-[8px] bg-cyan-300/15 text-cyan-100"><Icon size={19} /></div><div><h2 className="font-black text-white">{title}</h2>{description && <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>}</div></div>{children}</section>;
}

function Field({ label, value, onChange, type = "text", placeholder = "" }: any) {
  return <label className="grid gap-2 text-xs font-bold text-slate-300">{label}<input type={type} value={value || ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-[8px] border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none focus:border-cyan-200/60" /></label>;
}

function Select({ label, value, onChange, options }: any) {
  return <label className="grid gap-2 text-xs font-bold text-slate-300">{label}<select value={value || ""} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-[8px] border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none focus:border-cyan-200/60">{options.map((item: any) => <option key={item.value || item} value={item.value || item}>{item.label || item}</option>)}</select></label>;
}

function PageShell({ eyebrow, title, description, children }: any) {
  return <main className="min-h-screen bg-[#050711] px-4 py-8 text-white"><div className="mx-auto max-w-7xl"><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-200">{eyebrow}</p><h1 className="mt-3 text-3xl font-black">{title}</h1><p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">{description}</p><div className="mt-7">{children}</div></div></main>;
}

export function IntegrationCenter({ provider, content, integrations = [] }: any) {
  const companies = content.companies || [];
  const [form, setForm] = useState({ companyId: companies[0]?.id || "", businessAccountId: "", adAccountId: "", pageId: "", instagramAccountId: "", customerAccountId: "", accessToken: "", refreshToken: "", autoSync: false });
  const [items, setItems] = useState(integrations);
  const [message, setMessage] = useState("");
  const isMeta = provider === "meta";
  async function save() {
    setMessage("Bağlantı kaydediliyor...");
    const response = await fetch("/api/admin/integrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, provider }) });
    const data = await response.json().catch(() => ({}));
    setMessage(data.message || data.error || "İşlem tamamlandı.");
    if (data.integration) setItems([data.integration, ...items.filter((item: any) => item.id !== data.integration.id)]);
  }
  async function sync(integrationId?: string) {
    setMessage("Senkronizasyon başlatılıyor...");
    const response = await fetch("/api/admin/integrations/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, integrationId }) });
    const data = await response.json().catch(() => ({}));
    setMessage(data.message || data.error || "Senkronizasyon tamamlandı.");
  }
  return <PageShell eyebrow="HK Operating System" title={isMeta ? "Meta Integration Center" : "Google Ads Integration Center"} description="Reklam hesap bağlantılarını server-side saklayın, manuel veya zamanlanmış sync uçlarını kullanın. Token değerleri tarayıcıya geri döndürülmez.">
    <div className="grid gap-5 xl:grid-cols-[.95fr_1.05fr]">
      <Card title="Bağlantı Bilgileri" description="Canlı OAuth/app izinleri tamamlandığında bu kayıtlar otomatik raporlama sync akışına bağlanır." icon={ShieldCheck}>
        <div className="grid gap-3 md:grid-cols-2">
          <Select label="Müşteri / Firma" value={form.companyId} onChange={(companyId: string) => setForm({ ...form, companyId })} options={companies.map((company: any) => ({ value: company.id, label: company.name }))} />
          {isMeta ? <Field label="Meta Business ID" value={form.businessAccountId} onChange={(businessAccountId: string) => setForm({ ...form, businessAccountId })} /> : <Field label="Google Ads Customer ID" value={form.customerAccountId} onChange={(customerAccountId: string) => setForm({ ...form, customerAccountId, adAccountId: customerAccountId })} />}
          <Field label={isMeta ? "Ad Account ID" : "Manager / Account ID"} value={form.adAccountId} onChange={(adAccountId: string) => setForm({ ...form, adAccountId })} />
          {isMeta && <Field label="Facebook Page ID" value={form.pageId} onChange={(pageId: string) => setForm({ ...form, pageId })} />}
          {isMeta && <Field label="Instagram Account ID" value={form.instagramAccountId} onChange={(instagramAccountId: string) => setForm({ ...form, instagramAccountId })} />}
          <Field label="Access token (server-side encrypted)" value={form.accessToken} onChange={(accessToken: string) => setForm({ ...form, accessToken })} />
          {!isMeta && <Field label="Refresh token (server-side encrypted)" value={form.refreshToken} onChange={(refreshToken: string) => setForm({ ...form, refreshToken })} />}
          <label className="flex items-center gap-2 text-sm font-bold text-slate-200"><input type="checkbox" checked={form.autoSync} onChange={(event) => setForm({ ...form, autoSync: event.target.checked })} /> Auto sync açık</label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2"><button onClick={save} className="rounded-full bg-cyan-300 px-5 py-3 text-xs font-black text-slate-950">Bağlantıyı Kaydet</button><button onClick={() => sync()} className="inline-flex items-center gap-2 rounded-full border border-cyan-200/30 px-5 py-3 text-xs font-black text-cyan-100"><RefreshCw size={14} /> Manuel Sync</button></div>
        {message && <p className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-50">{message}</p>}
      </Card>
      <Card title="Bağlantı Durumu" description="Tokenlar maskelenir; sadece bağlantı durumu ve var/yok bilgisi gösterilir." icon={Link2}>
        <div className="grid gap-3">{items.length ? items.map((item: any) => <div key={item.id} className="rounded-[8px] border border-white/10 bg-black/20 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black">{item.provider?.toUpperCase()} · {item.ad_account_id || item.business_account_id || "Hesap bekliyor"}</p><p className="mt-1 text-xs text-slate-400">Son sync: {item.last_sync_at ? new Date(item.last_sync_at).toLocaleString("tr-TR") : "Henüz yok"} · Token: {item.hasAccessToken ? "Var" : "Yok"}</p></div><span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-xs font-black text-cyan-100">{item.status || "Bekliyor"}</span></div><button onClick={() => sync(item.id)} className="mt-3 rounded-full border border-white/10 px-4 py-2 text-xs font-bold">Bu Bağlantıyı Sync Et</button></div>) : <p className="text-sm text-slate-400">Henüz bağlantı kaydı yok.</p>}</div>
      </Card>
    </div>
  </PageShell>;
}

export function OnboardingCenter({ content }: any) {
  const leads = content.leads || [];
  const customers = content.users?.filter((user: any) => ["customer", "musteri"].includes(user.role)) || [];
  const [message, setMessage] = useState("");
  async function convert(leadId: string) {
    setMessage("Müşteri hesabı oluşturuluyor...");
    const response = await fetch("/api/admin/customers/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId }) });
    const data = await response.json().catch(() => ({}));
    setMessage(data.message ? `${data.message}${data.temporaryPassword ? ` Geçici şifre: ${data.temporaryPassword}` : ""}` : data.error || "İşlem tamamlandı.");
  }
  return <PageShell eyebrow="Customer Success" title="Customer Onboarding Center" description="Lead kazandı aşamasına geldiğinde müşteri kaydı, login hesabı ve geçici şifre tek akıştan oluşturulur.">
    {message && <p className="mb-5 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-50">{message}</p>}
    <div className="grid gap-5 xl:grid-cols-2">
      <Card title="Onay Bekleyen Leadler" description="Kazandı aşamasına taşınacak leadleri müşteri hesabına dönüştürün." icon={Users}>
        <div className="grid gap-3">{leads.slice(0, 20).map((lead: any) => <div key={lead.id} className="rounded-[8px] border border-white/10 bg-black/20 p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-black">{lead.company || lead.name || "İsimsiz lead"}</p><p className="mt-1 text-xs text-slate-400">{lead.email || "-"} · {lead.phone || "-"} · {lead.status || "Yeni"}</p></div><button onClick={() => convert(lead.id)} className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">Onayla ve Müşteri Oluştur</button></div></div>)}</div>
      </Card>
      <Card title="Aktif Müşteri Hesapları" description="Mevcut müşteri login kayıtları." icon={CheckCircle2}>
        <div className="grid gap-3">{customers.length ? customers.map((user: any) => <div key={user.id} className="rounded-[8px] border border-white/10 bg-black/20 p-4"><p className="font-black">{user.full_name || user.email}</p><p className="mt-1 text-xs text-slate-400">{user.email} · {user.is_active ? "Aktif" : "Pasif"}</p></div>) : <p className="text-sm text-slate-400">Müşteri hesabı bulunamadı.</p>}</div>
      </Card>
    </div>
  </PageShell>;
}

export function LeadWorkspace({ content }: any) {
  const [leads, setLeads] = useState(content.leads || []);
  const summary = executiveSummary({ leads, companies: content.companies, reports: content.reports, campaigns: content.campaigns });
  const stages = ["Yeni Lead", "İletişim Kuruldu", "Teklif Gönderildi", "Takipte", "Kazandı", "Kaybedildi"];
  const [question, setQuestion] = useState("Hangi leadleri önce aramalıyım?");
  const [answer, setAnswer] = useState("");
  const [pipelineMessage, setPipelineMessage] = useState("");
  function leadStage(lead: any) {
    const status = String(lead.status || "Yeni Lead");
    if (stages.includes(status)) return status;
    if (["Yeni", "Yeni Başvuru"].includes(status)) return "Yeni Lead";
    if (["Görüşülecek", "İletişime Geçildi"].includes(status)) return "İletişim Kuruldu";
    if (["Teklif Hazırlanıyor", "Teklif Gönderildi"].includes(status)) return "Teklif Gönderildi";
    if (["Kazanıldı", "Dönüştürüldü", "Müşteri Oldu"].includes(status)) return "Kazandı";
    if (["Reddedildi", "Kaybedildi"].includes(status)) return "Kaybedildi";
    return "Yeni Lead";
  }
  async function moveLead(leadId: string, status: string) {
    setPipelineMessage("Pipeline güncelleniyor...");
    const response = await fetch("/api/admin/leads/pipeline", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: leadId, status }) });
    const data = await response.json().catch(() => ({}));
    if (data.lead) setLeads(leads.map((lead: any) => lead.id === leadId ? { ...lead, ...data.lead } : lead));
    setPipelineMessage(data.message || data.error || "Pipeline güncellendi.");
  }
  async function ask() {
    setAnswer("HK Intelligence düşünüyor...");
    const response = await fetch("/api/admin/operations-assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
    const data = await response.json().catch(() => ({}));
    setAnswer(data.answer || data.error || "Yanıt alınamadı.");
  }
  return <PageShell eyebrow="Lead-to-Client OS" title="Lead Workspace" description="Keşif, AI analiz, dijital skor, teklif geçmişi, CRM durumu ve müşteri dönüşümünü tek pipeline içinde izleyin.">
    <div className="mb-5 grid gap-3 md:grid-cols-4">{[["Toplam Lead", summary.totalLeads], ["Aktif Müşteri", summary.activeCustomers], ["Teklif Değeri", formatCurrency(summary.proposalValue)], ["Dönüşüm Oranı", `%${formatNumber(summary.conversionRate, 1)}`]].map(([label, value]) => <div key={label} className="rounded-[8px] border border-white/10 bg-white/[0.05] p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>)}</div>
    {pipelineMessage && <p className="mb-5 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-50">{pipelineMessage}</p>}
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <div className="grid gap-4 xl:grid-cols-3">{stages.map((stage) => <div key={stage} className="rounded-[8px] border border-white/10 bg-white/[0.04] p-3"><div className="flex items-center justify-between gap-2"><h3 className="font-black text-cyan-100">{stage}</h3><span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black text-slate-300">{leads.filter((lead: any) => leadStage(lead) === stage).length}</span></div><div className="mt-3 grid gap-3">{leads.filter((lead: any) => leadStage(lead) === stage).slice(0, 8).map((lead: any) => <div key={lead.id} className="rounded-[8px] bg-black/25 p-3"><p className="font-black">{lead.company || lead.name || "Lead"}</p><p className="mt-1 text-xs text-slate-400">{lead.business_type || lead.sector || "-"} · {lead.city || "-"}</p><div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black"><span className="rounded-full bg-cyan-300/15 px-2 py-1 text-cyan-100">Dijital {lead.digital_maturity_score || calculateDigitalMaturityScore(lead)}</span><span className="rounded-full bg-amber-300/15 px-2 py-1 text-amber-100">Isı {lead.lead_heat_score || calculateLeadHeatScore(lead)}</span></div><select value={leadStage(lead)} onChange={(event) => moveLead(lead.id, event.target.value)} className="mt-3 min-h-9 w-full rounded-[8px] border border-white/10 bg-slate-950/70 px-2 text-xs font-bold text-white outline-none"><option value="Yeni Lead">Yeni Lead</option><option value="İletişim Kuruldu">İletişim Kuruldu</option><option value="Teklif Gönderildi">Teklif Gönderildi</option><option value="Takipte">Takipte</option><option value="Kazandı">Kazandı</option><option value="Kaybedildi">Kaybedildi</option></select></div>)}</div></div>)}</div>
      <Card title="HK Intelligence Assistant" description="Operasyon sorularını mevcut lead, müşteri, kampanya ve rapor bağlamıyla yanıtlar." icon={Bot}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} className="min-h-24 w-full rounded-[8px] border border-white/10 bg-black/30 p-3 text-sm text-white" /><button onClick={ask} className="mt-3 inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950"><Sparkles size={14} /> Sor</button>{answer && <p className="mt-4 whitespace-pre-line rounded-[8px] bg-black/25 p-3 text-sm leading-6 text-slate-200">{answer}</p>}</Card>
    </div>
  </PageShell>;
}

export function ProposalBuilder() {
  const [form, setForm] = useState({ businessName: "", sector: "", city: "", goal: "Lead generation", budget: "", platform: "Meta" });
  const [proposal, setProposal] = useState<any>(null);
  const preview = useMemo(() => forecastKpis(form), [form]);
  async function generate() {
    const response = await fetch("/api/admin/proposal-builder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await response.json().catch(() => ({}));
    setProposal(data.proposal || { error: data.error || "Teklif üretilemedi." });
  }
  return <PageShell eyebrow="Sales OS" title="Smart Proposal Generator" description="İşletme bilgilerini girin; paket, funnel, KPI tahmini ve Türkçe satış açıklaması oluşturun.">
    <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
      <Card title="Teklif Girdileri" description="Admin göndermeden önce tüm metni düzenleyebilir." icon={FileText}>
        <div className="grid gap-3 md:grid-cols-2"><Field label="İşletme adı" value={form.businessName} onChange={(businessName: string) => setForm({ ...form, businessName })} /><Field label="Sektör" value={form.sector} onChange={(sector: string) => setForm({ ...form, sector })} /><Field label="İl" value={form.city} onChange={(city: string) => setForm({ ...form, city })} /><Select label="Hedef" value={form.goal} onChange={(goal: string) => setForm({ ...form, goal })} options={["WhatsApp messages", "Lead generation", "Website traffic", "Brand awareness", "Sales"]} /><Field label="Bütçe" value={form.budget} onChange={(budget: string) => setForm({ ...form, budget })} /><Select label="Platform" value={form.platform} onChange={(platform: string) => setForm({ ...form, platform })} options={["Meta", "Google Ads", "Meta + Google", "Sosyal Medya"]} /></div>
        <button onClick={generate} className="mt-4 inline-flex items-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-xs font-black text-slate-950"><Send size={14} /> Teklif Oluştur</button>
      </Card>
      <Card title="Teklif Önizleme" description="Tahminler satış garantisi değil, planlama öngörüsüdür." icon={BarChart3}>
        <div className="grid gap-3 md:grid-cols-5">{[["Erişim", preview.reach], ["Tıklama", preview.clicks], ["Lead", preview.leads], ["Mesaj", preview.messages], ["CPL", formatCurrency(preview.costPerLead)]].map(([label, value]) => <div key={label} className="rounded-[8px] bg-black/20 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-lg font-black">{typeof value === "number" ? formatNumber(value, 0) : value}</p></div>)}</div>
        {proposal && <div className="mt-5 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-4"><p className="font-black text-cyan-50">Paket: {proposal.packageName || "-"}</p><p className="mt-2 text-sm text-cyan-100">Funnel: {(proposal.funnel || []).join(" -> ")}</p><textarea defaultValue={proposal.explanation || proposal.error || ""} className="mt-4 min-h-56 w-full rounded-[8px] border border-white/10 bg-black/30 p-3 text-sm leading-6 text-white" /></div>}
      </Card>
    </div>
  </PageShell>;
}
