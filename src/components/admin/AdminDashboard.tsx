"use client";
// @ts-nocheck

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowDown, ArrowUp, BarChart3, Bell, Bot, Building2, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, CircleOff, Copy, Download, FileBarChart, Gauge, GripVertical, HelpCircle, ImagePlus, LayoutDashboard, LogOut, MapPinned, MessageSquareText, Plus, RotateCcw, Save, Search, Settings2, Sparkles, Star, Trash2, UsersRound, WandSparkles, X } from "lucide-react";
import type { SiteContent } from "@/lib/types";
import { ReportTools } from "@/components/admin/reports/ReportTools";
import { Logo } from "@/components/public/Logo";
import { adminNavigationGroups, adminNavigationItems, getAdminHref } from "@/lib/admin-navigation";
import { GlassCard, MetricCard3D } from "@/components/premium/PremiumUI";

const crmActiveStatuses = ["Yeni Başvuru", "İletişime Geçildi", "Takipte", "Teklif Gönderildi", "Müşteri Oldu"];
const crmStatusTabs = ["Tüm Başvurular", "Yeni Başvurular", "İletişime Geçildi", "Takipte", "Teklif Gönderildi", "Müşteri Oldu", "Meta Analiz", "Google Ads Analiz", "Reddedilenler", "Silinenler"];
const leadStatuses = [...crmActiveStatuses, "Yeni", "Görüşülecek", "Teklif Hazırlanıyor", "Kazanıldı", "Kaybedildi", "Dönüştürüldü", "Reddedildi"];
const leadSourceOptions = ["İletişim Formu", "Teklif Formu", "Teklif Sihirbazı", "Müşteri Bulucu", "Meta Analiz", "Google Ads Analiz", "Instagram", "WhatsApp", "Referans", "Manuel Giriş", "Diğer"];
const roleOptions = [
  { value: "admin", label: "Yönetici" },
  { value: "yonetici", label: "Operasyon Yöneticisi" },
  { value: "editor", label: "Editör" },
  { value: "musteri", label: "Müşteri" }
];
const uiPermissionGroups = [
  ["Genel", ["dashboard", "genel-arama", "kullanim-kilavuzu"]],
  ["Müşteri & CRM", ["crm", "leads", "musteriler", "takip-gorevleri", "notlar"]],
  ["Keşif & Haritalar", ["musteri-bulucu", "haritalar", "bolgesel-analiz", "rakip-listesi", "kaydedilen-adaylar"]],
  ["Reklam Zekâsı", ["meta-analiz", "google-analiz", "sosyal-medya-denetimi", "funnel-analizi", "reklam-firsatlari"]],
  ["Hazırlık & Üretim", ["hazirlik", "ai-studio", "icerik-onerileri", "prompt-kutuphanesi", "kampanya-hazirligi"]],
  ["Teklif & Raporlama", ["teklifler", "teklif-listesi", "raporlar", "rapor-yorumlari", "disa-aktarimlar"]],
  ["Yönetim", ["kullanicilar", "roller-yetkiler", "site-ayarlari", "api-ayarlari", "tema-ayarlari", "medya", "sistem-loglari"]]
];
const uiRoleTemplates = {
  admin: uiPermissionGroups.flatMap(([, modules]) => modules),
  yonetici: ["dashboard", "genel-arama", "kullanim-kilavuzu", "crm", "leads", "musteriler", "takip-gorevleri", "notlar", "musteri-bulucu", "haritalar", "bolgesel-analiz", "kaydedilen-adaylar", "meta-analiz", "google-analiz", "sosyal-medya-denetimi", "hazirlik", "ai-studio", "teklifler", "teklif-listesi", "raporlar", "rapor-yorumlari", "disa-aktarimlar"],
  editor: ["dashboard", "genel-arama", "kullanim-kilavuzu", "crm", "leads", "hazirlik", "ai-studio", "icerik-onerileri", "prompt-kutuphanesi", "kampanya-hazirligi", "teklifler", "teklif-listesi", "raporlar", "rapor-yorumlari", "disa-aktarimlar", "medya"],
  musteri: []
};
const legacyRole = (role) => role === "sales" ? "yonetici" : role === "customer" ? "musteri" : role;
const customerRole = (role) => ["customer", "musteri"].includes(role);
const statusOptions = ["Aktif", "Pasif"];
const companyStatusOptions = ["Aktif", "Pasif", "Beklemede", "Potansiyel", "Eski Müşteri"];

function isLeadDeleted(lead: any) {
  return Boolean(lead?.deleted_at || lead?.deletedAt);
}

function isLeadRejected(lead: any) {
  return Boolean(lead?.rejected_at || lead?.rejectedAt || lead?.status === "Reddedildi" || lead?.status === "Kaybedildi");
}

function normalizeLeadWorkflowStatus(status?: string) {
  if (["Yeni", "Yeni Başvuru"].includes(status || "")) return "Yeni Başvurular";
  if (["Görüşülecek", "İletişime Geçildi"].includes(status || "")) return "İletişime Geçildi";
  if (status === "Takipte") return "Takipte";
  if (["Teklif Hazırlanıyor", "Teklif Gönderildi"].includes(status || "")) return "Teklif Gönderildi";
  if (["Kazanıldı", "Dönüştürüldü", "Müşteri Oldu"].includes(status || "")) return "Müşteri Oldu";
  return "Yeni Başvurular";
}

function crmTabForLead(lead: any) {
  if (isLeadDeleted(lead)) return "Silinenler";
  if (isLeadRejected(lead)) return "Reddedilenler";
  if (lead?.source === "Meta Analiz") return "Meta Analiz";
  if (lead?.source === "Google Ads Analiz") return "Google Ads Analiz";
  return normalizeLeadWorkflowStatus(lead?.status);
}
const sectorOptions = ["Butik Pasta", "Restoran", "Kafe", "Güzellik Merkezi", "Diş Kliniği", "Sağlık", "Eğitim", "E-ticaret", "Gayrimenkul", "Otomotiv", "Hizmet Sektörü", "Dernek / STK", "Diğer"];
const cityOptions = ["Manisa", "İzmir", "İstanbul", "Ankara", "Bursa", "Balıkesir", "Aydın", "Denizli", "Muğla", "Diğer"];
const analysisDistrictOptions = {
  Manisa: ["Yunusemre", "Şehzadeler", "Turgutlu", "Akhisar", "Salihli", "Soma"],
  İzmir: ["Konak", "Karşıyaka", "Bornova", "Bayraklı", "Buca", "Çeşme"],
  İstanbul: ["Kadıköy", "Beşiktaş", "Şişli", "Bakırköy", "Üsküdar", "Ataşehir"],
  Ankara: ["Çankaya", "Keçiören", "Yenimahalle", "Mamak", "Etimesgut", "Gölbaşı"],
  Bursa: ["Nilüfer", "Osmangazi", "Yıldırım", "Mudanya", "Gemlik", "İnegöl"],
  Balıkesir: ["Altıeylül", "Karesi", "Edremit", "Bandırma", "Ayvalık", "Burhaniye"],
  Aydın: ["Efeler", "Kuşadası", "Nazilli", "Didim", "Söke", "İncirliova"],
  Denizli: ["Pamukkale", "Merkezefendi", "Çivril", "Acıpayam", "Tavas", "Sarayköy"],
  Muğla: ["Menteşe", "Bodrum", "Marmaris", "Fethiye", "Milas", "Datça"],
  Diğer: ["Merkez"]
};
const platformOptions = ["Meta", "Instagram", "Facebook", "Google", "TikTok", "LinkedIn", "YouTube", "Diğer"];
const objectiveOptions = ["Bilinirlik", "Trafik", "Mesaj", "Form", "Satış", "Yeniden Pazarlama", "Video İzlenme", "Etkileşim", "Web Sitesi Ziyareti", "Diğer"];
const campaignStatusOptions = ["Hazırlanıyor", "Aktif", "Duraklatıldı", "Tamamlandı", "İptal Edildi"];
const metricPeriodOptions = ["Günlük", "Haftalık", "Aylık", "Özel Tarih"];
const metricSourceOptions = ["Manuel Giriş", "Meta Raporu", "Google Ads Raporu", "Diğer"];
const updateTypeOptions = ["Yapılan Çalışma", "Reklam Güncellemesi", "Rapor Notu", "Strateji Notu", "Uyarı", "Başarı", "Diğer"];
const fileCategoryOptions = ["Rapor", "Görsel", "Video", "Teklif", "Sözleşme", "Fatura", "Brief", "Diğer"];
const serviceCategoryOptions = ["Meta Reklamları", "Google Reklamları", "Sosyal Medya Yönetimi", "SEO", "Web Sitesi", "CRM", "Raporlama", "Yapay Zeka Analizi", "Diğer"];
const packageTypeOptions = ["Başlangıç", "Standart", "Profesyonel", "Premium", "Özel Paket", "Diğer"];
const apiProviderOptions = ["Gemini", "OpenAI", "Groq", "Otomatik", "Demo Modu", "Yerel Mod"];
const aiProviderOptions = apiProviderOptions;
const aiPriorityOptions = ["Gemini", "OpenAI", "Groq", "Demo Modu", "Yerel Mod"];
const aiPriorityKeys = ["gemini", "openai", "groq", "demo", "local"];
const aiKeyLabels: Record<string, string> = { gemini: "Gemini", openai: "OpenAI", groq: "Groq", demo: "Demo Modu", local: "Yerel Mod" };
const aiLabelKeys: Record<string, string> = { Gemini: "gemini", OpenAI: "openai", Groq: "groq", "Demo Modu": "demo", "Yerel Mod": "local" };
const metaMetricFields = [
  ["date", "Tarih", "Kayıt dönemi tarihi"],
  ["impressions", "Gösterim", "Reklamın ekranda kaç kez göründüğü"],
  ["reach", "Erişim", "Reklamın kaç farklı kişiye ulaştığı"],
  ["clicks", "Tıklama", "Reklama yapılan toplam tıklama"],
  ["messages", "Mesaj Başlatma", "Reklamdan başlatılan görüşmeler"],
  ["leads", "Potansiyel Müşteri", "Form, mesaj veya arama ile oluşan talepler"],
  ["spent", "Harcanan Tutar", "Reklam platformunda kullanılan bütçe"],
  ["ctr", "CTR / Tıklanma Oranı", "Gösterimlerden tıklamaya dönüşen oran"],
  ["cpc", "CPC / Tıklama Başı Maliyet", "Bir tıklamanın ortalama maliyeti"],
  ["cpm", "CPM / Bin Gösterim Maliyeti", "Bin gösterimin ortalama maliyeti"],
  ["cost_per_lead", "Sonuç Başına Maliyet", "Bir potansiyel müşteri için ortalama maliyet"]
];

const googleMetricFields = [
  ["date", "Tarih", "Kayıt dönemi tarihi"],
  ["impressions", "Gösterim", "Reklamın ekranda kaç kez göründüğü"],
  ["clicks", "Tıklama", "Reklama yapılan toplam tıklama"],
  ["conversions", "Dönüşüm", "Hedeflenen işlemi tamamlayan kullanıcı sayısı"],
  ["spent", "Maliyet", "Google Ads üzerinde kullanılan bütçe"],
  ["ctr", "TO / Tıklanma Oranı", "Gösterimlerden tıklamaya dönüşen oran"],
  ["cpc", "Ortalama TBM", "Bir tıklamanın ortalama maliyeti"],
  ["cost_per_lead", "Dönüşüm Maliyeti", "Bir dönüşüm için ortalama maliyet"]
];
const reportTypes = ["Meta Reklam Raporu", "Google Ads Raporu", "Sosyal Medya Yönetimi Raporu", "Genel Dijital Performans Raporu"];
const reportTabs = ["Meta Reklamları", "Google Ads", "Sosyal Medya Yönetimi", "Genel Raporlar"];
const socialPlatforms = ["Instagram", "Facebook", "TikTok", "YouTube", "LinkedIn", "X (Twitter)"];

function aiProviderLabel(value?: string) {
  const normalized = String(value || "").toLocaleLowerCase("tr");
  if (normalized.includes("openai")) return "OpenAI";
  if (normalized.includes("groq")) return "Groq";
  if (normalized.includes("gemini")) return "Gemini";
  if (normalized.includes("yerel") || normalized.includes("local")) return "Yerel Mod";
  if (normalized.includes("demo")) return "Demo Modu";
  if (normalized.includes("auto") || normalized.includes("otomatik")) return "Otomatik";
  return value || "Gemini";
}

function aiModeLabel(meta: any) {
  if (meta?.mode) return meta.mode;
  if (meta?.isLocal || String(meta?.provider || "").toLocaleLowerCase("tr").includes("yerel")) return "Yerel";
  if (meta?.isDemo || String(meta?.provider || "").toLocaleLowerCase("tr").includes("demo")) return "Demo";
  return "Canlı";
}

function aiMetaFromApi(api: any = {}) {
  const primary = api.active_ai_provider ? aiProviderLabel(api.active_ai_provider) : "";
  const legacy = api.activeProvider ? aiProviderLabel(api.activeProvider) : "";
  const provider = primary === "Otomatik" && legacy !== "Otomatik" ? legacy : ["Demo Modu", "Yerel Mod"].includes(primary) && ["Gemini", "OpenAI", "Groq"].includes(legacy) && !api.demoMode ? legacy : aiProviderLabel(api.active_ai_provider || api.activeProvider || (api.demoMode ? "Demo Modu" : "Gemini"));
  return {
    provider,
    model: api.active_ai_model || api.model || (provider === "Gemini" ? "gemini-2.0-flash" : provider === "Demo Modu" ? "demo-local" : "automatic-fallback"),
    mode: api.ai_mode === "local" ? "Yerel" : api.demoMode || provider === "Demo Modu" ? "Demo" : provider === "Yerel Mod" ? "Yerel" : "Canlı",
    badge: `${provider} ile üretildi`
  };
}

function aiMetaFromRecord(record: any = {}, api?: any) {
  const provider = aiProviderLabel(record.provider || record.ai_provider || api?.active_ai_provider || api?.activeProvider);
  return {
    provider,
    model: record.model || record.ai_model || api?.active_ai_model || api?.model || "demo-local",
    mode: aiModeLabel(record),
    badge: record.badge || `${provider} ile üretildi`
  };
}

function AiUsageBadge({ meta }: any) {
  const data = aiMetaFromRecord(meta);
  return <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[.1em]"><span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-cyan-100">{data.badge}</span><span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">Kullanılan AI Sağlayıcısı: {data.provider}</span><span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">Model: {data.model}</span><span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">Mod: {data.mode}</span></div>;
}

