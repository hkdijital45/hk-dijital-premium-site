"use client";
// @ts-nocheck

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Copy, Download, ImagePlus, LogOut, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import type { SiteContent } from "@/lib/types";

const modules = [
  "Genel Bakış",
  "Site Yönetimi",
  "Sayfa İçerikleri",
  "Marka Yönetimi",
  "Sosyal Medya",
  "Hizmetler",
  "Paketler",
  "Sertifikalar",
  "Teklif Sihirbazı",
  "CRM / Potansiyel Müşteriler",
  "Müşteriler",
  "Müşteri Paneli Yönetimi",
  "Reklam Yönetimi",
  "Reklam Metrikleri",
  "Reklam Raporları",
  "Yapılan Çalışmalar",
  "Dosyalar",
  "Medya Merkezi",
  "API Ayarları",
  "Yapay Zeka Merkezi",
  "Ölçümleme Ayarları",
  "Kullanıcı Yönetimi",
  "Kullanım Kılavuzu",
  "Ayarlar"
];
const leadStatuses = ["Yeni", "Görüşülecek", "Teklif Hazırlanıyor", "Teklif Gönderildi", "Takipte", "Kazanıldı", "Kaybedildi"];
const leadSourceOptions = ["İletişim Formu", "Teklif Formu", "Teklif Sihirbazı", "Instagram", "WhatsApp", "Referans", "Manuel Giriş", "Diğer"];
const roleOptions = [
  { value: "admin", label: "Yönetici" },
  { value: "editor", label: "Editör" },
  { value: "sales", label: "Satış / CRM" },
  { value: "customer", label: "Müşteri" }
];
const statusOptions = ["Aktif", "Pasif"];
const companyStatusOptions = ["Aktif", "Pasif", "Beklemede", "Potansiyel", "Eski Müşteri"];
const sectorOptions = ["Butik Pasta", "Restoran", "Kafe", "Güzellik Merkezi", "Diş Kliniği", "Sağlık", "Eğitim", "E-ticaret", "Gayrimenkul", "Otomotiv", "Hizmet Sektörü", "Dernek / STK", "Diğer"];
const cityOptions = ["Manisa", "İzmir", "İstanbul", "Ankara", "Bursa", "Balıkesir", "Aydın", "Denizli", "Muğla", "Diğer"];
const platformOptions = ["Meta", "Instagram", "Facebook", "Google", "TikTok", "LinkedIn", "YouTube", "Diğer"];
const objectiveOptions = ["Bilinirlik", "Trafik", "Mesaj", "Form", "Satış", "Yeniden Pazarlama", "Video İzlenme", "Etkileşim", "Web Sitesi Ziyareti", "Diğer"];
const campaignStatusOptions = ["Hazırlanıyor", "Aktif", "Duraklatıldı", "Tamamlandı", "İptal Edildi"];
const metricPeriodOptions = ["Günlük", "Haftalık", "Aylık", "Özel Tarih"];
const metricSourceOptions = ["Manuel Giriş", "Meta Raporu", "Google Ads Raporu", "Diğer"];
const updateTypeOptions = ["Yapılan Çalışma", "Reklam Güncellemesi", "Rapor Notu", "Strateji Notu", "Uyarı", "Başarı", "Diğer"];
const fileCategoryOptions = ["Rapor", "Görsel", "Video", "Teklif", "Sözleşme", "Fatura", "Brief", "Diğer"];
const serviceCategoryOptions = ["Meta Reklamları", "Google Reklamları", "Sosyal Medya Yönetimi", "SEO", "Web Sitesi", "CRM", "Raporlama", "Yapay Zeka Analizi", "Diğer"];
const packageTypeOptions = ["Başlangıç", "Standart", "Profesyonel", "Premium", "Özel Paket", "Diğer"];
const apiProviderOptions = ["OpenAI", "Groq", "Gemini", "Meta", "Google Maps", "Google Ads", "Diğer"];
const aiProviderOptions = ["OpenAI", "Groq", "Gemini", "Demo", "Diğer"];

