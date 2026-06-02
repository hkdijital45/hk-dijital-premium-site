"use client";
// @ts-nocheck

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowDown, ArrowUp, BarChart3, Bell, Bot, Building2, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, CircleOff, Copy, Download, FileBarChart, Gauge, GripVertical, HelpCircle, ImagePlus, LayoutDashboard, LogOut, MapPinned, MessageSquareText, Plus, RotateCcw, Save, Search, Settings2, Sparkles, Star, Trash2, UsersRound, WandSparkles, X } from "lucide-react";
import type { SiteContent } from "@/lib/types";
import { ReportTools } from "@/components/admin/reports/ReportTools";
import { adminNavigationGroups, adminNavigationItems, getAdminHref } from "@/lib/admin-navigation";
import { GlassCard, MetricCard3D } from "@/components/premium/PremiumUI";

const leadStatuses = ["Yeni", "Görüşülecek", "Teklif Hazırlanıyor", "Teklif Gönderildi", "Takipte", "Kazanıldı", "Kaybedildi", "Dönüştürüldü"];
const leadSourceOptions = ["İletişim Formu", "Teklif Formu", "Teklif Sihirbazı", "Müşteri Bulucu", "Instagram", "WhatsApp", "Referans", "Manuel Giriş", "Diğer"];
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
  ["Reklam Zekâsı", ["meta-analiz", "google-analiz", "funnel-analizi", "reklam-firsatlari"]],
  ["Hazırlık & Üretim", ["hazirlik", "ai-studio", "icerik-onerileri", "prompt-kutuphanesi", "kampanya-hazirligi"]],
  ["Teklif & Raporlama", ["teklifler", "teklif-listesi", "raporlar", "rapor-yorumlari", "disa-aktarimlar"]],
  ["Yönetim", ["kullanicilar", "roller-yetkiler", "site-ayarlari", "api-ayarlari", "tema-ayarlari", "medya", "sistem-loglari"]]
];
const uiRoleTemplates = {
  admin: uiPermissionGroups.flatMap(([, modules]) => modules),
  yonetici: ["dashboard", "genel-arama", "kullanim-kilavuzu", "crm", "leads", "musteriler", "takip-gorevleri", "notlar", "musteri-bulucu", "haritalar", "bolgesel-analiz", "kaydedilen-adaylar", "hazirlik", "ai-studio", "teklifler", "teklif-listesi", "raporlar", "rapor-yorumlari", "disa-aktarimlar"],
  editor: ["dashboard", "genel-arama", "kullanim-kilavuzu", "crm", "leads", "hazirlik", "ai-studio", "icerik-onerileri", "prompt-kutuphanesi", "kampanya-hazirligi", "teklifler", "teklif-listesi", "raporlar", "rapor-yorumlari", "disa-aktarimlar", "medya"],
  musteri: []
};
const legacyRole = (role) => role === "sales" ? "yonetici" : role === "customer" ? "musteri" : role;
const customerRole = (role) => ["customer", "musteri"].includes(role);
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
const socialPlatforms = ["Instagram", "Facebook", "TikTok", "LinkedIn", "YouTube", "Diğer"];

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

  const props = { content, setContent, currentSession };
  const visibleNavigationGroups = adminNavigationGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => allowedModules.includes(item.module)) }))
    .filter((group) => group.items.length);
  const shellClass = theme === "dark" ? "bg-[#050711] text-white" : "bg-slate-100 text-slate-950";
  const panelClass = theme === "dark" ? "border-white/10 bg-white/[0.045]" : "border-slate-200 bg-white";
  const headerClass = theme === "dark" ? "border-white/10 bg-[#050711]/90" : "border-slate-200 bg-white/90";

  return (
    <main className={`relative min-h-screen overflow-hidden ${theme === "light" ? "admin-light" : ""} ${shellClass}`} style={customTheme ? { backgroundColor: customTheme.background, color: customTheme.text } : undefined}>
      <div className="premium-grid pointer-events-none absolute inset-0 opacity-45" />
      <header className={`sticky top-0 z-40 border-b ${headerClass} shadow-[0_16px_48px_rgba(0,0,0,.18)] backdrop-blur-2xl`}>
        <div className="relative mx-auto flex max-w-[1540px] flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 text-cyan-100"><LayoutDashboard size={20} /></span>
            <div>
            <p className="text-xs font-bold uppercase tracking-[.22em] text-cyan-200">Digital Marketing Command Center</p>
            <h1 className="text-xl font-black sm:text-2xl">HK Operating System</h1>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Powered by HK Dijital</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
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
          {!sidebarCollapsed && <div className="mb-3 rounded-[8px] border border-cyan-200/15 bg-cyan-200/[0.06] p-3"><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-100">HK Operating System</p><p className="mt-2 text-xs leading-5 text-slate-400">CRM, analiz ve raporlama araçları tek komuta merkezinde.</p></div>}
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
          {active === "Meta Analiz" && <ChannelAnalysis {...props} channel="Meta" />}
          {active === "Google Analiz" && <ChannelAnalysis {...props} channel="Google" />}
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

const dashboardWidgetDefaults = ["metrics", "status", "charts", "insights", "quickActions", "crm", "activity", "demo"];

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

function Overview({ content, setActive, supabaseConfigured, systemStatus = {}, currentSession, allowedModules = [] }: any) {
  const leads = content.leads ?? [];
  const companies = content.companies ?? [];
  const campaigns = content.campaigns ?? [];
  const metrics = content.campaignMetrics ?? [];
  const updates = content.customerUpdates ?? [];
  const users = content.users ?? [];
  const reports = content.reports ?? [];
  const activityLogs = content.activityLogs ?? [];
  const [demoMessage, setDemoMessage] = useState("");
  const [demoLoading, setDemoLoading] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const preferenceKey = `hk-dashboard-preferences:${currentSession?.id || currentSession?.userId || "admin"}`;
  const [preferences, setPreferences] = useState({ order: dashboardWidgetDefaults, hidden: [], favorites: ["Müşteri Bulucu", "CRM"] });
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

  const stats = [
    ["Toplam başvuru", leads.length, "CRM içindeki tüm potansiyel müşteriler", <UsersRound size={17} />],
    ["Sıcak başvurular", hotLeads.length, "Fırsat skoru 70 ve üzeri kayıtlar", <Gauge size={17} />],
    ["Aktif müşteriler", activeCustomers.length, "Hizmeti devam eden firmalar", <Building2 size={17} />],
    ["Hazırlanan raporlar", reports.length, "Müşteri paneline bağlı raporlar", <FileBarChart size={17} />],
    ["Hazırlanan teklifler", generatedProposals, "CRM teklif geçmişi kayıtları", <MessageSquareText size={17} />],
    ["AI analizleri", aiAnalyzedLeads.length, "Yapay zeka ile yorumlanan başvurular", <Bot size={17} />],
    ["CRM hareketleri", activityLogs.length, "Kaydedilen operasyon hareketleri", <Activity size={17} />],
    ["Bu ay reklam harcaması", `${metricsThisMonth.reduce((sum, metric) => sum + Number(metric.spent || 0), 0).toLocaleString("tr-TR")} TL`, "Reklam metriklerinden hesaplanan toplam", <BarChart3 size={17} />]
  ];
  const moduleAliases: Record<string, string> = { "Müşteri Bulucu": "musteri-bulucu" };
  const canOpen = (label: string) => allowedModules.includes(moduleAliases[label] || adminNavigationItems.find((item) => item.label === label)?.module);
  const quickActions = [
    ["Yeni İşletme Ara", "Müşteri Bulucu", <Search size={19} />],
    ["CRM Aç", "CRM", <UsersRound size={19} />],
    ["Haritalar Aç", "Haritalar", <MapPinned size={19} />],
    ["AI Analiz Oluştur", "Lead Yönetimi", <WandSparkles size={19} />],
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
    ["Hazırlık Merkezi", "Kampanya hazırlığını tamamlayın", "Operasyon listesi", "Hazırlık Merkezi", "", <CircleCheck size={24} />],
    ["Teklif Motoru", "MIN, ORTA ve MAX teklifleri hazırlayın", `${generatedProposals} teklif`, "Teklif Motoru", "", <MessageSquareText size={24} />],
    ["Raporlar", "Müşteri performansını sunun", `${reports.length} rapor`, "Raporlar", "", <FileBarChart size={24} />],
    ["Müşteriler", "Aktif hesapları yönetin", `${activeCustomers.length} aktif`, "Müşteriler", "", <Building2 size={24} />]
  ].filter(([, , , target]) => canOpen(target));
  const dashboardPresets = {
    "CRM Focus": { order: ["metrics", "insights", "crm", "quickActions", "activity", "status", "charts", "demo"], hidden: ["charts"], favorites: ["CRM", "Lead Yönetimi", "Müşteriler"] },
    "Sales Focus": { order: ["insights", "metrics", "quickActions", "crm", "activity", "status", "charts", "demo"], hidden: ["demo"], favorites: ["Müşteri Bulucu", "Teklif Motoru", "CRM"] },
    "AI Focus": { order: ["insights", "quickActions", "metrics", "charts", "activity", "status", "crm", "demo"], hidden: ["demo"], favorites: ["AI Studio", "Lead Yönetimi", "Hazırlık Merkezi"] },
    "Reporting Focus": { order: ["charts", "metrics", "insights", "quickActions", "activity", "status", "crm", "demo"], hidden: ["crm"], favorites: ["Raporlar", "Müşteriler"] },
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

  const widgetNames = { metrics: "Sistem metrikleri", status: "Sistem durum merkezi", charts: "Gerçek veri grafikleri", insights: "AI içgörüleri", quickActions: "Hızlı aksiyonlar", crm: "CRM akışı", activity: "Son aktiviteler", demo: "Müşteri paneli testi" };
  const widgets: any = {
    metrics: <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{stats.map(([label, value, note, icon], index) => <MetricCard3D key={label} label={label} value={value} note={note} accent={index % 3 === 1 ? "amber" : index % 3 === 2 ? "blue" : "cyan"} icon={icon} />)}</div>,
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
  const [sectorFilter, setSectorFilter] = useState("");
  const [budgetFilter, setBudgetFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedLead, setSelectedLead] = useState(null);
  const leads = (content.leads ?? [])
    .filter((lead) => JSON.stringify(lead).toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")))
    .filter((lead) => !sourceFilter || lead.source === sourceFilter)
    .filter((lead) => !statusFilter || lead.status === statusFilter)
    .filter((lead) => !sectorFilter || (lead.business_type || lead.businessType) === sectorFilter)
    .filter((lead) => !budgetFilter || lead.budget === budgetFilter)
    .filter((lead) => !dateFrom || String(lead.created_at || lead.createdAt || "").slice(0, 10) >= dateFrom)
    .filter((lead) => !dateTo || String(lead.created_at || lead.createdAt || "").slice(0, 10) <= dateTo)
    .filter((lead) => view !== "Teklif Sihirbazı Kayıtları" || ["quote", "Teklif Formu", "Teklif Sihirbazı"].includes(lead.source));
  const update = (id, patch) => setContent({ ...content, leads: content.leads.map((lead) => (lead.id === id ? { ...lead, ...patch } : lead)) });
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
      <div className="grid gap-3">
        {leads.map((lead) => (
          <button key={lead.id} onClick={() => setSelectedLead(lead)} className="rounded-[8px] border border-white/10 p-4 text-left transition hover:border-cyan-200/40 hover:bg-cyan-200/5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="font-black">{lead.name || "İsimsiz başvuru"}</h3><p className="mt-1 text-sm text-slate-400">{lead.source || "Form"} · {lead.company || "-"} · {lead.phone || lead.email || "-"}</p></div>
              <span className="rounded-full bg-cyan-200/10 px-3 py-1 text-xs font-bold text-cyan-100">{lead.status || "Yeni"}</span>
            </div>
            <p className="mt-3 text-sm text-slate-300">İşletme: {lead.business_type || lead.businessType || "-"} · Hedef: {lead.goal || "-"} · Bütçe: {lead.budget || "-"}</p>
            <p className="mt-1 text-xs text-slate-500">Önerilen paket: {lead.recommended_package || lead.recommendedPackage || "-"} · Gönderim: {formatDate(lead.created_at || lead.createdAt)}</p>
          </button>
        ))}
        {!leads.length && <p className="text-sm text-slate-400">Başvuru bulunamadı.</p>}
      </div>
      {selectedLead && <LeadDrawer lead={selectedLead} update={update} close={() => setSelectedLead(null)} onConverted={(data) => {
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

function LeadDrawer({ lead, update, close, onConverted }: any) {
  const [conversionMessage, setConversionMessage] = useState("");
  const [conversionError, setConversionError] = useState("");
  const [converting, setConverting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState("");
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
        <button onClick={convert} disabled={converting || lead.status === "Dönüştürüldü"} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-60">{converting ? "Dönüştürülüyor..." : lead.status === "Dönüştürüldü" ? "Müşteriye dönüştürüldü" : "Başvuruyu müşteriye dönüştür"}</button>
        <button onClick={() => update(lead.id, { status: "Takipte", follow_up_date: lead.follow_up_date || new Date().toISOString().slice(0, 10) })} className="rounded-full border border-white/10 px-4 py-2 text-sm">Takip görevi oluştur</button>
        <button onClick={analyze} disabled={analyzing || String(lead.id).startsWith("lead-")} className="inline-flex items-center gap-2 rounded-full border border-cyan-200/30 px-4 py-2 text-sm font-bold text-cyan-100 disabled:opacity-50"><Sparkles size={15} /> {analyzing ? "Analiz hazırlanıyor..." : "AI analizi oluştur"}</button>
        {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer" className="rounded-full bg-[#25D366] px-4 py-2 text-sm font-black text-white">WhatsApp mesajı gönder</a>}
      </div>
      {analysisMessage && <p className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-100">{analysisMessage}</p>}
      {lead.ai_analysis?.text && <div className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-4"><h3 className="font-black text-cyan-50">HK Intelligence AI Analizi</h3><pre className="mt-3 whitespace-pre-wrap text-sm leading-7 text-cyan-50">{lead.ai_analysis.text}</pre><p className="mt-3 text-xs text-cyan-100/70">{lead.ai_analysis.provider || "Demo"} · {formatDateTime(lead.ai_analysis.generated_at)}</p></div>}
      {conversionMessage && <p className="mt-4 rounded-[8px] border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">{conversionMessage}</p>}
      {conversionError && <p className="mt-4 rounded-[8px] border border-red-300/20 bg-red-500/10 p-3 text-sm text-red-100">{conversionError}</p>}
    </Drawer>
  );
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
  return <Panel title="API Ayarları"><p className="mb-5 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm leading-6 text-cyan-50">API anahtarları güvenlik nedeniyle bu ekranda gösterilmez veya tarayıcıya gönderilmez. Gemini, Groq, OpenAI ve Google Maps anahtarlarını Vercel ortam değişkenleri üzerinden yönetin.</p><div className="grid gap-4 md:grid-cols-2"><Field label="Model seçimi" value={api.model} onChange={(v) => update({ model: v })} /><OtherSelectField label="Aktif sağlayıcı" value={api.activeProvider} onChange={(v) => update({ activeProvider: v })} options={apiProviderOptions} manualLabel="Sağlayıcıyı yazın" /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={api.demoMode} onChange={(e) => update({ demoMode: e.target.checked })} /> Demo modu</label></div><button onClick={testApi} className="mt-5 rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">API bağlantısını test et</button>{result && <p className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-100">{result}</p>}<p className="mt-4 text-sm text-slate-400">Sunucu tarafı değişkenleri: GOOGLE_MAPS_API_KEY, GEMINI_API_KEY, GROQ_API_KEY ve OPENAI_API_KEY. Kullanılmayan AI sağlayıcılarının anahtarlarını eklemek zorunda değilsiniz.</p></Panel>;
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
      {(content.reportInterpretations || []).filter((item) => item.report_id === report.id).map((item) => <div key={item.id} className="rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm leading-6 text-cyan-50">{item.interpretation_text}<p className="mt-2 text-xs text-cyan-100/70">{item.provider} · {formatDateTime(item.created_at)}</p></div>)}
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

function CustomerFinder({ content, setContent }: any) {
  const [search, setSearch] = useState({ keyword: "", city: "Manisa", district: "", sector: "" });
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");
  async function runSearch() {
    setLoading("search");
    setMessage("Google Maps üzerinde işletmeler aranıyor...");
    const response = await fetch("/api/admin/business-discovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(search) });
    const data = await response.json().catch(() => ({}));
    setLoading("");
    if (!response.ok) return setMessage(data.error || "İşletme araması başarısız oldu.");
    setResults(data.businesses || []);
    setSelected([]);
    setMessage(data.count ? `${data.count} işletme bulundu. CRM listesine eklemek istediklerinizi seçin.` : "Arama kriterlerine uygun işletme bulunamadı.");
  }
  async function saveSelected() {
    if (!selected.length) return setMessage("CRM listesine eklemek için en az bir işletme seçin.");
    setLoading("save");
    setMessage("Seçilen işletmeler CRM listesine kaydediliyor...");
    const businesses = results.filter((business) => selected.includes(business.placeId));
    const response = await fetch("/api/admin/business-discovery", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businesses, sector: search.sector }) });
    const data = await response.json().catch(() => ({}));
    setLoading("");
    if (!response.ok) return setMessage(data.supabaseError ? `${data.error}: ${data.supabaseError}` : data.error || "İşletmeler kaydedilemedi.");
    setContent({ ...content, leads: [...(data.leads || []), ...(content.leads || [])] });
    setSelected([]);
    setMessage(data.skipped ? `${data.message} ${data.skipped} kayıt daha önce eklenmiş.` : data.message);
  }
  return <Panel title="Müşteri Bulucu">
    <p className="mb-5 text-sm leading-6 text-slate-400">Google Maps üzerinden yerel işletmeleri bulun, temel dijital sinyalleri inceleyin ve uygun adayları skorlarıyla birlikte CRM listesine aktarın.</p>
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Anahtar kelime" value={search.keyword} onChange={(value) => setSearch({ ...search, keyword: value })} />
      <OtherSelectField label="Sektör" value={search.sector} onChange={(value) => setSearch({ ...search, sector: value })} options={sectorOptions} manualLabel="Sektörü yazın" />
      <OtherSelectField label="Şehir" value={search.city} onChange={(value) => setSearch({ ...search, city: value })} options={cityOptions} manualLabel="Şehri yazın" />
      <Field label="İlçe" value={search.district} onChange={(value) => setSearch({ ...search, district: value })} />
    </div>
    <button type="button" disabled={loading === "search"} onClick={runSearch} className="mt-5 rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60">{loading === "search" ? "Aranıyor..." : "Google Maps üzerinde ara"}</button>
    {message && <p className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-100">{message}</p>}
    {!!results.length && <div className="mt-5 grid gap-3">
      {results.map((business) => <label key={business.placeId} className={`flex cursor-pointer gap-3 rounded-[8px] border p-4 ${selected.includes(business.placeId) ? "border-cyan-200/60 bg-cyan-200/10" : "border-white/10 bg-black/20"}`}>
        <input type="checkbox" checked={selected.includes(business.placeId)} onChange={(event) => setSelected(event.target.checked ? [...selected, business.placeId] : selected.filter((id) => id !== business.placeId))} />
        <span><strong>{business.name}</strong><span className="mt-1 block text-sm text-slate-400">{business.address || "Adres bilgisi yok"}</span><span className="mt-2 block text-xs text-slate-500">{business.phone || "Telefon bilgisi yok"} · {business.website ? "Web sitesi var" : "Web sitesi yok"} · Google puanı: {business.googleRating ?? "-"} · Yorum: {business.reviewCount || 0}</span></span>
      </label>)}
      <button type="button" disabled={loading === "save"} onClick={saveSelected} className="w-fit rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60">{loading === "save" ? "Kaydediliyor..." : `Seçilenleri CRM listesine ekle (${selected.length})`}</button>
    </div>}
  </Panel>;
}

function MapsIntelligence({ content, setContent, setActive, mode = "Haritalar" }: any) {
  const [filters, setFilters] = useState({ city: "", district: "", sector: "", status: "", heat: "", maturity: "" });
  const [message, setMessage] = useState("");
  const leads = (content.leads || []).filter((lead) => lead.google_place_id || lead.address)
    .filter((lead) => !filters.city || String(lead.address || "").toLocaleLowerCase("tr").includes(filters.city.toLocaleLowerCase("tr")))
    .filter((lead) => !filters.district || String(lead.address || "").toLocaleLowerCase("tr").includes(filters.district.toLocaleLowerCase("tr")))
    .filter((lead) => !filters.sector || lead.business_type === filters.sector)
    .filter((lead) => !filters.status || lead.status === filters.status)
    .filter((lead) => !filters.heat || Number(lead.lead_heat_score || 0) >= Number(filters.heat))
    .filter((lead) => !filters.maturity || Number(lead.digital_maturity_score || 0) >= Number(filters.maturity));
  function update(id, patch) {
    setContent({ ...content, leads: (content.leads || []).map((lead) => lead.id === id ? { ...lead, ...patch } : lead) });
    setMessage("Not güncellendi. Kalıcı kayıt için üst çubuktaki Kaydet düğmesini kullanın.");
  }
  async function analyze(lead) {
    setMessage("AI analizi hazırlanıyor...");
    const response = await fetch(`/api/admin/leads/${lead.id}/analyze`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      update(lead.id, { ai_analysis: data.analysis });
      setMessage("AI analizi oluşturuldu.");
    } else setMessage(data.error || "AI analizi oluşturulamadı.");
  }
  return <Panel title={mode === "Haritalar" ? "Harita Zekâsı" : mode}><p className="mb-5 text-sm leading-6 text-slate-400">Kaydedilen yerel işletmeleri bölge, sektör ve fırsat skorlarıyla inceleyin. Harita görünümü genişletilmeye hazır liste tabanlı istihbarat yapısı kullanır.</p><div className="grid gap-3 md:grid-cols-3"><Field label="Şehir" value={filters.city} onChange={(city) => setFilters({ ...filters, city })} /><Field label="İlçe" value={filters.district} onChange={(district) => setFilters({ ...filters, district })} /><OtherSelectField label="Sektör" value={filters.sector} onChange={(sector) => setFilters({ ...filters, sector })} options={sectorOptions} manualLabel="Sektörü yazın" /><SelectField label="Durum" value={filters.status} onChange={(status) => setFilters({ ...filters, status })} options={leadStatuses} placeholder="Tüm durumlar" /><Field label="Minimum sıcaklık skoru" type="number" value={filters.heat} onChange={(heat) => setFilters({ ...filters, heat })} /><Field label="Minimum dijital olgunluk" type="number" value={filters.maturity} onChange={(maturity) => setFilters({ ...filters, maturity })} /></div>{message && <p className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-100">{message}</p>}<div className="mt-5 grid gap-3">{leads.map((lead) => <GlassCard key={lead.id} className="p-4"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-black">{lead.company || lead.name || "İsimsiz işletme"}</h3><p className="mt-1 text-sm text-slate-400">{lead.address || "Adres bilgisi yok"}</p><p className="mt-2 text-xs text-slate-500">{lead.business_type || "Sektör belirtilmedi"} · Google puanı {lead.google_rating ?? "-"} · {lead.google_review_count || 0} değerlendirme</p></div><div className="flex gap-2"><span className="rounded-full border border-amber-300/20 px-3 py-2 text-xs text-amber-200">Sıcaklık {lead.lead_heat_score || 0}</span><span className="rounded-full border border-cyan-200/20 px-3 py-2 text-xs text-cyan-100">Olgunluk {lead.digital_maturity_score || 0}</span></div></div><div className="mt-4 grid gap-3 md:grid-cols-2"><TextArea label="Rakip notları" value={lead.competitor_notes || ""} onChange={(competitor_notes) => update(lead.id, { competitor_notes })} /><TextArea label="Yerel fırsat notları" value={lead.local_opportunity_notes || ""} onChange={(local_opportunity_notes) => update(lead.id, { local_opportunity_notes })} /></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => setActive("Lead Yönetimi")} className="rounded-full border border-white/10 px-3 py-2 text-xs font-bold">CRM kaydını aç</button><button onClick={() => analyze(lead)} className="rounded-full border border-cyan-200/20 px-3 py-2 text-xs font-bold text-cyan-100">AI analizi oluştur</button>{lead.google_place_id && <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/place/?q=place_id:${lead.google_place_id}`} className="rounded-full bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950">Google Maps'te aç</a>}</div></GlassCard>)}{!leads.length && <p className="rounded-[8px] border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">Filtrelere uygun kaydedilmiş işletme bulunamadı. İşletme Keşfi bölümünden aday ekleyebilirsiniz.</p>}</div></Panel>;
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
  "HK Dijital Premium": { background: "#050711", surface: "#0b1020", text: "#f8fafc", mutedText: "#94a3b8", primaryButton: "#67e8f9", secondaryButton: "#172033", accent: "#facc15", sidebar: "#080b17", header: "#050711", border: "#24304a", success: "#34d399", warning: "#fbbf24", danger: "#f87171" },
  "Karanlık": { background: "#070b14", surface: "#111827", text: "#f8fafc", mutedText: "#cbd5e1", primaryButton: "#38bdf8", secondaryButton: "#1e293b", accent: "#f59e0b", sidebar: "#0f172a", header: "#111827", border: "#334155", success: "#10b981", warning: "#f59e0b", danger: "#ef4444" },
  "Aydınlık": { background: "#f1f5f9", surface: "#ffffff", text: "#0f172a", mutedText: "#475569", primaryButton: "#0284c7", secondaryButton: "#e2e8f0", accent: "#ca8a04", sidebar: "#ffffff", header: "#ffffff", border: "#cbd5e1", success: "#047857", warning: "#b45309", danger: "#b91c1c" }
};

function ThemeEditor({ onApply }: any) {
  const [theme, setTheme] = useState(themePresets["HK Dijital Premium"]);
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
  return <Panel title="Tema Ayarları"><p className="mb-5 text-sm leading-6 text-slate-400">Admin paneli renklerini canlı önizleme ile düzenleyin. Tercih bu tarayıcıda anında uygulanır ve kaydettiğinizde Supabase içinde saklanır.</p><div className="mb-5 flex flex-wrap gap-2">{Object.entries(themePresets).map(([label, preset]) => <button key={label} onClick={() => apply(preset)} className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold">{label}</button>)}</div><div className="grid gap-4 lg:grid-cols-[1fr_360px]"><div className="grid gap-3 sm:grid-cols-2">{Object.entries(theme).map(([key, value]) => <Field key={key} label={key} type="color" value={value} onChange={(next) => apply({ ...theme, [key]: next })} />)}</div><div className="rounded-[8px] border p-4" style={{ background: theme.surface, borderColor: theme.border, color: theme.text }}><p className="text-xs font-black uppercase" style={{ color: theme.accent }}>Canlı önizleme</p><h3 className="mt-3 text-xl font-black">HK Dijital Premium Panel</h3><p className="mt-2 text-sm" style={{ color: theme.mutedText }}>Kart, metin, buton ve durum renklerini burada birlikte değerlendirin.</p><button className="mt-5 rounded-full px-4 py-2 text-sm font-black" style={{ background: theme.primaryButton, color: theme.background }}>Birincil işlem</button></div></div><div className="mt-5 flex gap-2"><button onClick={save} className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">Temayı kaydet</button><button onClick={() => apply(themePresets["HK Dijital Premium"])} className="rounded-full border border-white/10 px-5 py-3 text-sm">Varsayılanlara dön</button></div>{message && <p className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-100">{message}</p>}</Panel>;
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
    {result && <div className="mt-5 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-4"><pre className="whitespace-pre-wrap text-sm leading-7 text-cyan-50">{result}</pre><button type="button" onClick={() => navigator.clipboard.writeText(result)} className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-100/20 px-4 py-2 text-sm text-cyan-50"><Copy size={15} /> Kopyala</button></div>}
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