export function AdminDashboard({
  initialContent,
  supabaseConfigured = false,
  currentSession,
  allowedModules = [],
  systemStatus,
  bootstrapWarning = false,
  initialActive = "Dashboard"
}: {
  initialContent: SiteContent;
  supabaseConfigured?: boolean;
  currentSession?: any;
  allowedModules?: string[];
  systemStatus?: any;
  bootstrapWarning?: boolean;
  initialActive?: string;
}) {
  const [content, setContent] = useState(initialContent as any);
  const [active, setActive] = useState(initialActive);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [customTheme, setCustomTheme] = useState(null);
  const [bootVisible, setBootVisible] = useState(false);
  const [bootStep, setBootStep] = useState(0);
  const [openGroups, setOpenGroups] = useState(() => Object.fromEntries(adminNavigationGroups.map((group) => [group.label, true])));

  useEffect(() => {
    setTheme(localStorage.getItem("hk-admin-theme") || "dark");
    try { setCustomTheme(JSON.parse(localStorage.getItem("hk-admin-custom-theme") || "null")); } catch {}
    let shouldShowBoot = true;
    try {
      shouldShowBoot = !sessionStorage.getItem("hk-os-boot-complete");
      if (shouldShowBoot) sessionStorage.setItem("hk-os-boot-complete", "true");
    } catch {
      shouldShowBoot = true;
    }
    if (shouldShowBoot) {
      setBootVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!bootVisible) return;
    const timer = window.setInterval(() => {
      setBootStep((current) => {
        if (current >= bootSequence.length) {
          window.clearInterval(timer);
          window.setTimeout(() => setBootVisible(false), 700);
          return current;
        }
        return current + 1;
      });
    }, 360);
    return () => window.clearInterval(timer);
  }, [bootVisible]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("hk-admin-theme", next);
  }

  function toggleGroup(label: string) {
    setOpenGroups((current) => ({ ...current, [label]: !current[label] }));
  }

  async function save(next = content) {
    setSaving(true);
    setStatus("Kaydediliyor...");
    try {
      const contentResponse = allowedModules.includes("site-ayarlari")
        ? await fetch("/api/content", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) })
        : new Response(JSON.stringify({ ok: true }), { status: 200 });
      const centerResponse = supabaseConfigured && allowedModules.includes("musteriler")
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

  const props = { content, setContent, currentSession, allowedModules, setActive };
  const visibleNavigationGroups = adminNavigationGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => allowedModules.includes(item.module)) }))
    .filter((group) => group.items.length);
  const shellClass = theme === "dark" ? "bg-[#050711] text-white" : "bg-slate-100 text-slate-950";
  const panelClass = theme === "dark" ? "border-white/10 bg-white/[0.045]" : "border-slate-200 bg-white";
  const headerClass = theme === "dark" ? "border-white/10 bg-[#050711]/90" : "border-slate-200 bg-white/90";
  const aiStatus = aiMetaFromApi(content.settings?.api || {});

  return (
    <main className={`relative min-h-screen overflow-hidden ${theme === "light" ? "admin-light" : ""} ${customTheme ? "admin-themed" : ""} ${shellClass}`} style={customTheme ? { backgroundColor: customTheme.background, color: customTheme.text, "--admin-surface": customTheme.surface, "--admin-border": customTheme.border, "--admin-sidebar": customTheme.sidebar, "--admin-header": customTheme.header, "--admin-muted": customTheme.mutedText, "--admin-button": customTheme.primaryButton } : undefined}>
      <div className="premium-grid pointer-events-none absolute inset-0 opacity-45" />
      <header className={`sticky top-0 z-40 border-b ${headerClass} shadow-[0_16px_48px_rgba(0,0,0,.18)] backdrop-blur-2xl`}>
        <div className="relative mx-auto flex max-w-[1540px] flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <Logo content={content} compact />
            <div>
            <p className="text-xs font-bold uppercase tracking-[.22em] text-cyan-200">Digital Marketing Command Center</p>
            <h1 className="text-xl font-black sm:text-2xl">HK Operating System</h1>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Powered by HK Dijital</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button onClick={() => setActive("API Ayarları")} className="min-h-11 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-4 text-left text-xs font-bold text-cyan-50">
              <span className="block">AI: {aiStatus.provider}</span>
              <span className="block text-[10px] text-cyan-100/70">Mod: {aiStatus.mode}</span>
            </button>
            <GlobalAdminSearch />
            <div className="relative">
              <button onClick={() => setHelpOpen((current) => !current)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-5 text-sm font-bold">
                <HelpCircle size={17} /> Yardım
              </button>
              {helpOpen && (
                <div className="absolute right-0 top-14 z-50 w-[min(90vw,340px)] rounded-[8px] border border-white/10 bg-[#0a1020]/95 p-4 text-white shadow-2xl backdrop-blur-2xl">
                  <p className="text-sm font-black text-cyan-100">Hızlı yardım</p>
                  <p className="mt-2 text-xs leading-5 text-slate-300">İşletme aramak için Müşteri Bulucu, başvuruları takip etmek için CRM, müşteri raporları için Raporlar bölümünü kullanın.</p>
                  <div className="mt-3 grid gap-2 text-xs">
                    <Link onClick={() => setHelpOpen(false)} href="/hk-admin/kullanim-kilavuzu#isletme-kesfi-kullanimi" className="rounded-[8px] border border-white/10 px-3 py-2 hover:bg-white/10">İşletme keşfi adımları</Link>
                    <Link onClick={() => setHelpOpen(false)} href="/hk-admin/kullanim-kilavuzu#raporlama-kullanimi" className="rounded-[8px] border border-white/10 px-3 py-2 hover:bg-white/10">Raporlama adımları</Link>
                    <Link onClick={() => setHelpOpen(false)} href="/hk-admin/kullanim-kilavuzu" className="rounded-[8px] bg-cyan-300 px-3 py-2 font-black text-slate-950">Kullanım kılavuzunu aç</Link>
                  </div>
                </div>
              )}
            </div>
            <button onClick={toggleTheme} className="min-h-11 rounded-full border border-white/10 px-5 text-sm font-bold">
              {theme === "dark" ? "Aydınlık Tema" : "Karanlık Tema"}
            </button>
            {(allowedModules.includes("site-ayarlari") || allowedModules.includes("musteriler")) && <button disabled={saving} onClick={() => save()} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-cyan-300 px-5 text-sm font-black text-slate-950 disabled:opacity-60"><Save size={17} /> {saving ? "Kaydediliyor..." : "Kaydet"}</button>}
            <button onClick={logout} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-5 text-sm font-bold"><LogOut size={17} /> Çıkış</button>
          </div>
        </div>
      </header>
      <div className={`relative mx-auto grid max-w-[1540px] gap-6 px-4 py-6 ${sidebarCollapsed ? "lg:grid-cols-[76px_1fr]" : "lg:grid-cols-[276px_1fr]"}`}>
        <aside className={`premium-scrollbar max-h-[calc(100vh-120px)] overflow-y-auto rounded-[8px] border p-3 shadow-[0_22px_80px_rgba(0,0,0,.2)] ${panelClass}`}>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            title={sidebarCollapsed ? "Menüyü genişlet" : "Menüyü daralt"}
            className="mb-3 hidden min-h-10 w-full items-center justify-center rounded-[8px] border border-white/10 text-cyan-100 hover:bg-white/10 lg:flex"
          >
            {sidebarCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
          {!sidebarCollapsed && <div className="mb-3 rounded-[8px] border border-cyan-200/15 bg-cyan-200/[0.06] p-3"><Logo content={content} /><p className="mt-3 text-[10px] font-black uppercase tracking-[.18em] text-cyan-100">HK Operating System</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">Powered by HK Dijital</p></div>}
          {visibleNavigationGroups.map((group) => {
            const expanded = openGroups[group.label];
            return (
              <div key={group.label} className="mb-2">
                {!sidebarCollapsed && <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="flex w-full items-center justify-between gap-2 rounded-[8px] px-3 py-3 text-left text-[11px] font-black uppercase text-slate-400 hover:bg-white/10"
                >
                  {group.label}
                  {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>}
                {(sidebarCollapsed || expanded) && (
                  <div className="mt-1 grid gap-1 border-l border-white/10 pl-3">
                    {group.items.map((item) => (
                      <Link
                        key={item.slug}
                        href={getAdminHref(item.slug)}
                        title={item.label}
                        className={`rounded-[8px] border px-3 py-2.5 text-left text-xs font-bold transition ${active === item.label ? "border-cyan-200/50 bg-cyan-300 text-slate-950 shadow-[0_8px_24px_rgba(34,211,238,.16)]" : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/10 hover:text-slate-200"}`}
                      >
                        {sidebarCollapsed ? item.label.slice(0, 2) : item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </aside>
        <section className={`min-w-0 rounded-[8px] border p-5 shadow-[0_24px_90px_rgba(0,0,0,.18)] ${panelClass}`}>
          {!supabaseConfigured && <p className="mb-5 rounded-[8px] border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">Supabase bağlantısı yapılandırılmadı. Canlı ortamda kaydetme çalışmaz.</p>}
          {bootstrapWarning && <p className="mb-5 rounded-[8px] border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">Süper admin kurulum anahtarları hâlâ aktif. Güvenlik için Vercel ortam değişkenlerinden kaldırın.</p>}
          {status && <p className={`mb-5 rounded-[8px] border p-3 text-sm ${status.includes("Kaydedilemedi") ? "border-red-300/30 bg-red-500/10 text-red-100" : "border-cyan-200/20 bg-cyan-200/10 text-cyan-100"}`}>{status}</p>}
          {active === "Dashboard" && <Overview content={content} setActive={setActive} supabaseConfigured={supabaseConfigured} systemStatus={systemStatus} currentSession={currentSession} allowedModules={allowedModules} />}
          {active === "CRM" && <CrmHub {...props} />}
          {["Müşteri Bulucu", "İşletme Keşfi"].includes(active) && <CustomerFinder {...props} />}
          {active === "Lead Yönetimi" && <Crm {...props} view="Lead Durumları" setActive={setActive} />}
          {active === "Meta Analiz" && <MetaAnalysisSection />}
          {active === "Google Analiz" && <GoogleAdsAnalysisSection />}
          {["Sosyal İstihbarat Merkezi", "Sosyal Medya Denetimi"].includes(active) && <SocialMediaAuditCenter />}
          {active === "AI Studio" && <AiAssistant {...props} mode="AI Studio" />}
          {active === "Teklif Motoru" && <ProposalEngine {...props} />}
          {active === "Raporlar" && <ReportsHub {...props} />}
          {active === "Müşteriler" && <CustomersAdmin {...props} />}
          {active === "Site Ayarları" && <SiteSettingsHub {...props} />}
          {active === "API Ayarları" && <ApiSettings {...props} />}
          {active === "Medya / Logo" && <MediaLogoHub {...props} />}
          {active === "Kullanıcılar" && <UsersHub {...props} />}
          {active === "Genel Arama" && <GlobalSearchPage />}
          {active === "Haritalar" && <MapsIntelligence {...props} setActive={setActive} />}
          {active === "Hazırlık Merkezi" && <PreparationCenter {...props} setActive={setActive} />}
          {active === "Tema Ayarları" && <ThemeEditor onApply={setCustomTheme} />}
          {active === "Roller & Yetkiler" && <UsersAdmin {...props} mode="Roller & Yetkiler" />}
          {active === "Sistem Logları" && <ActivityLogs content={content} />}
          {["Takip Görevleri", "Notlar"].includes(active) && <Crm {...props} view={active} setActive={setActive} />}
          {["Bölgesel Analiz", "Rakip Listesi", "Kaydedilen Adaylar"].includes(active) && <MapsIntelligence {...props} setActive={setActive} mode={active} />}
          {["Funnel Analizi", "Reklam Fırsatları"].includes(active) && <ChannelAnalysis {...props} channel={active} />}
          {["İçerik Önerileri", "Prompt Kütüphanesi", "Kampanya Hazırlığı"].includes(active) && <PreparationCenter {...props} setActive={setActive} mode={active} />}
          {["Teklifler", "Rapor Yorumları", "Dışa Aktarımlar"].includes(active) && <ReportsHub {...props} />}
          {active === "Genel Bakış" && <Overview content={content} setActive={setActive} supabaseConfigured={supabaseConfigured} systemStatus={systemStatus} currentSession={currentSession} allowedModules={allowedModules} />}
          {active === "Sayfa İçerikleri" && <Pages {...props} />}
          {active === "Marka Ayarları" && <Brand {...props} />}
          {active === "Sosyal Medya" && <KeyValue title="Sosyal Medya Yönetimi" object={content.socials} onChange={(object) => setContent({ ...content, socials: object })} />}
          {active === "Hizmetler" && <Collection title="Hizmet Yönetimi" type="service" items={content.services} setItems={(items) => setContent({ ...content, services: items })} />}
          {active === "Paketler" && <Collection title="Paket Yönetimi" type="package" items={content.packages} setItems={(items) => setContent({ ...content, packages: items })} />}
          {active === "Sertifikalar" && <Collection title="Sertifika Yönetimi" type="certificate" items={content.certificates} setItems={(items) => setContent({ ...content, certificates: items })} />}
          {active === "Teklif Sihirbazı Ayarları" && <QuoteWizardAdmin {...props} />}
          {["Form Başvuruları", "Teklif Sihirbazı Kayıtları", "Lead Durumları", "Takip Notları"].includes(active) && <Crm {...props} view={active} setActive={setActive} />}
          {active === "Eski Müşteriler" && <CustomersAdmin {...props} />}
          {active === "Müşteri Giriş Bilgileri" && <UsersAdmin {...props} customerOnly />}
          {active === "Panel Görünürlüğü" && <CustomerPanelAdmin {...props} />}
          {active === "Müşteri Dosyaları" && <FilesAdmin {...props} />}
          {active === "Kampanyalar" && <CampaignAdmin {...props} />}
          {["Reklam Metrikleri", "Meta Rapor İçe Aktar"].includes(active) && <MetricAdmin {...props} importOnly={active === "Meta Rapor İçe Aktar"} />}
          {active === "Raporlama Merkezi" && <ReportingCenter {...props} />}
          {active === "Rapor Notları" && <UpdatesAdmin {...props} />}
          {active === "Medya Merkezi" && <Media {...props} />}
          {active === "API Ayarları" && <ApiSettings {...props} />}
          {["İçerik Üretici", "Reklam Metni Üretici", "Rapor Özeti Üretici"].includes(active) && <AiAssistant {...props} mode={active} />}
          {active === "Ölçümleme Ayarları" && <TrackingSettings {...props} />}
          {["Kullanıcı Yönetimi", "Roller", "Güvenlik"].includes(active) && <UsersAdmin {...props} mode={active} />}
          {active === "Log Hareketleri" && <ActivityLogs content={content} />}
          {active === "Kullanım Kılavuzu" && <UsageGuide />}
        </section>
      </div>
      {bootVisible && <SystemBoot step={bootStep} />}
    </main>
  );
}

const bootSequence = [
  ["Initializing CRM...", "CRM Başlatılıyor..."],
  ["Initializing AI Studio...", "AI Studio Başlatılıyor..."],
  ["Initializing Reports...", "Raporlar Başlatılıyor..."],
  ["Initializing Discovery...", "İşletme Keşfi Başlatılıyor..."],
  ["Initializing Maps...", "Haritalar Başlatılıyor..."],
  ["Initializing Proposals...", "Teklif Motoru Başlatılıyor..."],
  ["Initializing Customers...", "Müşteriler Başlatılıyor..."],
  ["Initializing Operations...", "Operasyonlar Başlatılıyor..."]
];

function SystemBoot({ step }: { step: number }) {
  const complete = step >= bootSequence.length;
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-[#03050d]/95 px-5 backdrop-blur-2xl">
    <div className="w-full max-w-xl overflow-hidden rounded-[8px] border border-cyan-200/20 bg-[#07101c] p-6 shadow-[0_28px_120px_rgba(34,211,238,.2)] sm:p-8">
      <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-200">HK Operating System</p><p className="mt-2 text-[11px] font-bold uppercase tracking-[.18em] text-slate-500">Powered by HK Dijital</p></div><span className="grid size-11 place-items-center rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 text-cyan-100"><Sparkles size={20} /></span></div>
      <div className="mt-7 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300 transition-all duration-300" style={{ width: `${Math.min(100, step / bootSequence.length * 100)}%` }} /></div>
      <div className="mt-6 min-h-20">
        {complete ? <div className="animate-pulse"><p className="text-xl font-black text-white">Welcome to HK OS</p><p className="mt-2 text-sm text-cyan-100">HK Operating System hazır.</p></div> : <><p className="text-lg font-black text-white">{bootSequence[step]?.[0]}</p><p className="mt-2 text-sm text-cyan-100">{bootSequence[step]?.[1]}</p></>}
      </div>
      <p className="text-xs text-slate-500">Digital Marketing Command Center</p>
    </div>
  </div>;
}

function Panel({ title, children }: any) {
  return <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-200">HK Operating System</p><h2 className="mb-6 mt-2 text-2xl font-black">{title}</h2>{children}</div>;
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
      <SelectField label={label} value={selected} onChange={(next) => onChange(next === "Diğer" ? "__other__" : next)} options={options} />
      {selected === "Diğer" && <Field label={manualLabel} value={value === "__other__" || isKnown ? "" : value} onChange={onChange} />}
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

function GlobalAdminSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        window.setTimeout(() => document.getElementById("hk-command-search")?.focus(), 0);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);
  useEffect(() => {
    if (query.trim().length < 2) return setResults([]);
    const timer = setTimeout(async () => {
      const response = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`);
      const data = await response.json().catch(() => ({}));
      setResults(response.ok ? data.results || [] : []);
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);
  return <div className="relative"><button onClick={() => { setOpen(true); window.setTimeout(() => document.getElementById("hk-command-search")?.focus(), 0); }} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/10 px-4 text-sm text-slate-300"><Search size={16} className="text-cyan-200" /><span className="hidden xl:inline">Komut merkezinde ara</span><kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] font-black text-slate-500">⌘K</kbd></button>{open && <div className="fixed inset-0 z-[90] flex justify-center bg-[#02040b]/75 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={() => setOpen(false)}><div className="h-fit w-full max-w-2xl overflow-hidden rounded-[8px] border border-cyan-200/20 bg-[#08101e]/95 shadow-[0_28px_110px_rgba(0,0,0,.55)]" onMouseDown={(event) => event.stopPropagation()}><label className="flex min-h-16 items-center gap-3 border-b border-white/10 px-5"><Search size={19} className="text-cyan-200" /><input id="hk-command-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Lead, müşteri, rapor, kullanıcı, ayar veya modül ara..." className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500" /><button onClick={() => setOpen(false)} title="Kapat" className="rounded border border-white/10 px-2 py-1 text-[10px] font-black text-slate-400">ESC</button></label><div className="premium-scrollbar max-h-[56vh] overflow-y-auto p-2">{results.map((result) => <Link key={result.id} href={result.href} onClick={() => { setQuery(""); setOpen(false); }} className="flex items-center justify-between gap-3 rounded-[8px] px-3 py-3 text-sm hover:bg-white/10"><span><strong className="block text-white">{result.title}</strong><span className="mt-1 block text-xs text-slate-400">{result.detail}</span></span><span className="rounded-full border border-cyan-200/20 px-2 py-1 text-[10px] font-black text-cyan-100">{result.type}</span></Link>)}{query.trim().length < 2 && <p className="px-3 py-5 text-sm leading-6 text-slate-400">En az iki karakter yazın. Yetkiniz olan modüller ve operasyon kayıtları içinde arama yapılır.</p>}{query.trim().length >= 2 && !results.length && <p className="px-3 py-5 text-sm text-slate-400">Eşleşen sonuç bulunamadı.</p>}</div></div></div>}</div>;
}

function GlobalSearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  async function runSearch() {
    if (query.trim().length < 2) return setResults([]);
    setLoading(true);
    const response = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`);
    const data = await response.json().catch(() => ({}));
    setResults(response.ok ? data.results || [] : []);
    setLoading(false);
  }
  return <Panel title="Genel Arama"><p className="mb-4 text-sm leading-6 text-slate-400">Yetkiniz bulunan modüller, başvurular, müşteriler ve raporlar içinde arama yapın.</p><div className="flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && runSearch()} placeholder="Aramak istediğiniz kelimeyi yazın..." className="min-h-12 flex-1 rounded-[8px] border border-white/10 bg-black/30 px-4 text-white" /><button onClick={runSearch} className="rounded-[8px] bg-cyan-300 px-5 text-sm font-black text-slate-950">{loading ? "Aranıyor..." : "Ara"}</button></div><div className="mt-5 grid gap-3">{results.map((result) => <Link key={result.id} href={result.href} className="flex items-center justify-between gap-3 rounded-[8px] border border-white/10 bg-black/10 p-4 transition hover:border-cyan-200/40"><span><strong>{result.title}</strong><span className="mt-1 block text-sm text-slate-400">{result.detail}</span></span><span className="rounded-full border border-white/10 px-3 py-1 text-xs text-cyan-100">{result.type}</span></Link>)}{query && !loading && !results.length && <p className="rounded-[8px] border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">Aramanızla eşleşen kayıt bulunamadı.</p>}</div></Panel>;
}

const dashboardWidgetDefaults = ["metrics", "aiStatus", "status", "charts", "insights", "quickActions", "crm", "activity", "demo"];

function dateValue(item: any, ...keys: string[]) {
  const value = keys.map((key) => item?.[key]).find(Boolean);
  return value ? new Date(value) : null;
}

function buildDailySeries(items: any[], getDate: (item: any) => Date | null, getValue = () => 1, days = 7) {
  const dates = Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (days - index - 1));
    return date;
  });
  return {
    labels: dates.map((date) => date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })),
    values: dates.map((date) => items.reduce((sum, item) => {
      const itemDate = getDate(item);
      return itemDate && itemDate.toDateString() === date.toDateString() ? sum + Number(getValue(item) || 0) : sum;
    }, 0))
  };
}

function buildMonthlySeries(items: any[], getDate: (item: any) => Date | null, getValue = () => 1, months = 6) {
  const dates = Array.from({ length: months }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (months - index - 1));
    return date;
  });
  return {
    labels: dates.map((date) => date.toLocaleDateString("tr-TR", { month: "short" })),
    values: dates.map((date) => items.reduce((sum, item) => {
      const itemDate = getDate(item);
      return itemDate && itemDate.getMonth() === date.getMonth() && itemDate.getFullYear() === date.getFullYear() ? sum + Number(getValue(item) || 0) : sum;
    }, 0))
  };
}

function DashboardChart({ title, description, series, suffix = "" }: any) {
  const max = Math.max(...series.values, 0);
  const points = series.values.map((value, index) => `${index * (100 / Math.max(series.values.length - 1, 1))},${92 - (max ? value / max * 72 : 0)}`).join(" ");
  return (
    <GlassCard className="p-4">
      <p className="text-sm font-black text-white">{title}</p>
      <p className="mt-1 min-h-10 text-xs leading-5 text-slate-400">{description}</p>
      {max ? (
        <>
          <svg className="mt-4 h-36 w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`${title} grafiği`}>
            {[20, 44, 68, 92].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="rgba(148,163,184,.15)" strokeWidth=".6" />)}
            <polyline points={points} fill="none" stroke="#67e8f9" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" vectorEffect="non-scaling-stroke" />
            {series.values.map((value, index) => <circle key={`${series.labels[index]}-${value}`} cx={index * (100 / Math.max(series.values.length - 1, 1))} cy={92 - value / max * 72} r="1.8" fill="#facc15" />)}
          </svg>
          <div className="mt-2 flex justify-between gap-2 text-[10px] font-bold text-slate-500">{series.labels.map((label, index) => <span key={`${label}-${index}`} title={`${series.values[index]}${suffix}`}>{label}</span>)}</div>
        </>
      ) : <div className="mt-4 rounded-[8px] border border-dashed border-white/10 bg-black/10 px-3 py-8 text-center text-xs leading-5 text-slate-400">Bu grafiği oluşturmak için henüz yeterli kayıt yok. İlgili modülden veri eklediğinizde görünüm otomatik oluşur.</div>}
    </GlassCard>
  );
}

function aiStatusColor(status = "") {
  if (status === "Aktif") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  if (status === "Hata") return "border-red-300/25 bg-red-500/10 text-red-100";
  if (status === "API Eksik") return "border-slate-400/20 bg-slate-400/10 text-slate-300";
  return "border-amber-300/25 bg-amber-300/10 text-amber-100";
}

function AiStatusCenterWidget({ statuses = {}, message, loading, onRefresh }: any) {
  const items = [
    ["OpenAI", statuses.openai],
    ["Groq", statuses.groq],
    ["Gemini", statuses.gemini],
    ["Meta", statuses.meta],
    ["Google Maps", statuses.googleMaps],
    ["Google Ads", statuses.googleAds]
  ];
  return <GlassCard className="p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-pink-200">AI Durum Merkezi</p><h3 className="mt-2 text-xl font-black text-white">Sağlayıcı ve API bağlantıları</h3><p className="mt-1 text-sm text-slate-400">AI sağlayıcıları ve reklam/veri API durumlarını tek merkezden test edin.</p></div><div className="flex flex-wrap gap-2"><button disabled={loading} onClick={onRefresh} className="rounded-full border border-cyan-200/20 px-4 py-2 text-xs font-black text-cyan-100 disabled:opacity-60">AI Durumunu Yenile</button><button disabled={loading} onClick={onRefresh} className="rounded-full bg-amber-300 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-60">{loading ? "Test ediliyor..." : "Tüm Bağlantıları Test Et"}</button></div></div><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map(([label, item]) => <div key={label} className={`rounded-[8px] border p-4 ${aiStatusColor(item?.status)}`}><div className="flex items-center justify-between gap-3"><p className="font-black text-white">{label}</p><span className="rounded-full border border-current/20 px-2 py-1 text-[10px] font-black">{item?.status || "API Eksik"}</span></div><p className="mt-3 text-xs leading-5">Model: <strong>{item?.model || "-"}</strong></p><p className="mt-1 text-xs leading-5">Son test: <strong>{item?.lastTestTime ? new Date(item.lastTestTime).toLocaleString("tr-TR") : "-"}</strong></p>{item?.warning && <p className="mt-2 text-[11px] leading-5 opacity-80">{item.warning}</p>}</div>)}</div>{message && <p className="mt-4 rounded-[8px] border border-white/10 bg-black/15 p-3 text-xs text-slate-300">{message}</p>}</GlassCard>;
}

function Overview({ content, setActive, supabaseConfigured, systemStatus = {}, currentSession, allowedModules = [] }: any) {
  const leads = useMemo(() => content.leads ?? [], [content.leads]);
  const companies = useMemo(() => content.companies ?? [], [content.companies]);
  const campaigns = useMemo(() => content.campaigns ?? [], [content.campaigns]);
  const metrics = useMemo(() => content.campaignMetrics ?? [], [content.campaignMetrics]);
  const updates = useMemo(() => content.customerUpdates ?? [], [content.customerUpdates]);
  const users = useMemo(() => content.users ?? [], [content.users]);
  const reports = useMemo(() => content.reports ?? [], [content.reports]);
  const activityLogs = useMemo(() => content.activityLogs ?? [], [content.activityLogs]);
  const [demoMessage, setDemoMessage] = useState("");
  const [demoLoading, setDemoLoading] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const preferenceKey = `hk-dashboard-preferences:${currentSession?.id || currentSession?.userId || "admin"}`;
  const [preferences, setPreferences] = useState({ order: dashboardWidgetDefaults, hidden: [], favorites: ["Müşteri Bulucu", "CRM"] });
  const [aiStatusCenter, setAiStatusCenter] = useState(content.settings?.api?.ai_status || {});
  const [aiStatusMessage, setAiStatusMessage] = useState("");
  const [aiStatusLoading, setAiStatusLoading] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const aiAnalyzedLeads = leads.filter((lead) => lead.ai_analysis && Object.keys(lead.ai_analysis).length);
  const generatedProposals = leads.reduce((sum, lead) => sum + (Array.isArray(lead.proposal_history) ? lead.proposal_history.length : 0), 0);
  const hotLeads = leads.filter((lead) => Number(lead.lead_heat_score || 0) >= 70);
  const activeCustomers = companies.filter((company) => company.status === "Aktif");
  const metricsThisMonth = metrics.filter((metric) => String(metric.date || "").startsWith(month));

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(preferenceKey) || "null");
      if (saved?.order) setPreferences({ order: dashboardWidgetDefaults.filter((id) => saved.order.includes(id)).concat(dashboardWidgetDefaults.filter((id) => !saved.order.includes(id))), hidden: saved.hidden || [], favorites: saved.favorites || [] });
    } catch {}
  }, [preferenceKey]);

  function savePreferences(next: any) {
    setPreferences(next);
    localStorage.setItem(preferenceKey, JSON.stringify(next));
  }

  function moveWidget(id: string, direction: number) {
    const index = preferences.order.indexOf(id);
    const target = index + direction;
    if (target < 0 || target >= preferences.order.length) return;
    const order = [...preferences.order];
    [order[index], order[target]] = [order[target], order[index]];
    savePreferences({ ...preferences, order });
  }

  function toggleWidget(id: string) {
    savePreferences({ ...preferences, hidden: preferences.hidden.includes(id) ? preferences.hidden.filter((item) => item !== id) : [...preferences.hidden, id] });
  }

  function toggleFavorite(target: string) {
    savePreferences({ ...preferences, favorites: preferences.favorites.includes(target) ? preferences.favorites.filter((item) => item !== target) : [...preferences.favorites, target] });
  }

  const warmLeads = leads.filter((lead) => Number(lead.lead_heat_score || 0) >= 50 && Number(lead.lead_heat_score || 0) < 70);
  const coldLeads = leads.filter((lead) => Number(lead.lead_heat_score || 0) < 50);
  const newLeads = leads.filter((lead) => (lead.status || "Yeni") === "Yeni");
  const socialAuditLeads = leads.filter((lead) => ["Sosyal İstihbarat Merkezi", "Sosyal Medya Denetimi"].includes(lead.source));
  const metaLeadCount = leads.filter((lead) => lead.source === "Meta Analiz").length;
  const googleLeadCount = leads.filter((lead) => lead.source === "Google Ads Analiz").length;
  const stats = [
    ["Toplam Lead", leads.length, "CRM içindeki tüm potansiyel müşteriler", <UsersRound size={17} />, "blue"],
    ["Yeni Lead", newLeads.length, "Henüz yeni aşamasındaki başvurular", <Plus size={17} />, "emerald"],
    ["Sıcak Lead", hotLeads.length, "80+ veya yüksek fırsat skorlu kayıtlar", <Gauge size={17} />, "red"],
    ["Ilık Lead", warmLeads.length, "50-79 arası takip edilebilir fırsatlar", <Gauge size={17} />, "amber"],
    ["Soğuk Lead", coldLeads.length, "Geliştirilecek düşük skor kayıtları", <Gauge size={17} />, "slate"],
    ["CRM", activityLogs.length, "Kaydedilen operasyon hareketleri", <Activity size={17} />, "indigo"],
    ["Meta Analiz", metaLeadCount, "Meta analizinden CRM'e gelen kayıtlar", <BarChart3 size={17} />, "orange"],
    ["Google Analiz", googleLeadCount, "Google analizinden CRM'e gelen kayıtlar", <Search size={17} />, "cyan"],
    ["Sosyal İstihbarat", socialAuditLeads.length, "Sosyal istihbarattan kaydedilen fırsatlar", <Sparkles size={17} />, "gold"],
    ["AI Merkezi", aiAnalyzedLeads.length, "Yapay zeka ile yorumlanan başvurular", <Bot size={17} />, "purple"],
    ["Raporlar", reports.length, "Hazırlanan performans raporları", <FileBarChart size={17} />, "emerald"],
    ["Teklifler", generatedProposals, "CRM teklif geçmişi kayıtları", <MessageSquareText size={17} />, "rose"],
    ["Müşteriler", activeCustomers.length, "Hizmeti devam eden firmalar", <Building2 size={17} />, "teal"]
  ];
  const moduleAliases: Record<string, string> = { "Müşteri Bulucu": "musteri-bulucu" };
  const canOpen = (label: string) => allowedModules.includes(moduleAliases[label] || adminNavigationItems.find((item) => item.label === label)?.module);
  const quickActions = [
    ["Yeni İşletme Ara", "Müşteri Bulucu", <Search size={19} />],
    ["CRM Aç", "CRM", <UsersRound size={19} />],
    ["Haritalar Aç", "Haritalar", <MapPinned size={19} />],
    ["AI Analiz Oluştur", "Lead Yönetimi", <WandSparkles size={19} />],
    ["Sosyal İstihbarat", "Sosyal İstihbarat Merkezi", <Sparkles size={19} />],
    ["Teklif Hazırla", "Teklif Motoru", <MessageSquareText size={19} />],
    ["Rapor Oluştur", "Raporlar", <FileBarChart size={19} />],
    ["Müşteri Ekle", "Müşteriler", <Building2 size={19} />]
  ].filter(([, target]) => canOpen(target)).sort((a, b) => Number(preferences.favorites.includes(b[1])) - Number(preferences.favorites.includes(a[1])));
  const reportCompanyIds = new Set(reports.map((report) => report.company_id));
  const insightItems = [
    [hotLeads.filter((lead) => !["Kazanıldı", "Kaybedildi", "Dönüştürüldü"].includes(lead.status)).length, "Sıcak başvurular takip bekliyor", "Yüksek fırsat skorlu kayıtları bugün değerlendirin.", "Lead Yönetimi"],
    [leads.filter((lead) => !lead.ai_analysis || !Object.keys(lead.ai_analysis).length).length, "AI analizi eksik başvurular var", "Önceliklendirme için işletme analizlerini oluşturun.", "Lead Yönetimi"],
    [activeCustomers.filter((company) => !reportCompanyIds.has(company.id)).length, "Güncel raporu olmayan müşteriler var", "Müşteri iletişimini güçlendirmek için rapor hazırlayın.", "Raporlar"],
    [leads.filter((lead) => !(Array.isArray(lead.proposal_history) && lead.proposal_history.length) && Number(lead.lead_heat_score || 0) >= 50).length, "Teklif hazırlanabilecek fırsatlar var", "Uygun müşteriler için MIN, ORTA ve MAX seçeneklerini oluşturun.", "Teklif Motoru"]
  ].filter(([count, , , target]) => Number(count) > 0 && canOpen(target));
  const serviceItems = [
    ["OpenAI", systemStatus.openai, "Yapay zeka sağlayıcısı"],
    ["Groq", systemStatus.groq, "Yapay zeka sağlayıcısı"],
    ["Gemini", systemStatus.gemini, "Yapay zeka sağlayıcısı"],
    ["Google Maps API", systemStatus.googleMaps, "İşletme keşfi"],
    ["Supabase", systemStatus.supabase ?? supabaseConfigured, "Veri ve oturum altyapısı"],
    ["E-posta servisi", systemStatus.email, "Bildirim altyapısı"]
  ].map(([label, active, description]) => ({ label, description, state: active ? "Aktif" : label === "Supabase" ? "Çevrimdışı" : "Uyarı" }));
  const healthScore = Math.round(serviceItems.reduce((sum, service) => sum + (service.state === "Aktif" ? 100 : service.state === "Uyarı" ? 50 : 0), 0) / serviceItems.length);
  const crmColumns = ["Yeni", "Görüşülecek", "Teklif Hazırlanıyor", "Takipte", "Kazanıldı"].map((status) => ({ status, count: leads.filter((lead) => (lead.status || "Yeni") === status).length }));
  const recentActivity = activityLogs.length ? activityLogs.slice(0, 8) : [
    ...leads.map((lead) => ({ id: `lead-${lead.id}`, action: "Başvuru eklendi", entity: lead.company || lead.name || "Yeni başvuru", created_at: lead.created_at || lead.createdAt })),
    ...updates.map((update) => ({ id: `update-${update.id}`, action: "Müşteri güncellemesi", entity: update.title, created_at: update.created_at })),
    ...reports.map((report) => ({ id: `report-${report.id}`, action: "Rapor hazırlandı", entity: report.report_type, created_at: report.created_at }))
  ].sort((a, b) => Number(new Date(b.created_at)) - Number(new Date(a.created_at))).slice(0, 8);
  const charts = [
    ["Başvuru artışı", "Son 7 günde CRM'e eklenen potansiyel müşteriler.", buildDailySeries(leads, (lead) => dateValue(lead, "created_at", "createdAt"))],
    ["Müşteri artışı", "Son 6 ayda sisteme eklenen firmalar.", buildMonthlySeries(companies, (company) => dateValue(company, "created_at", "createdAt"))],
    ["Rapor üretimi", "Son 6 ayda hazırlanan müşteri raporları.", buildMonthlySeries(reports, (report) => dateValue(report, "created_at"))],
    ["AI analiz aktivitesi", "Analiz tarihi bulunan CRM kayıtlarının son 6 aylık dağılımı.", buildMonthlySeries(aiAnalyzedLeads, (lead) => dateValue(lead.ai_analysis, "generated_at", "created_at", "updated_at"))],
    ["Teklif üretimi", "CRM teklif geçmişinden hesaplanan son 6 aylık üretim.", buildMonthlySeries(leads.flatMap((lead) => Array.isArray(lead.proposal_history) ? lead.proposal_history : []), (proposal) => dateValue(proposal, "created_at", "generated_at", "date"))],
    ["Aylık performans", "Reklam metriklerinde kayıtlı aylık harcama hareketi.", buildMonthlySeries(metrics, (metric) => dateValue(metric, "date", "created_at"), (metric) => Number(metric.spent || 0)), " TL"]
  ];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? ["Good Morning", "Günaydın"] : hour < 18 ? ["Good Afternoon", "İyi Günler"] : ["Good Evening", "İyi Akşamlar"];
  const userName = currentSession?.fullName || currentSession?.email?.split("@")?.[0] || "Hayri";
  const metroTiles = [
    ["CRM", "Müşteri ilişkilerini yönetin", `${leads.length} başvuru`, "CRM", "xl:col-span-2", <UsersRound size={24} />],
    ["Lead Yönetimi", "Fırsatları önceliklendirin", `${hotLeads.length} sıcak lead`, "Lead Yönetimi", "", <Gauge size={24} />],
    ["İşletme Keşfi", "Yeni işletmeleri bulun", "Google Maps destekli", "Müşteri Bulucu", "", <Search size={24} />],
    ["Haritalar", "Bölgesel fırsatları inceleyin", `${leads.filter((lead) => lead.google_place_id).length} kayıt`, "Haritalar", "", <MapPinned size={24} />],
    ["Meta Analiz", "Reklam sinyallerini değerlendirin", "Analiz merkezi", "Meta Analiz", "", <BarChart3 size={24} />],
    ["Google Analiz", "Arama fırsatlarını değerlendirin", "Analiz merkezi", "Google Analiz", "", <Search size={24} />],
    ["AI Studio", "Ajans çıktıları üretin", `${aiAnalyzedLeads.length} analiz`, "AI Studio", "xl:col-span-2", <Bot size={24} />],
    ["Sosyal İstihbarat Merkezi", "Çoklu platform denetimi ve aksiyon üretimi", `${socialAuditLeads.length} kayıt`, "Sosyal İstihbarat Merkezi", "", <Sparkles size={24} />],
    ["Hazırlık Merkezi", "Kampanya hazırlığını tamamlayın", "Operasyon listesi", "Hazırlık Merkezi", "", <CircleCheck size={24} />],
    ["Teklif Motoru", "MIN, ORTA ve MAX teklifleri hazırlayın", `${generatedProposals} teklif`, "Teklif Motoru", "", <MessageSquareText size={24} />],
    ["Raporlar", "Müşteri performansını sunun", `${reports.length} rapor`, "Raporlar", "", <FileBarChart size={24} />],
    ["Müşteriler", "Aktif hesapları yönetin", `${activeCustomers.length} aktif`, "Müşteriler", "", <Building2 size={24} />]
  ].filter(([, , , target]) => canOpen(target));
  const dashboardPresets = {
    "CRM Focus": { order: ["metrics", "insights", "crm", "quickActions", "activity", "aiStatus", "status", "charts", "demo"], hidden: ["charts"], favorites: ["CRM", "Lead Yönetimi", "Müşteriler"] },
    "Sales Focus": { order: ["insights", "metrics", "quickActions", "crm", "activity", "aiStatus", "status", "charts", "demo"], hidden: ["demo"], favorites: ["Müşteri Bulucu", "Teklif Motoru", "CRM"] },
    "AI Focus": { order: ["aiStatus", "insights", "quickActions", "metrics", "charts", "activity", "status", "crm", "demo"], hidden: ["demo"], favorites: ["AI Studio", "Sosyal İstihbarat Merkezi", "Lead Yönetimi", "Hazırlık Merkezi"] },
    "Reporting Focus": { order: ["charts", "metrics", "insights", "quickActions", "activity", "aiStatus", "status", "crm", "demo"], hidden: ["crm"], favorites: ["Raporlar", "Müşteriler"] },
    "Executive Overview": { order: dashboardWidgetDefaults, hidden: [], favorites: ["Müşteri Bulucu", "CRM"] }
  };

  async function createDemoCustomer() {
    setDemoLoading(true);
    setDemoMessage("Demo müşteri hazırlanıyor...");
    const response = await fetch("/api/admin/demo-customer", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setDemoMessage(response.ok ? `${data.message}\nE-posta: ${data.credentials.email}\nGeçici şifre: ${data.credentials.password}\nPanel: /musteri-paneli` : data.error || "Demo müşteri oluşturulamadı.");
    setDemoLoading(false);
  }

  async function refreshAiStatus() {
    setAiStatusLoading(true);
    setAiStatusMessage("AI bağlantıları test ediliyor...");
    const response = await fetch("/api/admin/ai-status", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setAiStatusCenter(data.results || {});
      setAiStatusMessage(`Son test: ${new Date(data.lastTestTime || Date.now()).toLocaleString("tr-TR")}`);
    } else {
      setAiStatusMessage(data.error || "AI durum testi başarısız oldu.");
    }
    setAiStatusLoading(false);
  }

  const widgetNames = { metrics: "Sistem metrikleri", aiStatus: "AI Durum Merkezi", status: "Sistem durum merkezi", charts: "Gerçek veri grafikleri", insights: "AI içgörüleri", quickActions: "Hızlı aksiyonlar", crm: "CRM akışı", activity: "Son aktiviteler", demo: "Müşteri paneli testi" };
  const widgets: any = {
    metrics: <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{stats.map(([label, value, note, icon, accent]) => <MetricCard3D key={label} label={label} value={value} note={note} accent={accent} icon={icon} />)}</div>,
    aiStatus: <AiStatusCenterWidget statuses={aiStatusCenter} message={aiStatusMessage || (content.settings?.api?.ai_status_last_test_at ? `Son test: ${new Date(content.settings.api.ai_status_last_test_at).toLocaleString("tr-TR")}` : "Henüz test yapılmadı.")} loading={aiStatusLoading} onRefresh={refreshAiStatus} />,
    status: <GlassCard className="p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-100">Sistem durum merkezi</p><h3 className="mt-2 text-xl font-black text-white">Altyapı sağlığı</h3></div><div className="rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 px-4 py-3 text-right"><p className="text-xs text-cyan-100">Genel sistem sağlığı</p><p className="text-2xl font-black text-white">%{healthScore}</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{serviceItems.map((service) => <div key={service.label} className="flex items-center justify-between gap-3 rounded-[8px] border border-white/10 bg-black/10 p-3"><div><p className="text-sm font-bold text-white">{service.label}</p><p className="mt-1 text-xs text-slate-400">{service.description}</p></div><span className={`inline-flex items-center gap-1 text-xs font-black ${service.state === "Aktif" ? "text-emerald-300" : service.state === "Uyarı" ? "text-amber-300" : "text-red-300"}`}>{service.state === "Aktif" ? <CircleCheck size={14} /> : service.state === "Uyarı" ? <AlertTriangle size={14} /> : <CircleOff size={14} />}{service.state}</span></div>)}</div></GlassCard>,
    charts: <div><div className="mb-4"><h3 className="text-lg font-black">Gerçek veri görselleştirmesi</h3><p className="mt-1 text-sm text-slate-400">Grafikler yalnızca sistemde bulunan operasyon verilerinden üretilir.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{charts.map(([title, description, series, suffix]) => <DashboardChart key={title} title={title} description={description} series={series} suffix={suffix} />)}</div></div>,
    insights: <GlassCard className="p-5"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-[8px] bg-amber-300/10 text-amber-200"><WandSparkles size={19} /></span><div><p className="text-xs font-black uppercase tracking-[.16em] text-amber-200">AI içgörüleri</p><h3 className="mt-1 text-lg font-black">Bugünün operasyon önerileri</h3></div></div><div className="mt-4 grid gap-3">{insightItems.map(([count, title, text, target]) => <button key={title} onClick={() => setActive(target)} className="flex items-center justify-between gap-4 rounded-[8px] border border-white/10 bg-black/10 p-4 text-left transition hover:border-cyan-200/30 hover:bg-cyan-200/[0.06]"><div><p className="text-sm font-black text-white">{title}</p><p className="mt-1 text-xs leading-5 text-slate-400">{text}</p></div><span className="grid size-9 shrink-0 place-items-center rounded-full bg-cyan-300 text-sm font-black text-slate-950">{count}</span></button>)}{!insightItems.length && <p className="rounded-[8px] border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">Öncelikli aksiyon görünmüyor. Operasyon akışı düzenli ilerliyor.</p>}</div></GlassCard>,
    quickActions: <div><h3 className="text-lg font-black">Hızlı aksiyon merkezi</h3><p className="mt-1 text-sm text-slate-400">Sık kullanılan işlemlere tek adımda ulaşın.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{quickActions.map(([label, target, icon]) => <div key={label} className="relative"><button onClick={() => setActive(target)} className="flex min-h-28 w-full flex-col justify-between rounded-[8px] border border-white/10 bg-white/[0.035] p-4 text-left transition hover:-translate-y-1 hover:border-cyan-200/40 hover:bg-cyan-200/[0.08]"><span className="text-cyan-200">{icon}</span><span className="text-sm font-black text-white">{label}</span></button><button onClick={() => toggleFavorite(target)} title="Favorilere ekle veya çıkar" className={`absolute right-3 top-3 ${preferences.favorites.includes(target) ? "text-amber-300" : "text-slate-600"}`}><Star size={15} fill={preferences.favorites.includes(target) ? "currentColor" : "none"} /></button></div>)}</div></div>,
    crm: <GlassCard className="p-5"><h3 className="text-lg font-black">CRM akışı</h3><p className="mt-1 text-sm text-slate-400">Potansiyel müşterilerin güncel takip dağılımı.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{crmColumns.map((column) => <div key={column.status} className="rounded-[8px] border border-white/10 bg-black/10 p-3"><p className="text-xs text-slate-400">{column.status}</p><p className="mt-2 text-2xl font-black text-white">{column.count}</p></div>)}</div></GlassCard>,
    activity: <GlassCard className="p-5"><h3 className="text-lg font-black">Son aktivite akışı</h3><p className="mt-1 text-sm text-slate-400">CRM, rapor ve müşteri operasyonlarının son hareketleri.</p><div className="mt-4 grid gap-2">{recentActivity.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-[8px] border border-white/10 bg-black/10 p-3 text-sm"><div><p className="font-bold text-white">{item.action || "Sistem hareketi"}</p><p className="mt-1 text-xs text-slate-400">{item.entity || item.actor_name || "HK Operating System"}</p></div><time className="shrink-0 text-[10px] font-bold text-slate-500">{item.created_at ? new Date(item.created_at).toLocaleDateString("tr-TR") : "-"}</time></div>)}{!recentActivity.length && <p className="rounded-[8px] border border-dashed border-white/10 p-5 text-center text-sm text-slate-400">Henüz operasyon hareketi yok.</p>}</div></GlassCard>,
    demo: <div className="rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-4"><h3 className="font-black text-cyan-50">Müşteri paneli testi</h3><p className="mt-2 text-sm leading-6 text-cyan-100/80">Geçici şifreli bir test hesabı ve örnek raporlar oluşturarak müşteri deneyimini doğrulayın.</p><button disabled={demoLoading} onClick={createDemoCustomer} className="mt-3 rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-60">{demoLoading ? "Hazırlanıyor..." : "Demo müşteri oluştur"}</button>{demoMessage && <pre className="mt-3 whitespace-pre-wrap rounded-[8px] bg-black/20 p-3 text-xs leading-6 text-cyan-50">{demoMessage}</pre>}</div>
  };

  return (
    <Panel title="Operasyon Merkezi">
      <div className="mb-6 animate-[pulse_5s_ease-in-out_infinite] overflow-hidden rounded-[8px] border border-cyan-200/20 bg-[linear-gradient(135deg,rgba(34,211,238,.14),rgba(59,130,246,.06),rgba(250,204,21,.08))] p-5 shadow-[0_22px_80px_rgba(0,0,0,.18)] sm:p-6">
        <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-200">{greeting[0]}, {userName} 👋</p>
        <h2 className="mt-2 text-2xl font-black text-white">{greeting[1]}, {userName} 👋</h2>
        <p className="mt-5 text-lg font-black text-white">Welcome to HK Operating System</p>
        <p className="mt-1 text-sm font-bold text-cyan-100">Digital Marketing Command Center</p>
        <p className="mt-2 text-[11px] font-black uppercase tracking-[.18em] text-slate-400">Powered by HK Dijital</p>
      </div>
      <div className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-200">Metro çalışma alanı</p><h3 className="mt-1 text-xl font-black text-white">Operasyon modülleri</h3></div><span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black text-slate-400">HK OS</span></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metroTiles.map(([label, description, statistic, target, size, icon], index) => <Link key={label} href={target === "Haritalar" ? "/hk-admin/haritalar" : getAdminHref(adminNavigationItems.find((item) => item.label === target)?.slug || "")} className={`group min-h-36 rounded-[8px] border p-4 text-left transition duration-300 hover:-translate-y-1 hover:border-cyan-200/45 hover:shadow-[0_18px_55px_rgba(34,211,238,.12)] ${size} ${index % 4 === 0 ? "border-cyan-200/20 bg-cyan-200/[0.08]" : index % 4 === 1 ? "border-blue-300/20 bg-blue-300/[0.07]" : index % 4 === 2 ? "border-amber-200/20 bg-amber-200/[0.06]" : "border-white/10 bg-white/[0.04]"}`}><span className="text-cyan-100 transition group-hover:text-white">{icon}</span><span className="mt-6 block text-sm font-black text-white">{label}</span><span className="mt-1 block text-xs leading-5 text-slate-400">{description}</span><span className="mt-3 block text-[10px] font-black uppercase tracking-[.12em] text-cyan-200">{statistic}</span></Link>)}</div>
        </div>
        <aside className="rounded-[8px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_20px_64px_rgba(0,0,0,.16)]">
          <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-[8px] border border-amber-200/20 bg-amber-200/10 text-amber-200"><Bell size={17} /></span><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-amber-200">Insights & Notifications</p><h3 className="mt-1 text-sm font-black text-white">Operasyon bildirimleri</h3></div></div>
          <div className="mt-4 grid gap-2">{insightItems.slice(0, 5).map(([count, title, , target]) => <button key={title} onClick={() => setActive(target)} className="flex items-start justify-between gap-3 rounded-[8px] border border-white/10 bg-black/10 p-3 text-left transition hover:border-cyan-200/30"><span className="text-xs font-bold leading-5 text-slate-300">{title}</span><span className="grid size-6 shrink-0 place-items-center rounded-full bg-cyan-300 text-[10px] font-black text-slate-950">{count}</span></button>)}{!insightItems.length && <p className="rounded-[8px] border border-emerald-300/20 bg-emerald-300/10 p-3 text-xs leading-5 text-emerald-100">Öncelikli bildirim bulunmuyor.</p>}</div>
          <div className="mt-5 border-t border-white/10 pt-4"><p className="text-[10px] font-black uppercase tracking-[.15em] text-slate-500">Sistem sağlığı</p><div className="mt-2 flex items-end justify-between gap-3"><span className="text-3xl font-black text-white">%{healthScore}</span><span className={`text-xs font-black ${healthScore >= 80 ? "text-emerald-300" : healthScore >= 55 ? "text-amber-300" : "text-red-300"}`}>{healthScore >= 80 ? "Aktif" : healthScore >= 55 ? "Uyarı" : "Çevrimdışı"}</span></div></div>
        </aside>
      </div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-cyan-200/15 bg-cyan-200/[0.05] p-4">
        <div><p className="text-sm font-black text-cyan-50">Dashboard düzeniniz</p><p className="mt-1 text-xs text-slate-400">Widget görünürlüğünü, sırasını ve favori modüllerinizi kişiselleştirin.</p></div>
        <button onClick={() => setCustomizing((current) => !current)} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-cyan-200/20 px-4 text-xs font-black text-cyan-50"><Settings2 size={15} /> Dashboard'u düzenle</button>
      </div>
      {customizing && <GlassCard className="mb-5 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-black">Widget tercihleri</h3><button onClick={() => savePreferences({ order: dashboardWidgetDefaults, hidden: [], favorites: ["Müşteri Bulucu", "CRM"] })} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs font-bold"><RotateCcw size={14} /> Varsayılan düzene dön</button></div><div className="mt-4 flex flex-wrap gap-2">{Object.entries(dashboardPresets).map(([label, preset]) => <button key={label} onClick={() => savePreferences(preset)} className="rounded-full border border-cyan-200/20 px-3 py-2 text-xs font-black text-cyan-100 transition hover:bg-cyan-200/10">{label}</button>)}</div><div className="mt-4 grid gap-2 md:grid-cols-2">{preferences.order.map((id, index) => <div key={id} className="flex items-center gap-2 rounded-[8px] border border-white/10 bg-black/10 p-2"><GripVertical size={15} className="text-slate-500" /><label className="flex flex-1 items-center gap-2 text-xs font-bold"><input type="checkbox" checked={!preferences.hidden.includes(id)} onChange={() => toggleWidget(id)} />{widgetNames[id]}</label><button disabled={!index} onClick={() => moveWidget(id, -1)} title="Yukarı taşı" className="rounded p-1 disabled:opacity-30"><ArrowUp size={14} /></button><button disabled={index === preferences.order.length - 1} onClick={() => moveWidget(id, 1)} title="Aşağı taşı" className="rounded p-1 disabled:opacity-30"><ArrowDown size={14} /></button></div>)}</div></GlassCard>}
      <div className="grid gap-6">{preferences.order.filter((id) => !preferences.hidden.includes(id)).map((id) => <section key={id}>{widgets[id]}</section>)}</div>
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

function Crm({ content, setContent, view, setActive }: any) {
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [statusTab, setStatusTab] = useState("Tüm Başvurular");
  const [sectorFilter, setSectorFilter] = useState("");
  const [budgetFilter, setBudgetFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedLead, setSelectedLead] = useState(null);
  const [message, setMessage] = useState("");
  const leads = (content.leads ?? [])
    .filter((lead) => statusTab === "Tüm Başvurular" ? !isLeadDeleted(lead) && !isLeadRejected(lead) : crmTabForLead(lead) === statusTab)
    .filter((lead) => JSON.stringify(lead).toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")))
    .filter((lead) => !sourceFilter || lead.source === sourceFilter)
    .filter((lead) => !statusFilter || lead.status === statusFilter)
    .filter((lead) => !sectorFilter || (lead.business_type || lead.businessType) === sectorFilter)
    .filter((lead) => !budgetFilter || lead.budget === budgetFilter)
    .filter((lead) => !dateFrom || String(lead.created_at || lead.createdAt || "").slice(0, 10) >= dateFrom)
    .filter((lead) => !dateTo || String(lead.created_at || lead.createdAt || "").slice(0, 10) <= dateTo)
    .filter((lead) => view !== "Teklif Sihirbazı Kayıtları" || ["quote", "Teklif Formu", "Teklif Sihirbazı"].includes(lead.source));
  const tabCounts = crmStatusTabs.reduce((acc, tab) => {
    acc[tab] = tab === "Tüm Başvurular"
      ? (content.leads || []).filter((lead) => !isLeadDeleted(lead) && !isLeadRejected(lead)).length
      : (content.leads || []).filter((lead) => crmTabForLead(lead) === tab).length;
    return acc;
  }, {});
  const update = (id, patch) => {
    const nextLeads = content.leads.map((lead) => (lead.id === id ? { ...lead, ...patch } : lead));
    setContent({ ...content, leads: nextLeads });
    if (selectedLead?.id === id) setSelectedLead({ ...selectedLead, ...patch });
  };
  async function persistLead(id, patch, successMessage = "Başvuru güncellendi.") {
    setMessage("İşlem kaydediliyor...");
    const response = await fetch(`/api/admin/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.supabaseError ? `${data.error}: ${data.supabaseError}` : data.error || "Başvuru güncellenemedi.");
      return null;
    }
    update(id, data.lead || patch);
    setMessage(data.message || successMessage);
    return data.lead;
  }
  async function permanentDelete(id) {
    setMessage("Başvuru kalıcı olarak siliniyor...");
    const response = await fetch(`/api/admin/leads/${id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.supabaseError ? `${data.error}: ${data.supabaseError}` : data.error || "Başvuru kalıcı olarak silinemedi.");
      return false;
    }
    setContent({ ...content, leads: content.leads.filter((lead) => lead.id !== id) });
    setSelectedLead(null);
    setMessage(data.message || "Başvuru kalıcı olarak silindi.");
    return true;
  }
  function exportCsv() {
    const rows = leads.map((lead) => [lead.createdAt, lead.source, lead.name, lead.company, lead.phone, lead.email, lead.instagram, lead.website, lead.businessType, lead.goal, lead.budget, lead.recommendedPackage, lead.status, lead.note]);
    const csv = [["Tarih", "Kaynak", "Ad", "Firma", "Telefon", "E-posta", "Instagram", "Web", "İşletme", "Hedef", "Bütçe", "Paket", "Durum", "Not"], ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "hk-dijital-leads.csv";
    a.click();
  }
  return (
    <Panel title={view === "Teklif Sihirbazı Kayıtları" ? "Teklif Sihirbazı Kayıtları" : "Form Başvuruları"}>
      <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
        {crmStatusTabs.map((tab) => <button key={tab} onClick={() => setStatusTab(tab)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black transition ${statusTab === tab ? "border-cyan-200/60 bg-cyan-200/15 text-cyan-50" : "border-white/10 text-slate-400 hover:border-cyan-200/30 hover:text-cyan-100"}`}>{tab} <span className="ml-1 text-[10px] opacity-70">{tabCounts[tab] || 0}</span></button>)}
      </div>
      <div className="mb-5 grid gap-3 lg:grid-cols-[1.2fr_repeat(3,.7fr)]">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Başvuru ara..." className="min-h-11 rounded-[8px] border border-white/10 bg-black/30 px-3 text-white" />
        <SelectField label="Kaynak" value={sourceFilter} onChange={setSourceFilter} options={leadSourceOptions} placeholder="Tüm kaynaklar" />
        <SelectField label="Durum" value={statusFilter} onChange={setStatusFilter} options={leadStatuses} placeholder="Tüm durumlar" />
        <SelectField label="Sektör" value={sectorFilter} onChange={setSectorFilter} options={sectorOptions} placeholder="Tüm sektörler" />
      </div>
      <div className="mb-5 grid gap-3 md:grid-cols-[1fr_.8fr_.8fr_auto]">
        <input value={budgetFilter} onChange={(e) => setBudgetFilter(e.target.value)} placeholder="Bütçe filtresi" className="min-h-11 rounded-[8px] border border-white/10 bg-black/30 px-3 text-white" />
        <Field label="Başlangıç tarihi" type="date" value={dateFrom} onChange={setDateFrom} />
        <Field label="Bitiş tarihi" type="date" value={dateTo} onChange={setDateTo} />
        <button onClick={exportCsv} className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-cyan-300 px-4 text-sm font-black text-slate-950"><Download size={16} /> CSV Dışa Aktar</button>
      </div>
      {message && <p className="mb-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-100">{message}</p>}
      <div className="grid gap-3">
        {leads.map((lead) => (
          <button key={lead.id} onClick={() => setSelectedLead(lead)} className="rounded-[8px] border border-white/10 p-4 text-left transition hover:border-cyan-200/40 hover:bg-cyan-200/5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="font-black">{lead.name || "İsimsiz başvuru"}</h3><p className="mt-1 text-sm text-slate-400">{lead.source || "Form"} · {lead.company || "-"} · {lead.phone || lead.email || "-"}</p></div>
              <span className="rounded-full bg-cyan-200/10 px-3 py-1 text-xs font-bold text-cyan-100">{lead.status || "Yeni"}</span>
            </div>
            <p className="mt-3 text-sm text-slate-300">İşletme: {lead.business_type || lead.businessType || "-"} · Hedef: {lead.goal || "-"} · Bütçe: {lead.budget || "-"}</p>
            <p className="mt-1 text-xs text-slate-500">Önerilen paket: {lead.recommended_package || lead.recommendedPackage || "-"} · Gönderim: {formatDate(lead.created_at || lead.createdAt)}</p>
            {lead.rejection_reason && <p className="mt-2 rounded-[8px] border border-red-300/20 bg-red-500/10 p-2 text-xs text-red-100">Red nedeni: {lead.rejection_reason}</p>}
          </button>
        ))}
        {!leads.length && <p className="text-sm text-slate-400">Başvuru bulunamadı.</p>}
      </div>
      {selectedLead && <LeadDrawer lead={selectedLead} update={update} persistLead={persistLead} permanentDelete={permanentDelete} close={() => setSelectedLead(null)} onConverted={(data) => {
        setContent({
          ...content,
          leads: content.leads.map((lead) => lead.id === data.lead.id ? data.lead : lead),
          companies: data.company ? [data.company, ...(content.companies || []).filter((item) => item.id !== data.company.id)] : content.companies,
          users: data.user ? [data.user, ...(content.users || []).filter((item) => item.id !== data.user.id)] : content.users,
          customers: data.customer ? [data.customer, ...(content.customers || []).filter((item) => item.id !== data.customer.id)] : content.customers
        });
      }} />}
    </Panel>
  );
}

function formatDate(value: any) {
  return value ? new Date(value).toLocaleDateString("tr-TR") : "-";
}

function formatDateTime(value: any) {
  return value ? new Date(value).toLocaleString("tr-TR") : "-";
}

function LeadDrawer({ lead, update, persistLead, permanentDelete, close, onConverted }: any) {
  const [conversionMessage, setConversionMessage] = useState("");
  const [conversionError, setConversionError] = useState("");
  const [converting, setConverting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState("");
  const [rejectionReason, setRejectionReason] = useState(lead.rejection_reason || "");
  const [actionMessage, setActionMessage] = useState("");
  const deleted = isLeadDeleted(lead);
  const rejected = isLeadRejected(lead);
  const whatsappUrl = lead.phone ? `https://wa.me/${String(lead.phone).replace(/\D/g, "")}?text=${encodeURIComponent(`Merhaba ${lead.name || ""}, HK Dijital başvurunuz hakkında iletişime geçiyorum.`)}` : "";
  const details = [
    ["Kaynak", lead.source],
    ["Ad Soyad", lead.name],
    ["Firma", lead.company],
    ["Telefon", lead.phone],
    ["E-posta", lead.email],
    ["Instagram", lead.instagram],
    ["Web sitesi", lead.website],
    ["Adres", lead.address],
    ["Google puanı", lead.google_rating],
    ["Google yorum sayısı", lead.google_review_count],
    ["Google Place ID", lead.google_place_id],
    ["Sektör / İşletme türü", lead.business_type || lead.businessType],
    ["Ana hedef", lead.goal],
    ["Reklam bütçesi", lead.budget],
    ["Seçilen paket", lead.selected_package || lead.alternativePackage],
    ["Önerilen paket", lead.recommended_package || lead.recommendedPackage],
    ["Not / Mesaj", lead.message || lead.note],
    ["Formun geldiği sayfa", lead.page_url || lead.source || "Web sitesi"],
    ["Gönderim tarihi", formatDate(lead.created_at || lead.createdAt)],
    ["Dijital olgunluk skoru", lead.digital_maturity_score != null ? `${lead.digital_maturity_score} / 100` : "-"],
    ["Lead sıcaklık puanı", lead.lead_heat_score != null ? `${lead.lead_heat_score} / 100` : "-"]
  ];
  async function convert() {
    setConverting(true);
    setConversionMessage("");
    setConversionError("");
    const response = await fetch(`/api/admin/leads/${lead.id}/convert`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setConverting(false);
    if (!response.ok) {
      setConversionError(data.supabaseError ? `${data.error}: ${data.supabaseError}` : data.error || "Başvuru müşteriye dönüştürülemedi.");
      return;
    }
    onConverted(data);
    setConversionMessage(data.temporaryPassword ? `${data.message} Tek seferlik geçici şifre: ${data.temporaryPassword}` : data.message);
  }
  async function analyze() {
    setAnalyzing(true);
    setAnalysisMessage("AI analizi hazırlanıyor...");
    const response = await fetch(`/api/admin/leads/${lead.id}/analyze`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setAnalyzing(false);
    if (!response.ok) {
      setAnalysisMessage(data.supabaseError ? `${data.error}: ${data.supabaseError}` : data.error || "AI analizi oluşturulamadı.");
      return;
    }
    update(lead.id, { ai_analysis: data.analysis });
    lead.ai_analysis = data.analysis;
    setAnalysisMessage(data.message || "AI analizi oluşturuldu ve kaydedildi.");
  }
  async function softDelete() {
    const deleted_at = new Date().toISOString();
    const updated = await persistLead(lead.id, { deleted_at, status: lead.status || "Yeni Başvuru" }, "Başvuru Silinenler klasörüne taşındı.");
    if (updated) {
      setActionMessage("Başvuru Silinenler klasörüne taşındı.");
      setConfirmAction("");
    }
  }
  async function reject() {
    const rejected_at = new Date().toISOString();
    const updated = await persistLead(lead.id, { rejected_at, rejection_reason: rejectionReason || null, status: "Reddedildi" }, "Başvuru Reddedilenler klasörüne taşındı.");
    if (updated) {
      setActionMessage("Başvuru Reddedilenler klasörüne taşındı.");
      setConfirmAction("");
    }
  }
  async function restore() {
    const updated = await persistLead(lead.id, { deleted_at: null, rejected_at: null, rejection_reason: null, status: "Yeni Başvuru" }, "Başvuru geri yüklendi.");
    if (updated) setActionMessage("Başvuru aktif başvurulara geri yüklendi.");
  }
  async function removeForever() {
    const ok = await permanentDelete(lead.id);
    if (ok) setConfirmAction("");
  }
  return (
    <Drawer title="Başvuru Detayı" close={close}>
      <div className="grid gap-3 md:grid-cols-2">
        {details.map(([label, value]) => <InfoItem key={label} label={label} value={value || "-"} />)}
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <SelectField label="Durum" value={lead.status || "Yeni"} onChange={(value) => update(lead.id, { status: value })} options={leadStatuses} />
        <Field label="Takip tarihi" type="date" value={lead.follow_up_date || lead.followUpDate} onChange={(value) => update(lead.id, { follow_up_date: value, followUpDate: value })} />
        <div className="md:col-span-2"><TextArea label="Dahili notlar" value={lead.notes || lead.internalNotes} onChange={(value) => update(lead.id, { notes: value, internalNotes: value })} /></div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button onClick={() => setEditOpen(true)} className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950">Düzenle</button>
        <button onClick={convert} disabled={converting || ["Dönüştürüldü", "Müşteri Oldu"].includes(lead.status)} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-60">{converting ? "Dönüştürülüyor..." : ["Dönüştürüldü", "Müşteri Oldu"].includes(lead.status) ? "Müşteri oldu" : "Başvuruyu müşteriye dönüştür"}</button>
        <button onClick={() => persistLead(lead.id, { status: "Takipte", follow_up_date: lead.follow_up_date || new Date().toISOString().slice(0, 10) }, "Takip görevi oluşturuldu.")} className="rounded-full border border-white/10 px-4 py-2 text-sm">Takip görevi oluştur</button>
        <button onClick={analyze} disabled={analyzing || String(lead.id).startsWith("lead-")} className="inline-flex items-center gap-2 rounded-full border border-cyan-200/30 px-4 py-2 text-sm font-bold text-cyan-100 disabled:opacity-50"><Sparkles size={15} /> {analyzing ? "Analiz hazırlanıyor..." : "AI analizi oluştur"}</button>
        {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer" className="rounded-full bg-[#25D366] px-4 py-2 text-sm font-black text-white">WhatsApp mesajı gönder</a>}
        {!deleted && !rejected && <button onClick={() => setConfirmAction("reject")} className="rounded-full border border-amber-300/30 px-4 py-2 text-sm font-bold text-amber-100">Reddet</button>}
        {!deleted && <button onClick={() => setConfirmAction("delete")} className="rounded-full border border-red-300/30 px-4 py-2 text-sm font-bold text-red-100">Sil</button>}
        {(deleted || rejected) && <button onClick={restore} className="rounded-full border border-emerald-300/30 px-4 py-2 text-sm font-bold text-emerald-100">Geri Yükle</button>}
        {(deleted || rejected) && <button onClick={() => setConfirmAction("permanent")} className="rounded-full bg-red-500 px-4 py-2 text-sm font-black text-white">Kalıcı Sil</button>}
      </div>
      {actionMessage && <p className="mt-4 rounded-[8px] border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">{actionMessage}</p>}
      {analysisMessage && <p className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-100">{analysisMessage}</p>}
      {lead.ai_analysis?.text && <div className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-4"><h3 className="font-black text-cyan-50">HK Intelligence AI Analizi</h3><AiUsageBadge meta={lead.ai_analysis} /><pre className="mt-3 whitespace-pre-wrap text-sm leading-7 text-cyan-50">{lead.ai_analysis.text}</pre><p className="mt-3 text-xs text-cyan-100/70">{formatDateTime(lead.ai_analysis.generated_at)}</p></div>}
      {conversionMessage && <p className="mt-4 rounded-[8px] border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">{conversionMessage}</p>}
      {conversionError && <p className="mt-4 rounded-[8px] border border-red-300/20 bg-red-500/10 p-3 text-sm text-red-100">{conversionError}</p>}
      {editOpen && <LeadEditModal lead={lead} close={() => setEditOpen(false)} save={async (patch) => {
        const updated = await persistLead(lead.id, patch, "Başvuru düzenlendi.");
        if (updated) setEditOpen(false);
      }} />}
      {confirmAction === "delete" && <ConfirmDialog title="Başvuruyu Silinenler klasörüne taşı" description="Bu işlem başvuruyu ana CRM listesinden kaldırır. Daha sonra Silinenler klasöründen geri yükleyebilirsiniz." confirmLabel="Sil" tone="danger" onCancel={() => setConfirmAction("")} onConfirm={softDelete} />}
      {confirmAction === "reject" && <ConfirmDialog title="Başvuruyu reddet" description="Reddedilen başvurular yalnızca Reddedilenler klasöründe görünür. İsterseniz kısa bir red nedeni ekleyin." confirmLabel="Reddet" tone="warning" onCancel={() => setConfirmAction("")} onConfirm={reject}><TextArea rows={3} label="Red nedeni (opsiyonel)" value={rejectionReason} onChange={setRejectionReason} /></ConfirmDialog>}
      {confirmAction === "permanent" && <ConfirmDialog title="Başvuruyu kalıcı sil" description="Bu işlem geri alınamaz. Başvuru Supabase leads tablosundan tamamen silinir." confirmLabel="Kalıcı Sil" tone="danger" onCancel={() => setConfirmAction("")} onConfirm={removeForever} />}
    </Drawer>
  );
}

function LeadEditModal({ lead, close, save }: any) {
  const [form, setForm] = useState({
    source: lead.source || "Teklif Formu",
    name: lead.name || "",
    company: lead.company || "",
    phone: lead.phone || "",
    email: lead.email || "",
    instagram: lead.instagram || "",
    website: lead.website || "",
    business_type: lead.business_type || lead.businessType || "",
    goal: lead.goal || "",
    budget: lead.budget || "",
    recommended_package: lead.recommended_package || lead.recommendedPackage || "",
    message: lead.message || lead.note || "",
    status: lead.status || "Yeni Başvuru",
    follow_up_date: lead.follow_up_date || lead.followUpDate || "",
    notes: lead.notes || lead.internalNotes || "",
    rejection_reason: lead.rejection_reason || ""
  });
  const update = (patch) => setForm({ ...form, ...patch });
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-black/75 p-4"><div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-[8px] border border-white/10 bg-[#080b17] p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-200">CRM Başvuru Yönetimi</p><h2 className="mt-1 text-2xl font-black text-white">Başvuruyu Düzenle</h2></div><button onClick={close} className="grid size-10 place-items-center rounded-full border border-white/10"><X size={18} /></button></div><div className="grid gap-4 md:grid-cols-2"><SelectField label="Kaynak" value={form.source} onChange={(source) => update({ source })} options={leadSourceOptions} /><SelectField label="Durum" value={form.status} onChange={(status) => update({ status })} options={crmActiveStatuses} /><Field label="Ad Soyad" value={form.name} onChange={(name) => update({ name })} /><Field label="Firma" value={form.company} onChange={(company) => update({ company })} /><Field label="Telefon" value={form.phone} onChange={(phone) => update({ phone })} /><Field label="E-posta" value={form.email} onChange={(email) => update({ email })} /><Field label="Instagram" value={form.instagram} onChange={(instagram) => update({ instagram })} /><Field label="Web sitesi" value={form.website} onChange={(website) => update({ website })} /><OtherSelectField label="Sektör" value={form.business_type} onChange={(business_type) => update({ business_type })} options={sectorOptions} manualLabel="Sektörü yazın" /><Field label="Bütçe" value={form.budget} onChange={(budget) => update({ budget })} /><Field label="Önerilen paket" value={form.recommended_package} onChange={(recommended_package) => update({ recommended_package })} /><Field label="Takip tarihi" type="date" value={form.follow_up_date} onChange={(follow_up_date) => update({ follow_up_date })} /><div className="md:col-span-2"><TextArea label="Hedef" value={form.goal} onChange={(goal) => update({ goal })} /></div><div className="md:col-span-2"><TextArea label="Mesaj" value={form.message} onChange={(message) => update({ message })} /></div><div className="md:col-span-2"><TextArea label="Dahili notlar" value={form.notes} onChange={(notes) => update({ notes })} /></div><div className="md:col-span-2"><TextArea rows={3} label="Red nedeni" value={form.rejection_reason} onChange={(rejection_reason) => update({ rejection_reason })} /></div></div><div className="mt-6 flex flex-wrap justify-end gap-2"><button onClick={close} className="rounded-full border border-white/10 px-4 py-2 text-sm">Vazgeç</button><button onClick={() => save(form)} className="rounded-full bg-cyan-300 px-5 py-2 text-sm font-black text-slate-950">Değişiklikleri Kaydet</button></div></div></div>;
}

function ConfirmDialog({ title, description, confirmLabel, tone = "danger", children, onCancel, onConfirm }: any) {
  const danger = tone === "danger";
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-black/75 p-4"><div className="w-full max-w-lg rounded-[8px] border border-white/10 bg-[#080b17] p-5 shadow-2xl"><h2 className="text-xl font-black text-white">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>{children && <div className="mt-4">{children}</div>}<div className="mt-6 flex flex-wrap justify-end gap-2"><button onClick={onCancel} className="rounded-full border border-white/10 px-4 py-2 text-sm">Vazgeç</button><button onClick={onConfirm} className={`rounded-full px-5 py-2 text-sm font-black ${danger ? "bg-red-500 text-white" : "bg-amber-300 text-slate-950"}`}>{confirmLabel}</button></div></div></div>;
}

function Drawer({ title, close, children }: any) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70">
      <div className="h-full w-full max-w-4xl overflow-auto border-l border-white/10 bg-[#080b17] p-5 shadow-2xl sm:p-7">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-black text-white">{title}</h2>
          <button onClick={close} aria-label="Kapat" className="grid size-10 place-items-center rounded-full border border-white/10 text-white"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InfoItem({ label, value }: any) {
  return <div className="rounded-[8px] border border-white/10 bg-black/20 p-3"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 break-words text-sm text-slate-200">{value}</p></div>;
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
  const [prompt, setPrompt] = useState("HK Intelligence için CRM odaklı premium açıklama yaz.");
  const [output, setOutput] = useState("");
  const [meta, setMeta] = useState(aiMetaFromApi(content.settings.api));
  const [message, setMessage] = useState("");
  async function generate() {
    setMessage("Yapay zekâ çıktısı hazırlanıyor...");
    setOutput("");
    const response = await fetch("/api/admin/ai-generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data.error || "Analiz sırasında bir hata oluştu.");
    setOutput(data.output || "");
    setMeta(data.ai || aiMetaFromApi(content.settings.api));
    setMessage("");
  }
  return <Panel title="Yapay Zeka Asistanı"><div className="grid gap-4"><div className="rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3"><p className="text-sm font-black text-cyan-50">Geçerli global AI ayarı</p><AiUsageBadge meta={aiMetaFromApi(content.settings.api)} /></div><TextArea label="Komut" value={prompt} onChange={setPrompt} /><button onClick={generate} className="inline-flex w-fit items-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950"><Sparkles size={17} /> AI çıktı üret</button>{message && <p className="rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-100">{message}</p>}{output && <div className="rounded-[8px] border border-white/10 bg-black/30 p-4"><AiUsageBadge meta={meta} /><pre className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-200">{output}</pre><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => navigator.clipboard.writeText(output)} className="inline-flex gap-2 rounded-full border border-white/10 px-4 py-2 text-sm"><Copy size={16} /> Kopyala</button><button onClick={() => setContent({ ...content, pages: { ...content.pages, home: { ...content.pages.home, subheadline: output } } })} className="rounded-full border border-white/10 px-4 py-2 text-sm">Ana sayfa alt metnine ekle</button></div></div>}</div></Panel>;
}

function ApiSettings({ content, setContent }: any) {
  const [result, setResult] = useState("");
  const api = content.settings.api;
  const update = (patch) => setContent({ ...content, settings: { ...content.settings, api: { ...api, ...patch } } });
  const aiMeta = aiMetaFromApi(api);
  const priority = Array.isArray(api.ai_provider_priority) && api.ai_provider_priority.length ? api.ai_provider_priority : aiPriorityKeys;
  const updateProvider = (value: string) => {
    const key = aiLabelKeys[value] || value;
    const model = key === "gemini" ? "gemini-2.0-flash" : key === "demo" ? "demo-local" : key === "local" ? "local-rules" : api.active_ai_model || api.model || "automatic-fallback";
    update({
      active_ai_provider: key,
      activeProvider: key,
      active_ai_model: model,
      model,
      demoMode: key === "demo",
      ai_mode: key === "local" ? "local" : key === "demo" ? "demo" : "live"
    });
  };
  const updatePriority = (index: number, value: string) => {
    const next = [...priority];
    next[index] = aiLabelKeys[value] || value;
    update({ ai_provider_priority: [...new Set([...next, ...aiPriorityKeys])] });
  };
  async function saveAiSettings() {
    setResult("AI sağlayıcı ayarları kaydediliyor...");
    const response = await fetch("/api/admin/ai-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(api) });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.api) setContent({ ...content, settings: { ...content.settings, api: { ...api, ...data.api } } });
    setResult(response.ok ? data.message : data.error || "AI sağlayıcı ayarları kaydedilemedi.");
  }
  async function testApi() {
    const response = await fetch("/api/ai/test", { method: "POST" });
    const data = await response.json();
    setResult(data.message || "Test tamamlandı.");
  }
  return <Panel title="API Ayarları"><p className="mb-5 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm leading-6 text-cyan-50">API anahtarları güvenlik nedeniyle bu ekranda gösterilmez veya tarayıcıya gönderilmez. Gemini, Groq, OpenAI ve Google Maps anahtarlarını Vercel ortam değişkenleri üzerinden yönetin.</p><div className="mb-5 rounded-[8px] border border-amber-200/20 bg-amber-200/10 p-4"><p className="text-sm font-black text-amber-100">AI Ayarları</p><p className="mt-1 text-xs text-amber-100/75">Varsayılan canlı sağlayıcı Gemini’dir. Belirli sağlayıcı seçilirse sessiz fallback yapılmaz.</p><AiUsageBadge meta={aiMeta} /></div><div className="grid gap-4 md:grid-cols-2"><SelectField label="Aktif AI Sağlayıcısı" value={aiProviderLabel(api.active_ai_provider || api.activeProvider || "Gemini")} onChange={updateProvider} options={apiProviderOptions} /><Field label="Yapay zekâ modeli" value={api.active_ai_model || api.model || "gemini-2.0-flash"} onChange={(v) => update({ active_ai_model: v, model: v })} /><SelectField label="AI modu" value={api.ai_mode || (api.demoMode ? "demo" : "live")} onChange={(v) => update({ ai_mode: v, demoMode: v === "demo", active_ai_provider: v === "demo" ? "demo" : v === "local" ? "local" : api.active_ai_provider || "gemini", activeProvider: v === "demo" ? "demo" : v === "local" ? "local" : api.activeProvider || "gemini" })} options={[{ value: "live", label: "Canlı" }, { value: "demo", label: "Demo" }, { value: "local", label: "Yerel" }]} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(api.demoMode)} onChange={(e) => update({ demoMode: e.target.checked, active_ai_provider: e.target.checked ? "demo" : "gemini", activeProvider: e.target.checked ? "demo" : "gemini", ai_mode: e.target.checked ? "demo" : "live", active_ai_model: e.target.checked ? "demo-local" : "gemini-2.0-flash", model: e.target.checked ? "demo-local" : "gemini-2.0-flash" })} /> Demo modu</label></div><div className="mt-5 rounded-[8px] border border-white/10 bg-white/[0.035] p-4"><p className="text-sm font-black text-white">AI Öncelik Sırası</p><p className="mt-1 text-xs text-slate-400">Bu sıra yalnızca “Otomatik” seçildiğinde kullanılır.</p><div className="mt-4 grid gap-3 md:grid-cols-5">{aiPriorityKeys.map((key, index) => <SelectField key={`${key}-${index}`} label={`${index + 1}. Öncelik`} value={aiKeyLabels[priority[index] || key] || "Gemini"} onChange={(value) => updatePriority(index, value)} options={aiPriorityOptions} />)}</div></div><div className="mt-5 flex flex-wrap gap-2"><button onClick={saveAiSettings} className="rounded-full bg-amber-300 px-5 py-3 text-sm font-black text-slate-950">AI ayarlarını kaydet</button><button onClick={testApi} className="rounded-full border border-cyan-200/20 px-5 py-3 text-sm font-black text-cyan-100">API bağlantısını test et</button></div>{result && <p className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-100">{result}</p>}<p className="mt-4 text-sm text-slate-400">Sunucu tarafı değişkenleri: GOOGLE_MAPS_API_KEY, GEMINI_API_KEY, GROQ_API_KEY ve OPENAI_API_KEY. Kullanılmayan AI sağlayıcılarının anahtarlarını eklemek zorunda değilsiniz.</p></Panel>;
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
  const [detailCompanyId, setDetailCompanyId] = useState("");
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
    if (customerRole(form.role) && !form.company_id) {
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

  return (
    <Panel title="Müşteriler">
      {message && <p className="mb-4 rounded-[8px] border border-emerald-300/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">{message}</p>}
      {error && <p className="mb-4 rounded-[8px] border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}
      <div className="mb-6 rounded-[8px] border border-white/10 p-4">
        <h3 className="font-black">Hızlı firma oluştur</h3>
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
            const hasLogin = (content.users || []).some((user) => customerRole(user.role) && user.company_id === company.id);
            const editing = editingCompanyId === company.id;
            return (
              <div key={company.id} className="rounded-[8px] border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <h4 className="font-black">{company.name}</h4>
                    <p className="text-sm text-slate-400">{company.sector || "-"} · {company.city || "-"} · Müşteri girişi: {hasLogin ? "Var" : "Yok"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setDetailCompanyId(company.id)} className="rounded-full bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950">Müşteri detayını aç</button>
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
      {detailCompanyId && (
        <CustomerDetailDrawer
          company={(content.companies || []).find((company) => company.id === detailCompanyId)}
          content={content}
          setContent={setContent}
          updateCompany={updateCompany}
          saveCompany={saveCompany}
          close={() => setDetailCompanyId("")}
        />
      )}
    </Panel>
  );
}

function CustomerDetailDrawer({ company, content, setContent, updateCompany, saveCompany, close }: any) {
  const [tab, setTab] = useState("Genel Bilgi");
  if (!company) return null;
  const users = (content.users || []).filter((user) => customerRole(user.role) && user.company_id === company.id);
  const campaigns = (content.campaigns || []).filter((item) => item.company_id === company.id);
  const metrics = (content.campaignMetrics || []).filter((item) => item.company_id === company.id);
  const updates = (content.customerUpdates || []).filter((item) => item.company_id === company.id);
  const files = (content.customerFiles || []).filter((item) => item.company_id === company.id);
  const reports = (content.reports || []).filter((item) => item.company_id === company.id);
  const activities = (content.activityLogs || []).filter((item) => item.company_id === company.id);
  const visibilityItems = content.customerVisibilitySettings || [];
  const visibility = visibilityItems.find((item) => item.company_id === company.id) || {
    id: `visibility-${company.id}`,
    company_id: company.id,
    show_campaigns: true,
    show_metrics: true,
    show_budget: true,
    show_spent: true,
    show_leads: true,
    show_strategy_notes: true,
    show_work_updates: true,
    show_files: true,
    show_contact_person: true
  };
  const tabs = ["Genel Bilgi", "Giriş Bilgileri", "Kampanyalar", "Metrikler", "Raporlar", "Yapılan Çalışmalar", "Dosyalar", "Panel Görünürlüğü", "Aktivite Geçmişi", "Notlar"];
  function updateVisibility(patch) {
    const next = { ...visibility, ...patch };
    const exists = visibilityItems.some((item) => item.company_id === company.id);
    setContent({ ...content, customerVisibilitySettings: exists ? visibilityItems.map((item) => item.company_id === company.id ? next : item) : [...visibilityItems, next] });
  }
  function updateRelated(key, id, patch) {
    setContent({ ...content, [key]: (content[key] || []).map((item) => item.id === id ? { ...item, ...patch } : item) });
  }
  async function resetPassword(user) {
    const response = await fetch("/api/admin/users/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: user.email }) });
    const data = await response.json().catch(() => ({}));
    alert(response.ok ? data.message || "Şifre sıfırlama bağlantısı gönderildi." : data.error || "Şifre sıfırlama bağlantısı gönderilemedi.");
  }
  return (
    <Drawer title={`${company.name} · Müşteri Detayı`} close={close}>
      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-full px-3 py-2 text-xs font-bold ${tab === item ? "bg-cyan-300 text-slate-950" : "border border-white/10 text-slate-300"}`}>{item}</button>)}
        <a href={`/musteri-paneli?company=${company.id}`} target="_blank" rel="noreferrer" className="ml-auto rounded-full border border-cyan-200/30 px-3 py-2 text-xs font-black text-cyan-100">Müşteri gibi görüntüle</a>
      </div>
      {tab === "Genel Bilgi" && <div className="grid gap-3 md:grid-cols-2">
        <Field label="Firma adı" value={company.name} onChange={(v) => updateCompany(company.id, { name: v })} />
        <OtherSelectField label="Sektör" value={company.sector} onChange={(v) => updateCompany(company.id, { sector: v })} options={sectorOptions} manualLabel="Sektörü yazın" />
        <OtherSelectField label="Şehir" value={company.city} onChange={(v) => updateCompany(company.id, { city: v })} options={cityOptions} manualLabel="Şehri yazın" />
        <Field label="Web sitesi" value={company.website} onChange={(v) => updateCompany(company.id, { website: v })} />
        <Field label="Instagram" value={company.instagram} onChange={(v) => updateCompany(company.id, { instagram: v })} />
        <Field label="Telefon" value={company.phone} onChange={(v) => updateCompany(company.id, { phone: v })} />
        <Field label="E-posta" value={company.email} onChange={(v) => updateCompany(company.id, { email: v })} />
        <SelectField label="Durum" value={company.status} onChange={(v) => updateCompany(company.id, { status: v })} options={companyStatusOptions} />
        <div className="md:col-span-2"><TextArea label="Dahili notlar" value={company.notes} onChange={(v) => updateCompany(company.id, { notes: v })} /></div>
        <button onClick={() => saveCompany(company)} className="w-fit rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950">Firma bilgilerini kaydet</button>
      </div>}
      {tab === "Giriş Bilgileri" && <div>
        <p className="mb-4 rounded-[8px] border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">Müşteri şifresi güvenlik nedeniyle düz metin olarak saklanmaz. Yeni geçici şifre oluşturabilirsiniz.</p>
        <div className="grid gap-3">{users.map((user) => <div key={user.id} className="rounded-[8px] border border-white/10 p-4"><p className="font-black">{user.full_name || user.email}</p><p className="mt-1 text-sm text-slate-400">{user.email} · Bağlı kullanıcı: Var · Durum: {user.is_active ? "Aktif" : "Pasif"} · Rol: Müşteri</p><p className="mt-2 text-xs leading-5 text-slate-500">Son giriş: {formatDateTime(user.last_login_at)} · Toplam giriş: {user.login_count || 0}</p><button onClick={() => resetPassword(user)} className="mt-3 rounded-full border border-white/10 px-4 py-2 text-sm">Şifre sıfırlama bağlantısı gönder</button></div>)}{!users.length && <p className="text-sm text-slate-400">Bağlı müşteri kullanıcısı yok. Müşteriler ekranındaki giriş hesabı oluşturma formunu kullanın.</p>}</div>
      </div>}
      {tab === "Kampanyalar" && <CustomerRelatedList items={campaigns} empty="Bu müşteri için kampanya yok." render={(item) => `${item.name} · ${item.platform} · ${item.status}`} onVisibilityChange={(item, value) => updateRelated("campaigns", item.id, { visible_to_customer: value })} />}
      {tab === "Metrikler" && <CustomerRelatedList items={metrics} empty="Bu müşteri için metrik yok." render={(item) => `${formatDate(item.date)} · ${item.impressions || 0} gösterim · ${item.clicks || 0} tıklama · ${item.leads || 0} potansiyel müşteri · ${item.spent || 0} TL`} onVisibilityChange={(item, value) => updateRelated("campaignMetrics", item.id, { visible_to_customer: value })} />}
      {tab === "Raporlar" && <CustomerRelatedList items={reports} empty="Bu müşteri için kanal bazlı rapor yok." render={(item) => `${item.report_type} · ${item.period || "Dönem belirtilmedi"} · ${item.visible_to_customer ? "Müşteriye görünür" : "Dahili"}`} />}
      {tab === "Yapılan Çalışmalar" && <CustomerRelatedList items={updates} empty="Bu müşteri için çalışma notu yok." render={(item) => `${item.title} · ${item.update_type}`} onVisibilityChange={(item, value) => updateRelated("customerUpdates", item.id, { visible_to_customer: value })} />}
      {tab === "Dosyalar" && <CustomerRelatedList items={files} empty="Bu müşteri için dosya yok." render={(item) => `${item.title} · ${item.file_type || "Dosya"}`} onVisibilityChange={(item, value) => updateRelated("customerFiles", item.id, { visible_to_customer: value })} />}
      {tab === "Panel Görünürlüğü" && <div><p className="mb-4 text-sm leading-6 text-slate-400">Müşteri panelinde görünmesini istediğiniz alanları seçin. Değişiklikleri üst menüdeki Kaydet düğmesi ile kalıcı hale getirin.</p><p className="mb-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-100">Müşteri panelindeki metrikler, teknik terimler yerine sade Türkçe açıklamalarla gösterilir.</p><div className="grid gap-3 md:grid-cols-2">{[
        ["show_campaigns", "Kampanyalar"],
        ["show_metrics", "Reklam metrikleri"],
        ["show_budget", "Kampanya bütçesi"],
        ["show_spent", "Harcanan bütçe"],
        ["show_leads", "Potansiyel müşteri sayısı"],
        ["show_work_updates", "Yapılan çalışmalar"],
        ["show_strategy_notes", "Strateji notları"],
        ["show_files", "Dosyalar"],
        ["show_contact_person", "İletişim bilgileri"]
      ].map(([key, label]) => <label key={key} className="flex items-center gap-3 rounded-[8px] border border-white/10 p-3 text-sm"><input type="checkbox" checked={visibility[key] ?? true} onChange={(event) => updateVisibility({ [key]: event.target.checked })} /> {label}</label>)}</div></div>}
      {tab === "Aktivite Geçmişi" && <ActivityList items={activities} empty="Bu müşteri için henüz aktivite kaydı yok." />}
      {tab === "Notlar" && <TextArea label="Dahili müşteri notları" value={company.notes} onChange={(v) => updateCompany(company.id, { notes: v })} rows={10} />}
    </Drawer>
  );
}

function CustomerRelatedList({ items, empty, render, onVisibilityChange }: any) {
  return <div className="grid gap-3">{items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-white/10 bg-black/20 p-4 text-sm text-slate-200"><span>{render(item)}</span>{onVisibilityChange && <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={item.visible_to_customer ?? true} onChange={(event) => onVisibilityChange(item, event.target.checked)} /> Müşteriye göster</label>}</div>)}{!items.length && <p className="text-sm text-slate-400">{empty}</p>}</div>;
}

function ActivityLogs({ content }: any) {
  const [query, setQuery] = useState("");
  const [userType, setUserType] = useState("");
  const [role, setRole] = useState("");
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const activities = (content.activityLogs || [])
    .filter((item) => !query || JSON.stringify(item).toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")))
    .filter((item) => !userType || item.role === userType)
    .filter((item) => !role || item.role === role)
    .filter((item) => !action || item.action === action)
    .filter((item) => !dateFrom || String(item.created_at || "").slice(0, 10) >= dateFrom)
    .filter((item) => !dateTo || String(item.created_at || "").slice(0, 10) <= dateTo);
  return (
    <Panel title="Log Hareketleri">
      <p className="mb-5 text-sm leading-6 text-slate-400">Yönetici ve müşteri işlemlerini tarih, kullanıcı, rol ve işlem türüne göre inceleyin.</p>
      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Kullanıcı veya işlem ara..." className="min-h-11 rounded-[8px] border border-white/10 bg-black/30 px-3 text-white" />
        <SelectField label="Kullanıcı türü" value={userType} onChange={setUserType} options={roleOptions} placeholder="Tüm kullanıcılar" />
        <SelectField label="Rol" value={role} onChange={setRole} options={roleOptions} placeholder="Tüm roller" />
        <SelectField label="İşlem" value={action} onChange={setAction} options={["Giriş", "Oluşturma", "Güncelleme", "Silme", "İçe Aktarma", "Dışa Aktarma", "Şifre Sıfırlama", "Görüntüleme", "İndirme", "Dönüştürme"]} placeholder="Tüm işlemler" />
        <Field label="Başlangıç tarihi" type="date" value={dateFrom} onChange={setDateFrom} />
        <Field label="Bitiş tarihi" type="date" value={dateTo} onChange={setDateTo} />
      </div>
      <ActivityList items={activities} empty="Seçilen filtrelere uygun hareket kaydı yok." />
    </Panel>
  );
}

function ActivityList({ items, empty }: any) {
  return <div className="grid gap-3">{items.map((item) => <div key={item.id} className="rounded-[8px] border border-white/10 bg-black/20 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black text-white">{item.details?.message || `${item.entity} · ${item.action}`}</p><p className="mt-1 text-sm text-slate-400">{item.actor_name || "Sistem"} · {roleOptions.find((role) => role.value === item.role)?.label || item.role || "Sistem"} · {item.entity}</p></div><span className="rounded-full bg-cyan-200/10 px-3 py-1 text-xs font-bold text-cyan-100">{item.action}</span></div><p className="mt-3 text-xs text-slate-500">{formatDateTime(item.created_at)}</p></div>)}{!items.length && <p className="text-sm text-slate-400">{empty}</p>}</div>;
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

function MetricAdmin({ content, setContent, importOnly = false }: any) {
  const metrics = content.campaignMetrics || [];
  const [importMessage, setImportMessage] = useState("");
  const [importError, setImportError] = useState("");
  const [importForm, setImportForm] = useState({ company_id: "", campaign_id: "" });
  const [preview, setPreview] = useState([]);
  const update = (index, patch) => setContent({ ...content, campaignMetrics: metrics.map((item, i) => i === index ? { ...item, ...patch } : item) });
  const fieldsFor = (metric) => {
    const campaign = (content.campaigns || []).find((item) => item.id === metric.campaign_id);
    return campaign?.platform === "Google" ? googleMetricFields : metaMetricFields;
  };
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
        {preview.length > 0 && <div className="mt-4 overflow-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="text-slate-400"><tr>{["Tarih", "Gösterim", "Erişim", "Tıklama", "Potansiyel Müşteri", "Harcama"].map((head) => <th key={head} className="p-2">{head}</th>)}</tr></thead><tbody>{preview.map((row, index) => <tr key={index} className="border-t border-white/10"><td className="p-2">{row.date}</td><td className="p-2">{row.impressions}</td><td className="p-2">{row.reach}</td><td className="p-2">{row.clicks}</td><td className="p-2">{row.leads}</td><td className="p-2">{row.spent}</td></tr>)}</tbody></table></div>}
      </div>
      {importOnly ? null : <div className="mb-4 rounded-[8px] border border-white/10 p-4 text-sm leading-7 text-slate-300">
        <p className="font-black text-white">Müşteri panelinde kullanılan sade anlatım</p>
        <p>Reklamınız kaç kez gösterildi · Reklamınız kaç kişiye ulaştı · Reklamınıza kaç kişi tıkladı · Kaç kişi mesaj attı · Kaç potansiyel müşteri geldi · Ne kadar reklam bütçesi harcandı</p>
        <p className="mt-3 text-slate-400">Meta raporlarında Bağlantı Tıklaması ayrı bir sütun olarak gelirse, içe aktarma sırasında toplam tıklama alanına aktarılır.</p>
      </div>}
      {importOnly ? null : <>
      <button onClick={() => setContent({ ...content, campaignMetrics: [...metrics, { id: `${Date.now()}`, date: new Date().toISOString().slice(0, 10), period: "Günlük", source: "Manuel Giriş", impressions: 0, reach: 0, clicks: 0, messages: 0, leads: 0, spent: 0, visible_to_customer: true }] })} className="mb-4 inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950"><Plus size={16} /> Metrik ekle</button>
      <div className="grid gap-4">
        {metrics.map((metric, index) => (
          <div key={metric.id || index} className="grid gap-3 rounded-[8px] border border-white/10 p-4 md:grid-cols-3">
            <CompanySelect value={metric.company_id || ""} onChange={(v) => update(index, { company_id: v })} companies={content.companies} />
            <SelectField label="Kampanya" value={metric.campaign_id || ""} onChange={(v) => update(index, { campaign_id: v })} options={(content.campaigns || []).map((campaign) => ({ value: campaign.id, label: campaign.name }))} placeholder="Kampanya seçin" />
            <SelectField label="Periyot" value={metric.period || "Günlük"} onChange={(v) => update(index, { period: v })} options={metricPeriodOptions} />
            <OtherSelectField label="Kaynak" value={metric.source || "Manuel Giriş"} onChange={(v) => update(index, { source: v })} options={metricSourceOptions} manualLabel="Kaynağı yazın" />
            {fieldsFor(metric).map(([field, label, help]) => <div key={field}><Field label={label} type={field === "date" ? "date" : "number"} value={metric[field]} onChange={(v) => update(index, { [field]: v })} /><p className="mt-1 text-xs leading-5 text-slate-500">{help}</p></div>)}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={metric.visible_to_customer ?? true} onChange={(e) => update(index, { visible_to_customer: e.target.checked })} /> Müşteri panelinde görünsün</label>
            <TextArea label="Notlar" value={metric.notes} onChange={(v) => update(index, { notes: v })} />
            <button onClick={() => setContent({ ...content, campaignMetrics: metrics.filter((_, i) => i !== index) })} className="w-fit rounded-full border border-red-300/30 px-3 py-2 text-xs text-red-200">Sil</button>
          </div>
        ))}
      </div>
      </>}
    </Panel>
  );
}

const reportMetricFields = {
  "Meta Reklam Raporu": [
    ["impressions", "Gösterim"], ["reach", "Erişim"], ["clicks", "Tıklama"], ["messages", "Mesaj başlatma"], ["leads", "Potansiyel müşteri"], ["spent", "Harcanan tutar"], ["ctr", "Tıklanma oranı"], ["cpc", "Tıklama başı maliyet"], ["cpm", "Bin gösterim maliyeti"], ["cost_per_result", "Sonuç başına maliyet"]
  ],
  "Google Ads Raporu": [
    ["impressions", "Gösterim"], ["clicks", "Tıklama"], ["ctr", "Tıklanma oranı / TO"], ["average_cpc", "Ortalama TBM"], ["cost", "Maliyet"], ["conversions", "Dönüşüm"], ["conversion_rate", "Dönüşüm oranı"], ["cost_per_conversion", "Dönüşüm maliyeti"], ["search_terms_note", "Arama terimleri notu", "textarea"], ["keyword_note", "Anahtar kelime notu", "textarea"]
  ],
  "Sosyal Medya Yönetimi Raporu": [
    ["posts", "Paylaşım sayısı"], ["reels", "Reels sayısı"], ["stories", "Hikaye sayısı"], ["reach", "Erişim"], ["impressions", "Gösterim"], ["profile_visits", "Profil ziyareti"], ["followers_growth", "Takipçi artışı"], ["engagement", "Etkileşim"], ["likes", "Beğeni"], ["comments", "Yorum"], ["saves", "Kaydetme"], ["shares", "Paylaşım"], ["messages", "Gelen mesaj"], ["content_note", "İçerik notu", "textarea"], ["best_content", "En iyi performans gösteren içerik", "textarea"]
  ],
  "Genel Dijital Performans Raporu": [
    ["impressions", "Toplam gösterim"], ["reach", "Toplam erişim"], ["clicks", "Toplam tıklama"], ["leads", "Potansiyel müşteri"], ["spent", "Toplam harcama"], ["summary", "Performans özeti", "textarea"]
  ]
};

function ReportingCenter({ content, setContent }: any) {
  const [tab, setTab] = useState("Meta Reklamları");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState("");
  const reports = content.reports || [];
  const typeForTab = { "Meta Reklamları": "Meta Reklam Raporu", "Google Ads": "Google Ads Raporu", "Sosyal Medya Yönetimi": "Sosyal Medya Yönetimi Raporu", "Genel Raporlar": "Genel Dijital Performans Raporu" }[tab];
  const visibleReports = reports.filter((report) => report.report_type === typeForTab);
  function update(id, patch) {
    setContent({ ...content, reports: reports.map((report) => report.id === id ? { ...report, ...patch } : report) });
  }
  function updateMetric(report, key, value) {
    update(report.id, { metrics: { ...(report.metrics || {}), [key]: value } });
  }
  function add() {
    const id = `report-${Date.now()}`;
    setContent({ ...content, reports: [{ id, report_type: typeForTab, period: "Aylık", metrics: {}, visible_to_customer: true, archived: false }, ...reports] });
  }
  async function save(report) {
    setLoading(report.id);
    setMessage("Rapor kaydediliyor...");
    const isNew = String(report.id).startsWith("report-");
    const response = await fetch("/api/admin/reports", { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(report) });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setContent({ ...content, reports: reports.map((item) => item.id === report.id ? data.report : item) });
      setMessage(data.message || "Rapor başarıyla kaydedildi.");
    } else setMessage(`Kaydedilemedi: ${data.supabaseError || data.error || "Beklenmeyen hata"}`);
    setLoading("");
  }
  async function remove(report) {
    if (String(report.id).startsWith("report-")) return setContent({ ...content, reports: reports.filter((item) => item.id !== report.id) });
    if (!confirm("Bu raporu silmek istediğinize emin misiniz?")) return;
    setLoading(report.id);
    const response = await fetch("/api/admin/reports", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: report.id }) });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setContent({ ...content, reports: reports.filter((item) => item.id !== report.id) });
      setMessage("Rapor silindi.");
    } else setMessage(`Silinemedi: ${data.supabaseError || data.error || "Beklenmeyen hata"}`);
    setLoading("");
  }
  return <Panel title="Raporlama Merkezi">
    <p className="mb-5 text-sm leading-6 text-slate-400">Meta, Google Ads, sosyal medya yönetimi ve genel performans raporlarını müşteri bazında hazırlayın.</p>
    <div className="mb-5 flex flex-wrap gap-2">{reportTabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-full px-4 py-2 text-sm font-bold ${tab === item ? "bg-cyan-300 text-slate-950" : "border border-white/10 text-slate-300"}`}>{item}</button>)}</div>
    <button onClick={add} className="mb-4 inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950"><Plus size={16} /> Yeni rapor ekle</button>
    {message && <p className={`mb-4 rounded-[8px] border p-3 text-sm ${message.includes("Kaydedilemedi") || message.includes("Silinemedi") ? "border-red-300/30 bg-red-500/10 text-red-100" : "border-cyan-200/20 bg-cyan-200/10 text-cyan-100"}`}>{message}</p>}
    <div className="grid gap-4">{visibleReports.map((report) => <div key={report.id} className="grid gap-4 rounded-[8px] border border-white/10 bg-black/20 p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <CompanySelect value={report.company_id || ""} onChange={(value) => update(report.id, { company_id: value, campaign_id: "" })} companies={content.companies} />
        <SelectField label="Kampanya" value={report.campaign_id || ""} onChange={(value) => update(report.id, { campaign_id: value })} options={(content.campaigns || []).filter((campaign) => !report.company_id || campaign.company_id === report.company_id).map((campaign) => ({ value: campaign.id, label: campaign.name }))} placeholder="Kampanya seçimi isteğe bağlı" />
        <Field label="Rapor dönemi" value={report.period} onChange={(value) => update(report.id, { period: value })} />
        <Field label="Başlangıç tarihi" type="date" value={report.start_date} onChange={(value) => update(report.id, { start_date: value })} />
        <Field label="Bitiş tarihi" type="date" value={report.end_date} onChange={(value) => update(report.id, { end_date: value })} />
        {report.report_type === "Sosyal Medya Yönetimi Raporu" && <OtherSelectField label="Platform" value={report.platform} onChange={(value) => update(report.id, { platform: value })} options={socialPlatforms} manualLabel="Platformu yazın" />}
      </div>
      <div className="grid gap-3 md:grid-cols-3">{reportMetricFields[report.report_type].map(([key, label, kind]) => kind === "textarea" ? <TextArea key={key} label={label} value={report.metrics?.[key]} onChange={(value) => updateMetric(report, key, value)} /> : <Field key={key} label={label} type="number" value={report.metrics?.[key]} onChange={(value) => updateMetric(report, key, value)} />)}</div>
      <div className="grid gap-3 md:grid-cols-2"><TextArea label="Dahili not" value={report.internal_note} onChange={(value) => update(report.id, { internal_note: value })} /><TextArea label="Müşteriye gösterilecek genel yorum" value={report.customer_note} onChange={(value) => update(report.id, { customer_note: value })} /></div>
      <ReportTools report={report} onApplyExtracted={(patch) => update(report.id, patch)} />
      <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={report.visible_to_customer ?? true} onChange={(event) => update(report.id, { visible_to_customer: event.target.checked })} /> Müşteriye gösterilsin</label><button disabled={loading === report.id} onClick={() => save(report)} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-60">{loading === report.id ? "Kaydediliyor..." : "Raporu kaydet"}</button><button onClick={() => remove(report)} className="rounded-full border border-red-300/30 px-4 py-2 text-sm text-red-100">Sil</button>{report.company_id && <a href={`/musteri-paneli?company=${report.company_id}`} target="_blank" rel="noreferrer" className="rounded-full border border-white/10 px-4 py-2 text-sm">Müşteri gibi görüntüle</a>}</div>
      {(content.reportInterpretations || []).filter((item) => item.report_id === report.id).map((item) => <div key={item.id} className="rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm leading-6 text-cyan-50"><AiUsageBadge meta={aiMetaFromRecord(item, content.settings.api)} /><p className="mt-3">{item.interpretation_text}</p><p className="mt-2 text-xs text-cyan-100/70">{formatDateTime(item.created_at)}</p></div>)}
    </div>)}{!visibleReports.length && <p className="text-sm text-slate-400">Bu kategoride henüz rapor yok.</p>}</div>
  </Panel>;
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

function UsersAdmin({ content, setContent, currentSession, customerOnly = false, mode = "Kullanıcı Yönetimi" }: any) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [createForm, setCreateForm] = useState({ fullName: "", email: "", password: "", role: "editor", company_id: "", is_active: true, allowed_modules: uiRoleTemplates.editor });
  const users = (content.users || [])
    .filter((user) => !customerOnly || customerRole(user.role))
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
    if (!confirm(`${user.full_name || user.email} kullanıcısının şifresi geçici olarak ABC12345 yapılsın mı?`)) return;
    const response = await fetch(`/api/admin/users/${user.id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
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
      setCreateForm({ fullName: "", email: "", password: "", role: "editor", company_id: "", is_active: true, allowed_modules: uiRoleTemplates.editor });
      setMessage("Kullanıcı oluşturuldu.");
    } else {
      setMessage("");
      setError(data.supabaseError ? `${data.error}: ${data.supabaseError}` : data.error || "Kullanıcı oluşturulamadı.");
    }
  }
  return (
    <Panel title={customerOnly ? "Müşteri Giriş Bilgileri" : mode}>
      <div className="mb-6 rounded-[8px] border border-white/10 p-4">
        <h3 className="font-black">Yeni kullanıcı oluştur</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="Ad Soyad" value={createForm.fullName} onChange={(v) => setCreateForm({ ...createForm, fullName: v })} />
          <Field label="E-posta" value={createForm.email} onChange={(v) => setCreateForm({ ...createForm, email: v })} />
          <Field label="Geçici Şifre" type="password" value={createForm.password} onChange={(v) => setCreateForm({ ...createForm, password: v })} />
          <SelectField label="Rol" value={legacyRole(createForm.role)} onChange={(v) => setCreateForm({ ...createForm, role: v, allowed_modules: uiRoleTemplates[v] || [] })} options={roleOptions} />
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
                <p className="text-sm text-slate-400">{user.email} · {roleOptions.find((role) => role.value === legacyRole(user.role))?.label || user.role} · {user.is_active ? "Aktif" : "Pasif"}</p>
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
              <SelectField label="Rol" value={legacyRole(editingUser.role || "musteri")} onChange={(v) => {
                if (!confirm("Kullanıcı rolünü değiştirmek istediğinizden emin misiniz?")) return;
                setEditingUser({ ...editingUser, role: v, allowed_modules: uiRoleTemplates[v] || [] });
              }} options={roleOptions} />
              <CompanySelect value={editingUser.company_id || ""} onChange={(v) => setEditingUser({ ...editingUser, company_id: v })} companies={content.companies} />
              <SelectField label="Durum" value={editingUser.is_active ? "Aktif" : "Pasif"} onChange={(v) => {
                if (v === "Pasif" && !confirm("Kullanıcıyı pasifleştirmek istediğinizden emin misiniz?")) return;
                setEditingUser({ ...editingUser, is_active: v === "Aktif" });
              }} options={statusOptions} />
              <p className="self-end text-sm text-slate-400">Auth durumu: {editingUser.auth_user_id ? "Bağlı" : "Eksik"}</p>
            </div>
            <PermissionEditor user={editingUser} setUser={setEditingUser} />
            <button onClick={() => saveUser(editingUser)} className="mt-5 rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">Değişiklikleri kaydet</button>
          </div>
        </div>
      )}
      <p className="mt-4 text-sm text-slate-400">Roller: Yönetici tam yetkilidir. Operasyon yöneticisi müşteri ve CRM sürecini yönetir. Editör üretim araçlarını kullanır. Müşteri yalnızca kendi panelini görür.</p>
    </Panel>
  );
}

function PermissionEditor({ user, setUser }: any) {
  const selected = Array.isArray(user.allowed_modules) ? user.allowed_modules : uiRoleTemplates[legacyRole(user.role)] || [];
  function toggle(module) {
    setUser({ ...user, allowed_modules: selected.includes(module) ? selected.filter((item) => item !== module) : [...selected, module] });
  }
  return <div className="mt-5 rounded-[8px] border border-white/10 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-black">Modül yetkileri</h4><p className="mt-1 text-xs text-slate-400">Rol şablonunu kullanın veya izinleri tek tek özelleştirin.</p></div><div className="flex flex-wrap gap-2">{Object.entries(uiRoleTemplates).map(([role, modules]) => <button key={role} onClick={() => setUser({ ...user, role, allowed_modules: modules })} className="rounded-full border border-white/10 px-3 py-2 text-xs font-bold">{role === "admin" ? "Admin Yetkileri" : role === "yonetici" ? "Yönetici Yetkileri" : role === "editor" ? "Editör Yetkileri" : "Müşteri Yetkileri"}</button>)}</div></div><div className="mt-4 grid gap-4 md:grid-cols-2">{uiPermissionGroups.map(([group, modules]) => <div key={group} className="rounded-[8px] bg-black/20 p-3"><p className="text-xs font-black uppercase tracking-[.12em] text-cyan-100">{group}</p><div className="mt-3 grid gap-2">{modules.map((module) => <label key={module} className="flex gap-2 text-xs text-slate-300"><input type="checkbox" checked={selected.includes(module)} onChange={() => toggle(module)} />{module}</label>)}</div></div>)}</div></div>;
}

function HubTabs({ items, active, onChange }: any) {
  return <div className="mb-5 flex flex-wrap gap-2">{items.map((item) => <button key={item} type="button" onClick={() => onChange(item)} className={`rounded-full px-4 py-2 text-sm font-bold ${active === item ? "bg-cyan-300 text-slate-950" : "border border-white/10 text-slate-300 hover:bg-white/10"}`}>{item}</button>)}</div>;
}

function CrmHub(props: any) {
  const [tab, setTab] = useState("Form Başvuruları");
  return <div><HubTabs items={["Form Başvuruları", "Teklif Sihirbazı Kayıtları", "Takip Notları"]} active={tab} onChange={setTab} /><Crm {...props} view={tab} setActive={() => {}} /></div>;
}

function SiteSettingsHub(props: any) {
  const [tab, setTab] = useState("Sayfa İçerikleri");
  const items = ["Sayfa İçerikleri", "Marka Ayarları", "Sosyal Medya", "Hizmetler", "Paketler", "Sertifikalar", "Teklif Sihirbazı", "Tema ve Ölçümleme"];
  return <div>
    <HubTabs items={items} active={tab} onChange={setTab} />
    {tab === "Sayfa İçerikleri" && <Pages {...props} />}
    {tab === "Marka Ayarları" && <Brand {...props} />}
    {tab === "Sosyal Medya" && <KeyValue title="Sosyal Medya Yönetimi" object={props.content.socials} onChange={(object) => props.setContent({ ...props.content, socials: object })} />}
    {tab === "Hizmetler" && <Collection title="Hizmet Yönetimi" type="service" items={props.content.services} setItems={(items) => props.setContent({ ...props.content, services: items })} />}
    {tab === "Paketler" && <Collection title="Paket Yönetimi" type="package" items={props.content.packages} setItems={(items) => props.setContent({ ...props.content, packages: items })} />}
    {tab === "Sertifikalar" && <Collection title="Sertifika Yönetimi" type="certificate" items={props.content.certificates} setItems={(items) => props.setContent({ ...props.content, certificates: items })} />}
    {tab === "Teklif Sihirbazı" && <QuoteWizardAdmin {...props} />}
    {tab === "Tema ve Ölçümleme" && <Settings {...props} />}
  </div>;
}

function ReportsHub(props: any) {
  const [tab, setTab] = useState("Raporlama Merkezi");
  return <div>
    <HubTabs items={["Raporlama Merkezi", "Kampanyalar", "Reklam Metrikleri", "Meta Rapor İçe Aktar", "Rapor Notları"]} active={tab} onChange={setTab} />
    {tab === "Raporlama Merkezi" && <ReportingCenter {...props} />}
    {tab === "Kampanyalar" && <CampaignAdmin {...props} />}
    {["Reklam Metrikleri", "Meta Rapor İçe Aktar"].includes(tab) && <MetricAdmin {...props} importOnly={tab === "Meta Rapor İçe Aktar"} />}
    {tab === "Rapor Notları" && <UpdatesAdmin {...props} />}
  </div>;
}

function MediaLogoHub(props: any) {
  const [tab, setTab] = useState("Medya Merkezi");
  return <div><HubTabs items={["Medya Merkezi", "Logo ve Marka Dosyaları"]} active={tab} onChange={setTab} />{tab === "Medya Merkezi" ? <Media {...props} /> : <Brand {...props} />}</div>;
}

function UsersHub(props: any) {
  const [tab, setTab] = useState("Kullanıcı Yönetimi");
  return <div>
    <HubTabs items={["Kullanıcı Yönetimi", "Log Hareketleri", "Kullanım Kılavuzu"]} active={tab} onChange={setTab} />
    {tab === "Kullanıcı Yönetimi" && <UsersAdmin {...props} />}
    {tab === "Log Hareketleri" && <ActivityLogs content={props.content} />}
    {tab === "Kullanım Kılavuzu" && <UsageGuide />}
  </div>;
}

function CustomerFinder(props: any) {
  return <MapsIntelligence {...props} mode="İşletme Keşfi" />;
}

const mapSectorOptions = ["Yerel Hizmetler", "Perakende & E-Ticaret", "Yeme İçme", "Eğitim & Yaşam", "Profesyonel Hizmet", "Emlak & Otomotiv", "Güzellik & Sağlık", "Klinik", "Kuaför", "Kafe", "Restoran", "Pasta / Tatlı", "Spor Salonu", "Su Arıtma", "Kombi / Klima", "Diğer"];
const mapTabs = ["Fırsat Haritası", "Google Maps Müşteri Bulma", "Kaydedilenler", "Sıcak Leadler", "Bölgesel Fırsatlar", "Rakip Analizi"];
const districtOpportunitySeed = [
  ["Yunusemre", 92, "Yüksek", "Çok Güçlü", "Güzellik & Sağlık", "Güzellik, klinik ve yerel hizmet işletmelerini önceliklendirin."],
  ["Şehzadeler", 86, "Orta", "Çok Güçlü", "Yeme İçme", "Kafe, restoran ve perakende adaylarında keşif başlatın."],
  ["Turgutlu", 78, "Orta", "Güçlü", "Emlak & Otomotiv", "Yerel hizmet ve otomotiv işletmelerini CRM'e taşıyın."],
  ["Akhisar", 72, "Düşük", "Güçlü", "Profesyonel Hizmet", "Dijital görünürlüğü zayıf işletmeleri AI analize alın."],
  ["Salihli", 64, "Orta", "Gelişen", "Eğitim & Yaşam", "Eğitim ve yaşam kategorilerinde kontrollü arama yapın."],
  ["Saruhanlı", 54, "Düşük", "Gelişen", "Yerel Hizmetler", "Telefonu bulunan yerel hizmet işletmelerini listeleyin."],
  ["Soma", 46, "Düşük", "Gelişen", "Perakende & E-Ticaret", "Bölgesel aday havuzunu genişletmek için keşif başlatın."]
];
const sectorOpportunitySeed = mapSectorOptions.filter((sector) => sector !== "Diğer").map((sector, index) => ({
  name: sector,
  score: Math.max(42, 91 - index * 3),
  meta: index % 3 === 0 ? "Yüksek" : index % 3 === 1 ? "Orta" : "Düşük",
  google: index < 5 ? "Çok Güçlü" : index < 11 ? "Güçlü" : "Gelişen",
  subSector: sector.includes("Yeme") ? "Kafe · Restoran · Pasta / Tatlı" : sector.includes("Güzellik") ? "Klinik · Kuaför · Güzellik Merkezi" : sector.includes("Hizmet") ? "Su Arıtma · Kombi / Klima" : sector
}));
const opportunityLegend = [
  [85, "Çok Yüksek Fırsat", "Öncelikli aranacak bölge veya sektör.", "İlk teklif ve AI analizi buradan başlatılabilir."],
  [70, "Yüksek Fırsat", "Güçlü ticari sinyaller bulunuyor.", "İşletme keşfiyle aday havuzu oluşturun."],
  [55, "Orta Fırsat", "Doğru alt sektör seçimi önem taşıyor.", "Filtreleri daraltıp kontrollü arama yapın."],
  [1, "Gelişen Fırsat", "Daha fazla veri ve araştırma gerekiyor.", "Yerel adayları CRM listesine ekleyin."],
  [0, "Analiz Bekliyor", "Henüz yeterli veri bulunmuyor.", "İlk keşif aramasını başlatın."]
];

function opportunityLevel(score: any) {
  const value = Number(score || 0);
  if (value >= 85) return { label: "Çok Yüksek Fırsat", className: "border-orange-300/50 bg-orange-400/15 text-orange-100", pin: "bg-orange-400" };
  if (value >= 70) return { label: "Yüksek Fırsat", className: "border-emerald-300/40 bg-emerald-300/12 text-emerald-100", pin: "bg-emerald-400" };
  if (value >= 55) return { label: "Orta Fırsat", className: "border-amber-300/40 bg-amber-300/12 text-amber-100", pin: "bg-amber-300" };
  if (value > 0) return { label: "Gelişen Fırsat", className: "border-slate-400/40 bg-slate-400/10 text-slate-200", pin: "bg-slate-400" };
  return { label: "Analiz Bekliyor", className: "border-slate-500/30 bg-slate-500/10 text-slate-300", pin: "bg-slate-400" };
}

function districtOf(item: any) {
  if (item.district) return item.district;
  const parts = String(item.address || "").split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length > 2 ? parts[parts.length - 2] : "İlçe belirtilmedi";
}

function MapsIntelligence({ content, setContent, setActive, mode = "Haritalar", allowedModules = [] }: any) {
  const emptySearch = { keyword: "", city: "Manisa", district: "", sector: "", minimumRating: "", minimumReviewCount: "", website: "", phone: "", hideSaved: true };
  const [search, setSearch] = useState(emptySearch);
  const [results, setResults] = useState([]);
  const [tab, setTab] = useState(mode === "İşletme Keşfi" ? "Google Maps Müşteri Bulma" : "Fırsat Haritası");
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");
  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  const [notePlaceId, setNotePlaceId] = useState("");
  const [noteDrafts, setNoteDrafts] = useState({});
  const saved = (content.leads || []).filter((lead) => lead.google_place_id || lead.address);
  const canDiscover = allowedModules.includes("musteri-bulucu") || allowedModules.includes("haritalar") || allowedModules.includes("business_discovery") || allowedModules.includes("maps");
  const source = tab === "Google Maps Müşteri Bulma" ? results : saved;
  const visible = source
    .filter((item) => tab !== "Sıcak Leadler" || Number(item.lead_heat_score || item.leadHeatScore || 0) >= 70)
    .filter((item) => !search.district || districtOf(item).toLocaleLowerCase("tr").includes(search.district.toLocaleLowerCase("tr")))
    .filter((item) => !search.sector || (item.business_type || item.category) === search.sector);
  const combined = [...saved, ...results.filter((result) => !saved.some((lead) => lead.google_place_id === result.placeId))];
  const districts = Object.values(combined.reduce((groups: any, item: any) => {
    const district = districtOf(item);
    groups[district] ||= { name: district, items: [] };
    groups[district].items.push(item);
    return groups;
  }, {})).map((group: any) => {
    const values = group.items;
    const average = (key, fallback) => values.length ? Math.round(values.reduce((sum, item) => sum + Number(item[key] ?? item[fallback] ?? 0), 0) / values.length * 10) / 10 : 0;
    const sectors = [...new Set(values.map((item) => item.business_type || item.category).filter(Boolean))].slice(0, 3);
    return { ...group, hot: values.filter((item) => Number(item.lead_heat_score || item.leadHeatScore || 0) >= 70).length, rating: average("google_rating", "googleRating"), maturity: average("digital_maturity_score", "digitalMaturityScore"), sectors, opportunity: opportunityLevel(average("lead_heat_score", "leadHeatScore")) };
  });
  const sectors = mapSectorOptions.filter((sector) => sector !== "Diğer").map((sector) => {
    const items = combined.filter((item) => (item.business_type || item.category) === sector);
    const average = items.length ? items.reduce((sum, item) => sum + Number(item.lead_heat_score || item.leadHeatScore || 0), 0) / items.length : 0;
    return { sector, count: items.length, hot: items.filter((item) => Number(item.lead_heat_score || item.leadHeatScore || 0) >= 70).length, opportunity: opportunityLevel(average) };
  }).filter((item) => item.count);

  function patchLead(id, patch) {
    setContent({ ...content, leads: (content.leads || []).map((lead) => lead.id === id ? { ...lead, ...patch } : lead) });
    setMessage("Kayıt güncellendi. Kalıcı kayıt için üst çubuktaki Kaydet düğmesini kullanın.");
  }
  async function runSearch() {
    if (!canDiscover) return setMessage("İşletme keşfi araması için yetkiniz bulunmuyor.");
    setLoading("search");
    setMessage("Google Maps üzerinde işletmeler aranıyor...");
    const response = await fetch("/api/admin/business-discovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(search) });
    const data = await response.json().catch(() => ({}));
    setLoading("");
    if (!response.ok) return setMessage(data.error || "İşletme araması başarısız oldu.");
    setResults(data.businesses || []);
    setTab("Google Maps Müşteri Bulma");
    setMessage(data.count ? `${data.count} işletme bulundu.` : "Arama kriterlerine uygun işletme bulunamadı.");
  }
  async function saveBusiness(business) {
    setLoading(`save-${business.placeId}`);
    const response = await fetch("/api/admin/business-discovery", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businesses: [{ ...business, notes: noteDrafts[business.placeId] || business.notes }], sector: search.sector }) });
    const data = await response.json().catch(() => ({}));
    setLoading("");
    if (!response.ok) return setMessage(data.supabaseError ? `${data.error}: ${data.supabaseError}` : data.error || "İşletme kaydedilemedi.");
    setContent({ ...content, leads: [...(data.leads || []), ...(content.leads || [])] });
    setMessage(data.skipped ? "Bu işletme daha önce CRM listesine eklenmiş." : data.message);
    return data.leads?.[0] || saved.find((lead) => lead.google_place_id === business.placeId);
  }
  async function analyze(item) {
    const lead = item.id ? item : saved.find((savedLead) => savedLead.google_place_id === item.placeId) || await saveBusiness(item);
    if (!lead?.id) return;
    setLoading(`analyze-${lead.id}`);
    setMessage("AI analizi hazırlanıyor...");
    const response = await fetch(`/api/admin/leads/${lead.id}/analyze`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setLoading("");
    if (!response.ok) return setMessage(data.error || "AI analizi oluşturulamadı.");
    patchLead(lead.id, { ai_analysis: data.analysis });
    setMessage("AI analizi oluşturuldu.");
  }
  const clearFilters = () => setSearch(emptySearch);
  const activeFilters = Object.entries(search).filter(([key, value]) => key !== "hideSaved" && Boolean(value));
  const renderBusiness = (item) => {
    const placeId = item.placeId || item.google_place_id;
    const existingLead = item.id ? item : saved.find((lead) => lead.google_place_id === placeId);
    const record = existingLead || item;
    const heat = record.leadHeatScore ?? record.lead_heat_score ?? 0;
    const maturity = record.digitalMaturityScore ?? record.digital_maturity_score ?? 0;
    const level = opportunityLevel(heat);
    return <div key={placeId || record.id} className={`rounded-[8px] border p-3 transition ${selectedPlaceId === placeId ? "border-cyan-200/60 bg-cyan-200/10" : "border-white/10 bg-black/15"}`}><button onClick={() => setSelectedPlaceId(placeId)} className="w-full text-left"><div className="flex items-start justify-between gap-2"><strong className="text-sm text-white">{record.name || record.company || "İsimsiz işletme"}</strong><div className="flex flex-wrap justify-end gap-1">{existingLead && <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-[9px] font-black text-emerald-100">Zaten CRM'de</span>}<span className={`rounded-full border px-2 py-1 text-[9px] font-black ${level.className}`}>{level.label}</span></div></div><span className="mt-2 block text-xs leading-5 text-slate-400">{record.address || "Adres bilgisi yok"}</span><span className="mt-2 block text-[10px] leading-5 text-slate-500">{record.phone || "Telefon yok"} · {record.website ? "Web sitesi var" : "Web sitesi yok"} · Puan {record.googleRating ?? record.google_rating ?? "-"} · {record.reviewCount ?? record.google_review_count ?? 0} yorum</span><span className="mt-1 block text-[10px] text-slate-500">{record.category || record.business_type || "Kategori belirtilmedi"} · Place ID: {placeId || "-"}</span><span className="mt-2 block text-[10px] font-black text-cyan-100">Olgunluk {maturity}/100 · Sıcaklık {heat}/100</span></button><div className="mt-3 flex flex-wrap gap-1.5">{!existingLead && <button disabled={loading === `save-${placeId}`} onClick={() => saveBusiness(item)} className="rounded-full bg-cyan-300 px-2.5 py-1.5 text-[10px] font-black text-slate-950">CRM'e Kaydet</button>}<button disabled={loading === `analyze-${existingLead?.id}`} onClick={() => analyze(record)} className="rounded-full border border-cyan-200/20 px-2.5 py-1.5 text-[10px] font-bold text-cyan-100">AI Analiz Yap</button>{existingLead && <button onClick={() => setActive("Lead Yönetimi")} className="rounded-full border border-white/10 px-2.5 py-1.5 text-[10px] font-bold">CRM Detayı</button>}<button onClick={() => setNotePlaceId(notePlaceId === placeId ? "" : placeId)} className="rounded-full border border-white/10 px-2.5 py-1.5 text-[10px] font-bold">Not Ekle</button><button onClick={() => setSelectedPlaceId(placeId)} className="rounded-full border border-white/10 px-2.5 py-1.5 text-[10px] font-bold">Haritada Aç</button>{record.website && <a target="_blank" rel="noreferrer" href={record.website} className="rounded-full border border-white/10 px-2.5 py-1.5 text-[10px] font-bold">Web Sitesi</a>}{placeId && <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/place/?q=place_id:${placeId}`} className="rounded-full border border-white/10 px-2.5 py-1.5 text-[10px] font-bold">Google Maps'te Aç</a>}</div>{notePlaceId === placeId && <div className="mt-3"><TextArea rows={2} label="Fırsat notu" value={existingLead?.local_opportunity_notes || noteDrafts[placeId] || ""} onChange={(local_opportunity_notes) => existingLead ? patchLead(existingLead.id, { local_opportunity_notes }) : setNoteDrafts({ ...noteDrafts, [placeId]: local_opportunity_notes })} /></div>}{existingLead && <div className="mt-3 grid gap-2"><SelectField label="Durum" value={existingLead.status || "Yeni"} onChange={(status) => patchLead(existingLead.id, { status })} options={leadStatuses} />{tab === "Rakip Analizi" && <TextArea rows={2} label="Rakip analizi notu" value={existingLead.competitor_notes || ""} onChange={(competitor_notes) => patchLead(existingLead.id, { competitor_notes })} />}</div>}</div>;
  };

  if (tab === "Fırsat Haritası") {
    return <Panel title="Fırsat Haritası"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="max-w-3xl text-sm leading-6 text-slate-400">Bölgesel potansiyeli ilçe ve sektör seviyesinde okuyun; seçiminizi Google Maps müşteri bulma akışına aktararak gerçek işletmeleri keşfedin.</p><span className="rounded-full border border-orange-300/30 bg-orange-300/10 px-3 py-2 text-xs font-black text-orange-100">Opportunity Map</span></div><HubTabs items={mapTabs} active={tab} onChange={setTab} /><OpportunityMap search={search} setSearch={setSearch} setTab={setTab} setActive={setActive} saved={saved} /></Panel>;
  }

  return <Panel title={mode === "Haritalar" ? "Harita Zekâsı" : "İşletme Keşfi"}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="max-w-3xl text-sm leading-6 text-slate-400">Google Maps işletme keşfini, bölgesel fırsat katmanlarını ve CRM adaylarını tek çalışma alanında yönetin.</p><div className="flex gap-2 text-xs"><span className="rounded-full border border-white/10 px-3 py-2">{results.length} sonuç</span><span className="rounded-full border border-white/10 px-3 py-2">{saved.length} kayıtlı</span><span className="rounded-full border border-red-300/20 px-3 py-2 text-red-200">{saved.filter((lead) => Number(lead.lead_heat_score || 0) >= 70).length} sıcak lead</span></div></div><HubTabs items={mapTabs} active={tab} onChange={setTab} /><div className="grid gap-4 xl:grid-cols-[270px_minmax(0,1fr)_350px]"><aside className="rounded-[8px] border border-white/10 bg-black/15 p-4"><h3 className="font-black">Arama ve filtreler</h3><div className="mt-4 grid gap-3"><OtherSelectField label="Şehir" value={search.city} onChange={(city) => setSearch({ ...search, city })} options={cityOptions} manualLabel="Şehri yazın" /><Field label="İlçe" value={search.district} onChange={(district) => setSearch({ ...search, district })} /><OtherSelectField label="Sektör" value={search.sector} onChange={(sector) => setSearch({ ...search, sector })} options={mapSectorOptions} manualLabel="Sektörü yazın" /><Field label="Anahtar kelime" value={search.keyword} onChange={(keyword) => setSearch({ ...search, keyword })} /><Field label="Minimum Google puanı" type="number" value={search.minimumRating} onChange={(minimumRating) => setSearch({ ...search, minimumRating })} /><Field label="Minimum yorum sayısı" type="number" value={search.minimumReviewCount} onChange={(minimumReviewCount) => setSearch({ ...search, minimumReviewCount })} /><SelectField label="Web sitesi" value={search.website} onChange={(website) => setSearch({ ...search, website })} options={[{ value: "var", label: "Var" }, { value: "yok", label: "Yok" }]} placeholder="Farketmez" /><SelectField label="Telefon" value={search.phone} onChange={(phone) => setSearch({ ...search, phone })} options={[{ value: "var", label: "Var" }, { value: "yok", label: "Yok" }]} placeholder="Farketmez" /><label className="flex gap-2 text-xs text-slate-300"><input type="checkbox" checked={search.hideSaved} onChange={(event) => setSearch({ ...search, hideSaved: event.target.checked })} />Daha önce kaydedilenleri gizle</label></div><button disabled={loading === "search" || !canDiscover} onClick={runSearch} className="mt-4 w-full rounded-[8px] bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50">{loading === "search" ? "Aranıyor..." : "Sonuçları Göster"}</button><button onClick={clearFilters} className="mt-2 w-full rounded-[8px] border border-white/10 px-4 py-2 text-xs font-bold">Filtreleri temizle</button><div className="mt-3 flex flex-wrap gap-1">{activeFilters.map(([key, value]) => <span key={key} className="rounded-full border border-cyan-200/20 px-2 py-1 text-[9px] text-cyan-100">{String(value)}</span>)}</div></aside><section className="min-w-0"><MapIntelligenceCanvas businesses={visible} districts={districts} sectors={sectors} selectedPlaceId={selectedPlaceId} setSelectedPlaceId={setSelectedPlaceId} setSearch={setSearch} search={search} /></section><aside className="premium-scrollbar max-h-[900px] overflow-y-auto rounded-[8px] border border-white/10 bg-black/15 p-3"><h3 className="px-1 font-black">{tab}</h3>{message && <p className="mt-3 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-xs leading-5 text-cyan-100">{message}</p>}<div className="mt-3 grid gap-2">{loading === "search" ? [1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse rounded-[8px] bg-white/[0.06]" />) : visible.map(renderBusiness)}{!loading && !visible.length && <p className="rounded-[8px] border border-dashed border-white/10 p-5 text-center text-xs leading-5 text-slate-400">Bu görünüm için henüz veri yok. Sol panelden işletme araması yaparak gerçek Google Maps sonuçlarını getirin.</p>}</div></aside></div></Panel>;
}

function OpportunityMap({ search, setSearch, setTab, setActive, saved }: any) {
  const [district, setDistrict] = useState(search.district || "");
  const [sector, setSector] = useState(search.sector || "");
  const liveDistricts = districtOpportunitySeed.map(([name, score, meta, google, category, action]) => {
    const items = saved.filter((lead) => districtOf(lead).toLocaleLowerCase("tr").includes(String(name).toLocaleLowerCase("tr")));
    const liveScore = items.length ? Math.round(items.reduce((sum, lead) => sum + Number(lead.lead_heat_score || 0), 0) / items.length) : Number(score);
    return { name, score: liveScore, meta, google, category, action, count: items.length };
  });
  const cards = district ? sectorOpportunitySeed.map((item) => ({ ...item, score: Math.min(100, item.score + (district === "Yunusemre" ? 4 : district === "Şehzadeler" ? 2 : 0)) })) : liveDistricts;
  const selected = district ? cards.find((item) => item.name === sector) || cards[0] : cards.find((item) => item.name === district) || cards[0];
  function select(item) {
    if (district) setSector(item.name);
    else {
      setDistrict(item.name);
      setSearch({ ...search, district: item.name });
    }
  }
  function transfer() {
    setSearch({ ...search, city: search.city || "Manisa", district, sector: sector || (district ? selected?.name : selected?.category) || "" });
    setTab("Google Maps Müşteri Bulma");
  }
  return <div><div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-white/10 bg-black/15 p-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-orange-200">{district ? `${district} · sektör görünümü` : `${search.city || "Manisa"} · ilçe görünümü`}</p><h3 className="mt-2 text-xl font-black text-white">{district ? "Sektör fırsatlarını karşılaştırın" : "Öncelikli bölgeleri keşfedin"}</h3></div>{district && <button onClick={() => { setDistrict(""); setSector(""); setSearch({ ...search, district: "", sector: "" }); }} className="rounded-full border border-white/10 px-4 py-2 text-xs font-black">İlçe görünümüne dön</button>}</div><div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]"><section className="grid gap-3 sm:grid-cols-2">{cards.map((item) => { const level = opportunityLevel(item.score); const active = item.name === (district ? sector : district); return <button key={item.name} onClick={() => select(item)} className={`min-h-56 rounded-[8px] border p-5 text-left shadow-[0_18px_54px_rgba(0,0,0,.16)] transition hover:-translate-y-1 ${level.className} ${active ? "ring-2 ring-cyan-200/70" : ""}`}><div className="flex items-start justify-between gap-3"><h4 className="text-lg font-black text-white">{item.name}</h4><span className="text-3xl font-black text-white">{item.score}<small className="text-sm">/100</small></span></div><p className="mt-3 text-xs font-black uppercase">{level.label}</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-black/25"><div className="h-full rounded-full bg-current" style={{ width: `${item.score}%` }} /></div><div className="mt-5 grid gap-1 text-xs leading-5"><span>Meta rekabet yoğunluğu: <strong>{item.meta}</strong></span><span>Google potansiyeli: <strong>{item.google}</strong></span><span>{district ? "Başlangıç alt sektörü" : "Öne çıkan kategori"}: <strong>{item.subSector || item.category}</strong></span>{!district && <span>Kayıtlı işletme: <strong>{item.count}</strong></span>}</div></button>; })}</section><aside className="h-fit rounded-[8px] border border-cyan-200/20 bg-[#091424] p-5 shadow-[0_22px_70px_rgba(0,0,0,.28)]"><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-200">Fırsat detayı</p><h3 className="mt-3 text-2xl font-black text-white">{selected?.name}</h3><p className="mt-2 text-4xl font-black text-orange-200">{selected?.score}<small className="text-sm text-slate-400"> / 100</small></p><p className="mt-4 text-sm leading-6 text-slate-300">{opportunityLevel(selected?.score).label}. {selected?.action || "Alt sektörleri inceleyip gerçek işletme keşfini başlatın."}</p><p className="mt-4 text-xs leading-5 text-slate-400">Önerilen alt sektörler: {selected?.subSector || selected?.category}</p><div className="mt-5 grid gap-2"><button onClick={transfer} className="rounded-[8px] bg-cyan-300 px-4 py-3 text-xs font-black text-slate-950">Müşteri Bulmaya Aktar</button><button onClick={transfer} className="rounded-[8px] border border-cyan-200/20 px-4 py-3 text-xs font-black text-cyan-100">İşletme Keşfine Gönder</button><button onClick={() => setActive("AI Studio")} className="rounded-[8px] border border-white/10 px-4 py-3 text-xs font-black">AI Analiz Açısı Üret</button><button onClick={() => setActive("Teklif Motoru")} className="rounded-[8px] border border-white/10 px-4 py-3 text-xs font-black">Teklif Açısı Hazırla</button></div></aside></div><div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{opportunityLegend.map(([score, label, text, action]) => { const level = opportunityLevel(score); return <div key={label} className={`rounded-[8px] border p-3 ${level.className}`}><p className="text-xs font-black">{label}</p><p className="mt-2 text-[11px] leading-5">{text}</p><p className="mt-2 text-[10px] leading-4 opacity-80">{action}</p></div>; })}</div></div>;
}

function MapIntelligenceCanvas({ businesses, districts, sectors, selectedPlaceId, setSelectedPlaceId, setSearch, search }: any) {
  return <div className="overflow-hidden rounded-[8px] border border-white/10 bg-[#08101c]"><div className="border-b border-white/10 p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-200">Map Intelligence Canvas</p><h3 className="mt-1 text-lg font-black">Bölgesel fırsat haritası</h3></div><div className="flex flex-wrap gap-1.5">{opportunityLegend.map(([score, label]) => <span key={label} className={`rounded-full border px-2 py-1 text-[9px] font-black ${opportunityLevel(score).className}`}>{label}</span>)}</div></div><div className="mt-3 flex flex-wrap gap-1.5">{sectors.map((item) => <button key={item.sector} onClick={() => setSearch({ ...search, sector: item.sector })} className={`rounded-full border px-2.5 py-1.5 text-[10px] font-bold ${search.sector === item.sector ? "border-cyan-200/60 bg-cyan-200/15 text-cyan-100" : "border-white/10 text-slate-400"}`}>{item.sector} · {item.count} · {item.hot} sıcak · {item.opportunity.label}</button>)}</div></div><div className="relative min-h-[420px] overflow-hidden p-4"><div className="premium-grid absolute inset-0 opacity-70" /><div className="relative grid gap-3 sm:grid-cols-2">{districts.map((district) => <button key={district.name} onClick={() => setSearch({ ...search, district: district.name })} className={`relative min-h-36 overflow-hidden rounded-[8px] border p-4 text-left transition hover:-translate-y-1 ${district.opportunity.className}`}><span className="text-sm font-black text-white">{district.name}</span><span className="mt-2 block text-xs">{district.items.length} işletme · {district.hot} sıcak lead</span><span className="mt-1 block text-xs">Ort. puan {district.rating} · Olgunluk {district.maturity}</span><span className="mt-3 block text-[10px] font-black uppercase">{district.opportunity.label}</span>{district.sectors.length > 0 && <span className="mt-2 block text-[10px] opacity-80">{district.sectors.join(" · ")}</span>}</button>)}{!districts.length && <div className="col-span-full grid min-h-72 place-items-center rounded-[8px] border border-dashed border-white/10 bg-black/10 p-8 text-center"><div><MapPinned className="mx-auto text-cyan-200" size={34} /><p className="mt-4 font-black">Harita katmanı veri bekliyor</p><p className="mt-2 max-w-md text-xs leading-5 text-slate-400">İşletme araması yaptığınızda ilçeler, sektörler ve fırsat yoğunlukları gerçek sonuçlardan otomatik oluşur.</p></div></div>}</div><div className="pointer-events-none absolute inset-0">{businesses.slice(0, 16).map((item, index) => { const placeId = item.placeId || item.google_place_id; const level = opportunityLevel(item.leadHeatScore ?? item.lead_heat_score); return <button key={placeId || index} onClick={() => setSelectedPlaceId(placeId)} className={`pointer-events-auto absolute grid size-5 place-items-center rounded-full border-2 border-white/70 shadow-lg transition hover:scale-150 ${level.pin} ${selectedPlaceId === placeId ? "scale-150 ring-4 ring-cyan-200/30" : ""}`} style={{ left: `${12 + index * 23 % 78}%`, top: `${18 + index * 31 % 68}%` }} title={item.name || item.company}><span className="size-1.5 rounded-full bg-slate-950" /></button>; })}</div></div></div>;
}

function PreparationCenter({ content, setContent, setActive, mode = "Hazırlık Merkezi" }: any) {
  const empty = { company_id: "", customer_checklist: [], campaign_checklist: [], brand_analysis: "", swot_notes: "", target_audience_notes: "", offer_positioning: "", funnel_planning: "", content_ideas: "", ad_angle_ideas: "", prompt_shortcuts: "" };
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState("");
  function selectCompany(company_id) {
    setForm((content.preparationNotes || []).find((note) => note.company_id === company_id) || { ...empty, company_id });
  }
  async function save() {
    if (!form.company_id) return setMessage("Hazırlık notu için firma seçin.");
    setMessage("Kaydediliyor...");
    const response = await fetch("/api/admin/preparation-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data.supabaseError || data.error || "Hazırlık notları kaydedilemedi.");
    const notes = [data.note, ...(content.preparationNotes || []).filter((note) => note.company_id !== data.note.company_id)];
    setContent({ ...content, preparationNotes: notes });
    setForm(data.note);
    setMessage(data.message);
  }
  const checklist = (key, labels) => <div className="rounded-[8px] border border-white/10 p-4"><h3 className="font-black">{key === "customer_checklist" ? "Müşteri hazırlık kontrolü" : "Kampanya hazırlık kontrolü"}</h3><div className="mt-3 grid gap-2">{labels.map((label) => <label key={label} className="flex gap-2 text-sm text-slate-300"><input type="checkbox" checked={(form[key] || []).includes(label)} onChange={(event) => setForm({ ...form, [key]: event.target.checked ? [...(form[key] || []), label] : (form[key] || []).filter((item) => item !== label) })} />{label}</label>)}</div></div>;
  return <Panel title={mode}><p className="mb-5 text-sm leading-6 text-slate-400">Müşteri hazırlığını, marka analizini, hedef kitleyi ve kampanya yaklaşımını tek çalışma alanında toparlayın.</p><CompanySelect value={form.company_id} onChange={selectCompany} companies={content.companies} /><div className="mt-4 grid gap-4 md:grid-cols-2">{checklist("customer_checklist", ["Firma bilgileri tamamlandı", "Hedef netleştirildi", "Teklif yaklaşımı belirlendi", "İletişim kişisi doğrulandı"])}{checklist("campaign_checklist", ["Ölçümleme kontrol edildi", "Hedef kitle hazırlandı", "Kreatif ihtiyaçları listelendi", "Bütçe ve dönem belirlendi"])}<TextArea label="Marka analizi" value={form.brand_analysis} onChange={(value) => setForm({ ...form, brand_analysis: value })} /><TextArea label="SWOT notları" value={form.swot_notes} onChange={(value) => setForm({ ...form, swot_notes: value })} /><TextArea label="Hedef kitle notları" value={form.target_audience_notes} onChange={(value) => setForm({ ...form, target_audience_notes: value })} /><TextArea label="Teklif konumlandırması" value={form.offer_positioning} onChange={(value) => setForm({ ...form, offer_positioning: value })} /><TextArea label="Müşteri yolculuğu planı" value={form.funnel_planning} onChange={(value) => setForm({ ...form, funnel_planning: value })} /><TextArea label="İçerik fikirleri" value={form.content_ideas} onChange={(value) => setForm({ ...form, content_ideas: value })} /><TextArea label="Reklam açıları" value={form.ad_angle_ideas} onChange={(value) => setForm({ ...form, ad_angle_ideas: value })} /><TextArea label="Prompt kısayolları" value={form.prompt_shortcuts} onChange={(value) => setForm({ ...form, prompt_shortcuts: value })} /></div><div className="mt-5 flex flex-wrap gap-2"><button onClick={save} className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">Hazırlığı kaydet</button><button onClick={() => setActive("AI Studio")} className="rounded-full border border-white/10 px-4 py-3 text-sm">AI Studio'ya gönder</button><button onClick={() => setActive("CRM")} className="rounded-full border border-white/10 px-4 py-3 text-sm">CRM'e git</button><button onClick={() => setActive("Teklif Motoru")} className="rounded-full border border-white/10 px-4 py-3 text-sm">Teklif oluştur</button><button onClick={() => setActive("Raporlar")} className="rounded-full border border-white/10 px-4 py-3 text-sm">Rapor oluştur</button></div>{message && <p className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-100">{message}</p>}</Panel>;
}

const themePresets = {
  "HK Premium Dark": { background: "#050711", surface: "#0b1020", text: "#f8fafc", mutedText: "#a9b7cb", primaryButton: "#67e8f9", secondaryButton: "#172033", accent: "#facc15", sidebar: "#080b17", header: "#050711", border: "#31405f", success: "#34d399", warning: "#fbbf24", danger: "#f87171" },
  "HK Premium Light": { background: "#eef4fa", surface: "#ffffff", text: "#0f172a", mutedText: "#475569", primaryButton: "#0369a1", secondaryButton: "#dbeafe", accent: "#b45309", sidebar: "#ffffff", header: "#f8fafc", border: "#b8c7d9", success: "#047857", warning: "#b45309", danger: "#b91c1c" },
  "HK Yellow Black": { background: "#070707", surface: "#151515", text: "#fafafa", mutedText: "#cbd5e1", primaryButton: "#facc15", secondaryButton: "#27272a", accent: "#fde047", sidebar: "#0b0b0b", header: "#070707", border: "#4b5563", success: "#34d399", warning: "#facc15", danger: "#fb7185" },
  "Agency Blue Orange": { background: "#07111f", surface: "#0d1b2f", text: "#f8fafc", mutedText: "#b5c2d7", primaryButton: "#38bdf8", secondaryButton: "#17365f", accent: "#fb923c", sidebar: "#08172a", header: "#07111f", border: "#31557f", success: "#34d399", warning: "#fb923c", danger: "#f87171" }
};

function ThemeEditor({ onApply }: any) {
  const [theme, setTheme] = useState(themePresets["HK Premium Dark"]);
  const [message, setMessage] = useState("");
  function apply(next) {
    setTheme(next);
    onApply(next);
    localStorage.setItem("hk-admin-custom-theme", JSON.stringify(next));
  }
  async function save() {
    const response = await fetch("/api/admin/theme", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(theme) });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? data.message : data.supabaseError || data.error || "Tema kaydedilemedi.");
  }
  return <Panel title="Tema Ayarları"><p className="mb-5 text-sm leading-6 text-slate-400">Admin paneli renklerini canlı önizleme ile düzenleyin. Tercih bu tarayıcıda anında uygulanır ve kaydettiğinizde Supabase içinde saklanır.</p><div className="mb-5 flex flex-wrap gap-2">{Object.entries(themePresets).map(([label, preset]) => <button key={label} onClick={() => apply(preset)} className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold">{label}</button>)}</div><div className="grid gap-4 lg:grid-cols-[1fr_360px]"><div className="grid gap-3 sm:grid-cols-2">{Object.entries(theme).map(([key, value]) => <Field key={key} label={key} type="color" value={value} onChange={(next) => apply({ ...theme, [key]: next })} />)}</div><div className="rounded-[8px] border p-4" style={{ background: theme.surface, borderColor: theme.border, color: theme.text }}><p className="text-xs font-black uppercase" style={{ color: theme.accent }}>Canlı önizleme</p><h3 className="mt-3 text-xl font-black">HK Dijital Premium Panel</h3><p className="mt-2 text-sm" style={{ color: theme.mutedText }}>Kart, metin, buton ve durum renklerini burada birlikte değerlendirin.</p><button className="mt-5 rounded-full px-4 py-2 text-sm font-black" style={{ background: theme.primaryButton, color: theme.background }}>Birincil işlem</button></div></div><div className="mt-5 flex gap-2"><button onClick={save} className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">Temayı kaydet</button><button onClick={() => apply(themePresets["HK Premium Dark"])} className="rounded-full border border-white/10 px-5 py-3 text-sm">Varsayılanlara dön</button></div>{message && <p className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-100">{message}</p>}</Panel>;
}


function AnalysisSearchForm({ form, setForm, buttonLabel, loading, onSubmit }: any) {
  const districts = analysisDistrictOptions[form.city] || analysisDistrictOptions.Manisa;
  function updateCity(city) {
    const nextDistricts = analysisDistrictOptions[city] || analysisDistrictOptions.Manisa;
    setForm({ ...form, city, district: nextDistricts[0] || "" });
  }
  return <div className="rounded-[8px] border border-amber-200/15 bg-black/20 p-4 shadow-[0_22px_70px_rgba(0,0,0,.2)]"><div className="grid gap-4 md:grid-cols-3"><SelectField label="İl seç" value={form.city} onChange={updateCity} options={cityOptions} /><SelectField label="İlçe seç" value={form.district} onChange={(district) => setForm({ ...form, district })} options={districts} /><OtherSelectField label="Sektör seç" value={form.sector} onChange={(sector) => setForm({ ...form, sector })} options={sectorOptions} manualLabel="Sektörü yazın" /></div><button onClick={onSubmit} disabled={loading} className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-amber-300 px-6 text-sm font-black text-slate-950 shadow-[0_16px_42px_rgba(251,191,36,.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Analiz ediliyor..." : buttonLabel}</button></div>;
}

function valueOrMissing(value: any) {
  return value ? String(value) : "Bulunamadı";
}

function analysisLinks(item: any) {
  return {
    metaAdLibrary: item.metaAdLibraryUrl || item.adUrl || "",
    googleMaps: item.googleMapsUrl || (item.googlePlaceId ? `https://www.google.com/maps/place/?q=place_id:${item.googlePlaceId}` : ""),
    googleSearch: item.googleSearchUrl || `https://www.google.com/search?q=${encodeURIComponent(item.name || "")}`,
    website: item.website || ""
  };
}

function buildAnalysisSavePayload(kind: "meta" | "google", item: any, form: any) {
  const links = analysisLinks(item);
  return {
    source: kind === "meta" ? "Meta Analiz" : "Google Ads Analiz",
    city: item.city || form.city,
    district: item.district || form.district,
    sector: item.sector || item.category || form.sector,
    businessName: item.name,
    website: item.website || "",
    phone: item.phone || "",
    email: item.email || "",
    address: item.address || "",
    links,
    summary: item.summary || item.adActivitySignal || item.googleBusinessPresence || "",
    platform: item.platform || (kind === "meta" ? "Facebook / Instagram" : "Google"),
    aiNote: item.opportunityNote || item.adActivitySignal || item.summary || "",
    googlePlaceId: kind === "google" ? (item.googlePlaceId || item.google_place_id || item.id || "") : "",
    googleRating: item.googleRating || item.google_rating || null,
    googleReviewCount: item.googleReviewCount || item.google_review_count || 0
  };
}

function AnalysisDetailModal({ kind, item, form, aiMeta, saved, saving, message, onClose, onSave }: any) {
  const links = analysisLinks(item);
  const rows = [
    ["İşletme / Sayfa adı", item.name],
    ["Reklam kaynağı", kind === "meta" ? "Meta Analiz" : "Google Ads Analiz"],
    ["İl", item.city || form.city],
    ["İlçe", item.district || form.district],
    ["Sektör", item.sector || item.category || form.sector],
    ["Veri tipi", item.dataLabel || (item.demo ? "Demo Veri" : "Canlı Veri")],
    ["Reklam özeti", item.summary || item.adActivitySignal],
    ["Reklam metni", item.adCopy],
    ["Kreatif özeti", item.creativeSummary],
    ["Tahmini reklam yoğunluğu", item.estimatedAdIntensity],
    ["CTA analizi", item.ctaAnalysis],
    ["Kreatif analizi", item.creativeAnalysis],
    ["Rekabet analizi", item.competitiveAnalysis],
    ["Platform", item.platform || (kind === "meta" ? "Facebook / Instagram" : "Google")],
    ["Website", item.website],
    ["Telefon", item.phone],
    ["E-posta", item.email],
    ["Adres", item.address],
    ["AI yorum / fırsat notu", item.opportunityNote || item.adActivitySignal || item.summary]
  ];
  const linkRows = [
    ["Google Maps link", links.googleMaps],
    ["Meta Ad Library link", links.metaAdLibrary],
    ["Google search link", links.googleSearch]
  ].filter(([, url]) => url);
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/75 p-4">
      <div className="premium-scrollbar max-h-[92vh] w-full max-w-4xl overflow-auto rounded-[8px] border border-white/10 bg-[#070b16] p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className={`text-xs font-black uppercase tracking-[.16em] ${kind === "meta" ? "text-orange-200" : "text-yellow-200"}`}>{kind === "meta" ? "Meta Analiz Detayı" : "Google Ads Analiz Detayı"}</p>
            <h2 className="mt-2 text-2xl font-black text-white">{item.name}</h2>
            <AiUsageBadge meta={aiMeta} />
          </div>
          <button onClick={onClose} className="grid size-10 place-items-center rounded-full border border-white/10"><X size={18} /></button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-[8px] border border-white/10 bg-white/[0.035] p-3">
              <p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-500">{label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-100">{valueOrMissing(value)}</p>
            </div>
          ))}
        </div>
        {!!linkRows.length && <div className="mt-4 flex flex-wrap gap-2">{linkRows.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer" className="rounded-full border border-cyan-200/20 px-4 py-2 text-xs font-black text-cyan-100">{label}</a>)}</div>}
        {message && <p className={`mt-4 rounded-[8px] border p-3 text-sm ${message.includes("zaten") || message.includes("hata") ? "border-amber-300/25 bg-amber-300/10 text-amber-100" : "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"}`}>{message}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-white/10 px-4 py-2 text-sm">Kapat</button>
          <button onClick={onSave} disabled={saving || saved} className="rounded-full bg-amber-300 px-5 py-2 text-sm font-black text-slate-950 disabled:opacity-60">{saved ? "CRM’e Kaydedildi" : saving ? "CRM’e kaydediliyor..." : "CRM’e Kaydet"}</button>
        </div>
      </div>
    </div>
  );
}

function AnalysisResultCard({ kind, item, form, aiMeta, saved, saving, message, onOpen, onSave }: any) {
  const isMeta = kind === "meta";
  return (
    <button type="button" onClick={onOpen} className="rounded-[8px] border border-white/10 bg-white/[0.045] p-5 text-left shadow-[0_22px_70px_rgba(0,0,0,.22)] transition hover:-translate-y-1 hover:border-amber-200/40 hover:bg-white/[0.07]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-black uppercase tracking-[.14em] ${isMeta ? "text-orange-200" : "text-yellow-200"}`}>{isMeta ? (item.platform || "Facebook / Instagram") : "Google Ads Analiz"}</p>
          <h3 className="mt-2 text-lg font-black text-white">{item.name}</h3>
          <p className="mt-1 text-xs text-slate-500">{isMeta ? `${form.city} / ${form.district} / ${form.sector}` : (item.website || "Website bilgisi yok")}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-black ${isMeta ? (item.active ? "bg-emerald-300/12 text-emerald-100" : "bg-slate-400/10 text-slate-300") : "bg-yellow-300/12 text-yellow-100"}`}>{isMeta ? (item.active ? "Aktif reklam var" : "Aktif reklam sinyali yok") : `${item.searchVisibilityScore}/100 görünürlük`}</span>
          {isMeta && item.demo && <span className="rounded-full bg-amber-300/14 px-3 py-1 text-xs font-black text-amber-100">Demo Veri</span>}
          {saved && <span className="rounded-full bg-emerald-300/12 px-3 py-1 text-xs font-black text-emerald-100">CRM’e Kaydedildi</span>}
        </div>
      </div>
      <AiUsageBadge meta={aiMeta} />
      <p className="mt-4 text-sm leading-6 text-slate-300">{item.summary || item.adActivitySignal || item.googleBusinessPresence}</p>
      <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
        {isMeta ? <>
          <span>Tahmini kategori: <strong className="text-slate-200">{item.category || item.sector || "-"}</strong></span>
          <span>CTA: <strong className="text-slate-200">{item.cta || "-"}</strong></span>
          <span>Başlangıç: <strong className="text-slate-200">{item.startDate || "-"}</strong></span>
          <span>Yoğunluk: <strong className="text-slate-200">{item.estimatedAdIntensity || item.activeStatus || "-"}</strong></span>
        </> : <>
          <span>Google Business: <strong className="text-slate-200">{item.googleBusinessPresence}</strong></span>
          <span>Reklam sinyali: <strong className="text-slate-200">{item.adActivitySignal}</strong></span>
          <span>Telefon: <strong className="text-slate-200">{item.phone || "Bulunamadı"}</strong></span>
          <span>Adres: <strong className="text-slate-200">{item.address || "Bulunamadı"}</strong></span>
        </>}
      </div>
      {!isMeta && <div className="mt-4 flex flex-wrap gap-2">{(item.keywordOpportunities || []).map((keyword) => <span key={keyword} className="rounded-full border border-yellow-200/20 px-3 py-1 text-xs text-yellow-100">{keyword}</span>)}</div>}
      {message && <p className={`mt-4 rounded-[8px] border p-2 text-xs ${message.includes("zaten") || message.includes("hata") ? "border-amber-300/25 bg-amber-300/10 text-amber-100" : "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"}`}>{message}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={(event) => { event.stopPropagation(); onSave(); }} disabled={saving || saved} className="rounded-full bg-amber-300 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-60">{saved ? "CRM’e Kaydedildi" : saving ? "CRM’e kaydediliyor..." : "CRM’e Kaydet"}</button>
        {isMeta && (item.adUrl || item.metaAdLibraryUrl) && <a href={item.adUrl || item.metaAdLibraryUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="rounded-full border border-orange-200/25 px-4 py-2 text-xs font-black text-orange-100">Reklamı Aç</a>}
        {isMeta && <button type="button" onClick={(event) => { event.stopPropagation(); onOpen(); }} className="rounded-full border border-cyan-200/25 px-4 py-2 text-xs font-black text-cyan-100">AI ile Reklamı Yorumla</button>}
        <span className="rounded-full border border-white/10 px-4 py-2 text-xs font-black text-slate-300">Detayı aç</span>
      </div>
    </button>
  );
}

function useAnalysisCrmSaving(kind: "meta" | "google", form: any) {
  const [selected, setSelected] = useState(null);
  const [savedIds, setSavedIds] = useState({});
  const [savingId, setSavingId] = useState("");
  const [messages, setMessages] = useState({});
  async function save(item) {
    const id = item.id || item.name;
    setSavingId(id);
    setMessages({ ...messages, [id]: "CRM’e kaydediliyor..." });
    try {
      const response = await fetch("/api/admin/leads/from-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildAnalysisSavePayload(kind, item, form))
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409 || data.duplicate) {
        setMessages((prev) => ({ ...prev, [id]: "Bu kayıt CRM’de zaten var." }));
        return;
      }
      if (!response.ok) throw new Error(data.error || "Kayıt CRM’e eklenirken hata oluştu.");
      setSavedIds((prev) => ({ ...prev, [id]: true }));
      setMessages((prev) => ({ ...prev, [id]: "Kayıt CRM’e eklendi." }));
    } catch {
      setMessages((prev) => ({ ...prev, [id]: "Kayıt CRM’e eklenirken hata oluştu." }));
    } finally {
      setSavingId("");
    }
  }
  return { selected, setSelected, savedIds, savingId, messages, save };
}

function MetaAnalysisSection() {
  const [form, setForm] = useState({ city: "Manisa", district: "Yunusemre", sector: "Restoran" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [results, setResults] = useState([]);
  const [aiMeta, setAiMeta] = useState(aiMetaFromApi({ activeProvider: "Demo Modu", model: "meta-analysis-demo", demoMode: true }));
  const crm = useAnalysisCrmSaving("meta", form);
  async function analyze() {
    setLoading(true);
    setError("");
    setWarning("");
    setResults([]);
    try {
      const response = await fetch("/api/admin/meta-analysis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Analiz sırasında bir hata oluştu.");
      setWarning(data.warning || "");
      setResults(data.results || []);
      setAiMeta(data.ai || aiMetaFromApi({ activeProvider: "Demo Modu", model: "meta-analysis-demo", demoMode: true }));
    } catch {
      setError("Analiz sırasında bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }
  return <Panel title="Meta Analiz"><div className="mb-5 rounded-[8px] border border-orange-300/20 bg-gradient-to-br from-orange-300/12 via-yellow-200/5 to-transparent p-5"><p className="text-xs font-black uppercase tracking-[.16em] text-orange-200">Meta Reklam Zekâsı</p><h2 className="mt-2 text-2xl font-black text-white">Facebook ve Instagram reklam sinyallerini ayrı analiz edin</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">İl, ilçe ve sektör seçimine göre Meta Ad Library odaklı gözlemler, CTA ve kreatif metin özetleri üretir.</p></div><AnalysisSearchForm form={form} setForm={setForm} loading={loading} onSubmit={analyze} buttonLabel="Meta Reklamlarını Analiz Et" />{warning && <p className="mt-4 rounded-[8px] border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-100">{warning}</p>}{error && <p className="mt-4 rounded-[8px] border border-red-300/25 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}<div className="mt-5 grid gap-4 lg:grid-cols-2">{results.map((item) => { const id = item.id || item.name; return <AnalysisResultCard key={id} kind="meta" item={item} form={form} aiMeta={aiMeta} saved={crm.savedIds[id]} saving={crm.savingId === id} message={crm.messages[id]} onOpen={() => crm.setSelected(item)} onSave={() => crm.save(item)} />; })}{!loading && !error && !results.length && <p className="rounded-[8px] border border-dashed border-white/10 p-6 text-center text-sm text-slate-400 lg:col-span-2">Bu seçim için sonuç bulunamadı.</p>}</div>{crm.selected && <AnalysisDetailModal kind="meta" item={crm.selected} form={form} aiMeta={aiMeta} saved={crm.savedIds[crm.selected.id || crm.selected.name]} saving={crm.savingId === (crm.selected.id || crm.selected.name)} message={crm.messages[crm.selected.id || crm.selected.name]} onClose={() => crm.setSelected(null)} onSave={() => crm.save(crm.selected)} />}</Panel>;
}

function GoogleAdsAnalysisSection() {
  const [form, setForm] = useState({ city: "Manisa", district: "Yunusemre", sector: "Restoran" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [results, setResults] = useState([]);
  const [aiMeta, setAiMeta] = useState(aiMetaFromApi({ activeProvider: "Demo Modu", model: "google-analysis-demo", demoMode: true }));
  const crm = useAnalysisCrmSaving("google", form);
  async function analyze() {
    setLoading(true);
    setError("");
    setWarning("");
    setResults([]);
    try {
      const response = await fetch("/api/admin/google-analysis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Analiz sırasında bir hata oluştu.");
      setWarning(data.warning || "");
      setResults(data.results || []);
      setAiMeta(data.ai || aiMetaFromApi({ activeProvider: "Demo Modu", model: "google-analysis-demo", demoMode: true }));
    } catch {
      setError("Analiz sırasında bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }
  return <Panel title="Google Ads Analiz"><div className="mb-5 rounded-[8px] border border-yellow-300/20 bg-gradient-to-br from-yellow-300/12 via-orange-200/5 to-transparent p-5"><p className="text-xs font-black uppercase tracking-[.16em] text-yellow-200">Google Reklam Zekâsı</p><h2 className="mt-2 text-2xl font-black text-white">Arama görünürlüğü ve yerel reklam fırsatlarını ayrı analiz edin</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Google Maps ve işletme sinyallerinden arama görünürlüğü, anahtar kelime fırsatı ve kampanya tipi önerileri üretir.</p></div><AnalysisSearchForm form={form} setForm={setForm} loading={loading} onSubmit={analyze} buttonLabel="Google Reklamlarını Analiz Et" />{warning && <p className="mt-4 rounded-[8px] border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-100">{warning}</p>}{error && <p className="mt-4 rounded-[8px] border border-red-300/25 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}<div className="mt-5 grid gap-4 lg:grid-cols-2">{results.map((item) => { const id = item.id || item.name; return <AnalysisResultCard key={id} kind="google" item={item} form={form} aiMeta={aiMeta} saved={crm.savedIds[id]} saving={crm.savingId === id} message={crm.messages[id]} onOpen={() => crm.setSelected(item)} onSave={() => crm.save(item)} />; })}{!loading && !error && !results.length && <p className="rounded-[8px] border border-dashed border-white/10 p-6 text-center text-sm text-slate-400 lg:col-span-2">Bu seçim için sonuç bulunamadı.</p>}</div>{crm.selected && <AnalysisDetailModal kind="google" item={crm.selected} form={form} aiMeta={aiMeta} saved={crm.savedIds[crm.selected.id || crm.selected.name]} saving={crm.savingId === (crm.selected.id || crm.selected.name)} message={crm.messages[crm.selected.id || crm.selected.name]} onClose={() => crm.setSelected(null)} onSave={() => crm.save(crm.selected)} />}</Panel>;
}

const socialAuditActions = ["Düzeltilmesi Gerekenler", "30 Günlük Sosyal Medya Planı", "Meta Reklam Stratejisi", "Google Reklam Stratejisi", "İçerik Fikirleri", "Teklif Hazırlama", "PDF Audit Oluştur", "WhatsApp Teklifi Hazırla", "CRM’e Kaydet"];
const socialAiOptions = ["Genel Ayarı Kullan", "Gemini", "OpenAI", "Groq", "Demo Modu", "Yerel Mod"];

function SocialMediaAuditCenter() {
  const [form, setForm] = useState({ businessName: "", city: "Manisa", district: "Yunusemre", sector: "Restoran", notes: "", aiProvider: "Genel Ayarı Kullan" });
  const [platforms, setPlatforms] = useState(socialPlatforms.map((platform) => ({ platform, username: "", profileUrl: "", profileImageUrl: "" })));
  const [screenshots, setScreenshots] = useState([]);
  const [actions, setActions] = useState(["Düzeltilmesi Gerekenler", "30 Günlük Sosyal Medya Planı", "İçerik Fikirleri"]);
  const [outputs, setOutputs] = useState([]);
  const [leadScore, setLeadScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [crmMessage, setCrmMessage] = useState("");
  const [crmSaving, setCrmSaving] = useState(false);
  function toggleAction(action) {
    setActions(actions.includes(action) ? actions.filter((item) => item !== action) : [...actions, action]);
  }
  function generatedProfileUrl(platform: string, username: string) {
    const cleanUsername = String(username || "").trim().replace(/^@/, "");
    if (!cleanUsername) return "";
    if (platform === "Instagram") return `https://www.instagram.com/${cleanUsername}`;
    if (platform === "TikTok") return `https://www.tiktok.com/@${cleanUsername}`;
    if (platform === "X (Twitter)") return `https://x.com/${cleanUsername}`;
    return "";
  }
  function usernameLabel(platform: string) {
    if (platform === "Facebook") return "Sayfa adı";
    if (platform === "YouTube") return "Kanal adı";
    if (platform === "LinkedIn") return "Şirket sayfası adı";
    return "Kullanıcı adı";
  }
  function urlLabel(platform: string) {
    if (platform === "Facebook") return "Sayfa URL";
    if (platform === "YouTube") return "Kanal URL";
    if (platform === "LinkedIn") return "Şirket sayfası URL";
    return "Profil URL";
  }
  function updatePlatform(index, patch) {
    setPlatforms(platforms.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const next = { ...item, ...patch };
      if ("username" in patch && !next.profileUrl) {
        next.profileUrl = generatedProfileUrl(next.platform, patch.username);
      }
      return next;
    }));
  }
  function addScreenshots(files) {
    const accepted = Array.from(files || []).filter((file: any) => ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type));
    const nextItems = accepted.map((file: any, index) => ({ id: `${Date.now()}-${index}-${file.name}`, name: file.name, type: file.type, url: URL.createObjectURL(file), order: screenshots.length + index }));
    setScreenshots([...screenshots, ...nextItems]);
  }
  function moveScreenshot(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= screenshots.length) return;
    const next = [...screenshots];
    [next[index], next[target]] = [next[target], next[index]];
    setScreenshots(next.map((item, order) => ({ ...item, order })));
  }
  function activePlatforms() {
    return platforms.filter((item) => item.username || item.profileUrl || item.profileImageUrl);
  }
  const primaryProfile = activePlatforms()[0] || platforms[0];
  async function runAudit() {
    if (!hasInput) {
      setMessage("Analiz için en az bir profil bilgisi, ekran görüntüsü veya işletme bilgisi girin.");
      return;
    }
    setLoading(true);
    setMessage("Sosyal istihbarat analizi hazırlanıyor...");
    setOutputs([]);
    setLeadScore(null);
    const analysisActions = actions.filter((action) => action !== "CRM’e Kaydet");
    const response = await fetch("/api/admin/social-audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, platforms: activePlatforms(), screenshots: screenshots.map(({ name, type, order }) => ({ name, type, order })), aiProvider: form.aiProvider, actions: analysisActions })
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setOutputs(data.outputs || []);
      setLeadScore(data.leadScore || null);
      setMessage("");
    } else {
      setMessage(data.error || "AI sağlayıcısı kullanılamadı. API ayarlarını kontrol edin.");
    }
    setLoading(false);
  }
  function buildPrintableAudit() {
    const name = form.businessName || primaryProfile?.username || "isletme";
    const escapeHtml = (value) => String(value || "").replace(/[<&>]/g, (char) => {
      if (char === "<") return "&lt;";
      if (char === ">") return "&gt;";
      return "&amp;";
    });
    const outputHtml = outputs.map((item) => `<section><h2>${escapeHtml(item.action)}</h2><pre>${escapeHtml(item.text)}</pre></section>`).join("");
    return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>HK Dijital Mini Audit</title><style>body{font-family:Inter,Arial,sans-serif;background:#07111f;color:#172033;margin:0}.page{background:#fff;max-width:900px;margin:0 auto;padding:48px}.cover{background:linear-gradient(135deg,#07111f,#0f5ea8,#f7b733);color:#fff;border-radius:22px;padding:40px;margin-bottom:28px}h1{font-size:34px;margin:0}h2{color:#0f5ea8;margin-top:32px}pre{white-space:pre-wrap;font:14px/1.7 Inter,Arial,sans-serif}.badge{display:inline-block;background:#fff3cd;color:#563b00;border-radius:999px;padding:8px 14px;margin-top:18px;font-weight:800}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.card{border:1px solid #e5e7eb;border-radius:14px;padding:14px}</style></head><body><main class="page"><div class="cover"><p>HK Dijital</p><h1>${name} Mini Sosyal İstihbarat Audit</h1><p>Digital Marketing Command Center</p><span class="badge">Lead Score: ${leadScore?.score ?? "-"} / 100 · ${leadScore?.temperature ?? "-"}</span></div><div class="grid"><div class="card"><strong>Sektör</strong><br>${form.sector}</div><div class="card"><strong>Lokasyon</strong><br>${form.city} / ${form.district}</div><div class="card"><strong>Paketler</strong><br>Starter 10.000 TL · Pro 15.000 TL · Premium 25.000 TL</div><div class="card"><strong>Platformlar</strong><br>${activePlatforms().map((item) => item.platform).join(", ") || "-"}</div></div>${primaryProfile?.profileImageUrl ? `<h2>Profil Görseli</h2><img src="${primaryProfile.profileImageUrl}" style="max-width:180px;border-radius:20px">` : ""}${outputHtml}<h2>Kapanış</h2><p>Bu audit satış garantisi vermez; gerçekçi büyüme, ölçümleme, iletişim ve dönüşüm optimizasyonu için hazırlanmıştır.</p></main></body></html>`;
  }
  function downloadMiniAuditPdf() {
    const name = (form.businessName || primaryProfile?.username || "business").toLocaleLowerCase("tr").replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ]+/gi, "-").replace(/^-|-$/g, "") || "business";
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([buildPrintableAudit()], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hk-dijital-mini-audit-${name}-${date}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }
  function whatsappText() {
    const selected = outputs.find((item) => item.action === "WhatsApp Teklifi Hazırla")?.text || outputs.map((item) => `${item.action}\n${item.text}`).join("\n\n");
    return selected || `${form.businessName || "İşletmeniz"} için sosyal medya, Meta reklam ve Google reklam fırsatlarını değerlendirmek isteriz.`;
  }
  async function saveToCrm() {
    setCrmSaving(true);
    setCrmMessage("CRM’e kaydediliyor...");
    const summary = outputs.map((item) => `${item.action}\n${item.text}`).join("\n\n");
    const response = await fetch("/api/admin/leads/from-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "Sosyal İstihbarat Merkezi",
        city: form.city,
        district: form.district,
        sector: form.sector,
        businessName: form.businessName || primaryProfile?.username || primaryProfile?.profileUrl,
        website: primaryProfile?.profileUrl || "",
        phone: "",
        email: "",
        address: "",
        links: { website: primaryProfile?.profileUrl, sourceUrl: primaryProfile?.profileUrl },
        summary: summary || form.notes,
        platform: activePlatforms().map((item) => item.platform).join(", "),
        platforms: activePlatforms(),
        profileImageUrl: primaryProfile?.profileImageUrl || "",
        leadScore: leadScore?.score,
        leadTemperature: leadScore?.temperature,
        aiNote: summary
      })
    });
    const data = await response.json().catch(() => ({}));
    setCrmMessage(response.ok ? "Kayıt CRM’e eklendi." : data.duplicate ? "Bu kayıt CRM’de zaten var." : data.error || "Kayıt CRM’e eklenirken hata oluştu.");
    setCrmSaving(false);
  }
  const districts = analysisDistrictOptions[form.city] || analysisDistrictOptions.Manisa;
  function updateCity(city) {
    const nextDistricts = analysisDistrictOptions[city] || analysisDistrictOptions.Manisa;
    setForm({ ...form, city, district: nextDistricts[0] || "" });
  }
  const pdfOutput = outputs.find((item) => item.action === "PDF Audit Oluştur");
  const whatsappOutput = outputs.find((item) => item.action === "WhatsApp Teklifi Hazırla");
  const hasInput = !!(form.businessName || form.notes || activePlatforms().length || screenshots.length);
  return <Panel title="Sosyal İstihbarat Merkezi"><div className="mb-5 overflow-hidden rounded-[8px] border border-yellow-300/25 bg-gradient-to-br from-yellow-300/18 via-pink-300/8 to-cyan-300/8 p-5 shadow-[0_26px_90px_rgba(250,204,21,.12)]"><p className="text-xs font-black uppercase tracking-[.16em] text-yellow-200">AI Powered Social Intelligence Center</p><h2 className="mt-2 text-2xl font-black text-white">Çoklu platform profillerini tek merkezde denetleyin</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Instagram, Facebook, TikTok, YouTube, LinkedIn ve X profillerini ekran görüntüleriyle birlikte analiz eder; sadece seçtiğiniz aksiyonları üretir ve CRM’e “Sosyal İstihbarat Merkezi” kaynağıyla kaydeder.</p></div><div className="grid gap-4 rounded-[8px] border border-white/10 bg-black/15 p-4 md:grid-cols-2 xl:grid-cols-3"><Field label="İşletme / profil adı" value={form.businessName} onChange={(businessName) => setForm({ ...form, businessName })} /><OtherSelectField label="Sektör" value={form.sector} onChange={(sector) => setForm({ ...form, sector })} options={sectorOptions} manualLabel="Sektörü yazın" /><SelectField label="Bu analizde kullanılacak AI" value={form.aiProvider} onChange={(aiProvider) => setForm({ ...form, aiProvider })} options={socialAiOptions} /><SelectField label="İl" value={form.city} onChange={updateCity} options={cityOptions} /><SelectField label="İlçe" value={form.district} onChange={(district) => setForm({ ...form, district })} options={districts} /><div className="md:col-span-2 xl:col-span-3"><TextArea label="Ek gözlem / not" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} /></div></div><div className="mt-5 grid gap-4 xl:grid-cols-2">{platforms.map((item, index) => <div key={item.platform} className="rounded-[8px] border border-white/10 bg-white/[0.04] p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-black text-white">{item.platform}</p><span className="rounded-full bg-yellow-300/12 px-3 py-1 text-xs font-black text-yellow-100">{item.platform}</span></div><div className="mt-3 grid gap-3 md:grid-cols-3"><Field label={usernameLabel(item.platform)} value={item.username} onChange={(username) => updatePlatform(index, { username })} /><Field label={urlLabel(item.platform)} value={item.profileUrl} onChange={(profileUrl) => updatePlatform(index, { profileUrl })} /><Field label="Profil görsel URL" value={item.profileImageUrl} onChange={(profileImageUrl) => updatePlatform(index, { profileImageUrl })} /></div><div className="mt-4 grid gap-3 md:grid-cols-[96px_1fr]"><div className="grid size-24 place-items-center overflow-hidden rounded-[8px] border border-white/10 bg-black/20">{item.profileImageUrl ? <img src={item.profileImageUrl} alt={`${item.platform} profil görseli`} className="size-full object-cover" /> : <ImagePlus size={22} className="text-slate-500" />}</div><div className="rounded-[8px] border border-dashed border-white/10 bg-black/10 p-3"><p className="text-xs font-black uppercase tracking-[.12em] text-slate-500">Profil önizleme alanı</p><p className="mt-2 text-sm font-bold text-white">{item.username || `${item.platform} bilgisi bekleniyor`}</p><p className="mt-1 break-all text-xs text-slate-400">{item.profileUrl || "Profil URL girilmedi"}</p><p className="mt-2 text-xs leading-5 text-slate-500">Profil verileri sınırlı. Girilen bilgiler ve ekran görüntüleriyle analiz yapılacak.</p>{item.profileUrl && <a href={item.profileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex rounded-full border border-cyan-200/20 px-3 py-1 text-xs font-black text-cyan-100">Profil aç</a>}</div></div></div>)}</div><div className="mt-5 rounded-[8px] border border-white/10 bg-white/[0.035] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-black text-white">Ekran Görüntüsü Yükle</p><p className="mt-1 text-xs text-slate-400">PNG, JPG, JPEG veya WEBP formatında birden fazla dosya yükleyebilirsiniz.</p></div><label className="cursor-pointer rounded-full bg-yellow-300 px-4 py-2 text-sm font-black text-slate-950"><input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" multiple className="hidden" onChange={(event) => addScreenshots(event.target.files)} />Ekran Görüntüsü Yükle</label></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{screenshots.map((shot, index) => <div key={shot.id} className="rounded-[8px] border border-white/10 bg-black/15 p-3"><img src={shot.url} alt={shot.name} className="h-28 w-full rounded-[6px] object-cover" /><p className="mt-2 truncate text-xs font-bold text-white">{shot.name}</p><div className="mt-2 flex gap-2"><a href={shot.url} target="_blank" rel="noreferrer" className="rounded-full border border-cyan-200/20 px-3 py-1 text-xs text-cyan-100">Görüntüle</a><button onClick={() => moveScreenshot(index, -1)} className="rounded-full border border-white/10 px-2 text-slate-300"><ArrowUp size={14} /></button><button onClick={() => moveScreenshot(index, 1)} className="rounded-full border border-white/10 px-2 text-slate-300"><ArrowDown size={14} /></button><button onClick={() => setScreenshots(screenshots.filter((current) => current.id !== shot.id))} className="rounded-full border border-red-300/20 px-2 text-red-200"><Trash2 size={14} /></button></div></div>)}{!screenshots.length && <p className="rounded-[8px] border border-dashed border-white/10 p-5 text-sm text-slate-400 xl:col-span-4">Yüklü ekran görüntüsü yok.</p>}</div></div><div className="mt-5 rounded-[8px] border border-white/10 bg-white/[0.035] p-4"><p className="text-sm font-black text-white">Analiz aksiyonları</p><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{socialAuditActions.map((action) => <label key={action} className={`flex min-h-12 items-center gap-2 rounded-[8px] border px-3 text-xs font-black transition ${actions.includes(action) ? "border-yellow-200/40 bg-yellow-300/10 text-yellow-100" : "border-white/10 text-slate-400"}`}><input type="checkbox" checked={actions.includes(action)} onChange={() => toggleAction(action)} />{action}</label>)}</div><div className="mt-4 flex flex-wrap gap-2"><button disabled={loading || !actions.filter((action) => action !== "CRM’e Kaydet").length || !hasInput} onClick={runAudit} className="rounded-full bg-yellow-300 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60">{loading ? "Analiz ediliyor..." : "Seçili aksiyonları oluştur"}</button>{actions.includes("CRM’e Kaydet") && <button disabled={crmSaving || (!outputs.length && !hasInput)} onClick={saveToCrm} className="rounded-full border border-yellow-200/30 px-5 py-3 text-sm font-black text-yellow-100 disabled:opacity-60">{crmSaving ? "CRM’e kaydediliyor..." : "CRM’e Kaydet"}</button>}{pdfOutput && <button onClick={downloadMiniAuditPdf} className="rounded-full border border-cyan-200/25 px-5 py-3 text-sm font-black text-cyan-100">PDF Audit Oluştur</button>}{whatsappOutput && <a href={`https://wa.me/?text=${encodeURIComponent(whatsappText())}`} target="_blank" rel="noreferrer" className="rounded-full border border-emerald-200/25 px-5 py-3 text-sm font-black text-emerald-100">WhatsApp’ta Aç</a>}{whatsappOutput && <button onClick={() => navigator.clipboard?.writeText(whatsappText())} className="rounded-full border border-white/10 px-5 py-3 text-sm font-black text-slate-200">Mesajı Kopyala</button>}</div></div>{leadScore && <div className={`mt-4 rounded-[8px] border p-4 ${leadScore.temperature === "Sıcak" ? "border-red-300/25 bg-red-300/10 text-red-100" : leadScore.temperature === "Ilık" ? "border-amber-300/25 bg-amber-300/10 text-amber-100" : "border-slate-300/20 bg-slate-300/10 text-slate-100"}`}><p className="text-xs font-black uppercase tracking-[.16em]">Lead Score</p><p className="mt-2 text-2xl font-black">{leadScore.score}/100 · {leadScore.temperature}</p><p className="mt-2 text-sm opacity-80">Skor; website/profil URL, platform sayısı, ekran görüntüsü, teklif ihtiyacı ve ticari fırsat sinyallerinden hesaplandı.</p></div>}{message && <p className="mt-4 rounded-[8px] border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-100">{message}</p>}{crmMessage && <p className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-100">{crmMessage}</p>}<div className="mt-5 grid gap-4">{outputs.map((item) => <div key={item.action} className="rounded-[8px] border border-white/10 bg-white/[0.045] p-5"><p className="text-xs font-black uppercase tracking-[.16em] text-yellow-200">{item.action}</p><AiUsageBadge meta={item.ai} /><pre className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-200">{item.text}</pre></div>)}{!loading && !outputs.length && <p className="rounded-[8px] border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">Sosyal istihbarat çıktısı için profil, ekran görüntüsü veya işletme bilgisi girip aksiyon seçin.</p>}</div></Panel>;
}

function ChannelAnalysis({ content, channel }: any) {
  const [companyId, setCompanyId] = useState("");
  const [goal, setGoal] = useState(channel === "Meta" ? "Mesaj ve form talebi" : "Arama niyeti ve dönüşüm");
  const [observation, setObservation] = useState("");
  const [result, setResult] = useState("");
  function analyze() {
    const company = (content.companies || []).find((item) => item.id === companyId);
    if (!company) return setResult("Analiz için firma seçin.");
    setResult(channel === "Meta"
      ? `${company.name} için Meta analiz özeti:\n\n- Reklam sinyalleri, hedef kitle ve teklif uyumu birlikte değerlendirilmelidir.\n- Üst huni görünürlük içerikleri ile yeniden pazarlama akışı ayrıştırılmalıdır.\n- Mesaj ve form dönüşümleri haftalık olarak izlenmeli, kreatif testleri kontrollü ilerletilmelidir.\n- Gözlem: ${observation || "Rakip kreatifleri ve teklif dili periyodik olarak incelenmeli."}\n\nSatış garantisi verilmez; sonuçlar sektör, bütçe, teklif ve rekabet koşullarına göre değişebilir.`
      : `${company.name} için Google analiz özeti:\n\n- Arama niyeti yüksek anahtar kelimeler hizmet ve lokasyon bazında gruplanmalıdır.\n- Reklam metni, açılış sayfası ve dönüşüm ölçümlemesi aynı hedefe bağlanmalıdır.\n- Yerel aramalarda konum, arama terimleri ve negatif kelimeler düzenli incelenmelidir.\n- Gözlem: ${observation || "İlk kampanya sonrasında arama terimleri raporu ile optimizasyon yapılmalı."}\n\nSatış garantisi verilmez; performans ölçümleme ve düzenli optimizasyonla yönetilir.`);
  }
  return <Panel title={`${channel} Analiz`}>
    <p className="mb-5 text-sm leading-6 text-slate-400">{channel === "Meta" ? "Meta reklam fırsatlarını, funnel yapısını ve kampanya önerilerini müşteri bazında değerlendirin." : "Google Ads fırsatlarını, arama niyetini ve yerel reklam önerilerini müşteri bazında değerlendirin."}</p>
    <div className="grid gap-4 md:grid-cols-2"><CompanySelect value={companyId} onChange={setCompanyId} companies={content.companies} /><Field label="Analiz hedefi" value={goal} onChange={setGoal} /><div className="md:col-span-2"><TextArea label="Gözlem ve araştırma notu" value={observation} onChange={setObservation} /></div></div>
    <button type="button" onClick={analyze} className="mt-5 rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">Analiz özeti oluştur</button>
    {result && <pre className="mt-5 whitespace-pre-wrap rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-4 text-sm leading-7 text-cyan-50">{result}</pre>}
  </Panel>;
}

function ProposalEngine({ content }: any) {
  const [leadId, setLeadId] = useState("");
  const [anchor, setAnchor] = useState("10000");
  const [result, setResult] = useState("");
  function generate() {
    const lead = (content.leads || []).find((item) => item.id === leadId);
    if (!lead) return setResult("Teklif hazırlamak için bir başvuru seçin.");
    const base = Number(anchor || 10000);
    setResult(`${lead.company || lead.name || "İşletme"} için teklif yaklaşımı\n\nMIN Paket · ${base.toLocaleString("tr-TR")} TL + KDV\nTemel reklam kurulumu, ölçümleme kontrolü ve aylık optimizasyon.\n\nORTA Paket · ${Math.round(base * 1.5).toLocaleString("tr-TR")} TL + KDV\nFarkındalık, trafik ve yeniden pazarlama adımlarını içeren düzenli performans yönetimi.\n\nMAX Paket · ${Math.round(base * 2.2).toLocaleString("tr-TR")} TL + KDV\nÇok kanallı kampanya planı, CRM destekli takip, raporlama ve kapsamlı funnel optimizasyonu.\n\nBeklenti yönetimi: Reklam bütçesi hizmet bedeline dahil değildir. Satış garantisi verilmez. Sonuçlar sektör, bütçe, hedef kitle, teklif ve rekabet koşullarına göre değişebilir.`);
  }
  return <Panel title="Teklif Motoru">
    <p className="mb-5 text-sm leading-6 text-slate-400">CRM başvurularından MIN, ORTA ve MAX hizmet yaklaşımı hazırlayın. Başlangıç referansı aylık 10.000 TL hizmet bedelidir; nihai kapsam müşteri ihtiyacına göre netleştirilir.</p>
    <div className="grid gap-4 md:grid-cols-2"><SelectField label="Başvuru" value={leadId} onChange={setLeadId} options={(content.leads || []).map((lead) => ({ value: lead.id, label: lead.company || lead.name || lead.email || "İsimsiz başvuru" }))} placeholder="Başvuru seçin" /><Field label="Aylık hizmet bedeli referansı" type="number" value={anchor} onChange={setAnchor} /></div>
    <button type="button" onClick={generate} className="mt-5 rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">Teklif yaklaşımı oluştur</button>
    {result && <div className="mt-5 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-4"><AiUsageBadge meta={{ provider: "Yerel Mod", model: "proposal-rules", mode: "Yerel", isLocal: true, badge: "Yerel modda üretildi" }} /><pre className="mt-4 whitespace-pre-wrap text-sm leading-7 text-cyan-50">{result}</pre><button type="button" onClick={() => navigator.clipboard.writeText(result)} className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-100/20 px-4 py-2 text-sm text-cyan-50"><Copy size={15} /> Kopyala</button></div>}
  </Panel>;
}

function TrackingSettings(props: any) {
  return <Settings {...props} />;
}

function UsageGuide() {
  const [query, setQuery] = useState("");
  const sections = [
    ["sistem-genel-bakis", "Sistem Genel Bakış", ["Dashboard açıldığında servis durumlarını kontrol edin.", "Sıcak başvuruları ve takip bekleyen işleri inceleyin.", "Hızlı aksiyon merkezinden sık kullandığınız modüle geçin."]],
    ["crm-kullanimi", "CRM Kullanımı", ["CRM bölümünü açın.", "Başvuruyu kaynak, durum ve iletişim bilgileriyle inceleyin.", "Takip tarihini ve dahili notları güncelleyin."]],
    ["isletme-kesfi-kullanimi", "İşletme Keşfi Kullanımı", ["Müşteri Bulucu bölümüne gidin.", "Anahtar kelime, şehir, ilçe ve sektör bilgilerini girin.", "Uygun işletmeleri seçip CRM'e kaydedin."]],
    ["haritalar-modulu-kullanimi", "Haritalar Modülü Kullanımı", ["Google Maps API durumunun aktif olduğunu Dashboard üzerinden doğrulayın.", "Müşteri Bulucu içindeki arama alanlarını kullanın.", "Telefon, web sitesi, puan ve değerlendirme sayısına göre fırsatları önceliklendirin."]],
    ["meta-analiz-kullanimi", "Meta Analiz Kullanımı", ["Meta Analiz bölümünden işletmeyi değerlendirin.", "Reklam sinyallerini ve müşteri yolculuğu önerilerini inceleyin.", "Uygun önerileri CRM notlarına taşıyın."]],
    ["google-analiz-kullanimi", "Google Analiz Kullanımı", ["Google Analiz bölümünü açın.", "Arama niyeti ve yerel reklam fırsatlarını inceleyin.", "Anahtar kelime önerilerini teklif hazırlığında kullanın."]],
    ["ai-studio-kullanimi", "AI Studio Kullanımı", ["AI Studio bölümünde ihtiyacınıza uygun üretim türünü seçin.", "İşletme bilgisini net ve kısa biçimde girin.", "Oluşan metni müşteriye göndermeden önce gözden geçirin."]],
    ["hazirlik-merkezi-kullanimi", "Hazırlık Merkezi Kullanımı", ["Dashboard içgörülerini günlük çalışma listeniz gibi kullanın.", "Eksik AI analizlerini ve raporu olmayan müşterileri tamamlayın.", "Tamamlanan işleri aktivite akışından kontrol edin."]],
    ["teklif-motoru-kullanimi", "Teklif Motoru Kullanımı", ["Teklif Motoru bölümünü açın.", "CRM'den başvuruyu seçin.", "MIN, ORTA ve MAX yaklaşımını oluşturup ihtiyaca göre düzenleyin."]],
    ["raporlama-kullanimi", "Raporlama Kullanımı", ["Raporlar bölümünde firma ve rapor türünü seçin.", "Meta, Google Ads, sosyal medya veya genel performans bilgilerini girin.", "Müşteriye görünür notu ekleyip raporu kaydedin."]],
    ["kullanici-yonetimi", "Kullanıcı Yönetimi", ["Kullanıcılar bölümünden hesapları listeleyin.", "Rol, bağlı firma ve aktiflik durumunu kontrol edin.", "Şifre sıfırlama gerektiğinde güvenli geçici şifre akışını kullanın."]],
    ["roller-ve-yetkiler", "Roller ve Yetkiler", ["Yönetici tam yetkilidir.", "Editör site içeriklerini yönetir.", "Satış ekibi CRM sürecini yönetir; müşteri yalnızca kendi panelini görür."]],
    ["tema-ayarlari", "Tema Ayarları", ["Üst çubuktaki tema düğmesini kullanın.", "Karanlık veya aydınlık temayı seçin.", "Tercihiniz bu tarayıcıda otomatik saklanır."]],
    ["api-ayarlari", "API Ayarları", ["API Ayarları bölümünü açın.", "Servis bilgilerini sunucu ortam değişkenlerinden yönetin.", "Özel anahtarları tarayıcıya veya müşteriyle paylaşılan ekranlara yazmayın."]],
    ["sik-sorulan-sorular", "Sık Sorulan Sorular", ["Bir grafik boşsa ilgili modülde henüz yeterli kayıt yoktur.", "Google Maps araması çalışmıyorsa API anahtarı durumunu kontrol edin.", "Kalıcı kayıt sorunu varsa Supabase durumunu ve Vercel ortam değişkenlerini inceleyin."]]
  ];
  const filtered = sections.filter(([, title, items]) => `${title} ${items.join(" ")}`.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")));
  return (
    <Panel title="Kullanım Kılavuzu">
      <div className="mb-5 rounded-[8px] border border-cyan-200/15 bg-cyan-200/[0.05] p-4">
        <p className="text-sm font-black text-cyan-50">HK Dijital çalışma rehberi</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">İhtiyacınız olan ekranı veya işlemi arayın. Her başlık temel adımları kısa ve anlaşılır biçimde açıklar.</p>
        <label className="mt-4 flex min-h-11 items-center gap-2 rounded-[8px] border border-white/10 bg-black/20 px-3">
          <Search size={16} className="text-cyan-200" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Kılavuzda ara..." className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
        </label>
      </div>
      <div className="grid gap-4">
        {filtered.map(([id, title, items]) => (
          <div id={id} key={id} className="scroll-mt-28 rounded-[8px] border border-white/10 bg-black/20 p-4">
            <h3 className="font-black">{title}</h3>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-300">{items.map((item) => <li key={item} className="flex gap-2"><span className="text-cyan-200">-</span><span>{item}</span></li>)}</ul>
          </div>
        ))}
        {!filtered.length && <p className="rounded-[8px] border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">Aramanızla eşleşen bir kılavuz başlığı bulunamadı.</p>}
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
