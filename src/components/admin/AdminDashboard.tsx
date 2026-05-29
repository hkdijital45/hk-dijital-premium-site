"use client";
// @ts-nocheck

import Image from "next/image";
import { useMemo, useState } from "react";
import { Copy, Download, ImagePlus, LogOut, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import type { SiteContent } from "@/lib/types";

const modules = ["Overview", "Brand", "Social", "Contact", "Pages", "Certificates", "Services", "Packages", "Quote Wizard", "CRM", "Media", "AI Assistant", "API Settings", "Settings"];
const leadStatuses = ["Yeni", "Görüşülecek", "Teklif Hazırlanıyor", "Teklif Gönderildi", "Takipte", "Kazanıldı", "Kaybedildi"];

export function AdminDashboard({ initialContent }: { initialContent: SiteContent }) {
  const [content, setContent] = useState(initialContent as any);
  const [active, setActive] = useState("Overview");
  const [status, setStatus] = useState("");

  async function save(next = content) {
    setStatus("Kaydediliyor...");
    const response = await fetch("/api/content", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    setStatus(response.ok ? "Kaydedildi. Public sayfalar yenilendiğinde güncel içeriği gösterir." : "Kaydedilemedi.");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  const props = { content, setContent };

  return (
    <main className="min-h-screen bg-[#050711] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050711]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[.22em] text-cyan-200">HK Admin</p>
            <h1 className="text-2xl font-black">Gelişmiş Yönetim Paneli</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => save()} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-cyan-300 px-5 text-sm font-black text-slate-950"><Save size={17} /> Kaydet</button>
            <button onClick={logout} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-5 text-sm font-bold"><LogOut size={17} /> Çıkış</button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-[8px] border border-white/10 bg-white/[0.045] p-3">
          {modules.map((module) => (
            <button key={module} onClick={() => setActive(module)} className={`mb-2 block w-full rounded-[8px] px-4 py-3 text-left text-sm font-bold ${active === module ? "bg-cyan-300 text-slate-950" : "text-slate-300 hover:bg-white/10"}`}>
              {module}
            </button>
          ))}
        </aside>
        <section className="min-w-0 rounded-[8px] border border-white/10 bg-white/[0.045] p-5">
          {status && <p className="mb-5 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-100">{status}</p>}
          {active === "Overview" && <Overview content={content} setActive={setActive} />}
          {active === "Brand" && <Brand {...props} />}
          {active === "Social" && <KeyValue title="Social Media Management" object={content.socials} onChange={(object) => setContent({ ...content, socials: object })} />}
          {active === "Contact" && <KeyValue title="Contact Management" object={content.contact} onChange={(object) => setContent({ ...content, contact: object })} />}
          {active === "Pages" && <Pages {...props} />}
          {active === "Certificates" && <Collection title="Certificate Management" type="certificate" items={content.certificates} setItems={(items) => setContent({ ...content, certificates: items })} />}
          {active === "Services" && <Collection title="Service Management" type="service" items={content.services} setItems={(items) => setContent({ ...content, services: items })} />}
          {active === "Packages" && <Collection title="Package Management" type="package" items={content.packages} setItems={(items) => setContent({ ...content, packages: items })} />}
          {active === "Quote Wizard" && <QuoteWizardAdmin {...props} />}
          {active === "CRM" && <Crm {...props} />}
          {active === "Media" && <Media {...props} />}
          {active === "AI Assistant" && <AiAssistant {...props} />}
          {active === "API Settings" && <ApiSettings {...props} />}
          {active === "Settings" && <Settings {...props} />}
        </section>
      </div>
    </main>
  );
}

function Panel({ title, children }: any) {
  return <div><h2 className="mb-5 text-2xl font-black">{title}</h2>{children}</div>;
}

function Field({ label, value, onChange, type = "text" }: any) {
  return <label className="grid gap-2 text-sm font-semibold text-slate-200">{label}<input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="min-h-11 rounded-[8px] border border-white/10 bg-black/30 px-3 text-white" /></label>;
}

function TextArea({ label, value, onChange, rows = 4 }: any) {
  return <label className="grid gap-2 text-sm font-semibold text-slate-200">{label}<textarea rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="rounded-[8px] border border-white/10 bg-black/30 px-3 py-3 text-white" /></label>;
}

function Overview({ content, setActive }: any) {
  const leads = content.leads ?? [];
  const stats = [
    ["Toplam lead", leads.length],
    ["Teklif formları", leads.filter((lead) => lead.source === "quote").length],
    ["İletişim formları", leads.filter((lead) => lead.source === "contact").length],
    ["Aktif paket", content.packages.filter((item) => item.visible).length],
    ["Aktif hizmet", content.services.filter((item) => item.visible).length],
    ["AI provider", content.settings.api.demoMode ? "Demo" : content.settings.api.activeProvider]
  ];
  return (
    <Panel title="Dashboard Overview">
      <div className="grid gap-4 md:grid-cols-3">{stats.map(([label, value]) => <div key={label} className="rounded-[8px] border border-white/10 bg-black/25 p-4"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-black text-cyan-100">{value}</p></div>)}</div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-[8px] border border-white/10 p-4"><h3 className="font-black">Son lead kayıtları</h3><div className="mt-4 grid gap-3">{leads.slice(0, 5).map((lead) => <div key={lead.id} className="rounded-[8px] bg-white/[0.04] p-3 text-sm"><p className="font-bold">{lead.name || "İsimsiz"} · {lead.status}</p><p className="text-slate-400">{lead.company || lead.email || lead.phone}</p></div>)}{!leads.length && <p className="text-sm text-slate-400">Henüz lead yok.</p>}</div></div>
        <div className="rounded-[8px] border border-white/10 p-4"><h3 className="font-black">Hızlı işlemler</h3><div className="mt-4 grid gap-2">{["Pages", "CRM", "Media", "AI Assistant", "API Settings"].map((module) => <button key={module} onClick={() => setActive(module)} className="rounded-[8px] border border-white/10 px-4 py-3 text-left text-sm font-bold hover:bg-white/10">{module}</button>)}</div></div>
      </div>
    </Panel>
  );
}

function KeyValue({ title, object, onChange }: any) {
  return <Panel title={title}><div className="grid gap-4 md:grid-cols-2">{Object.entries(object).map(([key, value]) => <Field key={key} label={key} value={value} onChange={(v) => onChange({ ...object, [key]: v })} />)}</div></Panel>;
}

async function uploadFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/media", { method: "POST", body: form });
  const data = await response.json();
  return response.ok ? data.media : null;
}

function Upload({ onUrl }: any) {
  return <label className="grid cursor-pointer gap-2 rounded-[8px] border border-dashed border-cyan-200/30 bg-cyan-200/10 p-4 text-sm font-semibold text-cyan-100"><ImagePlus size={18} />Dosya yükle<input className="hidden" type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp,video/mp4,application/pdf" onChange={async (e) => { const file = e.target.files?.[0]; if (file) onUrl((await uploadFile(file))?.url || ""); }} /><span className="text-xs text-slate-400">PNG, JPG, SVG, WebP, MP4, PDF</span></label>;
}

function Brand({ content, setContent }: any) {
  const brand = content.brand;
  const update = (patch) => setContent({ ...content, brand: { ...brand, ...patch } });
  return (
    <Panel title="Brand Management">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Company name" value={brand.companyName} onChange={(v) => update({ companyName: v })} />
        <Field label="Slogan" value={brand.slogan} onChange={(v) => update({ slogan: v })} />
        {["logoUrl", "footerLogoUrl", "faviconUrl"].map((key) => <div key={key} className="grid gap-3"><Field label={key} value={brand[key]} onChange={(v) => update({ [key]: v })} /><Upload onUrl={(url) => update({ [key]: url })} /></div>)}
        {Object.entries(brand.colors).map(([key, value]) => <Field key={key} type="color" label={`${key} color`} value={value} onChange={(v) => update({ colors: { ...brand.colors, [key]: v } })} />)}
        <Field label="Heading typography" value={brand.typography.heading} onChange={(v) => update({ typography: { ...brand.typography, heading: v } })} />
        <Field label="Body typography" value={brand.typography.body} onChange={(v) => update({ typography: { ...brand.typography, body: v } })} />
      </div>
    </Panel>
  );
}

function Pages({ content, setContent }: any) {
  const pages = content.pages;
  const updatePage = (key, patch) => setContent({ ...content, pages: { ...pages, [key]: { ...pages[key], ...patch } } });
  return (
    <Panel title="Page Content Management">
      <div className="grid gap-4">
        <TextArea label="Ana sayfa headline" value={pages.home.headline} onChange={(v) => updatePage("home", { headline: v })} />
        <TextArea label="Ana sayfa subheadline" value={pages.home.subheadline} onChange={(v) => updatePage("home", { subheadline: v })} />
        <TextArea label="Hakkımda içerik" value={pages.about.content} onChange={(v) => updatePage("about", { content: v })} />
        <TextArea label="Sertifikalar intro" value={pages.certificates.intro} onChange={(v) => updatePage("certificates", { intro: v })} />
        <TextArea label="Hizmetler intro" value={pages.services.intro} onChange={(v) => updatePage("services", { intro: v })} />
        <TextArea label="Paketler intro" value={pages.packages.intro} onChange={(v) => updatePage("packages", { intro: v })} />
        <TextArea label="HK Intelligence içerik" value={pages.intelligence.content} onChange={(v) => updatePage("intelligence", { content: v })} />
        <TextArea label="İletişim intro" value={pages.contact.intro} onChange={(v) => updatePage("contact", { intro: v })} />
        <JsonBox label="SEO JSON" value={content.seo} onChange={(seo) => setContent({ ...content, seo })} />
      </div>
    </Panel>
  );
}

function JsonBox({ label, value, onChange }: any) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  return <div className="grid gap-2"><TextArea label={label} rows={10} value={text} onChange={setText} /><button onClick={() => onChange(JSON.parse(text))} className="w-fit rounded-full border border-white/10 px-4 py-2 text-sm font-bold">JSON uygula</button></div>;
}

function Collection({ title, type, items, setItems }: any) {
  const defaults: any = {
    certificate: { title: "Yeni Sertifika", institution: "", date: "", description: "", fileUrl: "", verificationUrl: "", order: items.length + 1, visible: true },
    service: { name: "Yeni Hizmet", icon: "Sparkles", imageUrl: "", description: "", detailedDescription: "", audience: "", problem: "", included: [], cta: "Teklif Al", order: items.length + 1, visible: true },
    package: { name: "Yeni Paket", imageUrl: "", price: "", description: "", features: [], recommended: false, visible: true, cta: "Teklif Al", order: items.length + 1 }
  };
  const update = (index, patch) => setItems(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const listFields = type === "certificate" ? ["title", "institution", "date", "fileUrl", "verificationUrl", "order"] : type === "service" ? ["name", "icon", "imageUrl", "cta", "order"] : ["name", "price", "imageUrl", "cta", "order"];
  return (
    <Panel title={title}>
      <button onClick={() => setItems([...items, { id: `${type}-${Date.now()}`, ...defaults[type] }])} className="mb-4 inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950"><Plus size={16} /> Ekle</button>
      <div className="grid gap-4">
        {items.map((item, index) => <div key={item.id} className="grid gap-3 rounded-[8px] border border-white/10 p-4">{listFields.map((field) => <Field key={field} label={field} value={item[field]} onChange={(v) => update(index, { [field]: field === "order" ? Number(v) || 0 : v })} />)}<Upload onUrl={(url) => update(index, type === "certificate" ? { fileUrl: url } : { imageUrl: url })} /><TextArea label="description" value={item.description} onChange={(v) => update(index, { description: v })} />{(type === "service" || type === "package") && <TextArea label="features/included (satır satır)" value={(item.features || item.included || []).join("\n")} onChange={(v) => update(index, type === "package" ? { features: v.split("\n").filter(Boolean) } : { included: v.split("\n").filter(Boolean) })} />}<div className="flex flex-wrap gap-3"><label className="flex gap-2 text-sm"><input type="checkbox" checked={item.visible} onChange={(e) => update(index, { visible: e.target.checked })} /> Görünür</label>{type === "package" && <label className="flex gap-2 text-sm"><input type="checkbox" checked={item.recommended} onChange={(e) => update(index, { recommended: e.target.checked })} /> Önerilen</label>}<button onClick={() => setItems(items.filter((x) => x.id !== item.id))} className="inline-flex items-center gap-2 rounded-full border border-red-300/30 px-3 py-2 text-xs text-red-200"><Trash2 size={14} /> Sil</button></div></div>)}
      </div>
    </Panel>
  );
}

function QuoteWizardAdmin({ content, setContent }: any) {
  const wizard = content.quoteWizard;
  const update = (patch) => setContent({ ...content, quoteWizard: { ...wizard, ...patch } });
  return <Panel title="Quote Wizard Management"><div className="grid gap-4"><Field label="Başlık" value={wizard.title} onChange={(v) => update({ title: v })} /><Field label="Alt başlık" value={wizard.subtitle} onChange={(v) => update({ subtitle: v })} /><TextArea label="İşletme türleri" value={wizard.businessTypes.map((o) => o.label).join("\n")} onChange={(v) => update({ businessTypes: v.split("\n").filter(Boolean).map((label, i) => ({ id: `business-${i}`, label })) })} /><TextArea label="Hedef seçenekleri" value={wizard.goals.map((o) => o.label).join("\n")} onChange={(v) => update({ goals: v.split("\n").filter(Boolean).map((label, i) => ({ id: `goal-${i}`, label })) })} /><TextArea label="Bütçe aralıkları" value={wizard.budgets.map((o) => o.label).join("\n")} onChange={(v) => update({ budgets: v.split("\n").filter(Boolean).map((label, i) => ({ id: `budget-${i}`, label })) })} /><TextArea label="Başarı mesajı" value={wizard.successMessage} onChange={(v) => update({ successMessage: v })} /><TextArea label="WhatsApp mesaj şablonu" value={wizard.whatsappTemplate} onChange={(v) => update({ whatsappTemplate: v })} /><JsonBox label="Recommendation logic JSON" value={wizard.recommendationRules} onChange={(recommendationRules) => update({ recommendationRules })} /></div></Panel>;
}

function Crm({ content, setContent }: any) {
  const [query, setQuery] = useState("");
  const leads = (content.leads ?? []).filter((lead) => JSON.stringify(lead).toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")));
  const update = (id, patch) => setContent({ ...content, leads: content.leads.map((lead) => (lead.id === id ? { ...lead, ...patch } : lead)) });
  function exportCsv() {
    const rows = leads.map((lead) => [lead.createdAt, lead.source, lead.name, lead.company, lead.phone, lead.email, lead.instagram, lead.website, lead.businessType, lead.goal, lead.budget, lead.recommendedPackage, lead.status, lead.note]);
    const csv = [["Tarih", "Kaynak", "Ad", "Firma", "Telefon", "E-posta", "Instagram", "Web", "İşletme", "Hedef", "Bütçe", "Paket", "Durum", "Not"], ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "hk-dijital-leads.csv";
    a.click();
  }
  return <Panel title="Lead Management / CRM"><div className="mb-4 flex flex-col gap-3 md:flex-row"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Lead ara..." className="min-h-11 flex-1 rounded-[8px] border border-white/10 bg-black/30 px-3 text-white" /><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950"><Download size={16} /> CSV Export</button></div><div className="grid gap-4">{leads.map((lead) => <div key={lead.id} className="grid gap-3 rounded-[8px] border border-white/10 p-4"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-black">{lead.name || "İsimsiz lead"}</h3><p className="text-sm text-slate-400">{lead.company} · {lead.phone} · {lead.email}</p></div><select value={lead.status} onChange={(e) => update(lead.id, { status: e.target.value })} className="min-h-10 rounded-[8px] border border-white/10 bg-black/30 px-3 text-white">{leadStatuses.map((status) => <option key={status}>{status}</option>)}</select></div><p className="text-sm text-slate-300">Paket: {lead.recommendedPackage || "-"} · Bütçe: {lead.budget || "-"} · Hedef: {lead.goal || "-"}</p><TextArea label="İç not" value={lead.internalNotes} onChange={(v) => update(lead.id, { internalNotes: v })} /><Field label="Sonraki takip tarihi" type="date" value={lead.followUpDate} onChange={(v) => update(lead.id, { followUpDate: v })} /></div>)}{!leads.length && <p className="text-sm text-slate-400">Kayıt bulunamadı.</p>}</div></Panel>;
}

function Media({ content, setContent }: any) {
  const [message, setMessage] = useState("");
  async function handle(file) {
    setMessage("Yükleniyor...");
    const media = await uploadFile(file);
    if (media) setContent({ ...content, media: [media, ...content.media] });
    setMessage(media ? "Yüklendi." : "Yüklenemedi.");
  }
  return <Panel title="File / Media Library"><label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-[8px] border border-dashed border-cyan-200/30 bg-cyan-200/10 text-center"><ImagePlus /><span>PNG, JPG, SVG, WebP, MP4 veya PDF yükle</span><input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp,video/mp4,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])} /></label><p className="mt-3 text-sm text-slate-400">Mock/local modda dosyalar public/uploads klasörüne alınır. Üretimde Supabase Storage, Firebase Storage, Cloudinary veya S3 uyumlu storage eklenmelidir.</p>{message && <p className="mt-3 text-sm text-cyan-100">{message}</p>}<div className="mt-5 grid gap-4 md:grid-cols-3">{content.media.map((item) => <div key={item.id} className="rounded-[8px] border border-white/10 p-3">{item.type === "image" ? <Image src={item.url} alt={item.name} width={360} height={160} className="h-32 w-full rounded-[8px] object-cover" /> : <div className="grid h-32 place-items-center rounded-[8px] bg-white/[0.06] text-sm font-bold">{item.type.toUpperCase()}</div>}<p className="mt-3 break-all text-xs text-slate-300">{item.url}</p><button onClick={() => setContent({ ...content, media: content.media.filter((m) => m.id !== item.id) })} className="mt-3 rounded-full border border-white/10 px-3 py-2 text-xs">Listeden kaldır</button></div>)}</div></Panel>;
}

function AiAssistant({ content, setContent }: any) {
  const [provider, setProvider] = useState(content.settings.api.activeProvider);
  const [prompt, setPrompt] = useState("HK Intelligence için CRM odaklı premium açıklama yaz.");
  const [output, setOutput] = useState("");
  const generated = useMemo(() => `Demo AI çıktısı (${provider}):\n\n${prompt}\n\nHK Dijital tonu ile öneri: Ölçülebilir strateji, CRM destekli takip, şeffaf raporlama ve reklam optimizasyonu odağında, satış garantisi vermeden güven oluşturan profesyonel bir metin kullanılmalıdır. Bu panel ana sayfa, hakkımda, hizmet, paket, sosyal medya, reklam metni, teklif ve takip mesajı üretiminde kullanılabilir.`, [prompt, provider]);
  return <Panel title="AI Admin Assistant"><div className="grid gap-4"><label className="grid gap-2 text-sm font-semibold text-slate-200">Provider selector<select value={provider} onChange={(e) => setProvider(e.target.value)} className="min-h-11 rounded-[8px] border border-white/10 bg-black/30 px-3 text-white"><option value="demo">Demo Mode</option><option value="gemini">Gemini</option><option value="groq">Groq</option><option value="openai">OpenAI</option></select></label><TextArea label="Prompt" value={prompt} onChange={setPrompt} /><button onClick={() => setOutput(generated)} className="inline-flex w-fit items-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950"><Sparkles size={17} /> Demo çıktı üret</button>{output && <div className="rounded-[8px] border border-white/10 bg-black/30 p-4"><pre className="whitespace-pre-wrap text-sm leading-7 text-slate-200">{output}</pre><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => navigator.clipboard.writeText(output)} className="inline-flex gap-2 rounded-full border border-white/10 px-4 py-2 text-sm"><Copy size={16} /> Kopyala</button><button onClick={() => setContent({ ...content, pages: { ...content.pages, home: { ...content.pages.home, subheadline: output } } })} className="rounded-full border border-white/10 px-4 py-2 text-sm">Ana sayfa alt metnine kaydet</button></div></div>}</div></Panel>;
}

function ApiSettings({ content, setContent }: any) {
  const [result, setResult] = useState("");
  const api = content.settings.api;
  const update = (patch) => setContent({ ...content, settings: { ...content.settings, api: { ...api, ...patch } } });
  async function testApi() {
    const response = await fetch("/api/ai/test", { method: "POST" });
    const data = await response.json();
    setResult(data.message || "Test tamamlandı.");
  }
  return <Panel title="API Settings"><div className="grid gap-4 md:grid-cols-2"><Field label="Gemini API Key" value={api.geminiApiKey} onChange={(v) => update({ geminiApiKey: v })} /><Field label="Groq API Key" value={api.groqApiKey} onChange={(v) => update({ groqApiKey: v })} /><Field label="OpenAI API Key placeholder" value={api.openAiApiKey} onChange={(v) => update({ openAiApiKey: v })} /><Field label="Model selection" value={api.model} onChange={(v) => update({ model: v })} /><label className="grid gap-2 text-sm font-semibold text-slate-200">Active provider<select value={api.activeProvider} onChange={(e) => update({ activeProvider: e.target.value })} className="min-h-11 rounded-[8px] border border-white/10 bg-black/30 px-3 text-white"><option value="demo">Demo Mode</option><option value="gemini">Gemini</option><option value="groq">Groq</option><option value="openai">OpenAI</option></select></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={api.demoMode} onChange={(e) => update({ demoMode: e.target.checked })} /> Demo mode</label></div><button onClick={testApi} className="mt-5 rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">API test et</button>{result && <p className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-100">{result}</p>}<p className="mt-4 text-sm text-slate-400">API anahtarları public frontend tarafına aktarılmaz. Üretimde .env değişkenleri ve şifreli secret storage tercih edilmelidir.</p></Panel>;
}

function Settings({ content, setContent }: any) {
  const settings = content.settings;
  const update = (patch) => setContent({ ...content, settings: { ...settings, ...patch } });
  return <Panel title="Settings"><div className="grid gap-4 md:grid-cols-2"><Field label="Site title" value={settings.siteTitle} onChange={(v) => update({ siteTitle: v })} /><Field label="Site description" value={settings.siteDescription} onChange={(v) => update({ siteDescription: v })} /><Field label="Meta Pixel ID" value={settings.analyticsIds.metaPixel} onChange={(v) => update({ analyticsIds: { ...settings.analyticsIds, metaPixel: v } })} /><Field label="Google Tag Manager ID" value={settings.analyticsIds.googleTagManager} onChange={(v) => update({ analyticsIds: { ...settings.analyticsIds, googleTagManager: v } })} /><Field label="GA4 Measurement ID" value={settings.analyticsIds.gaMeasurement} onChange={(v) => update({ analyticsIds: { ...settings.analyticsIds, gaMeasurement: v } })} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.maintenanceMode} onChange={(e) => update({ maintenanceMode: e.target.checked })} /> Maintenance mode</label><label className="grid gap-2 text-sm font-semibold text-slate-200">Default theme<select value={settings.defaultTheme} onChange={(e) => update({ defaultTheme: e.target.value })} className="min-h-11 rounded-[8px] border border-white/10 bg-black/30 px-3 text-white"><option value="dark">Dark</option><option value="light">Light</option></select></label><TextArea label="Legal disclaimers" value={(settings.legalDisclaimers || []).join("\n")} onChange={(v) => update({ legalDisclaimers: v.split("\n").filter(Boolean) })} /></div><p className="mt-4 text-sm text-slate-400">Admin kullanıcı adı ve şifre .env üzerinden yönetilir. Üretimde hashlenmiş şifre, rate limit, audit log ve kullanıcı rolleri önerilir.</p></Panel>;
}