export function AdminDashboard({
  initialContent,
  supabaseConfigured = false,
  currentSession,
  bootstrapWarning = false
}: {
  initialContent: SiteContent;
  supabaseConfigured?: boolean;
  currentSession?: any;
  bootstrapWarning?: boolean;
}) {
  const [content, setContent] = useState(initialContent as any);
  const [active, setActive] = useState("Genel Bakış");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    setTheme(localStorage.getItem("hk-admin-theme") || "dark");
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("hk-admin-theme", next);
  }

  async function save(next = content) {
    setSaving(true);
    setStatus("Kaydediliyor...");
    try {
      const contentResponse = await fetch("/api/content", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      const centerResponse = supabaseConfigured
        ? await fetch("/api/admin/center-data", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) })
        : contentResponse;
      if (contentResponse.ok && centerResponse.ok) {
        if (supabaseConfigured) {
          const latest = await fetch("/api/admin/center-data");
          const latestData = await latest.json().catch(() => ({}));
          if (latest.ok) {
            setContent((current) => ({ ...current, ...latestData }));
          }
        }
        setStatus("Başarıyla kaydedildi.");
      } else {
        const contentData = await contentResponse.json().catch(() => ({}));
        const centerData = await centerResponse.json().catch(() => ({}));
        const detail = centerData.supabaseError || centerData.error || contentData.error || "Supabase bağlantısını ve ortam değişkenlerini kontrol edin.";
        setStatus(`Kaydedilemedi: ${detail}`);
      }
    } catch (error) {
      setStatus(`Kaydedilemedi: ${error instanceof Error ? error.message : "Beklenmeyen hata"}`);
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  const props = { content, setContent, currentSession };
  const shellClass = theme === "dark" ? "bg-[#050711] text-white" : "bg-slate-100 text-slate-950";
  const panelClass = theme === "dark" ? "border-white/10 bg-white/[0.045]" : "border-slate-200 bg-white";
  const headerClass = theme === "dark" ? "border-white/10 bg-[#050711]/90" : "border-slate-200 bg-white/90";

  return (
    <main className={`min-h-screen ${shellClass}`}>
      <header className={`sticky top-0 z-40 border-b ${headerClass} backdrop-blur-xl`}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[.22em] text-cyan-200">HK Dijital</p>
            <h1 className="text-2xl font-black">HK Dijital Kontrol Merkezi</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={toggleTheme} className="min-h-11 rounded-full border border-white/10 px-5 text-sm font-bold">
              {theme === "dark" ? "Aydınlık Tema" : "Karanlık Tema"}
            </button>
            <button disabled={saving} onClick={() => save()} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-cyan-300 px-5 text-sm font-black text-slate-950 disabled:opacity-60"><Save size={17} /> {saving ? "Kaydediliyor..." : "Kaydet"}</button>
            <button onClick={logout} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-5 text-sm font-bold"><LogOut size={17} /> Çıkış</button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[260px_1fr]">
        <aside className={`rounded-[8px] border p-3 ${panelClass}`}>
          {modules.map((module) => (
            <button key={module} onClick={() => setActive(module)} className={`mb-2 block w-full rounded-[8px] px-4 py-3 text-left text-sm font-bold ${active === module ? "bg-cyan-300 text-slate-950" : "text-slate-300 hover:bg-white/10"}`}>
              {module}
            </button>
          ))}
        </aside>
        <section className={`min-w-0 rounded-[8px] border p-5 ${panelClass}`}>
          {!supabaseConfigured && <p className="mb-5 rounded-[8px] border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">Supabase bağlantısı yapılandırılmadı. Canlı ortamda kaydetme çalışmaz.</p>}
          {bootstrapWarning && <p className="mb-5 rounded-[8px] border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">Süper admin kurulum anahtarları hâlâ aktif. Güvenlik için Vercel ortam değişkenlerinden kaldırın.</p>}
          {status && <p className={`mb-5 rounded-[8px] border p-3 text-sm ${status.includes("Kaydedilemedi") ? "border-red-300/30 bg-red-500/10 text-red-100" : "border-cyan-200/20 bg-cyan-200/10 text-cyan-100"}`}>{status}</p>}
          {active === "Genel Bakış" && <Overview content={content} setActive={setActive} />}
          {active === "Site Yönetimi" && <Settings {...props} />}
          {active === "Sayfa İçerikleri" && <Pages {...props} />}
          {active === "Marka Yönetimi" && <Brand {...props} />}
          {active === "Sosyal Medya" && <KeyValue title="Sosyal Medya Yönetimi" object={content.socials} onChange={(object) => setContent({ ...content, socials: object })} />}
          {active === "Hizmetler" && <Collection title="Hizmet Yönetimi" type="service" items={content.services} setItems={(items) => setContent({ ...content, services: items })} />}
          {active === "Paketler" && <Collection title="Paket Yönetimi" type="package" items={content.packages} setItems={(items) => setContent({ ...content, packages: items })} />}
          {active === "Sertifikalar" && <Collection title="Sertifika Yönetimi" type="certificate" items={content.certificates} setItems={(items) => setContent({ ...content, certificates: items })} />}
          {active === "Teklif Sihirbazı" && <QuoteWizardAdmin {...props} />}
          {active === "CRM / Potansiyel Müşteriler" && <Crm {...props} />}
          {active === "Müşteriler" && <CustomersAdmin {...props} />}
          {active === "Müşteri Paneli Yönetimi" && <CustomerPanelAdmin {...props} />}
          {active === "Reklam Yönetimi" && <CampaignAdmin {...props} />}
          {active === "Reklam Metrikleri" && <MetricAdmin {...props} />}
          {active === "Reklam Raporları" && <ReportsAdmin {...props} />}
          {active === "Yapılan Çalışmalar" && <UpdatesAdmin {...props} />}
          {active === "Dosyalar" && <FilesAdmin {...props} />}
          {active === "Medya Merkezi" && <Media {...props} />}
          {active === "API Ayarları" && <ApiSettings {...props} />}
          {active === "Yapay Zeka Merkezi" && <AiAssistant {...props} />}
          {active === "Ölçümleme Ayarları" && <TrackingSettings {...props} />}
          {active === "Kullanıcı Yönetimi" && <UsersAdmin {...props} />}
          {active === "Kullanım Kılavuzu" && <UsageGuide />}
          {active === "Ayarlar" && <Settings {...props} />}
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

function SelectField({ label, value, onChange, options, placeholder = "Seçin" }: any) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-200">
      {label}
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="min-h-11 rounded-[8px] border border-white/10 bg-black/30 px-3 text-white">
        <option value="">{placeholder}</option>
        {options.map((option) => typeof option === "string" ? <option key={option} value={option}>{option}</option> : <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function OtherSelectField({ label, value, onChange, options, manualLabel }: any) {
  const isKnown = options.includes(value);
  const selected = value && !isKnown ? "Diğer" : value || "";
  return (
    <div className="grid gap-3">
      <SelectField label={label} value={selected} onChange={(next) => onChange(next === "Diğer" ? "" : next)} options={options} />
      {selected === "Diğer" && <Field label={manualLabel} value={isKnown ? "" : value} onChange={onChange} />}
    </div>
  );
}

function CompanySelect({ label = "Firma", value, onChange, companies }: any) {
  return (
    <SelectField
      label={label}
      value={value}
      onChange={onChange}
      options={(companies || []).map((company) => ({ value: company.id, label: company.name }))}
      placeholder="Firma seçin"
    />
  );
}

function Overview({ content, setActive }: any) {
  const leads = content.leads ?? [];
  const stats = [
    ["Toplam lead", leads.length],
    ["Teklif formları", leads.filter((lead) => ["quote", "Teklif Formu", "Teklif Sihirbazı"].includes(lead.source)).length],
    ["İletişim formları", leads.filter((lead) => ["contact", "İletişim Formu"].includes(lead.source)).length],
    ["Aktif paket", content.packages.filter((item) => item.visible).length],
    ["Aktif hizmet", content.services.filter((item) => item.visible).length],
    ["AI provider", content.settings.api.demoMode ? "Demo" : content.settings.api.activeProvider]
  ];
  return (
    <Panel title="Genel Bakış">
      <div className="grid gap-4 md:grid-cols-3">{stats.map(([label, value]) => <div key={label} className="rounded-[8px] border border-white/10 bg-black/25 p-4"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-black text-cyan-100">{value}</p></div>)}</div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-[8px] border border-white/10 p-4"><h3 className="font-black">Son lead kayıtları</h3><div className="mt-4 grid gap-3">{leads.slice(0, 5).map((lead) => <div key={lead.id} className="rounded-[8px] bg-white/[0.04] p-3 text-sm"><p className="font-bold">{lead.name || "İsimsiz"} · {lead.status}</p><p className="text-slate-400">{lead.company || lead.email || lead.phone}</p></div>)}{!leads.length && <p className="text-sm text-slate-400">Henüz lead yok.</p>}</div></div>
        <div className="rounded-[8px] border border-white/10 p-4"><h3 className="font-black">Hızlı işlemler</h3><div className="mt-4 grid gap-2">{["Sayfa İçerikleri", "CRM / Potansiyel Müşteriler", "Medya Merkezi", "Yapay Zeka Merkezi", "Kullanıcı Yönetimi"].map((module) => <button key={module} onClick={() => setActive(module)} className="rounded-[8px] border border-white/10 px-4 py-3 text-left text-sm font-bold hover:bg-white/10">{module}</button>)}</div></div>
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
    <Panel title="Marka Yönetimi">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Firma adı" value={brand.companyName} onChange={(v) => update({ companyName: v })} />
        <Field label="Slogan" value={brand.slogan} onChange={(v) => update({ slogan: v })} />
        {["logoUrl", "footerLogoUrl", "faviconUrl"].map((key) => <div key={key} className="grid gap-3"><Field label={key} value={brand[key]} onChange={(v) => update({ [key]: v })} /><Upload onUrl={(url) => update({ [key]: url })} /></div>)}
        {Object.entries(brand.colors).map(([key, value]) => <Field key={key} type="color" label={`${key} color`} value={value} onChange={(v) => update({ colors: { ...brand.colors, [key]: v } })} />)}
        <Field label="Başlık yazı tipi" value={brand.typography.heading} onChange={(v) => update({ typography: { ...brand.typography, heading: v } })} />
        <Field label="Gövde yazı tipi" value={brand.typography.body} onChange={(v) => update({ typography: { ...brand.typography, body: v } })} />
      </div>
    </Panel>
  );
}

function Pages({ content, setContent }: any) {
  const pages = content.pages;
  const updatePage = (key, patch) => setContent({ ...content, pages: { ...pages, [key]: { ...pages[key], ...patch } } });
  return (
    <Panel title="Sayfa İçerikleri">
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
        {items.map((item, index) => <div key={item.id} className="grid gap-3 rounded-[8px] border border-white/10 p-4">
          {listFields.map((field) => <Field key={field} label={field} value={item[field]} onChange={(v) => update(index, { [field]: field === "order" ? Number(v) || 0 : v })} />)}
          {type === "service" && <OtherSelectField label="Hizmet kategorisi" value={item.category} onChange={(v) => update(index, { category: v })} options={serviceCategoryOptions} manualLabel="Hizmet kategorisini yazın" />}
          {type === "package" && <OtherSelectField label="Paket türü" value={item.packageType} onChange={(v) => update(index, { packageType: v })} options={packageTypeOptions} manualLabel="Paket türünü yazın" />}
          {type === "certificate" && <SelectField label="Sertifika durumu" value={item.status || (item.visible ? "Aktif" : "Pasif")} onChange={(v) => update(index, { status: v, visible: v !== "Pasif" })} options={["Aktif", "Pasif", "Öne Çıkan"]} />}
          <Upload onUrl={(url) => update(index, type === "certificate" ? { fileUrl: url } : { imageUrl: url })} /><TextArea label="Açıklama" value={item.description} onChange={(v) => update(index, { description: v })} />{(type === "service" || type === "package") && <TextArea label="Özellikler / dahil olanlar (satır satır)" value={(item.features || item.included || []).join("\n")} onChange={(v) => update(index, type === "package" ? { features: v.split("\n").filter(Boolean) } : { included: v.split("\n").filter(Boolean) })} />}<div className="flex flex-wrap gap-3"><label className="flex gap-2 text-sm"><input type="checkbox" checked={item.visible} onChange={(e) => update(index, { visible: e.target.checked })} /> Görünür</label>{type === "package" && <label className="flex gap-2 text-sm"><input type="checkbox" checked={item.recommended} onChange={(e) => update(index, { recommended: e.target.checked })} /> Önerilen</label>}<button onClick={() => setItems(items.filter((x) => x.id !== item.id))} className="inline-flex items-center gap-2 rounded-full border border-red-300/30 px-3 py-2 text-xs text-red-200"><Trash2 size={14} /> Sil</button></div></div>)}
      </div>
    </Panel>
  );
}

function QuoteWizardAdmin({ content, setContent }: any) {
  const wizard = content.quoteWizard;
  const update = (patch) => setContent({ ...content, quoteWizard: { ...wizard, ...patch } });
  return <Panel title="Teklif Sihirbazı Yönetimi"><div className="grid gap-4"><Field label="Başlık" value={wizard.title} onChange={(v) => update({ title: v })} /><Field label="Alt başlık" value={wizard.subtitle} onChange={(v) => update({ subtitle: v })} /><TextArea label="İşletme türleri" value={wizard.businessTypes.map((o) => o.label).join("\n")} onChange={(v) => update({ businessTypes: v.split("\n").filter(Boolean).map((label, i) => ({ id: `business-${i}`, label })) })} /><TextArea label="Hedef seçenekleri" value={wizard.goals.map((o) => o.label).join("\n")} onChange={(v) => update({ goals: v.split("\n").filter(Boolean).map((label, i) => ({ id: `goal-${i}`, label })) })} /><TextArea label="Bütçe aralıkları" value={wizard.budgets.map((o) => o.label).join("\n")} onChange={(v) => update({ budgets: v.split("\n").filter(Boolean).map((label, i) => ({ id: `budget-${i}`, label })) })} /><TextArea label="Başarı mesajı" value={wizard.successMessage} onChange={(v) => update({ successMessage: v })} /><TextArea label="WhatsApp mesaj şablonu" value={wizard.whatsappTemplate} onChange={(v) => update({ whatsappTemplate: v })} /><JsonBox label="Öneri mantığı JSON" value={wizard.recommendationRules} onChange={(recommendationRules) => update({ recommendationRules })} /></div></Panel>;
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
  return <Panel title="CRM / Potansiyel Müşteriler"><div className="mb-4 flex flex-col gap-3 md:flex-row"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Potansiyel müşteri ara..." className="min-h-11 flex-1 rounded-[8px] border border-white/10 bg-black/30 px-3 text-white" /><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950"><Download size={16} /> CSV Dışa Aktar</button></div><div className="grid gap-4">{leads.map((lead) => <div key={lead.id} className="grid gap-3 rounded-[8px] border border-white/10 p-4"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-black">{lead.name || "İsimsiz kayıt"}</h3><p className="text-sm text-slate-400">{lead.company} · {lead.phone} · {lead.email}</p></div><SelectField label="Lead durumu" value={lead.status} onChange={(v) => update(lead.id, { status: v })} options={leadStatuses} /></div><OtherSelectField label="Lead kaynağı" value={lead.source} onChange={(v) => update(lead.id, { source: v })} options={leadSourceOptions} manualLabel="Kaynağı yazın" /><p className="text-sm text-slate-300">Paket: {lead.recommendedPackage || lead.recommended_package || "-"} · Bütçe: {lead.budget || "-"} · Hedef: {lead.goal || "-"}</p><TextArea label="İç not" value={lead.internalNotes || lead.notes} onChange={(v) => update(lead.id, { internalNotes: v, notes: v })} /><Field label="Sonraki takip tarihi" type="date" value={lead.followUpDate || lead.follow_up_date} onChange={(v) => update(lead.id, { followUpDate: v, follow_up_date: v })} /></div>)}{!leads.length && <p className="text-sm text-slate-400">Kayıt bulunamadı.</p>}</div></Panel>;
}

function Media({ content, setContent }: any) {
  const [message, setMessage] = useState("");
  async function handle(file) {
    setMessage("Yükleniyor...");
    const media = await uploadFile(file);
    if (media) setContent({ ...content, media: [media, ...content.media] });
    setMessage(media ? "Yüklendi." : "Yüklenemedi.");
  }
  return <Panel title="Medya Kütüphanesi"><label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-[8px] border border-dashed border-cyan-200/30 bg-cyan-200/10 text-center"><ImagePlus /><span>PNG, JPG, SVG, WebP, MP4 veya PDF yükle</span><input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp,video/mp4,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])} /></label><p className="mt-3 text-sm text-slate-400">Canlı ortamda dosyalar Supabase Storage üzerindeki hk-dijital-media kovasına yüklenir. Supabase yoksa yerel geliştirme için fallback kullanılır.</p>{message && <p className="mt-3 text-sm text-cyan-100">{message}</p>}<div className="mt-5 grid gap-4 md:grid-cols-3">{content.media.map((item) => <div key={item.id} className="rounded-[8px] border border-white/10 p-3">{item.type === "image" ? <Image src={item.url} alt={item.name} width={360} height={160} className="h-32 w-full rounded-[8px] object-cover" /> : <div className="grid h-32 place-items-center rounded-[8px] bg-white/[0.06] text-sm font-bold">{item.type.toUpperCase()}</div>}<p className="mt-3 break-all text-xs text-slate-300">{item.url}</p><button onClick={() => setContent({ ...content, media: content.media.filter((m) => m.id !== item.id) })} className="mt-3 rounded-full border border-white/10 px-3 py-2 text-xs">Listeden kaldır</button></div>)}</div></Panel>;
}

function AiAssistant({ content, setContent }: any) {
  const [provider, setProvider] = useState(content.settings.api.activeProvider);
  const [prompt, setPrompt] = useState("HK Intelligence için CRM odaklı premium açıklama yaz.");
  const [output, setOutput] = useState("");
  const generated = useMemo(() => `Demo AI çıktısı (${provider}):\n\n${prompt}\n\nHK Dijital tonu ile öneri: Ölçülebilir strateji, CRM destekli takip, şeffaf raporlama ve reklam optimizasyonu odağında, satış garantisi vermeden güven oluşturan profesyonel bir metin kullanılmalıdır. Bu panel ana sayfa, hakkımda, hizmet, paket, sosyal medya, reklam metni, teklif ve takip mesajı üretiminde kullanılabilir.`, [prompt, provider]);
  return <Panel title="Yapay Zeka Asistanı"><div className="grid gap-4"><OtherSelectField label="Sağlayıcı seçimi" value={provider} onChange={setProvider} options={aiProviderOptions} manualLabel="Sağlayıcıyı yazın" /><TextArea label="Komut" value={prompt} onChange={setPrompt} /><button onClick={() => setOutput(generated)} className="inline-flex w-fit items-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950"><Sparkles size={17} /> Demo çıktı üret</button>{output && <div className="rounded-[8px] border border-white/10 bg-black/30 p-4"><pre className="whitespace-pre-wrap text-sm leading-7 text-slate-200">{output}</pre><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => navigator.clipboard.writeText(output)} className="inline-flex gap-2 rounded-full border border-white/10 px-4 py-2 text-sm"><Copy size={16} /> Kopyala</button><button onClick={() => setContent({ ...content, pages: { ...content.pages, home: { ...content.pages.home, subheadline: output } } })} className="rounded-full border border-white/10 px-4 py-2 text-sm">Ana sayfa alt metnine ekle</button></div></div>}</div></Panel>;
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
  return <Panel title="API Ayarları"><div className="grid gap-4 md:grid-cols-2"><Field label="Gemini API anahtarı" value={api.geminiApiKey} onChange={(v) => update({ geminiApiKey: v })} /><Field label="Groq API anahtarı" value={api.groqApiKey} onChange={(v) => update({ groqApiKey: v })} /><Field label="OpenAI API anahtarı alanı" value={api.openAiApiKey} onChange={(v) => update({ openAiApiKey: v })} /><Field label="Model seçimi" value={api.model} onChange={(v) => update({ model: v })} /><OtherSelectField label="Aktif sağlayıcı" value={api.activeProvider} onChange={(v) => update({ activeProvider: v })} options={apiProviderOptions} manualLabel="Sağlayıcıyı yazın" /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={api.demoMode} onChange={(e) => update({ demoMode: e.target.checked })} /> Demo modu</label></div><button onClick={testApi} className="mt-5 rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">API bağlantısını test et</button>{result && <p className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-100">{result}</p>}<p className="mt-4 text-sm text-slate-400">API anahtarları tarayıcıya aktarılmaz. Üretimde .env değişkenleri ve şifreli secret storage tercih edilmelidir.</p></Panel>;
}

function Settings({ content, setContent }: any) {
  const settings = content.settings;
  const update = (patch) => setContent({ ...content, settings: { ...settings, ...patch } });
  return <Panel title="Ayarlar"><div className="grid gap-4 md:grid-cols-2"><Field label="Site başlığı" value={settings.siteTitle} onChange={(v) => update({ siteTitle: v })} /><Field label="Site açıklaması" value={settings.siteDescription} onChange={(v) => update({ siteDescription: v })} /><Field label="Meta Pixel ID" value={settings.analyticsIds.metaPixel} onChange={(v) => update({ analyticsIds: { ...settings.analyticsIds, metaPixel: v } })} /><Field label="Google Tag Manager ID" value={settings.analyticsIds.googleTagManager} onChange={(v) => update({ analyticsIds: { ...settings.analyticsIds, googleTagManager: v } })} /><Field label="GA4 Measurement ID" value={settings.analyticsIds.gaMeasurement} onChange={(v) => update({ analyticsIds: { ...settings.analyticsIds, gaMeasurement: v } })} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.maintenanceMode} onChange={(e) => update({ maintenanceMode: e.target.checked })} /> Bakım modu</label><label className="grid gap-2 text-sm font-semibold text-slate-200">Varsayılan tema<select value={settings.defaultTheme} onChange={(e) => update({ defaultTheme: e.target.value })} className="min-h-11 rounded-[8px] border border-white/10 bg-black/30 px-3 text-white"><option value="dark">Koyu</option><option value="light">Açık</option></select></label><TextArea label="Yasal bilgilendirmeler" value={(settings.legalDisclaimers || []).join("\n")} onChange={(v) => update({ legalDisclaimers: v.split("\n").filter(Boolean) })} /></div><p className="mt-4 text-sm text-slate-400">Admin kullanıcı adı ve şifre .env üzerinden yönetilir. Üretimde hashlenmiş şifre, rate limit, audit log ve kullanıcı rolleri önerilir.</p></Panel>;
}

function CustomerPanelAdmin({ content, setContent }: any) {
  const update = (key, items) => setContent({ ...content, [key]: items });
  return (
    <Panel title="Müşteri Paneli Yönetimi">
      <p className="mb-4 text-sm leading-6 text-slate-400">Müşteri hesapları, şirket atamaları, görünürlük ayarları, müşteri dosyaları ve panel önizleme verileri buradan yönetilir. Kaydettiğiniz veriler Supabase yapılandırıldıysa kalıcı olarak saklanır.</p>
      <MiniCollection title="Müşteri görünürlük ayarları" items={content.customerVisibilitySettings || []} setItems={(items) => update("customerVisibilitySettings", items)} fields={["company_id", "show_campaigns", "show_metrics", "show_budget", "show_spent", "show_leads", "show_strategy_notes", "show_work_updates", "show_files", "show_contact_person"]} empty={{ company_id: "", show_campaigns: true, show_metrics: true, show_budget: true, show_spent: true, show_leads: true, show_strategy_notes: true, show_work_updates: true, show_files: true, show_contact_person: true }} />
      <p className="mt-3 text-sm text-slate-400">Müşteri önizleme için ilgili şirketin kullanıcı hesabıyla giriş yapabilir veya canlı panelde şirket atamasını kontrol edebilirsiniz.</p>
    </Panel>
  );
}

function CustomersAdmin({ content, setContent }: any) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");
  const [form, setForm] = useState({ fullName: "", email: "", password: "", company_id: "", role: "customer", is_active: true });
  const [companyForm, setCompanyForm] = useState({ name: "", sector: "", city: "Manisa", website: "", instagram: "", phone: "", email: "", status: "Aktif", notes: "" });
  const [companyQuery, setCompanyQuery] = useState("");
  const [editingCompanyId, setEditingCompanyId] = useState("");
  const updateCompany = (id, patch) => setContent({ ...content, companies: (content.companies || []).map((company) => company.id === id ? { ...company, ...patch } : company) });
  const companies = (content.companies || []).filter((company) => JSON.stringify(company).toLocaleLowerCase("tr").includes(companyQuery.toLocaleLowerCase("tr")));

  function showApiError(data, fallback) {
    setError(data.supabaseError ? `${data.error || fallback}: ${data.supabaseError}` : data.error || fallback);
  }

  async function createCompany() {
    setMessage("");
    setError("");
    if (!companyForm.name.trim()) {
      setError("Firma adı zorunludur.");
      return;
    }
    setLoading("company");
    const response = await fetch("/api/admin/companies/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(companyForm)
    });
    const data = await response.json().catch(() => ({}));
    setLoading("");
    if (response.ok) {
      setContent({ ...content, companies: [data.company, ...(content.companies || [])] });
      setCompanyForm({ name: "", sector: "", city: "Manisa", website: "", instagram: "", phone: "", email: "", status: "Aktif", notes: "" });
      setMessage("Firma başarıyla oluşturuldu. Artık müşteri hesabı bu firmaya bağlanabilir.");
    } else {
      showApiError(data, "Firma oluşturulamadı.");
    }
  }

  async function saveCompany(company) {
    setMessage("");
    setError("");
    setLoading(`company-${company.id}`);
    const response = await fetch(`/api/admin/companies/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(company)
    });
    const data = await response.json().catch(() => ({}));
    setLoading("");
    if (response.ok) {
      updateCompany(company.id, data.company || company);
      setEditingCompanyId("");
      setMessage("Firma başarıyla kaydedildi.");
    } else {
      showApiError(data, "Firma kaydedilemedi.");
    }
  }

  async function deleteCompany(company) {
    if (!confirm(`${company.name} firmasını silmek istediğinizden emin misiniz? Bu işlem bağlı kampanya ve müşteri kayıtlarını etkileyebilir.`)) return;
    setMessage("");
    setError("");
    setLoading(`delete-${company.id}`);
    const response = await fetch(`/api/admin/companies/${company.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setLoading("");
    if (response.ok) {
      setContent({ ...content, companies: (content.companies || []).filter((item) => item.id !== company.id) });
      setMessage("Firma silindi.");
    } else {
      showApiError(data, "Firma silinemedi.");
    }
  }

  async function archiveCompany(company) {
    await saveCompany({ ...company, status: "Pasif" });
  }

  async function createLogin() {
    setMessage("");
    setError("");
    if (form.role === "customer" && !form.company_id) {
      setError("Müşteri hesabı için firma seçimi zorunludur.");
      return;
    }
    setMessage("Kullanıcı oluşturuluyor...");
    setLoading("user");
    const response = await fetch("/api/admin/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        role: form.role,
        company_id: form.company_id,
        is_active: form.is_active
      })
    });
    const data = await response.json().catch(() => ({}));
    setLoading("");
    if (response.ok) {
      setContent({ ...content, users: [data.user, ...(content.users || [])] });
      setForm({ fullName: "", email: "", password: "", company_id: "", role: "customer", is_active: true });
      setMessage("Müşteri giriş hesabı oluşturuldu.");
    } else {
      showApiError(data, "Kullanıcı oluşturulamadı.");
    }
  }

  async function createDemoCustomer() {
    setMessage("");
    setError("");
    setLoading("demo");
    const response = await fetch("/api/admin/demo-customer", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setLoading("");
    if (response.ok) {
      setContent({
        ...content,
        companies: [data.company, ...(content.companies || []).filter((item) => item.id !== data.company.id)],
        users: [data.user, ...(content.users || []).filter((item) => item.id !== data.user.id)],
        customerVisibilitySettings: [data.visibility, ...(content.customerVisibilitySettings || []).filter((item) => item.id !== data.visibility.id)],
        campaigns: [data.campaign, ...(content.campaigns || []).filter((item) => item.id !== data.campaign.id)],
        campaignMetrics: [data.metric, ...(content.campaignMetrics || [])],
        customerUpdates: [...(data.updates || []), ...(content.customerUpdates || [])],
        customerFiles: [data.file, ...(content.customerFiles || [])]
      });
      setMessage(`${data.message} Giriş: ${data.credentials.email} / ${data.credentials.password}`);
    } else {
      showApiError(data, "Demo müşteri oluşturulamadı.");
    }
  }

  return (
    <Panel title="Müşteriler">
      {message && <p className="mb-4 rounded-[8px] border border-emerald-300/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">{message}</p>}
      {error && <p className="mb-4 rounded-[8px] border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}
      <div className="mb-6 rounded-[8px] border border-white/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-black">Hızlı firma oluştur</h3>
          <button disabled={loading === "demo"} onClick={createDemoCustomer} className="rounded-full border border-cyan-200/30 px-4 py-2 text-xs font-black text-cyan-100 disabled:opacity-60">
            {loading === "demo" ? "Demo hazırlanıyor..." : "My Cake 45 demo müşterisini oluştur"}
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="Firma Adı" value={companyForm.name} onChange={(v) => setCompanyForm({ ...companyForm, name: v })} />
          <OtherSelectField label="Sektör" value={companyForm.sector} onChange={(v) => setCompanyForm({ ...companyForm, sector: v })} options={sectorOptions} manualLabel="Sektörü yazın" />
          <OtherSelectField label="Şehir" value={companyForm.city} onChange={(v) => setCompanyForm({ ...companyForm, city: v })} options={cityOptions} manualLabel="Şehri yazın" />
          <Field label="Web Sitesi" value={companyForm.website} onChange={(v) => setCompanyForm({ ...companyForm, website: v })} />
          <Field label="Instagram" value={companyForm.instagram} onChange={(v) => setCompanyForm({ ...companyForm, instagram: v })} />
          <Field label="Telefon" value={companyForm.phone} onChange={(v) => setCompanyForm({ ...companyForm, phone: v })} />
          <Field label="E-posta" value={companyForm.email} onChange={(v) => setCompanyForm({ ...companyForm, email: v })} />
          <SelectField label="Durum" value={companyForm.status} onChange={(v) => setCompanyForm({ ...companyForm, status: v })} options={companyStatusOptions} />
          <TextArea label="Notlar" value={companyForm.notes} onChange={(v) => setCompanyForm({ ...companyForm, notes: v })} />
        </div>
        <button disabled={loading === "company"} onClick={createCompany} className="mt-4 rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60">
          {loading === "company" ? "Firma oluşturuluyor..." : "Firmayı oluştur"}
        </button>
      </div>
      <div className="mb-6 rounded-[8px] border border-white/10 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-black">Müşteri / firma listesi</h3>
          <input value={companyQuery} onChange={(e) => setCompanyQuery(e.target.value)} placeholder="Firma ara..." className="min-h-10 rounded-[8px] border border-white/10 bg-black/30 px-3 text-white" />
        </div>
        <div className="grid gap-3">
          {companies.map((company) => {
            const hasLogin = (content.users || []).some((user) => user.role === "customer" && user.company_id === company.id);
            const editing = editingCompanyId === company.id;
            return (
              <div key={company.id} className="rounded-[8px] border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <h4 className="font-black">{company.name}</h4>
                    <p className="text-sm text-slate-400">{company.sector || "-"} · {company.city || "-"} · Müşteri girişi: {hasLogin ? "Var" : "Yok"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={`/musteri-paneli?company=${company.id}`} target="_blank" className="rounded-full border border-cyan-200/30 px-3 py-2 text-xs font-bold text-cyan-100">Panel önizle</a>
                    <button onClick={() => setEditingCompanyId(editing ? "" : company.id)} className="rounded-full border border-white/10 px-3 py-2 text-xs">Düzenle</button>
                    <button onClick={() => archiveCompany(company)} className="rounded-full border border-amber-300/30 px-3 py-2 text-xs text-amber-100">Pasifleştir</button>
                    <button onClick={() => deleteCompany(company)} className="rounded-full border border-red-300/30 px-3 py-2 text-xs text-red-200">Sil</button>
                  </div>
                </div>
                {editing && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <Field label="Firma Adı" value={company.name} onChange={(v) => updateCompany(company.id, { name: v })} />
                    <OtherSelectField label="Sektör" value={company.sector} onChange={(v) => updateCompany(company.id, { sector: v })} options={sectorOptions} manualLabel="Sektörü yazın" />
                    <OtherSelectField label="Şehir" value={company.city} onChange={(v) => updateCompany(company.id, { city: v })} options={cityOptions} manualLabel="Şehri yazın" />
                    <SelectField label="Durum" value={company.status} onChange={(v) => updateCompany(company.id, { status: v })} options={companyStatusOptions} />
                    <Field label="Web Sitesi" value={company.website} onChange={(v) => updateCompany(company.id, { website: v })} />
                    <Field label="Instagram" value={company.instagram} onChange={(v) => updateCompany(company.id, { instagram: v })} />
                    <Field label="Telefon" value={company.phone} onChange={(v) => updateCompany(company.id, { phone: v })} />
                    <Field label="E-posta" value={company.email} onChange={(v) => updateCompany(company.id, { email: v })} />
                    <TextArea label="Notlar" value={company.notes} onChange={(v) => updateCompany(company.id, { notes: v })} />
                    <button disabled={loading === `company-${company.id}`} onClick={() => saveCompany(company)} className="h-fit w-fit self-end rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-60">
                      {loading === `company-${company.id}` ? "Kaydediliyor..." : "Firmayı kaydet"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {!companies.length && <p className="text-sm text-slate-400">Firma bulunamadı.</p>}
        </div>
      </div>
      <div className="rounded-[8px] border border-white/10 p-4">
        <h3 className="font-black">Müşteri giriş hesabı oluştur</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="Ad Soyad" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} />
          <Field label="E-posta" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="Geçici Şifre" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
          <CompanySelect value={form.company_id} onChange={(v) => setForm({ ...form, company_id: v })} companies={content.companies} />
          <SelectField label="Rol" value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={roleOptions} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Aktif</label>
        </div>
        <button disabled={loading === "user"} onClick={createLogin} className="mt-4 rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60">
          {loading === "user" ? "Hesap oluşturuluyor..." : "Giriş hesabı oluştur"}
        </button>
      </div>
    </Panel>
  );
}

function ReportsAdmin({ content, setContent }: any) {
  const update = (key, items) => setContent({ ...content, [key]: items });
  return (
    <Panel title="Reklam Raporları">
      <CampaignAdmin content={content} setContent={setContent} />
      <MetricAdmin content={content} setContent={setContent} />
      <UpdatesAdmin content={content} setContent={setContent} />
    </Panel>
  );
}

function CampaignAdmin({ content, setContent }: any) {
  const campaigns = content.campaigns || [];
  const update = (index, patch) => setContent({ ...content, campaigns: campaigns.map((item, i) => i === index ? { ...item, ...patch } : item) });
  return (
    <Panel title="Reklam Yönetimi">
      <button onClick={() => setContent({ ...content, campaigns: [...campaigns, { id: `${Date.now()}`, name: "Yeni Kampanya", platform: "Meta", objective: "Form", status: "Hazırlanıyor", visible_to_customer: true }] })} className="mb-4 inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950"><Plus size={16} /> Kampanya ekle</button>
      <div className="grid gap-4">
        {campaigns.map((campaign, index) => (
          <div key={campaign.id || index} className="grid gap-3 rounded-[8px] border border-white/10 p-4 md:grid-cols-2">
            <CompanySelect value={campaign.company_id || ""} onChange={(v) => update(index, { company_id: v })} companies={content.companies} />
            <Field label="Kampanya Adı" value={campaign.name} onChange={(v) => update(index, { name: v })} />
            <OtherSelectField label="Platform" value={campaign.platform} onChange={(v) => update(index, { platform: v })} options={platformOptions} manualLabel="Platformu yazın" />
            <OtherSelectField label="Hedef" value={campaign.objective} onChange={(v) => update(index, { objective: v })} options={objectiveOptions} manualLabel="Hedefi yazın" />
            <SelectField label="Durum" value={campaign.status} onChange={(v) => update(index, { status: v })} options={campaignStatusOptions} />
            <Field label="Başlangıç Tarihi" type="date" value={campaign.start_date} onChange={(v) => update(index, { start_date: v })} />
            <Field label="Bitiş Tarihi" type="date" value={campaign.end_date} onChange={(v) => update(index, { end_date: v })} />
            <Field label="Bütçe" type="number" value={campaign.budget} onChange={(v) => update(index, { budget: v })} />
            <Field label="Harcama" type="number" value={campaign.spent} onChange={(v) => update(index, { spent: v })} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={campaign.visible_to_customer ?? true} onChange={(e) => update(index, { visible_to_customer: e.target.checked })} /> Müşteri panelinde görünsün</label>
            <TextArea label="Notlar" value={campaign.notes} onChange={(v) => update(index, { notes: v })} />
            <button onClick={() => setContent({ ...content, campaigns: campaigns.filter((_, i) => i !== index) })} className="w-fit rounded-full border border-red-300/30 px-3 py-2 text-xs text-red-200">Sil</button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function MetricAdmin({ content, setContent }: any) {
  const metrics = content.campaignMetrics || [];
  const [importMessage, setImportMessage] = useState("");
  const [importError, setImportError] = useState("");
  const [importForm, setImportForm] = useState({ company_id: "", campaign_id: "" });
  const [preview, setPreview] = useState([]);
  const update = (index, patch) => setContent({ ...content, campaignMetrics: metrics.map((item, i) => i === index ? { ...item, ...patch } : item) });
  async function importMetaReport(file) {
    setImportMessage("Meta raporu içe aktarılıyor...");
    setImportError("");
    const form = new FormData();
    form.append("companyId", importForm.company_id);
    form.append("campaignId", importForm.campaign_id);
    form.append("file", file);
    const response = await fetch("/api/admin/meta-import", { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setImportMessage(data.message || "Meta raporu içe aktarıldı.");
      setPreview(data.preview || []);
      setContent({ ...content, campaignMetrics: [...(data.preview || []), ...metrics] });
    } else {
      setImportMessage("");
      setImportError(data.supabaseError ? `${data.error}: ${data.supabaseError}` : data.error || "Meta raporu içe aktarılamadı.");
    }
  }
  return (
    <Panel title="Reklam Metrikleri">
      <div className="mb-6 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-4">
        <h3 className="font-black">Meta Rapor İçe Aktar</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <CompanySelect value={importForm.company_id} onChange={(v) => setImportForm({ ...importForm, company_id: v, campaign_id: "" })} companies={content.companies} />
          <SelectField label="Kampanya" value={importForm.campaign_id} onChange={(v) => setImportForm({ ...importForm, campaign_id: v })} options={(content.campaigns || []).filter((campaign) => !importForm.company_id || campaign.company_id === importForm.company_id).map((campaign) => ({ value: campaign.id, label: campaign.name }))} placeholder="Kampanya seçin" />
          <label className="grid cursor-pointer gap-2 rounded-[8px] border border-dashed border-cyan-200/30 p-4 text-sm font-semibold text-cyan-100">
            CSV veya XLSX yükle
            <input className="hidden" type="file" accept=".csv,.xlsx,text/csv" onChange={(e) => e.target.files?.[0] && importMetaReport(e.target.files[0])} />
            <span className="text-xs text-slate-400">XLSX için ek paket gerekir; CSV önerilir.</span>
          </label>
        </div>
        {importMessage && <p className="mt-3 rounded-[8px] bg-emerald-500/10 p-3 text-sm text-emerald-100">{importMessage}</p>}
        {importError && <p className="mt-3 rounded-[8px] bg-red-500/10 p-3 text-sm text-red-100">{importError}</p>}
        {preview.length > 0 && <div className="mt-4 overflow-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="text-slate-400"><tr>{["Tarih", "Gösterim", "Erişim", "Tıklama", "Lead", "Harcama"].map((head) => <th key={head} className="p-2">{head}</th>)}</tr></thead><tbody>{preview.map((row, index) => <tr key={index} className="border-t border-white/10"><td className="p-2">{row.date}</td><td className="p-2">{row.impressions}</td><td className="p-2">{row.reach}</td><td className="p-2">{row.clicks}</td><td className="p-2">{row.leads}</td><td className="p-2">{row.spent}</td></tr>)}</tbody></table></div>}
      </div>
      <div className="mb-4 rounded-[8px] border border-white/10 p-4 text-sm leading-7 text-slate-300">
        <p>Gösterim: Reklamın ekranda kaç kez göründüğü.</p><p>Erişim: Reklamın kaç farklı kişiye ulaştığı.</p><p>Tıklama: Reklama yapılan toplam tıklama.</p><p>CTR: Tıklanma oranı. CPC: Tıklama başı maliyet. CPM: Bin gösterim maliyeti.</p><p>Lead: Potansiyel müşteri. Harcama: Reklam platformunda kullanılan bütçe.</p>
      </div>
      <button onClick={() => setContent({ ...content, campaignMetrics: [...metrics, { id: `${Date.now()}`, date: new Date().toISOString().slice(0, 10), period: "Günlük", source: "Manuel Giriş", impressions: 0, reach: 0, clicks: 0, messages: 0, leads: 0, spent: 0, visible_to_customer: true }] })} className="mb-4 inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950"><Plus size={16} /> Metrik ekle</button>
      <div className="grid gap-4">
        {metrics.map((metric, index) => (
          <div key={metric.id || index} className="grid gap-3 rounded-[8px] border border-white/10 p-4 md:grid-cols-3">
            <CompanySelect value={metric.company_id || ""} onChange={(v) => update(index, { company_id: v })} companies={content.companies} />
            <SelectField label="Kampanya" value={metric.campaign_id || ""} onChange={(v) => update(index, { campaign_id: v })} options={(content.campaigns || []).map((campaign) => ({ value: campaign.id, label: campaign.name }))} placeholder="Kampanya seçin" />
            <SelectField label="Periyot" value={metric.period || "Günlük"} onChange={(v) => update(index, { period: v })} options={metricPeriodOptions} />
            <OtherSelectField label="Kaynak" value={metric.source || "Manuel Giriş"} onChange={(v) => update(index, { source: v })} options={metricSourceOptions} manualLabel="Kaynağı yazın" />
            {["date", "impressions", "reach", "clicks", "messages", "leads", "conversions", "spent", "ctr", "cpc", "cpm", "cost_per_lead"].map((field) => <Field key={field} label={field} type={field === "date" ? "date" : "number"} value={metric[field]} onChange={(v) => update(index, { [field]: v })} />)}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={metric.visible_to_customer ?? true} onChange={(e) => update(index, { visible_to_customer: e.target.checked })} /> Müşteri panelinde görünsün</label>
            <TextArea label="Notlar" value={metric.notes} onChange={(v) => update(index, { notes: v })} />
            <button onClick={() => setContent({ ...content, campaignMetrics: metrics.filter((_, i) => i !== index) })} className="w-fit rounded-full border border-red-300/30 px-3 py-2 text-xs text-red-200">Sil</button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function UpdatesAdmin({ content, setContent }: any) {
  const updates = content.customerUpdates || [];
  const update = (index, patch) => setContent({ ...content, customerUpdates: updates.map((item, i) => i === index ? { ...item, ...patch } : item) });
  return (
    <Panel title="Yapılan Çalışmalar">
      <button onClick={() => setContent({ ...content, customerUpdates: [...updates, { id: `${Date.now()}`, title: "Yeni çalışma notu", update_type: "Yapılan Çalışma", visible_to_customer: true }] })} className="mb-4 inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950"><Plus size={16} /> Çalışma notu ekle</button>
      <div className="grid gap-4">
        {updates.map((item, index) => (
          <div key={item.id || index} className="grid gap-3 rounded-[8px] border border-white/10 p-4 md:grid-cols-2">
            <CompanySelect value={item.company_id || ""} onChange={(v) => update(index, { company_id: v })} companies={content.companies} />
            <OtherSelectField label="Güncelleme türü" value={item.update_type} onChange={(v) => update(index, { update_type: v })} options={updateTypeOptions} manualLabel="Güncelleme türünü yazın" />
            <Field label="Başlık" value={item.title} onChange={(v) => update(index, { title: v })} />
            <TextArea label="Ne yapıldı?" value={item.description} onChange={(v) => update(index, { description: v })} />
            <TextArea label="Neden önemli?" value={item.why_it_matters} onChange={(v) => update(index, { why_it_matters: v })} />
            <TextArea label="Sıradaki adım" value={item.next_step} onChange={(v) => update(index, { next_step: v })} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.visible_to_customer ?? true} onChange={(e) => update(index, { visible_to_customer: e.target.checked })} /> Müşteri panelinde görünsün</label>
            <button onClick={() => setContent({ ...content, customerUpdates: updates.filter((_, i) => i !== index) })} className="w-fit rounded-full border border-red-300/30 px-3 py-2 text-xs text-red-200">Sil</button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function FilesAdmin({ content, setContent }: any) {
  const files = content.customerFiles || [];
  const update = (index, patch) => setContent({ ...content, customerFiles: files.map((item, i) => i === index ? { ...item, ...patch } : item) });
  return (
    <Panel title="Dosyalar">
      <button onClick={() => setContent({ ...content, customerFiles: [...files, { id: `${Date.now()}`, title: "Yeni Dosya", file_type: "Rapor", visible_to_customer: true }] })} className="mb-4 inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950"><Plus size={16} /> Dosya kaydı ekle</button>
      <div className="grid gap-4">
        {files.map((item, index) => (
          <div key={item.id || index} className="grid gap-3 rounded-[8px] border border-white/10 p-4 md:grid-cols-2">
            <CompanySelect value={item.company_id || ""} onChange={(v) => update(index, { company_id: v })} companies={content.companies} />
            <OtherSelectField label="Dosya kategorisi" value={item.file_type} onChange={(v) => update(index, { file_type: v })} options={fileCategoryOptions} manualLabel="Dosya kategorisini yazın" />
            <Field label="Başlık" value={item.title} onChange={(v) => update(index, { title: v })} />
            <Field label="Dosya URL" value={item.file_url} onChange={(v) => update(index, { file_url: v })} />
            <Upload onUrl={(url) => update(index, { file_url: url })} />
            <TextArea label="Açıklama" value={item.description} onChange={(v) => update(index, { description: v })} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.visible_to_customer ?? true} onChange={(e) => update(index, { visible_to_customer: e.target.checked })} /> Müşteri panelinde görünsün</label>
            <button onClick={() => setContent({ ...content, customerFiles: files.filter((_, i) => i !== index) })} className="w-fit rounded-full border border-red-300/30 px-3 py-2 text-xs text-red-200">Sil</button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function UsersAdmin({ content, setContent, currentSession }: any) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [createForm, setCreateForm] = useState({ fullName: "", email: "", password: "", role: "editor", company_id: "", is_active: true });
  const users = (content.users || [])
    .filter((user) => JSON.stringify(user).toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")))
    .filter((user) => !roleFilter || user.role === roleFilter)
    .filter((user) => !statusFilter || (statusFilter === "Aktif" ? user.is_active : !user.is_active));
  const update = (id, patch) => setContent({ ...content, users: content.users.map((user) => user.id === id ? { ...user, ...patch } : user) });
  async function saveUser(user) {
    setError("");
    setMessage("Kullanıcı kaydediliyor...");
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user)
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      update(user.id, data.user || user);
      setEditingUser(null);
      setMessage("Kullanıcı kaydedildi.");
    } else {
      setMessage("");
      setError(data.supabaseError ? `${data.error}: ${data.supabaseError}` : data.error || "Kullanıcı kaydedilemedi.");
    }
  }
  async function resetPassword(user) {
    setError("");
    setMessage("Şifre sıfırlama bağlantısı hazırlanıyor...");
    const response = await fetch("/api/admin/users/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email })
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? data.message || "Şifre sıfırlama bağlantısı gönderildi." : "");
    if (!response.ok) setError(data.error || "Şifre sıfırlama bağlantısı gönderilemedi.");
  }
  async function createUser() {
    setError("");
    setMessage("Kullanıcı oluşturuluyor...");
    const response = await fetch("/api/admin/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm)
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setContent({ ...content, users: [data.user, ...(content.users || [])] });
      setCreateForm({ fullName: "", email: "", password: "", role: "editor", company_id: "", is_active: true });
      setMessage("Kullanıcı oluşturuldu.");
    } else {
      setMessage("");
      setError(data.supabaseError ? `${data.error}: ${data.supabaseError}` : data.error || "Kullanıcı oluşturulamadı.");
    }
  }
  return (
    <Panel title="Kullanıcı Yönetimi">
      <div className="mb-6 rounded-[8px] border border-white/10 p-4">
        <h3 className="font-black">Yeni kullanıcı oluştur</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="Ad Soyad" value={createForm.fullName} onChange={(v) => setCreateForm({ ...createForm, fullName: v })} />
          <Field label="E-posta" value={createForm.email} onChange={(v) => setCreateForm({ ...createForm, email: v })} />
          <Field label="Geçici Şifre" type="password" value={createForm.password} onChange={(v) => setCreateForm({ ...createForm, password: v })} />
          <SelectField label="Rol" value={createForm.role} onChange={(v) => setCreateForm({ ...createForm, role: v })} options={roleOptions} />
          <CompanySelect value={createForm.company_id} onChange={(v) => setCreateForm({ ...createForm, company_id: v })} companies={content.companies} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={createForm.is_active} onChange={(e) => setCreateForm({ ...createForm, is_active: e.target.checked })} /> Aktif</label>
        </div>
        <button onClick={createUser} className="mt-4 rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">Kullanıcı oluştur</button>
      </div>
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Kullanıcı ara..." className="min-h-11 rounded-[8px] border border-white/10 bg-black/30 px-3 text-white" />
        <SelectField label="Rol filtresi" value={roleFilter} onChange={setRoleFilter} options={roleOptions} placeholder="Tüm roller" />
        <SelectField label="Durum filtresi" value={statusFilter} onChange={setStatusFilter} options={statusOptions} placeholder="Tüm durumlar" />
      </div>
      {message && <p className="mb-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-100">{message}</p>}
      {error && <p className="mb-4 rounded-[8px] border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}
      <div className="grid gap-3">
        {users.map((user) => (
          <div key={user.id} className="rounded-[8px] border border-white/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-black">{user.full_name || user.email}</h3>
                <p className="text-sm text-slate-400">{user.email} · {roleOptions.find((role) => role.value === user.role)?.label || user.role} · {user.is_active ? "Aktif" : "Pasif"}</p>
                <p className="mt-1 text-xs text-slate-500">Auth bağlantısı: {user.auth_user_id ? "Bağlı" : "Eksik"} · Oluşturulma: {user.created_at ? new Date(user.created_at).toLocaleDateString("tr-TR") : "-"} · Güncelleme: {user.updated_at ? new Date(user.updated_at).toLocaleDateString("tr-TR") : "-"}</p>
                {currentSession?.profileId === user.id && <p className="mt-2 rounded-[8px] border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">Kendi hesabımı düzenliyorum. Yönetici rolünüz ve aktif durumunuz korunur.</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setEditingUser({ ...user })} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950">Kullanıcıyı düzenle</button>
                <button onClick={() => resetPassword(user)} className="rounded-full border border-white/10 px-4 py-2 text-sm">Şifre sıfırla</button>
              </div>
            </div>
          </div>
        ))}
        {!users.length && <p className="text-sm text-slate-400">Kullanıcı bulunamadı.</p>}
      </div>
      {editingUser && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-[8px] border border-white/10 bg-[#080b17] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-xl font-black">Kullanıcıyı düzenle</h3>
              <button onClick={() => setEditingUser(null)} className="rounded-full border border-white/10 px-3 py-2 text-sm">Kapat</button>
            </div>
            {currentSession?.profileId === editingUser.id && <p className="mb-4 rounded-[8px] border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">Kendi hesabımı düzenliyorum. Kendi yönetici rolünüzü kaldıramaz veya hesabınızı pasifleştiremezsiniz.</p>}
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Ad Soyad" value={editingUser.full_name || ""} onChange={(v) => setEditingUser({ ...editingUser, full_name: v })} />
              <Field label="E-posta" value={editingUser.email || ""} onChange={(v) => setEditingUser({ ...editingUser, email: v })} />
              <SelectField label="Rol" value={editingUser.role || "customer"} onChange={(v) => {
                if (!confirm("Kullanıcı rolünü değiştirmek istediğinizden emin misiniz?")) return;
                setEditingUser({ ...editingUser, role: v });
              }} options={roleOptions} />
              <CompanySelect value={editingUser.company_id || ""} onChange={(v) => setEditingUser({ ...editingUser, company_id: v })} companies={content.companies} />
              <SelectField label="Durum" value={editingUser.is_active ? "Aktif" : "Pasif"} onChange={(v) => {
                if (v === "Pasif" && !confirm("Kullanıcıyı pasifleştirmek istediğinizden emin misiniz?")) return;
                setEditingUser({ ...editingUser, is_active: v === "Aktif" });
              }} options={statusOptions} />
              <p className="self-end text-sm text-slate-400">Auth durumu: {editingUser.auth_user_id ? "Bağlı" : "Eksik"}</p>
            </div>
            <button onClick={() => saveUser(editingUser)} className="mt-5 rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">Değişiklikleri kaydet</button>
          </div>
        </div>
      )}
      <p className="mt-4 text-sm text-slate-400">Roller: Admin tam yetki, Editor içerik yönetimi, Sales CRM ve müşteri yönetimi, Customer yalnızca müşteri paneli.</p>
    </Panel>
  );
}

function TrackingSettings(props: any) {
  return <Settings {...props} />;
}

function UsageGuide() {
  const sections = [
    ["İlk giriş ve admin hesabı", "Süper admin kurulum ekranı yalnızca acil kurulum/onarım içindir. Giriş çalıştıktan sonra Vercel ortam değişkenlerinden bootstrap anahtarlarını kaldırın."],
    ["Müşteri oluşturma", "Müşteriler sekmesinden firma adını, sektörünü, şehrini ve iletişim bilgilerini girip Firmayı oluştur düğmesini kullanın."],
    ["Müşteri hesabı oluşturma", "Firma oluşturulduktan sonra müşteri giriş hesabı bölümünden kullanıcıyı firmaya bağlayın ve geçici şifre belirleyin."],
    ["Kampanya oluşturma", "Reklam Yönetimi sekmesinde firmayı seçin, platformu ve hedefi belirleyin, bütçe ve not bilgilerini ekleyin."],
    ["Reklam metriği manuel girme", "Reklam Metrikleri sekmesinden kampanya seçip gösterim, erişim, tıklama, lead ve harcama alanlarını girin."],
    ["Meta raporu içe aktarma", "Meta raporunu CSV olarak dışa aktarın, firma ve kampanya seçtikten sonra Meta Rapor İçe Aktar alanına yükleyin."],
    ["Müşteri panelinde ne görüneceğini seçme", "Müşteri Paneli Yönetimi sekmesinde kampanya, metrik, harcama, lead, dosya ve çalışma notu görünürlüklerini yönetin."],
    ["Dosya ve rapor yükleme", "Dosyalar sekmesinde müşteri dosya kaydı oluşturun. Medya Merkezi üzerinden görsel, PDF veya video yükleyebilirsiniz."],
    ["CRM / potansiyel müşteri takibi", "CRM sekmesinde lead durumunu, kaynağını, iç notları ve takip tarihini güncelleyin."],
    ["Site içeriklerini düzenleme", "Sayfa İçerikleri, Marka Yönetimi, Sosyal Medya, Hizmetler ve Paketler sekmelerinde görünür site içeriklerini düzenleyin."],
    ["Kullanıcı yetkileri", "Yönetici tam yetkilidir. Editör içerik yönetir. Satış / CRM müşteri ve lead sürecini yönetir. Müşteri yalnızca kendi panelini görür."],
    ["Güvenlik notları", "Kendi yönetici rolünüz kaldırılamaz. Son aktif yönetici pasifleştirilemez. API ve Supabase service role anahtarı tarayıcıya gönderilmez."]
  ];
  return (
    <Panel title="Kullanım Kılavuzu">
      <div className="grid gap-4">
        {sections.map(([title, text]) => (
          <div key={title} className="rounded-[8px] border border-white/10 bg-black/20 p-4">
            <h3 className="font-black">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function MiniCollection({ title, items, setItems, fields, empty }: any) {
  const update = (index, patch) => setItems(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  return (
    <div className="mb-6 rounded-[8px] border border-white/10 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-black">{title}</h3>
        <button onClick={() => setItems([...items, { id: `${Date.now()}`, ...empty }])} className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950"><Plus size={14} /> Ekle</button>
      </div>
      <div className="grid gap-4">
        {items.map((item, index) => (
          <div key={item.id || index} className="grid gap-3 rounded-[8px] bg-black/20 p-3 md:grid-cols-2">
            {fields.map((field) => typeof item[field] === "boolean" ? (
              <label key={field} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(item[field])} onChange={(e) => update(index, { [field]: e.target.checked })} /> {field}</label>
            ) : (
              <Field key={field} label={field} value={item[field] || ""} onChange={(v) => update(index, { [field]: v })} />
            ))}
            <button onClick={() => setItems(items.filter((_, i) => i !== index))} className="w-fit rounded-full border border-red-300/30 px-3 py-2 text-xs text-red-200">Sil</button>
          </div>
        ))}
        {!items.length && <p className="text-sm text-slate-400">Henüz kayıt yok.</p>}
      </div>
    </div>
  );
}
