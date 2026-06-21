"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react/jsx-key, react/no-unescaped-entities, react-hooks/purity, react-hooks/immutability */
// @ts-nocheck

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Activity, AlertTriangle, ArrowDown, ArrowUp, BarChart3, Bell, Bot, Building2, ChevronDown, ChevronRight, CircleCheck, CircleOff, Copy, Download, FileBarChart, Gauge, GripVertical, HelpCircle, ImagePlus, LayoutDashboard, LogOut, MapPinned, MessageSquareText, Plus, RotateCcw, Save, Search, Settings2, Sparkles, Star, Trash2, UsersRound, WandSparkles, X } from "lucide-react";
import type { SiteContent } from "@/lib/types";
import { ReportTools } from "@/components/admin/reports/ReportTools";
import { Logo } from "@/components/public/Logo";
import { adminNavigationGroups, adminNavigationItems, getAdminHref } from "@/lib/admin-navigation";
import { AnimatedChart, AnimatedFunnel, BrandEcosystemStrip, GlassCard, MetricCard3D } from "@/components/premium/PremiumUI";

const adminCategoryIcons: Record<string, any> = {
  LayoutDashboard,
  UsersRound,
  Sparkles,
  FileBarChart,
  Bot,
  MapPinned,
  Gauge,
  Settings2,
  Download
};

const adminLabelEmojis: Record<string, string> = {
  "Kontrol Merkezi": "🖥️",
  "CRM & Müşteriler": "👥",
  "İstihbarat Merkezi": "🧭",
  "Reklam & Raporlama": "📊",
  "Ajans Operasyonları": "🗂️",
  "İçerik & AI Studio": "✨",
  "Araçlar": "🧰",
  "Ayarlar": "⚙️",
  Dashboard: "🏠",
  "HK Asistan": "🤖",
  Görevler: "✅",
  Karlılık: "💰",
  Müşteriler: "👥",
  Leadler: "🎯",
  CRM: "🎯",
  "Satış Hunisi": "🧲",
  Kampanyalar: "📣",
  Tahsilat: "💳",
  Teklifler: "📄",
  "Teklif Oluştur": "📄",
  Raporlar: "📈",
  "Müşteri Raporları": "📈",
  Belgeler: "🗃️",
  "Zaman Çizelgesi": "🕒",
  "Sistem Sağlığı": "🩺",
  "Sistem Test Merkezi": "🧪",
  "Web Sitesi Yönetimi": "🌐",
  Entegrasyonlar: "🔌",
  "Kullanıcı Yönetimi": "👤",
  "Tema / Logo": "🎨",
  "Sistem Ayarları": "⚙️",
  "Sistem Logları": "🧾",
  "Aktivite Akışı": "🕒",
  "Veri Aktarma": "🧰",
  Takvim: "📅",
  "Meta Raporları": "📊",
  "Google Ads Raporları": "📈",
  "Reklam Hesabı Eşleştirme": "🔗",
  "Aylık Raporlar": "🗓️",
  "PDF Audit": "🖨️",
  "WhatsApp Teklifi": "💬",
  "Müşteri Keşfi": "🧭",
  Haritalar: "🗺️",
  "Meta İstihbarat": "📣",
  "Google İstihbarat": "🔎",
  "Lead Analizi": "🎯"
  ,
  "Takip Merkezi": "📞",
  "AI Denetim": "🧠",
  "PDF Rapor Tasarım Merkezi": "🖨️",
  "Gelir Tahmini": "📈",
  "Sözleşme Oluştur": "📝",
  "WhatsApp Hatırlatma Merkezi": "💬"
};

function withAdminEmoji(label: string) {
  const emoji = adminLabelEmojis[label];
  return emoji && !label.startsWith(emoji) ? `${emoji} ${label}` : label;
}

const salesPipelineStages = ["Yeni Lead", "İletişim Kuruldu", "Toplantı Yapıldı", "Teklif Gönderildi", "Takipte", "Kazanıldı", "Kaybedildi"];
const crmActiveStatuses = ["Yeni Başvuru", "İletişime Geçildi", "Takipte", "Teklif Gönderildi", "Müşteri Oldu"];
const crmStatusTabs = ["Tüm Başvurular", "Yeni Başvurular", "İletişime Geçildi", "Takipte", "Teklif Gönderildi", "Müşteri Oldu", "Meta Analiz", "Google Ads Analiz", "Reddedilenler", "Silinenler"];
const leadStatuses = [...new Set([...crmActiveStatuses, ...salesPipelineStages, "Yeni", "Görüşülecek", "Teklif Hazırlanıyor", "Kazanıldı", "Kaybedildi", "Dönüştürüldü", "Reddedildi"])];
const leadSourceOptions = ["İletişim Formu", "Teklif Formu", "Teklif Sihirbazı", "Müşteri Bulucu", "Meta Analiz", "Google Ads Analiz", "Instagram", "WhatsApp", "Referans", "Manuel Giriş", "Diğer"];
const roleOptions = [
  { value: "admin", label: "Yönetici" },
  { value: "yonetici", label: "Operasyon Yöneticisi" },
  { value: "editor", label: "Editör" },
  { value: "musteri", label: "Müşteri" }
];
const uiPermissionGroups = [
  ["Kontrol Merkezi", ["dashboard", "genel-arama", "kullanim-kilavuzu"]],
  ["CRM & Müşteriler", ["crm", "leads", "musteriler", "takip-gorevleri", "notlar"]],
  ["İstihbarat Merkezi", ["meta-analiz", "google-analiz", "sosyal-medya-denetimi", "reklam-firsatlari", "musteri-bulucu", "haritalar", "bolgesel-analiz", "rakip-listesi", "kaydedilen-adaylar", "funnel-analizi"]],
  ["İçerik & AI Studio", ["hazirlik", "ai-studio", "icerik-onerileri", "prompt-kutuphanesi", "kampanya-hazirligi"]],
  ["Teklif & Raporlama", ["kampanyalar", "teklifler", "teklif-listesi", "raporlar", "rapor-yorumlari", "disa-aktarimlar"]],
  ["Ajans Operasyonları", ["gorevler", "belgeler", "tahsilat", "karlilik", "rakip-analizi", "sosyal-medya-plani", "aylik-raporlar", "hk-asistan", "sektor-sistemleri"]],
  ["Araçlar", ["veri-aktarma"]],
  ["Ayarlar", ["kullanicilar", "site-ayarlari", "api-ayarlari", "tema-ayarlari", "medya", "sistem-sagligi", "sistem-test-merkezi", "sistem-loglari"]]
];
const uiRoleTemplates = {
  admin: uiPermissionGroups.flatMap(([, modules]) => modules),
  yonetici: ["dashboard", "genel-arama", "kullanim-kilavuzu", "crm", "leads", "musteriler", "takip-gorevleri", "notlar", "musteri-bulucu", "haritalar", "bolgesel-analiz", "kaydedilen-adaylar", "meta-analiz", "google-analiz", "sosyal-medya-denetimi", "hazirlik", "ai-studio", "kampanyalar", "teklifler", "teklif-listesi", "raporlar", "rapor-yorumlari", "disa-aktarimlar", "gorevler", "belgeler", "tahsilat", "karlilik", "rakip-analizi", "sosyal-medya-plani", "aylik-raporlar", "hk-asistan", "sektor-sistemleri", "sistem-sagligi", "veri-aktarma"],
  editor: ["dashboard", "genel-arama", "kullanim-kilavuzu", "crm", "leads", "hazirlik", "ai-studio", "icerik-onerileri", "prompt-kutuphanesi", "kampanya-hazirligi", "teklifler", "teklif-listesi", "raporlar", "rapor-yorumlari", "disa-aktarimlar", "medya"],
  musteri: []
};
const legacyRole = (role) => role === "sales" ? "yonetici" : role === "customer" ? "musteri" : role;
const customerRole = (role) => ["customer", "musteri"].includes(role);
const statusOptions = ["Aktif", "Pasif"];
const companyStatusOptions = ["Aktif", "Pasif", "Beklemede", "Potansiyel", "Eski Müşteri"];
const taskHistoryFilters = ["Tümü", "Yapılacak", "Devam Ediyor", "Beklemede", "Tamamlandı", "İptal", "Arşivlenenler"];
const taskStatusOptions = ["Yapılacak", "Devam Ediyor", "Beklemede", "Tamamlandı", "İptal"];
const paymentHistoryFilters = ["Tümü", "Bekliyor", "Ödendi", "Gecikmiş", "İptal", "Arşivlenenler"];
const paymentStatusOptions = ["Bekliyor", "Ödendi", "Gecikmiş", "İptal"];

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
const platformOptions = ["Meta Ads", "Google Ads", "Instagram", "Facebook", "TikTok", "LinkedIn", "Diğer"];
const objectiveOptions = ["Bilinirlik", "Trafik", "Mesaj", "Lead", "Satış", "Randevu", "Etkileşim"];
const campaignStatusOptions = ["Planlandı", "Aktif", "Duraklatıldı", "Tamamlandı", "İptal", "Arşivlendi"];
const metricPeriodOptions = ["Günlük", "Haftalık", "Aylık", "Özel Tarih"];
const metricSourceOptions = ["Manuel Giriş", "Meta Raporu", "Google Ads Raporu", "Diğer"];
const updateTypeOptions = ["Yapılan Çalışma", "Reklam Güncellemesi", "Rapor Notu", "Strateji Notu", "Uyarı", "Başarı", "Diğer"];
const fileCategoryOptions = ["Görsel", "Reklam Görseli", "Kreatif", "PDF", "Video", "Diğer"];
const serviceCategoryOptions = ["Meta Reklamları", "Google Reklamları", "Sosyal Medya Yönetimi", "SEO", "Web Sitesi", "CRM", "Raporlama", "Yapay Zeka Analizi", "Diğer"];
const packageTypeOptions = ["Başlangıç", "Standart", "Profesyonel", "Premium", "Özel Paket", "Diğer"];
const apiProviderOptions = ["Groq", "Gemini", "OpenAI", "Otomatik", "Demo Modu", "Yerel Mod"];
const aiProviderOptions = apiProviderOptions;
const aiPriorityOptions = ["Groq", "Gemini", "OpenAI", "Demo Modu", "Yerel Mod"];
const aiPriorityKeys = ["groq", "gemini", "openai", "demo", "local"];
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

function createLocalId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const source = `${Date.now()}${Math.random()}`.replace(/\D/g, "").padEnd(32, "0").slice(0, 32);
  return `${source.slice(0, 8)}-${source.slice(8, 12)}-4${source.slice(13, 16)}-8${source.slice(17, 20)}-${source.slice(20, 32)}`;
}

function aiProviderLabel(value?: string) {
  const normalized = String(value || "").toLocaleLowerCase("tr");
  if (normalized.includes("openai")) return "OpenAI";
  if (normalized.includes("groq")) return "Groq";
  if (normalized.includes("gemini")) return "Gemini";
  if (normalized.includes("yerel") || normalized.includes("local")) return "Yerel Mod";
  if (normalized.includes("demo")) return "Demo Modu";
  if (normalized.includes("auto") || normalized.includes("otomatik")) return "Otomatik";
  return value || "Groq";
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
  const provider = primary === "Otomatik" && legacy !== "Otomatik" ? legacy : ["Demo Modu", "Yerel Mod"].includes(primary) && ["Gemini", "OpenAI", "Groq"].includes(legacy) && !api.demoMode ? legacy : aiProviderLabel(api.active_ai_provider || api.activeProvider || (api.demoMode ? "Demo Modu" : "Groq"));
  return {
    provider,
    model: api.active_ai_model || api.model || (provider === "Groq" ? "llama-3.3-70b-versatile" : provider === "Gemini" ? "gemini-2.0-flash" : provider === "Demo Modu" ? "demo-local" : "automatic-fallback"),
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
  return <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[.1em]"><span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-cyan-700">{data.badge}</span><span className="rounded-full border border-slate-200 px-3 py-1 text-slate-600">Kullanılan AI Sağlayıcısı: {data.provider}</span><span className="rounded-full border border-slate-200 px-3 py-1 text-slate-600">Model: {data.model}</span><span className="rounded-full border border-slate-200 px-3 py-1 text-slate-600">Mod: {data.mode}</span></div>;
}

const aiChooserOptions = [
  ["Groq", "Hızlı ve düşük maliyetli önerilen sağlayıcı"],
  ["Gemini", "Google tabanlı alternatif sağlayıcı"],
  ["OpenAI", "Yüksek kaliteli ücretli sağlayıcı"],
  ["Otomatik", "Sıralamaya göre uygun sağlayıcıyı dener"],
  ["Demo", "Gerçek API kullanmadan örnek çıktı üretir"],
  ["Yerel", "Basit yerel analiz modu"]
];

function AiProviderChooserModal({ open, selected, setSelected, onContinue, onCancel }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-white/70 p-4 ">
      <div className="w-full max-w-xl rounded-[8px] border border-slate-200 bg-white p-5 text-slate-900 shadow-[0_24px_90px_rgba(0,0,0,.45)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-amber-700">AI sağlayıcı seçimi</p>
            <h3 className="mt-2 text-xl font-black">Hangi AI aracı kullanılacak?</h3>
          </div>
          <button onClick={onCancel} className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-white/10"><X size={17} /></button>
        </div>
        <div className="mt-5 grid gap-2">
          {aiChooserOptions.map(([label, description]) => (
            <button
              key={label}
              type="button"
              onClick={() => setSelected(label)}
              className={`rounded-[8px] border p-4 text-left transition ${selected === label ? "border-amber-200 bg-amber-300 text-slate-950 shadow-[0_16px_45px_rgba(251,191,36,.18)]" : "border-slate-200 bg-white/[0.045] hover:border-cyan-200/30 hover:bg-cyan-200/[0.07]"}`}
            >
              <span className="flex items-center justify-between gap-3 text-sm font-black">
                {label}
                {label === "Groq" && <span className="rounded-full bg-white/20 px-2 py-1 text-[10px] font-black">Önerilen</span>}
              </span>
              <span className={`mt-1 block text-xs leading-5 ${selected === label ? "text-slate-800" : "text-slate-400"}`}>{description}</span>
            </button>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button onClick={onCancel} className="rounded-full border border-slate-200 px-5 py-2 text-sm font-bold text-slate-700">Vazgeç</button>
          <button onClick={() => onContinue(selected || "Groq")} className="rounded-full bg-amber-300 px-5 py-2 text-sm font-black text-slate-950">Devam Et</button>
        </div>
      </div>
    </div>
  );
}

function useAiProviderChooser() {
  const [chooserOpen, setChooserOpen] = useState(false);
  const [chooserSelected, setChooserSelected] = useState("Groq");
  const [chooserAction, setChooserAction] = useState<any>(null);
  useEffect(() => {
    try {
      setChooserSelected(sessionStorage.getItem("hk-ai-last-provider") || "Groq");
    } catch {}
  }, []);
  const askAiProvider = (action: any) => {
    try {
      setChooserSelected(sessionStorage.getItem("hk-ai-last-provider") || "Groq");
    } catch {
      setChooserSelected("Groq");
    }
    setChooserAction(() => action);
    setChooserOpen(true);
  };
  const chooserModal = (
    <AiProviderChooserModal
      open={chooserOpen}
      selected={chooserSelected}
      setSelected={setChooserSelected}
      onCancel={() => setChooserOpen(false)}
      onContinue={(provider: string) => {
        try {
          sessionStorage.setItem("hk-ai-last-provider", provider || "Groq");
        } catch {}
        setChooserOpen(false);
        chooserAction?.(provider);
      }}
    />
  );
  return { askAiProvider, chooserModal };
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
  const [saveFeedback, setSaveFeedback] = useState("idle");
  const [toasts, setToasts] = useState<any[]>([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [notificationState, setNotificationState] = useState({ read: [], archived: [] });
  const [hoveredNavGroup, setHoveredNavGroup] = useState("");
  const navCloseTimer = useRef<number | null>(null);
  const [bootVisible, setBootVisible] = useState(false);
  const [bootStep, setBootStep] = useState(0);
  const [openGroups, setOpenGroups] = useState(() => Object.fromEntries(adminNavigationGroups.map((group) => [group.label, false])));
  const [startupApiOpen, setStartupApiOpen] = useState(false);
  const [startupApiLoading, setStartupApiLoading] = useState(false);
  const [startupApiData, setStartupApiData] = useState<any>({ results: content.settings?.api?.ai_status || {}, lastTestTime: content.settings?.api?.ai_status_last_test_at });
  const [startupApiMessage, setStartupApiMessage] = useState("");
  const [isDesktopApp, setIsDesktopApp] = useState(false);

  useEffect(() => {
    setIsDesktopApp(Boolean(window.hkDesktop?.isDesktop));
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
    let shouldShowApiStatus = true;
    try {
      shouldShowApiStatus = !sessionStorage.getItem("hk-api-status-popup-complete");
      if (shouldShowApiStatus) sessionStorage.setItem("hk-api-status-popup-complete", "true");
    } catch {
      shouldShowApiStatus = true;
    }
    if (shouldShowApiStatus) {
      setStartupApiOpen(true);
      runStartupApiStatus();
    }
    try {
      setNotificationState(JSON.parse(localStorage.getItem("hk-admin-notification-state") || "null") || { read: [], archived: [] });
    } catch {
      setNotificationState({ read: [], archived: [] });
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

  function toggleGroup(label: string) {
    setOpenGroups((current) => ({ ...current, [label]: !current[label] }));
  }

  function openNavGroup(label: string) {
    if (navCloseTimer.current) window.clearTimeout(navCloseTimer.current);
    setHoveredNavGroup(label);
  }

  function closeNavGroup(label: string) {
    if (navCloseTimer.current) window.clearTimeout(navCloseTimer.current);
    navCloseTimer.current = window.setTimeout(() => {
      setHoveredNavGroup((current) => (current === label ? "" : current));
      setOpenGroups((current) => ({ ...current, [label]: false }));
    }, 120);
  }

  function notify(message: string, type = "success") {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const cleanMessage = String(message || "")
      .replace(/^[✓✔✅]\s*/u, "")
      .replace(/^[✖✕❌]\s*/u, "")
      .replace(/^[⚠️⚠]\s*/u, "")
      .trim();
    setToasts((current) => [{ id, message: cleanMessage || "İşlem tamamlandı.", type }, ...current].slice(0, 5));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 2200);
  }

  async function save(next = content) {
    setSaving(true);
    setSaveFeedback("saving");
    setStatus("Kaydediliyor...");
    try {
      const contentResponse = allowedModules.includes("site-ayarlari")
        ? await fetch("/api/content", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) })
        : new Response(JSON.stringify({ ok: true }), { status: 200 });
      const centerWritableModules = ["musteriler", "leads", "crm", "kampanyalar", "gorevler", "belgeler", "tahsilat", "karlilik", "rakip-analizi", "sosyal-medya-plani", "aylik-raporlar", "sektor-sistemleri", "sistem-loglari", "sistem-test-merkezi", "teklifler"];
      const centerResponse = supabaseConfigured && centerWritableModules.some((module) => allowedModules.includes(module))
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
        setStatus("Kaydedildi ✓");
        setSaveFeedback("success");
        notify("✓ Kayıt başarıyla kaydedildi", "success");
        window.setTimeout(() => setSaveFeedback("idle"), 1900);
      } else {
        const contentData = await contentResponse.json().catch(() => ({}));
        const centerData = await centerResponse.json().catch(() => ({}));
        const detail = centerData.supabaseError || centerData.error || contentData.error || "Supabase bağlantısını ve ortam değişkenlerini kontrol edin.";
        setStatus(`Kaydedilemedi: ${detail}`);
        setSaveFeedback("error");
        notify(`✖ İşlem başarısız: ${detail}`, "error");
        window.setTimeout(() => setSaveFeedback("idle"), 2200);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Beklenmeyen hata";
      setStatus(`Kaydedilemedi: ${detail}`);
      setSaveFeedback("error");
      notify(`✖ İşlem başarısız: ${detail}`, "error");
      window.setTimeout(() => setSaveFeedback("idle"), 2200);
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  async function runStartupApiStatus() {
    setStartupApiLoading(true);
    setStartupApiMessage("Test Ediliyor...");
    const response = await fetch("/api/admin/ai-status", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setStartupApiData(data);
      const values = Object.values(data.results || {});
      const missing = values.some((item: any) => item.status !== "Aktif");
      setStartupApiMessage(missing ? "Bazı API bağlantıları eksik veya hata veriyor. API Ayarları bölümünü kontrol edin." : "Sistem hazır. API bağlantıları çalışıyor.");
      setContent((current) => ({ ...current, settings: { ...current.settings, api: { ...current.settings.api, ai_status: data.results, ai_status_last_test_at: data.lastTestTime } } }));
    } else {
      setStartupApiMessage(data.error || "API durum kontrolü sırasında bir hata oluştu.");
    }
    setStartupApiLoading(false);
  }

  function saveNotificationState(next: any) {
    setNotificationState(next);
    localStorage.setItem("hk-admin-notification-state", JSON.stringify(next));
  }

  function markNotificationRead(id: string) {
    saveNotificationState({ ...notificationState, read: [...new Set([...notificationState.read, id])] });
  }

  function archiveNotification(id: string) {
    saveNotificationState({ ...notificationState, archived: [...new Set([...notificationState.archived, id])], read: [...new Set([...notificationState.read, id])] });
  }

  function markAllNotificationsRead(items: any[]) {
    saveNotificationState({ ...notificationState, read: [...new Set([...notificationState.read, ...items.map((item) => item.id)])] });
  }

  const props = { content, setContent, currentSession, allowedModules, setActive, save, notify };
  const visibleNavigationGroups = adminNavigationGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => allowedModules.includes(item.module)) }))
    .filter((group) => group.items.length);
  const activeGroup = visibleNavigationGroups.find((group) => group.items.some((item) => item.label === active || item.slug === "" && active === "Dashboard"));
  useEffect(() => {
    if (!mobileNavOpen || !activeGroup || openGroups[activeGroup.label]) return;
    setOpenGroups((current) => ({ ...current, [activeGroup.label]: true }));
  }, [activeGroup?.label, mobileNavOpen]);
  const shellClass = "hk-admin-os admin-light bg-[#f7f8fb] text-slate-900";
  const panelClass = "border-slate-200 bg-white";
  const headerClass = "border-slate-200 bg-white/95";
  const aiStatus = aiMetaFromApi(content.settings?.api || {});
  const headerNotifications = buildAdminNotifications(content, startupApiData).filter((item) => !notificationState.archived.includes(item.id));
  const unreadNotifications = headerNotifications.filter((item) => !notificationState.read.includes(item.id));
  const userInitials = String(currentSession?.fullName || currentSession?.email || "HK")
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0])
    .join("")
    .toLocaleUpperCase("tr");
  const dashboardAliases = ["Dashboard", "AI Durum Merkezi", "Canlı Aktivite", "Sistem Özeti"];
  const crmLeadViews = ["Leadler", "Tüm Başvurular", "Yeni Başvurular", "Meta Analiz Leadleri", "Google Ads Analiz Leadleri", "Sosyal İstihbarat Leadleri", "Reddedilenler", "Silinenler"];
  const reportAliases = ["Teklifler", "Rapor Yorumları", "Dışa Aktarımlar", "Dışa Aktarma", "Müşteri Raporları", "Performans Raporları"];
  const preparationAliases = ["İçerik Planları", "Promptlar", "İçerik Önerileri", "İçerik Fikirleri", "30 Günlük Sosyal Medya Planı", "Prompt Kütüphanesi", "Prompt Üretimi", "Kampanya Hazırlığı", "Kampanya Önerileri"];

  return (
    <main data-admin="true" className={`admin-shell hk-admin relative min-h-screen overflow-x-hidden ${shellClass}`}>
      <div className="admin-ambient pointer-events-none absolute inset-0" />
      <div className="premium-grid pointer-events-none absolute inset-0 opacity-20" />
      <header className={`sticky top-0 z-40 border-b ${headerClass} shadow-[0_8px_30px_rgba(15,23,42,.06)] backdrop-blur-sm`}>
        <div className="relative flex flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
          <div className="flex min-w-[220px] items-center gap-3">
            <Link href="/hk-admin" aria-label="Ana dashboard'a dön" className="group flex items-center gap-3 rounded-[8px] px-2 py-1 transition hover:bg-slate-50">
              <Logo content={content} compact />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-700">HK Dijital</p>
                <h1 className="text-lg font-black transition group-hover:text-cyan-700 sm:text-xl">HK Operating System</h1>
              </div>
            </Link>
            {isDesktopApp && <span className="rounded-[8px] border border-amber-200/20 bg-amber-300/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em] text-amber-700">Desktop</span>}
          </div>
          <AdminBrowserControls />
          <nav className="order-3 grid w-full gap-2 lg:order-none lg:flex lg:w-auto lg:flex-1 lg:items-center lg:justify-center">
            <button type="button" onClick={() => setMobileNavOpen((current) => !current)} className="flex min-h-10 items-center justify-between rounded-[8px] border border-slate-200 bg-white/[0.045] px-3 text-sm font-black text-slate-700 lg:hidden">
              Menü
              {mobileNavOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            <div className={`${mobileNavOpen ? "grid" : "hidden"} gap-2 lg:flex lg:items-center lg:gap-1.5`}>
              {visibleNavigationGroups.map((group) => {
                const expanded = openGroups[group.label] || hoveredNavGroup === group.label;
                const activeInGroup = group.items.some((item) => item.label === active || item.slug === "" && active === "Dashboard");
                const CategoryIcon = adminCategoryIcons[group.icon] || LayoutDashboard;
                return (
                  <div
                    key={group.label}
                    className="relative"
                    onMouseEnter={() => openNavGroup(group.label)}
                    onMouseLeave={() => closeNavGroup(group.label)}
                    onFocus={() => openNavGroup(group.label)}
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.label)}
                      onBlur={() => closeNavGroup(group.label)}
                      aria-expanded={expanded}
                      className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-[8px] border px-3 text-sm font-black transition lg:w-auto ${activeInGroup ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-700" : "border-slate-200 bg-white text-slate-600 hover:border-cyan-200/25 hover:bg-white/[0.065] hover:text-slate-900"}`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <CategoryIcon size={15} />
                        <span className="truncate">{withAdminEmoji(group.label)}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-slate-600">{group.items.length}</span>
                        <ChevronDown size={14} className={`transition ${expanded ? "rotate-180" : "lg:group-hover:rotate-180"}`} />
                      </span>
                    </button>
                    <div
                      onMouseEnter={() => openNavGroup(group.label)}
                      onMouseLeave={() => closeNavGroup(group.label)}
                      className={`admin-top-dropdown premium-scrollbar ${expanded ? "flex" : "hidden"} mt-2 max-h-[calc(100vh-104px)] w-full max-w-full flex-col gap-2 overflow-y-auto rounded-[8px] border border-slate-200 bg-white/98 p-3 shadow-[0_18px_50px_rgba(0,0,0,.24)] lg:absolute lg:left-1/2 lg:top-full lg:z-50 lg:mt-3 lg:w-[min(520px,calc(100vw-32px))] lg:min-w-[420px] lg:-translate-x-1/2`}
                    >
                      {group.items.map((item) => (
                        <Link
                          key={item.slug}
                          href={getAdminHref(item.slug)}
                          title={item.label}
                          onClick={() => { setMobileNavOpen(false); setHoveredNavGroup(""); }}
                          className={`flex w-full min-w-0 items-start gap-3 rounded-[8px] border px-3.5 py-3 text-sm font-bold transition ${active === item.label ? "border-cyan-200/50 bg-cyan-300 text-slate-950" : "border-slate-200 text-slate-700 hover:border-cyan-200/25 hover:bg-white/[0.07] hover:text-cyan-700"}`}
                        >
                          <CategoryIcon size={15} className={`mt-0.5 shrink-0 ${active === item.label ? "text-slate-950" : "text-cyan-700"}`} />
                          <span className="min-w-0 flex-1">
                            <span className="block whitespace-normal break-normal leading-5">{withAdminEmoji(item.label)}</span>
                            <span className={`mt-1 block whitespace-normal break-normal text-[11px] font-medium leading-4 ${active === item.label ? "text-slate-700" : "text-slate-500"}`}>{group.description}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </nav>
          <div className="ml-auto flex flex-wrap justify-end gap-2">
            <button onClick={() => setActive("API Ayarları")} className="min-h-10 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 px-3 text-left text-xs font-bold text-cyan-700">
              <span className="block">AI: {aiStatus.provider}</span>
              <span className="block text-[10px] text-cyan-700/70">Mod: {aiStatus.mode}</span>
            </button>
            <GlobalAdminSearch />
            <button onClick={() => setCopilotOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-purple-100 px-4 text-sm font-black text-purple-700 ring-1 ring-purple-200 transition hover:bg-purple-200">
              <Bot size={17} /> HK Copilot
            </button>
            <div className="relative">
              <button onClick={() => setNotificationsOpen((current) => !current)} className="relative grid min-h-10 min-w-10 place-items-center rounded-[8px] border border-slate-200 bg-white text-slate-700 transition hover:border-cyan-200/30 hover:bg-cyan-200/10" aria-label="Bildirimler">
                <Bell size={17} />
                {unreadNotifications.length > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-amber-300 px-1 text-[10px] font-black text-slate-950 shadow-[0_0_18px_rgba(250,204,21,.8)]">{unreadNotifications.length}</span>}
              </button>
            </div>
            <div className="grid min-h-10 min-w-10 place-items-center rounded-[8px] border border-slate-200 bg-white/[0.055] text-sm font-black text-slate-900" title={currentSession?.email || "HK Admin"}>
              {userInitials || "HK"}
            </div>
            <div className="relative">
              <button onClick={() => setHelpOpen((current) => !current)} className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-slate-200 px-4 text-sm font-bold">
                <HelpCircle size={17} /> Yardım
              </button>
              {helpOpen && (
                <div className="absolute right-0 top-14 z-50 w-[min(90vw,340px)] rounded-[8px] border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl backdrop-blur-sm">
                  <p className="text-sm font-black text-cyan-700">Hızlı yardım</p>
                  <p className="mt-2 text-xs leading-5 text-slate-600">İşletme aramak için Müşteri Bulucu, başvuruları takip etmek için CRM, müşteri raporları için Raporlar bölümünü kullanın.</p>
                  <div className="mt-3 grid gap-2 text-xs">
                    <Link onClick={() => setHelpOpen(false)} href="/hk-admin/kullanim-kilavuzu#isletme-kesfi-kullanimi" className="rounded-[8px] border border-slate-200 px-3 py-2 hover:bg-white/10">İşletme keşfi adımları</Link>
                    <Link onClick={() => setHelpOpen(false)} href="/hk-admin/kullanim-kilavuzu#raporlama-kullanimi" className="rounded-[8px] border border-slate-200 px-3 py-2 hover:bg-white/10">Raporlama adımları</Link>
                    <Link onClick={() => setHelpOpen(false)} href="/hk-admin/kullanim-kilavuzu" className="rounded-[8px] bg-cyan-300 px-3 py-2 font-black text-slate-950">Kullanım kılavuzunu aç</Link>
                  </div>
                </div>
              )}
            </div>
            {(allowedModules.includes("site-ayarlari") || ["musteriler", "kampanyalar", "gorevler", "belgeler", "tahsilat", "karlilik", "rakip-analizi", "sosyal-medya-plani", "aylik-raporlar", "sektor-sistemleri"].some((module) => allowedModules.includes(module))) && <button disabled={saving} onClick={() => save()} className={`inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-cyan-300 px-4 text-sm font-black text-slate-950 disabled:opacity-60 ${saveFeedback === "success" ? "hk-action-success" : ""}`}><Save size={17} /> {saving ? "Kaydediliyor..." : saveFeedback === "success" ? "Kaydedildi ✓" : saveFeedback === "error" ? "Tekrar Dene" : "💾 Kaydet"}</button>}
            <button onClick={logout} className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-slate-200 px-4 text-sm font-bold"><LogOut size={17} /> Çıkış</button>
          </div>
        </div>
      </header>
      <div className="relative grid w-full min-w-0 gap-4 px-3 py-4 sm:px-4 lg:grid-cols-1 lg:px-6">
        <section className={`admin-dashboard-main min-w-0 w-full max-w-none rounded-[18px] border p-4 shadow-[0_8px_30px_rgba(15,23,42,.06)] sm:p-5 ${panelClass} ${saveFeedback === "success" ? "hk-action-success" : ""}`}>
          {!supabaseConfigured && <p className="mb-5 rounded-[8px] border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-700">Supabase bağlantısı yapılandırılmadı. Canlı ortamda kaydetme çalışmaz.</p>}
          {bootstrapWarning && <p className="mb-5 rounded-[8px] border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-700">Süper admin kurulum anahtarları hâlâ aktif. Güvenlik için Vercel ortam değişkenlerinden kaldırın.</p>}
          {status && <p className={`mb-5 rounded-[8px] border p-3 text-sm ${status.includes("Kaydedilemedi") ? "border-red-300/30 bg-red-500/10 text-red-100" : "border-cyan-200/20 bg-cyan-200/10 text-cyan-700"}`}>{status}</p>}
          {dashboardAliases.includes(active) && <Overview content={content} setActive={setActive} supabaseConfigured={supabaseConfigured} systemStatus={systemStatus} currentSession={currentSession} allowedModules={allowedModules} notify={notify} />}
          {active === "Satış Hunisi" && <SalesPipeline content={content} setContent={setContent} save={save} setActive={setActive} />}
          {active === "CRM" && <CrmHub {...props} />}
          {active === "Takip Merkezi" && <LeadFollowUpCenter {...props} setActive={setActive} />}
          {active === "AI Denetim" && <AiAuditCenter {...props} setActive={setActive} />}
          {active === "Görevler" && <AgencyTasksCenter {...props} />}
          {active === "Belgeler" && <DocumentCenter {...props} />}
          {active === "Tahsilat" && <PaymentCenter {...props} />}
          {active === "Takvim" && <AgencyCalendarCenter {...props} />}
          {active === "Gelir Tahmini" && <RevenueForecastCenter {...props} />}
          {active === "Sözleşme Oluştur" && <ContractGeneratorCenter {...props} />}
          {active === "WhatsApp Hatırlatma Merkezi" && <WhatsAppReminderCenter {...props} setActive={setActive} />}
          {active === "Reklam Hesabı Eşleştirme" && <AdAccountMappingCenter {...props} />}
          {["Müşteri Bulucu", "İşletme Keşfi", "Müşteri Bul", "Müşteri Keşfi"].includes(active) && <CustomerFinder {...props} />}
          {["Lead Yönetimi", "Lead Analizi", ...crmLeadViews].includes(active) && <Crm {...props} view={["Lead Yönetimi", "Leadler", "Lead Analizi"].includes(active) ? "Lead Durumları" : active} setActive={setActive} />}
          {["Meta Analiz", "Meta Raporları", "Meta İstihbarat"].includes(active) && <MetaAnalysisSection />}
          {["Google Analiz", "Google Ads Analiz", "Google Ads Raporları", "Google İstihbarat"].includes(active) && <GoogleAdsAnalysisSection />}
          {["Sosyal İstihbarat Merkezi", "Sosyal Medya Denetimi", "PDF Audit"].includes(active) && <SocialMediaAuditCenter />}
          {["AI Studio", "AI Analizleri"].includes(active) && <AiAssistant {...props} mode="AI Studio" />}
          {["Teklif Motoru", "Teklif Hazırlama", "Teklif Oluştur", "WhatsApp Teklifi"].includes(active) && <ProposalEngine {...props} setActive={setActive} />}
          {active === "Raporlar" && <ReportsHub {...props} />}
          {active === "PDF Rapor Tasarım Merkezi" && <PdfReportDesignCenter {...props} />}
          {active === "Müşteriler" && <CustomersAdmin {...props} />}
          {["Site Ayarları", "Web Sitesi Yönetimi"].includes(active) && <WebsiteManagementCenter {...props} />}
          {["API Ayarları", "API Durum Kontrolü", "AI Sağlayıcı Ayarları", "Entegrasyonlar"].includes(active) && <IntegrationsCenter {...props} />}
          {["Medya / Logo", "Medya"].includes(active) && <MediaLogoHub {...props} />}
          {active === "Kullanıcılar" && <UsersHub {...props} />}
          {active === "Genel Arama" && <GlobalSearchPage />}
          {["Haritalar", "Google Maps / İşletme Sinyalleri"].includes(active) && <MapsIntelligence {...props} setActive={setActive} mode={active} />}
          {active === "Hazırlık Merkezi" && <PreparationCenter {...props} setActive={setActive} />}
          {["Tema Ayarları", "Tema / Logo"].includes(active) && <ThemeEditor onApply={() => null} />}
          {["Roller & Yetkiler", "Kullanıcı Yönetimi"].includes(active) && <UsersAdmin {...props} mode={active} />}
          {active === "Sistem Sağlığı" && <SystemHealthCenter content={content} setContent={setContent} startupApiData={startupApiData} runStartupApiStatus={runStartupApiStatus} startupApiLoading={startupApiLoading} />}
          {active === "Sistem Test Merkezi" && <SystemTestCenter content={content} setContent={setContent} save={save} currentSession={currentSession} notify={notify} systemStatus={systemStatus} supabaseConfigured={supabaseConfigured} />}
          {active === "Veri Aktarma" && <ExportCenter content={content} />}
          {["Sistem Logları", "Aktivite Akışı"].includes(active) && <ActivityLogs content={content} setContent={setContent} />}
          {["Takip Görevleri", "Takipler", "Notlar"].includes(active) && <Crm {...props} view={active} setActive={setActive} />}
          {["Bölgesel Analiz", "Rakip Listesi", "Kaydedilen Adaylar"].includes(active) && <MapsIntelligence {...props} setActive={setActive} mode={active} />}
          {["Funnel Analizi", "Reklam Fırsatları", "Rakip Reklamları"].includes(active) && <ChannelAnalysis {...props} channel={active === "Rakip Reklamları" ? "Reklam Fırsatları" : active} />}
          {active === "Rakip Analizi" && <CompetitorAnalysisCenter {...props} />}
          {active === "Sosyal Medya Planı" && <SocialPlanGenerator {...props} />}
          {active === "Aylık Raporlar" && <MonthlyReportCenter {...props} />}
          {active === "Karlılık" && <ProfitabilityCenter {...props} />}
          {active === "HK Asistan" && <HKAssistantCenter {...props} />}
          {active === "Sektör Sistemleri" && <SectorSystemsCenter {...props} />}
          {active === "Müşteri Markalama" && <CustomerBrandingCenter {...props} />}
          {preparationAliases.includes(active) && <PreparationCenter {...props} setActive={setActive} mode={active} />}
          {reportAliases.includes(active) && <ReportsHub {...props} />}
          {active === "Genel Bakış" && <Overview content={content} setActive={setActive} supabaseConfigured={supabaseConfigured} systemStatus={systemStatus} currentSession={currentSession} allowedModules={allowedModules} notify={notify} />}
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
          {active === "Log Hareketleri" && <ActivityLogs content={content} setContent={setContent} />}
          {active === "Kullanım Kılavuzu" && <UsageGuide />}
        </section>
      </div>
      {notificationsOpen && (
        <div className="fixed inset-0 z-[80] flex justify-end bg-white/70 " onMouseDown={() => setNotificationsOpen(false)}>
          <aside className="h-full w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-5 text-slate-900 shadow-[0_24px_90px_rgba(0,0,0,.42)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">HK Operating System</p>
                <h2 className="mt-1 text-2xl font-black">Bildirim Merkezi</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Tahsilat, görev, kampanya ve müşteri taleplerini tek akışta izleyin.</p>
              </div>
              <button onClick={() => setNotificationsOpen(false)} className="grid size-10 shrink-0 place-items-center rounded-[8px] border border-slate-200 hover:bg-white/10" aria-label="Kapat"><X size={18} /></button>
            </div>
            <div className="mt-5 grid gap-3">
              {headerNotifications.map((item) => (
                <div key={item.id} className={`rounded-[8px] border p-3 ${item.tone === "cyan" ? "border-cyan-200/20 bg-cyan-300/[0.08]" : item.tone === "emerald" ? "border-emerald-200/20 bg-emerald-300/[0.08]" : item.tone === "purple" ? "border-purple-200/20 bg-purple-300/[0.08]" : "border-amber-200/20 bg-amber-300/[0.08]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-black text-slate-900">{item.label}</p>
                    {!notificationState.read.includes(item.id) && <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[9px] font-black text-slate-950">Yeni</span>}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.text}</p>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button onClick={() => markNotificationRead(item.id)} className="rounded-full border border-emerald-300/30 px-3 py-1.5 text-[11px] font-bold text-emerald-700">Okundu yap</button>
                    <button onClick={() => archiveNotification(item.id)} className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-700">Arşivle</button>
                    <button onClick={() => { setActive(item.target || "Dashboard"); markNotificationRead(item.id); setNotificationsOpen(false); }} className="rounded-full bg-cyan-300 px-3 py-1.5 text-[11px] font-black text-slate-950">İlgili kaydı aç</button>
                  </div>
                </div>
              ))}
              {!headerNotifications.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-5 text-sm text-slate-400">Aktif bildirim bulunmuyor.</p>}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button onClick={() => setNotificationsOpen(false)} className="rounded-[8px] border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">Kapat</button>
              <button onClick={() => markAllNotificationsRead(headerNotifications)} className="rounded-[8px] bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950">Tümünü Okundu Yap</button>
            </div>
          </aside>
        </div>
      )}
      {copilotOpen && <GlobalCopilotPanel content={content} setActive={setActive} onClose={() => setCopilotOpen(false)} notify={notify} />}
      <StartupApiStatusModal open={startupApiOpen} loading={startupApiLoading} data={startupApiData} message={startupApiMessage} onRetest={runStartupApiStatus} onClose={() => setStartupApiOpen(false)} onSettings={() => { setStartupApiOpen(false); setActive("API Ayarları"); }} />
      {bootVisible && <SystemBoot step={bootStep} />}
      <ToastStack items={toasts} dismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
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

function ToastStack({ items, dismiss }: any) {
  return <div className="hk-toast-stack" role="status" aria-live="polite">
    {items.map((toast) => {
      const icon = toast.type === "error" ? "❌" : toast.type === "warning" ? "⚠️" : toast.type === "info" ? "ℹ️" : "✅";
      const label = toast.type === "error" ? "İşlem başarısız" : toast.type === "warning" ? "Dikkat" : toast.type === "info" ? "Bilgi" : "İşlem başarılı";
      const tone = toast.type === "error" ? "hk-toast-error" : toast.type === "warning" ? "hk-toast-warning" : toast.type === "info" ? "hk-toast-info" : "hk-toast-success";
      return <button key={toast.id} type="button" onClick={() => dismiss(toast.id)} className={`hk-toast ${tone} grid grid-cols-[34px_1fr] items-start gap-3 p-4 text-left`}>
        <span className="hk-toast-icon grid size-8 place-items-center rounded-full text-base font-black">{icon}</span>
        <span><strong className="block text-xs font-black uppercase tracking-[.08em] text-slate-500">{label}</strong><span className="mt-1 block text-sm font-bold text-slate-950">{toast.message}</span><span className="mt-1 block text-xs text-slate-500">Kapatmak için tıklayın.</span></span>
      </button>;
    })}
  </div>;
}

function SystemBoot({ step }: { step: number }) {
  const complete = step >= bootSequence.length;
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-white/70 px-5 ">
    <div className="w-full max-w-xl overflow-hidden rounded-[8px] border border-cyan-200/20 bg-white p-6 shadow-[0_28px_120px_rgba(34,211,238,.2)] sm:p-8">
      <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-700">HK Operating System</p><p className="mt-2 text-[11px] font-bold uppercase tracking-[.18em] text-slate-500">Powered by HK Dijital</p></div><span className="grid size-11 place-items-center rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 text-cyan-700"><Sparkles size={20} /></span></div>
      <div className="mt-7 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300 transition-all duration-300" style={{ width: `${Math.min(100, step / bootSequence.length * 100)}%` }} /></div>
      <div className="mt-6 min-h-20">
        {complete ? <div className="animate-pulse"><p className="text-xl font-black text-slate-900">Welcome to HK OS</p><p className="mt-2 text-sm text-cyan-700">HK Operating System hazır.</p></div> : <><p className="text-lg font-black text-slate-900">{bootSequence[step]?.[0]}</p><p className="mt-2 text-sm text-cyan-700">{bootSequence[step]?.[1]}</p></>}
      </div>
      <p className="text-xs text-slate-500">Digital Marketing Command Center</p>
    </div>
  </div>;
}

function AdminLightSidebar({ groups, active, content }: any) {
  const featured = ["Dashboard", "Müşteriler", "Kampanyalar", "Görevler", "Tahsilat", "Raporlar"];
  return (
    <aside className="admin-light-sidebar hidden h-[calc(100vh-104px)] overflow-y-auto rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,.08)] lg:sticky lg:top-24 lg:block">
      <Link href="/hk-admin" className="mb-5 flex items-center gap-3 rounded-[14px] px-2 py-2 transition hover:bg-slate-50">
        <Logo content={content} compact />
        <span>
          <span className="block text-[11px] font-black uppercase tracking-[.16em] text-sky-600">HK Intelligence</span>
          <span className="block text-lg font-black text-slate-950">HK Dijital</span>
        </span>
      </Link>
      <div className="mb-5 rounded-[16px] bg-gradient-to-br from-blue-600 to-cyan-500 p-4 text-slate-900 shadow-[0_12px_28px_rgba(37,99,235,.24)]">
        <p className="text-xs font-black uppercase tracking-[.14em] text-slate-900/70">Ajans Paneli</p>
        <p className="mt-2 text-sm font-bold leading-5">Operasyon, müşteri ve rapor merkeziniz hazır.</p>
      </div>
      <div className="grid gap-4">
        {groups.map((group) => {
          const Icon = adminCategoryIcons[group.icon] || LayoutDashboard;
          return (
            <div key={group.label}>
              <div className="mb-2 flex items-center justify-between gap-3 px-2">
                <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-slate-500"><Icon size={14} /> {group.label}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">{group.items.length}</span>
              </div>
              <div className="grid gap-1">
                {group.items.map((item) => {
                  const isActive = item.label === active || (item.slug === "" && active === "Dashboard");
                  return (
                    <Link
                      key={item.slug}
                      href={getAdminHref(item.slug)}
                      className={`flex min-h-10 items-center justify-between gap-3 rounded-[12px] px-3 text-sm font-bold transition ${isActive ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-slate-900 shadow-[0_10px_24px_rgba(37,99,235,.22)]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
                    >
                      <span className="truncate">{item.label}</span>
                      {featured.includes(item.label) && <span className={`h-2 w-2 rounded-full ${isActive ? "bg-white" : "bg-cyan-400"}`} />}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function Panel({ title, children }: any) {
  return <div className="w-full min-w-0 max-w-none"><p className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-700">HK Operating System</p><h2 className="mb-6 mt-2 text-2xl font-black">{title}</h2>{children}</div>;
}

function Field({ label, value, onChange, type = "text", placeholder = "" }: any) {
  return <label className="grid gap-2 text-sm font-semibold text-slate-700">{label}<input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="min-h-11 rounded-[8px] border border-slate-200 bg-slate-50 px-3 text-slate-900 placeholder:text-slate-500" /></label>;
}

function TextArea({ label, value, onChange, rows = 4 }: any) {
  return <label className="grid gap-2 text-sm font-semibold text-slate-700">{label}<textarea rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-3 text-slate-900" /></label>;
}

function SelectField({ label, value, onChange, options, placeholder = "Seçin" }: any) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="min-h-11 rounded-[8px] border border-slate-200 bg-slate-50 px-3 text-slate-900">
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

function buildAdminNotifications(content: any, startupApiData: any = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const companies = content.companies || [];
  const companyName = (companyId?: string) => companies.find((company) => company.id === companyId)?.name || "Müşteri yok";
  const payments = (content.paymentRecords || []).filter((item) => !item.archived_at && !item.deleted_at);
  const tasks = (content.agencyTasks || []).filter((item) => !item.archived_at && !item.deleted_at);
  const campaigns = (content.campaigns || []).filter((item) => !item.archived_at && !item.deleted_at && item.status !== "Arşivlendi");
  const leads = content.leads || [];
  const overduePayments = payments.filter((item) => item.status === "Gecikmiş" || (item.due_date && item.due_date < today && !["Ödendi", "İptal"].includes(item.status)));
  const todayTasks = tasks.filter((item) => item.due_date === today && !["Tamamlandı", "İptal"].includes(item.status));
  const criticalTasks = tasks.filter((item) => item.priority === "Kritik" && !["Tamamlandı", "İptal"].includes(item.status));
  const endingCampaigns = campaigns.filter((item) => item.end_date && item.end_date >= today && item.end_date <= weekEnd && !["Tamamlandı", "İptal"].includes(item.status));
  const newRequests = leads.filter((lead) => ["Yeni", "Yeni Başvuru"].includes(lead.status || "Yeni"));
  const followUpLeads = leads.filter((lead) => (lead.follow_up_date || lead.next_action_at) && String(lead.follow_up_date || lead.next_action_at).slice(0, 10) <= today && !["Kazanıldı", "Kaybedildi", "Dönüştürüldü", "Reddedildi"].includes(lead.status));
  const proposalFollowUps = leads.filter((lead) => pipelineStageForLead(lead) === "Teklif Gönderildi" && !["Kazanıldı", "Kaybedildi"].includes(lead.status));
  const latestLead = newRequests[0];
  const notifications = [
    followUpLeads.length && {
      id: `lead-follow-up-${followUpLeads.length}-${followUpLeads[0]?.id || "lead"}`,
      label: "Takip bekleyen leadler",
      text: `${followUpLeads.length} lead için takip zamanı geldi. İlk kayıt: ${followUpLeads[0]?.company || followUpLeads[0]?.name || "Lead"}`,
      tone: "amber",
      target: "Takip Merkezi"
    },
    proposalFollowUps.length && {
      id: `proposal-follow-up-${proposalFollowUps.length}-${proposalFollowUps[0]?.id || "proposal"}`,
      label: "Teklif takibi bekliyor",
      text: `${proposalFollowUps.length} teklif gönderilmiş lead takip bekliyor. İlk kayıt: ${proposalFollowUps[0]?.company || proposalFollowUps[0]?.name || "Teklif"}`,
      tone: "purple",
      target: "Takip Merkezi"
    },
    overduePayments.length && {
      id: `overdue-payments-${overduePayments.map((item) => item.id || item.due_date).join("-")}`,
      label: "Geciken tahsilatlar",
      text: `${overduePayments.length} tahsilat gecikmiş görünüyor. İlk kayıt: ${companyName(overduePayments[0]?.company_id)} · ${Number(overduePayments[0]?.amount || 0).toLocaleString("tr-TR")} TL`,
      tone: "amber",
      target: "Tahsilat"
    },
    todayTasks.length && {
      id: `today-tasks-${today}-${todayTasks.length}`,
      label: "Bugünkü görevler",
      text: `${todayTasks.length} görev bugün tamamlanmalı. Öncelikli kayıt: ${todayTasks[0]?.title || "Görev"}`,
      tone: "cyan",
      target: "Görevler"
    },
    criticalTasks.length && {
      id: `critical-tasks-${criticalTasks.map((item) => item.id || item.title).join("-")}`,
      label: "Kritik görevler",
      text: `${criticalTasks.length} kritik görev açık. İlk kayıt: ${criticalTasks[0]?.title || "Kritik görev"}`,
      tone: "purple",
      target: "Görevler"
    },
    endingCampaigns.length && {
      id: `ending-campaigns-${endingCampaigns.map((item) => item.id || item.name).join("-")}`,
      label: "Yaklaşan kampanya bitişleri",
      text: `${endingCampaigns.length} kampanya 7 gün içinde bitiyor. İlk kayıt: ${endingCampaigns[0]?.name || "Kampanya"} · ${companyName(endingCampaigns[0]?.company_id)}`,
      tone: "emerald",
      target: "Kampanyalar"
    },
    newRequests.length && {
      id: `new-requests-${newRequests.length}-${latestLead?.id || "lead"}`,
      label: "Yeni müşteri talepleri",
      text: `${newRequests.length} yeni talep takip bekliyor. Son kayıt: ${latestLead?.company || latestLead?.name || "Yeni başvuru"}`,
      tone: "cyan",
      target: "Leadler"
    },
    {
      id: `system-health-${startupApiData?.lastTestTime || "pending"}`,
      label: "Sistem sağlığı",
      text: startupApiData?.lastTestTime ? `Son bağlantı kontrolü: ${new Date(startupApiData.lastTestTime).toLocaleString("tr-TR")}` : "Bağlantı testi bekleniyor.",
      tone: startupApiData?.lastTestTime ? "emerald" : "amber",
      target: "Sistem Sağlığı"
    }
  ].filter(Boolean);
  return notifications;
}

function GlobalAdminSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const quickActions = [
    ["Müşteri Ekle", "/hk-admin/musteriler", "Yeni müşteri kaydı aç"],
    ["Lead Ekle", "/hk-admin/leads", "CRM lead listesine git"],
    ["Tahsilat Gir", "/hk-admin/tahsilat", "Yeni tahsilat kaydı oluştur"],
    ["Görev Ekle", "/hk-admin/gorevler", "Operasyon görevi ekle"],
    ["Meta Senkronize Et", "/hk-admin/reklam-hesabi-eslestirme", "Meta hesap eşleştirme ve veri çekme"],
    ["Google Senkronize Et", "/hk-admin/reklam-hesabi-eslestirme", "Google hesap eşleştirme ve veri çekme"],
    ["Teklif Hazırla", "/hk-admin/teklif-hazirlama", "Teklif motorunu aç"],
    ["Rapor Oluştur", "/hk-admin/musteri-raporlari", "Müşteri raporu hazırla"],
    ["WhatsApp Mesajı Hazırla", "/hk-admin/whatsapp-hatirlatma", "Hazır mesaj merkezi"],
    ["Kampanya Ekle", "/hk-admin/kampanyalar", "Kampanya yönetimini aç"]
  ];
  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        window.setTimeout(() => document.getElementById("hk-command-search")?.focus(), 0);
      }
      if (event.key === "Escape") setOpen(false);
    }
    const removeDesktopListener = window.hkDesktop?.onFocusSearch?.(() => {
      setOpen(true);
      window.setTimeout(() => document.getElementById("hk-command-search")?.focus(), 0);
    });
    window.addEventListener("keydown", handleShortcut);
    return () => {
      window.removeEventListener("keydown", handleShortcut);
      removeDesktopListener?.();
    };
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
  return <div className="relative"><button onClick={() => { setOpen(true); window.setTimeout(() => document.getElementById("hk-command-search")?.focus(), 0); }} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-600"><Search size={16} className="text-cyan-700" /><span className="hidden xl:inline">Komut paleti...</span><kbd className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-black text-slate-500">⌘K / Ctrl+K</kbd></button>{open && <div className="fixed inset-0 z-[90] flex justify-center bg-white/70 px-4 pt-[12vh] " onMouseDown={() => setOpen(false)}><div className="h-fit w-full max-w-3xl overflow-hidden rounded-[18px] border border-cyan-200/20 bg-white shadow-[0_28px_110px_rgba(15,23,42,.18)]" onMouseDown={(event) => event.stopPropagation()}><label className="flex min-h-16 items-center gap-3 border-b border-slate-200 px-5"><Search size={19} className="text-cyan-700" /><input id="hk-command-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Her yerde ara veya hızlı aksiyon seç..." className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500" /><button onClick={() => setOpen(false)} title="Kapat" className="rounded border border-slate-200 px-2 py-1 text-[10px] font-black text-slate-400">ESC</button></label><div className="premium-scrollbar max-h-[62vh] overflow-y-auto p-3">{query.trim().length < 2 && <div><p className="px-1 pb-3 text-xs font-black uppercase tracking-[.14em] text-slate-500">Hızlı Aksiyon Paleti</p><div className="grid gap-2 sm:grid-cols-2">{quickActions.map(([label, href, detail]) => <Link key={label} href={href} onClick={() => { setQuery(""); setOpen(false); }} className="rounded-[14px] border border-slate-200 bg-slate-50 p-3 transition hover:border-cyan-200 hover:bg-cyan-50"><strong className="block text-sm text-slate-950">{label}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{detail}</span></Link>)}</div><p className="mt-4 px-1 text-xs leading-5 text-slate-500">Arama için en az iki karakter yazın. Müşteri, lead, kampanya, görev, tahsilat, belge, rapor ve log kayıtları taranır.</p></div>}{results.map((result) => <Link key={result.id} href={result.href} onClick={() => { setQuery(""); setOpen(false); }} className="grid gap-3 rounded-[12px] px-3 py-3 text-sm hover:bg-cyan-50 sm:grid-cols-[120px_1fr_auto] sm:items-center"><span className="rounded-full border border-cyan-200/40 bg-cyan-50 px-2 py-1 text-center text-[10px] font-black text-cyan-700">{result.type}</span><span><strong className="block text-slate-900">{result.title}</strong><span className="mt-1 block text-xs text-slate-500">{result.detail}</span></span><span className="rounded-full bg-cyan-300 px-3 py-1.5 text-xs font-black text-slate-950">Aç</span></Link>)}{query.trim().length >= 2 && !results.length && <p className="px-3 py-5 text-sm text-slate-400">Eşleşen sonuç bulunamadı.</p>}</div></div></div>}</div>;
}

function GlobalCopilotPanel({ content, setActive, onClose, notify }: any) {
  const [prompt, setPrompt] = useState("Bugün neye odaklanmalıyım?");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const prompts = ["Bu müşteri için teklif hazırla", "Bu ay riskli müşteriler kim?", "Geciken tahsilatları göster", "Bu hafta yapılacakları sırala", "Meta performansını özetle", "Müşteri için WhatsApp mesajı hazırla"];
  function localAnswer() {
    const tasks = content.agencyTasks || [];
    const payments = content.paymentRecords || [];
    const leads = content.leads || [];
    const campaigns = content.campaigns || [];
    const metrics = content.campaignMetrics || [];
    const overdue = payments.filter((item) => item.status === "Gecikmiş").slice(0, 6);
    const critical = tasks.filter((item) => item.priority === "Kritik" && item.status !== "Tamamlandı").slice(0, 6);
    const hot = leads.filter((lead) => Number(lead.lead_heat_score || 0) >= 70).slice(0, 6);
    const metaSpend = metrics.filter((item) => String(item.source || item.platform || "").toLocaleLowerCase("tr").includes("meta")).reduce((sum, item) => sum + Number(item.spend || item.spent || 0), 0);
    return [
      "HK Copilot yerel özet:",
      critical.length ? `Kritik görevler: ${critical.map((item) => item.title).join(", ")}` : "Kritik görev görünmüyor.",
      overdue.length ? `Geciken tahsilatlar: ${overdue.map((item) => `${companyName(content, item.company_id)} ${Number(item.amount || 0).toLocaleString("tr-TR")} TL`).join(", ")}` : "Geciken tahsilat görünmüyor.",
      hot.length ? `Takip edilecek sıcak leadler: ${hot.map((lead) => lead.company || lead.name).join(", ")}` : "Sıcak lead listesi sakin.",
      `Aktif kampanya: ${campaigns.filter((item) => item.status === "Aktif").length}. Meta harcama: ${metaSpend.toLocaleString("tr-TR")} TL.`,
      "Öneri: Önce kritik görevleri kapatın, geciken tahsilatları arayın, ardından sıcak leadler için teklif/WhatsApp aksiyonu alın."
    ].join("\n\n");
  }
  async function ask(question = prompt) {
    setPrompt(question);
    setLoading(true);
    const fallback = localAnswer();
    try {
      const response = await fetch("/api/admin/ai-generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: `${question}\n\nAjans verisi: ${JSON.stringify({ tasks: (content.agencyTasks || []).slice(0, 20), payments: (content.paymentRecords || []).slice(0, 20), leads: (content.leads || []).slice(0, 20), campaigns: (content.campaigns || []).slice(0, 20) })}\n\nTürkçe, kısa ve uygulanabilir yanıt ver.` }) });
      const data = await response.json().catch(() => ({}));
      setAnswer(response.ok && data.output ? data.output : fallback);
    } catch {
      setAnswer(fallback);
    } finally {
      setLoading(false);
      notify?.("HK Copilot yanıtı hazırlandı.", "success");
    }
  }
  return <div className="fixed inset-0 z-[85] flex justify-end bg-white/75" onMouseDown={onClose}><aside className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-[0_24px_90px_rgba(15,23,42,.16)]" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-purple-600">HK Intelligence</p><h2 className="mt-1 text-2xl font-black text-slate-950">HK Copilot</h2><p className="mt-2 text-sm leading-6 text-slate-500">Her admin sayfasından operasyon sorusu sorun. AI yoksa yerel kural tabanlı özet döner.</p></div><button onClick={onClose} className="grid size-10 place-items-center rounded-[12px] border border-slate-200 text-slate-600"><X size={18} /></button></div><div className="mt-5 grid gap-2 sm:grid-cols-2">{prompts.map((item) => <button key={item} onClick={() => ask(item)} className="rounded-[14px] border border-slate-200 bg-slate-50 p-3 text-left text-xs font-black text-slate-700 hover:border-purple-200 hover:bg-purple-50">{item}</button>)}</div><div className="mt-5"><TextArea label="Copilot sorusu" value={prompt} onChange={setPrompt} /><div className="mt-3 flex flex-wrap gap-2"><button disabled={loading} onClick={() => ask(prompt)} className="rounded-full bg-purple-100 px-5 py-3 text-sm font-black text-purple-700 ring-1 ring-purple-200 disabled:opacity-60">{loading ? "Yanıt hazırlanıyor..." : "Sor"}</button><button onClick={() => { setActive("HK Asistan"); onClose(); }} className="rounded-full border border-slate-200 px-5 py-3 text-sm font-black text-slate-700">HK Asistan sayfasını aç</button></div></div>{answer && <pre className="mt-5 whitespace-pre-wrap rounded-[16px] border border-purple-100 bg-purple-50 p-4 text-sm leading-7 text-slate-700">{answer}</pre>}</aside></div>;
}

function AdminBrowserControls() {
  const buttonClass = "inline-flex min-h-9 items-center gap-1.5 rounded-[8px] px-2.5 text-xs font-black text-slate-600 transition hover:bg-cyan-200/10 hover:text-cyan-700";
  return (
    <div className="flex items-center gap-1 rounded-[8px] border border-slate-200 bg-white p-1">
      <button type="button" title="Geri" aria-label="Geri" onClick={() => window.history.back()} className={buttonClass}>
        <span aria-hidden="true">←</span><span className="hidden sm:inline">Geri</span>
      </button>
      <button type="button" title="İleri" aria-label="İleri" onClick={() => window.history.forward()} className={buttonClass}>
        <span className="hidden sm:inline">İleri</span><span aria-hidden="true">→</span>
      </button>
      <button type="button" title="Yenile" aria-label="Yenile" onClick={() => window.location.reload()} className={buttonClass}>
        Yenile
      </button>
    </div>
  );
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
  return <Panel title="Genel Arama"><p className="mb-4 text-sm leading-6 text-slate-400">Yetkiniz bulunan modüller, başvurular, müşteriler ve raporlar içinde arama yapın.</p><div className="flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && runSearch()} placeholder="Aramak istediğiniz kelimeyi yazın..." className="min-h-12 flex-1 rounded-[8px] border border-slate-200 bg-slate-50 px-4 text-slate-900" /><button onClick={runSearch} className="rounded-[8px] bg-cyan-300 px-5 text-sm font-black text-slate-950">{loading ? "Aranıyor..." : "Ara"}</button></div><div className="mt-5 grid gap-3">{results.map((result) => <Link key={result.id} href={result.href} className="flex items-center justify-between gap-3 rounded-[8px] border border-slate-200 bg-slate-50 p-4 transition hover:border-cyan-200/40"><span><strong>{result.title}</strong><span className="mt-1 block text-sm text-slate-400">{result.detail}</span></span><span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-cyan-700">{result.type}</span></Link>)}{query && !loading && !results.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">Aramanızla eşleşen kayıt bulunamadı.</p>}</div></Panel>;
}

const dashboardWidgetDefaults = ["assistant", "tasks", "profitability", "payments", "campaigns", "recentLeads", "notifications", "activity", "metrics", "aiStatus", "operations", "pipeline", "intelligence", "status", "charts", "insights", "quickActions", "crm", "demo"];

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
      <p className="text-sm font-black text-slate-900">{title}</p>
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
      ) : <div className="mt-4 rounded-[8px] border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-xs leading-5 text-slate-400">Bu grafiği oluşturmak için henüz yeterli kayıt yok. İlgili modülden veri eklediğinizde görünüm otomatik oluşur.</div>}
    </GlassCard>
  );
}

function aiStatusColor(status = "") {
  if (status === "Aktif") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-700";
  if (status === "Hata") return "border-red-300/25 bg-red-500/10 text-red-100";
  if (status === "API Eksik") return "border-slate-400/20 bg-slate-400/10 text-slate-600";
  return "border-amber-300/25 bg-amber-300/10 text-amber-700";
}

function StartupApiStatusModal({ open, loading, data = {}, message, onRetest, onClose, onSettings }: any) {
  if (!open) return null;
  const statuses = data.results || {};
  const rows = [
    ["Groq", statuses.groq],
    ["Gemini", statuses.gemini],
    ["OpenAI", statuses.openai],
    ["Meta", statuses.meta],
    ["Google Maps", statuses.googleMaps],
    ["Google Ads", statuses.googleAds],
    ["Supabase", statuses.supabase]
  ];
  return (
    <div className="fixed inset-0 z-[75] grid place-items-center bg-white/70 p-4 ">
      <div className="w-full max-w-2xl rounded-[8px] border border-slate-200 bg-white p-5 text-slate-900 shadow-[0_24px_90px_rgba(0,0,0,.45)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-700">HK OS başlangıç testi</p>
            <h3 className="mt-2 text-2xl font-black">Sistem Durum Kontrolü</h3>
            <p className="mt-2 text-sm text-slate-400">Aktif sağlayıcı: <strong className="text-slate-900">{aiProviderLabel(data.activeProvider || "Groq")}</strong> · Mod: <strong className="text-slate-900">{data.mode || "Canlı"}</strong></p>
          </div>
          <button onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-white/10"><X size={17} /></button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {rows.map(([label, item]) => (
            <div key={label} className={`rounded-[8px] border p-3 ${aiStatusColor(loading && !item ? "Test Ediliyor" : item?.status)}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-black text-slate-900">{label}</span>
                <span className="rounded-full border border-current/20 px-2 py-1 text-[10px] font-black">{loading && !item ? "Test Ediliyor" : item?.status || "API Eksik"}</span>
              </div>
              <p className="mt-2 text-xs">Model: <strong>{item?.model || "-"}</strong></p>
              <p className="mt-1 text-xs">Yanıt: <strong>{item?.responseTimeMs ? `${item.responseTimeMs} ms` : data.responseTimeMs ? `${data.responseTimeMs} ms` : "-"}</strong></p>
              <p className="mt-1 text-xs">Son test: <strong>{item?.lastTestTime ? new Date(item.lastTestTime).toLocaleString("tr-TR") : data.lastTestTime ? new Date(data.lastTestTime).toLocaleString("tr-TR") : "-"}</strong></p>
            </div>
          ))}
        </div>
        {message && <p className={`mt-4 rounded-[8px] border p-3 text-sm ${message.includes("Sistem hazır") ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-700" : "border-amber-300/25 bg-amber-300/10 text-amber-700"}`}>{message}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button disabled={loading} onClick={onRetest} className="rounded-full border border-cyan-200/20 px-5 py-2 text-sm font-bold text-cyan-700 disabled:opacity-60">{loading ? "Test Ediliyor" : "Yeniden Test Et"}</button>
          <button onClick={onSettings} className="rounded-full border border-slate-200 px-5 py-2 text-sm font-bold text-slate-700">API Ayarlarına Git</button>
          <button onClick={onClose} className="rounded-full bg-amber-300 px-5 py-2 text-sm font-black text-slate-950">Kapat</button>
        </div>
      </div>
    </div>
  );
}

function AiStatusCenterWidget({ statuses = {}, message, loading, onRefresh }: any) {
  const items = [
    ["Groq", statuses.groq],
    ["Gemini", statuses.gemini],
    ["OpenAI", statuses.openai],
    ["Meta", statuses.meta],
    ["Google Maps", statuses.googleMaps],
    ["Google Ads", statuses.googleAds],
    ["Supabase", statuses.supabase]
  ];
  return <GlassCard className="p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-pink-200">AI Durum Merkezi</p><h3 className="mt-2 text-xl font-black text-slate-900">Sağlayıcı ve API bağlantıları</h3><p className="mt-1 text-sm text-slate-400">AI sağlayıcıları ve reklam/veri API durumlarını tek merkezden test edin.</p></div><div className="flex flex-wrap gap-2"><button disabled={loading} onClick={onRefresh} className="rounded-full border border-cyan-200/20 px-4 py-2 text-xs font-black text-cyan-700 disabled:opacity-60">AI Durumunu Yenile</button><button disabled={loading} onClick={onRefresh} className="rounded-full bg-amber-300 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-60">{loading ? "Test ediliyor..." : "Tüm Bağlantıları Test Et"}</button></div></div><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map(([label, item]) => <div key={label} className={`rounded-[8px] border p-4 ${aiStatusColor(item?.status)}`}><div className="flex items-center justify-between gap-3"><p className="font-black text-slate-900">{label}</p><span className="rounded-full border border-current/20 px-2 py-1 text-[10px] font-black">{item?.status || "API Eksik"}</span></div><p className="mt-3 text-xs leading-5">Model: <strong>{item?.model || "-"}</strong></p><p className="mt-1 text-xs leading-5">Son test: <strong>{item?.lastTestTime ? new Date(item.lastTestTime).toLocaleString("tr-TR") : "-"}</strong></p>{item?.warning && <p className="mt-2 text-[11px] leading-5 opacity-80">{item.warning}</p>}</div>)}</div>{message && <p className="mt-4 rounded-[8px] border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">{message}</p>}</GlassCard>;
}

function maskKey(value: any) {
  const text = String(value || "");
  if (!text || text.includes("•")) return text ? "••••••••" : "";
  if (text.length <= 8) return `${text.slice(0, 2)}****`;
  return `${text.slice(0, 4)}****${text.slice(-4)}`;
}

function integrationReadiness(api: any = {}) {
  const item = (label: string, value: any, guidance: string) => ({ label, ready: Boolean(value), masked: maskKey(value), guidance });
  return [
    item("Meta App ID", api.meta_app_id, "Bu alan eksik olduğu için Meta uygulama doğrulaması tamamlanamaz."),
    item("Meta Access Token", api.meta_access_token, "Bu alan eksik olduğu için canlı Meta verisi çekilemez."),
    item("Meta Business ID", api.meta_business_id, "Bu alan eksik olduğu için Business Manager varlıkları eşleştirilemez."),
    item("Meta Ad Account ID", api.meta_ad_account_id, "Bu alan eksik olduğu için reklam hesabı metrikleri alınamaz."),
    item("Google Maps API", api.google_maps_api_key || api.google_maps_key, "Bu alan eksik olduğu için Haritalar / işletme keşfi canlı veriye geçemez."),
    item("Google Ads Developer Token", api.google_ads_developer_token || api.google_ads_key, "Bu alan eksik olduğu için Google Ads canlı kampanya verisi çekilemez."),
    item("Google Client ID / Secret", api.google_client_id && (api.google_client_secret || api.google_ads_client_secret), "Bu alan eksik olduğu için OAuth bağlantısı test edilemez.")
  ];
}

function ReadinessPanel({ api }: any) {
  const items = integrationReadiness(api);
  return <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">Meta & Google hazırlık kontrolü</p><h3 className="mt-1 font-black text-slate-900">Canlı veri bağlantısı için gerekli alanlar</h3></div>
      <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">{items.filter((item) => item.ready).length}/{items.length} hazır</span>
    </div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => <div key={item.label} className={`rounded-[8px] border p-3 ${item.ready ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-700" : "border-amber-300/20 bg-amber-300/10 text-amber-700"}`}>
        <div className="flex items-center justify-between gap-3"><p className="text-sm font-black text-slate-900">{item.label}</p><span className="rounded-full border border-current/20 px-2 py-1 text-[10px] font-black">{item.ready ? "Hazır" : "Eksik"}</span></div>
        <p className="mt-2 text-xs leading-5 opacity-85">{item.ready ? `Bağlantı hazır görünüyor. Değer: ${item.masked || "kayıtlı"}` : `${item.guidance} Demo veri ile devam ediliyor.`}</p>
      </div>)}
    </div>
  </div>;
}

const systemTestCategories = [
  ["auth", "🔐 Yetkilendirme Testleri"],
  ["supabase", "🗄 Supabase Testleri"],
  ["dashboard", "📊 Dashboard Testleri"],
  ["customers", "👤 Müşteri Modülü Testleri"],
  ["payments", "💰 Tahsilat Testleri"],
  ["campaigns", "📈 Kampanya Testleri"],
  ["meta", "📢 Meta Testleri"],
  ["google", "🔎 Google Testleri"],
  ["reports", "📄 Raporlama Testleri"],
  ["copilot", "🤖 HK Copilot Testleri"],
  ["notifications", "🔔 Bildirim Testleri"],
  ["system", "⚙ Sistem Testleri"]
];

const systemChecklistDefaults = [
  { itemKey: "login", title: "🔐 Giriş Sistemi", category: "Yetkilendirme", description: "Yönetici ve müşteri giriş ekranlarının doğru çalıştığını kontrol eder." },
  { itemKey: "customers", title: "👥 Müşteri Yönetimi", category: "Müşteri Modülü", description: "Müşteri kayıtları, profil sayfaları ve müşteri aksiyonlarının çalıştığını doğrular." },
  { itemKey: "campaigns", title: "📢 Kampanya Yönetimi", category: "Kampanya", description: "Kampanya ekleme, düzenleme, eşleştirme ve listeleme akışlarını kontrol eder." },
  { itemKey: "meta", title: "📘 Meta Entegrasyonu", category: "Meta", description: "Meta hesap bilgileri, token durumu ve reklam hesabı bağlantılarını kontrol eder." },
  { itemKey: "google", title: "🔎 Google Entegrasyonu", category: "Google", description: "Google Ads, Analytics ve Maps bağlantı ayarlarının hazır olup olmadığını kontrol eder." },
  { itemKey: "reports", title: "📊 Raporlama Sistemi", category: "Raporlama", description: "Rapor oluşturma, yayınlama, görünürlük ve dışa aktarma akışlarını doğrular." },
  { itemKey: "tasks", title: "✅ Görev Yönetimi", category: "Görevler", description: "Görev oluşturma, durum güncelleme, gecikme ve tamamlanma akışlarını kontrol eder." },
  { itemKey: "payments", title: "💰 Tahsilat ve Ödemeler", category: "Tahsilat", description: "Bekleyen, ödenmiş, gecikmiş ve iptal edilmiş ödeme kayıtlarını kontrol eder." },
  { itemKey: "customerPortal", title: "👤 Müşteri Paneli", category: "Müşteri Paneli", description: "Müşteriye açık rapor, belge, ödeme ve kampanya görünürlüğünü doğrular." },
  { itemKey: "notifications", title: "🔔 Bildirim Merkezi", category: "Bildirimler", description: "Bildirimlerin, uyarıların ve işlem sonrası bilgilendirmelerin çalıştığını kontrol eder." },
  { itemKey: "aiServices", title: "🤖 Yapay Zeka Servisleri", category: "AI", description: "HK Copilot, AI denetim ve yorumlama servislerinin yanıt verebildiğini kontrol eder." },
  { itemKey: "databaseHealth", title: "🗄️ Veritabanı Sağlığı", category: "Supabase", description: "Temel tabloların okunabildiğini ve kayıt akışlarının sağlıklı olduğunu doğrular." },
  { itemKey: "roles", title: "🔑 Yetki ve Roller", category: "Yetkilendirme", description: "Admin, yönetici ve müşteri izinlerinin doğru sınırlandığını kontrol eder." },
  { itemKey: "websiteManagement", title: "🌐 Web Sitesi Yönetimi", category: "Web Sitesi", description: "Web sitesi içerik, paket, marka ve görsel yönetimi alanlarının erişilebilir olduğunu kontrol eder." },
  { itemKey: "mediaLibrary", title: "📁 Medya Kütüphanesi", category: "Medya", description: "Medya, belge ve dosya kayıtlarının yönetilebilir olduğunu doğrular." },
  { itemKey: "metaDataSync", title: "📈 Meta Veri Senkronizasyonu", category: "Meta", description: "Meta verilerinin çekilip kampanya metriklerine aktarılabildiğini kontrol eder." },
  { itemKey: "googleDataSync", title: "📉 Google Veri Senkronizasyonu", category: "Google", description: "Google reklam/veri senkronizasyonu için gerekli ayarların hazır olduğunu kontrol eder." },
  { itemKey: "formsLeads", title: "📨 Form ve Lead Sistemi", category: "Lead", description: "Form başvuruları, lead kayıtları ve takip akışlarının çalıştığını doğrular." },
  { itemKey: "pdfTurkishExport", title: "🖨️ PDF Türkçe Karakter Testi", category: "Raporlama", description: "PDF çıktılarında İşletme, müşteri, gösterim, tıklama ve öneri gibi Türkçe metinlerin doğru göründüğünü kontrol eder." },
  { itemKey: "wordTurkishExport", title: "📄 Word Türkçe Karakter Testi", category: "Raporlama", description: "Word çıktılarında AI yorumları, rapor notları ve müşteri adlarının Türkçe karakterlerle bozulmadan açıldığını doğrular." },
  { itemKey: "excelTurkishExport", title: "📊 Excel Türkçe Karakter Testi", category: "Raporlama", description: "Excel başlık ve hücrelerinde Müşteri, Kampanya, Harcama, Gösterim, Dönüşüm ve Açıklama alanlarının doğru yazıldığını kontrol eder." },
  { itemKey: "customerPanelVisibility", title: "👁️ Müşteri Paneli Görünürlük Testi", category: "Müşteri Paneli", description: "Müşteri panelinde yalnızca müşteriye görünür rapor, kampanya, ödeme, belge ve notların listelendiğini doğrular." },
  { itemKey: "customerPanelExport", title: "⬇️ Müşteri Paneli Export Testi", category: "Müşteri Paneli", description: "Müşteri panelinden PDF, Word ve Excel indirme akışlarının güvenli ve Türkçe uyumlu çalıştığını kontrol eder." }
];

function scoreSystemTests(results: any[]) {
  const total = Math.max(results.length, 1);
  const success = results.filter((item) => item.status === "Başarılı").length;
  const warning = results.filter((item) => item.status === "Uyarı").length;
  const error = results.filter((item) => item.status === "Hata").length;
  const raw = success * 1 + warning * -0.5 + error * -2;
  const score = Math.max(0, Math.min(100, Math.round((raw / total) * 100)));
  const label = score >= 95 ? "Mükemmel" : score >= 85 ? "Çok İyi" : score >= 70 ? "İyi" : score >= 50 ? "Zayıf" : "Kritik";
  const emoji = score >= 85 ? "🟢" : score >= 70 ? "🟡" : score >= 50 ? "🟠" : "🔴";
  return { score, label, emoji, total, success, warning, error };
}

function buildSystemTests(content: any, currentSession: any, systemStatus: any, supabaseConfigured: boolean) {
  const api = content.settings?.api || {};
  const companies = content.companies || [];
  const leads = content.leads || [];
  const campaigns = content.campaigns || [];
  const campaignMetrics = content.campaignMetrics || [];
  const payments = content.paymentRecords || [];
  const tasks = content.agencyTasks || [];
  const reports = [...(content.reports || []), ...(content.monthlyReports || [])];
  const visibility = content.customerReportVisibility || [];
  const logs = content.activityLogs || [];
  const metaMetrics = campaignMetrics.filter((metric: any) => String(metric.source || "").toLocaleLowerCase("tr").includes("meta") || metric.meta_campaign_id);
  const mappedMetaCampaigns = campaigns.filter((campaign: any) => campaign.meta_campaign_id || campaign.external_id);
  const mappedMetricCount = metaMetrics.filter((metric: any) => metric.campaign_id).length;
  const googleReady = Boolean(api.google_ads_developer_token || api.google_ads_key || api.google_ads_customer_id || api.google_maps_api_key || api.google_maps_key);
  const metaReady = Boolean(api.meta_access_token || api.meta_business_id || api.meta_ad_account_id);
  const today = new Date().toISOString().slice(0, 10);
  const overduePayments = payments.filter((payment: any) => payment.status !== "Ödendi" && payment.due_date && dateOnly(payment.due_date) < today);
  const overdueTasks = tasks.filter((task: any) => !["Tamamlandı", "İptal"].includes(task.status) && task.due_date && dateOnly(task.due_date) < today);
  const missingCustomerMappings = companies.filter((company: any) => {
    const hasCampaign = campaigns.some((campaign: any) => campaign.company_id === company.id);
    const hasReport = reports.some((report: any) => report.company_id === company.id);
    return !hasCampaign && !hasReport;
  }).length;
  const result = (category: string, name: string, status: string, message: string, solution: string, priority = status === "Hata" ? "Yüksek" : status === "Uyarı" ? "Orta" : "Düşük") => ({
    id: `${category}-${name}`.replace(/\s+/g, "-").toLocaleLowerCase("tr"),
    category,
    name,
    status,
    message,
    module: systemTestCategories.find(([key]) => key === category)?.[1] || category,
    impact: status === "Başarılı" ? "Operasyon beklenen şekilde çalışabilir." : message,
    priority,
    solution
  });
  return [
    result("auth", "Admin oturumu", currentSession?.role === "admin" ? "Başarılı" : "Uyarı", currentSession ? `Aktif rol: ${currentSession.role || "bilinmiyor"}.` : "Aktif oturum okunamadı.", "Digital Center oturum ve rol yapılandırmasını kontrol edin."),
    result("supabase", "Supabase bağlantısı", supabaseConfigured ? "Başarılı" : "Hata", supabaseConfigured ? "Supabase ortam değişkenleri yapılandırılmış." : "Supabase bağlantısı yapılandırılmamış.", "Supabase URL ve service role ortam değişkenlerini kontrol edin."),
    result("supabase", "Temel tablolar", companies.length || leads.length || campaigns.length ? "Başarılı" : "Uyarı", "Müşteri, lead veya kampanya kayıtları veri merkezinde okunuyor.", "Canlı şemada companies, leads ve campaigns tablolarını kontrol edin."),
    result("dashboard", "Dashboard verisi", companies.length || payments.length || tasks.length ? "Başarılı" : "Uyarı", "Dashboard için müşteri, tahsilat veya görev verisi beklenir.", "Örnek müşteri, görev veya tahsilat kaydı oluşturun."),
    result("customers", "Müşteri kayıtları", companies.length ? "Başarılı" : "Uyarı", `${companies.length} müşteri kaydı yüklendi.`, "Müşteri modülünden aktif müşteri kaydı ekleyin."),
    result("customers", "Müşteri eşleşmeleri", missingCustomerMappings ? "Uyarı" : "Başarılı", missingCustomerMappings ? `${missingCustomerMappings} müşteri kampanya/rapor bağlantısı olmadan duruyor.` : "Müşteri bağlantılarında kritik eksik görünmüyor.", "Müşteri profilinden kampanya veya rapor eşleştirmelerini tamamlayın."),
    result("payments", "Tahsilat kayıtları", payments.length ? "Başarılı" : "Uyarı", `${payments.length} tahsilat kaydı bulundu.`, "Tahsilat modülünden ödeme kaydı ekleyin."),
    result("payments", "Geciken tahsilatlar", overduePayments.length ? "Uyarı" : "Başarılı", overduePayments.length ? `${overduePayments.length} geciken tahsilat var.` : "Geciken tahsilat görünmüyor.", "Tahsilat merkezinden ödeme durumlarını güncelleyin."),
    result("campaigns", "Kampanya kayıtları", campaigns.length ? "Başarılı" : "Uyarı", `${campaigns.length} kampanya kaydı bulundu.`, "Kampanyalar modülünden kampanya oluşturun."),
    result("campaigns", "Kampanya eşleştirme", metaMetrics.length && !mappedMetaCampaigns.length ? "Hata" : mappedMetaCampaigns.length ? "Başarılı" : "Uyarı", metaMetrics.length ? `${mappedMetricCount}/${metaMetrics.length} Meta metrik satırı kampanyaya bağlı.` : "Meta metrik verisi henüz yok.", "Reklam Hesabı Eşleştirme veya müşteri profilinden kampanya eşleştirmesini tamamlayın."),
    result("meta", "Meta yapılandırması", metaReady ? "Başarılı" : "Uyarı", metaReady ? "Meta ayarları kısmen/ tamamen yapılandırılmış." : "Meta token veya hesap ID alanları eksik.", "Entegrasyonlar ekranında Meta ayarlarını kaydedin."),
    result("meta", "Meta metrikleri", metaMetrics.length ? "Başarılı" : "Uyarı", `${metaMetrics.length} Meta metrik kaydı bulundu.`, "Müşteri profilinden Meta Verilerini Çek işlemini çalıştırın."),
    result("google", "Google yapılandırması", googleReady ? "Başarılı" : "Uyarı", googleReady ? "Google ayarları kısmen/ tamamen yapılandırılmış." : "Google Ads / Maps yapılandırması eksik.", "Entegrasyonlar ekranında Google ayarlarını kaydedin."),
    result("reports", "Rapor kayıtları", reports.length ? "Başarılı" : "Uyarı", `${reports.length} rapor kaydı bulundu.`, "Raporlama merkezinden müşteri raporu oluşturun."),
    result("reports", "Müşteri görünürlüğü", visibility.length ? "Başarılı" : "Uyarı", visibility.length ? `${visibility.length} görünürlük kuralı var.` : "Rapor/metrik görünürlük ayarı bulunamadı.", "Müşteri profilinden Müşteriye Gösterilecekler ayarını kaydedin."),
    result("copilot", "HK Copilot veri zemini", logs.length || companies.length ? "Başarılı" : "Uyarı", "Copilot için müşteri ve aktivite verisi kontrol edildi.", "Aktivite logları ve müşteri verilerini besleyin."),
    result("notifications", "Bildirim zemini", logs.length ? "Başarılı" : "Uyarı", `${logs.length} aktivite/log kaydı bulundu.`, "Aktivite ve bildirim kayıtlarının oluştuğunu kontrol edin."),
    result("system", "Görev gecikmeleri", overdueTasks.length ? "Uyarı" : "Başarılı", overdueTasks.length ? `${overdueTasks.length} geciken görev var.` : "Geciken görev görünmüyor.", "Görevler ekranında tarih ve durumları güncelleyin."),
    result("system", "AI sağlayıcı durumu", systemStatus?.openai || systemStatus?.groq || systemStatus?.gemini ? "Başarılı" : "Uyarı", "AI sağlayıcı ortam değişkenleri kontrol edildi.", "OpenAI, Groq veya Gemini anahtarlarından en az birini server tarafında yapılandırın.")
  ];
}

function systemAuditIssues(results: any[]) {
  return results.filter((item) => item.status !== "Başarılı").map((item) => ({
    id: item.id,
    issue: item.name,
    module: item.module,
    impact: item.impact,
    priority: item.priority,
    solution: item.solution
  }));
}

function downloadSystemTestFile(format: "pdf" | "excel" | "word", run: any) {
  const timestamp = new Date().toLocaleString("tr-TR");
  const title = `HK Sistem Test Raporu - ${timestamp}`;
  const rows = [
    title,
    `Skor: ${run.score}/100`,
    `Durum: ${run.status}`,
    `Toplam Test: ${run.total_tests}`,
    `Başarılı: ${run.success_count}`,
    `Uyarı: ${run.warning_count}`,
    `Hata: ${run.error_count}`,
    "",
    "Sonuçlar:",
    ...(run.results || []).map((item: any) => `${item.status} | ${item.module} | ${item.name} | ${item.message}`),
    "",
    "Öneriler:",
    ...(run.issues || []).map((item: any) => `${item.priority} | ${item.issue} | ${item.solution}`)
  ];
  const safe = (value: any) => String(value ?? "").replace(/[<>&]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[char] || char);
  let blob: Blob;
  let extension = format;
  if (format === "excel") {
    extension = "xls";
    blob = new Blob([`<table>${rows.map((row) => `<tr><td>${safe(row)}</td></tr>`).join("")}</table>`], { type: "application/vnd.ms-excel;charset=utf-8" });
  } else if (format === "word") {
    extension = "doc";
    blob = new Blob([`<html><body><h1>${safe(title)}</h1>${rows.map((row) => `<p>${safe(row)}</p>`).join("")}</body></html>`], { type: "application/msword;charset=utf-8" });
  } else {
    const text = rows.join("\n");
    const escaped = text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    const stream = `BT /F1 10 Tf 48 790 Td 12 TL (${escaped.slice(0, 2600).replace(/\n/g, ") Tj T* (")}) Tj ET`;
    const objects = [
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
      "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
      "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
      "4 0 obj << /Type /Font /Subtype /Helvetica /BaseFont /Helvetica >> endobj",
      `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object) => {
      offsets.push(pdf.length);
      pdf += `${object}\n`;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    blob = new Blob([pdf], { type: "application/pdf" });
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `HK-Sistem-Test-Raporu-${new Date().toISOString().slice(0, 10)}.${extension}`;
  link.click();
  URL.revokeObjectURL(url);
}

function SystemTestCenter({ content, setContent, save, currentSession, notify, systemStatus, supabaseConfigured }: any) {
  const [running, setRunning] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const storedChecklist = content.systemTestChecklist || [];
  const checklist = systemChecklistDefaults.map(({ itemKey, title, category, description }, index) => {
    const existing = storedChecklist.find((item: any) => item.item_key === itemKey || item.itemKey === itemKey);
    return { ...(existing || {}), id: existing?.id || createLocalId(), item_key: itemKey, title, category, description, status: existing?.status || "Bekliyor", notes: existing?.notes || "", sort_order: index };
  });
  const latestRun = (content.systemTestRuns || [])[0];
  const currentResults = latestRun?.results?.length ? latestRun.results : buildSystemTests(content, currentSession, systemStatus, supabaseConfigured);
  const score = scoreSystemTests(currentResults);
  const issues = latestRun?.issues?.length ? latestRun.issues : systemAuditIssues(currentResults);
  const grouped = systemTestCategories.map(([key, label]) => ({ key, label, items: currentResults.filter((item: any) => item.category === key) }));
  const runPayload = (results: any[], extra: any = {}) => {
    const calculated = scoreSystemTests(results);
    const run = {
      id: createLocalId(),
      score: calculated.score,
      status: calculated.label,
      total_tests: calculated.total,
      success_count: calculated.success,
      warning_count: calculated.warning,
      error_count: calculated.error,
      tester_id: currentSession?.userId || currentSession?.id || null,
      tester_name: currentSession?.email || currentSession?.name || "Admin",
      summary: `Sistem testleri ${calculated.score}/100 skorla tamamlandı.`,
      results,
      issues: systemAuditIssues(results),
      recommendations: systemAuditIssues(results).map((item) => ({ title: item.issue, recommendation: item.solution })),
      export_payload: { generated_at: new Date().toISOString(), ...extra },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return run;
  };
  async function runAllTests() {
    setRunning(true);
    notify("Test Başladı", "info");
    const results = buildSystemTests(content, currentSession, systemStatus, supabaseConfigured);
    const run = runPayload(results, { type: "automatic" });
    const next = { ...content, systemTestRuns: [run, ...(content.systemTestRuns || [])].slice(0, 50) };
    setContent(next);
    await save(next);
    setSelectedRun(run);
    setRunning(false);
    notify("Test Tamamlandı", run.error_count ? "warning" : "success");
  }
  async function updateChecklist(itemKey: string, status: string) {
    const now = new Date().toISOString();
    const nextChecklist = checklist.map((item: any) => item.item_key === itemKey ? {
      ...item,
      status,
      tester_id: currentSession?.userId || currentSession?.id || null,
      tester_name: currentSession?.email || currentSession?.name || "Admin",
      last_tested_at: now,
      updated_at: now
    } : item);
    const next = { ...content, systemTestChecklist: nextChecklist };
    setContent(next);
    await save(next);
  }
  async function runAiAudit() {
    setAiLoading(true);
    notify("AI Sistem Denetimi Başlatıldı", "info");
    const results = buildSystemTests(content, currentSession, systemStatus, supabaseConfigured);
    const localIssues = systemAuditIssues(results);
    const prompt = `HK Operating System için sistem denetimi yap. Sorun, Etki, Önerilen Çözüm formatında Türkçe özetle:\n${JSON.stringify(localIssues.slice(0, 12))}`;
    let aiSummary = localIssues.map((item) => `Sorun: ${item.issue}\nEtki: ${item.impact}\nÇözüm: ${item.solution}`).join("\n\n");
    try {
      const response = await fetch("/api/admin/ai-generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, task: "system-audit" }) });
      const data = await response.json().catch(() => ({}));
      aiSummary = data.text || data.output || data.result || aiSummary;
    } catch {
      aiSummary = `${aiSummary}\n\nAI sağlayıcı yanıt vermediği için yerel denetim özeti kullanıldı.`;
    }
    const run = runPayload(results, { type: "ai-audit", ai_summary: aiSummary });
    const next = { ...content, systemTestRuns: [run, ...(content.systemTestRuns || [])].slice(0, 50) };
    setContent(next);
    await save(next);
    setSelectedRun({ ...run, aiSummary });
    setAiLoading(false);
    notify("AI denetimi tamamlandı", run.error_count ? "warning" : "success");
  }
  async function deleteRun(id: string) {
    const markedRuns = (content.systemTestRuns || []).map((run: any) => run.id === id ? { ...run, deleted_at: new Date().toISOString() } : run);
    setContent({ ...content, systemTestRuns: markedRuns.filter((run: any) => !run.deleted_at) });
    await save({ ...content, systemTestRuns: markedRuns });
    notify("Test geçmişi silindi", "success");
  }
  const exportRun = selectedRun || latestRun || runPayload(currentResults, { type: "preview" });
  const statusClass = (status: string) => status === "Başarılı" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "Hata" ? "border-red-200 bg-red-50 text-red-700" : status === "Uyarı" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-600";
  return <Panel title="Sistem Test Merkezi">
    <div className="mb-6 rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,.06)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-700">Merkezi kalite kontrol</p>
          <h3 className="mt-2 text-3xl font-black text-slate-950">Sistem Sağlık Skoru: {score.score} / 100</h3>
          <p className="mt-2 text-sm font-semibold text-slate-600">{score.emoji} {score.label} · Son sonuçlara göre hesaplandı.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button disabled={running} onClick={runAllTests} className="rounded-[14px] bg-cyan-500 px-4 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(6,182,212,.24)] disabled:opacity-60">{running ? "Testler çalışıyor..." : "Tüm Testleri Çalıştır"}</button>
          <button disabled={aiLoading} onClick={runAiAudit} className="rounded-[14px] bg-violet-600 px-4 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(124,58,237,.22)] disabled:opacity-60">{aiLoading ? "Denetleniyor..." : "AI Sistem Denetimi Başlat"}</button>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[["Toplam Test", score.total, "bg-slate-100 text-slate-700"], ["Başarılı", score.success, "bg-emerald-100 text-emerald-700"], ["Uyarı", score.warning, "bg-amber-100 text-amber-700"], ["Hata", score.error, "bg-red-100 text-red-700"]].map(([label, value, cls]) => <div key={label} className="rounded-[18px] border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p><span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black ${cls}`}>{label}</span></div>)}
      </div>
    </div>

    <div className="mb-6 grid gap-4 xl:grid-cols-3">
      <div className="xl:col-span-2 rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,.06)]">
        <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-lg font-black text-slate-950">Test Kategorileri</h3><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{systemTestCategories.length} grup</span></div>
        <div className="grid gap-3 md:grid-cols-2">
          {grouped.map((group) => {
            const groupScore = scoreSystemTests(group.items);
            return <div key={group.key} className="rounded-[18px] border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><h4 className="font-black text-slate-900">{group.label}</h4><span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${groupScore.error ? "border-red-200 bg-red-50 text-red-700" : groupScore.warning ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{groupScore.score}/100</span></div><div className="mt-3 grid gap-2">{group.items.map((item: any) => <div key={item.id} className="flex items-start justify-between gap-3 rounded-[14px] bg-white p-3"><div><p className="text-sm font-black text-slate-900">{item.name}</p><p className="mt-1 text-xs leading-5 text-slate-600">{item.message}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black ${statusClass(item.status)}`}>{item.status}</span></div>)}</div></div>;
          })}
        </div>
      </div>
      <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,.06)]">
        <h3 className="text-lg font-black text-slate-950">Hata Analizi</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">Uyarı ve hatalar için etki, öncelik ve çözüm önerileri.</p>
        <div className="mt-4 grid gap-3">
          {issues.slice(0, 8).map((issue: any) => <div key={issue.id} className="rounded-[16px] border border-amber-200 bg-amber-50 p-3"><p className="text-sm font-black text-slate-950">Sorun: {issue.issue}</p><p className="mt-1 text-xs font-bold text-amber-700">Modül: {issue.module} · Öncelik: {issue.priority}</p><p className="mt-2 text-xs leading-5 text-slate-700">Etki: {issue.impact}</p><p className="mt-1 text-xs leading-5 text-slate-700">Çözüm: {issue.solution}</p></div>)}
          {!issues.length && <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">Kritik uyarı görünmüyor.</div>}
        </div>
      </div>
    </div>

    <div className="mb-6 grid gap-4 xl:grid-cols-2">
      <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,.06)]">
        <h3 className="text-lg font-black text-slate-950">Manuel Test Kontrol Listesi</h3>
        <p className="mt-2 text-sm text-slate-600">Admin elle doğrulama yapabilir. Durumlar kalıcı olarak saklanır.</p>
        <div className="mt-4 grid gap-3">
          {checklist.map((item: any) => {
            const badgeClass = item.status === "Başarılı" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : item.status === "Başarısız" ? "bg-red-100 text-red-700 border-red-200" : "bg-slate-100 text-slate-700 border-slate-200";
            return <div key={item.item_key} className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_8px_26px_rgba(15,23,42,.05)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-black leading-6 text-slate-950">{item.title}</p>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${badgeClass}`}>{item.status || "Bekliyor"}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">{item.category} · Son test: {item.last_tested_at ? formatDateTime(item.last_tested_at) : "Henüz test edilmedi"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["Bekliyor", "Başarılı", "Başarısız"].map((status) => <button key={status} onClick={() => updateChecklist(item.item_key, status)} className={`rounded-full px-3 py-2 text-xs font-black transition hover:-translate-y-0.5 ${item.status === status ? status === "Başarılı" ? "bg-emerald-500 text-white shadow-[0_8px_18px_rgba(34,197,94,.18)]" : status === "Başarısız" ? "bg-red-500 text-white shadow-[0_8px_18px_rgba(239,68,68,.18)]" : "bg-slate-700 text-white shadow-[0_8px_18px_rgba(15,23,42,.16)]" : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"}`}>{status}</button>)}
                </div>
              </div>
            </div>;
          })}
        </div>
      </div>
      <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-black text-slate-950">Dışa Aktarma</h3><p className="mt-2 text-sm text-slate-600">Skor, test sonuçları, uyarılar, hatalar ve öneriler tarih damgasıyla dışa aktarılır.</p></div><span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700">PDF · Excel · Word</span></div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => { downloadSystemTestFile("pdf", exportRun); notify("PDF Oluşturuldu", "success"); }} className="rounded-[14px] bg-amber-400 px-4 py-3 text-sm font-black text-slate-950">PDF İndir</button>
          <button onClick={() => { downloadSystemTestFile("excel", exportRun); notify("Excel Oluşturuldu", "success"); }} className="rounded-[14px] bg-emerald-500 px-4 py-3 text-sm font-black text-white">Excel İndir</button>
          <button onClick={() => { downloadSystemTestFile("word", exportRun); notify("Word Oluşturuldu", "success"); }} className="rounded-[14px] bg-blue-600 px-4 py-3 text-sm font-black text-white">Word İndir</button>
        </div>
        {selectedRun?.aiSummary && <div className="mt-4 rounded-[16px] border border-violet-200 bg-violet-50 p-4"><p className="text-sm font-black text-violet-700">AI Denetim Özeti</p><pre className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-700">{selectedRun.aiSummary}</pre></div>}
      </div>
    </div>

    <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,.06)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-black text-slate-950">Test Geçmişi</h3><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{(content.systemTestRuns || []).length} kayıt</span></div>
      <div className="premium-scrollbar max-h-[420px] overflow-auto rounded-[16px] border border-slate-200">
        <table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-[.12em] text-slate-500"><tr><th className="p-3">Tarih</th><th className="p-3">Skor</th><th className="p-3">Uyarı</th><th className="p-3">Hata</th><th className="p-3">Test Eden</th><th className="p-3">İşlem</th></tr></thead><tbody>{(content.systemTestRuns || []).map((run: any) => <tr key={run.id} className="border-t border-slate-200"><td className="p-3 text-slate-600">{formatDateTime(run.created_at)}</td><td className="p-3 font-black text-slate-950">{run.score}/100 · {run.status}</td><td className="p-3 text-amber-700">{run.warning_count || 0}</td><td className="p-3 text-red-700">{run.error_count || 0}</td><td className="p-3 text-slate-600">{run.tester_name || "Admin"}</td><td className="p-3"><div className="flex gap-2"><button onClick={() => setSelectedRun(run)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-700">View</button><button onClick={() => deleteRun(run.id)} className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-black text-white">Delete</button></div></td></tr>)}{!(content.systemTestRuns || []).length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Henüz test geçmişi yok.</td></tr>}</tbody></table>
      </div>
    </div>
  </Panel>;
}

function SystemHealthCenter({ content, startupApiData, runStartupApiStatus, startupApiLoading }: any) {
  const api = content.settings?.api || {};
  const aiStatuses = startupApiData?.results || api.ai_status || {};
  const healthItems = [
    ["Supabase", "Bağlı", "Veri ve oturum altyapısı", api.ai_status_last_test_at || startupApiData?.lastTestTime],
    ["Meta API", api.meta_access_token ? "Bağlı" : "Uyarı", api.meta_access_token ? "Meta token yapılandırılmış." : "Meta token eksik veya test bekliyor.", api.meta_last_success_at || api.meta_last_error_at],
    ["Google API", api.google_maps_api_key || api.google_ads_customer_id ? "Bağlı" : "Uyarı", "Maps / Ads bağlantı ayarları", api.google_last_success_at || startupApiData?.lastTestTime],
    ["OpenAI", aiStatuses.openai?.status === "Aktif" ? "Bağlı" : "Uyarı", aiStatuses.openai?.warning || "OpenAI bağlantı durumu", aiStatuses.openai?.lastTestTime],
    ["Groq", aiStatuses.groq?.status === "Aktif" ? "Bağlı" : "Uyarı", aiStatuses.groq?.warning || "Groq bağlantı durumu", aiStatuses.groq?.lastTestTime],
    ["SMTP", api.smtp_host ? "Bağlı" : "Uyarı", api.smtp_host ? "SMTP ayarı mevcut." : "SMTP ayarı eksik.", api.smtp_last_success_at],
    ["WhatsApp", api.whatsapp_token || api.whatsapp_phone_number_id ? "Bağlı" : "Uyarı", api.whatsapp_token || api.whatsapp_phone_number_id ? "WhatsApp ayarı mevcut." : "WhatsApp ayarı eksik.", api.whatsapp_last_success_at],
    ["Storage", "Bağlı", "Medya ve belge kayıtları mevcut veri sistemi üzerinden izlenir.", startupApiData?.lastTestTime]
  ];
  const statusClass = (status: string) => status === "Bağlı" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-700" : status === "Hata" ? "border-red-300/20 bg-red-300/10 text-red-100" : "border-amber-300/20 bg-amber-300/10 text-amber-700";
  return <Panel title="Sistem Sağlığı"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="max-w-3xl text-sm leading-6 text-slate-400">API ve altyapı bağlantılarını güvenli şekilde izleyin. Gizli anahtarlar tarayıcıda gösterilmez; sadece durum bilgisi görünür.</p><button disabled={startupApiLoading} onClick={runStartupApiStatus} className="rounded-[8px] bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-60">{startupApiLoading ? "Test ediliyor..." : "Bağlantıyı Test Et"}</button></div><div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{healthItems.map(([label, status, description, lastCheck]) => <div key={label} className={`rounded-[8px] border p-4 ${statusClass(String(status))}`}><div className="flex items-center justify-between gap-3"><h3 className="font-black text-slate-900">{label}</h3><span className="rounded-full border border-current/20 px-2 py-1 text-[10px] font-black">{status}</span></div><p className="mt-3 text-xs leading-5 opacity-90">{description}</p><p className="mt-3 text-[11px] leading-5 opacity-75">Son kontrol zamanı: {lastCheck ? new Date(String(lastCheck)).toLocaleString("tr-TR") : "Henüz kontrol edilmedi"}</p></div>)}</div><div className="mb-5"><ReadinessPanel api={api} /></div><AiStatusCenterWidget statuses={aiStatuses} message={startupApiData?.lastTestTime ? `Son genel kontrol: ${new Date(startupApiData.lastTestTime).toLocaleString("tr-TR")}` : "Bağlantı testi bekleniyor."} loading={startupApiLoading} onRefresh={runStartupApiStatus} /></Panel>;
}

function ExportCenter({ content }: any) {
  const [dataset, setDataset] = useState("companies");
  const [companyFilter, setCompanyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const exportSets = [
    ["companies", "Müşteriler", content.companies || [], "/hk-admin/musteriler"],
    ["campaigns", "Kampanyalar", content.campaigns || [], "/hk-admin/kampanyalar"],
    ["agencyTasks", "Görevler", content.agencyTasks || [], "/hk-admin/gorevler"],
    ["paymentRecords", "Tahsilatlar", content.paymentRecords || [], "/hk-admin/tahsilat"],
    ["customerDocuments", "Belgeler", content.customerDocuments || [], "/hk-admin/belgeler"],
    ["reports", "Raporlar", content.reports || [], "/hk-admin/musteri-raporlari"]
  ];
  const selected = exportSets.find(([key]) => key === dataset) || exportSets[0];
  const records = (selected[2] as any[]).filter((item) => {
    if (companyFilter && item.company_id !== companyFilter && item.id !== companyFilter) return false;
    if (statusFilter && item.status !== statusFilter && item.report_type !== statusFilter && item.document_type !== statusFilter) return false;
    const date = dateOnly(item.created_at || item.updated_at || item.start_date || item.due_date || item.document_date || item.report_month);
    if (startDate && date && date < startDate) return false;
    if (endDate && date && date > endDate) return false;
    return true;
  });
  const statusOptionsForSet = Array.from(new Set((selected[2] as any[]).map((item) => item.status || item.report_type || item.document_type).filter(Boolean)));
  function download(format: "csv" | "excel") {
    const rows = records.map((item) => ({ ...item, customer_name: companyName(content, item.company_id || item.id) }));
    const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 40);
    const contentText = format === "csv" ? toCsv(rows, columns) : toExcelTable(rows, columns);
    const blob = new Blob([contentText], { type: format === "csv" ? "text/csv;charset=utf-8" : "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `HK-Dijital-${selected[1]}-${new Date().toISOString().slice(0, 10)}.${format === "csv" ? "csv" : "xls"}`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return <Panel title="Veri Aktarma"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="max-w-3xl text-sm leading-6 text-slate-400">Müşteri, kampanya, görev, tahsilat, belge ve rapor kayıtlarını mevcut veri kaynaklarından dışa aktarın. Bu ekran yeni kayıt oluşturmaz.</p><span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-xs font-black text-cyan-700">{records.length} kayıt hazır</span></div><div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5"><SelectField label="Veri türü" value={dataset} onChange={setDataset} options={exportSets.map(([value, label]) => ({ value, label }))} /><CompanySelect value={companyFilter} onChange={setCompanyFilter} companies={content.companies} label="Müşteri filtresi" /><SelectField label="Durum" value={statusFilter} onChange={setStatusFilter} options={statusOptionsForSet} placeholder="Tüm durumlar" /><Field label="Başlangıç tarihi" type="date" value={startDate} onChange={setStartDate} /><Field label="Bitiş tarihi" type="date" value={endDate} onChange={setEndDate} /></div><div className="mb-5 flex flex-wrap gap-2"><button onClick={() => download("csv")} className="rounded-[8px] bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950">CSV indir</button><button onClick={() => download("excel")} className="rounded-[8px] border border-emerald-300/30 px-4 py-3 text-sm font-black text-emerald-700">Excel indir</button><button onClick={() => window.print()} className="rounded-[8px] border border-slate-200 px-4 py-3 text-sm font-black text-slate-700">PDF özet yazdır</button><Link href={selected[3] as string} className="rounded-[8px] border border-slate-200 px-4 py-3 text-sm font-black text-slate-700">Kaynağı aç</Link></div><div className="premium-scrollbar max-h-[520px] overflow-auto rounded-[8px] border border-slate-200"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-[.12em] text-slate-400"><tr><th className="p-3">Tür</th><th className="p-3">Başlık</th><th className="p-3">Müşteri</th><th className="p-3">Durum</th><th className="p-3">Tarih</th></tr></thead><tbody>{records.slice(0, 100).map((item, index) => <tr key={item.id || index} className="border-t border-slate-200"><td className="p-3">{selected[1]}</td><td className="p-3 font-bold text-slate-900">{item.name || item.title || item.report_type || `${item.amount || 0} TL`}</td><td className="p-3 text-slate-600">{companyName(content, item.company_id || item.id)}</td><td className="p-3 text-slate-600">{item.status || item.report_type || item.document_type || "-"}</td><td className="p-3 text-slate-400">{formatDate(item.created_at || item.updated_at || item.start_date || item.due_date || item.document_date || item.report_month)}</td></tr>)}{!records.length && <tr><td colSpan={5} className="p-6 text-center text-slate-400">Bu filtrelerle dışa aktarılacak kayıt bulunamadı.</td></tr>}</tbody></table></div></Panel>;
}

function toCsv(rows: any[], columns: string[]) {
  const escape = (value: any) => `"${String(typeof value === "object" && value !== null ? JSON.stringify(value) : value ?? "").replace(/"/g, '""')}"`;
  return [columns.join(","), ...rows.map((row) => columns.map((column) => escape(row[column])).join(","))].join("\n");
}

function toExcelTable(rows: any[], columns: string[]) {
  const escape = (value: any) => String(typeof value === "object" && value !== null ? JSON.stringify(value) : value ?? "").replace(/[<>&]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[char] || char);
  return `<table><thead><tr>${columns.map((column) => `<th>${escape(column)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((column) => `<td>${escape(row[column])}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function Overview({ content, setActive, supabaseConfigured, systemStatus = {}, currentSession, allowedModules = [], notify }: any) {
  const leads = useMemo(() => content.leads ?? [], [content.leads]);
  const companies = useMemo(() => content.companies ?? [], [content.companies]);
  const campaigns = useMemo(() => content.campaigns ?? [], [content.campaigns]);
  const metrics = useMemo(() => content.campaignMetrics ?? [], [content.campaignMetrics]);
  const updates = useMemo(() => content.customerUpdates ?? [], [content.customerUpdates]);
  const users = useMemo(() => content.users ?? [], [content.users]);
  const reports = useMemo(() => content.reports ?? [], [content.reports]);
  const activityLogs = useMemo(() => content.activityLogs ?? [], [content.activityLogs]);
  const agencyTasks = useMemo(() => content.agencyTasks ?? [], [content.agencyTasks]);
  const paymentRecords = useMemo(() => content.paymentRecords ?? [], [content.paymentRecords]);
  const agencyExpenses = useMemo(() => content.agencyExpenses ?? [], [content.agencyExpenses]);
  const [demoMessage, setDemoMessage] = useState("");
  const [demoLoading, setDemoLoading] = useState(false);
  const [dashboardAssistantPrompt, setDashboardAssistantPrompt] = useState("");
  const [dashboardAssistantAnswer, setDashboardAssistantAnswer] = useState("");
  const [dashboardAssistantLoading, setDashboardAssistantLoading] = useState(false);
  const [commandPlan, setCommandPlan] = useState("");
  const [ceoMode, setCeoMode] = useState(false);
  const [activityFilter, setActivityFilter] = useState("Bugün");
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
  const activePayments = paymentRecords.filter((item) => !isArchivedRecord(item));
  const activeTasks = agencyTasks.filter((item) => !isArchivedRecord(item));
  const thisMonthPayments = activePayments.filter((item) => String(item.service_period || item.due_date || "").startsWith(month));
  const expectedRevenue = thisMonthPayments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const paidRevenue = thisMonthPayments.filter((item) => item.status === "Ödendi").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const pendingRevenue = thisMonthPayments.filter((item) => item.status !== "Ödendi" && item.status !== "İptal").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const overduePayments = activePayments.filter((item) => item.status === "Gecikmiş");
  const monthExpenses = agencyExpenses.filter((item) => String(item.expense_date || "").startsWith(month));
  const estimatedProfit = expectedRevenue - monthExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const todaysTasks = activeTasks.filter((item) => item.due_date === today && !["Tamamlandı", "İptal"].includes(item.status));
  const overdueTasks = activeTasks.filter((item) => item.due_date && item.due_date < today && !["Tamamlandı", "İptal"].includes(item.status));
  const criticalTasks = activeTasks.filter((item) => item.priority === "Kritik" && !["Tamamlandı", "İptal"].includes(item.status));
  const completedTasks = activeTasks.filter((item) => item.status === "Tamamlandı");
  const overduePaymentTotal = overduePayments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const activeCampaigns = campaigns.filter((item) => !isCampaignArchived(item) && item.status === "Aktif");
  const plannedCampaigns = campaigns.filter((item) => !isCampaignArchived(item) && item.status === "Planlandı");
  const campaignsEndingThisMonth = campaigns.filter((item) => !isCampaignArchived(item) && String(item.end_date || "").startsWith(month));
  const visibleCampaigns = campaigns.filter((item) => !isCampaignArchived(item) && item.visible_to_customer);
  const campaignSpendTotal = campaigns.filter((item) => !isCampaignArchived(item)).reduce((sum, item) => sum + Number(item.spent_budget ?? item.spent ?? 0), 0);
  const metaMetricRows = (content.campaignMetrics || []).filter((item) => item.source === "Meta API" || item.source === "Meta Raporu" || String(item.platform || "").includes("Meta"));
  const metaTotals = summarizeMetaRows(metaMetricRows);
  const activeMetaCampaigns = campaigns.filter((item) => !isCampaignArchived(item) && item.platform === "Meta Ads" && item.status === "Aktif").length;
  const latestCustomer = [...companies].sort((a, b) => Number(new Date(b.created_at || b.updated_at || 0)) - Number(new Date(a.created_at || a.updated_at || 0)))[0];
  const importantDashboardTasks = [...criticalTasks, ...overdueTasks, ...todaysTasks]
    .filter((item, index, list) => list.findIndex((candidate) => (candidate.id || candidate.title) === (item.id || item.title)) === index)
    .slice(0, 5);
  const dashboardAssistantPrompts = ["Bugün neye odaklanmalıyım?", "Geciken tahsilatlar var mı?", "Kritik görevler neler?", "Bu ay kârlılık durumu nasıl?"];

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
    ["Müşteriler", activeCustomers.length, "Hizmeti devam eden firmalar", <Building2 size={17} />, "teal"],
    ["PDF Audit", socialAuditLeads.length, "Sosyal denetimden audit çıktıları", <FileBarChart size={17} />, "coral"],
    ["WhatsApp Teklif", generatedProposals, "Teklif iletişimi için hazır akışlar", <MessageSquareText size={17} />, "lime"],
    ["Bugünkü Görevler", todaysTasks.length, "Bugün tamamlanması gereken operasyon işleri", <CircleCheck size={17} />, "cyan"],
    ["Kritik Görevler", criticalTasks.length, "Öncelikli aksiyon bekleyen görevler", <AlertTriangle size={17} />, "red"],
    ["Geciken Görev", overdueTasks.length, "Takip edilmesi gereken görevler", <AlertTriangle size={17} />, "red"],
    ["Bekleyen Tahsilat", `${pendingRevenue.toLocaleString("tr-TR")} TL`, "Bu ay bekleyen ödeme toplamı", <Gauge size={17} />, "amber"],
    ["Geciken Tahsilat", `${overduePaymentTotal.toLocaleString("tr-TR")} TL`, "Vadesi geçmiş ödeme toplamı", <AlertTriangle size={17} />, "red"],
    ["Bu Ay Ödenen", `${paidRevenue.toLocaleString("tr-TR")} TL`, "Bu ay tahsil edilen toplam", <CircleCheck size={17} />, "emerald"],
    ["Tahmini Kâr", `${estimatedProfit.toLocaleString("tr-TR")} TL`, "Gelir - kayıtlı gider tahmini", <BarChart3 size={17} />, "emerald"],
    ["Aktif Kampanya", activeCampaigns.length, "Yayında görünen kampanyalar", <BarChart3 size={17} />, "cyan"],
    ["Kampanya Harcaması", `${campaignSpendTotal.toLocaleString("tr-TR")} TL`, "Kayıtlı kampanya harcaması", <Gauge size={17} />, "amber"],
    ["Meta Harcama", `${Number(metaTotals.spend || 0).toLocaleString("tr-TR")} TL`, "Meta API / CSV toplam harcama", <BarChart3 size={17} />, "orange"],
    ["Meta Erişim", Number(metaTotals.reach || 0).toLocaleString("tr-TR"), "Toplam erişim", <UsersRound size={17} />, "cyan"],
    ["Meta Tıklama", Number(metaTotals.clicks || 0).toLocaleString("tr-TR"), "Toplam tıklama", <Search size={17} />, "cyan"],
    ["Meta Ortalama CTR", `${metaTotals.impressions ? ((metaTotals.clicks / metaTotals.impressions) * 100).toFixed(2) : "0.00"}%`, "Tıklama oranı", <Gauge size={17} />, "emerald"],
    ["Aktif Meta Kampanya", activeMetaCampaigns, "Aktif Meta Ads kampanyaları", <BarChart3 size={17} />, "orange"]
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
    ["Müşteri Ekle", "Müşteriler", <Building2 size={19} />],
    ["Görev Ekle", "Görevler", <CircleCheck size={19} />],
    ["Tahsilat Takip", "Tahsilat", <Gauge size={19} />],
    ["HK Asistan", "HK Asistan", <Bot size={19} />]
  ].filter(([, target]) => canOpen(target)).sort((a, b) => Number(preferences.favorites.includes(b[1])) - Number(preferences.favorites.includes(a[1])));
  const reportCompanyIds = new Set(reports.map((report) => report.company_id));
  const insightItems = [
    [hotLeads.filter((lead) => !["Kazanıldı", "Kaybedildi", "Dönüştürüldü"].includes(lead.status)).length, "Sıcak başvurular takip bekliyor", "Yüksek fırsat skorlu kayıtları bugün değerlendirin.", "Lead Yönetimi"],
    [leads.filter((lead) => !lead.ai_analysis || !Object.keys(lead.ai_analysis).length).length, "AI analizi eksik başvurular var", "Önceliklendirme için işletme analizlerini oluşturun.", "Lead Yönetimi"],
    [activeCustomers.filter((company) => !reportCompanyIds.has(company.id)).length, "Güncel raporu olmayan müşteriler var", "Müşteri iletişimini güçlendirmek için rapor hazırlayın.", "Raporlar"],
    [leads.filter((lead) => !(Array.isArray(lead.proposal_history) && lead.proposal_history.length) && Number(lead.lead_heat_score || 0) >= 50).length, "Teklif hazırlanabilecek fırsatlar var", "Uygun müşteriler için MIN, ORTA ve MAX seçeneklerini oluşturun.", "Teklif Motoru"],
    [criticalTasks.length, "Kritik görevler var", "Operasyon önceliği yüksek görevleri kapatın.", "Görevler"],
    [overduePayments.length, "Geciken tahsilatlar var", "Müşteri ödeme durumunu takip edin.", "Tahsilat"]
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
  const activeAiMeta = aiMetaFromApi(content.settings?.api || {});
  const latestLeadDate = leads[0]?.created_at || leads[0]?.createdAt;
  const latestAiDate = aiAnalyzedLeads.find((lead) => lead.ai_analysis?.generated_at || lead.ai_analysis?.created_at)?.ai_analysis?.generated_at || aiAnalyzedLeads[0]?.updated_at;
  const liveOperations = [
    ["Yeni lead", leads.length ? `${leads[0]?.company || leads[0]?.name || "Yeni kayıt"} CRM'e eklendi` : "Henüz yeni lead yok", latestLeadDate, "blue"],
    ["CRM aktivitesi", recentActivity[0]?.action || "Operasyon kaydı bekleniyor", recentActivity[0]?.created_at, "indigo"],
    ["AI analizi", aiAnalyzedLeads.length ? `${aiAnalyzedLeads.length} kayıt yorumlandı` : "AI analizi bekleniyor", latestAiDate, "purple"],
    ["PDF üretimi", socialAuditLeads.length ? `${socialAuditLeads.length} sosyal audit hazır` : "PDF audit bekleniyor", socialAuditLeads[0]?.created_at, "rose"],
    ["WhatsApp teklifi", generatedProposals ? `${generatedProposals} teklif geçmişi` : "Teklif akışı bekleniyor", leads.find((lead) => Array.isArray(lead.proposal_history) && lead.proposal_history.length)?.updated_at, "lime"],
    ["API olayı", aiStatusMessage || (content.settings?.api?.ai_status_last_test_at ? "AI bağlantıları test edildi" : "API testi bekleniyor"), content.settings?.api?.ai_status_last_test_at, "cyan"]
  ];
  const pipelineStages = [
    ["Yeni", leads.filter((lead) => ["Yeni", "Yeni Başvuru"].includes(lead.status || "Yeni")).length, "from-blue-500 to-cyan-400"],
    ["Aranacak", leads.filter((lead) => ["Görüşülecek", "İletişime Geçildi"].includes(lead.status)).length, "from-cyan-400 to-teal-400"],
    ["Görüşüldü", leads.filter((lead) => lead.status === "Takipte").length, "from-indigo-500 to-blue-500"],
    ["Teklif Gönderildi", leads.filter((lead) => ["Teklif Hazırlanıyor", "Teklif Gönderildi"].includes(lead.status)).length, "from-amber-400 to-orange-500"],
    ["Müşteri", leads.filter((lead) => ["Kazanıldı", "Dönüştürüldü", "Müşteri Oldu"].includes(lead.status)).length, "from-emerald-400 to-teal-500"],
    ["Reddedildi", leads.filter((lead) => isLeadRejected(lead)).length, "from-rose-500 to-red-500"]
  ];
  const intelligenceCards = [
    ["Meta Intelligence", `${metaLeadCount} rakip / sinyal`, "Reklam aktivitesi ve kreatif fırsatları", "Son tarama", leads.find((lead) => lead.source === "Meta Analiz")?.created_at, "from-orange-400 via-pink-500 to-rose-500"],
    ["Google Intelligence", `${googleLeadCount || leads.filter((lead) => lead.google_place_id).length} fırsat`, "Arama görünürlüğü ve keşif kayıtları", "Son keşif", leads.find((lead) => lead.source === "Google Ads Analiz" || lead.google_place_id)?.created_at, "from-cyan-400 via-sky-500 to-blue-600"],
    ["Sosyal İstihbarat", `${socialAuditLeads.length} profil`, `${activeAiMeta.provider} · ${activeAiMeta.mode}`, "Son analiz", socialAuditLeads[0]?.created_at, "from-yellow-300 via-amber-400 to-orange-500"],
    ["AI Command Center", activeAiMeta.provider, `${activeAiMeta.model} · ${aiStatusCenter.groq?.responseTimeMs || aiStatusCenter.gemini?.responseTimeMs || "-"} ms`, "Son test", content.settings?.api?.ai_status_last_test_at, "from-violet-500 via-purple-500 to-fuchsia-500"]
  ];
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
  const categoryCards = [
    {
      title: "CRM & Müşteriler",
      description: "Başvuruları, müşteri kayıtlarını ve takipleri tek operasyon hattında yönetin.",
      count: `${leads.length} başvuru`,
      icon: <UsersRound size={24} />,
      gradient: "from-emerald-400 via-teal-500 to-cyan-600",
      actions: [["CRM", "CRM"], ["Yeni Başvurular", "Yeni Başvurular"], ["Müşteriler", "Müşteriler"]]
    },
    {
      title: "İstihbarat Merkezi",
      description: "Meta, Google ve sosyal medya analizlerini tek yerden yönetin.",
      count: `${metaLeadCount + googleLeadCount + socialAuditLeads.length} sinyal`,
      icon: <Sparkles size={24} />,
      gradient: "from-amber-300 via-orange-500 to-rose-600",
      actions: [["Meta Analiz", "Meta Analiz"], ["Google Analiz", "Google Ads Analiz"], ["Sosyal İstihbarat", "Sosyal İstihbarat Merkezi"]]
    },
    {
      title: "Teklif & Raporlama",
      description: "PDF audit, WhatsApp teklifi ve müşteri raporlarını hızlıca hazırlayın.",
      count: `${reports.length} rapor`,
      icon: <FileBarChart size={24} />,
      gradient: "from-violet-500 via-purple-500 to-fuchsia-600",
      actions: [["PDF Audit", "PDF Audit"], ["Teklif Hazırla", "Teklif Hazırlama"], ["Raporlar", "Raporlar"]]
    },
    {
      title: "İçerik & AI Studio",
      description: "İçerik fikirleri, 30 günlük planlar, promptlar ve kampanya önerileri üretin.",
      count: `${aiAnalyzedLeads.length} AI analiz`,
      icon: <Bot size={24} />,
      gradient: "from-blue-500 via-indigo-500 to-violet-600",
      actions: [["İçerik Fikirleri", "İçerik Fikirleri"], ["30 Günlük Plan", "30 Günlük Sosyal Medya Planı"], ["AI Studio", "AI Studio"]]
    },
    {
      title: "Ayarlar",
      description: "API bağlantıları, AI sağlayıcıları, kullanıcılar, tema ve sistem ayarları.",
      count: `%${healthScore} sağlık`,
      icon: <Settings2 size={24} />,
      gradient: "from-slate-100 via-slate-200 to-slate-300",
      actions: [["API Ayarları", "API Ayarları"], ["AI Ayarları", "AI Sağlayıcı Ayarları"], ["Kullanıcı Yönetimi", "Kullanıcı Yönetimi"]]
    }
  ].map((card) => ({ ...card, actions: card.actions.filter(([, target]) => canOpen(target) || ["AI Sağlayıcı Ayarları", "PDF Audit", "Teklif Hazırlama", "30 Günlük Sosyal Medya Planı", "İçerik Fikirleri", "Yeni Başvurular"].includes(target)) })).filter((card) => card.actions.length);
  const dashboardPresets = {
    "CRM Focus": { order: ["metrics", "insights", "crm", "quickActions", "activity", "aiStatus", "status", "charts", "demo"], hidden: ["charts"], favorites: ["CRM", "Lead Yönetimi", "Müşteriler"] },
    "Sales Focus": { order: ["insights", "metrics", "quickActions", "crm", "activity", "aiStatus", "status", "charts", "demo"], hidden: ["demo"], favorites: ["Müşteri Bulucu", "Teklif Motoru", "CRM"] },
    "AI Focus": { order: ["aiStatus", "insights", "quickActions", "metrics", "charts", "activity", "status", "crm", "demo"], hidden: ["demo"], favorites: ["AI Studio", "Sosyal İstihbarat Merkezi", "Lead Yönetimi", "Hazırlık Merkezi"] },
    "Reporting Focus": { order: ["charts", "metrics", "insights", "quickActions", "activity", "aiStatus", "status", "crm", "demo"], hidden: ["crm"], favorites: ["Raporlar", "Müşteriler"] },
    "Executive Overview": { order: dashboardWidgetDefaults, hidden: [], favorites: ["Müşteri Bulucu", "CRM"] }
  };
  const conversionRate = leads.length ? Math.round(activeCustomers.length / leads.length * 100) : 0;
  const osDashboardWidgets = [
    ["CRM Özeti", leads.length, `${newLeads.length} yeni · ${hotLeads.length} sıcak`, <UsersRound size={20} />, "from-blue-600 to-cyan-500", "CRM", "level1"],
    ["İstihbarat Merkezi", metaLeadCount + googleLeadCount + socialAuditLeads.length, "Meta, Google ve sosyal sinyaller", <Sparkles size={20} />, "from-orange-500 to-red-600", "Meta Analiz", "level1"],
    ["AI Durumu", healthScore + "%", `${activeAiMeta.provider} · ${activeAiMeta.mode}`, <Bot size={20} />, "from-purple-600 to-indigo-600", "AI Durum Merkezi", "level1"],
    ["PDF Auditler", reports.length + socialAuditLeads.length, "Audit ve rapor çıktıları", <FileBarChart size={20} />, "from-emerald-600 to-teal-600", "PDF Audit", "level2"],
    ["WhatsApp Teklifleri", generatedProposals, "Hazır teklif iletişimleri", <MessageSquareText size={20} />, "from-green-600 to-emerald-600", "WhatsApp Teklifi", "level2"],
    ["Müşteriler", activeCustomers.length, "Aktif müşteri portföyü", <Building2 size={20} />, "from-teal-600 to-cyan-700", "Müşteriler", "level2"],
    ["Google Analiz", googleLeadCount, "Arama görünürlüğü fırsatları", <Search size={20} />, "from-sky-600 to-blue-700", "Google Ads Analiz", "level2"],
    ["Dönüşüm Oranı", `%${conversionRate}`, "Leadden müşteriye dönüşüm", <Gauge size={20} />, "from-amber-500 to-orange-600", "CRM", "level2"],
    ["Görevler", todaysTasks.length + overdueTasks.length, "Bugün ve geciken operasyonlar", <CircleCheck size={20} />, "from-cyan-600 to-blue-700", "Görevler", "level2"],
    ["Tahsilat", `${pendingRevenue.toLocaleString("tr-TR")} TL`, "Bekleyen ödeme takibi", <Gauge size={20} />, "from-amber-500 to-orange-600", "Tahsilat", "level2"],
    ["Karlılık", `${estimatedProfit.toLocaleString("tr-TR")} TL`, "Bu ay tahmini kâr", <BarChart3 size={20} />, "from-emerald-600 to-green-700", "Karlılık", "level2"],
    ["Kampanyalar", activeCampaigns.length + plannedCampaigns.length, "Aktif ve planlanan kampanyalar", <BarChart3 size={20} />, "from-orange-500 to-pink-600", "Kampanyalar", "level2"]
  ].filter(([, , , , , target]) => canOpen(String(target)) || ["AI Durum Merkezi", "PDF Audit", "WhatsApp Teklifi"].includes(String(target)));
  const workspaceWidgets = [
    {
      title: "CRM Widget",
      subtitle: `${leads.length} lead · ${newLeads.length} yeni`,
      description: "Sıcak, ılık ve soğuk lead dağılımı ile hızlı CRM aksiyonları.",
      icon: <UsersRound size={19} />,
      gradient: "from-blue-600 to-cyan-500",
      target: "CRM",
      stats: [["Sıcak", hotLeads.length], ["Ilık", leads.filter((lead) => Number(lead.lead_heat_score || 0) >= 50 && Number(lead.lead_heat_score || 0) < 70).length], ["Soğuk", leads.filter((lead) => Number(lead.lead_heat_score || 0) < 50).length]]
    },
    {
      title: "Intelligence Widget",
      subtitle: `${metaLeadCount + googleLeadCount + socialAuditLeads.length} sinyal`,
      description: "Meta, Google ve sosyal istihbarat taramalarını aynı panelden açın.",
      icon: <Sparkles size={19} />,
      gradient: "from-orange-500 to-rose-600",
      target: "Meta Analiz",
      stats: [["Meta", metaLeadCount], ["Google", googleLeadCount], ["Sosyal", socialAuditLeads.length]]
    },
    {
      title: "AI Command Widget",
      subtitle: `${activeAiMeta.provider} · ${activeAiMeta.mode}`,
      description: `Model: ${activeAiMeta.model}. Son istek ve sağlık bilgisini izleyin.`,
      icon: <Bot size={19} />,
      gradient: "from-purple-600 to-indigo-600",
      target: "AI Durum Merkezi",
      stats: [["Sağlık", `%${healthScore}`], ["Mod", activeAiMeta.mode], ["Provider", activeAiMeta.provider]]
    },
    {
      title: "Reports & PDF Widget",
      subtitle: `${reports.length + socialAuditLeads.length} çıktı`,
      description: "PDF auditler, müşteri raporları ve dışa aktarma akışları.",
      icon: <FileBarChart size={19} />,
      gradient: "from-emerald-600 to-teal-600",
      target: "PDF Audit",
      stats: [["PDF", socialAuditLeads.length], ["Rapor", reports.length], ["Export", metricsThisMonth.length]]
    },
    {
      title: "WhatsApp Proposal Widget",
      subtitle: `${generatedProposals} teklif`,
      description: "Hazır teklif iletişimlerini hızlıca üretin ve kopyalayın.",
      icon: <MessageSquareText size={19} />,
      gradient: "from-green-600 to-emerald-600",
      target: "WhatsApp Teklifi",
      stats: [["Teklif", generatedProposals], ["Müşteri", activeCustomers.length], ["Dönüşüm", `%${conversionRate}`]]
    },
    {
      title: "Notifications Widget",
      subtitle: `${recentActivity.length} olay`,
      description: "Yeni lead, AI, API, PDF ve CRM hareketlerinden son sinyaller.",
      icon: <Bell size={19} />,
      gradient: "from-slate-600 to-indigo-700",
      target: "Canlı Aktivite",
      stats: [["Lead", newLeads.length], ["AI", aiAnalyzedLeads.length], ["Aktivite", activityLogs.length]]
    }
  ].filter((widget) => canOpen(widget.target) || ["AI Durum Merkezi", "PDF Audit", "WhatsApp Teklifi", "Canlı Aktivite"].includes(widget.target));

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

  function buildDashboardAssistantAnswer(question = dashboardAssistantPrompt) {
    const focusTasks = importantDashboardTasks.length
      ? `Öncelikli görevler: ${importantDashboardTasks.map((item) => item.title || "İsimsiz görev").join(", ")}.`
      : "Bugün için kritik veya geciken görev görünmüyor.";
    const collectionLine = overduePayments.length
      ? `Geciken tahsilat: ${overduePayments.slice(0, 4).map((item) => `${companyName(content, item.company_id)} ${Number(item.amount || 0).toLocaleString("tr-TR")} TL`).join(", ")}.`
      : "Geciken tahsilat görünmüyor.";
    const profitLine = `Bu ay beklenen gelir ${expectedRevenue.toLocaleString("tr-TR")} TL, bekleyen tahsilat ${pendingRevenue.toLocaleString("tr-TR")} TL, tahmini kâr ${estimatedProfit.toLocaleString("tr-TR")} TL.`;
    const leadLine = hotLeads.length
      ? `Sıcak leadler: ${hotLeads.slice(0, 4).map((lead) => lead.company || lead.name || "İsimsiz lead").join(", ")}.`
      : "Sıcak lead listesi şu an sakin.";
    return [
      `Soru: ${question || "Bugün neye odaklanmalıyım?"}`,
      "HK Asistan yerel değerlendirme:",
      focusTasks,
      collectionLine,
      profitLine,
      leadLine,
      "Öneri: Önce geciken tahsilat ve kritik görevleri kapatın; ardından sıcak leadler için teklif veya WhatsApp takibi başlatın."
    ].join("\n\n");
  }

  async function askDashboardAssistant(promptText = dashboardAssistantPrompt) {
    const question = (promptText || "Bugün neye odaklanmalıyım?").trim();
    setDashboardAssistantPrompt(question);
    setDashboardAssistantLoading(true);
    const localAnswer = buildDashboardAssistantAnswer(question);
    try {
      const context = {
        tasks: importantDashboardTasks,
        overduePayments: overduePayments.slice(0, 10),
        profitability: { expectedRevenue, pendingRevenue, overduePaymentTotal, estimatedProfit },
        reports: reports.slice(0, 8),
        leads: hotLeads.slice(0, 10)
      };
      const response = await fetch("/api/admin/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `${question}\n\nYerel ajans verisi: ${JSON.stringify(context)}\n\nKısa, uygulanabilir ve Türkçe yanıt ver.` })
      });
      const data = await response.json().catch(() => ({}));
      setDashboardAssistantAnswer(response.ok && data.output ? data.output : localAnswer);
    } catch {
      setDashboardAssistantAnswer(localAnswer);
    } finally {
      setDashboardAssistantLoading(false);
    }
  }

  const lightDashboardQuickActions = [
    ["Müşteri Ekle", "Müşteriler", <Building2 size={20} />, "from-blue-500 to-cyan-400"],
    ["Kampanya Ekle", "Kampanyalar", <BarChart3 size={20} />, "from-orange-500 to-amber-400"],
    ["Görev Ekle", "Görevler", <CircleCheck size={20} />, "from-emerald-500 to-green-400"],
    ["Tahsilat Ekle", "Tahsilat", <Gauge size={20} />, "from-sky-500 to-blue-500"],
    ["Rapor Oluştur", "Müşteri Raporları", <FileBarChart size={20} />, "from-red-500 to-orange-400"],
    ["Teklif Oluştur", "Teklif Hazırlama", <MessageSquareText size={20} />, "from-cyan-500 to-teal-400"]
  ].filter(([, target]) => canOpen(target as string));
  const lightOverviewCards = [
    ["Aktif Müşteri", activeCustomers.length, "Hizmeti devam eden firmalar", <Building2 size={20} />, "bg-blue-50 text-blue-700"],
    ["Aktif Kampanya", activeCampaigns.length, "Yayındaki kampanyalar", <BarChart3 size={20} />, "bg-cyan-50 text-cyan-700"],
    ["Bekleyen Tahsilat", `${pendingRevenue.toLocaleString("tr-TR")} TL`, "Bu ay kapanmamış ödemeler", <Gauge size={20} />, "bg-orange-50 text-orange-700"],
    ["Bu Ay Tahsil Edilen", `${paidRevenue.toLocaleString("tr-TR")} TL`, "Ödenen toplam", <CircleCheck size={20} />, "bg-green-50 text-green-700"],
    ["Kritik Görev", criticalTasks.length, "Acil operasyon işleri", <AlertTriangle size={20} />, "bg-red-50 text-red-700"],
    ["Sistem Sağlığı", `%${healthScore}`, "Bağlantı ve operasyon durumu", <Gauge size={20} />, "bg-sky-50 text-sky-700"]
  ];
  const hkIdentityCards = [
    ["🤖 AI Durumu", activeAiMeta.provider || "Kayıt yok", activeAiMeta.model || "Henüz veri yok", "bg-indigo-50 text-indigo-700"],
    ["📈 Reklam Performansı", metricsThisMonth.length ? `${metricsThisMonth.length} metrik` : "Henüz veri yok", "Bu ay kayıtlı performans verisi", "bg-blue-50 text-blue-700"],
    ["🎯 Lead Kalitesi", hotLeads.length ? `${hotLeads.length} sıcak lead` : "Kayıt yok", "Yüksek fırsat skorlu kayıtlar", "bg-amber-50 text-amber-700"],
    ["💰 Tahmini Gelir", expectedRevenue ? `${expectedRevenue.toLocaleString("tr-TR")} TL` : "Henüz veri yok", "Bu ay beklenen toplam gelir", "bg-emerald-50 text-emerald-700"]
  ];
  const visibleNotifications = buildAdminNotifications(content).slice(0, 5);
  const customerHealthRows = companies.map((company) => ({ company, health: calculateCustomerHealth(company, {
    campaigns: campaigns.filter((item) => item.company_id === company.id),
    payments: paymentRecords.filter((item) => item.company_id === company.id),
    tasks: agencyTasks.filter((item) => item.company_id === company.id),
    reports: reports.filter((item) => item.company_id === company.id),
    activities: activityLogs.filter((item) => item.company_id === company.id || item.entity_id === company.id)
  }) })).sort((a, b) => a.health.score - b.health.score);
  const riskyCustomers = customerHealthRows.filter((item) => item.health.score < 70).slice(0, 5);
  const upcomingCampaigns = campaigns.filter((item) => !isCampaignArchived(item) && item.end_date && item.end_date >= today).sort((a, b) => String(a.end_date).localeCompare(String(b.end_date))).slice(0, 5);
  const followUpLeads = leads.filter((lead) => Number(lead.lead_heat_score || 0) >= 60 && !["Kazanıldı", "Kaybedildi", "Dönüştürüldü"].includes(lead.status)).slice(0, 6);
  const upcomingReports = reports.filter((report) => !report.visible_to_customer || ["Taslak", "Hazır"].includes(report.status || "")).slice(0, 5);
  const commandItems = [
    ["Bugün yapılacak görevler", todaysTasks.length, "Görevler", "bg-blue-50 text-blue-700"],
    ["Bekleyen tahsilatlar", pendingRevenue ? `${pendingRevenue.toLocaleString("tr-TR")} TL` : 0, "Tahsilat", "bg-amber-50 text-amber-700"],
    ["Takip edilecek leadler", followUpLeads.length, "Takip Merkezi", "bg-cyan-50 text-cyan-700"],
    ["Kritik müşteriler", riskyCustomers.length, "Müşteriler", "bg-red-50 text-red-700"],
    ["Yaklaşan raporlar", upcomingReports.length, "Müşteri Raporları", "bg-purple-50 text-purple-700"],
    ["Kampanya bitişleri", upcomingCampaigns.length, "Kampanyalar", "bg-orange-50 text-orange-700"]
  ];
  const aiHealthDimensions = [
    ["Reklam Sağlığı", activeCampaigns.length ? Math.min(100, 55 + activeCampaigns.length * 8) : 42, activeCampaigns.length ? "Aktif kampanya var; performans takibi yapılabilir." : "Aktif kampanya az veya yok."],
    ["İçerik Sağlığı", (content.socialMediaPlans || []).length ? 78 : 48, (content.socialMediaPlans || []).length ? "İçerik planı kayıtları mevcut." : "Düzenli içerik planı için kayıt az."],
    ["Lead Sağlığı", hotLeads.length ? Math.min(100, 50 + hotLeads.length * 6) : 44, hotLeads.length ? "Sıcak lead havuzu aktif." : "Sıcak lead sayısı düşük."],
    ["Satış Sağlığı", conversionRate ? Math.min(100, 45 + conversionRate) : 40, conversionRate ? `Dönüşüm oranı %${conversionRate}.` : "Satış dönüşüm verisi sınırlı."],
    ["Tahsilat Sağlığı", overduePayments.length ? Math.max(15, 76 - overduePayments.length * 10) : 86, overduePayments.length ? "Geciken tahsilatlar riski artırıyor." : "Geciken tahsilat görünmüyor."]
  ].map(([label, score, reason]) => ({ label, score: Number(score), reason, status: Number(score) >= 70 ? "Sağlıklı" : Number(score) >= 45 ? "Riskli" : "Kritik" }));
  const achievements = [
    ["7 gün üst üste CRM kullanıldı", activityLogs.length >= 7, `${Math.min(activityLogs.length, 7)}/7 aktivite`],
    ["Bu ay 100 lead işlendi", leads.filter((lead) => String(lead.created_at || "").startsWith(month)).length >= 100, `${leads.filter((lead) => String(lead.created_at || "").startsWith(month)).length}/100 lead`],
    ["50.000 TL tahsilat", paidRevenue >= 50000, `${paidRevenue.toLocaleString("tr-TR")} TL`],
    ["10 rapor yayınlandı", reports.filter((report) => report.status === "Yayınlandı").length >= 10, `${reports.filter((report) => report.status === "Yayınlandı").length}/10 rapor`],
    ["5 kampanya eşleştirildi", campaigns.filter((campaign) => campaign.meta_campaign_id || campaign.external_id).length >= 5, `${campaigns.filter((campaign) => campaign.meta_campaign_id || campaign.external_id).length}/5 kampanya`]
  ];
  const agencyMap = Object.values(companies.reduce((acc, company) => {
    const city = company.city || "Belirtilmedi";
    acc[city] ||= { city, customers: 0, leads: 0, revenue: 0, campaigns: 0, risky: 0 };
    acc[city].customers += 1;
    acc[city].revenue += paymentRecords.filter((item) => item.company_id === company.id && item.status === "Ödendi").reduce((sum, item) => sum + Number(item.amount || 0), 0);
    acc[city].campaigns += campaigns.filter((item) => item.company_id === company.id && item.status === "Aktif").length;
    acc[city].risky += customerHealthRows.find((item) => item.company.id === company.id)?.health.score < 70 ? 1 : 0;
    return acc;
  }, {} as any)).map((row: any) => ({ ...row, leads: leads.filter((lead) => (lead.city || "Belirtilmedi") === row.city).length })).sort((a: any, b: any) => b.customers - a.customers).slice(0, 8);
  const filteredActivity = recentActivity.filter((item) => {
    const created = new Date(item.created_at || 0);
    if (activityFilter === "Bugün") return dateOnly(created.toISOString()) === today;
    if (activityFilter === "Bu hafta") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return created >= weekAgo;
    }
    return true;
  });

  function statusTone(status: string) {
    if (status === "Sağlıklı") return "bg-green-100 text-green-700";
    if (status === "Riskli") return "bg-amber-100 text-amber-700";
    return "bg-red-100 text-red-700";
  }

  function generateDailyPlan() {
    const lines = [
      criticalTasks.length ? `1. Kritik görevleri kapatın: ${criticalTasks.slice(0, 3).map((item) => item.title).join(", ")}.` : "1. Kritik görev görünmüyor; bugün planlı işleri ilerletin.",
      overduePayments.length ? `2. Geciken tahsilatları arayın: ${overduePayments.slice(0, 3).map((item) => companyName(content, item.company_id)).join(", ")}.` : "2. Tahsilat tarafında gecikme yok; bekleyen ödemeleri kontrol edin.",
      followUpLeads.length ? `3. Sıcak lead takibi yapın: ${followUpLeads.slice(0, 3).map((lead) => lead.company || lead.name).join(", ")}.` : "3. Yeni lead keşfi için Müşteri Keşfi modülünü açın.",
      riskyCustomers.length ? `4. Riskli müşterileri gözden geçirin: ${riskyCustomers.slice(0, 3).map((item) => item.company.name).join(", ")}.` : "4. Müşteri sağlık skorları genel olarak stabil.",
      upcomingCampaigns.length ? `5. Bitişi yaklaşan kampanyaları kontrol edin: ${upcomingCampaigns.slice(0, 2).map((item) => item.name).join(", ")}.` : "5. Kampanya bitiş riski görünmüyor."
    ];
    setCommandPlan(lines.join("\n"));
    notify?.("Günlük öncelik planı hazırlandı.", "success");
  }

  return (
    <Panel title="Operasyon Merkezi">
      <div className="admin-light-dashboard grid w-full min-w-0 gap-5">
        <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,.07)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Komut Merkezi</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Bugünkü operasyon öncelikleri</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Görev, tahsilat, lead, müşteri, rapor ve kampanya sinyallerini tek satırda okuyun.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={generateDailyPlan} className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">Bugün Ne Yapmalıyım?</button>
              <button onClick={() => setCeoMode(true)} className="rounded-full bg-blue-600 px-5 py-3 text-sm font-black text-white">CEO Modu</button>
              <button onClick={() => setCustomizing((current) => !current)} className="rounded-full border border-slate-200 px-5 py-3 text-sm font-black text-slate-700">Widget Ayarları</button>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            {commandItems.map(([label, value, target, tone]) => <button key={label as string} onClick={() => setActive(target as string)} className={`rounded-[18px] border border-slate-200 p-4 text-left ${tone}`}><span className="block text-[11px] font-black uppercase tracking-[.12em] opacity-80">{label}</span><strong className="mt-2 block text-2xl">{value}</strong></button>)}
          </div>
          {commandPlan && <pre className="mt-5 whitespace-pre-wrap rounded-[18px] border border-cyan-100 bg-cyan-50 p-4 text-sm leading-7 text-slate-700">{commandPlan}</pre>}
        </section>
        {ceoMode && <div className="fixed inset-0 z-[82] overflow-y-auto bg-white/85 p-4" onMouseDown={() => setCeoMode(false)}><div className="mx-auto mt-10 max-w-6xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_28px_90px_rgba(15,23,42,.18)]" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-blue-600">CEO Modu</p><h2 className="mt-2 text-3xl font-black text-slate-950">Yönetici özeti</h2><p className="mt-2 text-sm text-slate-500">Sadece karar verilecek sayılar ve kritik aksiyonlar.</p></div><button onClick={() => setCeoMode(false)} className="grid size-11 place-items-center rounded-[14px] border border-slate-200"><X size={18} /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Gelir", `${expectedRevenue.toLocaleString("tr-TR")} TL`], ["Kâr", `${estimatedProfit.toLocaleString("tr-TR")} TL`], ["Tahsilat", `${paidRevenue.toLocaleString("tr-TR")} TL`], ["Aktif müşteri", activeCustomers.length], ["Riskli müşteri", riskyCustomers.length], ["Kritik görev", criticalTasks.length], ["Bekleyen teklif", leads.filter((lead) => !lead.proposal_history?.length && Number(lead.lead_heat_score || 0) >= 60).length], ["Bu hafta yapılacak", activeTasks.filter((item) => isOpenTask(item)).length]].map(([label, value]) => <div key={label as string} className="rounded-[22px] border border-slate-200 bg-slate-50 p-5"><p className="text-xs font-black uppercase tracking-[.12em] text-slate-500">{label}</p><p className="mt-3 text-3xl font-black text-slate-950">{value}</p></div>)}</div><div className="mt-6 grid gap-4 lg:grid-cols-2"><div className="rounded-[22px] border border-slate-200 bg-white p-5"><h3 className="font-black text-slate-950">Riskli müşteriler</h3><div className="mt-3 grid gap-2">{riskyCustomers.map((item) => <p key={item.company.id} className="rounded-[12px] bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{item.company.name} · {item.health.score}/100</p>)}{!riskyCustomers.length && <p className="text-sm text-slate-500">Riskli müşteri görünmüyor.</p>}</div></div><div className="rounded-[22px] border border-slate-200 bg-white p-5"><h3 className="font-black text-slate-950">Bu hafta yapılacaklar</h3><div className="mt-3 grid gap-2">{importantDashboardTasks.map((item) => <p key={item.id || item.title} className="rounded-[12px] bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">{item.title}</p>)}{!importantDashboardTasks.length && <p className="text-sm text-slate-500">Kritik görev yok.</p>}</div></div></div></div></div>}
        {customizing && <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-black text-slate-950">Widget Sistemi</h3><p className="mt-1 text-sm text-slate-500">Göster/gizle, yukarı/aşağı taşı ve varsayılan düzene dön. Tercihler bu cihazda saklanır.</p></div><button onClick={() => savePreferences({ order: dashboardWidgetDefaults, hidden: [], favorites: ["Müşteri Bulucu", "CRM"] })} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-black text-slate-700">Düzeni Sıfırla</button></div><div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">{preferences.order.map((id) => <div key={id} className="flex items-center justify-between gap-2 rounded-[14px] border border-slate-200 bg-slate-50 p-3"><span className="text-sm font-black text-slate-700">{id}</span><span className="flex gap-1"><button onClick={() => moveWidget(id, -1)} className="rounded border border-slate-200 px-2 py-1 text-xs">↑</button><button onClick={() => moveWidget(id, 1)} className="rounded border border-slate-200 px-2 py-1 text-xs">↓</button><button onClick={() => toggleWidget(id)} className={`rounded px-2 py-1 text-xs font-black ${preferences.hidden.includes(id) ? "bg-slate-200 text-slate-600" : "bg-green-100 text-green-700"}`}>{preferences.hidden.includes(id) ? "Gizli" : "Açık"}</button></span></div>)}</div></section>}
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_42px_rgba(15,23,42,.07)] sm:p-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <p className="text-sm font-black text-blue-600">{greeting[1]}, {userName}</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Hoş geldiniz, Ajans Yöneticisi 👋</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Müşteri, kampanya, tahsilat, görev ve rapor operasyonlarınızı tek merkezden yönetin.</p>
            </div>
            <div className="flex items-center gap-3 rounded-[18px] border border-blue-100 bg-blue-50 px-4 py-3">
              <span className="grid size-10 place-items-center rounded-[14px] bg-white text-blue-600 shadow-sm"><Gauge size={18} /></span>
              <span>
                <span className="block text-xs font-black uppercase tracking-[.14em] text-blue-500">Sistem Sağlığı</span>
                <span className="block text-2xl font-black text-blue-700">%{healthScore}</span>
              </span>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {lightDashboardQuickActions.map(([label, target, icon, gradient]) => (
              <button key={label as string} onClick={() => setActive(target as string)} className="group inline-flex min-h-12 items-center gap-3 rounded-[16px] border border-slate-200 bg-white px-3.5 py-2 text-left text-sm font-black text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-[0_12px_24px_rgba(37,99,235,.10)]">
                <span className={`grid size-9 shrink-0 place-items-center rounded-[12px] bg-gradient-to-br ${gradient} text-slate-900 shadow-[0_8px_18px_rgba(37,99,235,.14)]`}>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {lightOverviewCards.map(([label, value, note, icon, tone]) => (
            <div key={label as string} className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(15,23,42,.07)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[.12em] text-slate-500">{label}</p>
                  <p className="mt-2 truncate text-2xl font-black text-slate-950">{value}</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{note}</p>
                </div>
                <span className={`grid size-10 shrink-0 place-items-center rounded-[14px] ${tone}`}>{icon}</span>
              </div>
            </div>
          ))}
        </section>

        <section className="grid min-w-0 gap-5 xl:grid-cols-2">
          <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-black text-slate-950">Son Aktiviteler</h3>
              <button onClick={() => setActive("Sistem Logları")} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600 transition hover:bg-slate-200">Tümünü Aç</button>
            </div>
            <div className="grid gap-3">
              {recentActivity.slice(0, 6).map((item, index) => <div key={item.id || index} className="flex items-start gap-3 rounded-[14px] border border-slate-100 bg-slate-50 p-3"><span className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-500" /><span className="min-w-0"><strong className="block text-sm text-slate-950">{item.action || "Aktivite"}</strong><span className="mt-1 block text-xs text-slate-500">{item.entity || item.module || "-"} · {formatDateTime(item.created_at)}</span></span></div>)}
              {!recentActivity.length && <p className="rounded-[14px] border border-dashed border-slate-200 p-4 text-sm text-slate-500">Henüz aktivite kaydı yok.</p>}
            </div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-black text-slate-950">Yaklaşan Görevler</h3>
              <button onClick={() => setActive("Görevler")} className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 transition hover:bg-blue-100">Görevleri Aç</button>
            </div>
            <div className="grid gap-3">
              {importantDashboardTasks.map((item) => <div key={item.id || item.title} className="flex items-center justify-between gap-3 rounded-[14px] border border-slate-100 bg-slate-50 p-3"><span className="min-w-0"><strong className="block truncate text-sm text-slate-950">{item.title || "Görev"}</strong><span className="mt-1 block text-xs text-slate-500">{item.priority || "Orta"} · {item.due_date || "Tarih yok"}</span></span><span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-500 ring-1 ring-slate-200">{item.status || "Yapılacak"}</span></div>)}
              {!importantDashboardTasks.length && <p className="rounded-[14px] border border-dashed border-slate-200 p-4 text-sm text-slate-500">Yaklaşan kritik görev yok.</p>}
            </div>
          </div>
        </section>

        <section className="grid min-w-0 gap-5 xl:grid-cols-3">
          <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-black text-slate-950">Pipeline Özeti</h3>
              <button onClick={() => setActive("Satış Hunisi")} className="rounded-full bg-blue-600 px-4 py-2 text-xs font-black text-slate-900 transition hover:bg-blue-700">Satış Hunisini Aç</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {pipelineStages.map(([stage, count, gradient]) => <div key={stage as string} className="rounded-[16px] border border-slate-200 bg-slate-50 p-3"><div className={`mb-3 h-1.5 rounded-full bg-gradient-to-r ${gradient}`} /><p className="text-xs font-black text-slate-500">{stage}</p><p className="mt-1 text-2xl font-black text-slate-950">{count}</p></div>)}
            </div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">Bildirimler</h3>
            <div className="mt-4 grid gap-3">
              {visibleNotifications.map((item) => <div key={item.id} className="rounded-[14px] border border-slate-100 bg-slate-50 p-3"><p className="text-sm font-black text-slate-950">{item.label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.text}</p></div>)}
              {!visibleNotifications.length && <p className="rounded-[14px] border border-dashed border-slate-200 p-4 text-sm text-slate-500">Okunacak bildirim yok.</p>}
            </div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">Sistem Sağlığı</h3>
            <div className="mt-4 grid gap-2">
              {serviceItems.slice(0, 6).map((item) => <div key={item.label} className="flex items-center justify-between gap-3 rounded-[14px] border border-slate-100 bg-slate-50 px-3 py-2"><span className="text-sm font-bold text-slate-700">{item.label}</span><span className={`rounded-full px-2 py-1 text-[10px] font-black ${item.state === "Aktif" ? "bg-green-100 text-green-700" : item.state === "Uyarı" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>{item.state}</span></div>)}
            </div>
          </div>
        </section>

        <section className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {hkIdentityCards.map(([title, value, note, tone]) => (
            <div key={title as string} className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-black text-slate-950">{title}</p>
              <p className="mt-3 truncate text-xl font-black text-slate-950">{value}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{note}</p>
              <span className={`mt-4 inline-flex rounded-full px-3 py-1 text-[10px] font-black ${tone}`}>HK Intelligence</span>
            </div>
          ))}
        </section>

        <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
          <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-950">Canlı Aktivite Akışı</h3>
                <p className="mt-1 text-sm text-slate-500">Son operasyon hareketleri, filtrelenmiş görünüm.</p>
              </div>
              <div className="flex gap-1 rounded-full bg-slate-100 p-1">
                {["Bugün", "Bu hafta", "Tümü"].map((filter) => <button key={filter} onClick={() => setActivityFilter(filter)} className={`rounded-full px-3 py-1.5 text-xs font-black ${activityFilter === filter ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>{filter}</button>)}
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              {(filteredActivity.length ? filteredActivity : recentActivity.slice(0, 5)).slice(0, 7).map((item, index) => <div key={item.id || index} className="grid gap-3 rounded-[14px] border border-slate-100 bg-slate-50 p-3 sm:grid-cols-[120px_1fr_auto] sm:items-center"><span className="rounded-full bg-white px-3 py-1 text-center text-[10px] font-black text-slate-500 ring-1 ring-slate-200">{item.user || "Hayri"}</span><span><strong className="block text-sm text-slate-950">{item.action || "Operasyon hareketi"}</strong><span className="mt-1 block text-xs text-slate-500">{item.entity || item.module || "HK Operating System"}</span></span><span className="text-xs font-bold text-slate-400">{formatDateTime(item.created_at)}</span></div>)}
            </div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">AI Health Score</h3>
            <p className="mt-1 text-sm text-slate-500">Reklam, içerik, lead, satış ve tahsilat sağlığı.</p>
            <div className="mt-4 grid gap-3">
              {aiHealthDimensions.map((item) => <details key={item.label} className="rounded-[14px] border border-slate-200 bg-slate-50 p-3"><summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-3"><span><strong className="block text-sm text-slate-950">{item.label}</strong><span className="mt-1 block text-xs text-slate-500">Neden bu puanı aldı?</span></span><span className={`rounded-full px-3 py-1 text-xs font-black ${statusTone(item.status)}`}>{item.score}/100 · {item.status}</span></div></summary><p className="mt-3 rounded-[12px] bg-white p-3 text-xs leading-5 text-slate-600">{item.reason}</p></details>)}
            </div>
          </div>
        </section>

        <section className="grid min-w-0 gap-5 xl:grid-cols-2">
          <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">Başarılar</h3>
            <p className="mt-1 text-sm text-slate-500">Profesyonel operasyon kilometre taşları.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {achievements.map(([title, done, detail]) => <div key={title as string} className={`rounded-[16px] border p-4 ${done ? "border-green-200 bg-green-50" : "border-slate-200 bg-slate-50"}`}><div className="flex items-start justify-between gap-3"><strong className="text-sm text-slate-950">{title}</strong><span className={`rounded-full px-2 py-1 text-[10px] font-black ${done ? "bg-green-100 text-green-700" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>{done ? "Tamamlandı" : "Devam"}</span></div><p className="mt-2 text-xs font-bold text-slate-500">{detail}</p></div>)}
            </div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-950">Ajans Haritası</h3>
                <p className="mt-1 text-sm text-slate-500">Şehir bazlı müşteri, lead, gelir ve risk görünümü.</p>
              </div>
              <button onClick={() => setActive("Müşteri Keşfi")} className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">Keşfi Aç</button>
            </div>
            <div className="mt-4 grid gap-3">
              {agencyMap.map((item: any) => <button key={item.city} onClick={() => setActive("Müşteriler")} className="rounded-[16px] border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-cyan-200 hover:bg-cyan-50"><div className="flex items-start justify-between gap-3"><strong className="text-base text-slate-950">{item.city}</strong><span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-500 ring-1 ring-slate-200">{item.risky} riskli</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4"><span>Müşteri: <b>{item.customers}</b></span><span>Lead: <b>{item.leads}</b></span><span>Gelir: <b>{Number(item.revenue || 0).toLocaleString("tr-TR")} TL</b></span><span>Kampanya: <b>{item.campaigns}</b></span></div></button>)}
              {!agencyMap.length && <p className="rounded-[14px] border border-dashed border-slate-200 p-4 text-sm text-slate-500">Şehir bazlı kayıt oluştuğunda ajans haritası burada görünür.</p>}
            </div>
          </div>
        </section>
      </div>
    </Panel>
  );
}

function KeyValue({ title, object, onChange }: any) {
  return <Panel title={title}><div className="grid gap-4 md:grid-cols-2">{Object.entries(object).map(([key, value]) => <Field key={key} label={key} value={value} onChange={(v) => onChange({ ...object, [key]: v })} />)}</div></Panel>;
}

function companyName(content: any, companyId?: string) {
  return (content.companies || []).find((company) => company.id === companyId)?.name || "Firma seçilmedi";
}

function isArchivedRecord(item: any) {
  return Boolean(item?.archived_at || item?.deleted_at);
}

function dateOnly(value: any) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function recordDateForFilter(item: any, kind: "task" | "payment") {
  if (kind === "task") return dateOnly(item.due_date || item.completed_at || item.updated_at || item.created_at);
  return dateOnly(item.due_date || item.payment_date || item.updated_at || item.created_at);
}

function matchesHistoryDate(item: any, kind: "task" | "payment", startDate = "", endDate = "") {
  const date = recordDateForFilter(item, kind);
  if (!date) return true;
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

function filterTasks(items: any[], filters: any = {}) {
  const { status = "Tümü", companyId = "", startDate = "", endDate = "" } = filters;
  return (items || []).filter((item) => {
    const archived = isArchivedRecord(item);
    if (status === "Arşivlenenler") {
      if (!archived) return false;
    } else if (archived) {
      return false;
    } else if (status !== "Tümü" && (item.status || "Yapılacak") !== status) {
      return false;
    }
    if (companyId && item.company_id !== companyId) return false;
    return matchesHistoryDate(item, "task", startDate, endDate);
  });
}

function filterPayments(items: any[], filters: any = {}) {
  const { status = "Tümü", companyId = "", startDate = "", endDate = "" } = filters;
  return (items || []).filter((item) => {
    const archived = isArchivedRecord(item);
    if (status === "Arşivlenenler") {
      if (!archived) return false;
    } else if (archived) {
      return false;
    } else if (status !== "Tümü" && (item.status || "Bekliyor") !== status) {
      return false;
    }
    if (companyId && item.company_id !== companyId) return false;
    return matchesHistoryDate(item, "payment", startDate, endDate);
  });
}

function isCampaignArchived(item: any) {
  return Boolean(item?.archived_at || item?.deleted_at || item?.status === "Arşivlendi");
}

function filterCampaigns(items: any[], filters: any = {}) {
  const { status = "Tüm kampanyalar", companyId = "", platform = "", startDate = "", endDate = "" } = filters;
  return (items || []).filter((item) => {
    const archived = isCampaignArchived(item);
    if (status === "Arşivlenen kampanyalar") {
      if (!archived) return false;
    } else if (archived) {
      return false;
    } else if (status === "Aktif kampanyalar" && item.status !== "Aktif") {
      return false;
    } else if (status === "Planlanan kampanyalar" && item.status !== "Planlandı") {
      return false;
    } else if (status === "Tamamlanan kampanyalar" && item.status !== "Tamamlandı") {
      return false;
    } else if (status === "Durdurulan kampanyalar" && !["Duraklatıldı", "İptal"].includes(item.status)) {
      return false;
    }
    if (companyId && item.company_id !== companyId) return false;
    if (platform && item.platform !== platform) return false;
    if (startDate && dateOnly(item.end_date || item.start_date) && dateOnly(item.end_date || item.start_date) < startDate) return false;
    if (endDate && dateOnly(item.start_date || item.end_date) && dateOnly(item.start_date || item.end_date) > endDate) return false;
    return true;
  });
}

function isOpenTask(item: any) {
  return !isArchivedRecord(item) && !["Tamamlandı", "İptal"].includes(item?.status || "Yapılacak");
}

function isActiveCampaignRecord(item: any) {
  return !isCampaignArchived(item) && ["Aktif", "Yayında"].includes(item?.status || "");
}

function isDateOlderThan(value: any, days: number) {
  if (!value) return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return true;
  const limit = new Date();
  limit.setDate(limit.getDate() - days);
  return date < limit;
}

function latestDateValue(records: any[], keys: string[]) {
  return (records || []).reduce((latest, item) => {
    const raw = keys.map((key) => item?.[key]).find(Boolean);
    if (!raw) return latest;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return latest;
    return !latest || date > latest ? date : latest;
  }, null as Date | null);
}

function calculateCustomerHealth(company: any, context: any = {}) {
  const campaigns = context.campaigns || [];
  const payments = context.payments || [];
  const tasks = context.tasks || [];
  const reports = context.reports || [];
  const activities = context.activities || [];
  const relatedLead = context.relatedLead;
  const today = dateOnly(new Date().toISOString());
  const overduePayments = payments.filter((item) => !isArchivedRecord(item) && (item.status === "Gecikmiş" || (item.due_date && item.due_date < today && item.status !== "Ödendi" && item.status !== "İptal")));
  const activeCampaigns = campaigns.filter(isActiveCampaignRecord);
  const overdueTasks = tasks.filter((item) => isOpenTask(item) && item.due_date && item.due_date < today);
  const lastContact = latestDateValue([relatedLead, company, ...activities], ["last_contact_at", "next_action_at", "updated_at", "created_at"]);
  const lastReport = latestDateValue(reports, ["report_date", "published_at", "updated_at", "created_at", "endDate", "end_date"]);
  let score = 100;
  const reasons: string[] = [];
  if (overduePayments.length) {
    score -= Math.min(30, 16 + overduePayments.length * 5);
    reasons.push(`${overduePayments.length} geciken tahsilat müşteri riskini artırıyor.`);
  } else {
    reasons.push("Geciken tahsilat görünmüyor.");
  }
  if (!activeCampaigns.length) {
    score -= 14;
    reasons.push("Aktif kampanya yok; operasyon bağı zayıflayabilir.");
  } else {
    reasons.push(`${activeCampaigns.length} aktif kampanya devam ediyor.`);
  }
  if (overdueTasks.length) {
    score -= Math.min(22, 10 + overdueTasks.length * 4);
    reasons.push(`${overdueTasks.length} geciken görev operasyon baskısı oluşturuyor.`);
  } else {
    reasons.push("Geciken görev görünmüyor.");
  }
  if (isDateOlderThan(lastContact, 30)) {
    score -= 12;
    reasons.push("Son temas 30 günü geçmiş veya kayıtlı temas yok.");
  } else {
    reasons.push(`Son temas güncel: ${formatDate(lastContact)}.`);
  }
  if (isDateOlderThan(lastReport, 45)) {
    score -= 12;
    reasons.push("Son rapor 45 günü geçmiş veya rapor kaydı yok.");
  } else {
    reasons.push(`Son rapor güncel: ${formatDate(lastReport)}.`);
  }
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  const status = normalizedScore >= 75 ? "Sağlıklı" : normalizedScore >= 50 ? "Riskli" : "Kritik";
  const emoji = normalizedScore >= 75 ? "🟢" : normalizedScore >= 50 ? "🟡" : "🔴";
  const tone = normalizedScore >= 75 ? "emerald" : normalizedScore >= 50 ? "amber" : "red";
  return { score: normalizedScore, status, emoji, tone, reasons };
}

function stampTaskStatus(item: any, status: string) {
  const now = new Date().toISOString();
  return {
    ...item,
    status,
    completed_at: status === "Tamamlandı" ? (item.completed_at || now) : null,
    cancelled_at: status === "İptal" ? (item.cancelled_at || now) : null,
    archived_at: status === "Yapılacak" ? null : item.archived_at || null,
    deleted_at: status === "Yapılacak" ? null : item.deleted_at || null,
    updated_at: now
  };
}

function stampPaymentStatus(item: any, status: string) {
  const now = new Date().toISOString();
  return {
    ...item,
    status,
    payment_date: status === "Ödendi" ? (item.payment_date || dateOnly(now)) : item.payment_date || "",
    cancelled_at: status === "İptal" ? (item.cancelled_at || now) : null,
    archived_at: status === "Bekliyor" ? null : item.archived_at || null,
    deleted_at: status === "Bekliyor" ? null : item.deleted_at || null,
    updated_at: now
  };
}

function updateCollection(content: any, setContent: any, key: string, items: any[]) {
  setContent({ ...content, [key]: items });
}

function maskSecret(value = "") {
  if (!value) return "Tanımlı değil";
  if (String(value).includes("•") || String(value).includes("*")) return value;
  const text = String(value);
  return text.length > 8 ? `${text.slice(0, 4)}****${text.slice(-4)}` : "****";
}

function summarizeMetaRows(rows: any[] = []) {
  return rows.reduce((sum, row) => ({
    impressions: sum.impressions + Number(row.impressions || 0),
    reach: sum.reach + Number(row.reach || 0),
    clicks: sum.clicks + Number(row.clicks || 0),
    spend: sum.spend + Number(row.spend || row.spent || 0),
    leads: sum.leads + Number(row.leads || row.results || 0),
    messages: sum.messages + Number(row.messages || 0)
  }), { impressions: 0, reach: 0, clicks: 0, spend: 0, leads: 0, messages: 0 });
}

function metaCampaignSummaries(rows: any[] = []) {
  const grouped = rows.reduce((acc, row) => {
    const key = row.campaignId || row.meta_campaign_id || row.external_id || row.campaignName || row.campaign_name || "Meta Kampanya";
    const rowStart = dateOnly(row.period_start || row.date_start || row.date || row.created_at || "");
    const rowEnd = dateOnly(row.period_end || row.date_stop || row.date || row.updated_at || row.created_at || "");
    const current = acc[key] || {
      campaignId: key,
      campaignName: row.campaignName || row.campaign_name || row.name || key,
      spend: 0,
      results: 0,
      clicks: 0,
      impressions: 0,
      reach: 0,
      ctr: 0,
      cpc: 0,
      cpm: 0,
      status: row.status || "Aktif",
      date: row.date || row.date_start || row.created_at || "",
      periodStart: rowStart,
      periodEnd: rowEnd,
      dateRangeLabel: row.date_range_label || row.period || "",
      lastDataDate: rowEnd || rowStart
    };
    current.spend += Number(row.spend || row.spent || 0);
    current.results += Number(row.results || row.leads || row.messages || 0);
    current.clicks += Number(row.clicks || 0);
    current.impressions += Number(row.impressions || 0);
    current.reach += Number(row.reach || 0);
    current.ctr = current.impressions ? (current.clicks / current.impressions) * 100 : 0;
    current.cpc = current.clicks ? current.spend / current.clicks : 0;
    current.cpm = current.impressions ? (current.spend / current.impressions) * 1000 : 0;
    current.periodStart = [current.periodStart, rowStart].filter(Boolean).sort()[0] || "";
    current.periodEnd = [current.periodEnd, rowEnd].filter(Boolean).sort().slice(-1)[0] || "";
    current.dateRangeLabel = current.dateRangeLabel || row.date_range_label || row.period || "";
    current.lastDataDate = [current.lastDataDate, rowEnd || rowStart].filter(Boolean).sort().slice(-1)[0] || "";
    return { ...acc, [key]: current };
  }, {});
  return Object.values(grouped);
}

function metaRowsForRange(rows: any[] = [], rangePreset = "last_30d", dateFrom = "", dateTo = "") {
  if (rangePreset === "all_time") return rows;
  const today = new Date();
  const end = dateTo || today.toISOString().slice(0, 10);
  const startDate = new Date(today);
  if (rangePreset === "custom" && dateFrom) startDate.setTime(new Date(dateFrom).getTime());
  else if (rangePreset === "last_7d") startDate.setDate(today.getDate() - 7);
  else if (rangePreset === "this_month") startDate.setDate(1);
  else if (rangePreset === "last_month") startDate.setMonth(today.getMonth() - 1, 1);
  else startDate.setDate(today.getDate() - 30);
  const start = rangePreset === "last_month"
    ? new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 10)
    : startDate.toISOString().slice(0, 10);
  const until = rangePreset === "last_month" ? new Date(today.getFullYear(), today.getMonth(), 0).toISOString().slice(0, 10) : end;
  return rows.filter((row) => {
    const rowDate = String(row.period_end || row.date_stop || row.date || row.period_start || row.date_start || row.created_at || new Date().toISOString()).slice(0, 10);
    return rowDate >= start && rowDate <= until;
  });
}

function metaRangeLabel(rangePreset = "last_30d", dateFrom = "", dateTo = "", rows: any[] = []) {
  if (rangePreset === "all_time") return "Tüm Tarihler";
  if (rangePreset === "custom") return dateFrom && dateTo ? `${formatDate(dateFrom)} - ${formatDate(dateTo)}` : "Özel Tarih";
  if (rangePreset === "last_7d") return "Son 7 Gün";
  if (rangePreset === "this_month") return "Bu Ay";
  if (rangePreset === "last_month") return "Geçen Ay";
  const label = rows.find((row) => row.date_range_label)?.date_range_label;
  return label || "Son 30 Gün";
}

function metaPeriodText(item: any) {
  if (item?.periodStart && item?.periodEnd) return `${formatDate(item.periodStart)} - ${formatDate(item.periodEnd)}`;
  if (item?.dateRangeLabel) return item.dateRangeLabel;
  if (item?.lastDataDate || item?.date) return formatDate(item.lastDataDate || item.date);
  return "Veri tarihi bilinmiyor";
}

function normalizeAdminRole(role: any) {
  return String(role || "").toLocaleLowerCase("tr").replace(/[\s-]+/g, "_");
}

function canManageRecord(user: any, moduleKey = "") {
  const role = normalizeAdminRole(user?.role || user?.userRole || user?.profile?.role);
  if (["admin", "super_admin", "yonetici", "editor"].includes(role)) return true;
  if (role === "staff") {
    const allowed = user?.allowedModules || user?.allowed_modules || user?.profile?.allowed_modules || [];
    return !moduleKey || allowed.includes(moduleKey);
  }
  return false;
}

function recordActionDetail(title: string, rows: Array<[string, any]>) {
  if (typeof window === "undefined") return;
  window.alert([title, ...rows.map(([label, value]) => `${label}: ${value || "-"}`)].join("\n"));
}

function confirmRecordAction(message = "Bu işlemi yapmak istediğinize emin misiniz?") {
  if (typeof window === "undefined") return true;
  return window.confirm(message);
}

function softDeleteRecord(item: any) {
  return { ...item, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() };
}

function archiveRecord(item: any) {
  return { ...item, archived_at: new Date().toISOString(), updated_at: new Date().toISOString() };
}

function RecordActionButton({ children, tone = "slate", ...props }: any) {
  const toneClass = tone === "cyan"
    ? "border-cyan-300/30 text-cyan-700 hover:bg-cyan-300/10"
    : tone === "amber"
      ? "border-amber-300/30 text-amber-700 hover:bg-amber-300/10"
      : tone === "red"
        ? "border-red-300/30 text-red-200 hover:bg-red-300/10"
        : tone === "emerald"
          ? "border-emerald-300/30 text-emerald-700 hover:bg-emerald-300/10"
          : "border-slate-200 text-slate-700 hover:bg-white/10";
  return <button {...props} className={`rounded-full border px-4 py-2 text-xs font-black transition ${toneClass} ${props.className || ""}`}>{children}</button>;
}

function AgencyStatCard({ label, value, note, tone = "cyan" }: any) {
  const toneClass = tone === "red" ? "border-red-300/20 bg-red-300/10 text-red-100" : tone === "emerald" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-700" : tone === "amber" ? "border-amber-300/20 bg-amber-300/10 text-amber-700" : "border-cyan-300/20 bg-cyan-300/10 text-cyan-700";
  return <div className={`rounded-[8px] border p-4 ${toneClass}`}><p className="text-xs font-black uppercase tracking-[.14em] opacity-80">{label}</p><p className="mt-2 text-2xl font-black text-slate-900">{value}</p><p className="mt-1 text-xs leading-5 opacity-80">{note}</p></div>;
}

function CustomerBrandingCenter({ content, setContent }: any) {
  const items = content.customerBranding || [];
  const update = (index, patch) => updateCollection(content, setContent, "customerBranding", items.map((item, i) => i === index ? { ...item, ...patch } : item));
  return (
    <Panel title="Müşteri Markalama">
      <p className="mb-5 text-sm leading-6 text-slate-400">Her müşteri için Digital Center başlığı, logo ve renkleri özelleştirin. Eksik kayıtlar HK Dijital varsayılan görünümünü kullanır.</p>
      <button onClick={() => updateCollection(content, setContent, "customerBranding", [{ id: `${Date.now()}`, company_id: "", primary_color: "#22d3ee", secondary_color: "#2563eb", welcome_text: "Performans raporlarınız, kampanya notlarınız ve dijital büyüme verileriniz burada." }, ...items])} className="mb-4 rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950">Markalama ekle</button>
      <div className="grid gap-4">
        {items.map((item, index) => (
          <div key={item.id || index} className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <CompanySelect value={item.company_id || ""} onChange={(value) => update(index, { company_id: value })} companies={content.companies} />
              <Field label="Marka adı" value={item.brand_name || ""} onChange={(value) => update(index, { brand_name: value })} />
              <Field label="Müşteri logo URL" value={item.logo_url || ""} onChange={(value) => update(index, { logo_url: value })} />
              <Field label="Ana renk" type="color" value={item.primary_color || "#22d3ee"} onChange={(value) => update(index, { primary_color: value })} />
              <Field label="İkincil renk" type="color" value={item.secondary_color || "#2563eb"} onChange={(value) => update(index, { secondary_color: value })} />
              <TextArea label="Portal karşılama metni" value={item.welcome_text || ""} onChange={(value) => update(index, { welcome_text: value })} />
            </div>
            <button onClick={() => updateCollection(content, setContent, "customerBranding", items.filter((_, i) => i !== index))} className="mt-4 rounded-full border border-red-300/30 px-3 py-2 text-xs text-red-200">Sil</button>
          </div>
        ))}
        {!items.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-6 text-sm text-slate-400">Henüz müşteri markalaması yok.</p>}
      </div>
    </Panel>
  );
}

function MonthlyReportCenter({ content, setContent }: any) {
  const items = content.monthlyReports || [];
  const metrics = content.campaignMetrics || [];
  const [busy, setBusy] = useState("");
  const update = (index, patch) => updateCollection(content, setContent, "monthlyReports", items.map((item, i) => i === index ? { ...item, ...patch } : item));
  function createReport() {
    const company = (content.companies || [])[0];
    const month = new Date().toISOString().slice(0, 7);
    const monthMetrics = metrics.filter((metric) => String(metric.date || "").startsWith(month));
    const totals = monthMetrics.reduce((total, item) => ({ impressions: total.impressions + Number(item.impressions || 0), reach: total.reach + Number(item.reach || 0), clicks: total.clicks + Number(item.clicks || 0), spent: total.spent + Number(item.spent || 0), leads: total.leads + Number(item.leads || item.results || 0) }), { impressions: 0, reach: 0, clicks: 0, spent: 0, leads: 0 });
    updateCollection(content, setContent, "monthlyReports", [{ id: `${Date.now()}`, company_id: company?.id || "", report_month: month, summary: "Aylık performans raporu taslağı oluşturuldu.", meta_metrics: totals, google_metrics: {}, social_metrics: {}, ai_interpretation: "", next_month_recommendations: "Önümüzdeki ay kreatif testleri, bütçe optimizasyonu ve dönüşüm takibi güçlendirilecek.", status: "Taslak", visible_to_customer: false }, ...items]);
  }
  async function generateAi(index: number) {
    const item = items[index];
    setBusy(item.id || `${index}`);
    const prompt = `${companyName(content, item.company_id)} için ${item.report_month} aylık rapor yorumu yaz. Meta: ${JSON.stringify(item.meta_metrics || {})}. Google: ${JSON.stringify(item.google_metrics || {})}. Sosyal: ${JSON.stringify(item.social_metrics || {})}. Türkçe, müşteri dostu, satış garantisi vermeden yaz.`;
    const response = await fetch("/api/admin/ai-generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
    const data = await response.json().catch(() => ({}));
    update(index, { ai_interpretation: data.output || "Bu ay görünürlük, trafik ve dönüşüm odaklı çalışmalar takip edildi. Önümüzdeki ay test ve optimizasyon adımları önerilir." });
    setBusy("");
  }
  return <Panel title="Aylık Rapor Merkezi"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-400">Müşteri, ay ve platform metrikleriyle yayınlanabilir aylık rapor hazırlayın.</p><button onClick={createReport} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950">Aylık rapor oluştur</button></div><div className="grid gap-4">{items.map((item, index) => <div key={item.id || index} className="rounded-[8px] border border-slate-200 bg-slate-50 p-4"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><CompanySelect value={item.company_id || ""} onChange={(value) => update(index, { company_id: value })} companies={content.companies} /><Field label="Ay" type="month" value={item.report_month || ""} onChange={(value) => update(index, { report_month: value })} /><SelectField label="Durum" value={item.status || "Taslak"} onChange={(value) => update(index, { status: value })} options={["Taslak", "Hazır", "Yayınlandı"]} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(item.visible_to_customer)} onChange={(event) => update(index, { visible_to_customer: event.target.checked })} /> Müşteriye yayınla</label></div><TextArea label="Özet" value={item.summary || ""} onChange={(value) => update(index, { summary: value })} /><div className="grid gap-3 md:grid-cols-3"><TextArea label="Meta Ads metrikleri JSON" value={JSON.stringify(item.meta_metrics || {}, null, 2)} onChange={(value) => { try { update(index, { meta_metrics: JSON.parse(value || "{}") }); } catch {} }} /><TextArea label="Google Ads metrikleri JSON" value={JSON.stringify(item.google_metrics || {}, null, 2)} onChange={(value) => { try { update(index, { google_metrics: JSON.parse(value || "{}") }); } catch {} }} /><TextArea label="Sosyal medya metrikleri JSON" value={JSON.stringify(item.social_metrics || {}, null, 2)} onChange={(value) => { try { update(index, { social_metrics: JSON.parse(value || "{}") }); } catch {} }} /></div><TextArea label="AI yorumu" value={item.ai_interpretation || ""} onChange={(value) => update(index, { ai_interpretation: value })} /><TextArea label="Gelecek ay önerileri" value={item.next_month_recommendations || ""} onChange={(value) => update(index, { next_month_recommendations: value })} /><div className="mt-3 flex flex-wrap gap-2"><button disabled={busy === (item.id || `${index}`)} onClick={() => generateAi(index)} className="rounded-full border border-purple-200/30 px-4 py-2 text-xs font-black text-purple-700 disabled:opacity-60">AI yorum oluştur</button><button onClick={() => updateCollection(content, setContent, "monthlyReports", items.filter((_, i) => i !== index))} className="rounded-full border border-red-300/30 px-4 py-2 text-xs text-red-200">Sil</button></div></div>)}{!items.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-6 text-sm text-slate-400">Henüz aylık rapor yok.</p>}</div></Panel>;
}

function AgencyCalendarCenter({ content, setActive }: any) {
  const [view, setView] = useState("Hafta");
  const [companyFilter, setCompanyFilter] = useState("");
  const today = dateOnly(new Date().toISOString());
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const monthKey = today.slice(0, 7);
  const makeEvent = (source, type, title, date, companyId, target) => date ? {
    id: `${type}-${source.id || source.name || title}-${date}`,
    type,
    title,
    date: dateOnly(date),
    company_id: companyId || source.company_id || "",
    source,
    target
  } : null;
  const events = [
    ...(content.campaigns || []).flatMap((item) => [
      makeEvent(item, "Kampanya", `Kampanya başlangıcı: ${item.name || "Kampanya"}`, item.start_date, item.company_id, "Kampanyalar"),
      makeEvent(item, "Kampanya", `Kampanya bitişi: ${item.name || "Kampanya"}`, item.end_date, item.company_id, "Kampanyalar")
    ]),
    ...(content.paymentRecords || []).map((item) => makeEvent(item, "Tahsilat", `Tahsilat tarihi: ${Number(item.amount || 0).toLocaleString("tr-TR")} TL`, item.due_date, item.company_id, "Tahsilat")),
    ...(content.agencyTasks || []).map((item) => makeEvent(item, "Görev", `Görev teslimi: ${item.title || "Görev"}`, item.due_date, item.company_id, "Görevler")),
    ...(content.monthlyReports || []).map((item) => makeEvent(item, "Rapor", `Rapor teslimi: ${item.report_month || item.title || "Aylık rapor"}`, item.report_date || item.period_end || item.created_at || (item.report_month ? `${item.report_month}-01` : ""), item.company_id, "Aylık Raporlar")),
    ...(content.leads || []).map((item) => makeEvent(item, "Takip", `Takip: ${item.company || item.name || "Lead"}`, item.follow_up_date || item.next_action_at, item.company_id, "Satış Hunisi"))
  ].filter(Boolean).filter((event) => {
    if (companyFilter && event.company_id !== companyFilter) return false;
    if (!event.date) return false;
    if (view === "Gün") return event.date === today;
    if (view === "Hafta") return event.date >= today && event.date <= dateOnly(weekEnd.toISOString());
    return event.date.startsWith(monthKey);
  }).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const counts = {
    campaign: events.filter((event) => event.type === "Kampanya").length,
    payment: events.filter((event) => event.type === "Tahsilat").length,
    task: events.filter((event) => event.type === "Görev").length,
    report: events.filter((event) => event.type === "Rapor").length
  };
  return (
    <Panel title="Ajans Takvimi">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-6 text-slate-400">Kampanya başlangıç/bitişleri, tahsilatlar, görevler, rapor teslimleri ve takip tarihleri tek operasyon takviminde görünür.</p>
        <div className="flex rounded-full border border-slate-200 bg-slate-50 p-1">
          {["Gün", "Hafta", "Ay"].map((item) => <button key={item} onClick={() => setView(item)} className={`rounded-full px-4 py-2 text-xs font-black transition ${view === item ? "bg-cyan-300 text-slate-950" : "text-slate-600 hover:bg-white/10"}`}>{item}</button>)}
        </div>
      </div>
      <div className="mb-5 grid gap-3 md:grid-cols-5">
        <CompanySelect value={companyFilter} onChange={setCompanyFilter} companies={content.companies} />
        <AgencyStatCard label="Kampanya" value={counts.campaign} note="Başlangıç / bitiş" />
        <AgencyStatCard label="Tahsilat" value={counts.payment} note="Son ödeme tarihi" tone="amber" />
        <AgencyStatCard label="Görev" value={counts.task} note="Teslim tarihi" tone="emerald" />
        <AgencyStatCard label="Rapor" value={counts.report} note="Teslim / yayın" />
      </div>
      <div className="grid gap-3">
        {events.map((event) => (
          <div key={event.id} className="grid gap-3 rounded-[14px] border border-slate-200 bg-slate-50 p-4 md:grid-cols-[120px_1fr_auto] md:items-center">
            <span className="rounded-full border border-cyan-200/25 px-3 py-2 text-center text-xs font-black text-cyan-700">{formatDate(event.date)}</span>
            <span className="min-w-0">
              <strong className="block truncate text-slate-900">{event.title}</strong>
              <span className="mt-1 block text-sm text-slate-400">{companyName(content, event.company_id)} · {event.type}</span>
            </span>
            <button onClick={() => setActive?.(event.target)} className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">Kaydı Aç</button>
          </div>
        ))}
        {!events.length && <p className="rounded-[14px] border border-dashed border-slate-200 p-6 text-sm text-slate-400">Bu görünümde takvim kaydı yok. Müşteri filtresini veya görünümü değiştirmeyi deneyin.</p>}
      </div>
    </Panel>
  );
}

function AgencyTasksCenter({ content, setContent, save, currentSession, notify }: any) {
  const items = content.agencyTasks || [];
  const [statusFilter, setStatusFilter] = useState("Tümü");
  const [companyFilter, setCompanyFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const canManage = canManageRecord(currentSession, "gorevler");
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);
  const activeItems = items.filter((item) => !isArchivedRecord(item));
  const filteredItems = filterTasks(items, { status: statusFilter, companyId: companyFilter, startDate, endDate });
  const completedWeek = activeItems.filter((item) => item.status === "Tamamlandı" && new Date(item.completed_at || item.updated_at || item.created_at || Date.now()) >= weekStart).length;
  const update = (index, patch) => updateCollection(content, setContent, "agencyTasks", items.map((item, i) => i === index ? { ...item, ...patch } : item));
  const updateById = (id, patch, message = "") => {
    updateCollection(content, setContent, "agencyTasks", items.map((item) => item.id === id ? { ...item, ...patch, updated_at: new Date().toISOString() } : item));
    if (message) notify?.(`✓ ${message}`, "success");
  };
  const setStatus = (id, status) => {
    updateCollection(content, setContent, "agencyTasks", items.map((item) => item.id === id ? stampTaskStatus(item, status) : item));
    notify?.(`✓ Görev durumu ${status} olarak güncellendi`, "success");
  };
  const add = () => updateCollection(content, setContent, "agencyTasks", [{ id: createLocalId(), title: "Yeni görev", description: "", status: "Yapılacak", priority: "Orta", due_date: today, notes: "" }, ...items]);
  const deleteTask = (id) => {
    if (!confirmRecordAction("Bu görevi silmek istediğinize emin misiniz? Kayıt güvenli şekilde silinmiş olarak işaretlenecek.")) return;
    updateCollection(content, setContent, "agencyTasks", items.map((item) => item.id === id ? softDeleteRecord(item) : item));
    notify?.("✓ Görev silinmiş olarak işaretlendi", "success");
  };
  return <Panel title="Görev Takip Sistemi"><div className="mb-5 grid gap-3 md:grid-cols-4"><AgencyStatCard label="Bugünkü görev" value={activeItems.filter((item) => item.due_date === today && !["Tamamlandı", "İptal"].includes(item.status)).length} note="Bugün tamamlanması gereken işler" /><AgencyStatCard label="Geciken" value={activeItems.filter((item) => item.due_date && item.due_date < today && !["Tamamlandı", "İptal"].includes(item.status)).length} note="Takip bekleyen gecikmiş işler" tone="red" /><AgencyStatCard label="Kritik" value={activeItems.filter((item) => item.priority === "Kritik" && !["Tamamlandı", "İptal"].includes(item.status)).length} note="Öncelikli operasyon işleri" tone="amber" /><AgencyStatCard label="Bu hafta tamamlandı" value={completedWeek} note="Son 7 günde kapanan görevler" tone="emerald" /></div><div className="mb-4 flex flex-wrap items-center gap-3">{canManage && <button onClick={add} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950">Görev ekle</button>}<span className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600">Görev Geçmişi: {filteredItems.length} kayıt</span></div><div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5"><SelectField label="Durum filtresi" value={statusFilter} onChange={setStatusFilter} options={taskHistoryFilters} /><CompanySelect value={companyFilter} onChange={setCompanyFilter} companies={content.companies} /><Field label="Başlangıç tarihi" type="date" value={startDate} onChange={setStartDate} /><Field label="Bitiş tarihi" type="date" value={endDate} onChange={setEndDate} /><button onClick={() => { setStatusFilter("Tümü"); setCompanyFilter(""); setStartDate(""); setEndDate(""); }} className="self-end rounded-[8px] border border-slate-200 px-4 py-3 text-sm font-black text-slate-700">Filtreleri Temizle</button></div><div className="grid gap-3">{filteredItems.map((item) => {
    const index = items.findIndex((candidate) => candidate.id === item.id);
    const archived = isArchivedRecord(item);
    return <div key={item.id || index} className={`rounded-[8px] border p-4 ${archived ? "border-amber-300/25 bg-amber-300/[0.06]" : "border-slate-200 bg-slate-50"}`}><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Field label="Başlık" value={item.title || ""} onChange={(value) => update(index, { title: value })} /><CompanySelect value={item.company_id || ""} onChange={(value) => update(index, { company_id: value })} companies={content.companies} /><SelectField label="Durum" value={item.status || "Yapılacak"} onChange={(value) => canManage && setStatus(item.id, value)} options={taskStatusOptions} /><SelectField label="Öncelik" value={item.priority || "Orta"} onChange={(value) => update(index, { priority: value })} options={["Düşük", "Orta", "Yüksek", "Kritik"]} /><Field label="Son tarih" type="date" value={item.due_date || ""} onChange={(value) => update(index, { due_date: value })} /><SelectField label="Atanan kullanıcı" value={item.assigned_user_id || ""} onChange={(value) => update(index, { assigned_user_id: value })} options={(content.users || []).map((user) => ({ value: user.id, label: user.full_name || user.email }))} placeholder="Atanmadı" /><InfoItem label="Tamamlanma tarihi" value={formatDateTime(item.completed_at)} /><InfoItem label="Oluşturulma / Güncelleme" value={`${formatDateTime(item.created_at)} · ${formatDateTime(item.updated_at)}`} /><div className="md:col-span-2 xl:col-span-4"><TextArea label="Açıklama / not" value={item.description || item.notes || ""} onChange={(value) => update(index, { description: value, notes: value })} /></div></div><div className="mt-4 flex flex-wrap justify-end gap-2"><RecordActionButton tone="cyan" onClick={() => recordActionDetail("Görev Detayı", [["Başlık", item.title], ["Müşteri", companyName(content, item.company_id)], ["Durum", item.status], ["Öncelik", item.priority], ["Son tarih", formatDate(item.due_date)]])}>Detay</RecordActionButton>{canManage && (archived ? <RecordActionButton tone="amber" onClick={() => updateById(item.id, { archived_at: null, deleted_at: null }, "Görev arşivden çıkarıldı")}>Arşivden Çıkar</RecordActionButton> : <RecordActionButton tone="amber" onClick={() => updateById(item.id, { archived_at: new Date().toISOString() }, "Görev arşivlendi")}>Arşivle</RecordActionButton>)}{canManage && <RecordActionButton tone="emerald" onClick={() => setStatus(item.id, item.status === "Tamamlandı" ? "Yapılacak" : "Tamamlandı")}>{item.status === "Tamamlandı" ? "Tekrar Aç" : "Tamamlandı Yap"}</RecordActionButton>}{canManage && <RecordActionButton tone="red" onClick={() => deleteTask(item.id)}>Sil</RecordActionButton>}{canManage && <button onClick={() => save?.()} className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">Kaydet</button>}<button onClick={() => window.location.reload()} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700">Vazgeç</button></div></div>;
  })}{!filteredItems.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-6 text-sm text-slate-400">Bu filtrelerle görev kaydı bulunamadı.</p>}</div></Panel>;
}

function DocumentCenter({ content, setContent }: any) {
  const items = content.customerDocuments || [];
  const update = (index, patch) => updateCollection(content, setContent, "customerDocuments", items.map((item, i) => i === index ? { ...item, ...patch } : item));
  return <Panel title="Belge Merkezi"><button onClick={() => updateCollection(content, setContent, "customerDocuments", [{ id: `${Date.now()}`, title: "Yeni belge", document_type: "Diğer", document_date: new Date().toISOString().slice(0, 10), visible_to_customer: false }, ...items])} className="mb-4 rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950">Belge ekle</button><div className="grid gap-3">{items.map((item, index) => <div key={item.id || index} className="rounded-[8px] border border-slate-200 bg-slate-50 p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><CompanySelect value={item.company_id || ""} onChange={(value) => update(index, { company_id: value })} companies={content.companies} /><Field label="Belge başlığı" value={item.title || ""} onChange={(value) => update(index, { title: value })} /><SelectField label="Belge türü" value={item.document_type || "Diğer"} onChange={(value) => update(index, { document_type: value })} options={["Teklif", "Sözleşme", "Fatura", "Rapor", "Diğer"]} /><Field label="Tarih" type="date" value={item.document_date || ""} onChange={(value) => update(index, { document_date: value })} /><Field label="Belge URL" value={item.document_url || ""} onChange={(value) => update(index, { document_url: value })} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(item.visible_to_customer)} onChange={(event) => update(index, { visible_to_customer: event.target.checked })} /> {item.visible_to_customer ? "Müşteri Panelinde Görünür" : "Sadece Yönetici"}</label></div><button onClick={() => updateCollection(content, setContent, "customerDocuments", items.filter((_, i) => i !== index))} className="mt-3 rounded-full border border-red-300/30 px-3 py-2 text-xs text-red-200">Sil</button></div>)}{!items.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-6 text-sm text-slate-400">Henüz belge yok.</p>}</div></Panel>;
}

function PaymentCenter({ content, setContent, save, currentSession, notify }: any) {
  const items = content.paymentRecords || [];
  const [feedback, setFeedback] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tümü");
  const [companyFilter, setCompanyFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const canManage = canManageRecord(currentSession, "tahsilat");
  const thisMonth = new Date().toISOString().slice(0, 7);
  const activeItems = items.filter((item) => !isArchivedRecord(item));
  const filteredItems = filterPayments(items, { status: statusFilter, companyId: companyFilter, startDate, endDate });
  const monthItems = activeItems.filter((item) => String(item.service_period || item.due_date || "").startsWith(thisMonth));
  const sum = (list, predicate) => list.filter(predicate).reduce((total, item) => total + Number(item.amount || 0), 0);
  const update = (index, patch) => updateCollection(content, setContent, "paymentRecords", items.map((item, i) => i === index ? { ...item, ...patch } : item));
  const updateById = (id, patch, message = "") => {
    updateCollection(content, setContent, "paymentRecords", items.map((item) => item.id === id ? { ...item, ...patch, updated_at: new Date().toISOString() } : item));
    if (message) notify?.(`✓ ${message}`, "success");
  };
  const setStatus = (id, status) => {
    updateCollection(content, setContent, "paymentRecords", items.map((item) => item.id === id ? stampPaymentStatus(item, status) : item));
    notify?.(`✓ Ödeme durumu ${status} olarak güncellendi`, "success");
  };
  function addPayment() {
    if (!canManage) return;
    const hasEmptyDraft = items.some((item) => !item.company_id && !Number(item.amount || 0) && item.status === "Bekliyor");
    if (hasEmptyDraft) {
      setFeedback("Zaten boş bir tahsilat taslağı var. Önce onu doldurun.");
      return;
    }
    setFeedback("Tahsilat taslağı eklendi. Kaydet düğmesiyle kalıcılaştırın.");
    updateCollection(content, setContent, "paymentRecords", [{ id: createLocalId(), company_id: (content.companies || [])[0]?.id || "", amount: 0, due_date: new Date().toISOString().slice(0, 10), payment_date: "", status: "Bekliyor", service_period: thisMonth, payment_note: "", visible_to_customer: false }, ...items]);
  }
  const deletePayment = (id) => {
    if (!confirmRecordAction("Bu ödeme kaydını silmek istediğinize emin misiniz? Kayıt güvenli şekilde silinmiş olarak işaretlenecek.")) return;
    updateCollection(content, setContent, "paymentRecords", items.map((item) => item.id === id ? softDeleteRecord(item) : item));
    notify?.("✓ Ödeme kaydı silinmiş olarak işaretlendi", "success");
  };
  return <Panel title="Tahsilat Takibi"><div className="mb-5 grid gap-3 md:grid-cols-4"><AgencyStatCard label="Beklenen gelir" value={`${sum(monthItems, () => true).toLocaleString("tr-TR")} TL`} note="Bu ay planlanan tahsilat" /><AgencyStatCard label="Ödenen" value={`${sum(monthItems, (item) => item.status === "Ödendi").toLocaleString("tr-TR")} TL`} note="Tahsil edilmiş tutar" tone="emerald" /><AgencyStatCard label="Bekleyen" value={`${sum(monthItems, (item) => item.status === "Bekliyor").toLocaleString("tr-TR")} TL`} note="Henüz kapanmayan tutar" tone="amber" /><AgencyStatCard label="Gecikmiş" value={`${sum(activeItems, (item) => item.status === "Gecikmiş").toLocaleString("tr-TR")} TL`} note="Aksiyon gerektirir" tone="red" /></div><div className="mb-4 flex flex-wrap items-center gap-3">{canManage && <button onClick={addPayment} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950">Tahsilat kaydı ekle</button>}<span className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600">Ödeme Geçmişi: {filteredItems.length} kayıt</span>{feedback && <span className="rounded-full border border-cyan-200/20 px-3 py-2 text-xs text-cyan-700">{feedback}</span>}</div><div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5"><SelectField label="Durum filtresi" value={statusFilter} onChange={setStatusFilter} options={paymentHistoryFilters} /><CompanySelect value={companyFilter} onChange={setCompanyFilter} companies={content.companies} /><Field label="Başlangıç tarihi" type="date" value={startDate} onChange={setStartDate} /><Field label="Bitiş tarihi" type="date" value={endDate} onChange={setEndDate} /><button onClick={() => { setStatusFilter("Tümü"); setCompanyFilter(""); setStartDate(""); setEndDate(""); }} className="self-end rounded-[8px] border border-slate-200 px-4 py-3 text-sm font-black text-slate-700">Filtreleri Temizle</button></div><div className="grid gap-3">{filteredItems.map((item) => {
    const index = items.findIndex((candidate) => candidate.id === item.id);
    const archived = isArchivedRecord(item);
    return <div key={item.id || index} className={`rounded-[8px] border p-4 ${archived ? "border-amber-300/25 bg-amber-300/[0.06]" : "border-slate-200 bg-slate-50"}`}><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><CompanySelect value={item.company_id || ""} onChange={(value) => update(index, { company_id: value })} companies={content.companies} /><Field label="Tutar" type="number" value={item.amount || 0} onChange={(value) => update(index, { amount: Number(value || 0) })} /><SelectField label="Durum" value={item.status || "Bekliyor"} onChange={(value) => canManage && setStatus(item.id, value)} options={paymentStatusOptions} /><Field label="Hizmet dönemi" type="month" value={item.service_period || ""} onChange={(value) => update(index, { service_period: value })} /><Field label="Son ödeme tarihi" type="date" value={item.due_date || ""} onChange={(value) => update(index, { due_date: value })} /><Field label="Ödeme tarihi" type="date" value={item.payment_date || ""} onChange={(value) => update(index, { payment_date: value })} /><InfoItem label="Oluşturulma tarihi" value={formatDateTime(item.created_at)} /><InfoItem label="Güncellenme tarihi" value={formatDateTime(item.updated_at)} /><TextArea label="Not" value={item.payment_note || ""} onChange={(value) => update(index, { payment_note: value })} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(item.visible_to_customer)} onChange={(event) => update(index, { visible_to_customer: event.target.checked })} /> Müşteri Panelinde Görünür</label></div><div className="mt-4 flex flex-wrap justify-end gap-2"><RecordActionButton tone="cyan" onClick={() => recordActionDetail("Ödeme Detayı", [["Müşteri", companyName(content, item.company_id)], ["Tutar", `${Number(item.amount || 0).toLocaleString("tr-TR")} TL`], ["Durum", item.status], ["Hizmet dönemi", item.service_period], ["Son ödeme", formatDate(item.due_date)]])}>Detay</RecordActionButton>{canManage && (archived ? <RecordActionButton tone="amber" onClick={() => updateById(item.id, { archived_at: null, deleted_at: null }, "Ödeme arşivden çıkarıldı")}>Arşivden Çıkar</RecordActionButton> : <RecordActionButton tone="amber" onClick={() => updateById(item.id, { archived_at: new Date().toISOString() }, "Ödeme arşivlendi")}>Arşivle</RecordActionButton>)}{canManage && item.status === "İptal" && <RecordActionButton tone="emerald" onClick={() => setStatus(item.id, "Bekliyor")}>Tekrar Bekliyor Yap</RecordActionButton>}{canManage && item.status !== "Ödendi" && <RecordActionButton tone="emerald" onClick={() => setStatus(item.id, "Ödendi")}>Ödendi Yap</RecordActionButton>}{canManage && <RecordActionButton tone="red" onClick={() => deletePayment(item.id)}>Sil</RecordActionButton>}{canManage && <button onClick={() => save?.()} className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">Kaydet</button>}<button onClick={() => window.location.reload()} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700">Vazgeç</button></div></div>;
  })}{!filteredItems.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-6 text-sm text-slate-400">Bu filtrelerle ödeme kaydı bulunamadı.</p>}</div></Panel>;
}

function buildDemoCompetitors(sector = "Yerel işletme", city = "Manisa") {
  return ["Bölge Lideri", "Yeni Rakip", "Premium Alternatif"].map((name, index) => ({
    name: `${city} ${sector} ${name}`,
    website: index !== 1,
    instagram: index !== 2,
    rating: Number((4.1 + index * 0.2).toFixed(1)),
    reviewCount: [82, 24, 140][index],
    adSignal: index === 0 ? "Aktif reklam sinyali" : "Sınırlı görünürlük",
    strengths: index === 0 ? "Yüksek yorum ve güçlü görünürlük" : "Niş hedef kitleye yakın mesaj",
    weaknesses: index === 1 ? "Web sitesi ve yorum sayısı zayıf" : "Kreatif çeşitliliği sınırlı",
    opportunities: "Daha net teklif, remarketing ve sosyal kanıt içerikleriyle ayrışma fırsatı"
  }));
}

function CompetitorAnalysisCenter({ content, setContent }: any) {
  const items = content.competitorAnalyses || [];
  const [busy, setBusy] = useState("");
  const update = (index, patch) => updateCollection(content, setContent, "competitorAnalyses", items.map((item, i) => i === index ? { ...item, ...patch } : item));
  function add() {
    const company = (content.companies || [])[0];
    updateCollection(content, setContent, "competitorAnalyses", [{ id: `${Date.now()}`, company_id: company?.id || "", sector: company?.sector || "", city: company?.city || "", district: "", competitors: [], ai_summary: "", opportunities: "", recommended_actions: "" }, ...items]);
  }
  async function generate(index: number) {
    const item = items[index];
    const competitors = item.competitors?.length ? item.competitors : buildDemoCompetitors(item.sector, item.city);
    setBusy(item.id || `${index}`);
    const prompt = `${companyName(content, item.company_id)} için rakip analizi yaz. Rakipler: ${JSON.stringify(competitors)}. Rakip Özeti, Fırsatlar ve Önerilen Aksiyonlar başlıklarıyla Türkçe yaz.`;
    const response = await fetch("/api/admin/ai-generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
    const data = await response.json().catch(() => ({}));
    update(index, { competitors, ai_summary: data.output || "Rakipler görünürlük ve yorum gücü açısından takip edilmeli.", opportunities: "Web sitesi, Instagram içerikleri ve yorum yönetimiyle fark yaratılabilir.", recommended_actions: "Haftalık kreatif testleri, Google yorum aksiyonu ve Meta reklam takibi önerilir." });
    setBusy("");
  }
  return <Panel title="Rakip Analizi"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-400">Rakipleri manuel girin veya demo rakip listesiyle güvenli analiz taslağı üretin.</p><button onClick={add} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950">Rakip analizi ekle</button></div><div className="grid gap-4">{items.map((item, index) => <div key={item.id || index} className="rounded-[8px] border border-slate-200 bg-slate-50 p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><CompanySelect value={item.company_id || ""} onChange={(value) => update(index, { company_id: value })} companies={content.companies} /><Field label="Sektör" value={item.sector || ""} onChange={(value) => update(index, { sector: value })} /><Field label="İl" value={item.city || ""} onChange={(value) => update(index, { city: value })} /><Field label="İlçe" value={item.district || ""} onChange={(value) => update(index, { district: value })} /></div><TextArea label="Rakipler JSON" value={JSON.stringify(item.competitors || [], null, 2)} onChange={(value) => { try { update(index, { competitors: JSON.parse(value || "[]") }); } catch {} }} /><div className="grid gap-3 md:grid-cols-3"><TextArea label="Rakip Özeti" value={item.ai_summary || ""} onChange={(value) => update(index, { ai_summary: value })} /><TextArea label="Fırsatlar" value={item.opportunities || ""} onChange={(value) => update(index, { opportunities: value })} /><TextArea label="Önerilen Aksiyonlar" value={item.recommended_actions || ""} onChange={(value) => update(index, { recommended_actions: value })} /></div><div className="mt-3 flex flex-wrap gap-2"><button disabled={busy === (item.id || `${index}`)} onClick={() => generate(index)} className="rounded-full border border-purple-200/30 px-4 py-2 text-xs font-black text-purple-700 disabled:opacity-60">AI rakip özeti üret</button><button onClick={() => update(index, { competitors: buildDemoCompetitors(item.sector, item.city) })} className="rounded-full border border-cyan-200/30 px-4 py-2 text-xs font-black text-cyan-700">Demo rakip listesi üret</button><button onClick={() => updateCollection(content, setContent, "competitorAnalyses", items.filter((_, i) => i !== index))} className="rounded-full border border-red-300/30 px-4 py-2 text-xs text-red-200">Sil</button></div></div>)}{!items.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-6 text-sm text-slate-400">Henüz rakip analizi yok.</p>}</div></Panel>;
}

function createSocialPlan({ sector, goal, platform, duration }: any) {
  const count = duration === "7 gün" ? 7 : duration === "14 gün" ? 14 : 30;
  const types = ["Reels", "Hikaye", "Gönderi", "Carousel (kaydırmalı gönderi)"];
  return Array.from({ length: count }, (_, index) => ({
    day: index + 1,
    contentType: types[index % types.length],
    caption: `${sector || "İşletme"} için ${goal || "Bilinirlik"} odaklı ${platform || "Instagram"} içerik fikri`,
    visualIdea: index % 2 ? "Müşteri sorusu ve çözüm anlatımı" : "Hizmet/fayda odaklı kısa video",
    cta: goal === "Satış" ? "Teklif alın" : goal === "Randevu" ? "Randevu oluşturun" : "Mesaj gönderin",
    hashtags: [`#${String(sector || "hkdijital").replace(/\s+/g, "")}`, "#dijitalpazarlama", "#yerelisletme"]
  }));
}

function SocialPlanGenerator({ content, setContent }: any) {
  const items = content.socialMediaPlans || [];
  const update = (index, patch) => updateCollection(content, setContent, "socialMediaPlans", items.map((item, i) => i === index ? { ...item, ...patch } : item));
  function add() {
    const company = (content.companies || [])[0];
    const base = { id: `${Date.now()}`, company_id: company?.id || "", sector: company?.sector || "", goal: "Bilinirlik", platform: "Instagram", duration: "30 gün", plan_items: [] };
    updateCollection(content, setContent, "socialMediaPlans", [{ ...base, plan_items: createSocialPlan(base) }, ...items]);
  }
  return <Panel title="Sosyal Medya Planı"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-400">Tek tıkla günlük içerik takvimi, caption fikri, görsel fikri, CTA (aksiyon çağrısı) ve hashtag önerileri üretin.</p><button onClick={add} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950">Plan oluştur</button></div><div className="grid gap-4">{items.map((item, index) => <div key={item.id || index} className="rounded-[8px] border border-slate-200 bg-slate-50 p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"><CompanySelect value={item.company_id || ""} onChange={(value) => update(index, { company_id: value })} companies={content.companies} /><Field label="Sektör" value={item.sector || ""} onChange={(value) => update(index, { sector: value })} /><SelectField label="Hedef" value={item.goal || "Bilinirlik"} onChange={(value) => update(index, { goal: value })} options={["Bilinirlik", "Mesaj", "Trafik", "Satış", "Randevu"]} /><SelectField label="Platform" value={item.platform || "Instagram"} onChange={(value) => update(index, { platform: value })} options={["Instagram", "Facebook", "LinkedIn", "TikTok"]} /><SelectField label="Süre" value={item.duration || "30 gün"} onChange={(value) => update(index, { duration: value })} options={["7 gün", "14 gün", "30 gün"]} /></div><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => update(index, { plan_items: createSocialPlan(item) })} className="rounded-full border border-cyan-200/30 px-4 py-2 text-xs font-black text-cyan-700">Takvimi yenile</button><button onClick={() => updateCollection(content, setContent, "socialMediaPlans", items.filter((_, i) => i !== index))} className="rounded-full border border-red-300/30 px-4 py-2 text-xs text-red-200">Sil</button></div><div className="premium-scrollbar mt-4 max-h-[420px] overflow-y-auto rounded-[8px] border border-slate-200"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Gün</th><th>Tür</th><th>Caption fikri</th><th>Görsel fikri</th><th>CTA</th><th>Hashtag</th></tr></thead><tbody>{(item.plan_items || []).map((plan) => <tr key={`${item.id}-${plan.day}`} className="border-t border-slate-200"><td className="p-3 font-black">{plan.day}</td><td>{plan.contentType}</td><td className="max-w-xs pr-3">{plan.caption}</td><td className="max-w-xs pr-3">{plan.visualIdea}</td><td>{plan.cta}</td><td>{(plan.hashtags || []).join(" ")}</td></tr>)}</tbody></table></div></div>)}{!items.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-6 text-sm text-slate-400">Henüz sosyal medya planı yok.</p>}</div></Panel>;
}

function ProfitabilityCenter({ content, setContent, setActive, currentSession, notify }: any) {
  const payments = content.paymentRecords || [];
  const expenses = content.agencyExpenses || [];
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("Tümü");
  const [paymentCompanyFilter, setPaymentCompanyFilter] = useState("");
  const [paymentStartDate, setPaymentStartDate] = useState("");
  const [paymentEndDate, setPaymentEndDate] = useState("");
  const canManagePayments = canManageRecord(currentSession, "tahsilat");
  const thisMonth = new Date().toISOString().slice(0, 7);
  const activePayments = payments.filter((item) => !isArchivedRecord(item));
  const filteredPayments = filterPayments(payments, { status: paymentStatusFilter, companyId: paymentCompanyFilter, startDate: paymentStartDate, endDate: paymentEndDate });
  const monthPayments = activePayments.filter((item) => String(item.service_period || item.due_date || "").startsWith(thisMonth));
  const monthExpenses = expenses.filter((item) => String(item.expense_date || "").startsWith(thisMonth));
  const revenue = monthPayments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const paid = monthPayments.filter((item) => item.status === "Ödendi").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const pending = monthPayments.filter((item) => item.status !== "Ödendi" && item.status !== "İptal").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenseTotal = monthExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const activeCustomers = (content.companies || []).filter((company) => (company.status || "Aktif") === "Aktif").length;
  const update = (index, patch) => updateCollection(content, setContent, "agencyExpenses", expenses.map((item, i) => i === index ? { ...item, ...patch } : item));
  const updatePayment = (id, patch, message = "") => {
    updateCollection(content, setContent, "paymentRecords", payments.map((item) => item.id === id ? { ...item, ...patch, updated_at: new Date().toISOString() } : item));
    if (message) notify?.(`✓ ${message}`, "success");
  };
  const setPaymentStatus = (id, status) => {
    updateCollection(content, setContent, "paymentRecords", payments.map((item) => item.id === id ? stampPaymentStatus(item, status) : item));
    notify?.(`✓ Ödeme durumu ${status} olarak güncellendi`, "success");
  };
  const deletePayment = (id) => {
    if (!confirmRecordAction("Bu ödeme kaydını silmek istediğinize emin misiniz? Kayıt güvenli şekilde silinmiş olarak işaretlenecek.")) return;
    updateCollection(content, setContent, "paymentRecords", payments.map((item) => item.id === id ? softDeleteRecord(item) : item));
    notify?.("✓ Ödeme kaydı silinmiş olarak işaretlendi", "success");
  };
  return <Panel title="Karlılık Dashboard"><div className="mb-5 grid gap-3 md:grid-cols-4"><AgencyStatCard label="Aylık gelir" value={`${revenue.toLocaleString("tr-TR")} TL`} note="Bu ay beklenen toplam" /><AgencyStatCard label="Ödenen / bekleyen" value={`${paid.toLocaleString("tr-TR")} / ${pending.toLocaleString("tr-TR")} TL`} note="Tahsilat dengesi" tone="emerald" /><AgencyStatCard label="Aktif müşteri" value={activeCustomers} note={`Müşteri başı ortalama: ${activeCustomers ? Math.round(revenue / activeCustomers).toLocaleString("tr-TR") : 0} TL`} /><AgencyStatCard label="Tahmini kâr" value={`${(revenue - expenseTotal).toLocaleString("tr-TR")} TL`} note={`Gider: ${expenseTotal.toLocaleString("tr-TR")} TL`} tone={revenue - expenseTotal >= 0 ? "emerald" : "red"} /></div><div className="mb-6 rounded-[8px] border border-slate-200 bg-slate-50 p-4"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-slate-900">Ödeme Geçmişi</h3><p className="mt-1 text-sm text-slate-400">Karlılık hesabında kullanılan tahsilat kayıtlarını durum, müşteri ve tarihe göre inceleyin.</p></div><span className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600">{filteredPayments.length} kayıt</span></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"><SelectField label="Durum filtresi" value={paymentStatusFilter} onChange={setPaymentStatusFilter} options={paymentHistoryFilters} /><CompanySelect value={paymentCompanyFilter} onChange={setPaymentCompanyFilter} companies={content.companies} /><Field label="Başlangıç tarihi" type="date" value={paymentStartDate} onChange={setPaymentStartDate} /><Field label="Bitiş tarihi" type="date" value={paymentEndDate} onChange={setPaymentEndDate} /><button onClick={() => { setPaymentStatusFilter("Tümü"); setPaymentCompanyFilter(""); setPaymentStartDate(""); setPaymentEndDate(""); }} className="self-end rounded-[8px] border border-slate-200 px-4 py-3 text-sm font-black text-slate-700">Filtreleri Temizle</button></div><div className="mt-4 grid gap-2">{filteredPayments.slice(0, 12).map((item) => <div key={item.id || `${item.company_id}-${item.due_date}`} className={`grid gap-2 rounded-[8px] border p-3 text-sm xl:grid-cols-[1fr_.55fr_.55fr_.7fr_1.3fr] ${isArchivedRecord(item) ? "border-amber-300/25 bg-amber-300/[0.06]" : "border-slate-200 bg-slate-50"}`}><span className="font-black text-slate-900">{companyName(content, item.company_id)}</span><span>{Number(item.amount || 0).toLocaleString("tr-TR")} TL</span><span>{item.status || "Bekliyor"}</span><span>{item.service_period || item.due_date || "-"}</span><span className="flex flex-wrap gap-2 xl:justify-end"><RecordActionButton tone="cyan" onClick={() => recordActionDetail("Ödeme Detayı", [["Müşteri", companyName(content, item.company_id)], ["Tutar", `${Number(item.amount || 0).toLocaleString("tr-TR")} TL`], ["Durum", item.status], ["Hizmet dönemi", item.service_period], ["Son ödeme", formatDate(item.due_date)]])}>Detay</RecordActionButton>{canManagePayments && <RecordActionButton onClick={() => setActive?.("Tahsilat")}>Düzenle</RecordActionButton>}{canManagePayments && (isArchivedRecord(item) ? <RecordActionButton tone="amber" onClick={() => updatePayment(item.id, { archived_at: null, deleted_at: null }, "Ödeme arşivden çıkarıldı")}>Arşivden Çıkar</RecordActionButton> : <RecordActionButton tone="amber" onClick={() => updatePayment(item.id, { archived_at: new Date().toISOString() }, "Ödeme arşivlendi")}>Arşivle</RecordActionButton>)}{canManagePayments && item.status !== "Ödendi" && <RecordActionButton tone="emerald" onClick={() => setPaymentStatus(item.id, "Ödendi")}>Ödendi Yap</RecordActionButton>}{canManagePayments && item.status === "İptal" && <RecordActionButton tone="emerald" onClick={() => setPaymentStatus(item.id, "Bekliyor")}>Tekrar Bekliyor Yap</RecordActionButton>}{canManagePayments && <RecordActionButton tone="red" onClick={() => deletePayment(item.id)}>Sil</RecordActionButton>}</span></div>)}{!filteredPayments.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-4 text-sm text-slate-400">Bu filtrelerle ödeme kaydı bulunamadı.</p>}</div></div><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="font-black">Gider takibi</h3><button onClick={() => updateCollection(content, setContent, "agencyExpenses", [{ id: `${Date.now()}`, title: "Yeni gider", amount: 0, expense_date: new Date().toISOString().slice(0, 10), category: "Diğer", note: "" }, ...expenses])} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950">Gider ekle</button></div><div className="grid gap-3">{expenses.map((item, index) => <div key={item.id || index} className="grid gap-3 rounded-[8px] border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-5"><Field label="Gider başlığı" value={item.title || ""} onChange={(value) => update(index, { title: value })} /><Field label="Tutar" type="number" value={item.amount || 0} onChange={(value) => update(index, { amount: Number(value || 0) })} /><Field label="Tarih" type="date" value={item.expense_date || ""} onChange={(value) => update(index, { expense_date: value })} /><SelectField label="Kategori" value={item.category || "Diğer"} onChange={(value) => update(index, { category: value })} options={["Reklam Araçları", "Yazılım", "Tasarım", "Personel", "Operasyon", "Diğer"]} /><Field label="Not" value={item.note || ""} onChange={(value) => update(index, { note: value })} /><button onClick={() => updateCollection(content, setContent, "agencyExpenses", expenses.filter((_, i) => i !== index))} className="w-fit rounded-full border border-red-300/30 px-3 py-2 text-xs text-red-200">Sil</button></div>)}</div></Panel>;
}

function HKAssistantCenter({ content }: any) {
  const [prompt, setPrompt] = useState("Bugün hangi müşterilere odaklanmalıyım?");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const prompts = ["Bugün hangi müşterilere odaklanmalıyım?", "Bu ay en riskli müşteriler hangileri?", "Hangi tahsilatlar gecikmiş?", "Son 30 günde en çok gelir getiren müşteri kim?", "ACN İlk Yardım özetle", "Bu hafta yapılacak görevleri göster", "Hangi leadlere teklif göndermeliyim?"];
  function localAnswer() {
    const tasks = content.agencyTasks || [];
    const payments = content.paymentRecords || [];
    const leads = content.leads || [];
    const companies = content.companies || [];
    const lowerPrompt = prompt.toLocaleLowerCase("tr");
    const criticalTasks = tasks.filter((item) => item.priority === "Kritik" && item.status !== "Tamamlandı").slice(0, 5);
    const overduePayments = payments.filter((item) => item.status === "Gecikmiş").slice(0, 5);
    const hotLeads = leads.filter((lead) => Number(lead.lead_heat_score || 0) >= 70 && !["Kazandı", "Kaybedildi"].includes(lead.status)).slice(0, 5);
    const riskyCustomers = companies
      .map((company) => {
        const context = {
          campaigns: (content.campaigns || []).filter((item) => item.company_id === company.id),
          payments: payments.filter((item) => item.company_id === company.id),
          tasks: tasks.filter((item) => item.company_id === company.id),
          reports: (content.reports || content.monthlyReports || []).filter((item) => item.company_id === company.id),
          activities: (content.activityLogs || []).filter((item) => item.company_id === company.id || item.entity_id === company.id),
          relatedLead: leads.find((lead) => lead.company_id === company.id || String(lead.company || "").toLocaleLowerCase("tr") === String(company.name || "").toLocaleLowerCase("tr"))
        };
        return { company, health: calculateCustomerHealth(company, context) };
      })
      .sort((a, b) => a.health.score - b.health.score)
      .slice(0, 5);
    if (lowerPrompt.includes("riskli")) {
      return riskyCustomers.length
        ? `En riskli müşteriler:\n\n${riskyCustomers.map((item, index) => `${index + 1}. ${item.company.name} · ${item.health.emoji} ${item.health.score}/100 (${item.health.status})\n- ${item.health.reasons.slice(0, 2).join("\n- ")}`).join("\n\n")}`
        : "Riskli müşteri değerlendirmesi için yeterli müşteri verisi bulunamadı.";
    }
    if (lowerPrompt.includes("gecikmiş") || lowerPrompt.includes("tahsilat")) {
      return overduePayments.length
        ? `Geciken tahsilatlar:\n\n${overduePayments.map((item) => `- ${companyName(content, item.company_id)} · ${Number(item.amount || 0).toLocaleString("tr-TR")} TL · Son ödeme: ${formatDate(item.due_date)}`).join("\n")}`
        : "Geciken tahsilat görünmüyor. Tahsilat ekranında bekleyen kayıtları ayrıca kontrol edebilirsiniz.";
    }
    if (lowerPrompt.includes("30 günde") || lowerPrompt.includes("gelir")) {
      const limit = new Date();
      limit.setDate(limit.getDate() - 30);
      const paid = payments.filter((item) => item.status === "Ödendi" && new Date(item.payment_date || item.updated_at || item.created_at || 0) >= limit);
      const byCompany = paid.reduce((acc, item) => ({ ...acc, [item.company_id]: (acc[item.company_id] || 0) + Number(item.amount || 0) }), {});
      const top = Object.entries(byCompany).sort((a: any, b: any) => b[1] - a[1])[0];
      return top ? `Son 30 günde en çok gelir getiren müşteri: ${companyName(content, top[0])} · ${Number(top[1] || 0).toLocaleString("tr-TR")} TL tahsilat.` : "Son 30 gün içinde ödenmiş tahsilat kaydı bulunamadı.";
    }
    if (lowerPrompt.includes("hafta") && lowerPrompt.includes("görev")) {
      const end = new Date();
      end.setDate(end.getDate() + 7);
      const weekTasks = tasks.filter((item) => isOpenTask(item) && item.due_date && item.due_date >= dateOnly(new Date().toISOString()) && item.due_date <= dateOnly(end.toISOString())).slice(0, 8);
      return weekTasks.length ? `Bu hafta yapılacak görevler:\n\n${weekTasks.map((item) => `- ${item.title} · ${companyName(content, item.company_id)} · ${formatDate(item.due_date)} · ${item.priority || "Orta"}`).join("\n")}` : "Bu hafta tarihli açık görev görünmüyor.";
    }
    const matchedCompany = companies.find((company) => lowerPrompt.includes(String(company.name || "").toLocaleLowerCase("tr")));
    if (matchedCompany) {
      const health = riskyCustomers.find((item) => item.company.id === matchedCompany.id)?.health || calculateCustomerHealth(matchedCompany, {
        campaigns: (content.campaigns || []).filter((item) => item.company_id === matchedCompany.id),
        payments: payments.filter((item) => item.company_id === matchedCompany.id),
        tasks: tasks.filter((item) => item.company_id === matchedCompany.id),
        reports: (content.reports || content.monthlyReports || []).filter((item) => item.company_id === matchedCompany.id),
        activities: (content.activityLogs || []).filter((item) => item.company_id === matchedCompany.id)
      });
      return `${matchedCompany.name} özeti:\n\nSağlık puanı: ${health.emoji} ${health.score}/100 (${health.status})\nAçık görev: ${tasks.filter((item) => item.company_id === matchedCompany.id && isOpenTask(item)).length}\nBekleyen tahsilat: ${payments.filter((item) => item.company_id === matchedCompany.id && !["Ödendi", "İptal"].includes(item.status || "Bekliyor")).reduce((sum, item) => sum + Number(item.amount || 0), 0).toLocaleString("tr-TR")} TL\n\n${health.reasons.map((item) => `- ${item}`).join("\n")}`;
    }
    return [
      "HK Intelligence Asistanı yerel değerlendirme:",
      criticalTasks.length ? `Öncelikli görevler: ${criticalTasks.map((item) => item.title).join(", ")}` : "Kritik görev görünmüyor.",
      overduePayments.length ? `Geciken tahsilatlar: ${overduePayments.map((item) => `${companyName(content, item.company_id)} ${item.amount || 0} TL`).join(", ")}` : "Geciken tahsilat görünmüyor.",
      hotLeads.length ? `Teklif için sıcak leadler: ${hotLeads.map((lead) => lead.company || lead.name).join(", ")}` : "Sıcak lead listesi şu an sakin.",
      "Öneri: Bugün kritik görevleri kapatın, geciken tahsilatları arayın ve sıcak leadlere teklif gönderin."
    ].join("\n\n");
  }
  async function ask() {
    setLoading(true);
    const context = { tasks: (content.agencyTasks || []).slice(0, 20), payments: (content.paymentRecords || []).slice(0, 20), reports: (content.monthlyReports || []).slice(0, 10), leads: (content.leads || []).slice(0, 20) };
    const response = await fetch("/api/admin/ai-generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: `${prompt}\n\nYerel ajans verisi: ${JSON.stringify(context)}` }) });
    const data = await response.json().catch(() => ({}));
    setAnswer(data.output || localAnswer());
    setLoading(false);
  }
  return <Panel title="HK Intelligence Asistanı"><div className="grid gap-5 xl:grid-cols-[300px_1fr]"><aside className="rounded-[8px] border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">Operasyon komutları</p><div className="mt-4 grid gap-2">{prompts.map((item) => <button key={item} onClick={() => setPrompt(item)} className="rounded-[8px] border border-slate-200 p-3 text-left text-xs font-bold text-slate-600 hover:border-cyan-200/30 hover:bg-cyan-300/10">{item}</button>)}</div></aside><section className="rounded-[8px] border border-slate-200 bg-slate-50 p-4"><TextArea label="Ajans sorusu" value={prompt} onChange={setPrompt} /><button disabled={loading} onClick={ask} className="mt-4 rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60">{loading ? "Yanıt hazırlanıyor..." : "Asistana sor"}</button>{answer && <pre className="mt-4 whitespace-pre-wrap rounded-[8px] border border-cyan-200/20 bg-cyan-300/10 p-4 text-sm leading-7 text-cyan-700">{answer}</pre>}</section></div></Panel>;
}

function SectorSystemsCenter({ content, setContent }: any) {
  const fallback = ["Oto Galeri", "Emlak Ofisi", "Güzellik Merkezi", "Klinik", "Eğitim Merkezi"].map((sector) => ({ id: sector, sector_name: sector, suggested_crm_fields: [], suggested_package_labels: [], suggested_report_metrics: [], suggested_content_categories: [], is_active: true }));
  const items = content.sectorConfigs?.length ? content.sectorConfigs : fallback;
  const update = (index, patch) => updateCollection(content, setContent, "sectorConfigs", items.map((item, i) => i === index ? { ...item, ...patch } : item));
  return <Panel title="Sektör Sistemleri Altyapısı"><p className="mb-5 text-sm leading-6 text-slate-400">Bu alan gelecekte oto galeri, emlak ofisi, güzellik merkezi, klinik ve eğitim merkezi gibi sektörlere özel CRM, teklif, rapor ve içerik şablonlarının temelini hazırlar. Mevcut uygulama davranışını değiştirmez.</p><div className="grid gap-4">{items.map((item, index) => <div key={item.id || item.sector_name || index} className="rounded-[8px] border border-slate-200 bg-slate-50 p-4"><div className="grid gap-3 md:grid-cols-2"><Field label="Sektör adı" value={item.sector_name || ""} onChange={(value) => update(index, { sector_name: value })} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.is_active !== false} onChange={(event) => update(index, { is_active: event.target.checked })} /> Aktif yapılandırma</label><TextArea label="Önerilen CRM alanları" value={(item.suggested_crm_fields || []).join("\n")} onChange={(value) => update(index, { suggested_crm_fields: value.split("\n").filter(Boolean) })} /><TextArea label="Önerilen teklif paketleri" value={(item.suggested_package_labels || []).join("\n")} onChange={(value) => update(index, { suggested_package_labels: value.split("\n").filter(Boolean) })} /><TextArea label="Önerilen rapor metrikleri" value={(item.suggested_report_metrics || []).join("\n")} onChange={(value) => update(index, { suggested_report_metrics: value.split("\n").filter(Boolean) })} /><TextArea label="Önerilen içerik kategorileri" value={(item.suggested_content_categories || []).join("\n")} onChange={(value) => update(index, { suggested_content_categories: value.split("\n").filter(Boolean) })} /></div></div>)}</div></Panel>;
}

async function uploadFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/media", { method: "POST", body: form });
  const data = await response.json();
  return response.ok ? data.media : null;
}

function Upload({ onUrl }: any) {
  return <label className="grid cursor-pointer gap-2 rounded-[8px] border border-dashed border-cyan-200/30 bg-cyan-200/10 p-4 text-sm font-semibold text-cyan-700"><ImagePlus size={18} />Dosya yükle<input className="hidden" type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp,video/mp4,application/pdf" onChange={async (e) => { const file = e.target.files?.[0]; if (file) onUrl((await uploadFile(file))?.url || ""); }} /><span className="text-xs text-slate-400">PNG, JPG, SVG, WebP, MP4, PDF</span></label>;
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
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Ana sayfa birincil CTA" value={pages.home.primaryCta} onChange={(v) => updatePage("home", { primaryCta: v })} />
          <Field label="Ana sayfa ikincil CTA" value={pages.home.secondaryCta} onChange={(v) => updatePage("home", { secondaryCta: v })} />
        </div>
        <Field label="Hakkımda başlık" value={pages.about.title} onChange={(v) => updatePage("about", { title: v })} />
        <TextArea label="Hakkımda içerik" value={pages.about.content} onChange={(v) => updatePage("about", { content: v })} />
        <Field label="Sertifikalar başlık" value={pages.certificates.title} onChange={(v) => updatePage("certificates", { title: v })} />
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
  return <div className="grid gap-2"><TextArea label={label} rows={10} value={text} onChange={setText} /><button onClick={() => onChange(JSON.parse(text))} className="w-fit rounded-full border border-slate-200 px-4 py-2 text-sm font-bold">JSON uygula</button></div>;
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
        {items.map((item, index) => <div key={item.id} className="grid gap-3 rounded-[8px] border border-slate-200 p-4">
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
  const [folderFilter, setFolderFilter] = useState(() => {
    if (String(view || "").includes("Meta")) return "Meta Leadleri";
    if (String(view || "").includes("Google")) return "Google Leadleri";
    if (String(view || "").includes("Sosyal")) return "Sosyal İstihbarat Leadleri";
    if (String(view || "").includes("Takip")) return "Takip Bekleyenler";
    if (String(view || "").includes("Reddedilen") || String(view || "").includes("Silinen")) return "Arşiv";
    return "Web Başvuruları";
  });
  const [sectorFilter, setSectorFilter] = useState("");
  const [budgetFilter, setBudgetFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedLead, setSelectedLead] = useState(null);
  const [message, setMessage] = useState("");
  const allLeads = content.leads ?? [];
  const isMetaLead = (lead) => lead.source === "Meta Analiz";
  const isGoogleLead = (lead) => lead.source === "Google Ads Analiz" || String(lead.source || "").includes("Google");
  const isSocialLead = (lead) => ["Sosyal İstihbarat Merkezi", "Sosyal Medya Denetimi"].includes(lead.source);
  const isCustomerLead = (lead) => ["Kazanıldı", "Dönüştürüldü", "Müşteri Oldu"].includes(lead.status);
  const isFollowLead = (lead) => ["Takipte", "Görüşülecek", "Teklif Hazırlanıyor", "Teklif Gönderildi"].includes(lead.status) || Boolean(lead.follow_up_date || lead.followUpDate);
  const isArchivedLead = (lead) => isLeadDeleted(lead) || isLeadRejected(lead) || ["Kaybedildi", "Reddedildi"].includes(lead.status);
  const isWebLead = (lead) => !isMetaLead(lead) && !isGoogleLead(lead) && !isSocialLead(lead) && !isCustomerLead(lead) && !isArchivedLead(lead);
  const crmFolders = [
    { label: "Meta Leadleri", description: "Meta Analysis kaynaklı fırsatlar", icon: <BarChart3 size={16} />, match: isMetaLead, accent: "from-orange-400 to-rose-500" },
    { label: "Google Leadleri", description: "Google Ads / Maps sinyalleri", icon: <Search size={16} />, match: isGoogleLead, accent: "from-cyan-400 to-blue-600" },
    { label: "Sosyal İstihbarat Leadleri", description: "Sosyal audit ve profil kayıtları", icon: <Sparkles size={16} />, match: isSocialLead, accent: "from-yellow-300 to-orange-500" },
    { label: "Web Başvuruları", description: "Form ve teklif sihirbazı kayıtları", icon: <FileBarChart size={16} />, match: isWebLead, accent: "from-blue-400 to-indigo-600" },
    { label: "Müşteriler", description: "Müşteriye dönüşen başvurular", icon: <Building2 size={16} />, match: isCustomerLead, accent: "from-emerald-400 to-teal-600" },
    { label: "Takip Bekleyenler", description: "Takip tarihi veya açık süreç", icon: <Activity size={16} />, match: isFollowLead, accent: "from-purple-400 to-fuchsia-600" },
    { label: "Arşiv", description: "Reddedilen ve silinen kayıtlar", icon: <Trash2 size={16} />, match: isArchivedLead, accent: "from-slate-500 to-slate-800" }
  ];
  const activeFolder = crmFolders.find((folder) => folder.label === folderFilter) || crmFolders[3];
  const folderCounts = crmFolders.reduce((acc, folder) => {
    acc[folder.label] = allLeads.filter(folder.match).length;
    return acc;
  }, {});
  const heatBadge = (lead) => {
    const score = Number(lead.lead_heat_score || 0);
    if (score >= 70) return { label: "Sıcak", className: "border-red-300/20 bg-red-400/[0.08] text-red-100" };
    if (score >= 50) return { label: "Ilık", className: "border-amber-300/20 bg-amber-300/[0.08] text-amber-700" };
    return { label: "Soğuk", className: "border-slate-200 bg-white/[0.045] text-slate-600" };
  };
  const crmRecentActivity = [
    ...(content.activityLogs || []).slice(0, 4).map((item) => ({ id: `activity-${item.id}`, title: item.action || "CRM aktivitesi", text: item.entity || item.actor_name || "HK OS", date: item.created_at })),
    ...allLeads.slice(0, 4).map((lead) => ({ id: `lead-${lead.id}`, title: lead.source || "Yeni lead", text: lead.company || lead.name || "İsimsiz başvuru", date: lead.created_at || lead.createdAt }))
  ].sort((a, b) => Number(new Date(b.date)) - Number(new Date(a.date))).slice(0, 6);
  const leads = allLeads
    .filter((lead) => activeFolder.match(lead))
    .filter((lead) => statusTab === "Tüm Başvurular" ? (folderFilter === "Arşiv" || (!isLeadDeleted(lead) && !isLeadRejected(lead))) : crmTabForLead(lead) === statusTab)
    .filter((lead) => JSON.stringify(lead).toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")))
    .filter((lead) => !sourceFilter || lead.source === sourceFilter)
    .filter((lead) => !statusFilter || lead.status === statusFilter)
    .filter((lead) => !sectorFilter || (lead.business_type || lead.businessType) === sectorFilter)
    .filter((lead) => !budgetFilter || lead.budget === budgetFilter)
    .filter((lead) => !dateFrom || String(lead.created_at || lead.createdAt || "").slice(0, 10) >= dateFrom)
    .filter((lead) => !dateTo || String(lead.created_at || lead.createdAt || "").slice(0, 10) <= dateTo)
    .filter((lead) => view !== "Teklif Sihirbazı Kayıtları" || ["quote", "Teklif Formu", "Teklif Sihirbazı"].includes(lead.source));
  const previewLead = selectedLead || leads[0];
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
      <div className="grid min-w-0 gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="grid min-w-0 gap-4 self-start xl:w-[240px]">
          <section className="rounded-[8px] border border-slate-200 bg-white p-3 shadow-[0_10px_28px_rgba(0,0,0,.12)]">
            <p className="px-1 text-xs font-black uppercase tracking-[.14em] text-cyan-700">CRM klasörleri</p>
            <div className="mt-3 grid gap-1.5">
              {crmFolders.map((folder) => (
                <button key={folder.label} type="button" onClick={() => setFolderFilter(folder.label)} className={`group flex w-full min-w-0 items-center gap-2.5 rounded-[8px] border px-2.5 py-2 text-left transition ${folderFilter === folder.label ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-700" : "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-white/[0.055] hover:text-slate-700"}`}>
                  <span className={`grid size-8 shrink-0 place-items-center rounded-[8px] border ${folderFilter === folder.label ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-700" : "border-slate-200 bg-white/[0.045] text-slate-400"}`}>{folder.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-black">{folder.label}</span>
                    <span className={`mt-0.5 hidden truncate text-[10px] leading-4 sm:block ${folderFilter === folder.label ? "text-cyan-700/70" : "text-slate-500"}`}>{folder.description}</span>
                  </span>
                  <span className={`grid min-w-7 shrink-0 place-items-center rounded-full px-2 py-1 text-[10px] font-black ${folderFilter === folder.label ? "bg-cyan-300 text-slate-950" : "bg-slate-50 text-slate-600"}`}>{folderCounts[folder.label] || 0}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="rounded-[8px] border border-slate-200 bg-slate-50 p-3">
            <p className="px-1 text-xs font-black uppercase tracking-[.14em] text-slate-400">Recent activity</p>
            <div className="mt-3 grid gap-1.5">
              {crmRecentActivity.map((item) => <div key={item.id} className="rounded-[8px] border border-slate-200 bg-white/[0.025] p-2.5"><p className="truncate text-xs font-black text-slate-900">{item.title}</p><p className="mt-1 truncate text-xs text-slate-400">{item.text}</p><p className="mt-1.5 text-[10px] font-bold text-slate-500">{item.date ? formatDateTime(item.date) : "Bekliyor"}</p></div>)}
              {!crmRecentActivity.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-3 text-xs text-slate-400">Henüz aktivite yok.</p>}
            </div>
          </section>
        </aside>
        <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-slate-200 bg-white p-3">
            <div><p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">{activeFolder.label}</p><h3 className="mt-1 text-base font-black text-slate-900">{folderCounts[activeFolder.label] || 0} kayıt</h3></div>
            <button onClick={exportCsv} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-cyan-300 px-3 text-sm font-black text-slate-950"><Download size={16} /> CSV Dışa Aktar</button>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {crmStatusTabs.map((tab) => <button key={tab} onClick={() => setStatusTab(tab)} className={`rounded-[8px] border px-3 py-2 text-xs font-black transition ${statusTab === tab ? "border-cyan-200/45 bg-cyan-200/10 text-cyan-700" : "border-slate-200 bg-white/[0.025] text-slate-400 hover:border-cyan-200/30 hover:text-cyan-700"}`}>{tab} <span className="ml-1 text-[10px] opacity-70">{tabCounts[tab] || 0}</span></button>)}
          </div>
          <div className="mb-4 grid gap-3 lg:grid-cols-[1.2fr_repeat(3,.7fr)]">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Başvuru ara..." className="min-h-11 rounded-[8px] border border-slate-200 bg-slate-50 px-3 text-slate-900" />
            <SelectField label="Kaynak" value={sourceFilter} onChange={setSourceFilter} options={leadSourceOptions} placeholder="Tüm kaynaklar" />
            <SelectField label="Durum" value={statusFilter} onChange={setStatusFilter} options={leadStatuses} placeholder="Tüm durumlar" />
            <SelectField label="Sektör" value={sectorFilter} onChange={setSectorFilter} options={sectorOptions} placeholder="Tüm sektörler" />
          </div>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <input value={budgetFilter} onChange={(e) => setBudgetFilter(e.target.value)} placeholder="Bütçe filtresi" className="min-h-11 rounded-[8px] border border-slate-200 bg-slate-50 px-3 text-slate-900" />
            <Field label="Başlangıç tarihi" type="date" value={dateFrom} onChange={setDateFrom} />
            <Field label="Bitiş tarihi" type="date" value={dateTo} onChange={setDateTo} />
          </div>
          {message && <p className="mb-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-700">{message}</p>}
          <div className="grid gap-3">
            {leads.map((lead) => {
              const heat = heatBadge(lead);
              return (
                <button key={lead.id} onClick={() => setSelectedLead(lead)} className="rounded-[8px] border border-slate-200 bg-white/[0.025] p-4 text-left transition hover:border-cyan-200/35 hover:bg-cyan-200/[0.045]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><h3 className="font-black">{lead.name || "İsimsiz başvuru"}</h3><p className="mt-1 text-sm text-slate-400">{lead.source || "Form"} · {lead.company || "-"} · {lead.phone || lead.email || "-"}</p></div>
                    <div className="flex flex-wrap justify-end gap-2"><span className={`rounded-full border px-3 py-1 text-xs font-black ${heat.className}`}>{heat.label}</span><span className="rounded-full bg-cyan-200/10 px-3 py-1 text-xs font-bold text-cyan-700">{lead.status || "Yeni"}</span></div>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">İşletme: {lead.business_type || lead.businessType || "-"} · Hedef: {lead.goal || "-"} · Bütçe: {lead.budget || "-"}</p>
                  <p className="mt-1 text-xs text-slate-500">Önerilen paket: {lead.recommended_package || lead.recommendedPackage || "-"} · Gönderim: {formatDate(lead.created_at || lead.createdAt)}</p>
                  {lead.rejection_reason && <p className="mt-2 rounded-[8px] border border-red-300/20 bg-red-500/10 p-2 text-xs text-red-100">Red nedeni: {lead.rejection_reason}</p>}
                </button>
              );
            })}
            {!leads.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">Bu klasörde seçili filtrelerle başvuru bulunamadı.</p>}
          </div>
          </div>
          <aside className="h-fit rounded-[8px] border border-slate-200 bg-white p-4 shadow-[0_12px_34px_rgba(0,0,0,.14)]">
            <p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">Lead önizleme</p>
            {previewLead ? (
              <div className="mt-4">
                <h3 className="text-lg font-black text-slate-900">{previewLead.company || previewLead.name || "İsimsiz başvuru"}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">{previewLead.source || "Form"} · {previewLead.status || "Yeni"}</p>
                <div className="mt-4 grid gap-2 text-sm">
                  <InfoItem label="İletişim" value={previewLead.phone || previewLead.email || "-"} />
                  <InfoItem label="Sektör" value={previewLead.business_type || previewLead.businessType || "-"} />
                  <InfoItem label="Hedef" value={previewLead.goal || "-"} />
                  <InfoItem label="Bütçe" value={previewLead.budget || "-"} />
                </div>
                <div className="mt-4 grid gap-2">
                  <button onClick={() => setSelectedLead(previewLead)} className="rounded-[8px] bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950">Düzenle / Detayı Aç</button>
                  <button onClick={() => setSelectedLead(previewLead)} className="rounded-[8px] border border-purple-200/25 px-4 py-2 text-sm font-black text-purple-700">AI Analiz</button>
                  <button onClick={() => setActive("Teklif Hazırlama")} className="rounded-[8px] border border-amber-200/25 px-4 py-2 text-sm font-black text-amber-700">Teklif Hazırla</button>
                  <a href={previewLead.phone ? `https://wa.me/${String(previewLead.phone).replace(/\D/g, "")}` : "#"} target="_blank" rel="noreferrer" className="rounded-[8px] border border-emerald-200/25 px-4 py-2 text-center text-sm font-black text-emerald-700">WhatsApp</a>
                  <button onClick={() => setSelectedLead(previewLead)} className="rounded-[8px] border border-cyan-200/25 px-4 py-2 text-sm font-black text-cyan-700">PDF Audit</button>
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-[8px] border border-dashed border-slate-200 p-4 text-sm leading-6 text-slate-400">Bu klasörde önizlenecek lead bulunamadı.</p>
            )}
          </aside>
        </div>
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

function pipelineStageForLead(lead: any) {
  const status = lead.pipeline_stage || lead.status || "Yeni Lead";
  if (["Yeni Başvuru", "Yeni", "Görüşülecek"].includes(status)) return "Yeni Lead";
  if (["İletişime Geçildi"].includes(status)) return "İletişim Kuruldu";
  if (["Toplantı Yapıldı"].includes(status)) return "Toplantı Yapıldı";
  if (["Teklif Hazırlanıyor", "Teklif Gönderildi"].includes(status)) return "Teklif Gönderildi";
  if (["Takipte"].includes(status)) return "Takipte";
  if (["Kazanıldı", "Müşteri Oldu", "Dönüştürüldü"].includes(status)) return "Kazanıldı";
  if (["Kaybedildi", "Reddedildi"].includes(status)) return "Kaybedildi";
  return salesPipelineStages.includes(status) ? status : "Yeni Lead";
}

function SalesPipeline({ content, setContent, save, setActive }: any) {
  const [selectedLead, setSelectedLead] = useState(null);
  const [message, setMessage] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const activeLeads = (content.leads || []).filter((lead) => !isLeadDeleted(lead));
  const updateLead = async (lead: any, patch: any, success = "Satış hunisi güncellendi.") => {
    const nextLead = { ...lead, ...patch, updated_at: new Date().toISOString() };
    const next = { ...content, leads: (content.leads || []).map((item) => item.id === lead.id ? nextLead : item) };
    setContent(next);
    setSelectedLead((current) => current?.id === lead.id ? nextLead : current);
    setMessage(success);
    await save(next);
  };
  const addNote = async () => {
    if (!selectedLead || !noteDraft.trim()) return;
    const oldNotes = selectedLead.notes || selectedLead.internalNotes || "";
    await updateLead(selectedLead, { notes: `${oldNotes}${oldNotes ? "\n" : ""}${new Date().toLocaleString("tr-TR")} · ${noteDraft.trim()}`, last_contact_at: new Date().toISOString() }, "Takip notu eklendi.");
    setNoteDraft("");
  };
  return <Panel title="Satış Hunisi">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-3xl text-sm leading-6 text-slate-400">Leadleri ilk temas, toplantı, teklif, takip ve kazanım aşamalarında yönetin. Kartları güvenli şekilde durum seçimiyle taşıyabilirsiniz.</p>
      <button onClick={() => setActive("CRM")} className="rounded-[8px] border border-cyan-200/20 px-4 py-3 text-sm font-black text-cyan-700">CRM Listesine Git</button>
    </div>
    {message && <p className="mb-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-700">{message}</p>}
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="premium-scrollbar grid gap-3 overflow-x-auto pb-2 xl:grid-cols-7">
        {salesPipelineStages.map((stage) => {
          const stageLeads = activeLeads.filter((lead) => pipelineStageForLead(lead) === stage);
          return <div key={stage} className="min-w-[250px] rounded-[8px] border border-slate-200 bg-slate-50 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-black text-slate-900">{stage}</h3>
              <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black text-slate-600">{stageLeads.length}</span>
            </div>
            <div className="grid gap-2">
              {stageLeads.map((lead) => (
                <button key={lead.id} onClick={() => setSelectedLead(lead)} className="rounded-[8px] border border-slate-200 bg-white p-3 text-left transition hover:border-cyan-200/35 hover:bg-cyan-200/[0.07]">
                  <strong className="block text-sm text-slate-900">{lead.company || lead.name || "İsimsiz lead"}</strong>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">{lead.phone || lead.email || "İletişim yok"} · {lead.business_type || lead.businessType || "Sektör yok"}</span>
                  <span className="mt-2 flex flex-wrap gap-1 text-[10px] font-bold text-slate-600"><span className="rounded-full border border-orange-200/20 px-2 py-1">Skor {lead.lead_heat_score || 0}</span><span className="rounded-full border border-slate-200 px-2 py-1">Son temas {formatDate(lead.last_contact_at || lead.updated_at)}</span></span>
                  <span className="mt-2 block text-[11px] leading-4 text-cyan-700">Sıradaki aksiyon: {lead.next_action || lead.next_action_at || "Takip planı girilmedi"}</span>
                </button>
              ))}
              {!stageLeads.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-3 text-xs leading-5 text-slate-500">Bu aşamada lead yok.</p>}
            </div>
          </div>;
        })}
      </section>
      <aside className="h-fit rounded-[8px] border border-slate-200 bg-white p-4">
        <p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">Lead aksiyon merkezi</p>
        {selectedLead ? <div className="mt-4">
          <h3 className="text-lg font-black text-slate-900">{selectedLead.company || selectedLead.name}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">{selectedLead.source || "CRM"} · {selectedLead.phone || selectedLead.email || "İletişim yok"}</p>
          <div className="mt-4 grid gap-3">
            <SelectField label="Durum Güncelle" value={pipelineStageForLead(selectedLead)} onChange={(value) => updateLead(selectedLead, { status: value, pipeline_stage: value }, "Lead aşaması güncellendi.")} options={salesPipelineStages} />
            <Field label="Sıradaki aksiyon" value={selectedLead.next_action || ""} onChange={(value) => updateLead(selectedLead, { next_action: value }, "Sıradaki aksiyon güncellendi.")} />
            <Field label="Son temas tarihi" type="date" value={dateOnly(selectedLead.last_contact_at)} onChange={(value) => updateLead(selectedLead, { last_contact_at: value }, "Son temas tarihi güncellendi.")} />
            <TextArea rows={3} label="Not Ekle" value={noteDraft} onChange={setNoteDraft} />
            <button onClick={addNote} className="rounded-[8px] border border-slate-200 px-4 py-2 text-sm font-black text-slate-700">Not Ekle</button>
          </div>
          <ContactActionCenter record={selectedLead} type="lead" context="follow-up" />
          <div className="mt-4 grid gap-2">
            <button onClick={() => setActive("Teklif Hazırlama")} className="rounded-[8px] border border-amber-200/25 px-4 py-3 text-sm font-black text-amber-700">Teklif Oluştur</button>
            <button onClick={() => setActive("CRM")} className="rounded-[8px] border border-cyan-200/25 px-4 py-3 text-sm font-black text-cyan-700">CRM Detayına Git</button>
          </div>
        </div> : <p className="mt-4 rounded-[8px] border border-dashed border-slate-200 p-4 text-sm leading-6 text-slate-400">Aksiyon almak için bir lead kartı seçin.</p>}
      </aside>
    </div>
  </Panel>;
}

function contactMessageFor(record: any, template = "İlk temas") {
  const name = record.company || record.name || "işletmeniz";
  const templates: Record<string, string> = {
    "İlk temas": `Merhaba, ben HK Dijital’den yazıyorum. ${name} için dijital reklam ve ölçümleme tarafında kısa bir fırsat analizi paylaşmak isterim. Uygun olduğunuzda 10 dakikalık bir görüşme yapabilir miyiz?`,
    "Ücretsiz analiz": `Merhaba, ${name} için Google, Meta ve sosyal medya görünürlüğünü ücretsiz olarak hızlıca analiz edebiliriz. Size kısa ve uygulanabilir bir özet göndermemi ister misiniz?`,
    "Teklif takibi": `Merhaba, ${name} için hazırladığımız teklif çalışmasıyla ilgili kısa bir takip yapmak istedim. Sorularınız varsa birlikte netleştirebiliriz.`,
    "Ödeme hatırlatma": `Merhaba, HK Dijital hizmet dönemine ait ödeme durumunu hatırlatmak isterim. Uygunsa ödeme planını birlikte netleştirelim.`,
    "Rapor bilgilendirme": `Merhaba, ${name} için son performans raporu hazır. Öne çıkan sonuçları ve önümüzdeki 7 gün aksiyonlarını sizinle paylaşabilirim.`
  };
  return templates[template] || templates["İlk temas"];
}

function ContactActionCenter({ record, type = "lead", context = "new-lead" }: any) {
  const [template, setTemplate] = useState(context === "payment" ? "Ödeme hatırlatma" : context === "report" ? "Rapor bilgilendirme" : context === "proposal" ? "Teklif takibi" : "İlk temas");
  const [message, setMessage] = useState(() => contactMessageFor(record, template));
  useEffect(() => setMessage(contactMessageFor(record, template)), [template, record?.id]);
  const phone = String(record.phone || record.contact_phone || "").replace(/\D/g, "");
  const email = record.email || record.contact_email || "";
  return <div className="mt-4 rounded-[8px] border border-emerald-200/20 bg-emerald-300/[0.06] p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-black uppercase tracking-[.14em] text-emerald-700">WhatsApp / İletişim Merkezi</p><p className="mt-1 text-sm text-slate-600">{type === "customer" ? "Müşteri profili için hızlı temas aksiyonları." : "Lead için güvenli temas aksiyonları."}</p></div>
      <SelectField label="Mesaj şablonu" value={template} onChange={setTemplate} options={["İlk temas", "Ücretsiz analiz", "Teklif takibi", "Ödeme hatırlatma", "Rapor bilgilendirme"]} />
    </div>
    <TextArea rows={4} label="Hazır mesaj" value={message} onChange={setMessage} />
    <div className="mt-3 flex flex-wrap gap-2">
      {phone && <a target="_blank" rel="noreferrer" href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} className="rounded-full bg-[#25D366] px-4 py-2 text-sm font-black text-slate-900">WhatsApp Gönder</a>}
      {phone && <a href={`tel:${phone}`} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">Ara</a>}
      {email && <a href={`mailto:${email}?subject=${encodeURIComponent("HK Dijital")}&body=${encodeURIComponent(message)}`} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">E-posta Gönder</a>}
      <button onClick={() => navigator.clipboard.writeText(message)} className="rounded-full border border-cyan-200/20 px-4 py-2 text-sm font-bold text-cyan-700">Mesajı Kopyala</button>
    </div>
    {!phone && !email && <p className="mt-3 rounded-[8px] border border-dashed border-slate-200 p-3 text-xs text-slate-400">Telefon veya e-posta bilgisi bulunmadığı için otomatik bağlantı oluşturulamadı.</p>}
  </div>;
}

function LeadDrawer({ lead, update, persistLead, permanentDelete, close, onConverted }: any) {
  const { askAiProvider, chooserModal } = useAiProviderChooser();
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
  async function analyze(aiProvider = "Groq") {
    setAnalyzing(true);
    setAnalysisMessage("AI analizi hazırlanıyor...");
    const response = await fetch(`/api/admin/leads/${lead.id}/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aiProvider }) });
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
  async function downloadLeadPdfAudit() {
    setAnalysisMessage("PDF Audit oluşturuluyor...");
    try {
      await downloadAuditPdf({
        businessName: lead.company || lead.name,
        source: lead.source || "CRM",
        leadScore: { score: lead.lead_heat_score, temperature: Number(lead.lead_heat_score || 0) >= 80 ? "Sıcak" : Number(lead.lead_heat_score || 0) >= 50 ? "Ilık" : "Soğuk" },
        ai: lead.ai_analysis,
        profileImageUrl: "",
        platforms: [
          { platform: "Website", username: lead.company || lead.name, profileUrl: lead.website },
          { platform: "Instagram", username: lead.instagram, profileUrl: lead.instagram }
        ].filter((item) => item.username || item.profileUrl),
        outputs: [
          { action: "Executive Summary", text: lead.ai_analysis?.text || lead.message || lead.notes || "CRM kaydından oluşturulan mini audit.", ai: lead.ai_analysis },
          { action: "Düzeltilmesi Gerekenler", text: lead.local_opportunity_notes || lead.notes || lead.message || "" },
          { action: "Teklif Hazırlama", text: `Starter: 10.000 TL\nPro: 15.000 TL\nPremium: 25.000 TL` }
        ],
        summary: lead.message || lead.notes
      });
      setAnalysisMessage("PDF Audit indirildi.");
    } catch (error) {
      setAnalysisMessage(error instanceof Error ? error.message : "PDF oluşturulamadı. Geçersiz PDF verisi alındı.");
    }
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
        <SelectField label="Satış hunisi aşaması" value={pipelineStageForLead(lead)} onChange={(value) => update(lead.id, { status: value, pipeline_stage: value })} options={salesPipelineStages} />
        <SelectField label="Durum" value={lead.status || "Yeni"} onChange={(value) => update(lead.id, { status: value })} options={leadStatuses} />
        <Field label="Takip tarihi" type="date" value={lead.follow_up_date || lead.followUpDate} onChange={(value) => update(lead.id, { follow_up_date: value, followUpDate: value })} />
        <Field label="Son temas tarihi" type="date" value={dateOnly(lead.last_contact_at)} onChange={(value) => update(lead.id, { last_contact_at: value })} />
        <Field label="Sıradaki aksiyon" value={lead.next_action || ""} onChange={(value) => update(lead.id, { next_action: value })} />
        <div className="md:col-span-2"><TextArea label="Dahili notlar" value={lead.notes || lead.internalNotes} onChange={(value) => update(lead.id, { notes: value, internalNotes: value })} /></div>
      </div>
      <ContactActionCenter record={lead} type="lead" context={pipelineStageForLead(lead) === "Teklif Gönderildi" ? "proposal" : "follow-up"} />
      <div className="mt-5 flex flex-wrap gap-2">
        <button onClick={() => setEditOpen(true)} className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950">Düzenle</button>
        <button onClick={convert} disabled={converting || ["Dönüştürüldü", "Müşteri Oldu"].includes(lead.status)} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-60">{converting ? "Dönüştürülüyor..." : ["Dönüştürüldü", "Müşteri Oldu"].includes(lead.status) ? "Müşteri oldu" : "Başvuruyu müşteriye dönüştür"}</button>
        <button onClick={() => persistLead(lead.id, { status: "Takipte", follow_up_date: lead.follow_up_date || new Date().toISOString().slice(0, 10) }, "Takip görevi oluşturuldu.")} className="rounded-full border border-slate-200 px-4 py-2 text-sm">Takip görevi oluştur</button>
        <button onClick={() => askAiProvider(analyze)} disabled={analyzing || String(lead.id).startsWith("lead-")} className="inline-flex items-center gap-2 rounded-full border border-cyan-200/30 px-4 py-2 text-sm font-bold text-cyan-700 disabled:opacity-50"><Sparkles size={15} /> {analyzing ? "Analiz hazırlanıyor..." : "AI analizi oluştur"}</button>
        <button onClick={downloadLeadPdfAudit} className="inline-flex items-center gap-2 rounded-full border border-amber-200/30 px-4 py-2 text-sm font-bold text-amber-700"><Download size={15} /> PDF Audit Oluştur</button>
        {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer" className="rounded-full bg-[#25D366] px-4 py-2 text-sm font-black text-slate-900">Hızlı WhatsApp</a>}
        {!deleted && !rejected && <button onClick={() => setConfirmAction("reject")} className="rounded-full border border-amber-300/30 px-4 py-2 text-sm font-bold text-amber-700">Reddet</button>}
        {!deleted && <button onClick={() => setConfirmAction("delete")} className="rounded-full border border-red-300/30 px-4 py-2 text-sm font-bold text-red-100">Sil</button>}
        {(deleted || rejected) && <button onClick={restore} className="rounded-full border border-emerald-300/30 px-4 py-2 text-sm font-bold text-emerald-700">Geri Yükle</button>}
        {(deleted || rejected) && <button onClick={() => setConfirmAction("permanent")} className="rounded-full bg-red-500 px-4 py-2 text-sm font-black text-slate-900">Kalıcı Sil</button>}
      </div>
      {actionMessage && <p className="mt-4 rounded-[8px] border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm text-emerald-700">{actionMessage}</p>}
      {analysisMessage && <p className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-700">{analysisMessage}</p>}
      {lead.ai_analysis?.text && <div className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-4"><h3 className="font-black text-cyan-700">HK Intelligence AI Analizi</h3><AiUsageBadge meta={lead.ai_analysis} /><pre className="mt-3 whitespace-pre-wrap text-sm leading-7 text-cyan-700">{lead.ai_analysis.text}</pre><p className="mt-3 text-xs text-cyan-700/70">{formatDateTime(lead.ai_analysis.generated_at)}</p></div>}
      {chooserModal}
      {conversionMessage && <p className="mt-4 rounded-[8px] border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm text-emerald-700">{conversionMessage}</p>}
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
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [close]);
  const update = (patch) => setForm({ ...form, ...patch });
  return <div onMouseDown={close} className="fixed inset-0 z-[70] grid place-items-center bg-white/70 p-4 "><div onMouseDown={(event) => event.stopPropagation()} className="admin-modal-panel max-h-[92vh] w-full max-w-4xl overflow-auto rounded-[8px] border border-slate-200 bg-white p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">CRM Başvuru Yönetimi</p><h2 className="mt-1 text-2xl font-black text-slate-900">Başvuruyu Düzenle</h2></div><button onClick={close} className="grid size-10 place-items-center rounded-full border border-slate-200"><X size={18} /></button></div><div className="grid gap-4 md:grid-cols-2"><SelectField label="Kaynak" value={form.source} onChange={(source) => update({ source })} options={leadSourceOptions} /><SelectField label="Durum" value={form.status} onChange={(status) => update({ status })} options={crmActiveStatuses} /><Field label="Ad Soyad" value={form.name} onChange={(name) => update({ name })} /><Field label="Firma" value={form.company} onChange={(company) => update({ company })} /><Field label="Telefon" value={form.phone} onChange={(phone) => update({ phone })} /><Field label="E-posta" value={form.email} onChange={(email) => update({ email })} /><Field label="Instagram" value={form.instagram} onChange={(instagram) => update({ instagram })} /><Field label="Web sitesi" value={form.website} onChange={(website) => update({ website })} /><OtherSelectField label="Sektör" value={form.business_type} onChange={(business_type) => update({ business_type })} options={sectorOptions} manualLabel="Sektörü yazın" /><Field label="Bütçe" value={form.budget} onChange={(budget) => update({ budget })} /><Field label="Önerilen paket" value={form.recommended_package} onChange={(recommended_package) => update({ recommended_package })} /><Field label="Takip tarihi" type="date" value={form.follow_up_date} onChange={(follow_up_date) => update({ follow_up_date })} /><div className="md:col-span-2"><TextArea label="Hedef" value={form.goal} onChange={(goal) => update({ goal })} /></div><div className="md:col-span-2"><TextArea label="Mesaj" value={form.message} onChange={(message) => update({ message })} /></div><div className="md:col-span-2"><TextArea label="Dahili notlar" value={form.notes} onChange={(notes) => update({ notes })} /></div><div className="md:col-span-2"><TextArea rows={3} label="Red nedeni" value={form.rejection_reason} onChange={(rejection_reason) => update({ rejection_reason })} /></div></div><div className="mt-6 flex flex-wrap justify-end gap-2"><button onClick={close} className="rounded-full border border-slate-200 px-4 py-2 text-sm">Vazgeç</button><button onClick={() => save(form)} className="rounded-full bg-cyan-300 px-5 py-2 text-sm font-black text-slate-950">Değişiklikleri Kaydet</button></div></div></div>;
}

function ConfirmDialog({ title, description, confirmLabel, tone = "danger", children, onCancel, onConfirm }: any) {
  const danger = tone === "danger";
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onCancel]);
  return <div onMouseDown={onCancel} className="fixed inset-0 z-[80] grid place-items-center bg-white/70 p-4 "><div onMouseDown={(event) => event.stopPropagation()} className="admin-modal-panel w-full max-w-lg rounded-[8px] border border-slate-200 bg-white p-5 shadow-2xl"><h2 className="text-xl font-black text-slate-900">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>{children && <div className="mt-4">{children}</div>}<div className="mt-6 flex flex-wrap justify-end gap-2"><button onClick={onCancel} className="rounded-full border border-slate-200 px-4 py-2 text-sm">Vazgeç</button><button onClick={onConfirm} className={`rounded-full px-5 py-2 text-sm font-black ${danger ? "bg-red-500 text-slate-900" : "bg-amber-300 text-slate-950"}`}>{confirmLabel}</button></div></div></div>;
}

function Drawer({ title, close, children }: any) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [close]);
  return (
    <div onMouseDown={close} className="fixed inset-0 z-50 flex justify-end bg-white/70 ">
      <div onMouseDown={(event) => event.stopPropagation()} className="admin-drawer-panel h-full w-full max-w-4xl overflow-auto border-l border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-black text-slate-900">{title}</h2>
          <button onClick={close} aria-label="Kapat" className="grid size-10 place-items-center rounded-full border border-slate-200 text-slate-900"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InfoItem({ label, value }: any) {
  return <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 break-words text-sm text-slate-700">{value}</p></div>;
}

function Media({ content, setContent }: any) {
  const [message, setMessage] = useState("");
  async function handle(file) {
    setMessage("Yükleniyor...");
    const media = await uploadFile(file);
    if (media) setContent({ ...content, media: [media, ...content.media] });
    setMessage(media ? "Yüklendi." : "Yüklenemedi.");
  }
  return <Panel title="Medya Kütüphanesi"><label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-[8px] border border-dashed border-cyan-200/30 bg-cyan-200/10 text-center"><ImagePlus /><span>PNG, JPG, SVG, WebP, MP4 veya PDF yükle</span><input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp,video/mp4,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])} /></label><p className="mt-3 text-sm text-slate-400">Canlı ortamda dosyalar Supabase Storage üzerindeki hk-dijital-media kovasına yüklenir. Supabase yoksa yerel geliştirme için fallback kullanılır.</p>{message && <p className="mt-3 text-sm text-cyan-700">{message}</p>}<div className="mt-5 grid gap-4 md:grid-cols-3">{content.media.map((item) => <div key={item.id} className="rounded-[8px] border border-slate-200 p-3">{item.type === "image" ? <Image src={item.url} alt={item.name} width={360} height={160} className="h-32 w-full rounded-[8px] object-cover" /> : <div className="grid h-32 place-items-center rounded-[8px] bg-slate-50 text-sm font-bold">{item.type.toUpperCase()}</div>}<p className="mt-3 break-all text-xs text-slate-600">{item.url}</p><button onClick={() => setContent({ ...content, media: content.media.filter((m) => m.id !== item.id) })} className="mt-3 rounded-full border border-slate-200 px-3 py-2 text-xs">Listeden kaldır</button></div>)}</div></Panel>;
}

function AiAssistant({ content, setContent }: any) {
  const { askAiProvider, chooserModal } = useAiProviderChooser();
  const [prompt, setPrompt] = useState("HK Intelligence için CRM odaklı premium açıklama yaz.");
  const [output, setOutput] = useState("");
  const [meta, setMeta] = useState(aiMetaFromApi(content.settings.api));
  const [message, setMessage] = useState("");
  async function generate(aiProvider = "Groq") {
    setMessage("Yapay zekâ çıktısı hazırlanıyor...");
    setOutput("");
    const response = await fetch("/api/admin/ai-generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, aiProvider }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data.error || "Analiz sırasında bir hata oluştu.");
    setOutput(data.output || "");
    setMeta(data.ai || aiMetaFromApi(content.settings.api));
    setMessage("");
  }
  const shortcuts = ["CRM lead analizi üret.", "Meta reklam stratejisi yaz.", "Google Ads anahtar kelime planı hazırla.", "30 günlük sosyal medya planı oluştur."];
  const activeMeta = aiMetaFromApi(content.settings.api);
  return <Panel title="AI Studio"><div className="grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)_300px]"><aside className="rounded-[8px] border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase tracking-[.14em] text-purple-700">Prompt Library</p><div className="mt-4 grid gap-2">{shortcuts.map((item) => <button key={item} onClick={() => setPrompt(item)} className="rounded-[8px] border border-slate-200 bg-slate-50 p-3 text-left text-xs font-bold leading-5 text-slate-600 hover:border-purple-200/30 hover:text-purple-700">{item}</button>)}</div></aside><section className="rounded-[8px] border border-slate-200 bg-white p-5"><div className="mb-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3"><p className="text-sm font-black text-cyan-700">ChatGPT + Claude tarzı çalışma alanı</p><AiUsageBadge meta={activeMeta} /></div><TextArea label="Komut" value={prompt} onChange={setPrompt} /><button onClick={() => askAiProvider(generate)} className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950"><Sparkles size={17} /> AI çıktı üret</button>{message && <p className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-700">{message}</p>}{output && <div className="mt-4 rounded-[8px] border border-slate-200 bg-slate-50 p-4"><pre className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{output}</pre><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => navigator.clipboard.writeText(output)} className="inline-flex gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm"><Copy size={16} /> Kopyala</button><button onClick={() => setContent({ ...content, pages: { ...content.pages, home: { ...content.pages.home, subheadline: output } } })} className="rounded-full border border-slate-200 px-4 py-2 text-sm">Ana sayfa alt metnine ekle</button></div></div>}{chooserModal}</section><aside className="rounded-[8px] border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase tracking-[.14em] text-indigo-200">Output Metadata</p><div className="mt-4 grid gap-3 text-sm"><InfoItem label="Provider" value={meta.provider || activeMeta.provider} /><InfoItem label="Model" value={meta.model || activeMeta.model} /><InfoItem label="Mod" value={meta.mode || activeMeta.mode} /><InfoItem label="Durum" value={output ? "Yanıt üretildi" : message || "Bekliyor"} /></div></aside></div></Panel>;
}

function ApiSettings({ content, setContent }: any) {
  const [result, setResult] = useState("");
  const api = content.settings.api;
  const update = (patch) => setContent({ ...content, settings: { ...content.settings, api: { ...api, ...patch } } });
  const aiMeta = aiMetaFromApi(api);
  const priority = Array.isArray(api.ai_provider_priority) && api.ai_provider_priority.length ? api.ai_provider_priority : aiPriorityKeys;
  const updateProvider = (value: string) => {
    const key = aiLabelKeys[value] || value;
    const model = key === "groq" ? "llama-3.3-70b-versatile" : key === "gemini" ? "gemini-2.0-flash" : key === "demo" ? "demo-local" : key === "local" ? "local-rules" : "automatic-fallback";
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
  return <Panel title="API Ayarları"><p className="mb-5 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm leading-6 text-cyan-700">API anahtarları güvenlik nedeniyle bu ekranda gösterilmez veya tarayıcıya gönderilmez. Groq, Gemini, OpenAI ve Google Maps anahtarlarını Vercel ortam değişkenleri üzerinden yönetin.</p><div className="mb-5 rounded-[8px] border border-amber-200/20 bg-amber-200/10 p-4"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-black text-amber-700">AI Ayarları</p><span className="rounded-full bg-amber-300 px-2 py-1 text-[10px] font-black text-slate-950">Groq Önerilen</span></div><p className="mt-1 text-xs text-amber-700/75">Varsayılan canlı sağlayıcı Groq’tur. Belirli sağlayıcı seçilirse sessiz fallback yapılmaz.</p><AiUsageBadge meta={aiMeta} /></div><div className="grid gap-4 md:grid-cols-2"><SelectField label="Aktif AI Sağlayıcısı" value={aiProviderLabel(api.active_ai_provider || api.activeProvider || "Groq")} onChange={updateProvider} options={apiProviderOptions} /><Field label="Yapay zekâ modeli" value={api.active_ai_model || api.model || "llama-3.3-70b-versatile"} onChange={(v) => update({ active_ai_model: v, model: v })} /><SelectField label="AI modu" value={api.ai_mode || (api.demoMode ? "demo" : "live")} onChange={(v) => update({ ai_mode: v, demoMode: v === "demo", active_ai_provider: v === "demo" ? "demo" : v === "local" ? "local" : api.active_ai_provider || "groq", activeProvider: v === "demo" ? "demo" : v === "local" ? "local" : api.activeProvider || "groq" })} options={[{ value: "live", label: "Canlı" }, { value: "demo", label: "Demo" }, { value: "local", label: "Yerel" }]} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(api.demoMode)} onChange={(e) => update({ demoMode: e.target.checked, active_ai_provider: e.target.checked ? "demo" : "groq", activeProvider: e.target.checked ? "demo" : "groq", ai_mode: e.target.checked ? "demo" : "live", active_ai_model: e.target.checked ? "demo-local" : "llama-3.3-70b-versatile", model: e.target.checked ? "demo-local" : "llama-3.3-70b-versatile" })} /> Demo modu</label></div><div className="mt-5 rounded-[8px] border border-slate-200 bg-white p-4"><p className="text-sm font-black text-slate-900">AI Öncelik Sırası</p><p className="mt-1 text-xs text-slate-400">Bu sıra yalnızca “Otomatik” seçildiğinde kullanılır.</p><div className="mt-4 grid gap-3 md:grid-cols-5">{aiPriorityKeys.map((key, index) => <SelectField key={`${key}-${index}`} label={`${index + 1}. Öncelik`} value={aiKeyLabels[priority[index] || key] || "Groq"} onChange={(value) => updatePriority(index, value)} options={aiPriorityOptions} />)}</div></div><div className="mt-5 flex flex-wrap gap-2"><button onClick={saveAiSettings} className="rounded-full bg-amber-300 px-5 py-3 text-sm font-black text-slate-950">AI ayarlarını kaydet</button><button onClick={testApi} className="rounded-full border border-cyan-200/20 px-5 py-3 text-sm font-black text-cyan-700">API bağlantısını test et</button></div>{result && <p className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-700">{result}</p>}<p className="mt-4 text-sm text-slate-400">Sunucu tarafı değişkenleri: GOOGLE_MAPS_API_KEY, GEMINI_API_KEY, GROQ_API_KEY ve OPENAI_API_KEY. Kullanılmayan AI sağlayıcılarının anahtarlarını eklemek zorunda değilsiniz.</p></Panel>;
}

function Settings({ content, setContent }: any) {
  const settings = content.settings;
  const update = (patch) => setContent({ ...content, settings: { ...settings, ...patch } });
  return <Panel title="Sistem Ayarları"><div className="grid gap-4 md:grid-cols-2"><SelectField label="Performans modu" value={settings.performanceMode || "balanced"} onChange={(v) => update({ performanceMode: v })} options={[{ value: "ultra", label: "Ultra Animasyon" }, { value: "balanced", label: "Dengeli" }, { value: "performance", label: "Performans" }]} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.maintenanceMode} onChange={(e) => update({ maintenanceMode: e.target.checked })} /> Bakım modu</label><label className="grid gap-2 text-sm font-semibold text-slate-700">Varsayılan tema<select value={settings.defaultTheme} onChange={(e) => update({ defaultTheme: e.target.value })} className="min-h-11 rounded-[8px] border border-slate-200 bg-slate-50 px-3 text-slate-900"><option value="dark">Koyu</option><option value="light">Açık</option></select></label><TextArea label="Yasal bilgilendirmeler" value={(settings.legalDisclaimers || []).join("\n")} onChange={(v) => update({ legalDisclaimers: v.split("\n").filter(Boolean) })} /></div><p className="mt-4 text-sm text-slate-400">Performans modu public web sitesindeki animasyon yoğunluğunu yönetir. Varsayılan öneri: Dengeli.</p></Panel>;
}

function GeneralWebsiteSettings({ content, setContent }: any) {
  const updateSettings = (patch) => setContent({ ...content, settings: { ...content.settings, ...patch } });
  const updateBrand = (patch) => setContent({ ...content, brand: { ...content.brand, ...patch } });
  const updateContact = (patch) => setContent({ ...content, contact: { ...content.contact, ...patch } });
  return <Panel title="Genel Site Ayarları"><div className="grid gap-4 md:grid-cols-2"><Field label="Site adı" value={content.settings.siteTitle} onChange={(v) => updateSettings({ siteTitle: v })} /><Field label="Alt başlık" value={content.brand.slogan} onChange={(v) => updateBrand({ slogan: v })} /><TextArea label="Meta açıklaması" value={content.settings.siteDescription} onChange={(v) => updateSettings({ siteDescription: v })} /><TextArea label="Footer açıklaması" value={content.brand.footerDescription || content.brand.slogan} onChange={(v) => updateBrand({ footerDescription: v })} /><Field label="Telefon" value={content.contact.phone} onChange={(v) => updateContact({ phone: v })} /><Field label="WhatsApp" value={content.contact.whatsappNumber} onChange={(v) => updateContact({ whatsappNumber: v })} /><Field label="E-posta" value={content.contact.email} onChange={(v) => updateContact({ email: v })} /><Field label="Adres" value={content.contact.address} onChange={(v) => updateContact({ address: v })} /><Field label="Harita embed URL" value={content.contact.mapsEmbedUrl || ""} onChange={(v) => updateContact({ mapsEmbedUrl: v })} /></div></Panel>;
}

function LogoManagement({ content, setContent }: any) {
  const brand = content.brand;
  const update = (patch) => setContent({ ...content, brand: { ...brand, ...patch } });
  return <Panel title="Logo Yönetimi"><div className="grid gap-4 md:grid-cols-3">{[["Header logo", "logoUrl"], ["Footer logo", "footerLogoUrl"], ["Favicon", "faviconUrl"]].map(([label, key]) => <div key={key} className="grid gap-3 rounded-[8px] border border-slate-200 p-4"><Field label={label} value={brand[key] || ""} onChange={(v) => update({ [key]: v })} /><Upload onUrl={(url) => update({ [key]: url })} /></div>)}</div></Panel>;
}

function VisualManagement({ content, setContent }: any) {
  const media = content.mediaAssets || {};
  const update = (patch) => setContent({ ...content, mediaAssets: { ...media, ...patch } });
  return <Panel title="Görsel Yönetimi"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[["Hero image", "heroImage"], ["About image", "aboutImage"], ["Service images", "serviceImage"], ["Background images", "backgroundImage"]].map(([label, key]) => <div key={key} className="grid gap-3 rounded-[8px] border border-slate-200 p-4"><Field label={label} value={media[key] || ""} onChange={(v) => update({ [key]: v })} /><Upload onUrl={(url) => update({ [key]: url })} /></div>)}</div><p className="mt-4 text-sm text-slate-400">Görseller mevcut medya sistemiyle yüklenir. Public sayfalar görsel URL alanları dolduğunda bunları kullanacak şekilde genişletilebilir.</p></Panel>;
}

function AboutAndCertificatesManagement(props: any) {
  return <div className="grid gap-5"><Pages {...props} /><Collection title="Sertifika Yönetimi" type="certificate" items={props.content.certificates} setItems={(items) => props.setContent({ ...props.content, certificates: items })} /></div>;
}

function WebsiteManagementCenter(props: any) {
  const [tab, setTab] = useState("Genel Site Ayarları");
  const items = ["Genel Site Ayarları", "Logo Yönetimi", "Görsel Yönetimi", "Sayfa İçerikleri", "Hakkımda + Sertifikalar", "Hizmetler", "Paketler", "İletişim", "Performans"];
  return <div><HubTabs items={items} active={tab} onChange={setTab} />{tab === "Genel Site Ayarları" && <GeneralWebsiteSettings {...props} />}{tab === "Logo Yönetimi" && <LogoManagement {...props} />}{tab === "Görsel Yönetimi" && <VisualManagement {...props} />}{tab === "Sayfa İçerikleri" && <Pages {...props} />}{tab === "Hakkımda + Sertifikalar" && <AboutAndCertificatesManagement {...props} />}{tab === "Hizmetler" && <Collection title="Hizmet Yönetimi" type="service" items={props.content.services} setItems={(items) => props.setContent({ ...props.content, services: items })} />}{tab === "Paketler" && <Collection title="Paket Yönetimi" type="package" items={props.content.packages} setItems={(items) => props.setContent({ ...props.content, packages: items })} />}{tab === "İletişim" && <div className="grid gap-5"><GeneralWebsiteSettings {...props} /><KeyValue title="Sosyal Medya Yönetimi" object={props.content.socials} onChange={(object) => props.setContent({ ...props.content, socials: object })} /></div>}{tab === "Performans" && <Settings {...props} />}</div>;
}

function IntegrationsCenter({ content, setContent, notify }: any) {
  const [status, setStatus] = useState("");
  const api = content.settings.api || {};
  const analyticsIds = content.settings.analyticsIds || {};
  const update = (patch) => setContent({ ...content, settings: { ...content.settings, api: { ...api, ...patch } } });
  const updateAnalytics = (patch) => setContent({ ...content, settings: { ...content.settings, analyticsIds: { ...analyticsIds, ...patch } } });
  const test = async () => {
    setStatus("Bağlantılar test ediliyor...");
    const response = await fetch("/api/ai/test", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    update({ integrations_last_test_at: new Date().toISOString(), integrations_last_test_status: response.ok ? "Başarılı" : "Uyarı" });
    setStatus(data.message || data.error || "Test tamamlandı.");
  };
  return <Panel title="Entegrasyonlar">
    <p className="mb-5 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm leading-6 text-cyan-700">API anahtarları tarayıcıya gönderilmez. Bu alan bağlantı kimliklerini ve durum notlarını merkezi olarak düzenlemek içindir; gerçek gizli anahtarlar sunucu ortam değişkenlerinde kalmalıdır.</p>
    <div className="mb-5"><ReadinessPanel api={api} /></div>
    <IntegrationPersistenceSettings notify={notify} />
    <MetaAdsConnectionCenter content={content} setContent={setContent} api={api} updateApi={update} />
    <div className="grid gap-5">
      <div className="rounded-[8px] border border-slate-200 p-4">
        <h3 className="font-black">Meta</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="App ID" value={api.meta_app_id || ""} onChange={(v) => update({ meta_app_id: v })} />
          <Field label="App Secret" value={api.meta_app_secret ? "••••••••" : ""} onChange={(v) => update({ meta_app_secret: v })} />
          <Field label="Access Token" value={api.meta_access_token ? "••••••••" : ""} onChange={(v) => update({ meta_access_token: v })} />
          <Field label="Business ID" value={api.meta_business_id || ""} onChange={(v) => update({ meta_business_id: v })} />
          <Field label="Ad Account ID" value={api.meta_ad_account_id || ""} onChange={(v) => update({ meta_ad_account_id: v })} />
          <Field label="Meta Pixel ID" value={analyticsIds.metaPixel || ""} onChange={(v) => updateAnalytics({ metaPixel: v })} />
        </div>
      </div>
      <div className="rounded-[8px] border border-slate-200 p-4">
        <h3 className="font-black">Google</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="Maps API" value={api.google_maps_key ? "••••••••" : ""} onChange={(v) => update({ google_maps_key: v })} />
          <Field label="Ads API" value={api.google_ads_key ? "••••••••" : ""} onChange={(v) => update({ google_ads_key: v })} />
          <Field label="Analytics" value={api.google_analytics_id || ""} onChange={(v) => update({ google_analytics_id: v })} />
          <Field label="GA4 Measurement ID" value={analyticsIds.gaMeasurement || ""} onChange={(v) => updateAnalytics({ gaMeasurement: v })} />
          <Field label="Google Tag Manager" value={analyticsIds.googleTagManager || ""} onChange={(v) => updateAnalytics({ googleTagManager: v })} />
          <Field label="Search Console" value={api.google_search_console || ""} onChange={(v) => update({ google_search_console: v })} />
        </div>
      </div>
      <ApiSettings content={content} setContent={setContent} />
      <div className="rounded-[8px] border border-slate-200 p-4">
        <h3 className="font-black">Diğer</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="SMTP" value={api.smtp_host || ""} onChange={(v) => update({ smtp_host: v })} />
          <Field label="WhatsApp" value={api.whatsapp_provider || ""} onChange={(v) => update({ whatsapp_provider: v })} />
          <Field label="Webhook URL" value={api.webhook_url || ""} onChange={(v) => update({ webhook_url: v })} />
        </div>
      </div>
    </div>
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button onClick={test} className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">Bağlantıyı test et</button>
      <span className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600">Son test: {api.integrations_last_test_at ? new Date(api.integrations_last_test_at).toLocaleString("tr-TR") : "Yok"} · {api.integrations_last_test_status || "Bekliyor"}</span>
    </div>
    {status && <p className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-700">{status}</p>}
  </Panel>;
}

function IntegrationPersistenceSettings({ notify }: any) {
  const [meta, setMeta] = useState<any>({ appId: "", businessId: "", systemUserId: "", accessToken: "" });
  const [google, setGoogle] = useState<any>({ developerToken: "", mccId: "", clientId: "", clientSecret: "", refreshToken: "" });
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");
  async function load() {
    const response = await fetch("/api/admin/integration-settings", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (data.settings?.meta) setMeta({ appId: data.settings.meta.appId || "", businessId: data.settings.meta.businessId || "", systemUserId: data.settings.meta.systemUserId || "", accessToken: data.settings.meta.maskedAccessToken || "" });
    if (data.settings?.google) setGoogle({ developerToken: data.settings.google.maskedDeveloperToken || "", mccId: data.settings.google.mccId || "", clientId: data.settings.google.clientId || "", clientSecret: data.settings.google.maskedClientSecret || "", refreshToken: data.settings.google.maskedRefreshToken || "" });
    setLogs(data.logs || []);
  }
  useEffect(() => { load(); }, []);
  async function save(provider: "meta" | "google", action = "save") {
    setLoading(`${provider}-${action}`);
    setMessage(action === "test" ? "Test ediliyor..." : "Kaydediliyor...");
    const payload = provider === "meta" ? { provider, action, ...meta } : { provider, action, ...google };
    const response = await fetch("/api/admin/integration-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? `✓ ${data.message || "Ayarlar Kaydedildi"}` : `✖ ${data.error || "İşlem başarısız"}`);
    notify?.(response.ok ? `✓ ${provider === "meta" ? "Meta" : "Google"} ayarları kaydedildi` : "✖ Entegrasyon ayarları kaydedilemedi", response.ok ? "success" : "error");
    await load();
    setLoading("");
    setTimeout(() => setMessage(""), 2200);
  }
  return (
    <div className="mb-5 grid gap-5 xl:grid-cols-2">
      <div className="rounded-[18px] border border-cyan-200/20 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Kalıcı Meta Ayarları</p><h3 className="mt-1 text-xl font-black text-slate-900">Meta API bağlantısı</h3><p className="mt-1 text-sm leading-6 text-slate-600">Access Token sunucu tarafında şifrelenir, ekranda yalnızca maskeli değer gösterilir.</p></div><span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">{meta.accessToken ? "Token var" : "Token yok"}</span></div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Meta App ID" value={meta.appId} onChange={(appId) => setMeta({ ...meta, appId })} />
          <Field label="Meta Business ID" value={meta.businessId} onChange={(businessId) => setMeta({ ...meta, businessId })} />
          <Field label="Meta System User ID" value={meta.systemUserId} onChange={(systemUserId) => setMeta({ ...meta, systemUserId })} />
          <Field label="Meta Access Token" value={meta.accessToken} onChange={(accessToken) => setMeta({ ...meta, accessToken })} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2"><button disabled={Boolean(loading)} onClick={() => save("meta")} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-60">{loading === "meta-save" ? "Kaydediliyor..." : "Kaydet"}</button><button disabled={Boolean(loading)} onClick={() => save("meta", "update")} className="rounded-full border border-cyan-200/25 px-4 py-2 text-sm font-black text-cyan-700 disabled:opacity-60">{loading === "meta-update" ? "Güncelleniyor..." : "Güncelle"}</button><button disabled={Boolean(loading)} onClick={() => save("meta", "test")} className="rounded-full border border-emerald-300/30 px-4 py-2 text-sm font-black text-emerald-700 disabled:opacity-60">{loading === "meta-test" ? "Test ediliyor..." : "Test Et"}</button></div>
      </div>
      <div className="rounded-[18px] border border-sky-200/20 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-sky-200">Kalıcı Google Ayarları</p><h3 className="mt-1 text-xl font-black text-slate-900">Google Ads bağlantısı</h3><p className="mt-1 text-sm leading-6 text-slate-600">Developer Token, Client Secret ve Refresh Token şifrelenmiş olarak saklanır.</p></div><span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">{google.refreshToken || google.developerToken ? "Token var" : "Token yok"}</span></div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Google Developer Token" value={google.developerToken} onChange={(developerToken) => setGoogle({ ...google, developerToken })} />
          <Field label="Google MCC ID" value={google.mccId} onChange={(mccId) => setGoogle({ ...google, mccId })} />
          <Field label="Google Client ID" value={google.clientId} onChange={(clientId) => setGoogle({ ...google, clientId })} />
          <Field label="Google Client Secret" value={google.clientSecret} onChange={(clientSecret) => setGoogle({ ...google, clientSecret })} />
          <div className="md:col-span-2"><Field label="Google Refresh Token" value={google.refreshToken} onChange={(refreshToken) => setGoogle({ ...google, refreshToken })} /></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2"><button disabled={Boolean(loading)} onClick={() => save("google")} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-60">{loading === "google-save" ? "Kaydediliyor..." : "Kaydet"}</button><button disabled={Boolean(loading)} onClick={() => save("google", "update")} className="rounded-full border border-cyan-200/25 px-4 py-2 text-sm font-black text-cyan-700 disabled:opacity-60">{loading === "google-update" ? "Güncelleniyor..." : "Güncelle"}</button><button disabled={Boolean(loading)} onClick={() => save("google", "test")} className="rounded-full border border-emerald-300/30 px-4 py-2 text-sm font-black text-emerald-700 disabled:opacity-60">{loading === "google-test" ? "Test ediliyor..." : "Test Et"}</button></div>
      </div>
      {message && <p className="xl:col-span-2 rounded-[8px] border border-emerald-300/25 bg-emerald-300/10 p-3 text-sm font-bold text-emerald-700">{message}</p>}
      {logs.length > 0 && <div className="xl:col-span-2 rounded-[18px] border border-slate-200 bg-slate-50 p-4"><h3 className="font-black text-slate-900">Senkronizasyon Geçmişi</h3><div className="mt-3 grid gap-2">{logs.slice(0, 5).map((log) => <div key={log.id} className="grid gap-2 rounded-[8px] border border-slate-200 p-3 text-sm md:grid-cols-[160px_120px_1fr_120px]"><span className="text-slate-600">{formatDateTime(log.created_at)}</span><span className="font-black text-cyan-700">{log.provider === "meta" ? "Meta" : "Google"}</span><span className="text-slate-600">{log.message || log.source || "-"}</span><span className={`${log.result === "Başarılı" ? "text-emerald-700" : log.result === "Hata" ? "text-red-100" : "text-amber-700"}`}>{log.result}</span></div>)}</div></div>}
    </div>
  );
}

function MetaAdsConnectionCenter({ content, setContent, api, updateApi }: any) {
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [instagramAccounts, setInstagramAccounts] = useState<any[]>([]);
  const [form, setForm] = useState({ companyId: "", adAccountId: api.meta_ad_account_id || "", businessId: api.meta_business_id || "", pageId: "", instagramAccountId: "", rangePreset: "last_30d", dateFrom: "", dateTo: "" });
  async function getAction(action: string) {
    setLoading(action);
    setMessage("");
    const params = new URLSearchParams({ action });
    if (form.businessId) params.set("businessId", form.businessId);
    const response = await fetch(`/api/admin/meta-ads?${params}`);
    const data = await response.json().catch(() => ({}));
    if (action === "status") setStatus(data);
    if (action === "adaccounts") setAccounts(data.accounts || []);
    if (action === "pages") setPages(data.pages || []);
    if (action === "instagram") setInstagramAccounts(data.instagramAccounts || []);
    setMessage(data.message || (response.ok ? "İşlem tamamlandı." : "İşlem başarısız."));
    setLoading("");
  }
  async function sync(action = "sync") {
    setLoading(action);
    setMessage("");
    const response = await fetch("/api/admin/meta-ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, companyId: form.companyId, adAccountId: form.adAccountId, businessId: form.businessId, pageId: form.pageId, instagramAccountId: form.instagramAccountId, rangePreset: form.rangePreset, dateFrom: form.dateFrom, dateTo: form.dateTo, visibleToCustomer: true })
    });
    const data = await response.json().catch(() => ({}));
    if (data.ok) {
      const metricRows = (data.rows || []).map((row, index) => ({ id: `meta-sync-${Date.now()}-${index}`, company_id: form.companyId, date: row.date, period: data.range?.label || "Meta Sync", period_start: row.period_start || data.range?.since || row.date || "", period_end: row.period_end || data.range?.until || row.date || "", date_range_label: row.date_range_label || data.range?.label || "Meta Sync", source: "Meta API", visible_to_customer: true, ...row }));
      const summaries = metaCampaignSummaries(data.rows || []).map((item: any) => ({ id: `meta-campaign-${item.campaignId}`, company_id: form.companyId, meta_campaign_id: item.campaignId, name: item.campaignName, platform: "Meta Ads", objective: "Lead", status: item.status || "Aktif", spent_budget: item.spend, spent: item.spend, notes: "Meta API senkronizasyonundan oluşturuldu.", visible_to_customer: true, updated_at: new Date().toISOString() }));
      setContent({
        ...content,
        campaignMetrics: [...metricRows, ...(content.campaignMetrics || [])],
        campaigns: [...summaries.filter((summary: any) => !(content.campaigns || []).some((campaign: any) => campaign.meta_campaign_id === summary.meta_campaign_id || campaign.id === summary.id)), ...(content.campaigns || [])],
        reports: data.report ? [data.report, ...(content.reports || [])] : (content.reports || [])
      });
      updateApi({ meta_last_success_at: new Date().toISOString(), meta_ad_account_id: form.adAccountId, meta_business_id: form.businessId });
    }
    setMessage(data.message || data.errorMessage || data.detail || "Meta işlemi tamamlandı.");
    setLoading("");
  }
  const totals = summarizeMetaRows(content.campaignMetrics?.filter((row: any) => row.source === "Meta API" && (!form.companyId || row.company_id === form.companyId)) || []);
  return (
    <div className="mb-5 rounded-[18px] border border-cyan-200/20 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Meta Reklam Bağlantıları</p>
          <h3 className="mt-1 text-xl font-black text-slate-900">Meta Business Manager veri merkezi</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">Token değerleri sunucu tarafında kalır; bu ekranda sadece maskeli durum ve senkronizasyon sonuçları görünür.</p>
        </div>
        <span className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600">Token: {status?.maskedToken || maskSecret(api.meta_access_token || "")}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <InfoItem label="Meta App ID" value={api.meta_app_id || "Tanımlı değil"} />
        <InfoItem label="Meta Business ID" value={form.businessId || "Tanımlı değil"} />
        <InfoItem label="Meta System User ID" value={api.meta_system_user_id || "Tanımlı değil"} />
        <InfoItem label="Token Status" value={status?.tokenStatus || (api.meta_access_token ? "Maskeli / test bekliyor" : "Token yok")} />
        <InfoItem label="Last Sync Time" value={formatDateTime(api.meta_last_success_at)} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <CompanySelect value={form.companyId} onChange={(companyId) => setForm({ ...form, companyId })} companies={content.companies} />
        <Field label="Meta Business ID" value={form.businessId} onChange={(businessId) => setForm({ ...form, businessId })} />
        <Field label="Meta Ad Account ID" value={form.adAccountId} onChange={(adAccountId) => setForm({ ...form, adAccountId })} />
        <SelectField label="Tarih aralığı" value={form.rangePreset} onChange={(rangePreset) => setForm({ ...form, rangePreset })} options={[{ value: "last_7d", label: "Son 7 Gün" }, { value: "last_30d", label: "Son 30 Gün" }, { value: "this_month", label: "Bu Ay" }, { value: "last_month", label: "Geçen Ay" }, { value: "custom", label: "Özel Tarih" }, { value: "all_time", label: "Tüm Tarihler" }]} />
        {form.rangePreset === "custom" ? <Field label="Başlangıç" type="date" value={form.dateFrom} onChange={(dateFrom) => setForm({ ...form, dateFrom })} /> : <InfoItem label="Özet" value={`${Number(totals.spend || 0).toLocaleString("tr-TR")} TL · ${Number(totals.clicks || 0).toLocaleString("tr-TR")} tıklama`} />}
        {form.rangePreset === "custom" && <Field label="Bitiş" type="date" value={form.dateTo} onChange={(dateTo) => setForm({ ...form, dateTo })} />}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button disabled={Boolean(loading)} onClick={() => getAction("status")} className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-60">{loading === "status" ? "Test ediliyor..." : "Bağlantıyı Test Et"}</button>
        <button disabled={Boolean(loading)} onClick={() => getAction("adaccounts")} className="rounded-full border border-cyan-200/25 px-4 py-2 text-xs font-black text-cyan-700 disabled:opacity-60">Reklam Hesaplarını Getir</button>
        <button disabled={Boolean(loading)} onClick={() => getAction("pages")} className="rounded-full border border-cyan-200/25 px-4 py-2 text-xs font-black text-cyan-700 disabled:opacity-60">Sayfaları Getir</button>
        <button disabled={Boolean(loading)} onClick={() => getAction("instagram")} className="rounded-full border border-cyan-200/25 px-4 py-2 text-xs font-black text-cyan-700 disabled:opacity-60">Instagram Hesaplarını Getir</button>
        <button disabled={Boolean(loading) || !form.adAccountId} onClick={() => sync("sync")} className="rounded-full border border-emerald-300/30 px-4 py-2 text-xs font-black text-emerald-700 disabled:opacity-60">{loading === "sync" ? "Senkronize ediliyor..." : "Manuel Senkronizasyon"}</button>
        <button disabled={Boolean(loading) || !form.adAccountId || !form.companyId} onClick={() => sync("report")} className="rounded-full bg-amber-400 px-4 py-2 text-xs font-black text-slate-950 shadow-sm disabled:opacity-60">Meta Verilerinden Rapor Oluştur</button>
      </div>
      {message && <p className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-700">{message}</p>}
      {(accounts.length > 0 || pages.length > 0 || instagramAccounts.length > 0) && <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <MetaAssetList title="Reklam Hesapları" items={accounts} onPick={(item) => setForm({ ...form, adAccountId: item.id })} />
        <MetaAssetList title="Facebook Sayfaları" items={pages} onPick={(item) => setForm({ ...form, pageId: item.id })} />
        <MetaAssetList title="Instagram Hesapları" items={instagramAccounts} onPick={(item) => setForm({ ...form, instagramAccountId: item.id })} />
      </div>}
    </div>
  );
}

function MetaAssetList({ title, items, onPick }: any) {
  return <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-black uppercase tracking-[.14em] text-slate-600">{title}</p><div className="mt-3 grid gap-2">{items.slice(0, 8).map((item: any) => <button key={item.id} onClick={() => onPick(item)} className="rounded-[8px] border border-slate-200 p-2 text-left text-xs text-slate-600 transition hover:border-cyan-200/30 hover:bg-cyan-300/10"><strong className="block text-slate-900">{item.name || item.username || item.id}</strong><span>{item.id}</span></button>)}{!items.length && <p className="text-xs text-slate-500">Henüz veri yok.</p>}</div></div>;
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

function CustomersAdmin({ content, setContent, save, setActive, notify, currentSession }: any) {
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
  const canManageCustomers = canManageRecord(currentSession, "musteriler");

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
      {message && <p className="mb-4 rounded-[8px] border border-emerald-300/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mb-4 rounded-[8px] border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}
      <div className="mb-6 rounded-[8px] border border-slate-200 p-4">
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
        {canManageCustomers && <button disabled={loading === "company"} onClick={createCompany} className="mt-4 rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60">
          {loading === "company" ? "Firma oluşturuluyor..." : "Firmayı oluştur"}
        </button>}
      </div>
      <div className="mb-6 rounded-[8px] border border-slate-200 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-black">Müşteri / firma listesi</h3>
          <input value={companyQuery} onChange={(e) => setCompanyQuery(e.target.value)} placeholder="Firma ara..." className="min-h-10 rounded-[8px] border border-slate-200 bg-slate-50 px-3 text-slate-900" />
        </div>
        <div className="grid gap-3">
          {companies.map((company) => {
            const hasLogin = (content.users || []).some((user) => customerRole(user.role) && user.company_id === company.id);
            const editing = editingCompanyId === company.id;
            return (
              <div key={company.id} className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <h4 className="font-black">{company.name}</h4>
                    <p className="text-sm text-slate-400">{company.sector || "-"} · {company.city || "-"} · Müşteri girişi: {hasLogin ? "Var" : "Yok"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setDetailCompanyId(company.id)} className="rounded-full bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950">Müşteri detayını aç</button>
                    {canManageCustomers && <button onClick={() => setEditingCompanyId(editing ? "" : company.id)} className="rounded-full border border-slate-200 px-3 py-2 text-xs">Düzenle</button>}
                    {canManageCustomers && <button onClick={() => archiveCompany(company)} className="rounded-full border border-amber-300/30 px-3 py-2 text-xs text-amber-700">Pasifleştir</button>}
                    {canManageCustomers && <button onClick={() => deleteCompany(company)} className="rounded-full border border-red-300/30 px-3 py-2 text-xs text-red-200">Sil</button>}
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
      <div className="rounded-[8px] border border-slate-200 p-4">
        <h3 className="font-black">Müşteri giriş hesabı oluştur</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="Ad Soyad" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} />
          <Field label="E-posta" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="Geçici Şifre" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
          <CompanySelect value={form.company_id} onChange={(v) => setForm({ ...form, company_id: v })} companies={content.companies} />
          <SelectField label="Rol" value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={roleOptions} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Aktif</label>
        </div>
        {canManageCustomers && <button disabled={loading === "user"} onClick={createLogin} className="mt-4 rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60">
          {loading === "user" ? "Hesap oluşturuluyor..." : "Giriş hesabı oluştur"}
        </button>}
      </div>
      {detailCompanyId && (
        <CustomerDetailDrawer
          company={(content.companies || []).find((company) => company.id === detailCompanyId)}
          content={content}
          setContent={setContent}
          updateCompany={updateCompany}
          saveCompany={saveCompany}
          save={save}
          setActive={setActive}
          notify={notify}
          currentSession={currentSession}
          close={() => setDetailCompanyId("")}
        />
      )}
    </Panel>
  );
}

function Customer360Summary({ company, campaigns, payments, tasks, reports, activities, relatedLead, setTab, setActive }: any) {
  const health = calculateCustomerHealth(company, { campaigns, payments, tasks, reports, activities, relatedLead });
  const today = dateOnly(new Date().toISOString());
  const activeCampaigns = campaigns.filter(isActiveCampaignRecord);
  const pendingPayments = payments.filter((item) => !isArchivedRecord(item) && !["Ödendi", "İptal"].includes(item.status || "Bekliyor"));
  const paidTotal = payments.filter((item) => !isArchivedRecord(item) && item.status === "Ödendi").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const pendingTotal = pendingPayments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const openTasks = tasks.filter(isOpenTask);
  const lastReport = latestDateValue(reports, ["report_date", "published_at", "updated_at", "created_at", "endDate", "end_date"]);
  const lastContact = latestDateValue([relatedLead, company, ...activities], ["last_contact_at", "next_action_at", "updated_at", "created_at"]);
  const overdueTasks = openTasks.filter((item) => item.due_date && item.due_date < today).length;
  const summaryCards = [
    { label: "Aktif kampanyalar", value: activeCampaigns.length, note: "Yayında / operasyonel", tab: "Kampanyalar" },
    { label: "Bekleyen tahsilatlar", value: `${pendingTotal.toLocaleString("tr-TR")} TL`, note: `${pendingPayments.length} kayıt`, tab: "Ödemeler" },
    { label: "Toplam tahsil edilen", value: `${paidTotal.toLocaleString("tr-TR")} TL`, note: "Ödenmiş kayıtlar", tab: "Ödemeler" },
    { label: "Açık görevler", value: openTasks.length, note: overdueTasks ? `${overdueTasks} geciken görev` : "Geciken yok", tab: "Yapılacaklar" },
    { label: "Son rapor tarihi", value: formatDate(lastReport), note: "Rapor güncelliği", tab: "Raporlar" },
    { label: "Son temas tarihi", value: formatDate(lastContact), note: "İlişki takibi", tab: "Satış Durumu" },
    { label: "Satış aşaması", value: relatedLead ? pipelineStageForLead(relatedLead) : company.status || "Aktif", note: "Pipeline durumu", tab: "Satış Durumu" },
    { label: "Müşteri sağlık puanı", value: `${health.emoji} ${health.score}/100`, note: health.status, tab: "Zaman Çizelgesi" }
  ];
  return (
    <div className="mb-5 rounded-[18px] border border-cyan-200/20 bg-white p-4 shadow-[0_18px_60px_rgba(2,6,23,.25)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Müşteri 360° Operasyon Merkezi</p>
          <h3 className="mt-2 text-2xl font-black text-slate-900">Müşteri Özeti</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">Kampanya, tahsilat, görev, rapor ve satış akışı tek müşteri profili içinde okunur.</p>
        </div>
        <button onClick={() => setActive?.("Satış Hunisi")} className="rounded-full border border-cyan-200/30 px-4 py-2 text-xs font-black text-cyan-700 transition hover:bg-cyan-300/10">Pipeline Aç</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <button key={card.label} onClick={() => setTab(card.tab)} className="min-w-0 rounded-[14px] border border-slate-200 bg-white/[0.055] p-3 text-left transition hover:-translate-y-0.5 hover:border-cyan-200/30 hover:bg-cyan-300/10">
            <span className="block text-[11px] font-black uppercase tracking-[.12em] text-slate-400">{card.label}</span>
            <span className="mt-2 block truncate text-lg font-black text-slate-900">{card.value || "-"}</span>
            <span className="mt-1 block text-xs leading-5 text-slate-600">{card.note}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-[14px] border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-black text-slate-900">Neden bu puanı aldı?</p>
          <span className={`rounded-full border px-3 py-1 text-xs font-black ${health.tone === "emerald" ? "border-emerald-300/30 text-emerald-700" : health.tone === "amber" ? "border-amber-300/30 text-amber-700" : "border-red-300/30 text-red-100"}`}>{health.emoji} {health.status}</span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {health.reasons.map((reason) => <p key={reason} className="rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600">{reason}</p>)}
        </div>
      </div>
    </div>
  );
}

function CustomerDetailDrawer({ company, content, setContent, updateCompany, saveCompany, save, setActive, close, notify, currentSession }: any) {
  const [tab, setTab] = useState("Genel Bilgi");
  const [profileAction, setProfileAction] = useState("");
  const [salesNote, setSalesNote] = useState("");
  const [salesMessageOpen, setSalesMessageOpen] = useState(false);
  if (!company) return null;
  const canManageCustomer = canManageRecord(currentSession, "musteriler");
  const users = (content.users || []).filter((user) => customerRole(user.role) && user.company_id === company.id);
  const campaigns = (content.campaigns || []).filter((item) => item.company_id === company.id);
  const metrics = (content.campaignMetrics || []).filter((item) => item.company_id === company.id);
  const updates = (content.customerUpdates || []).filter((item) => item.company_id === company.id);
  const files = (content.customerFiles || []).filter((item) => item.company_id === company.id);
  const documents = (content.customerDocuments || []).filter((item) => item.company_id === company.id);
  const reports = (content.reports || []).filter((item) => item.company_id === company.id);
  const activities = (content.activityLogs || []).filter((item) => item.company_id === company.id);
  const payments = (content.paymentRecords || []).filter((item) => item.company_id === company.id);
  const tasks = (content.agencyTasks || []).filter((item) => item.company_id === company.id);
  const relatedLeads = (content.leads || []).filter((lead) => lead.company_id === company.id || String(lead.company || "").toLocaleLowerCase("tr") === String(company.name || "").toLocaleLowerCase("tr") || String(lead.email || "").toLocaleLowerCase("tr") === String(company.email || "").toLocaleLowerCase("tr"));
  const relatedLead = relatedLeads[0];
  const proposals = documents.filter((item) => item.document_type === "Teklif" || String(item.title || "").toLocaleLowerCase("tr").includes("teklif"));
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
  const tabs = ["Genel Bilgi", "İletişim", "Satış Durumu", "Reklam Hesapları", "Kampanyalar", "Teklifler", "Ödemeler", "Yapılacaklar", "Raporlar", "Dosyalar", "Zaman Çizelgesi", "Panel Görünürlüğü", "Giriş Bilgileri", "Metrikler", "Yapılan Çalışmalar", "Aktivite Geçmişi", "Notlar"];
  async function runProfileAction(label, action) {
    setProfileAction(`${label}...`);
    await Promise.resolve(action());
    setProfileAction(`${label.replace("iyor", "di")} ✓`);
    notify?.(`✓ ${label.replace("iyor", "di")}`, "success");
    setTimeout(() => setProfileAction(""), 2000);
  }
  function buildPipelineLead(patch = {}) {
    const now = new Date().toISOString();
    const base = relatedLead || {
      id: createLocalId(),
      source: "Müşteri Profili",
      company_id: company.id,
      name: company.name || "",
      company: company.name || "",
      phone: company.phone || "",
      email: company.email || "",
      instagram: company.instagram || "",
      website: company.website || "",
      business_type: company.sector || "",
      sector: company.sector || "",
      status: company.status === "Aktif" ? "Kazanıldı" : "Yeni Lead",
      pipeline_stage: company.status === "Aktif" ? "Kazanıldı" : "Yeni Lead",
      notes: "",
      created_at: now
    };
    return { ...base, ...patch, company_id: company.id, updated_at: now };
  }
  function setPipelineLead(patch = {}, shouldSave = false, message = "Satış durumu güncellendi") {
    const nextLead = buildPipelineLead(patch);
    const exists = (content.leads || []).some((lead) => lead.id === nextLead.id);
    const next = { ...content, leads: exists ? (content.leads || []).map((lead) => lead.id === nextLead.id ? nextLead : lead) : [nextLead, ...(content.leads || [])] };
    setContent(next);
    if (shouldSave) runProfileAction("Güncelleniyor", () => save?.(next));
    if (message) notify?.(`✓ ${message}`, "success");
  }
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
      <Customer360Summary company={company} campaigns={campaigns} payments={payments} tasks={tasks} reports={reports} activities={activities} relatedLead={relatedLead} setTab={setTab} setActive={setActive} />
      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-full px-3 py-2 text-xs font-bold ${tab === item ? "bg-cyan-300 text-slate-950" : "border border-slate-200 text-slate-600"}`}>{item}</button>)}
        <a href={`/musteri-paneli?company=${company.id}`} target="_blank" rel="noreferrer" className="ml-auto rounded-full border border-cyan-200/30 px-3 py-2 text-xs font-black text-cyan-700">Müşteri gibi görüntüle</a>
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
        <div className="md:col-span-2 rounded-[8px] border border-cyan-200/20 bg-cyan-200/[0.08] p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">Satış Durumu</p>
              <h3 className="mt-2 text-xl font-black text-slate-900">{relatedLead ? pipelineStageForLead(relatedLead) : "Satış hunisine bağlı değil"}</h3>
              <p className="mt-1 text-sm leading-6 text-cyan-700/80">Kampanya, teklif, görev, ödeme ve rapor akışı bu müşteri profili üzerinden takip edilir.</p>
            </div>
            {profileAction && <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-700">{profileAction}</span>}
          </div>
          {relatedLead ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SelectField label="Pipeline aşaması" value={pipelineStageForLead(relatedLead)} onChange={(value) => setPipelineLead({ status: value, pipeline_stage: value }, false, "")} options={salesPipelineStages} />
              <Field label="Son temas tarihi" type="date" value={dateOnly(relatedLead.last_contact_at)} onChange={(value) => setPipelineLead({ last_contact_at: value }, false, "")} />
              <Field label="Sıradaki aksiyon tarihi" type="date" value={dateOnly(relatedLead.next_action_at || relatedLead.follow_up_date)} onChange={(value) => setPipelineLead({ next_action_at: value, follow_up_date: value }, false, "")} />
              <Field label="Sıradaki aksiyon notu" value={relatedLead.next_action || ""} onChange={(value) => setPipelineLead({ next_action: value }, false, "")} />
              <div className="md:col-span-2 xl:col-span-4">
                <TextArea label="Takip notu" value={salesNote} onChange={setSalesNote} placeholder="Müşteriyle yapılan görüşme, itiraz, fiyat beklentisi veya sonraki adımı yazın." />
              </div>
              <div className="md:col-span-2 xl:col-span-4 flex flex-wrap gap-2">
                <button onClick={() => setPipelineLead({}, true, "Satış durumu güncellendi")} className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">Durumu Güncelle</button>
                <button onClick={() => setSalesMessageOpen((current) => !current)} className="rounded-full border border-emerald-300/30 px-4 py-2 text-xs text-emerald-700">WhatsApp Mesajı Hazırla</button>
                <button onClick={() => {
                  if (!salesNote.trim()) return notify?.("⚠ Takip notu boş olamaz", "warning");
                  const currentNotes = relatedLead.notes ? `${relatedLead.notes}\n\n` : "";
                  setPipelineLead({ notes: `${currentNotes}${new Date().toLocaleDateString("tr-TR")} · ${salesNote.trim()}` }, true, "Takip notu eklendi");
                  setSalesNote("");
                }} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700">Takip Notu Ekle</button>
                <button onClick={() => setActive("Satış Hunisi")} className="rounded-full border border-cyan-200/25 px-4 py-2 text-xs font-black text-cyan-700">Satış Hunisini Aç</button>
              </div>
              {salesMessageOpen && <div className="md:col-span-2 xl:col-span-4"><ContactActionCenter record={company} type="customer" context={pipelineStageForLead(relatedLead) === "Teklif Gönderildi" ? "proposal" : "follow-up"} /></div>}
            </div>
          ) : (
            <div className="rounded-[8px] border border-dashed border-slate-200 p-4">
              <p className="text-sm leading-6 text-slate-600">Bu müşteri henüz satış hunisine bağlanmamış.</p>
              <button onClick={() => setPipelineLead({}, true, "Müşteri satış hunisine eklendi")} className="mt-3 rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">Satış Hunisine Ekle</button>
            </div>
          )}
        </div>
        <button onClick={() => saveCompany(company)} className="w-fit rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950">Firma bilgilerini kaydet</button>
      </div>}
      {tab === "Giriş Bilgileri" && <div>
        <p className="mb-4 rounded-[8px] border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-700">Müşteri şifresi güvenlik nedeniyle düz metin olarak saklanmaz. Yeni geçici şifre oluşturabilirsiniz.</p>
        <div className="grid gap-3">{users.map((user) => <div key={user.id} className="rounded-[8px] border border-slate-200 p-4"><p className="font-black">{user.full_name || user.email}</p><p className="mt-1 text-sm text-slate-400">{user.email} · Bağlı kullanıcı: Var · Durum: {user.is_active ? "Aktif" : "Pasif"} · Rol: Müşteri</p><p className="mt-2 text-xs leading-5 text-slate-500">Son giriş: {formatDateTime(user.last_login_at)} · Toplam giriş: {user.login_count || 0}</p><button onClick={() => resetPassword(user)} className="mt-3 rounded-full border border-slate-200 px-4 py-2 text-sm">Şifre sıfırlama bağlantısı gönder</button></div>)}{!users.length && <p className="text-sm text-slate-400">Bağlı müşteri kullanıcısı yok. Müşteriler ekranındaki giriş hesabı oluşturma formunu kullanın.</p>}</div>
      </div>}
      {tab === "İletişim" && <ContactActionCenter record={company} type="customer" context="follow-up" />}
      {tab === "Satış Durumu" && <div className="grid gap-4">
        <div className="rounded-[8px] border border-cyan-200/20 bg-cyan-200/[0.08] p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">Satış Durumu</p>
              <h3 className="mt-2 text-xl font-black text-slate-900">{relatedLead ? pipelineStageForLead(relatedLead) : "Bu müşteri henüz satış hunisine bağlanmamış."}</h3>
              <p className="mt-1 text-sm leading-6 text-cyan-700/80">Bu alanda yapılan değişiklikler Satış Hunisi, global arama ve dashboard pipeline özetleriyle aynı lead kaydını kullanır.</p>
            </div>
            {profileAction && <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-700">{profileAction}</span>}
          </div>
          {relatedLead ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SelectField label="Pipeline aşaması" value={pipelineStageForLead(relatedLead)} onChange={(value) => setPipelineLead({ status: value, pipeline_stage: value }, false, "")} options={salesPipelineStages} />
            <Field label="Son temas tarihi" type="date" value={dateOnly(relatedLead.last_contact_at)} onChange={(value) => setPipelineLead({ last_contact_at: value }, false, "")} />
            <Field label="Sıradaki aksiyon tarihi" type="date" value={dateOnly(relatedLead.next_action_at || relatedLead.follow_up_date)} onChange={(value) => setPipelineLead({ next_action_at: value, follow_up_date: value }, false, "")} />
            <Field label="Sıradaki aksiyon notu" value={relatedLead.next_action || ""} onChange={(value) => setPipelineLead({ next_action: value }, false, "")} />
            <div className="md:col-span-2 xl:col-span-4"><TextArea label="Takip notu" value={salesNote} onChange={setSalesNote} placeholder="Kısa takip notu yazın." /></div>
            <div className="md:col-span-2 xl:col-span-4 flex flex-wrap gap-2">
              <button onClick={() => setPipelineLead({}, true, "Satış durumu güncellendi")} className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">Durumu Güncelle</button>
              <button onClick={() => setSalesMessageOpen((current) => !current)} className="rounded-full border border-emerald-300/30 px-4 py-2 text-xs text-emerald-700">WhatsApp Mesajı Hazırla</button>
              <button onClick={() => {
                if (!salesNote.trim()) return notify?.("⚠ Takip notu boş olamaz", "warning");
                const currentNotes = relatedLead.notes ? `${relatedLead.notes}\n\n` : "";
                setPipelineLead({ notes: `${currentNotes}${new Date().toLocaleDateString("tr-TR")} · ${salesNote.trim()}` }, true, "Takip notu eklendi");
                setSalesNote("");
              }} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700">Takip Notu Ekle</button>
              <button onClick={() => setActive("Satış Hunisi")} className="rounded-full border border-cyan-200/25 px-4 py-2 text-xs font-black text-cyan-700">Satış Hunisini Aç</button>
            </div>
            {salesMessageOpen && <div className="md:col-span-2 xl:col-span-4"><ContactActionCenter record={company} type="customer" context={pipelineStageForLead(relatedLead) === "Teklif Gönderildi" ? "proposal" : "follow-up"} /></div>}
          </div> : <div className="rounded-[8px] border border-dashed border-slate-200 p-5"><p className="text-sm leading-6 text-slate-600">Bu müşteri henüz satış hunisine bağlanmamış.</p><button onClick={() => setPipelineLead({}, true, "Müşteri satış hunisine eklendi")} className="mt-3 rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">Satış Hunisine Ekle</button></div>}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <AgencyStatCard label="Kampanya" value={campaigns.length} note="Bu müşteriye bağlı kayıt" />
          <AgencyStatCard label="Teklif" value={proposals.length} note="Belge merkezindeki teklif kayıtları" tone="amber" />
          <AgencyStatCard label="Açık görev" value={tasks.filter((item) => !["Tamamlandı", "İptal"].includes(item.status)).length} note="Yapılacaklar ile senkron" tone="emerald" />
        </div>
      </div>}
      {tab === "Reklam Hesapları" && <CustomerMetaAccounts company={company} content={content} setContent={setContent} save={save} notify={notify} />}
      {tab === "Kampanyalar" && <CustomerCampaignsEditor company={company} content={content} setContent={setContent} save={save} setActive={setActive} items={campaigns} notify={notify} canManage={canManageCustomer} />}
      {tab === "Teklifler" && <CustomerProposalsEditor company={company} content={content} setContent={setContent} save={save} items={proposals} notify={notify} canManage={canManageCustomer} />}
      {tab === "Zaman Çizelgesi" && <CustomerTimeline company={company} campaigns={campaigns} payments={payments} tasks={tasks} documents={documents} reports={reports} activities={activities} />}
      {tab === "Metrikler" && <CustomerRelatedList items={metrics} empty="Bu müşteri için metrik yok." render={(item) => `${formatDate(item.date)} · ${item.impressions || 0} gösterim · ${item.clicks || 0} tıklama · ${item.leads || 0} potansiyel müşteri · ${item.spent || 0} TL`} onVisibilityChange={(item, value) => updateRelated("campaignMetrics", item.id, { visible_to_customer: value })} />}
      {tab === "Raporlar" && <CustomerReportsEditor company={company} content={content} setContent={setContent} save={save} items={reports} notify={notify} canManage={canManageCustomer} />}
      {tab === "Ödemeler" && <CustomerPaymentsEditor company={company} content={content} setContent={setContent} save={save} items={payments} notify={notify} canManage={canManageCustomer} />}
      {tab === "Yapılacaklar" && <CustomerTasksEditor company={company} content={content} setContent={setContent} save={save} items={tasks} notify={notify} canManage={canManageCustomer} />}
      {tab === "Yapılan Çalışmalar" && <CustomerRelatedList items={updates} empty="Bu müşteri için çalışma notu yok." render={(item) => `${item.title} · ${item.update_type}`} onVisibilityChange={(item, value) => updateRelated("customerUpdates", item.id, { visible_to_customer: value })} />}
      {tab === "Dosyalar" && <CustomerFilesEditor company={company} content={content} setContent={setContent} save={save} items={files} notify={notify} canManage={canManageCustomer} />}
      {tab === "Panel Görünürlüğü" && <div><p className="mb-4 text-sm leading-6 text-slate-400">Müşteri panelinde görünmesini istediğiniz alanları seçin. Değişiklikleri üst menüdeki Kaydet düğmesi ile kalıcı hale getirin.</p><p className="mb-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-700">Müşteri panelindeki metrikler, teknik terimler yerine sade Türkçe açıklamalarla gösterilir.</p><div className="grid gap-3 md:grid-cols-2">{[
        ["show_campaigns", "Kampanyalar"],
        ["show_metrics", "Reklam metrikleri"],
        ["show_budget", "Kampanya bütçesi"],
        ["show_spent", "Harcanan bütçe"],
        ["show_leads", "Potansiyel müşteri sayısı"],
        ["show_work_updates", "Yapılan çalışmalar"],
        ["show_strategy_notes", "Strateji notları"],
        ["show_files", "Dosyalar"],
        ["show_contact_person", "İletişim bilgileri"]
      ].map(([key, label]) => <label key={key} className="flex items-center gap-3 rounded-[8px] border border-slate-200 p-3 text-sm"><input type="checkbox" checked={visibility[key] ?? true} onChange={(event) => updateVisibility({ [key]: event.target.checked })} /> {label}</label>)}</div></div>}
      {tab === "Aktivite Geçmişi" && <ActivityList items={activities} empty="Bu müşteri için henüz aktivite kaydı yok." />}
      {tab === "Notlar" && <TextArea label="Dahili müşteri notları" value={company.notes} onChange={(v) => updateCompany(company.id, { notes: v })} rows={10} />}
    </Drawer>
  );
}

function CustomerMetaAccounts({ company, content, setContent, save, notify }: any) {
  const api = content.settings?.api || {};
  const existing = (content.metaAccountLinks || []).find((item: any) => item.company_id === company.id) || {};
  const [form, setForm] = useState({
    adAccountId: existing.ad_account_id || api.meta_ad_account_id || "",
    pageId: existing.page_id || "",
    instagramAccountId: existing.instagram_account_id || "",
    businessId: existing.business_id || api.meta_business_id || "",
    googleAdsCustomerId: existing.google_ads_customer_id || company.google_ads_customer_id || api.google_ads_customer_id || "",
    googleAnalyticsId: existing.google_analytics_id || company.google_analytics_id || "",
    googleMccId: existing.mcc_id || "",
    rangePreset: "last_30d",
    dateFrom: "",
    dateTo: ""
  });
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [linked, setLinked] = useState(existing);
  const [matchingCampaign, setMatchingCampaign] = useState<any>(null);
  const [selectedMetaCampaign, setSelectedMetaCampaign] = useState<any>(null);
  const [campaignMatchModalOpen, setCampaignMatchModalOpen] = useState(false);
  const [matchingExistingId, setMatchingExistingId] = useState("");
  const localCampaigns = (content.campaigns || []).filter((item: any) => item.company_id === company.id && !item.archived_at && !item.deleted_at);
  const metaMetricRows = metaRowsForRange(
    (rows.length ? rows.map((row) => ({ ...row, company_id: company.id, source: "Meta API" })) : (content.campaignMetrics || []))
      .filter((item: any) => item.company_id === company.id && String(item.source || "").toLocaleLowerCase("tr").includes("meta")),
    form.rangePreset,
    form.dateFrom,
    form.dateTo
  );
  const selectedMetaRangeLabel = metaRangeLabel(form.rangePreset, form.dateFrom, form.dateTo, metaMetricRows);
  const summaries = metaCampaignSummaries(metaMetricRows);
  const metaAdsets = (content.metaAdsetMetrics || []).filter((item: any) => item.company_id === company.id);
  const metaAds = (content.metaAdMetrics || []).filter((item: any) => item.company_id === company.id);
  const metaConversions = (content.metaConversionEvents || []).filter((item: any) => item.company_id === company.id);
  const metaAnalyses = (content.metaAnalysisSnapshots || []).filter((item: any) => item.company_id === company.id);
  const reportVisibility = (content.customerReportVisibility || []).filter((item: any) => item.company_id === company.id);
  const visibilitySections = [
    ["overview", "Genel Özet"],
    ["campaigns", "Kampanyalar"],
    ["adsets", "Reklam Setleri"],
    ["ads", "Reklamlar"],
    ["creatives", "Kreatifler"],
    ["conversions", "Dönüşümler"],
    ["breakdowns", "Kırılımlar"],
    ["video", "Video Performansı"],
    ["analysis", "HK Intelligence Analizi"]
  ];
  const visibilityMetrics = [
    ["spend", "Harcama"],
    ["reach", "Erişim"],
    ["impressions", "Gösterim"],
    ["clicks", "Tıklama"],
    ["ctr", "CTR"],
    ["cpc", "CPC"],
    ["cpm", "CPM"],
    ["roas", "ROAS"],
    ["leads", "Lead"],
    ["messages", "Mesaj"],
    ["purchases", "Satın alma"],
    ["add_to_cart", "Add To Cart"],
    ["checkout", "Checkout"],
    ["age_breakdown", "Yaş kırılımı"],
    ["gender_breakdown", "Cinsiyet kırılımı"],
    ["location_breakdown", "Şehir kırılımı"],
    ["placement_breakdown", "Placement"],
    ["creative_media", "Kreatif görseller"],
    ["ad_text", "Reklam metinleri"],
    ["cta", "CTA"],
    ["best_creative", "En iyi kreatif"],
    ["weakest_creative", "En kötü kreatif"],
    ["budget_recommendation", "Bütçe önerisi"],
    ["pause_recommendations", "Kapatılacak reklamlar"],
    ["scale_recommendations", "Ölçeklenecek reklamlar"],
    ["lifecycle_start", "Başlangıç Tarihi"],
    ["lifecycle_end", "Bitiş Tarihi"],
    ["lifecycle_status", "Durum"],
    ["lifecycle_days_remaining", "Gün Kaldı"]
  ];
  const helperText = {
    businessId: "Meta Business Manager içindeki işletme ID’si.",
    adAccountId: "Meta reklam hesabı ID’si. Örn: act_123456789 veya 123456789",
    pageId: "Facebook sayfası ID’si.",
    instagramAccountId: "Instagram işletme hesabı ID’si.",
    googleAdsCustomerId: "Google Ads müşteri ID’si.",
    googleAnalyticsId: "GA4 Measurement ID veya Analytics property ID.",
    googleMccId: "Google Ads yönetici hesabı ID’si."
  };
  const withHelp = (field: any, help: string) => <div>{field}<p className="mt-1 text-xs leading-5 text-slate-600">{help}</p></div>;
  const campaignMetaId = (item: any) => String(item?.campaignId || item?.meta_campaign_id || item?.external_id || item?.id || "").trim();
  const campaignMetaName = (item: any) => String(item?.campaignName || item?.campaign_name || item?.name || "Meta Kampanya").trim();
  const normalizeMetaCampaign = (item: any) => {
    const id = campaignMetaId(item);
    const name = campaignMetaName(item);
    return {
      ...item,
      campaignId: id,
      meta_campaign_id: id,
      campaignName: name,
      campaign_name: name,
      spend: Number(item?.spend ?? item?.spent ?? 0),
      reach: Number(item?.reach ?? 0),
      clicks: Number(item?.clicks ?? 0),
      impressions: Number(item?.impressions ?? 0),
      ctr: Number(item?.ctr ?? 0),
      cpc: Number(item?.cpc ?? 0),
      cpm: Number(item?.cpm ?? 0),
      results: Number(item?.results ?? item?.leads ?? item?.messages ?? 0)
    };
  };
  function syncLocalMapping(metaPatch: any = {}, googlePatch: any = {}) {
    const next = {
      ...linked,
      id: linked.id || existing.id || `ad-link-${company.id}`,
      company_id: company.id,
      ad_account_id: form.adAccountId,
      business_id: form.businessId,
      page_id: form.pageId,
      instagram_account_id: form.instagramAccountId,
      google_ads_customer_id: form.googleAdsCustomerId,
      google_analytics_id: form.googleAnalyticsId,
      mcc_id: form.googleMccId,
      ...metaPatch,
      ...googlePatch,
      updated_at: new Date().toISOString()
    };
    setLinked(next);
    setContent({ ...content, metaAccountLinks: [next, ...(content.metaAccountLinks || []).filter((item: any) => item.company_id !== company.id)] });
    return next;
  }
  async function loadMappings() {
    const response = await fetch(`/api/admin/integration-settings?companyId=${encodeURIComponent(company.id)}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    const meta = data.mappings?.meta || {};
    const google = data.mappings?.google || {};
    if (!meta.id && !google.id) return;
    const nextForm = {
      ...form,
      adAccountId: meta.adAccountId || meta.accountId || form.adAccountId,
      pageId: meta.pageId || form.pageId,
      instagramAccountId: meta.instagramAccountId || form.instagramAccountId,
      businessId: meta.businessId || form.businessId,
      googleAdsCustomerId: google.googleCustomerId || google.adAccountId || google.accountId || form.googleAdsCustomerId,
      googleAnalyticsId: google.googleAnalyticsId || form.googleAnalyticsId,
      googleMccId: google.mccId || form.googleMccId
    };
    setForm(nextForm);
    const nextLink = {
      ...existing,
      company_id: company.id,
      ad_account_id: nextForm.adAccountId,
      business_id: nextForm.businessId,
      page_id: nextForm.pageId,
      instagram_account_id: nextForm.instagramAccountId,
      google_ads_customer_id: nextForm.googleAdsCustomerId,
      google_analytics_id: nextForm.googleAnalyticsId,
      mcc_id: nextForm.googleMccId,
      status: meta.status || google.status || existing.status,
      last_sync_at: meta.lastSyncAt || google.lastSyncAt || existing.last_sync_at,
      google_last_sync_at: google.lastSyncAt || existing.google_last_sync_at
    };
    setLinked(nextLink);
    setContent({ ...content, metaAccountLinks: [nextLink, ...(content.metaAccountLinks || []).filter((item: any) => item.company_id !== company.id)] });
  }
  useEffect(() => { loadMappings().catch(() => null); }, [company.id]);
  useEffect(() => {
    console.log("MODAL STATE", campaignMatchModalOpen);
  }, [campaignMatchModalOpen]);
  useEffect(() => {
    console.log("SELECTED META CAMPAIGN", selectedMetaCampaign);
  }, [selectedMetaCampaign]);
  async function saveMapping(provider: "meta" | "google", action = "save") {
    setLoading(`${provider}-${action}`);
    const payload = provider === "meta"
      ? { scope: "mapping", provider, action, companyId: company.id, businessId: form.businessId, adAccountId: form.adAccountId, pageId: form.pageId, instagramAccountId: form.instagramAccountId, accountName: form.adAccountId }
      : { scope: "mapping", provider, action, companyId: company.id, googleCustomerId: form.googleAdsCustomerId, googleAnalyticsId: form.googleAnalyticsId, mccId: form.googleMccId, accountName: form.googleAdsCustomerId };
    const response = await fetch("/api/admin/integration-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) {
      const text = data.error || "Eşleştirme kaydedilemedi.";
      setMessage(text);
      notify?.(`✖ ${text}`, "error");
      setLoading("");
      return null;
    }
    syncLocalMapping(provider === "meta" ? { status: data.mapping?.status || "Kaydedildi", last_sync_at: data.mapping?.lastSyncAt || linked.last_sync_at } : {}, provider === "google" ? { google_status: data.mapping?.status || "Kaydedildi", google_last_sync_at: data.mapping?.lastSyncAt || linked.google_last_sync_at } : {});
    const text = action === "test" ? "Test tamamlandı ✓" : action === "sync" ? "Tamamlandı ✓" : "Kaydedildi ✓";
    setMessage(text);
    notify?.(`✓ ${provider === "meta" ? "Meta" : "Google"} eşleştirmesi ${action === "test" ? "test edildi" : action === "sync" ? "senkronize edildi" : "kaydedildi"}`, "success");
    setLoading("");
    setTimeout(() => setMessage(""), 2200);
    return data.mapping;
  }
  async function connect() {
    setLoading("connect");
    await saveMapping("meta");
    const response = await fetch("/api/admin/meta-ads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "connect", companyId: company.id, adAccountId: form.adAccountId, businessId: form.businessId, pageId: form.pageId, instagramAccountId: form.instagramAccountId }) });
    const data = await response.json().catch(() => ({}));
    const next = { id: data.integration?.id || existing.id || `meta-link-${company.id}`, company_id: company.id, ad_account_id: form.adAccountId, business_id: form.businessId, page_id: form.pageId, instagram_account_id: form.instagramAccountId, account_name: data.integration?.ad_account_id || form.adAccountId, status: data.ok ? "Bağlı" : "Taslak", last_sync_at: existing.last_sync_at || "", updated_at: new Date().toISOString() };
    setLinked(next);
    setContent({ ...content, metaAccountLinks: [next, ...(content.metaAccountLinks || []).filter((item: any) => item.company_id !== company.id)] });
    setMessage(data.message || "Meta hesabı bağlandı.");
    notify?.(data.ok ? "✓ Meta hesabı bağlandı" : "⚠ Meta hesabı taslak olarak kaydedildi", data.ok ? "success" : "warning");
    setLoading("");
  }
  async function test() {
    await saveMapping("meta", "test");
    setLoading("test");
    const response = await fetch("/api/admin/meta-ads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test", companyId: company.id, adAccountId: form.adAccountId }) });
    const data = await response.json().catch(() => ({}));
    setMessage(data.message || (data.ok ? "Meta bağlantısı başarılı" : "Token geçersiz"));
    setLoading("");
  }
  async function pull(action = "sync") {
    setLoading(action);
    await saveMapping("meta");
    const response = await fetch("/api/admin/meta-ads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, companyId: company.id, adAccountId: form.adAccountId, businessId: form.businessId, pageId: form.pageId, instagramAccountId: form.instagramAccountId, rangePreset: form.rangePreset, dateFrom: form.dateFrom, dateTo: form.dateTo, visibleToCustomer: true }) });
    const data = await response.json().catch(() => ({}));
    if (data.ok) {
      const rangeLabel = data.range?.label || selectedMetaRangeLabel || "Meta Sync";
      const metricRows = (data.rows || []).map((row: any, index: number) => ({
        id: `meta-profile-${company.id}-${Date.now()}-${index}`,
        company_id: company.id,
        date: row.date,
        period: rangeLabel,
        period_start: row.period_start || data.range?.since || row.date || "",
        period_end: row.period_end || data.range?.until || row.date || "",
        date_range_label: row.date_range_label || rangeLabel,
        source: "Meta API",
        visible_to_customer: true,
        ...row
      }));
      const lastDataDate = metricRows.map((row: any) => row.period_end || row.date).filter(Boolean).sort().slice(-1)[0] || "";
      const nextLink = { ...linked, company_id: company.id, ad_account_id: form.adAccountId, business_id: form.businessId, page_id: form.pageId, instagram_account_id: form.instagramAccountId, account_name: form.adAccountId, status: data.mapping?.status || "Senkronize edildi", last_sync_at: data.mapping?.lastSyncAt || new Date().toISOString(), sync_status: data.mapping?.syncStatus || "Başarılı", sync_message: data.warnings?.[0] || data.mapping?.syncMessage || data.message, sync_error: "", last_data_range_label: rangeLabel, last_data_date: lastDataDate, last_data_period_start: data.range?.since || "", last_data_period_end: data.range?.until || "" };
      const advanced = data.advanced || {};
      setRows(data.rows || []);
      setLinked(nextLink);
      setContent({
        ...content,
        metaAccountLinks: [nextLink, ...(content.metaAccountLinks || []).filter((item: any) => item.company_id !== company.id)],
        campaignMetrics: [...metricRows, ...(content.campaignMetrics || [])],
        metaAdsetMetrics: [...(advanced.adsets || []), ...(content.metaAdsetMetrics || [])],
        metaAdMetrics: [...(advanced.ads || []), ...(content.metaAdMetrics || [])],
        metaConversionEvents: [...(advanced.conversions || []), ...(content.metaConversionEvents || [])],
        metaAnalysisSnapshots: advanced.analysis ? [advanced.analysis, ...(content.metaAnalysisSnapshots || [])] : (content.metaAnalysisSnapshots || []),
        reports: data.report ? [data.report, ...(content.reports || [])] : (content.reports || [])
      });
      notify?.(action === "report" ? "✓ Meta verilerinden rapor oluşturuldu" : data.warnings?.length ? "⚠ Veri çekildi, bazı ileri veri grupları eksik" : "✓ Veri senkronizasyonu tamamlandı", data.warnings?.length ? "warning" : "success");
    } else {
      const errorText = data.message || data.errorMessage || data.detail || "Meta verisi alınamadı.";
      const nextLink = { ...linked, company_id: company.id, ad_account_id: form.adAccountId, business_id: form.businessId, page_id: form.pageId, instagram_account_id: form.instagramAccountId, status: "Hata", sync_status: "Hata", sync_message: errorText, sync_error: errorText };
      setLinked(nextLink);
      setContent({ ...content, metaAccountLinks: [nextLink, ...(content.metaAccountLinks || []).filter((item: any) => item.company_id !== company.id)] });
      notify?.(`✖ ${errorText}`, "error");
    }
    setMessage(data.message || data.errorMessage || data.detail || "Meta işlemi tamamlandı.");
    setLoading("");
  }
  function testGoogle() {
    const ok = Boolean(form.googleAdsCustomerId);
    saveMapping("google", "test");
    setMessage(ok ? "Google bağlantısı sync-ready durumda. Canlı Google Ads kimlikleri sunucuda tanımlandığında aynı akış gerçek veriyle çalışır." : "Google Ads Customer ID eksik.");
    notify?.(ok ? "✓ Google bağlantısı hazır" : "⚠ Google müşteri ID eksik", ok ? "success" : "warning");
  }
  function pullGoogle() {
    saveMapping("google", "sync");
    const now = new Date().toISOString();
    const demoRows = [{ id: `google-profile-${company.id}-${Date.now()}`, company_id: company.id, date: now.slice(0, 10), period: "Google Sync Demo", source: "Google Ads Sync", visible_to_customer: true, impressions: 12400, clicks: 310, conversions: 18, spent: 4200, ctr: 2.5, cpc: 13.55, cost_per_lead: 233.33 }];
    const nextLink = { ...linked, company_id: company.id, google_ads_customer_id: form.googleAdsCustomerId, google_analytics_id: form.googleAnalyticsId, mcc_id: form.googleMccId, google_status: "Sync-ready demo", google_last_sync_at: now, updated_at: now };
    setLinked(nextLink);
    setContent({ ...content, metaAccountLinks: [nextLink, ...(content.metaAccountLinks || []).filter((item: any) => item.company_id !== company.id)], campaignMetrics: [...demoRows, ...(content.campaignMetrics || [])] });
    setMessage("Google verileri için demo/sync-ready kayıt oluşturuldu. Gerçek Google Ads yetkileri sunucuda hazır olduğunda bu alan canlı metriklerle dolar.");
    notify?.("✓ Google sync-ready verisi oluşturuldu", "success");
  }
  function openCampaignMatch(item: any) {
    const selected = normalizeMetaCampaign(item);
    console.log("MATCH CLICK", selected.campaignId, selected.campaignName);
    if (!selected.campaignId) {
      setMessage("Meta kampanya verisi bulunamadı.");
      notify?.("✖ Meta kampanya verisi bulunamadı.", "error");
      return;
    }
    const existingMatch = localCampaigns.find((campaign: any) => campaign.meta_campaign_id === selected.campaignId || campaign.external_id === selected.campaignId);
    setSelectedMetaCampaign(selected);
    setMatchingCampaign(selected);
    setMatchingExistingId(existingMatch?.id || "");
    setCampaignMatchModalOpen(true);
  }
  function matchedCampaignFor(item: any) {
    const selectedId = campaignMetaId(item);
    if (!selectedId) return null;
    return localCampaigns.find((campaign: any) => campaign.meta_campaign_id === selectedId || campaign.external_id === selectedId);
  }
  function visibilityRule(sectionKey: string, metricKey = "__section") {
    return reportVisibility.find((item: any) => item.section_key === sectionKey && item.metric_key === metricKey);
  }
  function isReportVisible(sectionKey: string, metricKey = "__section") {
    const rule = visibilityRule(sectionKey, metricKey);
    return rule?.is_visible ?? true;
  }
  function updateReportVisibility(sectionKey: string, metricKey: string, is_visible: boolean) {
    const nextRule = {
      id: visibilityRule(sectionKey, metricKey)?.id || createLocalId(),
      company_id: company.id,
      section_key: sectionKey,
      metric_key: metricKey,
      is_visible,
      display_order: metricKey === "__section" ? visibilitySections.findIndex(([key]) => key === sectionKey) : visibilityMetrics.findIndex(([key]) => key === metricKey),
      updated_at: new Date().toISOString()
    };
    const nextRules = [
      nextRule,
      ...(content.customerReportVisibility || []).filter((item: any) => !(item.company_id === company.id && item.section_key === sectionKey && item.metric_key === metricKey))
    ];
    setContent({ ...content, customerReportVisibility: nextRules });
  }
  function bulkVisibility(is_visible: boolean) {
    const now = new Date().toISOString();
    const nextRules = [
      ...visibilitySections.map(([sectionKey], index) => ({ id: visibilityRule(sectionKey)?.id || createLocalId(), company_id: company.id, section_key: sectionKey, metric_key: "__section", is_visible, display_order: index, updated_at: now })),
      ...visibilityMetrics.map(([metricKey], index) => ({ id: visibilityRule("metrics", metricKey)?.id || createLocalId(), company_id: company.id, section_key: "metrics", metric_key: metricKey, is_visible, display_order: index, updated_at: now })),
      ...(content.customerReportVisibility || []).filter((item: any) => item.company_id !== company.id)
    ];
    setContent({ ...content, customerReportVisibility: nextRules });
  }
  function resetVisibility() {
    setContent({ ...content, customerReportVisibility: (content.customerReportVisibility || []).filter((item: any) => item.company_id !== company.id) });
    notify?.("✓ Varsayılan görünürlük ayarları yüklendi", "success");
  }
  function saveReportVisibility() {
    save?.({ ...content });
    notify?.("✓ Rapor görünürlüğü kaydedildi", "success");
  }
  function closeCampaignMatch() {
    setCampaignMatchModalOpen(false);
    setSelectedMetaCampaign(null);
    setMatchingCampaign(null);
    setMatchingExistingId("");
    setLoading("");
  }
  function saveCampaignMatch(createNew = false) {
    const selected = normalizeMetaCampaign(selectedMetaCampaign || matchingCampaign);
    if (!selected.campaignId) {
      setMessage("Meta kampanya verisi bulunamadı.");
      notify?.("✖ Meta kampanya verisi bulunamadı.", "error");
      return;
    }
    if (!createNew && !matchingExistingId) {
      setMessage("Kampanya seçilmedi.");
      notify?.("⚠ Kampanya seçilmedi.", "warning");
      return;
    }
    const now = new Date().toISOString();
    setLoading("campaign-match");
    const targetId = createNew ? createLocalId() : matchingExistingId;
    const existingTarget = (content.campaigns || []).find((campaign: any) => campaign.id === targetId) || {};
    const campaignPatch = {
      company_id: company.id,
      meta_campaign_id: selected.campaignId,
      external_id: selected.campaignId,
      source: "Meta",
      name: selected.campaignName || "Meta Kampanya",
      platform: "Meta Ads",
      status: selected.status || "Aktif",
      start_date: selected.date || now.slice(0, 10),
      spent_budget: Number(selected.spend || 0),
      spent: Number(selected.spend || 0),
      budget: Number(selected.spend || 0),
      settings: { ...(existingTarget.settings || {}), meta_campaign_id: selected.campaignId, imported_from: "customer_profile_meta_campaigns", meta_campaign_name: selected.campaignName },
      notes: "Meta kampanya verilerinden eşleştirildi.",
      updated_at: now
    };
    const campaigns = content.campaigns || [];
    const nextCampaigns = createNew
      ? [{ id: targetId, ...campaignPatch, visible_to_customer: false }, ...campaigns]
      : campaigns.map((campaign: any) => campaign.id === targetId ? { ...campaign, ...campaignPatch } : campaign);
    const metric = {
      id: createLocalId(),
      company_id: company.id,
      campaign_id: targetId,
      meta_campaign_id: selected.campaignId,
      campaign_name: selected.campaignName,
      campaignName: selected.campaignName,
      date: selected.date || now.slice(0, 10),
      period: selected.dateRangeLabel || selected.date_range_label || selectedMetaRangeLabel || "Meta Kampanya Eşleştirme",
      period_start: selected.periodStart || selected.period_start || (form.rangePreset === "custom" ? form.dateFrom : ""),
      period_end: selected.periodEnd || selected.period_end || (form.rangePreset === "custom" ? form.dateTo : selected.date || now.slice(0, 10)),
      date_range_label: selected.dateRangeLabel || selected.date_range_label || selectedMetaRangeLabel || "Meta Kampanya Eşleştirme",
      source: "Meta",
      impressions: Number(selected.impressions || 0),
      reach: Number(selected.reach || 0),
      clicks: Number(selected.clicks || 0),
      leads: Number(selected.results || selected.leads || 0),
      results: Number(selected.results || selected.leads || 0),
      spend: Number(selected.spend || 0),
      spent: Number(selected.spend || 0),
      ctr: Number(selected.ctr || 0),
      cpc: Number(selected.cpc || 0),
      cpm: Number(selected.cpm || 0),
      visible_to_customer: true,
      raw_data: selected,
      notes: "Meta Verilerini Kampanyaya Aktar ile oluşturuldu."
    };
    const log = { id: createLocalId(), provider: "meta", company_id: company.id, source: "Kampanya Eşleştirme", result: "Başarılı", message: `${selected.campaignName} kampanyası eşleştirildi.`, created_at: now };
    const next = {
      ...content,
      campaigns: nextCampaigns,
      campaignMetrics: [metric, ...(content.campaignMetrics || [])],
      activityLogs: [log, ...(content.activityLogs || [])]
    };
    setContent(next);
    save?.(next);
    setMessage("Kampanya başarıyla eşleştirildi.");
    notify?.("✓ Kampanya başarıyla eşleştirildi.", "success");
    closeCampaignMatch();
  }
  const totals = summarizeMetaRows(metaMetricRows);
  const activeMetaCampaignCount = new Set([
    ...metaMetricRows.map((row: any) => row.campaignId || row.meta_campaign_id || row.external_id || row.campaignName || row.campaign_name).filter(Boolean),
    ...localCampaigns.filter((campaign: any) => campaign.meta_campaign_id || campaign.external_id || String(campaign.source || "").toLocaleLowerCase("tr") === "meta").map((campaign: any) => campaign.meta_campaign_id || campaign.external_id || campaign.id)
  ]).size;
  const activeMatchingCampaign = selectedMetaCampaign || matchingCampaign;
  return (
    <div className="grid gap-5">
      <div className="rounded-[14px] border border-cyan-200/20 bg-cyan-300/[0.07] p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-black text-slate-900">Reklam Hesapları</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">Bu müşteriyi Meta ve Google reklam hesaplarıyla eşleştirin. Bu alan, Reklam Hesabı Eşleştirme merkeziyle aynı kayıtları kullanır.</p>
          </div>
          <span className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600">Durum: {linked.status || "Bağlı değil"}</span>
        </div>
        <div className="mb-4 grid gap-3 rounded-[12px] border border-slate-200 bg-white p-3 text-xs md:grid-cols-6">
          <InfoItem label="Token durumu" value={linked.sync_status === "Hata" ? "Kontrol gerekli" : "Sunucuda kayıtlı / maskeli"} />
          <InfoItem label="Meta Ads Account ID" value={form.adAccountId || "Eksik"} />
          <InfoItem label="Son senkronizasyon" value={formatDateTime(linked.last_sync_at)} />
          <InfoItem label="Son çekilen veri aralığı" value={linked.last_data_range_label || selectedMetaRangeLabel || "Veri yok"} />
          <InfoItem label="Son veri tarihi" value={linked.last_data_date ? formatDate(linked.last_data_date) : "Veri yok"} />
          <InfoItem label="Son hata mesajı" value={linked.sync_error || linked.sync_message || "Hata yok"} />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-[14px] border border-cyan-200/20 bg-slate-50 p-4">
            <h4 className="font-black text-slate-900">Meta Hesap Bilgileri</h4>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {withHelp(<Field label="Meta Business ID" value={form.businessId} onChange={(businessId) => setForm({ ...form, businessId })} />, helperText.businessId)}
              {withHelp(<Field label="Meta Ads Account ID" value={form.adAccountId} onChange={(adAccountId) => setForm({ ...form, adAccountId })} />, helperText.adAccountId)}
              {withHelp(<Field label="Facebook Sayfa ID" value={form.pageId} onChange={(pageId) => setForm({ ...form, pageId })} />, helperText.pageId)}
              {withHelp(<Field label="Instagram Hesap ID" value={form.instagramAccountId} onChange={(instagramAccountId) => setForm({ ...form, instagramAccountId })} />, helperText.instagramAccountId)}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button disabled={Boolean(loading)} onClick={() => saveMapping("meta")} className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-60">{loading === "meta-save" ? "Kaydediliyor..." : "Kaydet"}</button>
              <button disabled={Boolean(loading)} onClick={test} className="rounded-full border border-cyan-200/25 px-4 py-2 text-xs font-black text-cyan-700 disabled:opacity-60">{loading === "test" || loading === "meta-test" ? "Test ediliyor..." : "Test Et"}</button>
              <button disabled={Boolean(loading) || !form.adAccountId} onClick={() => pull("sync")} className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-black text-white shadow-sm disabled:opacity-60">{loading === "sync" || loading === "meta-sync" ? "Senkronize ediliyor..." : "Meta Verilerini Çek"}</button>
              <button disabled={Boolean(loading) || !form.adAccountId} onClick={() => pull("advanced_sync")} className="rounded-full bg-blue-600 px-4 py-2 text-xs font-black text-white shadow-sm disabled:opacity-60">{loading === "advanced_sync" ? "Tüm veriler çekiliyor..." : "Tüm Verileri Çek"}</button>
              <button disabled={Boolean(loading) || !form.adAccountId} onClick={() => pull("creative_sync")} className="rounded-full border border-blue-200 px-4 py-2 text-xs font-black text-blue-700 disabled:opacity-60">Kreatifleri Çek</button>
              <button disabled={Boolean(loading) || !form.adAccountId} onClick={() => pull("breakdown_sync")} className="rounded-full border border-blue-200 px-4 py-2 text-xs font-black text-blue-700 disabled:opacity-60">Kırılımları Çek</button>
              <button disabled={Boolean(loading) || !form.adAccountId} onClick={() => pull("conversion_sync")} className="rounded-full border border-blue-200 px-4 py-2 text-xs font-black text-blue-700 disabled:opacity-60">Dönüşümleri Çek</button>
              <button disabled={Boolean(loading) || !form.adAccountId} onClick={() => pull("video_sync")} className="rounded-full border border-blue-200 px-4 py-2 text-xs font-black text-blue-700 disabled:opacity-60">Video Verilerini Çek</button>
            </div>
          </div>
          <div className="rounded-[14px] border border-blue-200/20 bg-slate-50 p-4">
            <h4 className="font-black text-slate-900">Google Hesap Bilgileri</h4>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {withHelp(<Field label="Google Ads Customer ID" value={form.googleAdsCustomerId} onChange={(googleAdsCustomerId) => setForm({ ...form, googleAdsCustomerId })} />, helperText.googleAdsCustomerId)}
              {withHelp(<Field label="Google Analytics ID" value={form.googleAnalyticsId} onChange={(googleAnalyticsId) => setForm({ ...form, googleAnalyticsId })} />, helperText.googleAnalyticsId)}
              {withHelp(<Field label="Google MCC ID" value={form.googleMccId} onChange={(googleMccId) => setForm({ ...form, googleMccId })} />, helperText.googleMccId)}
              <InfoItem label="Son Google sync" value={formatDateTime(linked.google_last_sync_at)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button disabled={Boolean(loading)} onClick={() => saveMapping("google")} className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-60">{loading === "google-save" ? "Kaydediliyor..." : "Kaydet"}</button>
              <button type="button" disabled={Boolean(loading)} onClick={testGoogle} className="rounded-full border border-emerald-400 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700 disabled:opacity-60">{loading === "google-test" ? "Test ediliyor..." : "Test Et"}</button>
              <button type="button" disabled={Boolean(loading)} onClick={pullGoogle} className="rounded-full bg-orange-500 px-4 py-2 text-xs font-black text-white shadow-sm disabled:opacity-60">{loading === "google-sync" ? "Senkronize ediliyor..." : "Google Verilerini Çek"}</button>
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SelectField label="Veri aralığı" value={form.rangePreset} onChange={(rangePreset) => setForm({ ...form, rangePreset })} options={[{ value: "last_7d", label: "Son 7 Gün" }, { value: "last_30d", label: "Son 30 Gün" }, { value: "this_month", label: "Bu Ay" }, { value: "last_month", label: "Geçen Ay" }, { value: "custom", label: "Özel Tarih" }, { value: "all_time", label: "Tüm Tarihler" }]} />
          {form.rangePreset === "custom" && <Field label="Başlangıç tarihi" type="date" value={form.dateFrom} onChange={(dateFrom) => setForm({ ...form, dateFrom })} />}
          {form.rangePreset === "custom" && <Field label="Bitiş tarihi" type="date" value={form.dateTo} onChange={(dateTo) => setForm({ ...form, dateTo })} />}
          <InfoItem label="Son Meta senkronizasyon" value={formatDateTime(linked.last_sync_at)} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button disabled={Boolean(loading) || !form.adAccountId} onClick={connect} className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-60">{loading === "connect" ? "Bağlanıyor..." : "Meta Hesabı Bağla"}</button>
          <button disabled={Boolean(loading) || !form.adAccountId} onClick={() => pull("report")} className="rounded-full bg-amber-400 px-4 py-2 text-xs font-black text-slate-950 shadow-sm disabled:opacity-60">Meta Verilerinden Rapor Oluştur</button>
        </div>
        {message && <p className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-700">{message}</p>}
      </div>
      <p className="rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">Seçili veri aralığı: {selectedMetaRangeLabel}</p>
      <div className="grid gap-3 md:grid-cols-5">
        <AgencyStatCard label="Toplam Harcama" value={`${Number(totals.spend || 0).toLocaleString("tr-TR")} TL`} note="Seçili senkron verisi" />
        <AgencyStatCard label="Toplam Erişim" value={Number(totals.reach || 0).toLocaleString("tr-TR")} note="Meta erişim" />
        <AgencyStatCard label="Toplam Tıklama" value={Number(totals.clicks || 0).toLocaleString("tr-TR")} note="Link / toplam tıklama" />
        <AgencyStatCard label="Ortalama CTR" value={`${totals.impressions ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : "0.00"}%`} note="Tıklama oranı" />
        <AgencyStatCard label="Aktif Kampanya" value={activeMetaCampaignCount} note="Meta kampanya keşfi" />
      </div>
      <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-4">
        <h3 className="font-black text-slate-900">Meta Kampanyaları</h3>
        <div className="mt-4 grid gap-3">
          {summaries.map((item: any) => <div key={item.campaignId} className="grid gap-3 rounded-[10px] border border-slate-200 p-3 md:grid-cols-[1fr_.5fr_.5fr_.5fr_.5fr_auto] md:items-center">
            <span><strong className="block text-slate-900">{item.campaignName}</strong><small className="text-slate-500">{item.status}</small><small className="mt-1 block text-slate-500">Meta Campaign ID: {item.campaignId}</small><small className="mt-1 block text-slate-500">Veri Aralığı: {item.dateRangeLabel || selectedMetaRangeLabel}</small><small className="mt-1 block text-slate-500">{item.periodStart && item.periodEnd ? `Veri dönemi: ${metaPeriodText(item)}` : item.lastDataDate ? `Veri tarihi: ${formatDate(item.lastDataDate)}` : "Veri tarihi bilinmiyor"}</small><small className="mt-1 block text-slate-500">Son veri tarihi: {item.lastDataDate ? formatDate(item.lastDataDate) : "Veri tarihi bilinmiyor"}</small><small className="mt-1 block font-bold text-slate-600">{matchedCampaignFor(item) ? `Eşleşen kampanya: ${matchedCampaignFor(item)?.name || "İsimsiz kampanya"}` : "Yerel kampanya eşleşmedi."}</small></span>
            <span className="text-sm text-slate-600">{Number(item.spend || 0).toLocaleString("tr-TR")} TL</span>
            <span className="text-sm text-slate-600">{Number(item.results || 0).toLocaleString("tr-TR")} sonuç</span>
            <span className="text-sm text-slate-600">{Number(item.ctr || 0).toFixed(2)}% CTR</span>
            <span className="text-sm text-slate-600">{Number(item.cpc || 0).toFixed(2)} CPC</span>
            <span className="flex flex-wrap gap-2"><button onClick={() => pull("report")} className="rounded-full bg-amber-400 px-3 py-1.5 text-xs font-black text-slate-950">Rapor Oluştur</button><button onClick={() => recordActionDetail("Meta Kampanya Detayı", [["Kampanya", item.campaignName], ["Harcama", `${Number(item.spend || 0).toLocaleString("tr-TR")} TL`], ["Sonuçlar", item.results], ["CTR", `${Number(item.ctr || 0).toFixed(2)}%`], ["CPC", Number(item.cpc || 0).toFixed(2)]])} className="rounded-full border border-cyan-200/25 px-3 py-1.5 text-xs text-cyan-700">Detay Gör</button><button onClick={() => openCampaignMatch(item)} className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-black text-white">{matchedCampaignFor(item) ? "Eşleştirildi" : "Kampanyayı Eşleştir"}</button></span>
          </div>)}
          {!summaries.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-5 text-sm text-slate-400">Henüz Meta kampanya verisi yok. “Verileri Çek” ile senkronizasyon başlatın.</p>}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[14px] border border-slate-200 bg-white p-4">
          <h3 className="font-black text-slate-900">Reklam Setleri</h3>
          <p className="mt-1 text-sm text-slate-600">Hedefleme, yaş/cinsiyet/şehir/placement kırılımları ve lifecycle bilgileri.</p>
          <div className="mt-4 grid gap-3">
            {metaAdsets.slice(0, 6).map((item: any) => <div key={item.id || item.meta_adset_id} className="rounded-[10px] border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-black text-slate-900">{item.adset_name || "Reklam seti"}</p>
              <p className="mt-1 text-xs text-slate-600">ID: {item.meta_adset_id || "-"} · Durum: {item.status || "-"} · Optimizasyon: {item.optimization_goal || "-"}</p>
              <p className="mt-2 text-xs text-slate-600">Harcama {Number(item.spend || 0).toLocaleString("tr-TR")} TL · Erişim {Number(item.reach || 0).toLocaleString("tr-TR")} · Kalan gün {item.days_remaining ?? "Veri yok"}</p>
            </div>)}
            {!metaAdsets.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-4 text-sm text-slate-500">Bu veri henüz çekilmedi veya Meta tarafından sağlanmadı.</p>}
          </div>
        </div>
        <div className="rounded-[14px] border border-slate-200 bg-white p-4">
          <h3 className="font-black text-slate-900">Reklamlar ve Kreatifler</h3>
          <p className="mt-1 text-sm text-slate-600">Ad seviyesi metrikler, kreatif önizleme, metin, CTA ve video verileri.</p>
          <div className="mt-4 grid gap-3">
            {metaAds.slice(0, 6).map((item: any) => <div key={item.id || item.meta_ad_id} className="grid gap-3 rounded-[10px] border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-[72px_1fr]">
              <div className="h-16 w-16 overflow-hidden rounded-[10px] border border-slate-200 bg-white">{item.creative_thumbnail_url ? <img src={item.creative_thumbnail_url} alt={item.ad_name || "Kreatif"} className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center px-2 text-center text-[10px] text-slate-500">Önizleme yok</span>}</div>
              <div>
                <p className="font-black text-slate-900">{item.ad_name || "Reklam"}</p>
                <p className="mt-1 text-xs text-slate-600">ID: {item.meta_ad_id || "-"} · Durum: {item.status || "-"} · CTA: {item.cta || "-"}</p>
                <p className="mt-2 text-xs text-slate-600">CTR {Number(item.ctr || 0).toFixed(2)}% · CPC {Number(item.cpc || 0).toFixed(2)} · ROAS {Number(item.roas || 0).toFixed(2)}</p>
                {item.ad_text && <p className="mt-2 line-clamp-2 text-xs text-slate-500">{item.ad_text}</p>}
              </div>
            </div>)}
            {!metaAds.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-4 text-sm text-slate-500">Kreatif önizleme alınamadı veya ad seviyesi veri henüz çekilmedi.</p>}
          </div>
        </div>
        <div className="rounded-[14px] border border-slate-200 bg-white p-4">
          <h3 className="font-black text-slate-900">Dönüşümler ve Video Performansı</h3>
          <div className="mt-4 grid gap-3">
            {metaConversions.slice(0, 8).map((item: any) => <div key={item.id || `${item.meta_ad_id}-${item.event_name}`} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-slate-200 bg-slate-50 p-3 text-sm">
              <span><strong className="block text-slate-900">{item.event_name}</strong><small className="text-slate-600">{item.date || "-"}</small></span>
              <span className="font-black text-slate-900">{Number(item.event_count || 0).toLocaleString("tr-TR")}</span>
              <span className="text-xs text-slate-600">Maliyet: {Number(item.cost_per_event || 0).toFixed(2)} TL</span>
            </div>)}
            {!metaConversions.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-4 text-sm text-slate-500">Bu veri henüz çekilmedi veya Meta tarafından sağlanmadı.</p>}
            {metaAds.some((item: any) => Number(item.video_3s_views || 0) > 0) && <div className="rounded-[10px] border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-900">Thumb Stop Rate, 3 saniye izlenme / gösterim hesabıyla hesaplanır. En yüksek değer: {Math.max(...metaAds.map((item: any) => Number(item.thumb_stop_rate || 0))).toFixed(2)}%</div>}
          </div>
        </div>
        <div className="rounded-[14px] border border-slate-200 bg-white p-4">
          <h3 className="font-black text-slate-900">HK Intelligence Analizi</h3>
          {metaAnalyses[0] ? <div className="mt-4 grid gap-3 text-sm">
            <InfoItem label="En iyi kreatif" value={metaAnalyses[0].best_creative?.ad_name || metaAnalyses[0].best_creative?.campaignName || "Veri yok"} />
            <InfoItem label="En zayıf kreatif" value={metaAnalyses[0].weakest_creative?.ad_name || "Veri yok"} />
            <p className="rounded-[10px] border border-slate-200 bg-slate-50 p-3 text-slate-700">{metaAnalyses[0].budget_recommendation}</p>
            <p className="rounded-[10px] border border-slate-200 bg-slate-50 p-3 text-slate-700">{metaAnalyses[0].funnel_diagnosis}</p>
          </div> : <p className="mt-4 rounded-[8px] border border-dashed border-slate-200 p-4 text-sm text-slate-500">HK Intelligence analizi henüz oluşturulmadı.</p>}
        </div>
      </div>
      <div className="rounded-[14px] border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-black text-slate-900">Müşteriye Gösterilecekler</h3>
            <p className="mt-1 text-sm text-slate-600">Meta raporları, müşteri paneli ve PDF çıktılarında hangi bölüm/metriklerin görüneceğini seçin.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => bulkVisibility(true)} className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-black text-white">Tümünü Göster</button>
            <button onClick={() => bulkVisibility(false)} className="rounded-full bg-slate-600 px-4 py-2 text-xs font-black text-white">Tümünü Gizle</button>
            <button onClick={resetVisibility} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-black text-slate-700">Varsayılana Dön</button>
            <button onClick={saveReportVisibility} className="rounded-full bg-blue-600 px-4 py-2 text-xs font-black text-white">Kaydet</button>
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-[.14em] text-slate-500">Bölümler</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {visibilitySections.map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={isReportVisible(key)} onChange={(event) => updateReportVisibility(key, "__section", event.target.checked)} /> {label}</label>)}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-[.14em] text-slate-500">Metrikler</p>
            <div className="grid max-h-[360px] gap-2 overflow-auto pr-1 sm:grid-cols-2">
              {visibilityMetrics.map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={isReportVisible("metrics", key)} onChange={(event) => updateReportVisibility("metrics", key, event.target.checked)} /> {label}</label>)}
            </div>
          </div>
        </div>
      </div>
      {campaignMatchModalOpen && activeMatchingCampaign && typeof document !== "undefined" && createPortal(<div className="fixed inset-0 z-[9999] grid place-items-center bg-white/75 p-4" onMouseDown={closeCampaignMatch}>
        <div className="w-full max-w-3xl rounded-[18px] border border-slate-200 bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-blue-700">Kampanya Eşleştir</p>
              <h3 className="mt-1 text-2xl font-black text-slate-900">{activeMatchingCampaign.campaignName}</h3>
              <p className="mt-1 text-sm text-slate-600">Meta campaign ID: {activeMatchingCampaign.campaignId}</p>
            </div>
            <button onClick={closeCampaignMatch} className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700">Kapat</button>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-5">
            <InfoItem label="Spend" value={`${Number(activeMatchingCampaign.spend || 0).toLocaleString("tr-TR")} TL`} />
            <InfoItem label="Reach" value={Number(activeMatchingCampaign.reach || 0).toLocaleString("tr-TR")} />
            <InfoItem label="Clicks" value={Number(activeMatchingCampaign.clicks || 0).toLocaleString("tr-TR")} />
            <InfoItem label="CTR" value={`${Number(activeMatchingCampaign.ctr || 0).toFixed(2)}%`} />
            <InfoItem label="CPC" value={Number(activeMatchingCampaign.cpc || 0).toFixed(2)} />
          </div>
          <div className="mt-5 rounded-[14px] border border-slate-200 bg-slate-50 p-4">
            <p className="font-black text-slate-900">Step 1: Mevcut kampanya seç</p>
            {!localCampaigns.length && <p className="mt-2 rounded-[8px] border border-dashed border-slate-200 bg-white p-3 text-sm text-slate-500">Bu müşteriye ait kampanya bulunamadı.</p>}
            <div className="mt-3">
              <SelectField label="Mevcut kampanya seç" value={matchingExistingId} onChange={setMatchingExistingId} options={localCampaigns.map((campaign: any) => ({ value: campaign.id, label: campaign.name || "İsimsiz kampanya" }))} placeholder="Kampanya seçilmedi" />
            </div>
          </div>
          <div className="mt-4 rounded-[14px] border border-slate-200 bg-white p-4">
            <p className="font-black text-slate-900">Step 2: Eşleştir veya yeni kampanya oluştur</p>
            <p className="mt-1 text-sm text-slate-600">Yerel kampanya yoksa Meta kampanya adı, platform, durum ve harcama bilgileriyle yeni kayıt oluşturulur.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button disabled={loading === "campaign-match"} onClick={() => saveCampaignMatch(false)} className="rounded-full bg-blue-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60">{loading === "campaign-match" ? "Eşleştiriliyor..." : "Meta Verilerini Kampanyaya Aktar"}</button>
              <button disabled={loading === "campaign-match"} onClick={() => saveCampaignMatch(true)} className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-black text-white disabled:opacity-60">{loading === "campaign-match" ? "Oluşturuluyor..." : "Yeni Kampanya Oluştur"}</button>
            </div>
          </div>
        </div>
      </div>, document.body)}
    </div>
  );
}

function CustomerRelatedList({ items, empty, render, onVisibilityChange }: any) {
  return <div className="grid gap-3">{items.map((item) => {
    const visible = item.visible_to_customer ?? true;
    return <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><span>{render(item)}</span>{onVisibilityChange && <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={visible} onChange={(event) => onVisibilityChange(item, event.target.checked)} /> {visible ? "Müşteri Panelinde Görünür" : "Sadece Yönetici"}</label>}</div>;
  })}{!items.length && <p className="text-sm text-slate-400">{empty}</p>}</div>;
}

function CustomerTimeline({ company, campaigns, payments, tasks, documents, reports, activities }: any) {
  const rows = [
    { date: company.created_at || company.updated_at, user: "Sistem", action: "Müşteri oluşturuldu", description: company.name },
    ...campaigns.flatMap((item) => [
      { date: item.created_at, user: "Sistem", action: "Kampanya eklendi", description: item.name },
      { date: item.updated_at, user: "Sistem", action: "Kampanya güncellendi", description: `${item.name} · ${item.status || "Durum yok"}` }
    ]),
    ...payments.map((item) => ({ date: item.payment_date || item.updated_at || item.created_at, user: "Sistem", action: item.status === "Ödendi" ? "Ödeme ödendi" : "Ödeme eklendi", description: `${Number(item.amount || 0).toLocaleString("tr-TR")} TL · ${item.status || "Bekliyor"}` })),
    ...tasks.map((item) => ({ date: item.completed_at || item.updated_at || item.created_at, user: "Sistem", action: item.status === "Tamamlandı" ? "Görev tamamlandı" : "Görev oluşturuldu", description: `${item.title || "Görev"} · ${item.status || "Yapılacak"}` })),
    ...documents.map((item) => ({ date: item.document_date || item.created_at || item.updated_at, user: "Sistem", action: "Belge yüklendi", description: `${item.title || "Belge"} · ${item.document_type || item.file_type || "Dosya"}` })),
    ...reports.map((item) => ({ date: item.published_at || item.created_at || item.updated_at, user: "Sistem", action: item.visible_to_customer ? "Rapor yayınlandı" : "Rapor hazırlandı", description: `${item.report_type || "Rapor"} · ${item.period || "-"}` })),
    ...activities.map((item) => ({ date: item.created_at, user: item.actor_name || item.user_name || "Sistem", action: item.action_type || item.action || "Aktivite", description: item.details?.message || item.entity || item.module || "-" }))
  ].filter((item) => item.date).sort((a, b) => Number(new Date(b.date)) - Number(new Date(a.date))).slice(0, 80);
  return <div><div className="mb-4"><h3 className="font-black text-slate-900">Zaman Çizelgesi</h3><p className="mt-1 text-sm leading-6 text-slate-400">Müşteri geçmişi; kampanya, ödeme, görev, belge, rapor ve log hareketlerinden otomatik oluşturulur.</p></div><div className="grid gap-3">{rows.map((item, index) => <div key={`${item.action}-${item.date}-${index}`} className="grid gap-3 rounded-[8px] border border-slate-200 bg-slate-50 p-4 md:grid-cols-[170px_160px_1fr]"><time className="text-xs font-black text-cyan-700">{formatDateTime(item.date)}</time><span className="text-xs font-bold text-slate-400">{item.user}</span><span><strong className="block text-sm text-slate-900">{item.action}</strong><span className="mt-1 block text-xs leading-5 text-slate-400">{item.description}</span></span></div>)}{!rows.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-5 text-sm text-slate-400">Bu müşteri için zaman çizelgesi kaydı henüz oluşmadı.</p>}</div></div>;
}

function useCustomerActionFeedback(notify?: any) {
  const [feedback, setFeedback] = useState({});
  async function run(key: string, loading: string, done: string, action: any) {
    setFeedback((current) => ({ ...current, [key]: loading }));
    await Promise.resolve(action?.());
    setFeedback((current) => ({ ...current, [key]: `${done} ✓` }));
    notify?.(`✓ ${done}`, "success");
    setTimeout(() => setFeedback((current) => ({ ...current, [key]: "" })), 2000);
  }
  const label = (key: string, fallback: string) => feedback[key] || fallback;
  return { run, label, feedback };
}

function CustomerProposalsEditor({ company, content, setContent, save, items, notify, canManage = true }: any) {
  const allItems = content.customerDocuments || [];
  const visibleItems = items.filter((item) => !item.deleted_at);
  const { run, label } = useCustomerActionFeedback(notify);
  const update = (id, patch) => updateCollection(content, setContent, "customerDocuments", allItems.map((item) => item.id === id ? { ...item, ...patch, updated_at: new Date().toISOString() } : item));
  const add = () => updateCollection(content, setContent, "customerDocuments", [{ id: createLocalId(), company_id: company.id, title: `Teklif · ${company.name || "Müşteri"}`, document_type: "Teklif", document_date: new Date().toISOString().slice(0, 10), package_type: "ORTA", service_fee: 0, ad_budget: 0, included_services: "Meta Ads yönetimi\nRaporlama\nWhatsApp teklif akışı", next_step: "Müşteri onayı sonrası kurulum planı hazırlanacak.", description: "Teklif içeriği hazırlanıyor.", document_url: "", visible_to_customer: false, status: "Taslak", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...allItems]);
  const archive = (item) => confirm("Bu teklifi arşivlemek istediğinize emin misiniz?") && update(item.id, { archived_at: new Date().toISOString(), status: "Arşivlendi" });
  const remove = (item) => confirm("Bu teklifi silmek istediğinize emin misiniz?") && update(item.id, { deleted_at: new Date().toISOString(), status: "Silindi" });
  return <div><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-slate-900">Teklifler</h3><p className="mt-1 text-sm text-slate-400">Bu teklifler Belge Merkezi ile aynı kayıtları kullanır. Müşteri paneline sadece görünür olarak işaretlenenler yansır.</p></div>{canManage && <button onClick={add} className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">Teklif Oluştur</button>}</div><div className="grid gap-3">{visibleItems.map((item) => <div key={item.id} className={`rounded-[8px] border p-4 ${isArchivedRecord(item) ? "border-amber-300/25 bg-amber-300/[0.06]" : "border-slate-200 bg-slate-50"}`}><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><Field label="Teklif başlığı" value={item.title || ""} onChange={(value) => update(item.id, { title: value })} /><SelectField label="Paket tipi" value={item.package_type || "ORTA"} onChange={(value) => update(item.id, { package_type: value })} options={["MIN", "ORTA", "MAX", "Özel"]} /><SelectField label="Durum" value={item.status || "Taslak"} onChange={(value) => update(item.id, { status: value })} options={["Taslak", "Hazır", "Gönderildi", "Arşivlendi"]} /><Field label="Hizmet bedeli" type="number" value={item.service_fee || 0} onChange={(value) => update(item.id, { service_fee: Number(value || 0) })} /><Field label="Reklam bütçesi" type="number" value={item.ad_budget || 0} onChange={(value) => update(item.id, { ad_budget: Number(value || 0) })} /><Field label="Tarih" type="date" value={item.document_date || ""} onChange={(value) => update(item.id, { document_date: value })} /><Field label="Belge URL" value={item.document_url || ""} onChange={(value) => update(item.id, { document_url: value })} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(item.visible_to_customer)} onChange={(event) => update(item.id, { visible_to_customer: event.target.checked })} /> Müşteri Belgelerine Kaydet / Göster</label><InfoItem label="Güncellenme tarihi" value={formatDateTime(item.updated_at)} /><div className="md:col-span-2 xl:col-span-3"><TextArea label="Dahil hizmetler" value={item.included_services || ""} onChange={(value) => update(item.id, { included_services: value })} /></div><div className="md:col-span-2 xl:col-span-3"><TextArea label="Notlar" value={item.description || ""} onChange={(value) => update(item.id, { description: value })} /></div><div className="md:col-span-2 xl:col-span-3"><TextArea label="Sonraki adım" value={item.next_step || ""} onChange={(value) => update(item.id, { next_step: value })} /></div></div><div className="mt-4 flex flex-wrap justify-end gap-2"><button onClick={() => alert(`${item.title || "Teklif"}\n\nPaket: ${item.package_type || "-"}\nHizmet bedeli: ${Number(item.service_fee || 0).toLocaleString("tr-TR")} TL\nReklam bütçesi: ${Number(item.ad_budget || 0).toLocaleString("tr-TR")} TL\n\n${item.included_services || ""}\n\n${item.description || ""}\n\nSonraki adım: ${item.next_step || "-"}`)} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700">Önizle</button><button onClick={() => window.print()} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700">Yazdır / PDF</button>{canManage && (isArchivedRecord(item) ? <button onClick={() => update(item.id, { archived_at: null, deleted_at: null, status: "Taslak" })} className="rounded-full border border-amber-300/30 px-4 py-2 text-xs text-amber-700">Arşivden Çıkar</button> : <button onClick={() => archive(item)} className="rounded-full border border-amber-300/30 px-4 py-2 text-xs text-amber-700">Arşivle</button>)}{canManage && <button onClick={() => remove(item)} className="rounded-full border border-red-300/30 px-4 py-2 text-xs text-red-200">Sil</button>}{canManage && <button onClick={() => run(`proposal-${item.id}`, "Kaydediliyor...", "Kaydedildi", () => save?.())} className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">{label(`proposal-${item.id}`, "Kaydet")}</button>}<button onClick={() => window.location.reload()} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700">Vazgeç</button></div></div>)}{!visibleItems.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-5 text-sm text-slate-400">Bu müşteri için teklif dokümanı yok.</p>}</div></div>;
}

function CustomerReportsEditor({ company, content, setContent, save, items, notify, canManage = true }: any) {
  const allItems = content.reports || [];
  const visibleItems = items.filter((item) => !item.deleted_at);
  const { run, label } = useCustomerActionFeedback(notify);
  const update = (id, patch) => updateCollection(content, setContent, "reports", allItems.map((item) => item.id === id ? { ...item, ...patch, updated_at: new Date().toISOString() } : item));
  const add = () => updateCollection(content, setContent, "reports", [{ id: createLocalId(), company_id: company.id, report_type: "Genel Dijital Performans Raporu", period: new Date().toISOString().slice(0, 7), summary: "", customer_note: "", ai_interpretation: "", visible_to_customer: false, archived: false, status: "Taslak", metrics: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...allItems]);
  const aiInterpret = (item) => update(item.id, { ai_interpretation: `${company.name || "Müşteri"} için rapor yorumu: mevcut metrikler, görünür rapor notları ve kampanya verileri birlikte takip edilmeli. Önümüzdeki 7 gün içinde düşük performanslı alanlar kontrol edilip müşteriyle net aksiyon planı paylaşılmalıdır.`, customer_note: item.customer_note || "Performansı görünür hale getirmek için rapor düzenli takip edilmelidir." });
  return <div><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-slate-900">Raporlar</h3><p className="mt-1 text-sm text-slate-400">Raporlar, müşteri paneli görünürlüğü ve PDF/Yazdır akışıyla birlikte yönetilir.</p></div>{canManage && <button onClick={add} className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">Rapor Oluştur</button>}</div><div className="grid gap-3">{visibleItems.map((item) => <div key={item.id} className={`rounded-[8px] border p-4 ${isArchivedRecord(item) || item.archived ? "border-amber-300/25 bg-amber-300/[0.06]" : "border-slate-200 bg-slate-50"}`}><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><SelectField label="Rapor türü" value={item.report_type || "Genel Dijital Performans Raporu"} onChange={(value) => update(item.id, { report_type: value })} options={["Meta Reklam Raporu", "Google Ads Raporu", "Sosyal Medya Yönetimi Raporu", "Genel Dijital Performans Raporu"]} /><Field label="Dönem" value={item.period || ""} onChange={(value) => update(item.id, { period: value })} /><SelectField label="Durum" value={item.status || "Taslak"} onChange={(value) => update(item.id, { status: value })} options={["Taslak", "Hazır", "Yayınlandı", "Arşivlendi"]} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(item.visible_to_customer)} onChange={(event) => update(item.id, { visible_to_customer: event.target.checked })} /> {item.visible_to_customer ? "Müşteriye Göster" : "Müşteriden Gizle"}</label><InfoItem label="Oluşturulma tarihi" value={formatDateTime(item.created_at)} /><InfoItem label="Güncellenme tarihi" value={formatDateTime(item.updated_at)} /><div className="md:col-span-2 xl:col-span-3"><TextArea label="Rapor özeti" value={item.summary || item.customer_note || ""} onChange={(value) => update(item.id, { summary: value, customer_note: value })} /></div><div className="md:col-span-2 xl:col-span-3"><TextArea label="AI yorum / sonraki öneri" value={item.ai_interpretation || ""} onChange={(value) => update(item.id, { ai_interpretation: value })} /></div></div><div className="mt-4 flex flex-wrap justify-end gap-2"><button onClick={() => aiInterpret(item)} className="rounded-full border border-cyan-200/25 px-4 py-2 text-xs text-cyan-700">AI Yorumla</button><button onClick={() => window.print()} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700">PDF / Yazdır</button>{isArchivedRecord(item) || item.archived ? <button onClick={() => update(item.id, { archived_at: null, deleted_at: null, archived: false, status: "Taslak" })} className="rounded-full border border-amber-300/30 px-4 py-2 text-xs text-amber-700">Arşivden Çıkar</button> : <button onClick={() => update(item.id, { archived_at: new Date().toISOString(), archived: true, status: "Arşivlendi" })} className="rounded-full border border-amber-300/30 px-4 py-2 text-xs text-amber-700">Arşivle</button>}<button onClick={() => confirm("Bu raporu silmek istediğinize emin misiniz?") && update(item.id, { deleted_at: new Date().toISOString(), status: "Silindi" })} className="rounded-full border border-red-300/30 px-4 py-2 text-xs text-red-200">Sil</button><button onClick={() => run(`report-${item.id}`, "Kaydediliyor...", "Kaydedildi", () => save?.())} className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">{label(`report-${item.id}`, "Kaydet")}</button><button onClick={() => window.location.reload()} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700">Vazgeç</button></div></div>)}{!visibleItems.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-5 text-sm text-slate-400">Bu müşteri için kanal bazlı rapor yok.</p>}</div></div>;
}

function CustomerFilesEditor({ company, content, setContent, save, items, notify, canManage = true }: any) {
  const allItems = content.customerFiles || [];
  const visibleItems = items.filter((item) => !item.deleted_at);
  const { run, label } = useCustomerActionFeedback(notify);
  const update = (id, patch) => updateCollection(content, setContent, "customerFiles", allItems.map((item) => item.id === id ? { ...item, ...patch, updated_at: new Date().toISOString() } : item));
  const add = () => updateCollection(content, setContent, "customerFiles", [{ id: createLocalId(), company_id: company.id, title: "Yeni Dosya", file_type: "Diğer", description: "", file_url: "", document_url: "", visible_to_customer: false, show_in_creative_center: false, status: "Aktif", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...allItems]);
  const syncFileUrl = (id, value) => update(id, { file_url: value, document_url: value });
  const isCreativeType = (type) => ["Görsel", "Reklam Görseli", "Kreatif"].includes(type || "");
  return <div><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-slate-900">Dosyalar</h3><p className="mt-1 text-sm text-slate-400">Müşteri panelinde sadece görünür olarak işaretlenen dosyalar gösterilir.</p></div>{canManage && <button onClick={add} className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">Dosya Ekle</button>}</div><div className="grid gap-3">{visibleItems.map((item) => <div key={item.id} className={`rounded-[8px] border p-4 ${isArchivedRecord(item) ? "border-amber-300/25 bg-amber-300/[0.06]" : "border-slate-200 bg-slate-50"}`}><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><Field label="Dosya başlığı" value={item.title || ""} onChange={(value) => update(item.id, { title: value })} /><SelectField label="Dosya türü" value={item.file_type || "Diğer"} onChange={(value) => update(item.id, { file_type: value, show_in_creative_center: item.show_in_creative_center || isCreativeType(value) })} options={fileCategoryOptions} /><Field label="Dosya URL" value={item.file_url || item.document_url || ""} onChange={(value) => syncFileUrl(item.id, value)} /><Upload onUrl={(url) => syncFileUrl(item.id, url)} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(item.visible_to_customer)} onChange={(event) => update(item.id, { visible_to_customer: event.target.checked })} /> {item.visible_to_customer ? "Müşteriye Göster" : "Sadece Yönetici"}</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(item.show_in_creative_center || isCreativeType(item.file_type))} onChange={(event) => update(item.id, { show_in_creative_center: event.target.checked })} /> Kreatif Merkezinde Göster</label><InfoItem label="Güncellenme tarihi" value={formatDateTime(item.updated_at)} /><div className="md:col-span-2 xl:grid-cols-3 xl:col-span-3"><TextArea label="Açıklama" value={item.description || ""} onChange={(value) => update(item.id, { description: value })} /></div></div><div className="mt-4 flex flex-wrap justify-end gap-2">{isArchivedRecord(item) ? <button onClick={() => update(item.id, { archived_at: null, deleted_at: null, status: "Aktif" })} className="rounded-full border border-amber-300/30 px-4 py-2 text-xs text-amber-700">Arşivden Çıkar</button> : <button onClick={() => update(item.id, { archived_at: new Date().toISOString(), status: "Arşivlendi" })} className="rounded-full border border-amber-300/30 px-4 py-2 text-xs text-amber-700">Arşivle</button>}<button onClick={() => confirm("Bu dosyayı silmek istediğinize emin misiniz?") && update(item.id, { deleted_at: new Date().toISOString(), status: "Silindi" })} className="rounded-full border border-red-300/30 px-4 py-2 text-xs text-red-200">Sil</button><button onClick={() => run(`file-${item.id}`, "Kaydediliyor...", "Kaydedildi", () => save?.())} className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">{label(`file-${item.id}`, "Kaydet")}</button><button onClick={() => window.location.reload()} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700">Vazgeç</button></div></div>)}{!visibleItems.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-5 text-sm text-slate-400">Bu müşteri için dosya yok.</p>}</div></div>;
}

function CustomerCampaignsEditor({ company, content, setContent, save, setActive, items, notify, canManage = true }: any) {
  const allItems = content.campaigns || [];
  const { run, label } = useCustomerActionFeedback(notify);
  const [statusFilter, setStatusFilter] = useState("Tüm kampanyalar");
  const [platformFilter, setPlatformFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const campaignTabs = ["Tüm kampanyalar", "Aktif kampanyalar", "Planlanan kampanyalar", "Tamamlanan kampanyalar", "Durdurulan kampanyalar", "Arşivlenen kampanyalar"];
  const visibleItems = filterCampaigns(items, { status: statusFilter, platform: platformFilter, startDate, endDate });
  const update = (id, patch) => updateCollection(content, setContent, "campaigns", allItems.map((item) => item.id === id ? { ...item, ...patch, updated_at: new Date().toISOString() } : item));
  const add = () => {
    updateCollection(content, setContent, "campaigns", [{ id: createLocalId(), company_id: company.id, name: "Yeni Kampanya", platform: "Meta Ads", objective: "Lead", status: "Planlandı", start_date: new Date().toISOString().slice(0, 10), end_date: "", daily_budget: 0, total_budget: 0, spent_budget: 0, budget: 0, spent: 0, notes: "", internal_notes: "", visible_to_customer: false }, ...allItems]);
    notify?.("✓ Kampanya taslağı oluşturuldu", "success");
  };
  const copy = (campaign) => {
    updateCollection(content, setContent, "campaigns", [{ ...campaign, id: createLocalId(), company_id: company.id, name: `${campaign.name || "Kampanya"} Kopya`, status: "Planlandı", archived_at: null, deleted_at: null, visible_to_customer: false }, ...allItems]);
    notify?.("✓ Kampanya kopyalandı", "success");
  };
  const archive = (campaign) => {
    if (!confirm("Bu kampanyayı silmek/arşivlemek istediğinize emin misiniz?")) return;
    update(campaign.id, { archived_at: new Date().toISOString(), status: "Arşivlendi" });
    notify?.("✓ Kampanya arşivlendi", "success");
  };
  const createReport = (campaign) => {
    updateCollection(content, setContent, "reports", [{ id: createLocalId(), company_id: company.id, campaign_id: campaign.id, report_type: `${campaign.platform || "Reklam"} Raporu`, period: campaign.start_date && campaign.end_date ? `${campaign.start_date} - ${campaign.end_date}` : "Kampanya dönemi", summary: `${campaign.name || "Kampanya"} için rapor taslağı.`, visible_to_customer: false, archived: false, metrics: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...(content.reports || [])]);
    setActive?.("Müşteri Raporları");
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-black text-slate-900">Kampanyalar</h3>
          <p className="mt-1 text-sm text-slate-400">Bu müşteri kampanyaları ana Kampanyalar modülü, raporlar ve müşteri paneli görünürlüğüyle aynı veri kaynağını kullanır.</p>
        </div>
        {canManage && <button onClick={add} className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">Kampanya Ekle</button>}
      </div>
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <SelectField label="Liste" value={statusFilter} onChange={setStatusFilter} options={campaignTabs} />
        <SelectField label="Platform" value={platformFilter} onChange={setPlatformFilter} options={platformOptions} placeholder="Tüm platformlar" />
        <Field label="Başlangıç tarihi" type="date" value={startDate} onChange={setStartDate} />
        <Field label="Bitiş tarihi" type="date" value={endDate} onChange={setEndDate} />
      </div>
      <div className="grid gap-3">
        {visibleItems.map((campaign) => {
          const archived = isCampaignArchived(campaign);
          const totalBudget = campaign.total_budget ?? campaign.budget ?? 0;
          const spentBudget = campaign.spent_budget ?? campaign.spent ?? 0;
          return (
            <div key={campaign.id} className={`rounded-[8px] border p-4 ${archived ? "border-amber-300/25 bg-amber-300/[0.06]" : "border-slate-200 bg-slate-50"}`}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">{campaign.platform || "Platform"}</p>
                  <h4 className="mt-1 text-lg font-black text-slate-900">{campaign.name || "İsimsiz kampanya"}</h4>
                  <p className="mt-1 text-xs text-slate-400">{campaign.objective || "Amaç yok"} · {campaign.status || "Planlandı"} · {formatDate(campaign.start_date)} - {formatDate(campaign.end_date)}</p>
                </div>
                <span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-xs font-black text-cyan-700">{campaign.visible_to_customer ? "Müşteri Panelinde Görünür" : "Sadece Yönetici"}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Kampanya adı" value={campaign.name || ""} onChange={(value) => update(campaign.id, { name: value })} />
                <SelectField label="Platform" value={campaign.platform || "Meta Ads"} onChange={(value) => update(campaign.id, { platform: value })} options={platformOptions} />
                <SelectField label="Amaç" value={campaign.objective || "Lead"} onChange={(value) => update(campaign.id, { objective: value })} options={objectiveOptions} />
                <SelectField label="Durum" value={campaign.status || "Planlandı"} onChange={(value) => update(campaign.id, { status: value, archived_at: value === "Arşivlendi" ? new Date().toISOString() : campaign.archived_at })} options={campaignStatusOptions} />
                <Field label="Başlangıç tarihi" type="date" value={campaign.start_date || ""} onChange={(value) => update(campaign.id, { start_date: value })} />
                <Field label="Bitiş tarihi" type="date" value={campaign.end_date || ""} onChange={(value) => update(campaign.id, { end_date: value })} />
                <Field label="Günlük bütçe" type="number" value={campaign.daily_budget || 0} onChange={(value) => update(campaign.id, { daily_budget: Number(value || 0) })} />
                <Field label="Toplam bütçe" type="number" value={totalBudget} onChange={(value) => update(campaign.id, { total_budget: Number(value || 0), budget: Number(value || 0) })} />
                <Field label="Harcanan bütçe" type="number" value={spentBudget} onChange={(value) => update(campaign.id, { spent_budget: Number(value || 0), spent: Number(value || 0) })} />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(campaign.visible_to_customer)} onChange={(event) => update(campaign.id, { visible_to_customer: event.target.checked })} /> Müşteriye görünür mü?</label>
                <InfoItem label="Oluşturulma tarihi" value={formatDateTime(campaign.created_at)} />
                <InfoItem label="Güncellenme tarihi" value={formatDateTime(campaign.updated_at)} />
                <div className="md:col-span-2 xl:col-span-3"><TextArea label="Notlar" value={campaign.notes || ""} onChange={(value) => update(campaign.id, { notes: value })} /></div>
                <div className="md:col-span-2 xl:col-span-3"><TextArea label="Dahili notlar" value={campaign.internal_notes || ""} onChange={(value) => update(campaign.id, { internal_notes: value })} /></div>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                {canManage && <button onClick={() => createReport(campaign)} className="rounded-full border border-emerald-300/30 px-4 py-2 text-xs text-emerald-700">Rapor taslağı oluştur</button>}
                {canManage && <button onClick={() => copy(campaign)} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700">Kopyala</button>}
                {canManage && (archived ? <button onClick={() => update(campaign.id, { archived_at: null, deleted_at: null, status: "Planlandı" })} className="rounded-full border border-amber-300/30 px-4 py-2 text-xs text-amber-700">Arşivden Çıkar</button> : <button onClick={() => archive(campaign)} className="rounded-full border border-red-300/30 px-4 py-2 text-xs text-red-200">Sil / Arşivle</button>)}
                {canManage && <button onClick={() => run(`campaign-${campaign.id}`, "Kaydediliyor...", "Kaydedildi", () => save?.())} className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">{label(`campaign-${campaign.id}`, "Kaydet")}</button>}
                <button onClick={() => window.location.reload()} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700">Vazgeç</button>
              </div>
            </div>
          );
        })}
        {!visibleItems.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-5 text-sm text-slate-400">Bu müşteri için kampanya kaydı bulunamadı.</p>}
      </div>
    </div>
  );
}

function CustomerPaymentsEditor({ company, content, setContent, save, items, notify, canManage = true }: any) {
  const allItems = content.paymentRecords || [];
  const { run, label } = useCustomerActionFeedback(notify);
  const [statusFilter, setStatusFilter] = useState("Tümü");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const thisMonth = new Date().toISOString().slice(0, 7);
  const update = (id, patch) => updateCollection(content, setContent, "paymentRecords", allItems.map((item) => item.id === id ? { ...item, ...patch } : item));
  const setStatus = (id, status) => updateCollection(content, setContent, "paymentRecords", allItems.map((item) => item.id === id ? stampPaymentStatus(item, status) : item));
  const archive = (id) => update(id, { archived_at: new Date().toISOString() });
  const restore = (id) => update(id, { archived_at: null, deleted_at: null });
  const visibleItems = filterPayments(items, { status: statusFilter, startDate, endDate });
  function add() {
    const duplicateDraft = allItems.some((item) => item.company_id === company.id && !Number(item.amount || 0) && item.status === "Bekliyor" && String(item.service_period || "").startsWith(thisMonth));
    if (duplicateDraft) return;
    updateCollection(content, setContent, "paymentRecords", [{ id: createLocalId(), company_id: company.id, amount: 0, due_date: new Date().toISOString().slice(0, 10), payment_date: "", status: "Bekliyor", service_period: thisMonth, payment_note: "", visible_to_customer: false }, ...allItems]);
    notify?.("✓ Ödeme taslağı oluşturuldu", "success");
  }
  return <div><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-slate-900">Ödemeler</h3><p className="mt-1 text-sm text-slate-400">Bu kayıtlar Tahsilat, Karlılık ve Dashboard özetleriyle aynı veri kaynağını kullanır.</p></div>{canManage && <button onClick={add} className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">Ödeme Ekle</button>}</div><div className="mb-4 grid gap-3 md:grid-cols-4"><SelectField label="Durum filtresi" value={statusFilter} onChange={setStatusFilter} options={paymentHistoryFilters} /><Field label="Başlangıç tarihi" type="date" value={startDate} onChange={setStartDate} /><Field label="Bitiş tarihi" type="date" value={endDate} onChange={setEndDate} /><button onClick={() => { setStatusFilter("Tümü"); setStartDate(""); setEndDate(""); }} className="self-end rounded-[8px] border border-slate-200 px-4 py-3 text-sm font-black text-slate-700">Filtreleri Temizle</button></div><div className="grid gap-3">{visibleItems.map((item) => <div key={item.id} className={`rounded-[8px] border p-4 ${isArchivedRecord(item) ? "border-amber-300/25 bg-amber-300/[0.06]" : "border-slate-200 bg-slate-50"}`}><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><Field label="Tutar" type="number" value={item.amount || 0} onChange={(value) => update(item.id, { amount: Number(value || 0) })} /><Field label="Son ödeme tarihi" type="date" value={item.due_date || ""} onChange={(value) => update(item.id, { due_date: value })} /><Field label="Ödeme tarihi" type="date" value={item.payment_date || ""} onChange={(value) => update(item.id, { payment_date: value })} /><SelectField label="Durum" value={item.status || "Bekliyor"} onChange={(value) => canManage && setStatus(item.id, value)} options={paymentStatusOptions} /><Field label="Hizmet dönemi" type="month" value={item.service_period || ""} onChange={(value) => update(item.id, { service_period: value })} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(item.visible_to_customer)} onChange={(event) => update(item.id, { visible_to_customer: event.target.checked })} /> Müşteri Panelinde Görünür</label><InfoItem label="Oluşturulma tarihi" value={formatDateTime(item.created_at)} /><InfoItem label="Güncellenme tarihi" value={formatDateTime(item.updated_at)} /><div className="md:col-span-2 xl:col-span-3"><TextArea label="Not" value={item.payment_note || ""} onChange={(value) => update(item.id, { payment_note: value })} /></div></div><div className="mt-4 flex flex-wrap justify-end gap-2">{canManage && (isArchivedRecord(item) ? <button onClick={() => restore(item.id)} className="rounded-full border border-amber-300/30 px-4 py-2 text-xs text-amber-700">Arşivden Çıkar</button> : <button onClick={() => archive(item.id)} className="rounded-full border border-amber-300/30 px-4 py-2 text-xs text-amber-700">Arşivle</button>)}{canManage && item.status !== "Ödendi" && <button onClick={() => setStatus(item.id, "Ödendi")} className="rounded-full border border-emerald-300/30 px-4 py-2 text-xs text-emerald-700">Ödendi Yap</button>}{canManage && item.status === "İptal" && <button onClick={() => setStatus(item.id, "Bekliyor")} className="rounded-full border border-emerald-300/30 px-4 py-2 text-xs text-emerald-700">Tekrar Bekliyor Yap</button>}{canManage && <button onClick={() => run(`payment-${item.id}`, "Kaydediliyor...", "Kaydedildi", () => save?.())} className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">{label(`payment-${item.id}`, "Kaydet")}</button>}<button onClick={() => window.location.reload()} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700">Vazgeç</button></div></div>)}{!visibleItems.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-5 text-sm text-slate-400">Bu müşteri için ödeme kaydı bulunamadı.</p>}</div></div>;
}

function CustomerTasksEditor({ company, content, setContent, save, items, notify, canManage = true }: any) {
  const allItems = content.agencyTasks || [];
  const { run, label } = useCustomerActionFeedback(notify);
  const [statusFilter, setStatusFilter] = useState("Tümü");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const update = (id, patch) => updateCollection(content, setContent, "agencyTasks", allItems.map((item) => item.id === id ? { ...item, ...patch } : item));
  const setStatus = (id, status) => updateCollection(content, setContent, "agencyTasks", allItems.map((item) => item.id === id ? stampTaskStatus(item, status) : item));
  const archive = (id) => update(id, { archived_at: new Date().toISOString() });
  const restore = (id) => update(id, { archived_at: null, deleted_at: null });
  const visibleItems = filterTasks(items, { status: statusFilter, startDate, endDate });
  function add() {
    updateCollection(content, setContent, "agencyTasks", [{ id: createLocalId(), company_id: company.id, title: "Yeni görev", description: "", status: "Yapılacak", priority: "Orta", due_date: new Date().toISOString().slice(0, 10), notes: "" }, ...allItems]);
    notify?.("✓ Görev taslağı oluşturuldu", "success");
  }
  return <div><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-slate-900">Yapılacaklar</h3><p className="mt-1 text-sm text-slate-400">Bu görevler Görevler modülü ve Dashboard operasyon özetleriyle eş zamanlıdır.</p></div>{canManage && <button onClick={add} className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">Görev Ekle</button>}</div><div className="mb-4 grid gap-3 md:grid-cols-4"><SelectField label="Durum filtresi" value={statusFilter} onChange={setStatusFilter} options={taskHistoryFilters} /><Field label="Başlangıç tarihi" type="date" value={startDate} onChange={setStartDate} /><Field label="Bitiş tarihi" type="date" value={endDate} onChange={setEndDate} /><button onClick={() => { setStatusFilter("Tümü"); setStartDate(""); setEndDate(""); }} className="self-end rounded-[8px] border border-slate-200 px-4 py-3 text-sm font-black text-slate-700">Filtreleri Temizle</button></div><div className="grid gap-3">{visibleItems.map((item) => <div key={item.id} className={`rounded-[8px] border p-4 ${isArchivedRecord(item) ? "border-amber-300/25 bg-amber-300/[0.06]" : "border-slate-200 bg-slate-50"}`}><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><Field label="Başlık" value={item.title || ""} onChange={(value) => update(item.id, { title: value })} /><SelectField label="Durum" value={item.status || "Yapılacak"} onChange={(value) => canManage && setStatus(item.id, value)} options={taskStatusOptions} /><SelectField label="Öncelik" value={item.priority || "Orta"} onChange={(value) => update(item.id, { priority: value })} options={["Düşük", "Orta", "Yüksek", "Kritik"]} /><Field label="Son tarih" type="date" value={item.due_date || ""} onChange={(value) => update(item.id, { due_date: value })} /><SelectField label="Atanan kullanıcı" value={item.assigned_user_id || ""} onChange={(value) => update(item.id, { assigned_user_id: value })} options={(content.users || []).map((user) => ({ value: user.id, label: user.full_name || user.email }))} placeholder="Atanmadı" /><InfoItem label="Tamamlanma tarihi" value={formatDateTime(item.completed_at)} /><InfoItem label="Oluşturulma tarihi" value={formatDateTime(item.created_at)} /><InfoItem label="Güncellenme tarihi" value={formatDateTime(item.updated_at)} /><div className="md:col-span-2 xl:col-span-3"><TextArea label="Açıklama / not" value={item.description || item.notes || ""} onChange={(value) => update(item.id, { description: value, notes: value })} /></div></div><div className="mt-4 flex flex-wrap justify-end gap-2">{canManage && (isArchivedRecord(item) ? <button onClick={() => restore(item.id)} className="rounded-full border border-amber-300/30 px-4 py-2 text-xs text-amber-700">Arşivden Çıkar</button> : <button onClick={() => archive(item.id)} className="rounded-full border border-amber-300/30 px-4 py-2 text-xs text-amber-700">Arşivle</button>)}{canManage && <button onClick={() => setStatus(item.id, item.status === "Tamamlandı" ? "Yapılacak" : "Tamamlandı")} className="rounded-full border border-emerald-300/30 px-4 py-2 text-xs text-emerald-700">{item.status === "Tamamlandı" ? "Tekrar Aç" : "Tamamlandı Yap"}</button>}{canManage && <button onClick={() => run(`task-${item.id}`, "Kaydediliyor...", "Kaydedildi", () => save?.())} className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">{label(`task-${item.id}`, "Kaydet")}</button>}<button onClick={() => window.location.reload()} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700">Vazgeç</button></div></div>)}{!visibleItems.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-5 text-sm text-slate-400">Bu müşteri için görev kaydı bulunamadı.</p>}</div></div>;
}

function ActivityLogs({ content, setContent }: any) {
  const [query, setQuery] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [action, setAction] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [criticalFilter, setCriticalFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [detailLog, setDetailLog] = useState(null);
  const activities = (content.activityLogs || [])
    .filter((item) => !item.deleted_at)
    .filter((item) => !query || JSON.stringify(item).toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")))
    .filter((item) => !userFilter || String(item.actor_name || item.user_name || item.email || item.role || "").toLocaleLowerCase("tr").includes(userFilter.toLocaleLowerCase("tr")))
    .filter((item) => !companyFilter || item.company_id === companyFilter || item.entity_id === companyFilter || JSON.stringify(item.details || {}).includes(companyFilter))
    .filter((item) => !moduleFilter || (item.module || item.entity || "").includes(moduleFilter))
    .filter((item) => !action || (item.action_type || item.action) === action)
    .filter((item) => !statusFilter || (item.status || (item.is_seen ? "Görüldü" : "Görülmedi")) === statusFilter)
    .filter((item) => !criticalFilter || String(Boolean(item.is_critical)) === criticalFilter)
    .filter((item) => !dateFrom || String(item.created_at || "").slice(0, 10) >= dateFrom)
    .filter((item) => !dateTo || String(item.created_at || "").slice(0, 10) <= dateTo)
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  const actionOptions = Array.from(new Set((content.activityLogs || []).map((item) => item.action_type || item.action).filter(Boolean)));
  const moduleOptions = Array.from(new Set((content.activityLogs || []).map((item) => item.module || item.entity).filter(Boolean)));
  function updateLogs(updater) {
    setContent({ ...content, activityLogs: (content.activityLogs || []).map((item) => updater(item)) });
  }
  function updateLog(id, patch) {
    updateLogs((item) => item.id === id ? { ...item, ...patch, updated_at: new Date().toISOString() } : item);
  }
  function bulk(patch) {
    updateLogs((item) => selectedIds.includes(item.id) ? { ...item, ...patch, updated_at: new Date().toISOString() } : item);
    setSelectedIds([]);
  }
  function toggleSelected(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  function undoLog(log) {
    const details = log.details || {};
    if (String(log.entity || "").includes("Görev") && details.taskId) {
      updateCollection(content, setContent, "agencyTasks", (content.agencyTasks || []).map((task) => task.id === details.taskId ? { ...task, status: "Yapılacak" } : task));
      updateLog(log.id, { status: "Geri Alındı", details: { ...details, undo_message: "Görev tekrar açıldı." } });
      return;
    }
    if (String(log.entity || "").includes("Belge") && details.documentId) {
      updateCollection(content, setContent, "customerDocuments", (content.customerDocuments || []).map((doc) => doc.id === details.documentId ? { ...doc, archived_at: null, status: "Aktif" } : doc));
      updateLog(log.id, { status: "Geri Alındı", details: { ...details, undo_message: "Belge arşivden çıkarıldı." } });
      return;
    }
    if (String(log.entity || "").includes("Müşteri") && log.entity_id) {
      updateCollection(content, setContent, "companies", (content.companies || []).map((company) => company.id === log.entity_id ? { ...company, status: "Aktif" } : company));
      updateLog(log.id, { status: "Geri Alındı", details: { ...details, undo_message: "Müşteri tekrar aktifleştirildi." } });
      return;
    }
    if (String(log.entity || "").includes("Kullanıcı") && log.entity_id) {
      updateCollection(content, setContent, "users", (content.users || []).map((user) => user.id === log.entity_id ? { ...user, is_active: true } : user));
      updateLog(log.id, { status: "Geri Alındı", details: { ...details, undo_message: "Kullanıcı tekrar aktifleştirildi." } });
    }
  }
  return (
    <Panel title="Aktivite Akışı">
      <p className="mb-5 text-sm leading-6 text-slate-400">Yönetici ve müşteri işlemlerini en yeniden eskiye tarih, kullanıcı, müşteri, modül, işlem türü, durum ve kritiklik durumuna göre inceleyin. Değişiklikleri üst menüdeki Kaydet düğmesiyle kalıcılaştırın.</p>
      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Kullanıcı veya işlem ara..." className="min-h-11 rounded-[8px] border border-slate-200 bg-slate-50 px-3 text-slate-900" />
        <Field label="Kullanıcı" value={userFilter} onChange={setUserFilter} placeholder="Kullanıcı adı / rol" />
        <CompanySelect value={companyFilter} onChange={setCompanyFilter} companies={content.companies} />
        <SelectField label="Modül" value={moduleFilter} onChange={setModuleFilter} options={moduleOptions} placeholder="Tüm modüller" />
        <SelectField label="İşlem Türü" value={action} onChange={setAction} options={actionOptions.length ? actionOptions : ["Giriş", "Oluşturma", "Güncelleme", "Silme", "İçe Aktarma", "Dışa Aktarma", "Şifre Sıfırlama", "Görüntüleme", "İndirme", "Dönüştürme"]} placeholder="Tüm işlemler" />
        <SelectField label="Durum" value={statusFilter} onChange={setStatusFilter} options={["Görülmedi", "Görüldü", "Arşivlendi", "Silindi", "Geri Alındı"]} placeholder="Tüm durumlar" />
        <SelectField label="Kritik" value={criticalFilter} onChange={setCriticalFilter} options={[{ value: "true", label: "Kritik" }, { value: "false", label: "Normal" }]} placeholder="Tümü" />
        <Field label="Başlangıç tarihi" type="date" value={dateFrom} onChange={setDateFrom} />
        <Field label="Bitiş tarihi" type="date" value={dateTo} onChange={setDateTo} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button disabled={!selectedIds.length} onClick={() => bulk({ is_seen: true, status: "Görüldü" })} className="rounded-full border border-emerald-300/30 px-3 py-2 text-xs text-emerald-700 disabled:opacity-40">Toplu Görüldü Yap</button>
        <button disabled={!selectedIds.length} onClick={() => bulk({ archived_at: new Date().toISOString(), status: "Arşivlendi" })} className="rounded-full border border-amber-300/30 px-3 py-2 text-xs text-amber-700 disabled:opacity-40">Toplu Arşivle</button>
        <button disabled={!selectedIds.length} onClick={() => confirm("Seçili logları silmek istediğinize emin misiniz?") && bulk({ deleted_at: new Date().toISOString(), status: "Silindi" })} className="rounded-full border border-red-300/30 px-3 py-2 text-xs text-red-200 disabled:opacity-40">Toplu Sil</button>
      </div>
      <ActivityList items={activities} empty="Seçilen filtrelere uygun hareket kaydı yok." selectedIds={selectedIds} toggleSelected={toggleSelected} updateLog={updateLog} openDetail={setDetailLog} undoLog={undoLog} />
      {detailLog && <Drawer title="Log Detayı" close={() => setDetailLog(null)}><div className="grid gap-3 md:grid-cols-2"><InfoItem label="Kullanıcı" value={detailLog.actor_name || detailLog.user_name || "Sistem"} /><InfoItem label="Tarih" value={formatDateTime(detailLog.created_at)} /><InfoItem label="Modül" value={detailLog.module || detailLog.entity || "-"} /><InfoItem label="İşlem" value={detailLog.action_type || detailLog.action || "-"} /><InfoItem label="Eski Değer" value={JSON.stringify(detailLog.old_value || detailLog.details?.old_value || detailLog.details?.oldValue || {}, null, 2)} /><InfoItem label="Yeni Değer" value={JSON.stringify(detailLog.new_value || detailLog.details?.new_value || detailLog.details?.newValue || {}, null, 2)} /><div className="md:col-span-2"><InfoItem label="Ek Bilgi" value={JSON.stringify(detailLog.details || {}, null, 2)} /></div></div></Drawer>}
    </Panel>
  );
}

function ActivityList({ items, empty, selectedIds = [], toggleSelected, updateLog, openDetail, undoLog }: any) {
  return <div className="grid gap-3">{items.map((item) => {
    const status = item.status || (item.is_seen ? "Görüldü" : "Görülmedi");
    const canUndo = String(item.entity || "").includes("Görev") || String(item.entity || "").includes("Belge") || String(item.entity || "").includes("Müşteri") || String(item.entity || "").includes("Kullanıcı");
    return <div key={item.id} className={`rounded-[8px] border p-4 ${item.archived_at ? "border-amber-300/20 bg-amber-300/5" : "border-slate-200 bg-slate-50"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 gap-3">{toggleSelected && <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelected(item.id)} className="mt-1" />}<div><p className="font-black text-slate-900">{item.details?.message || `${item.entity} · ${item.action}`}</p><p className="mt-1 text-sm text-slate-400">{item.actor_name || "Sistem"} · {roleOptions.find((role) => role.value === item.role)?.label || item.role || "Sistem"} · {item.module || item.entity}</p><p className="mt-3 text-xs text-slate-500">{formatDateTime(item.created_at)}</p></div></div><div className="flex flex-wrap justify-end gap-2"><span className="rounded-full bg-cyan-200/10 px-3 py-1 text-xs font-bold text-cyan-700">{item.action_type || item.action}</span><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-700">{status}</span>{item.is_critical && <span className="rounded-full bg-red-300/15 px-3 py-1 text-xs font-bold text-red-100">Kritik</span>}</div></div>{updateLog && <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => updateLog(item.id, { is_seen: true, status: "Görüldü" })} className="rounded-full border border-emerald-300/30 px-3 py-2 text-xs text-emerald-700">Görüldü Yap</button><button onClick={() => updateLog(item.id, { is_seen: false, status: "Görülmedi" })} className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-700">Görülmedi Yap</button><button onClick={() => updateLog(item.id, { archived_at: new Date().toISOString(), status: "Arşivlendi" })} className="rounded-full border border-amber-300/30 px-3 py-2 text-xs text-amber-700">Arşivle</button><button onClick={() => confirm("Bu log kaydını silmek istediğinize emin misiniz?") && updateLog(item.id, { deleted_at: new Date().toISOString(), status: "Silindi" })} className="rounded-full border border-red-300/30 px-3 py-2 text-xs text-red-200">Sil</button>{canUndo && <button onClick={() => undoLog?.(item)} className="rounded-full border border-cyan-300/30 px-3 py-2 text-xs text-cyan-700">Geri Al</button>}<button onClick={() => openDetail?.(item)} className="ml-auto rounded-full bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950">Detay</button></div>}</div>;
  })}{!items.length && <p className="text-sm text-slate-400">{empty}</p>}</div>;
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

function AdAccountMappingCenter({ content, setContent, save, notify }: any) {
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [expandedCompanyId, setExpandedCompanyId] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState<any[]>([]);
  const [mappingDrafts, setMappingDrafts] = useState<Record<string, any>>({});
  const [pulledCampaigns, setPulledCampaigns] = useState<any[]>([]);
  const [matching, setMatching] = useState<Record<string, string>>({});
  const links = content.metaAccountLinks || [];
  async function loadLogs() {
    const response = await fetch("/api/admin/integration-settings?mappings=1", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    setLogs(data.logs || []);
    const nextDrafts = { ...mappingDrafts };
    (data.mappings || []).forEach((item: any) => {
      if (!item.companyId) return;
      const current = nextDrafts[item.companyId] || {};
      nextDrafts[item.companyId] = item.provider === "meta"
        ? { ...current, metaBusinessId: item.businessId || "", metaAdAccountId: item.adAccountId || item.accountId || "", facebookPageId: item.pageId || "", instagramAccountId: item.instagramAccountId || "", metaStatus: item.status || "", metaLastSync: item.lastSyncAt || "" }
        : { ...current, googleAdsCustomerId: item.googleCustomerId || item.adAccountId || item.accountId || "", googleAnalyticsId: item.googleAnalyticsId || "", googleMccId: item.mccId || "", googleStatus: item.status || "", googleLastSync: item.lastSyncAt || "" };
    });
    setMappingDrafts(nextDrafts);
  }
  useEffect(() => { loadLogs(); }, []);
  function draftFor(companyId: string) {
    const link = links.find((item: any) => item.company_id === companyId) || {};
    return {
      metaBusinessId: link.business_id || "",
      metaAdAccountId: link.ad_account_id || "",
      facebookPageId: link.page_id || "",
      instagramAccountId: link.instagram_account_id || "",
      googleAdsCustomerId: link.google_ads_customer_id || "",
      googleAnalyticsId: link.google_analytics_id || "",
      googleMccId: link.mcc_id || "",
      metaStatus: link.status || "",
      googleStatus: link.google_status || "",
      metaLastSync: link.last_sync_at || "",
      googleLastSync: link.google_last_sync_at || "",
      ...(mappingDrafts[companyId] || {})
    };
  }
  const rows = (content.companies || []).map((company: any) => {
    const draft = draftFor(company.id);
    const link = {
      company_id: company.id,
      business_id: draft.metaBusinessId,
      ad_account_id: draft.metaAdAccountId,
      page_id: draft.facebookPageId,
      instagram_account_id: draft.instagramAccountId,
      google_ads_customer_id: draft.googleAdsCustomerId,
      google_analytics_id: draft.googleAnalyticsId,
      mcc_id: draft.googleMccId,
      status: draft.metaStatus,
      google_status: draft.googleStatus,
      last_sync_at: draft.metaLastSync,
      google_last_sync_at: draft.googleLastSync
    };
    const metrics = (content.campaignMetrics || []).filter((metric: any) => metric.company_id === company.id && ["Meta API", "Google Ads Sync", "Meta Import"].includes(metric.source));
    const lastMetric = metrics.sort((a: any, b: any) => Number(new Date(b.date || b.created_at || 0)) - Number(new Date(a.date || a.created_at || 0)))[0];
    return { company, link, lastMetric, draft };
  });
  function demoCampaigns(companyId: string) {
    const existing = (content.campaignMetrics || []).filter((metric: any) => metric.company_id === companyId && (metric.campaignName || metric.campaign_name || metric.campaign_id));
    if (existing.length) return metaCampaignSummaries(existing).map((item: any) => ({ ...item, lastUpdate: new Date().toISOString(), source: "Meta" }));
    return [
      { campaignId: `demo-meta-${companyId}-1`, campaignName: "Meta Lead Kampanyası", status: "Aktif", spend: 8500, impressions: 42200, reach: 31800, clicks: 540, ctr: 1.28, cpc: 15.74, cpm: 201.42, results: 42, lastUpdate: new Date().toISOString(), source: "Meta Demo" },
      { campaignId: `demo-meta-${companyId}-2`, campaignName: "Remarketing Mesaj Kampanyası", status: "Aktif", spend: 3200, impressions: 15800, reach: 9100, clicks: 210, ctr: 1.33, cpc: 15.24, cpm: 202.53, results: 27, lastUpdate: new Date().toISOString(), source: "Meta Demo" }
    ];
  }
  function openMapping(companyId: string) {
    setSelectedCompanyId(companyId);
    setPulledCampaigns(demoCampaigns(companyId));
    setModalOpen(true);
  }
  function updateDraft(companyId: string, patch: any) {
    setMappingDrafts((current) => ({ ...current, [companyId]: { ...draftFor(companyId), ...current[companyId], ...patch } }));
  }
  function updateLink(companyId: string, draftPatch: any = {}) {
    const draft = { ...draftFor(companyId), ...draftPatch };
    const current = links.find((item: any) => item.company_id === companyId) || { id: createLocalId(), company_id: companyId };
    const next = {
      ...current,
      company_id: companyId,
      business_id: draft.metaBusinessId,
      ad_account_id: draft.metaAdAccountId,
      page_id: draft.facebookPageId,
      instagram_account_id: draft.instagramAccountId,
      google_ads_customer_id: draft.googleAdsCustomerId,
      google_analytics_id: draft.googleAnalyticsId,
      mcc_id: draft.googleMccId,
      status: draft.metaStatus || current.status,
      google_status: draft.googleStatus || current.google_status,
      last_sync_at: draft.metaLastSync || current.last_sync_at,
      google_last_sync_at: draft.googleLastSync || current.google_last_sync_at,
      updated_at: new Date().toISOString()
    };
    setContent({ ...content, metaAccountLinks: [next, ...links.filter((item: any) => item.company_id !== companyId)] });
    return next;
  }
  async function persistCustomerMapping(companyId: string, action = "save") {
    setLoading(`${action}-${companyId}`);
    const draft = draftFor(companyId);
    const requests: Promise<Response>[] = [];
    if (draft.metaBusinessId || draft.metaAdAccountId || draft.facebookPageId || draft.instagramAccountId) {
      requests.push(fetch("/api/admin/integration-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "mapping", provider: "meta", action, companyId, businessId: draft.metaBusinessId, adAccountId: draft.metaAdAccountId, pageId: draft.facebookPageId, instagramAccountId: draft.instagramAccountId, accountName: draft.metaAdAccountId }) }));
    }
    if (draft.googleAdsCustomerId || draft.googleAnalyticsId || draft.googleMccId) {
      requests.push(fetch("/api/admin/integration-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "mapping", provider: "google", action, companyId, googleCustomerId: draft.googleAdsCustomerId, googleAnalyticsId: draft.googleAnalyticsId, mccId: draft.googleMccId, accountName: draft.googleAdsCustomerId }) }));
    }
    if (!requests.length) {
      setLoading("");
      notify?.("⚠ Kaydedilecek reklam hesabı alanı yok", "warning");
      return;
    }
    const results = await Promise.all(requests);
    const failed = results.find((result) => !result.ok);
    if (failed) {
      setLoading("");
      notify?.("✖ Reklam hesabı eşleştirmesi kaydedilemedi", "error");
      return;
    }
    updateLink(companyId, {
      metaStatus: action === "test" ? "Test edildi" : action === "sync" ? "Senkronize edildi" : "Kaydedildi",
      googleStatus: action === "test" ? "Test edildi" : action === "sync" ? "Senkronize edildi" : "Kaydedildi",
      metaLastSync: action === "sync" ? new Date().toISOString() : draft.metaLastSync,
      googleLastSync: action === "sync" ? new Date().toISOString() : draft.googleLastSync
    });
    notify?.(action === "test" ? "✓ Test tamamlandı" : action === "sync" ? "✓ Senkronizasyon kaydı tamamlandı" : "✓ Reklam hesabı eşleştirmesi kaydedildi", "success");
    setLoading("");
    loadLogs().catch(() => null);
  }
  async function syncCompany(companyId: string, source = "Meta") {
    setLoading(`sync-${companyId}`);
    await persistCustomerMapping(companyId);
    const draft = draftFor(companyId);
    if (source === "Meta" && draft.metaAdAccountId) {
      const response = await fetch("/api/admin/meta-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "advanced_sync", companyId, adAccountId: draft.metaAdAccountId, businessId: draft.metaBusinessId, pageId: draft.facebookPageId, instagramAccountId: draft.instagramAccountId, visibleToCustomer: true })
      });
      const data = await response.json().catch(() => ({}));
      if (data.ok) {
        const metricRows = (data.rows || []).map((row: any, index: number) => ({ id: `meta-mapping-${companyId}-${Date.now()}-${index}`, company_id: companyId, date: row.date, period: data.range?.label || "Meta Sync", source: "Meta API", visible_to_customer: true, ...row }));
        const next = {
          ...content,
          campaignMetrics: [...metricRows, ...(content.campaignMetrics || [])],
          metaAdsetMetrics: [...(data.advanced?.adsets || []), ...(content.metaAdsetMetrics || [])],
          metaAdMetrics: [...(data.advanced?.ads || []), ...(content.metaAdMetrics || [])],
          metaConversionEvents: [...(data.advanced?.conversions || []), ...(content.metaConversionEvents || [])],
          metaAnalysisSnapshots: data.advanced?.analysis ? [data.advanced.analysis, ...(content.metaAnalysisSnapshots || [])] : (content.metaAnalysisSnapshots || [])
        };
        setContent(next);
        setMessage(data.message || "Tamamlandı ✓");
        notify?.(data.warnings?.length ? "⚠ Meta verileri çekildi, bazı gruplar eksik" : "✓ Meta senkronizasyonu tamamlandı", data.warnings?.length ? "warning" : "success");
        setLoading("");
        return;
      }
      notify?.(`✖ ${data.message || data.errorMessage || "Meta verisi alınamadı."}`, "error");
      setLoading("");
      return;
    }
    const campaigns = demoCampaigns(companyId);
    setPulledCampaigns(campaigns);
    const metricRows = campaigns.map((campaign: any) => ({ id: createLocalId(), company_id: companyId, date: new Date().toISOString().slice(0, 10), source: source === "Google" ? "Google Ads Sync" : "Meta API", campaign_id: matching[campaign.campaignId] || "", campaignName: campaign.campaignName, impressions: campaign.impressions || 0, reach: campaign.reach || 0, clicks: campaign.clicks || 0, leads: campaign.results || 0, spent: campaign.spend || 0, ctr: campaign.ctr || 0, cpc: campaign.cpc || 0, cpm: campaign.cpm || 0, visible_to_customer: true, notes: "Reklam hesabı eşleştirme merkezinden içe aktarıldı." }));
    const log = { id: createLocalId(), provider: source.toLocaleLowerCase("tr"), company_id: companyId, source: "Reklam Hesabı Eşleştirme", result: "Başarılı", message: `${source} kampanya verileri içe aktarıldı.`, created_at: new Date().toISOString() };
    const next = { ...content, campaignMetrics: [...metricRows, ...(content.campaignMetrics || [])], activityLogs: [log, ...(content.activityLogs || [])] };
    setContent(next);
    save?.(next);
    setMessage("Tamamlandı ✓");
    notify?.("✓ Senkronizasyon tamamlandı", "success");
    setLoading("");
    setTimeout(() => setMessage(""), 2000);
  }
  function importCampaign(metaCampaign: any, existingId = "") {
    setLoading(`import-${metaCampaign.campaignId}`);
    const companyId = selectedCompanyId;
    const campaignPatch = { company_id: companyId, meta_campaign_id: metaCampaign.campaignId, name: metaCampaign.campaignName, platform: "Meta Ads", status: metaCampaign.status || "Aktif", spent_budget: Number(metaCampaign.spend || 0), spent: Number(metaCampaign.spend || 0), total_budget: Number(metaCampaign.spend || 0), budget: Number(metaCampaign.spend || 0), start_date: new Date().toISOString().slice(0, 10), notes: "Meta verilerinden içe aktarıldı.", visible_to_customer: true, updated_at: new Date().toISOString() };
    const campaigns = content.campaigns || [];
    const newCampaign = existingId ? campaigns.map((item: any) => item.id === existingId ? { ...item, ...campaignPatch } : item) : [{ id: createLocalId(), ...campaignPatch }, ...campaigns];
    const targetId = existingId || newCampaign[0].id;
    const metric = { id: createLocalId(), company_id: companyId, campaign_id: targetId, date: new Date().toISOString().slice(0, 10), source: "Meta API", campaignName: metaCampaign.campaignName, impressions: metaCampaign.impressions || 0, reach: metaCampaign.reach || 0, clicks: metaCampaign.clicks || 0, leads: metaCampaign.results || 0, spent: metaCampaign.spend || 0, ctr: metaCampaign.ctr || 0, cpc: metaCampaign.cpc || 0, cpm: metaCampaign.cpm || 0, visible_to_customer: true, notes: "Meta Verilerini İçeri Aktar ile oluşturuldu." };
    const log = { id: createLocalId(), provider: "meta", company_id: companyId, source: "Kampanya Eşleştirme", result: "Başarılı", message: `${metaCampaign.campaignName} kampanyası içe aktarıldı.`, created_at: new Date().toISOString() };
    const next = { ...content, campaigns: newCampaign, campaignMetrics: [metric, ...(content.campaignMetrics || [])], activityLogs: [log, ...(content.activityLogs || [])] };
    setContent(next);
    save?.(next);
    notify?.("✓ İçe Aktarıldı", "success");
    setLoading("");
  }
  return (
    <Panel title="Reklam Hesabı Eşleştirme">
      <p className="mb-5 text-sm leading-6 text-slate-600">Meta ve Google reklam hesaplarını merkezi olarak müşterilerle eşleştirin, kampanyaları mevcut kayıtlara bağlayın veya yeni kampanya oluşturun.</p>
      {message && <p className="mb-4 rounded-[8px] border border-emerald-300/25 bg-emerald-300/10 p-3 text-sm font-bold text-emerald-700">{message}</p>}
      <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
        <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 text-xs font-black uppercase tracking-[.12em] text-slate-600 md:grid-cols-[1.2fr_1fr_1fr_1fr_1.2fr]"><span>Müşteri</span><span>Meta Ads Account ID</span><span>Google Ads Customer ID</span><span>Son Sync</span><span>Durum / Aksiyon</span></div>
        <div className="grid gap-2 p-3">
          {rows.map(({ company, link, lastMetric, draft }: any) => <div key={company.id} className="rounded-[10px] border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_1fr_1.2fr] md:items-center">
              <div><p className="font-black text-slate-900">{company.name}</p><p className="text-xs text-slate-600">{company.sector || "Sektör yok"}</p></div>
              <span className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">{link.ad_account_id || "Eklenmedi"}</span>
              <span className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">{link.google_ads_customer_id || "Eklenmedi"}</span>
              <div><p className="text-slate-700">{formatDateTime(link.last_sync_at || link.google_last_sync_at || lastMetric?.date)}</p><p className="mt-1 text-xs text-slate-600">{lastMetric?.source || link.status || link.google_status || "Veri bekleniyor"}</p></div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => openMapping(company.id)} className="rounded-full bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950">Eşleştir</button>
                <button onClick={() => setExpandedCompanyId(expandedCompanyId === company.id ? "" : company.id)} className="rounded-full border border-cyan-200/25 px-3 py-2 text-xs text-cyan-700">Detay / Düzenle</button>
                <button disabled={loading === `save-${company.id}`} onClick={() => persistCustomerMapping(company.id)} className="rounded-full border border-cyan-200/25 px-3 py-2 text-xs text-cyan-700">{loading === `save-${company.id}` ? "Kaydediliyor..." : "Kaydet"}</button>
                <button disabled={loading === `test-${company.id}`} onClick={() => persistCustomerMapping(company.id, "test")} className="rounded-full border border-emerald-300/25 px-3 py-2 text-xs text-emerald-700">{loading === `test-${company.id}` ? "Test ediliyor..." : "Test Et"}</button>
                <button disabled={loading === `sync-${company.id}`} onClick={() => syncCompany(company.id)} className="rounded-full border border-amber-300/25 px-3 py-2 text-xs text-amber-700">{loading === `sync-${company.id}` ? "Senkronize Ediliyor..." : "Senkronize Et"}</button>
              </div>
            </div>
            {expandedCompanyId === company.id && <div className="mt-4 grid gap-4 rounded-[14px] border border-cyan-200/20 bg-slate-50 p-4 xl:grid-cols-2">
              <div>
                <h3 className="font-black text-slate-900">Meta Bilgileri</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div><Field label="Meta Business ID" value={draft.metaBusinessId || ""} onChange={(metaBusinessId) => updateDraft(company.id, { metaBusinessId })} /><p className="mt-1 text-xs text-slate-600">Meta Business Manager içindeki işletme ID’si.</p></div>
                  <div><Field label="Meta Ads Account ID" value={draft.metaAdAccountId || ""} onChange={(metaAdAccountId) => updateDraft(company.id, { metaAdAccountId })} /><p className="mt-1 text-xs text-slate-600">Meta reklam hesabı ID’si. Örn: act_123456789 veya 123456789</p></div>
                  <div><Field label="Facebook Sayfa ID" value={draft.facebookPageId || ""} onChange={(facebookPageId) => updateDraft(company.id, { facebookPageId })} /><p className="mt-1 text-xs text-slate-600">Facebook sayfası ID’si.</p></div>
                  <div><Field label="Instagram Hesap ID" value={draft.instagramAccountId || ""} onChange={(instagramAccountId) => updateDraft(company.id, { instagramAccountId })} /><p className="mt-1 text-xs text-slate-600">Instagram işletme hesabı ID’si.</p></div>
                </div>
              </div>
              <div>
                <h3 className="font-black text-slate-900">Google Bilgileri</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div><Field label="Google Ads Customer ID" value={draft.googleAdsCustomerId || ""} onChange={(googleAdsCustomerId) => updateDraft(company.id, { googleAdsCustomerId })} /><p className="mt-1 text-xs text-slate-600">Google Ads müşteri ID’si.</p></div>
                  <div><Field label="Google Analytics ID" value={draft.googleAnalyticsId || ""} onChange={(googleAnalyticsId) => updateDraft(company.id, { googleAnalyticsId })} /><p className="mt-1 text-xs text-slate-600">GA4 Measurement ID veya Analytics property ID.</p></div>
                  <div><Field label="Google MCC ID" value={draft.googleMccId || ""} onChange={(googleMccId) => updateDraft(company.id, { googleMccId })} /><p className="mt-1 text-xs text-slate-600">Google Ads yönetici hesabı ID’si.</p></div>
                  <InfoItem label="Durum" value={`${draft.metaStatus || "Meta bekliyor"} · ${draft.googleStatus || "Google bekliyor"}`} />
                </div>
              </div>
              <div className="xl:col-span-2 rounded-[12px] border border-slate-200 bg-white p-3">
                <p className="mb-3 text-xs font-black uppercase tracking-[.14em] text-slate-500">Gelişmiş Meta Sync Kontrolleri</p>
                <div className="flex flex-wrap gap-2">
                  {["Temel verileri çek", "Tüm verileri çek", "Kreatifleri çek", "Kırılımları çek", "Dönüşümleri çek", "Video verilerini çek"].map((label) => (
                    <button key={label} disabled={loading === `sync-${company.id}`} onClick={() => syncCompany(company.id, "Meta")} className="rounded-full bg-blue-600 px-3 py-2 text-xs font-black text-white disabled:opacity-60">{loading === `sync-${company.id}` ? "Senkronize Ediliyor..." : label}</button>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">Yetki olmayan veri grupları hata üretmeden uyarı olarak senkronizasyon geçmişine yazılır.</p>
              </div>
            </div>}
          </div>)}
        </div>
      </div>
      <div className="mt-5 rounded-[18px] border border-slate-200 bg-slate-50 p-4"><h3 className="font-black text-slate-900">Senkronizasyon Geçmişi</h3><div className="mt-3 grid gap-2">{[...(logs || []), ...(content.activityLogs || []).filter((log: any) => String(log.source || log.entity || "").includes("Reklam"))].slice(0, 10).map((log: any, index: number) => <div key={log.id || index} className="grid gap-2 rounded-[8px] border border-slate-200 p-3 text-sm md:grid-cols-[160px_160px_1fr_120px]"><span className="text-slate-600">{formatDateTime(log.created_at)}</span><span className="text-cyan-700">{companyName(content, log.company_id) || log.provider || "-"}</span><span className="text-slate-600">{log.message || log.action || log.source || "-"}</span><span className={`${log.result === "Başarılı" ? "text-emerald-700" : log.result === "Hata" ? "text-red-100" : "text-amber-700"}`}>{log.result || log.status || "Uyarı"}</span></div>)}{!logs.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-4 text-sm text-slate-400">Henüz senkronizasyon geçmişi yok.</p>}</div></div>
      {modalOpen && <div className="fixed inset-0 z-[120] grid place-items-center bg-white/70 p-4" onClick={() => setModalOpen(false)}><div className="max-h-[88vh] w-full max-w-5xl overflow-auto rounded-[22px] border border-slate-200 bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Kampanya Eşleştirme</p><h3 className="mt-1 text-2xl font-black text-slate-900">{companyName(content, selectedCompanyId)}</h3><p className="mt-1 text-sm text-slate-600">Step 1: müşteri seçildi. Step 2: Meta kampanyalarını mevcut kampanyaya bağlayın veya yeni kampanya oluşturun.</p></div><button onClick={() => setModalOpen(false)} className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700">Kapat</button></div><CompanySelect label="Müşteri" value={selectedCompanyId} onChange={(companyId) => { setSelectedCompanyId(companyId); setPulledCampaigns(demoCampaigns(companyId)); }} companies={content.companies} /><div className="mt-5 grid gap-3">{pulledCampaigns.map((campaign: any) => <div key={campaign.campaignId} className="rounded-[12px] border border-slate-200 bg-slate-50 p-4"><div className="grid gap-3 md:grid-cols-[1fr_120px_120px_160px] md:items-center"><div><p className="font-black text-slate-900">{campaign.campaignName}</p><p className="mt-1 text-xs text-slate-400">{campaign.status} · Son güncelleme: {formatDateTime(campaign.lastUpdate)}</p></div><span className="text-sm text-slate-700">{Number(campaign.spend || 0).toLocaleString("tr-TR")} TL</span><span className="text-sm text-slate-700">{Number(campaign.ctr || 0).toFixed(2)}% CTR</span><SelectField label="Mevcut kampanya" value={matching[campaign.campaignId] || ""} onChange={(value) => setMatching({ ...matching, [campaign.campaignId]: value })} options={(content.campaigns || []).filter((item: any) => item.company_id === selectedCompanyId).map((item: any) => ({ value: item.id, label: item.name }))} placeholder="Yeni oluştur" /></div><div className="mt-3 flex flex-wrap gap-2"><button disabled={loading === `import-${campaign.campaignId}`} onClick={() => importCampaign(campaign, matching[campaign.campaignId])} className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">{loading === `import-${campaign.campaignId}` ? "İçe Aktarılıyor..." : matching[campaign.campaignId] ? "Mevcut Kampanyayı Güncelle" : "➕ Yeni Kampanya Oluştur"}</button><button disabled={loading === `import-${campaign.campaignId}`} onClick={() => importCampaign(campaign, matching[campaign.campaignId])} className="rounded-full border border-emerald-300/30 px-4 py-2 text-xs font-black text-emerald-700">{loading === `import-${campaign.campaignId}` ? "İçe Aktarılıyor..." : "Meta Verilerini İçeri Aktar"}</button></div></div>)}</div></div></div>}
    </Panel>
  );
}

function CampaignAdmin({ content, setContent, currentSession, notify }: any) {
  const campaigns = content.campaigns || [];
  const [statusFilter, setStatusFilter] = useState("Tüm kampanyalar");
  const [companyFilter, setCompanyFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const canManage = canManageRecord(currentSession, "kampanyalar");
  const campaignTabs = ["Tüm kampanyalar", "Aktif kampanyalar", "Planlanan kampanyalar", "Tamamlanan kampanyalar", "Durdurulan kampanyalar", "Arşivlenen kampanyalar"];
  const filteredCampaigns = filterCampaigns(campaigns, { status: statusFilter, companyId: companyFilter, platform: platformFilter, startDate, endDate });
  const activeCampaigns = campaigns.filter((item) => !isCampaignArchived(item) && item.status === "Aktif");
  const plannedCampaigns = campaigns.filter((item) => !isCampaignArchived(item) && item.status === "Planlandı");
  const completedThisMonth = campaigns.filter((item) => !isCampaignArchived(item) && item.status === "Tamamlandı" && String(item.end_date || "").startsWith(new Date().toISOString().slice(0, 7)));
  const visibleCampaigns = campaigns.filter((item) => !isCampaignArchived(item) && item.visible_to_customer);
  const totalSpend = campaigns.filter((item) => !isCampaignArchived(item)).reduce((sum, item) => sum + Number(item.spent_budget ?? item.spent ?? 0), 0);
  const update = (id, patch, message = "") => {
    setContent({ ...content, campaigns: campaigns.map((item) => item.id === id ? { ...item, ...patch, updated_at: new Date().toISOString() } : item) });
    if (message) notify?.(`✓ ${message}`, "success");
  };
  const add = () => setContent({ ...content, campaigns: [{ id: createLocalId(), company_id: (content.companies || [])[0]?.id || "", name: "Yeni Kampanya", platform: "Meta Ads", objective: "Lead", status: "Planlandı", start_date: new Date().toISOString().slice(0, 10), end_date: "", daily_budget: 0, total_budget: 0, spent_budget: 0, budget: 0, spent: 0, notes: "", internal_notes: "", visible_to_customer: false }, ...campaigns] });
  const copyCampaign = (campaign) => setContent({ ...content, campaigns: [{ ...campaign, id: createLocalId(), name: `${campaign.name || "Kampanya"} Kopya`, status: "Planlandı", archived_at: null, deleted_at: null, visible_to_customer: false }, ...campaigns] });
  const archiveCampaign = (campaign) => {
    if (!confirm("Bu kampanyayı silmek/arşivlemek istediğinize emin misiniz?")) return;
    update(campaign.id, { archived_at: new Date().toISOString(), status: "Arşivlendi" }, "Kampanya arşivlendi");
  };
  return (
    <Panel title="Kampanyalar">
      <div className="mb-5 grid gap-3 md:grid-cols-5">
        <AgencyStatCard label="Aktif kampanyalar" value={activeCampaigns.length} note="Yayında veya operasyonel" />
        <AgencyStatCard label="Planlanan" value={plannedCampaigns.length} note="Kurulum bekleyen" tone="amber" />
        <AgencyStatCard label="Bu ay biten" value={completedThisMonth.length} note="Tamamlanan kampanyalar" tone="emerald" />
        <AgencyStatCard label="Toplam harcama" value={`${totalSpend.toLocaleString("tr-TR")} TL`} note="Kayıtlı kampanya harcaması" />
        <AgencyStatCard label="Müşteriye görünür" value={visibleCampaigns.length} note="Panelde gösterilen" tone="emerald" />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {canManage && <button onClick={add} className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950"><Plus size={16} /> Kampanya Ekle</button>}
        <span className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600">{filteredCampaigns.length} kampanya listeleniyor</span>
      </div>
      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SelectField label="Liste" value={statusFilter} onChange={setStatusFilter} options={campaignTabs} />
        <CompanySelect value={companyFilter} onChange={setCompanyFilter} companies={content.companies} />
        <SelectField label="Platform" value={platformFilter} onChange={setPlatformFilter} options={platformOptions} placeholder="Tüm platformlar" />
        <Field label="Başlangıç tarihi" type="date" value={startDate} onChange={setStartDate} />
        <Field label="Bitiş tarihi" type="date" value={endDate} onChange={setEndDate} />
      </div>
      <div className="grid gap-4">
        {filteredCampaigns.map((campaign) => {
          const archived = isCampaignArchived(campaign);
          const totalBudget = campaign.total_budget ?? campaign.budget ?? 0;
          const spentBudget = campaign.spent_budget ?? campaign.spent ?? 0;
          return (
            <div key={campaign.id} className={`rounded-[8px] border p-4 ${archived ? "border-amber-300/25 bg-amber-300/[0.06]" : "border-slate-200 bg-slate-50"}`}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">{campaign.platform || "Platform"}</p>
                  <h3 className="mt-1 text-xl font-black text-slate-900">{campaign.name || "İsimsiz kampanya"}</h3>
                  <p className="mt-1 text-sm text-slate-400">{companyName(content, campaign.company_id)} · {campaign.objective || "Amaç yok"} · {campaign.status || "Planlandı"}</p>
                </div>
                <span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-xs font-black text-cyan-700">{campaign.visible_to_customer ? "Müşteri Panelinde Görünür" : "Sadece Yönetici"}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <CompanySelect value={campaign.company_id || ""} onChange={(v) => update(campaign.id, { company_id: v })} companies={content.companies} />
                <Field label="Kampanya adı" value={campaign.name} onChange={(v) => update(campaign.id, { name: v })} />
                <SelectField label="Platform" value={campaign.platform || "Meta Ads"} onChange={(v) => update(campaign.id, { platform: v })} options={platformOptions} />
                <SelectField label="Amaç" value={campaign.objective || "Lead"} onChange={(v) => update(campaign.id, { objective: v })} options={objectiveOptions} />
                <SelectField label="Durum" value={campaign.status || "Planlandı"} onChange={(v) => update(campaign.id, { status: v, archived_at: v === "Arşivlendi" ? new Date().toISOString() : campaign.archived_at })} options={campaignStatusOptions} />
                <Field label="Başlangıç tarihi" type="date" value={campaign.start_date} onChange={(v) => update(campaign.id, { start_date: v })} />
                <Field label="Bitiş tarihi" type="date" value={campaign.end_date} onChange={(v) => update(campaign.id, { end_date: v })} />
                <Field label="Günlük bütçe" type="number" value={campaign.daily_budget || 0} onChange={(v) => update(campaign.id, { daily_budget: Number(v || 0) })} />
                <Field label="Toplam bütçe" type="number" value={totalBudget} onChange={(v) => update(campaign.id, { total_budget: Number(v || 0), budget: Number(v || 0) })} />
                <Field label="Harcanan bütçe" type="number" value={spentBudget} onChange={(v) => update(campaign.id, { spent_budget: Number(v || 0), spent: Number(v || 0) })} />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(campaign.visible_to_customer)} onChange={(e) => update(campaign.id, { visible_to_customer: e.target.checked })} /> Müşteriye görünür mü?</label>
                <InfoItem label="Oluşturulma / Güncelleme" value={`${formatDateTime(campaign.created_at)} · ${formatDateTime(campaign.updated_at)}`} />
                <div className="md:col-span-2"><TextArea label="Notlar" value={campaign.notes} onChange={(v) => update(campaign.id, { notes: v })} /></div>
                <div className="md:col-span-2"><TextArea label="Dahili notlar" value={campaign.internal_notes} onChange={(v) => update(campaign.id, { internal_notes: v })} /></div>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <RecordActionButton tone="cyan" onClick={() => recordActionDetail("Kampanya Detayı", [["Kampanya", campaign.name], ["Müşteri", companyName(content, campaign.company_id)], ["Platform", campaign.platform], ["Durum", campaign.status], ["Bütçe", `${Number(totalBudget || 0).toLocaleString("tr-TR")} TL`]])}>Detay</RecordActionButton>
                {canManage && <button onClick={() => copyCampaign(campaign)} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700">Kopyala</button>}
                {canManage && (archived ? <button onClick={() => update(campaign.id, { archived_at: null, deleted_at: null, status: "Planlandı" }, "Kampanya arşivden çıkarıldı")} className="rounded-full border border-amber-300/30 px-4 py-2 text-xs text-amber-700">Arşivden Çıkar</button> : <button onClick={() => archiveCampaign(campaign)} className="rounded-full border border-red-300/30 px-4 py-2 text-xs text-red-200">Sil / Arşivle</button>)}
              </div>
            </div>
          );
        })}
        {!filteredCampaigns.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-6 text-sm text-slate-400">Bu filtrelerle kampanya bulunamadı.</p>}
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
          <label className="grid cursor-pointer gap-2 rounded-[8px] border border-dashed border-cyan-200/30 p-4 text-sm font-semibold text-cyan-700">
            CSV veya XLSX yükle
            <input className="hidden" type="file" accept=".csv,.xlsx,text/csv" onChange={(e) => e.target.files?.[0] && importMetaReport(e.target.files[0])} />
            <span className="text-xs text-slate-400">XLSX için ek paket gerekir; CSV önerilir.</span>
          </label>
        </div>
        {importMessage && <p className="mt-3 rounded-[8px] bg-emerald-500/10 p-3 text-sm text-emerald-700">{importMessage}</p>}
        {importError && <p className="mt-3 rounded-[8px] bg-red-500/10 p-3 text-sm text-red-100">{importError}</p>}
        {preview.length > 0 && <div className="mt-4 overflow-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="text-slate-400"><tr>{["Tarih", "Gösterim", "Erişim", "Tıklama", "Potansiyel Müşteri", "Harcama"].map((head) => <th key={head} className="p-2">{head}</th>)}</tr></thead><tbody>{preview.map((row, index) => <tr key={index} className="border-t border-slate-200"><td className="p-2">{row.date}</td><td className="p-2">{row.impressions}</td><td className="p-2">{row.reach}</td><td className="p-2">{row.clicks}</td><td className="p-2">{row.leads}</td><td className="p-2">{row.spent}</td></tr>)}</tbody></table></div>}
      </div>
      {importOnly ? null : <div className="mb-4 rounded-[8px] border border-slate-200 p-4 text-sm leading-7 text-slate-600">
        <p className="font-black text-slate-900">Müşteri panelinde kullanılan sade anlatım</p>
        <p>Reklamınız kaç kez gösterildi · Reklamınız kaç kişiye ulaştı · Reklamınıza kaç kişi tıkladı · Kaç kişi mesaj attı · Kaç potansiyel müşteri geldi · Ne kadar reklam bütçesi harcandı</p>
        <p className="mt-3 text-slate-400">Meta raporlarında Bağlantı Tıklaması ayrı bir sütun olarak gelirse, içe aktarma sırasında toplam tıklama alanına aktarılır.</p>
      </div>}
      {importOnly ? null : <>
      <button onClick={() => setContent({ ...content, campaignMetrics: [...metrics, { id: `${Date.now()}`, date: new Date().toISOString().slice(0, 10), period: "Günlük", source: "Manuel Giriş", impressions: 0, reach: 0, clicks: 0, messages: 0, leads: 0, spent: 0, visible_to_customer: true }] })} className="mb-4 inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950"><Plus size={16} /> Metrik ekle</button>
      <div className="grid gap-4">
        {metrics.map((metric, index) => (
          <div key={metric.id || index} className="grid gap-3 rounded-[8px] border border-slate-200 p-4 md:grid-cols-3">
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
  function applyMetricsFromSource(report) {
    const source = report.data_source || "Manuel";
    if (!report.company_id) return setMessage("Veri kaynağı için önce müşteri seçin.");
    const rows = (content.campaignMetrics || []).filter((metric) => {
      if (metric.company_id !== report.company_id) return false;
      if (report.campaign_id && metric.campaign_id !== report.campaign_id) return false;
      if (source === "Meta") return String(metric.source || "").toLocaleLowerCase("tr").includes("meta");
      if (source === "Google") return String(metric.source || "").toLocaleLowerCase("tr").includes("google");
      if (source === "Karma") return ["meta", "google"].some((item) => String(metric.source || "").toLocaleLowerCase("tr").includes(item));
      return false;
    });
    if (!rows.length) return setMessage("Seçili veri kaynağı için metrik bulunamadı.");
    const totals = rows.reduce((sum, row) => ({
      impressions: sum.impressions + Number(row.impressions || 0),
      reach: sum.reach + Number(row.reach || 0),
      clicks: sum.clicks + Number(row.clicks || 0),
      messages: sum.messages + Number(row.messages || 0),
      leads: sum.leads + Number(row.leads || row.conversions || 0),
      spent: sum.spent + Number(row.spent || row.spend || row.cost || 0),
      conversions: sum.conversions + Number(row.conversions || 0)
    }), { impressions: 0, reach: 0, clicks: 0, messages: 0, leads: 0, spent: 0, conversions: 0 });
    const derived = {
      ...totals,
      cost: totals.spent,
      ctr: totals.impressions ? Number(((totals.clicks / totals.impressions) * 100).toFixed(2)) : 0,
      cpc: totals.clicks ? Number((totals.spent / totals.clicks).toFixed(2)) : 0,
      average_cpc: totals.clicks ? Number((totals.spent / totals.clicks).toFixed(2)) : 0,
      cpm: totals.impressions ? Number(((totals.spent / totals.impressions) * 1000).toFixed(2)) : 0,
      cost_per_result: totals.leads ? Number((totals.spent / totals.leads).toFixed(2)) : 0,
      cost_per_conversion: totals.conversions ? Number((totals.spent / totals.conversions).toFixed(2)) : 0
    };
    update(report.id, { metrics: { ...(report.metrics || {}), ...derived }, customer_note: report.customer_note || `${source} veri kaynağından içe aktarılan kampanya metrikleriyle rapor hazırlandı.` });
    setMessage("Veri kaynağı metrikleri rapora aktarıldı.");
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
    <div className="mb-5 flex flex-wrap gap-2">{reportTabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-full px-4 py-2 text-sm font-bold ${tab === item ? "bg-cyan-300 text-slate-950" : "border border-slate-200 text-slate-600"}`}>{item}</button>)}</div>
    <button onClick={add} className="mb-4 inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950"><Plus size={16} /> Yeni rapor ekle</button>
    {message && <p className={`mb-4 rounded-[8px] border p-3 text-sm ${message.includes("Kaydedilemedi") || message.includes("Silinemedi") ? "border-red-300/30 bg-red-500/10 text-red-100" : "border-cyan-200/20 bg-cyan-200/10 text-cyan-700"}`}>{message}</p>}
    <div className="grid gap-4">{visibleReports.map((report) => <div key={report.id} className="grid gap-4 rounded-[8px] border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <CompanySelect value={report.company_id || ""} onChange={(value) => update(report.id, { company_id: value, campaign_id: "" })} companies={content.companies} />
        <SelectField label="Kampanya" value={report.campaign_id || ""} onChange={(value) => update(report.id, { campaign_id: value })} options={(content.campaigns || []).filter((campaign) => !report.company_id || campaign.company_id === report.company_id).map((campaign) => ({ value: campaign.id, label: campaign.name }))} placeholder="Kampanya seçimi isteğe bağlı" />
        <SelectField label="Veri Kaynağı" value={report.data_source || "Manuel"} onChange={(value) => update(report.id, { data_source: value })} options={["Manuel", "Meta", "Google", "Karma"]} />
        <Field label="Rapor dönemi" value={report.period} onChange={(value) => update(report.id, { period: value })} />
        <Field label="Başlangıç tarihi" type="date" value={report.start_date} onChange={(value) => update(report.id, { start_date: value })} />
        <Field label="Bitiş tarihi" type="date" value={report.end_date} onChange={(value) => update(report.id, { end_date: value })} />
        {report.report_type === "Sosyal Medya Yönetimi Raporu" && <OtherSelectField label="Platform" value={report.platform} onChange={(value) => update(report.id, { platform: value })} options={socialPlatforms} manualLabel="Platformu yazın" />}
      </div>
      <div className="grid gap-3 md:grid-cols-3">{reportMetricFields[report.report_type].map(([key, label, kind]) => kind === "textarea" ? <TextArea key={key} label={label} value={report.metrics?.[key]} onChange={(value) => updateMetric(report, key, value)} /> : <Field key={key} label={label} type="number" value={report.metrics?.[key]} onChange={(value) => updateMetric(report, key, value)} />)}</div>
      <div className="grid gap-3 md:grid-cols-2"><TextArea label="Dahili not" value={report.internal_note} onChange={(value) => update(report.id, { internal_note: value })} /><TextArea label="Müşteriye gösterilecek genel yorum" value={report.customer_note} onChange={(value) => update(report.id, { customer_note: value })} /></div>
      <ReportTools report={report} updates={(content.reportUpdates || []).filter((item) => item.report_id === report.id)} onUpdatesChange={(items) => setContent({ ...content, reportUpdates: [...items, ...(content.reportUpdates || []).filter((item) => item.report_id !== report.id)] })} onApplyExtracted={(patch) => update(report.id, patch)} />
      <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={report.visible_to_customer ?? true} onChange={(event) => update(report.id, { visible_to_customer: event.target.checked })} /> Müşteriye gösterilsin</label><button type="button" onClick={() => applyMetricsFromSource(report)} className="rounded-full border border-emerald-300/30 px-4 py-2 text-sm font-black text-emerald-700">Veri Kaynağından Aktar</button><button disabled={loading === report.id} onClick={() => save(report)} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-60">{loading === report.id ? "Kaydediliyor..." : "Raporu kaydet"}</button><button onClick={() => remove(report)} className="rounded-full border border-red-300/30 px-4 py-2 text-sm text-red-100">Sil</button>{report.company_id && <a href={`/musteri-paneli?company=${report.company_id}`} target="_blank" rel="noreferrer" className="rounded-full border border-slate-200 px-4 py-2 text-sm">Müşteri gibi görüntüle</a>}</div>
      {(content.reportInterpretations || []).filter((item) => item.report_id === report.id).map((item) => <div key={item.id} className="rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm leading-6 text-cyan-700"><AiUsageBadge meta={aiMetaFromRecord(item, content.settings.api)} /><p className="mt-3">{item.interpretation_text}</p><p className="mt-2 text-xs text-cyan-700/70">{formatDateTime(item.created_at)}</p></div>)}
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
          <div key={item.id || index} className="grid gap-3 rounded-[8px] border border-slate-200 p-4 md:grid-cols-2">
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
  const syncFileUrl = (index, value) => update(index, { file_url: value, document_url: value });
  return (
    <Panel title="Dosyalar">
      <button onClick={() => setContent({ ...content, customerFiles: [...files, { id: `${Date.now()}`, title: "Yeni Dosya", file_type: "Diğer", file_url: "", document_url: "", visible_to_customer: true, show_in_creative_center: false }] })} className="mb-4 inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950"><Plus size={16} /> Dosya kaydı ekle</button>
      <div className="grid gap-4">
        {files.map((item, index) => (
          <div key={item.id || index} className="grid gap-3 rounded-[8px] border border-slate-200 p-4 md:grid-cols-2">
            <CompanySelect value={item.company_id || ""} onChange={(v) => update(index, { company_id: v })} companies={content.companies} />
            <OtherSelectField label="Dosya kategorisi" value={item.file_type} onChange={(v) => update(index, { file_type: v })} options={fileCategoryOptions} manualLabel="Dosya kategorisini yazın" />
            <Field label="Başlık" value={item.title} onChange={(v) => update(index, { title: v })} />
            <Field label="Dosya URL" value={item.file_url || item.document_url || ""} onChange={(v) => syncFileUrl(index, v)} />
            <Upload onUrl={(url) => syncFileUrl(index, url)} />
            <TextArea label="Açıklama" value={item.description} onChange={(v) => update(index, { description: v })} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.visible_to_customer ?? true} onChange={(e) => update(index, { visible_to_customer: e.target.checked })} /> Müşteri panelinde görünsün</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(item.show_in_creative_center || ["Görsel", "Reklam Görseli", "Kreatif"].includes(item.file_type))} onChange={(e) => update(index, { show_in_creative_center: e.target.checked })} /> Kreatif Merkezinde Göster</label>
            <button onClick={() => setContent({ ...content, customerFiles: files.filter((_, i) => i !== index) })} className="w-fit rounded-full border border-red-300/30 px-3 py-2 text-xs text-red-200">Sil</button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function UsersAdmin({ content, setContent, currentSession, customerOnly = false, mode = "Kullanıcı Yönetimi" }: any) {
  const [tab, setTab] = useState(customerOnly ? "Kullanıcılar" : "Kullanıcılar");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [createForm, setCreateForm] = useState({ fullName: "", email: "", password: "", role: "editor", company_id: "", is_active: true, allowed_modules: uiRoleTemplates.editor });
  const activeAdminUsers = (content.users || []).filter((user) => legacyRole(user.role) === "admin" && user.is_active && !user.deleted_at);
  const users = (content.users || [])
    .filter((user) => !user.deleted_at)
    .filter((user) => !customerOnly || customerRole(user.role))
    .filter((user) => JSON.stringify(user).toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")))
    .filter((user) => !roleFilter || user.role === roleFilter)
    .filter((user) => !statusFilter || (statusFilter === "Aktif" ? user.is_active : !user.is_active));
  const update = (id, patch) => setContent({ ...content, users: content.users.map((user) => user.id === id ? { ...user, ...patch } : user) });
  const removeUserFromState = (id) => setContent({ ...content, users: (content.users || []).filter((user) => user.id !== id) });
  function blockedUserAction(user) {
    if (currentSession?.profileId === user.id) return "Kendi hesabınızı silemez veya pasifleştiremezsiniz.";
    if (legacyRole(user.role) === "admin" && user.is_active && activeAdminUsers.length <= 1) return "Son aktif yönetici hesabı silinemez veya pasifleştirilemez.";
    return "";
  }
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
  async function disableUser(user) {
    const blocked = blockedUserAction(user);
    if (blocked) return setError(blocked);
    setError("");
    setMessage("Kullanıcı pasifleştiriliyor...");
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: false })
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      update(user.id, data.user || { ...user, is_active: false });
      setMessage("Kullanıcı pasifleştirildi.");
    } else {
      setMessage("");
      setError(data.supabaseError ? `${data.error}: ${data.supabaseError}` : data.error || "Kullanıcı pasifleştirilemedi.");
    }
  }
  async function deleteUser(user) {
    const blocked = blockedUserAction(user);
    if (blocked) return setError(blocked);
    setError("");
    setMessage("Kullanıcı güvenli şekilde siliniyor...");
    const response = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      removeUserFromState(user.id);
      setMessage(data.message || "Bu kullanıcı güvenli şekilde pasifleştirildi.");
    } else {
      setMessage("");
      setError(data.supabaseError ? `${data.error}: ${data.supabaseError}` : data.error || "Kullanıcı silinemedi.");
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
      {!customerOnly && <HubTabs items={["Kullanıcılar", "Roller ve Yetkiler", "İzinler", "Yeni Kullanıcı Oluştur"]} active={tab} onChange={setTab} />}
      {tab === "Yeni Kullanıcı Oluştur" && <div className="mb-6 rounded-[8px] border border-slate-200 p-4">
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
      </div>}
      {tab === "Roller ve Yetkiler" && <div className="mb-6 rounded-[8px] border border-slate-200 bg-slate-50 p-4">
        <h3 className="font-black">Roller ve Yetkiler</h3>
        <p className="mt-3 text-sm leading-6 text-slate-400">Yönetici tüm modülleri görür. Operasyon yöneticisi CRM, rapor ve ajans operasyonlarını yönetir. Editör içerik, AI ve raporlama araçlarında çalışır. Müşteri yalnızca kendi paneline erişir.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{roleOptions.map((role) => <div key={role.value} className="rounded-[8px] border border-slate-200 bg-white p-4"><p className="font-black text-slate-900">{role.label}</p><p className="mt-2 text-xs leading-5 text-slate-400">{(uiRoleTemplates[role.value] || []).length} modül yetkisi</p></div>)}</div>
      </div>}
      {tab === "İzinler" && <div className="mb-6 rounded-[8px] border border-slate-200 bg-slate-50 p-4">
        <h3 className="font-black">İzinler</h3>
        <p className="mt-2 text-sm text-slate-400">Kullanıcıyı düzenle butonuyla her hesap için modül izinlerini özelleştirebilirsiniz.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">{uiPermissionGroups.map(([group, modules]) => <div key={group} className="rounded-[8px] border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-black uppercase tracking-[.12em] text-cyan-700">{group}</p><div className="mt-3 flex flex-wrap gap-2">{modules.map((module) => <span key={module} className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600">{module}</span>)}</div></div>)}</div>
      </div>}
      {["Kullanıcılar", "Roller ve Yetkiler", "İzinler"].includes(tab) && <div className="mb-4 grid gap-3 md:grid-cols-3">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Kullanıcı ara..." className="min-h-11 rounded-[8px] border border-slate-200 bg-slate-50 px-3 text-slate-900" />
        <SelectField label="Rol filtresi" value={roleFilter} onChange={setRoleFilter} options={roleOptions} placeholder="Tüm roller" />
        <SelectField label="Durum filtresi" value={statusFilter} onChange={setStatusFilter} options={statusOptions} placeholder="Tüm durumlar" />
      </div>}
      {message && <p className="mb-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-700">{message}</p>}
      {error && <p className="mb-4 rounded-[8px] border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}
      {["Kullanıcılar", "Roller ve Yetkiler", "İzinler"].includes(tab) && <div className="grid gap-3">
        {users.map((user) => (
          <div key={user.id} className="rounded-[8px] border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-black">{user.full_name || user.email}</h3>
                <p className="text-sm text-slate-400">{user.email} · {roleOptions.find((role) => role.value === legacyRole(user.role))?.label || user.role} · {user.is_active ? "Aktif" : "Pasif"}</p>
                <p className="mt-1 text-xs text-slate-500">Auth bağlantısı: {user.auth_user_id ? "Bağlı" : "Eksik"} · Oluşturulma: {user.created_at ? new Date(user.created_at).toLocaleDateString("tr-TR") : "-"} · Güncelleme: {user.updated_at ? new Date(user.updated_at).toLocaleDateString("tr-TR") : "-"}</p>
                {currentSession?.profileId === user.id && <p className="mt-2 rounded-[8px] border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs text-amber-700">Kendi hesabımı düzenliyorum. Yönetici rolünüz ve aktif durumunuz korunur.</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setEditingUser({ ...user })} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950">Düzenle</button>
                <button onClick={() => resetPassword(user)} className="rounded-full border border-slate-200 px-4 py-2 text-sm">Şifre sıfırla</button>
                <button disabled={Boolean(blockedUserAction(user)) || !user.is_active} onClick={() => setConfirmAction({ type: "disable", user })} className="rounded-full border border-amber-300/30 px-4 py-2 text-sm text-amber-700 disabled:cursor-not-allowed disabled:opacity-45">Pasifleştir</button>
                <button disabled={Boolean(blockedUserAction(user))} onClick={() => setConfirmAction({ type: "delete", user })} className="rounded-full border border-red-300/30 px-4 py-2 text-sm text-red-100 disabled:cursor-not-allowed disabled:opacity-45">Sil</button>
              </div>
            </div>
          </div>
        ))}
        {!users.length && <p className="text-sm text-slate-400">Kullanıcı bulunamadı.</p>}
      </div>}
      {editingUser && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-white/70 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-[8px] border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-xl font-black">Kullanıcıyı düzenle</h3>
              <button onClick={() => setEditingUser(null)} className="rounded-full border border-slate-200 px-3 py-2 text-sm">Kapat</button>
            </div>
            {currentSession?.profileId === editingUser.id && <p className="mb-4 rounded-[8px] border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-700">Kendi hesabımı düzenliyorum. Kendi yönetici rolünüzü kaldıramaz veya hesabınızı pasifleştiremezsiniz.</p>}
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
      {confirmAction && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-white/70 p-4">
          <div className="w-full max-w-md rounded-[8px] border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 className="text-xl font-black">{confirmAction.type === "delete" ? "Kullanıcıyı sil" : "Kullanıcıyı pasifleştir"}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">Bu kullanıcıyı {confirmAction.type === "delete" ? "silmek" : "pasifleştirmek"} istediğinize emin misiniz?</p>
            <p className="mt-3 rounded-[8px] border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-900">{confirmAction.user.full_name || confirmAction.user.email}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button onClick={() => setConfirmAction(null)} className="rounded-full border border-slate-200 px-4 py-2 text-sm">Vazgeç</button>
              <button onClick={async () => { const action = confirmAction; setConfirmAction(null); action.type === "delete" ? await deleteUser(action.user) : await disableUser(action.user); }} className="rounded-full bg-red-300 px-4 py-2 text-sm font-black text-slate-950">Onayla</button>
            </div>
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
  return <div className="mt-5 rounded-[8px] border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-black">Modül yetkileri</h4><p className="mt-1 text-xs text-slate-400">Rol şablonunu kullanın veya izinleri tek tek özelleştirin.</p></div><div className="flex flex-wrap gap-2">{Object.entries(uiRoleTemplates).map(([role, modules]) => <button key={role} onClick={() => setUser({ ...user, role, allowed_modules: modules })} className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold">{role === "admin" ? "Admin Yetkileri" : role === "yonetici" ? "Yönetici Yetkileri" : role === "editor" ? "Editör Yetkileri" : "Müşteri Yetkileri"}</button>)}</div></div><div className="mt-4 grid gap-4 md:grid-cols-2">{uiPermissionGroups.map(([group, modules]) => <div key={group} className="rounded-[8px] bg-slate-50 p-3"><p className="text-xs font-black uppercase tracking-[.12em] text-cyan-700">{group}</p><div className="mt-3 grid gap-2">{modules.map((module) => <label key={module} className="flex gap-2 text-xs text-slate-600"><input type="checkbox" checked={selected.includes(module)} onChange={() => toggle(module)} />{module}</label>)}</div></div>)}</div></div>;
}

function HubTabs({ items, active, onChange }: any) {
  return <div className="mb-5 flex flex-wrap gap-2">{items.map((item) => <button key={item} type="button" onClick={() => onChange(item)} className={`rounded-full px-4 py-2 text-sm font-bold ${active === item ? "bg-cyan-300 text-slate-950" : "border border-slate-200 text-slate-600 hover:bg-white/10"}`}>{item}</button>)}</div>;
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
  if (value >= 85) return { label: "Çok Yüksek Fırsat", className: "border-orange-300/50 bg-orange-400/15 text-orange-700", pin: "bg-orange-400" };
  if (value >= 70) return { label: "Yüksek Fırsat", className: "border-emerald-300/40 bg-emerald-300/12 text-emerald-700", pin: "bg-emerald-400" };
  if (value >= 55) return { label: "Orta Fırsat", className: "border-amber-300/40 bg-amber-300/12 text-amber-700", pin: "bg-amber-300" };
  if (value > 0) return { label: "Gelişen Fırsat", className: "border-slate-400/40 bg-slate-400/10 text-slate-700", pin: "bg-slate-400" };
  return { label: "Analiz Bekliyor", className: "border-slate-500/30 bg-slate-500/10 text-slate-600", pin: "bg-slate-400" };
}

function customerDiscoveryLevel(score: any) {
  const value = Number(score || 0);
  if (value >= 90) return { label: "Çok Sıcak Fırsat", className: "border-red-300/45 bg-red-500/20 text-red-100", pin: "bg-red-500" };
  if (value >= 80) return { label: "Sıcak Fırsat", className: "border-orange-300/45 bg-orange-400/15 text-orange-700", pin: "bg-orange-400" };
  if (value >= 60) return { label: "Potansiyel Fırsat", className: "border-amber-300/40 bg-amber-300/12 text-amber-700", pin: "bg-amber-300" };
  if (value >= 40) return { label: "Orta Potansiyel", className: "border-sky-300/35 bg-sky-300/10 text-sky-100", pin: "bg-sky-300" };
  return { label: "Düşük Öncelik", className: "border-slate-400/40 bg-slate-400/10 text-slate-700", pin: "bg-slate-400" };
}

function digitalMaturityLevel(score: any) {
  const value = Number(score || 0);
  if (value >= 80) return { label: "Dijital altyapı güçlü", className: "border-emerald-300/45 bg-emerald-400/15 text-emerald-700", bar: "from-emerald-300 to-green-400" };
  if (value >= 60) return { label: "İyi seviyede", className: "border-lime-300/40 bg-lime-300/12 text-lime-100", bar: "from-lime-300 to-emerald-300" };
  if (value >= 40) return { label: "Geliştirilebilir", className: "border-amber-300/40 bg-amber-300/12 text-amber-700", bar: "from-amber-300 to-yellow-300" };
  if (value >= 20) return { label: "Zayıf", className: "border-orange-300/40 bg-orange-300/12 text-orange-700", bar: "from-orange-300 to-red-300" };
  return { label: "Çok zayıf", className: "border-red-300/40 bg-red-400/12 text-red-100", bar: "from-red-400 to-rose-500" };
}

const highAdPotentialHints = ["oto", "otomotiv", "emlak", "diş", "dis", "klinik", "güzellik", "guzellik", "estetik", "sağlık", "saglik", "restoran", "kafe", "kuaför", "spor", "hukuk"];

function scoreValue(record: any, primary: string, fallback: string) {
  const value = record?.[primary] ?? record?.[fallback];
  return value === null || value === undefined || value === "" ? null : Number(value);
}

function discoveryScoreBreakdown(record: any) {
  const rating = Number(record.googleRating ?? record.google_rating ?? 0);
  const reviews = Number(record.reviewCount ?? record.google_review_count ?? 0);
  const category = String(record.category || record.business_type || "").toLocaleLowerCase("tr-TR");
  const highPotential = highAdPotentialHints.some((item) => category.includes(item));
  const heat = [{ points: 15, label: "Temel fırsat sinyali" }];
  const maturity = [{ points: 10, label: "Temel dijital profil sinyali" }];
  if (!record.website) heat.push({ points: 24, label: "Website bulunamadı" });
  else maturity.push({ points: 28, label: "Website mevcut" });
  if (record.phone) {
    heat.push({ points: 18, label: "Telefon bilgisi mevcut" });
    maturity.push({ points: 16, label: "Telefon bilgisi mevcut" });
  }
  if (record.address) {
    heat.push({ points: 8, label: "Adres bilgisi mevcut" });
    maturity.push({ points: 10, label: "İşletme adresi tamamlanmış" });
  }
  if (rating >= 4.5) {
    heat.push({ points: 16, label: "Google puanı çok yüksek" });
    maturity.push({ points: 18, label: "Google güven sinyali güçlü" });
  } else if (rating >= 4) {
    heat.push({ points: 12, label: "Google puanı yüksek" });
    maturity.push({ points: 14, label: "4.0+ müşteri memnuniyeti sinyali" });
  } else if (rating > 0) {
    heat.push({ points: 5, label: "Google puanı mevcut" });
    maturity.push({ points: 7, label: "Google profilinde temel puan var" });
  }
  if (reviews === 0) heat.push({ points: 6, label: "Yorum yok, itibar yönetimi fırsatı" });
  else if (reviews < 25) {
    heat.push({ points: 12, label: "Yorum sayısı düşük" });
    maturity.push({ points: 8, label: "Yorumlar başlamış" });
  } else if (reviews < 100) {
    heat.push({ points: 10, label: "Orta yorum hacmi" });
    maturity.push({ points: 16, label: "Sosyal kanıt mevcut" });
  } else {
    heat.push({ points: 6, label: "Yorum hacmi yüksek" });
    maturity.push({ points: 24, label: "Güçlü sosyal kanıt" });
  }
  if (highPotential) heat.push({ points: 12, label: "Sektör reklam potansiyeli yüksek" });
  if (record.isDemo) heat.push({ points: 0, label: "Demo veri: gerçek arama yerine örnek sonuç" });
  return { heat, maturity };
}

function ScoreInfo({ text }: any) {
  return <span tabIndex={0} className="group relative inline-flex align-middle" title={text}><HelpCircle size={14} className="text-cyan-700/80" /><span className="pointer-events-none absolute left-1/2 top-5 z-20 hidden w-56 -translate-x-1/2 rounded-[8px] border border-cyan-200/20 bg-white p-3 text-[11px] font-semibold normal-case leading-5 text-cyan-700 shadow-2xl group-hover:block group-focus:block">{text}</span></span>;
}

function ScoringGuidePanel() {
  const heatRows = [["90-100", "Çok Sıcak Fırsat 🔥", "Hemen iletişime geçin.", "bg-red-500"], ["80-89", "Sıcak Fırsat", "Öncelikli takip önerilir.", "bg-orange-400"], ["60-79", "Potansiyel Fırsat", "Teklif ve analiz gönderilebilir.", "bg-amber-300"], ["40-59", "Orta Potansiyel", "Takip listesinde tutulabilir.", "bg-sky-300"], ["0-39", "Düşük Öncelik", "Şimdilik bekletilebilir.", "bg-slate-400"]];
  const maturityRows = [["80-100", "Dijital altyapı güçlü", "bg-emerald-400"], ["60-79", "İyi seviyede", "bg-lime-300"], ["40-59", "Geliştirilebilir", "bg-amber-300"], ["20-39", "Zayıf", "bg-orange-300"], ["0-19", "Çok zayıf", "bg-red-400"]];
  return <div className="grid gap-3">
    <section className="rounded-[8px] border border-cyan-200/15 bg-cyan-200/[0.06] p-4">
      <p className="text-sm font-black text-slate-900">Puan Rehberi</p>
      <p className="mt-3 text-xs font-black uppercase tracking-[.12em] text-cyan-700">Müşteri Sıcaklık Puanı</p>
      <div className="mt-3 grid gap-2">{heatRows.map(([range, label, note, color]) => <div key={range} className="grid grid-cols-[68px_1fr] gap-2 rounded-[8px] border border-slate-200 bg-slate-50 p-2 text-[11px] leading-4"><span className="font-black text-slate-900"><span className={`mr-2 inline-block size-2 rounded-full ${color}`} />{range}</span><span><strong className="text-slate-700">{label}</strong><br /><span className="text-slate-400">{note}</span></span></div>)}</div>
      <p className="mt-4 text-xs font-black uppercase tracking-[.12em] text-emerald-700">Dijital Olgunluk Skoru</p>
      <div className="mt-3 grid gap-2">{maturityRows.map(([range, label, color]) => <div key={range} className="flex items-center justify-between gap-3 rounded-[8px] border border-slate-200 bg-slate-50 p-2 text-[11px]"><span className="font-black text-slate-900"><span className={`mr-2 inline-block size-2 rounded-full ${color}`} />{range}</span><span className="text-right text-slate-600">{label}</span></div>)}</div>
    </section>
    <section className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-black text-slate-900">Puan Nasıl Hesaplanıyor?</p>
      <p className="mt-3 text-xs font-black text-cyan-700">Müşteri Sıcaklık Puanı artar:</p>
      <ul className="mt-2 grid gap-1 text-xs leading-5 text-slate-600"><li>• Telefon bilgisi varsa</li><li>• İşletme aktif görünüyorsa</li><li>• Dijital eksikler varsa</li><li>• Reklam potansiyeli yüksekse</li><li>• İletişim kurulabilecek veriler mevcutsa</li></ul>
      <p className="mt-3 text-xs font-black text-emerald-700">Dijital Olgunluk Skoru artar:</p>
      <ul className="mt-2 grid gap-1 text-xs leading-5 text-slate-600"><li>• Website varsa</li><li>• Google profili güçlü ise</li><li>• Yorum sayısı yüksekse</li><li>• İletişim bilgileri tam ise</li><li>• Dijital görünürlüğü yüksek ise</li></ul>
      <p className="mt-3 rounded-[8px] border border-amber-200/20 bg-amber-200/10 p-3 text-[11px] leading-5 text-amber-700">Bu puanlar karar desteği amacıyla üretilir ve kesin ticari sonuç garantisi vermez.</p>
    </section>
  </div>;
}

function districtOf(item: any) {
  if (item.district) return item.district;
  const parts = String(item.address || "").split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length > 2 ? parts[parts.length - 2] : "İlçe belirtilmedi";
}

function MapsIntelligence({ content, setContent, setActive, mode = "Haritalar", allowedModules = [] }: any) {
  const emptySearch = { city: "Manisa", district: "", businessType: "", minimumRating: "", minimumReviewCount: "", website: "", phone: "", hideSaved: true };
  const [search, setSearch] = useState(emptySearch);
  const [results, setResults] = useState([]);
  const [tab, setTab] = useState(mode === "İşletme Keşfi" ? "Google Maps Müşteri Bulma" : "Fırsat Haritası");
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");
  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  const [notePlaceId, setNotePlaceId] = useState("");
  const [noteDrafts, setNoteDrafts] = useState({});
  const [whatsappDraft, setWhatsappDraft] = useState<any>(null);
  const saved = (content.leads || []).filter((lead) => lead.google_place_id || lead.address);
  const canDiscover = allowedModules.includes("musteri-bulucu") || allowedModules.includes("haritalar") || allowedModules.includes("business_discovery") || allowedModules.includes("maps");
  const source = tab === "Google Maps Müşteri Bulma" ? results : saved;
  const visible = source
    .filter((item) => tab !== "Sıcak Leadler" || Number(item.lead_heat_score || item.leadHeatScore || 0) >= 70)
    .filter((item) => !search.district || districtOf(item).toLocaleLowerCase("tr").includes(search.district.toLocaleLowerCase("tr")))
    .filter((item) => !search.businessType || String(item.business_type || item.category || "").toLocaleLowerCase("tr").includes(search.businessType.toLocaleLowerCase("tr")));
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
    return { ...group, hot: values.filter((item) => Number(item.lead_heat_score || item.leadHeatScore || 0) >= 70).length, rating: average("google_rating", "googleRating"), maturity: average("digital_maturity_score", "digitalMaturityScore"), sectors, opportunity: customerDiscoveryLevel(average("lead_heat_score", "leadHeatScore")) };
  });
  const sectors = mapSectorOptions.filter((sector) => sector !== "Diğer").map((sector) => {
    const items = combined.filter((item) => String(item.business_type || item.category || "").toLocaleLowerCase("tr").includes(sector.toLocaleLowerCase("tr")));
    const average = items.length ? items.reduce((sum, item) => sum + Number(item.lead_heat_score || item.leadHeatScore || 0), 0) / items.length : 0;
    return { sector, count: items.length, hot: items.filter((item) => Number(item.lead_heat_score || item.leadHeatScore || 0) >= 70).length, opportunity: customerDiscoveryLevel(average) };
  }).filter((item) => item.count);

  function existingLeadFor(item) {
    const placeId = item.placeId || item.google_place_id;
    const normalizedPhone = String(item.phone || "").replace(/\D/g, "");
    const normalizedName = String(item.name || item.company || "").toLocaleLowerCase("tr");
    return item.id ? item : saved.find((lead) => lead.google_place_id === placeId || (normalizedPhone && String(lead.phone || "").replace(/\D/g, "") === normalizedPhone && String(lead.company || lead.name || "").toLocaleLowerCase("tr") === normalizedName));
  }
  function patchLead(id, patch) {
    setContent({ ...content, leads: (content.leads || []).map((lead) => lead.id === id ? { ...lead, ...patch } : lead) });
    setMessage("Kayıt güncellendi. Kalıcı kayıt için üst çubuktaki Kaydet düğmesini kullanın.");
  }
  async function runSearch() {
    if (!canDiscover) return setMessage("İşletme keşfi araması için yetkiniz bulunmuyor.");
    setLoading("search");
    setMessage("Google Maps üzerinde işletmeler aranıyor...");
    const response = await fetch("/api/admin/business-discovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...search, sector: search.businessType, keyword: search.businessType }) });
    const data = await response.json().catch(() => ({}));
    setLoading("");
    if (!response.ok) return setMessage(data.error || "İşletme araması başarısız oldu.");
    setResults(data.businesses || []);
    setTab("Google Maps Müşteri Bulma");
    if (data.warning) setMessage(data.warning);
    else setMessage(data.count ? `${data.count} işletme bulundu.` : "Bu filtrelerle işletme bulunamadı. Yıldız puanı veya yorum sayısı filtresini genişletmeyi deneyin.");
  }
  async function saveBusiness(business) {
    const existing = existingLeadFor(business);
    if (existing?.id) {
      setMessage("Bu işletme CRM’de zaten kayıtlı.");
      return existing;
    }
    setLoading(`save-${business.placeId}`);
    const response = await fetch("/api/admin/business-discovery", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businesses: [{ ...business, notes: noteDrafts[business.placeId] || business.notes }], sector: search.businessType, city: search.city, district: search.district }) });
    const data = await response.json().catch(() => ({}));
    setLoading("");
    if (!response.ok) return setMessage(data.supabaseError ? `${data.error}: ${data.supabaseError}` : data.error || "İşletme kaydedilemedi.");
    setContent({ ...content, leads: [...(data.leads || []), ...(content.leads || [])] });
    setMessage(data.skipped ? "Bu işletme daha önce CRM listesine eklenmiş." : data.message);
    return data.leads?.[0] || existingLeadFor(business);
  }
  async function analyze(item) {
    const lead = item.id ? item : existingLeadFor(item) || await saveBusiness(item);
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
  function proposalFor(record) {
    try {
      localStorage.setItem("hk-proposal-prefill", JSON.stringify({ businessName: record.name || record.company, sector: record.category || record.business_type || search.businessType, city: record.city || search.city, platform: "Meta + Google", goal: "Lead generation" }));
    } catch {}
    setActive("Teklif Motoru");
  }
  function outreachText(record) {
    const missingWebsite = record.website ? "" : "Web siteniz görünmediği için reklam trafiğini doğru bir landing page (açılış sayfası) ile toplama fırsatı var.";
    const lowReview = Number(record.reviewCount ?? record.google_review_count ?? 0) < 25 ? "Google yorum sayınız artırılırsa yerel güven ve dönüşüm oranı güçlenebilir." : "Google yorumlarınız güçlü; bunu reklamlarda güven mesajına çevirebiliriz.";
    return `Merhaba ${record.name || record.company || "iyi günler"}, HK Dijital olarak ${record.category || record.business_type || "işletmeniz"} için kısa bir dijital görünürlük ön analizi yaptık. ${missingWebsite} ${lowReview} İsterseniz size 10 dakikalık ücretsiz bir fırsat özeti paylaşabilirim.`;
  }
  const clearFilters = () => setSearch(emptySearch);
  const activeFilters = Object.entries(search).filter(([key, value]) => !["hideSaved"].includes(key) && Boolean(value));
  const renderBusiness = (item) => {
    const placeId = item.placeId || item.google_place_id;
    const existingLead = existingLeadFor(item);
    const record = existingLead || item;
    const heat = scoreValue(record, "leadHeatScore", "lead_heat_score");
    const maturity = scoreValue(record, "digitalMaturityScore", "digital_maturity_score");
    const level = customerDiscoveryLevel(heat);
    const maturityLevel = digitalMaturityLevel(maturity);
    const breakdown = record.scoreBreakdown || discoveryScoreBreakdown(record);
    const heatTotal = heat ?? Math.min(100, breakdown.heat.reduce((sum, row) => sum + Number(row.points || 0), 0));
    const maturityTotal = maturity ?? Math.min(100, breakdown.maturity.reduce((sum, row) => sum + Number(row.points || 0), 0));
    const badges = [
      !record.website && "Website Yok",
      record.phone && "Telefon Var",
      Number(record.googleRating ?? record.google_rating ?? 0) >= 4.5 && "Yüksek Puan",
      Number(record.reviewCount ?? record.google_review_count ?? 0) < 25 && "Yorum Az",
      record.isDemo && "Demo Veri",
      existingLead && "CRM'de Kayıtlı"
    ].filter(Boolean);
    const renderBreakdown = (title, rows, total, tone) => (
      <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className={`text-xs font-black ${tone}`}>{title}</p>
          <span className="text-sm font-black text-slate-900">Toplam: {total}/100</span>
        </div>
        <div className="mt-3 grid gap-2">
          {rows.length ? rows.map((row, index) => (
            <div key={`${title}-${row.label}-${index}`} className="flex items-start justify-between gap-3 rounded-[8px] bg-white px-3 py-2 text-xs leading-5">
              <span className="text-slate-600">{row.label}</span>
              <strong className={Number(row.points) > 0 ? "text-emerald-700" : "text-slate-400"}>{Number(row.points) > 0 ? `+${row.points}` : row.points}</strong>
            </div>
          )) : <p className="rounded-[8px] border border-dashed border-slate-200 p-3 text-xs text-slate-400">Puan bilgisi henüz oluşturulmadı.</p>}
        </div>
      </div>
    );
    return (
      <article key={placeId || record.id} className={`rounded-[8px] border p-4 transition ${selectedPlaceId === placeId ? "border-cyan-200/60 bg-cyan-200/10" : "border-slate-200 bg-slate-50"}`}>
        <button onClick={() => setSelectedPlaceId(placeId)} className="w-full text-left">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <strong className="text-base text-slate-900">{record.name || record.company || "İsimsiz işletme"}</strong>
              <p className="mt-1 text-xs text-slate-400">{record.city || search.city || "-"} / {districtOf(record)} · {record.category || record.business_type || search.businessType || "Sektör belirtilmedi"}</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-[10px] font-black ${level.className}`}>{level.label}</span>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-400">{record.address || "Adres bilgisi yok"}</p>
          <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
            <span>Telefon: <strong>{record.phone || "Yok"}</strong></span>
            <span>Website: <strong className="break-all">{record.website || "Yok"}</strong></span>
            <span>Google puanı: <strong>{record.googleRating ?? record.google_rating ?? "-"}</strong></span>
            <span>Yorum sayısı: <strong>{record.reviewCount ?? record.google_review_count ?? 0}</strong></span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">{badges.map((badge) => <span key={badge} className={`rounded-full px-2 py-1 text-[10px] font-black ${badge === "Demo Veri" ? "bg-amber-300 text-slate-950" : badge === "CRM'de Kayıtlı" ? "bg-emerald-300/15 text-emerald-700" : "bg-white/10 text-slate-700"}`}>{badge}</span>)}</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className={`rounded-[8px] border p-3 ${level.className}`}>
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase">Müşteri Sıcaklık Puanı <ScoreInfo text="Hizmet satma ve iletişim kurma potansiyelini gösterir." /></p>
              {heat === null ? <p className="mt-2 text-xs text-slate-600">Puan bilgisi henüz oluşturulmadı.</p> : <><p className="mt-1 text-2xl font-black text-slate-900">{heat}<small className="text-xs text-slate-600">/100</small></p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-50"><div className={`h-full rounded-full ${level.pin}`} style={{ width: `${Math.min(100, Math.max(0, heat))}%` }} /></div></>}
            </div>
            <div className={`rounded-[8px] border p-3 ${maturityLevel.className}`}>
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase">Dijital Olgunluk Skoru <ScoreInfo text="İşletmenin dijital varlıklarının gelişmişlik seviyesini gösterir." /></p>
              {maturity === null ? <p className="mt-2 text-xs text-slate-600">Puan bilgisi henüz oluşturulmadı.</p> : <><p className="mt-1 text-2xl font-black text-slate-900">{maturity}<small className="text-xs text-slate-600">/100</small></p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-50"><div className={`h-full rounded-full bg-gradient-to-r ${maturityLevel.bar}`} style={{ width: `${Math.min(100, Math.max(0, maturity))}%` }} /></div></>}
            </div>
          </div>
        </button>
        <details className="mt-3 rounded-[8px] border border-slate-200 bg-slate-50 p-3">
          <summary className="cursor-pointer text-xs font-black text-cyan-700">Puan Detayı</summary>
          <div className="mt-3 grid gap-3">
            {renderBreakdown("Müşteri Sıcaklık Puanı", breakdown.heat || [], heatTotal, "text-cyan-700")}
            {renderBreakdown("Dijital Olgunluk Skoru", breakdown.maturity || [], maturityTotal, "text-emerald-700")}
          </div>
        </details>
        <div className="mt-3 flex flex-wrap gap-2">{!existingLead && <button disabled={loading === `save-${placeId}`} onClick={() => saveBusiness(item)} className="rounded-full bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950">CRM'e Kaydet</button>}<button disabled={loading === `analyze-${existingLead?.id}`} onClick={() => analyze(record)} className="rounded-full border border-cyan-200/20 px-3 py-2 text-xs font-bold text-cyan-700">AI Analiz Yap</button><button onClick={() => proposalFor(record)} className="rounded-full border border-amber-200/25 px-3 py-2 text-xs font-bold text-amber-700">Teklif Oluştur</button><button onClick={() => setWhatsappDraft({ id: placeId || record.id, text: outreachText(record), phone: record.phone })} className="rounded-full border border-emerald-200/25 px-3 py-2 text-xs font-bold text-emerald-700">WhatsApp Mesajı Hazırla</button>{existingLead && <button onClick={() => setActive("Lead Yönetimi")} className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold">CRM Detayı</button>}<button onClick={() => setNotePlaceId(notePlaceId === placeId ? "" : placeId)} className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold">Not Ekle</button>{placeId && <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/place/?q=place_id:${placeId}`} className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold">Google Maps'te Aç</a>}</div>
        {whatsappDraft?.id === (placeId || record.id) && <div className="mt-3 rounded-[8px] border border-emerald-200/20 bg-emerald-200/10 p-3"><p className="text-xs font-black text-emerald-700">Hazır WhatsApp mesajı</p><textarea value={whatsappDraft.text} onChange={(event) => setWhatsappDraft({ ...whatsappDraft, text: event.target.value })} className="mt-2 min-h-24 w-full rounded-[8px] border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-900" /><a target="_blank" rel="noreferrer" href={`https://wa.me/${String(whatsappDraft.phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(whatsappDraft.text)}`} className="mt-2 inline-flex rounded-full bg-[#25D366] px-3 py-2 text-xs font-black text-slate-900">WhatsApp’ta Aç</a></div>}
        {notePlaceId === placeId && <div className="mt-3"><TextArea rows={2} label="Fırsat notu" value={existingLead?.local_opportunity_notes || noteDrafts[placeId] || ""} onChange={(local_opportunity_notes) => existingLead ? patchLead(existingLead.id, { local_opportunity_notes }) : setNoteDrafts({ ...noteDrafts, [placeId]: local_opportunity_notes })} /></div>}
      </article>
    );
  };

  if (tab === "Fırsat Haritası") {
    return <Panel title="Fırsat Haritası"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="max-w-3xl text-sm leading-6 text-slate-400">Bölgesel potansiyeli ilçe ve sektör seviyesinde okuyun; seçiminizi Google Maps müşteri bulma akışına aktararak gerçek işletmeleri keşfedin.</p><span className="rounded-full border border-orange-300/30 bg-orange-300/10 px-3 py-2 text-xs font-black text-orange-700">Opportunity Map (Fırsat Haritası)</span></div><HubTabs items={mapTabs} active={tab} onChange={setTab} /><OpportunityMap search={{ ...search, sector: search.businessType }} setSearch={(next) => setSearch({ ...search, ...next, businessType: next.businessType || next.sector || search.businessType })} setTab={setTab} setActive={setActive} saved={saved} /></Panel>;
  }

  return <Panel title={mode === "Haritalar" ? "Harita Zekâsı" : "İşletme Keşfi"}><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="max-w-3xl text-sm leading-6 text-slate-400">İl, ilçe, sektör, Google puanı ve yorum filtreleriyle işletmeleri tarayın; sıcaklık skoruna göre CRM’e taşıyıp AI analiz, teklif ve WhatsApp mesajı oluşturun.</p><div className="flex gap-2 text-xs"><span className="rounded-full border border-slate-200 px-3 py-2">{results.length} sonuç</span><span className="rounded-full border border-slate-200 px-3 py-2">{saved.length} kayıtlı</span><span className="rounded-full border border-red-300/20 px-3 py-2 text-red-200">{saved.filter((lead) => Number(lead.lead_heat_score || 0) >= 70).length} sıcak lead</span></div></div><HubTabs items={mapTabs} active={tab} onChange={setTab} /><div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_420px]"><aside className="h-fit rounded-[8px] border border-slate-200 bg-slate-50 p-4"><h3 className="font-black">Arama ve filtreler</h3><div className="mt-4 grid gap-3"><OtherSelectField label="İl seçimi" value={search.city} onChange={(city) => setSearch({ ...search, city })} options={cityOptions} manualLabel="İli yazın" /><Field label="İlçe seçimi" value={search.district} onChange={(district) => setSearch({ ...search, district })} /><Field label="İşletme / sektör alanı" value={search.businessType} onChange={(businessType) => setSearch({ ...search, businessType })} placeholder="oto galeri, emlak ofisi, diş kliniği..." /><SelectField label="Minimum Google yıldız puanı" value={search.minimumRating} onChange={(minimumRating) => setSearch({ ...search, minimumRating })} options={[{ value: "", label: "Farketmez" }, { value: "3", label: "3.0+" }, { value: "3.5", label: "3.5+" }, { value: "4", label: "4.0+" }, { value: "4.5", label: "4.5+" }]} /><SelectField label="Minimum yorum sayısı" value={search.minimumReviewCount} onChange={(minimumReviewCount) => setSearch({ ...search, minimumReviewCount })} options={[{ value: "", label: "Farketmez" }, { value: "5", label: "5+" }, { value: "10", label: "10+" }, { value: "25", label: "25+" }, { value: "50", label: "50+" }, { value: "100", label: "100+" }]} /><SelectField label="Website durumu" value={search.website} onChange={(website) => setSearch({ ...search, website })} options={[{ value: "", label: "Farketmez" }, { value: "yok", label: "Websitesi olmayanlar" }, { value: "var", label: "Websitesi olanlar" }]} /><SelectField label="Telefon durumu" value={search.phone} onChange={(phone) => setSearch({ ...search, phone })} options={[{ value: "", label: "Farketmez" }, { value: "var", label: "Telefonu olanlar" }, { value: "yok", label: "Telefonu olmayanlar" }]} /><label className="flex gap-2 text-xs text-slate-600"><input type="checkbox" checked={search.hideSaved} onChange={(event) => setSearch({ ...search, hideSaved: event.target.checked })} />CRM’de kayıtlı olanları gizle</label></div><button disabled={loading === "search" || !canDiscover} onClick={runSearch} className="mt-4 w-full rounded-[8px] bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50">{loading === "search" ? "Taranıyor..." : "İşletmeleri Tara"}</button><button onClick={clearFilters} className="mt-2 w-full rounded-[8px] border border-slate-200 px-4 py-2 text-xs font-bold">Filtreleri temizle</button><div className="mt-3 flex flex-wrap gap-1">{activeFilters.map(([key, value]) => <span key={key} className="rounded-full border border-cyan-200/20 px-2 py-1 text-[9px] text-cyan-700">{String(value)}</span>)}</div><div className="mt-4"><ScoringGuidePanel /></div></aside><section className="min-w-0"><MapIntelligenceCanvas businesses={visible} districts={districts} sectors={sectors} selectedPlaceId={selectedPlaceId} setSelectedPlaceId={setSelectedPlaceId} setSearch={(next) => setSearch({ ...search, ...next, businessType: next.businessType || next.sector || search.businessType })} search={{ ...search, sector: search.businessType }} /></section><aside className="premium-scrollbar max-h-[900px] overflow-y-auto rounded-[8px] border border-slate-200 bg-slate-50 p-3"><h3 className="px-1 font-black">Bulunan İşletmeler</h3>{message && <p className="mt-3 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-xs leading-5 text-cyan-700">{message}</p>}<div className="mt-3 grid gap-3">{loading === "search" ? [1, 2, 3, 4].map((item) => <div key={item} className="h-40 animate-pulse rounded-[8px] bg-slate-50" />) : visible.map(renderBusiness)}{!loading && !visible.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-5 text-center text-xs leading-5 text-slate-400">{results.length ? "Bu filtrelerle işletme bulunamadı. Yıldız puanı veya yorum sayısı filtresini genişletmeyi deneyin." : "Henüz arama yapılmadı. Sol panelden il, ilçe ve işletme türü seçerek İşletmeleri Tara düğmesine basın."}</p>}</div></aside></div></Panel>;
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
  return <div><div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-slate-200 bg-slate-50 p-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-orange-700">{district ? `${district} · sektör görünümü` : `${search.city || "Manisa"} · ilçe görünümü`}</p><h3 className="mt-2 text-xl font-black text-slate-900">{district ? "Sektör fırsatlarını karşılaştırın" : "Öncelikli bölgeleri keşfedin"}</h3></div>{district && <button onClick={() => { setDistrict(""); setSector(""); setSearch({ ...search, district: "", sector: "" }); }} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-black">İlçe görünümüne dön</button>}</div><div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]"><section className="grid gap-3 sm:grid-cols-2">{cards.map((item) => { const level = opportunityLevel(item.score); const active = item.name === (district ? sector : district); return <button key={item.name} onClick={() => select(item)} className={`min-h-56 rounded-[8px] border p-5 text-left shadow-[0_18px_54px_rgba(0,0,0,.16)] transition hover:-translate-y-1 ${level.className} ${active ? "ring-2 ring-cyan-200/70" : ""}`}><div className="flex items-start justify-between gap-3"><h4 className="text-lg font-black text-slate-900">{item.name}</h4><span className="text-3xl font-black text-slate-900">{item.score}<small className="text-sm">/100</small></span></div><p className="mt-3 text-xs font-black uppercase">{level.label}</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-50"><div className="h-full rounded-full bg-current" style={{ width: `${item.score}%` }} /></div><div className="mt-5 grid gap-1 text-xs leading-5"><span>Meta rekabet yoğunluğu: <strong>{item.meta}</strong></span><span>Google potansiyeli: <strong>{item.google}</strong></span><span>{district ? "Başlangıç alt sektörü" : "Öne çıkan kategori"}: <strong>{item.subSector || item.category}</strong></span>{!district && <span>Kayıtlı işletme: <strong>{item.count}</strong></span>}</div></button>; })}</section><aside className="h-fit rounded-[8px] border border-cyan-200/20 bg-white p-5 shadow-[0_22px_70px_rgba(0,0,0,.28)]"><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Fırsat detayı</p><h3 className="mt-3 text-2xl font-black text-slate-900">{selected?.name}</h3><p className="mt-2 text-4xl font-black text-orange-700">{selected?.score}<small className="text-sm text-slate-400"> / 100</small></p><p className="mt-4 text-sm leading-6 text-slate-600">{opportunityLevel(selected?.score).label}. {selected?.action || "Alt sektörleri inceleyip gerçek işletme keşfini başlatın."}</p><p className="mt-4 text-xs leading-5 text-slate-400">Önerilen alt sektörler: {selected?.subSector || selected?.category}</p><div className="mt-5 grid gap-2"><button onClick={transfer} className="rounded-[8px] bg-cyan-300 px-4 py-3 text-xs font-black text-slate-950">Müşteri Bulmaya Aktar</button><button onClick={transfer} className="rounded-[8px] border border-cyan-200/20 px-4 py-3 text-xs font-black text-cyan-700">İşletme Keşfine Gönder</button><button onClick={() => setActive("AI Studio")} className="rounded-[8px] border border-slate-200 px-4 py-3 text-xs font-black">AI Analiz Açısı Üret</button><button onClick={() => setActive("Teklif Motoru")} className="rounded-[8px] border border-slate-200 px-4 py-3 text-xs font-black">Teklif Açısı Hazırla</button></div></aside></div><div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{opportunityLegend.map(([score, label, text, action]) => { const level = opportunityLevel(score); return <div key={label} className={`rounded-[8px] border p-3 ${level.className}`}><p className="text-xs font-black">{label}</p><p className="mt-2 text-[11px] leading-5">{text}</p><p className="mt-2 text-[10px] leading-4 opacity-80">{action}</p></div>; })}</div></div>;
}

function MapIntelligenceCanvas({ businesses, districts, sectors, selectedPlaceId, setSelectedPlaceId, setSearch, search }: any) {
  return <div className="overflow-hidden rounded-[8px] border border-slate-200 bg-white"><div className="border-b border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Map Intelligence Canvas</p><h3 className="mt-1 text-lg font-black">Bölgesel fırsat haritası</h3></div><div className="flex flex-wrap gap-1.5">{opportunityLegend.map(([score, label]) => <span key={label} className={`rounded-full border px-2 py-1 text-[9px] font-black ${opportunityLevel(score).className}`}>{label}</span>)}</div></div><div className="mt-3 flex flex-wrap gap-1.5">{sectors.map((item) => <button key={item.sector} onClick={() => setSearch({ ...search, sector: item.sector })} className={`rounded-full border px-2.5 py-1.5 text-[10px] font-bold ${search.sector === item.sector ? "border-cyan-200/60 bg-cyan-200/15 text-cyan-700" : "border-slate-200 text-slate-400"}`}>{item.sector} · {item.count} · {item.hot} sıcak · {item.opportunity.label}</button>)}</div></div><div className="relative min-h-[420px] overflow-hidden p-4"><div className="premium-grid absolute inset-0 opacity-70" /><div className="relative grid gap-3 sm:grid-cols-2">{districts.map((district) => <button key={district.name} onClick={() => setSearch({ ...search, district: district.name })} className={`relative min-h-36 overflow-hidden rounded-[8px] border p-4 text-left transition hover:-translate-y-1 ${district.opportunity.className}`}><span className="text-sm font-black text-slate-900">{district.name}</span><span className="mt-2 block text-xs">{district.items.length} işletme · {district.hot} sıcak lead</span><span className="mt-1 block text-xs">Ort. puan {district.rating} · Olgunluk {district.maturity}</span><span className="mt-3 block text-[10px] font-black uppercase">{district.opportunity.label}</span>{district.sectors.length > 0 && <span className="mt-2 block text-[10px] opacity-80">{district.sectors.join(" · ")}</span>}</button>)}{!districts.length && <div className="col-span-full grid min-h-72 place-items-center rounded-[8px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><div><MapPinned className="mx-auto text-cyan-700" size={34} /><p className="mt-4 font-black">Harita katmanı veri bekliyor</p><p className="mt-2 max-w-md text-xs leading-5 text-slate-400">İşletme araması yaptığınızda ilçeler, sektörler ve fırsat yoğunlukları gerçek sonuçlardan otomatik oluşur.</p></div></div>}</div><div className="pointer-events-none absolute inset-0">{businesses.slice(0, 16).map((item, index) => { const placeId = item.placeId || item.google_place_id; const level = opportunityLevel(item.leadHeatScore ?? item.lead_heat_score); return <button key={placeId || index} onClick={() => setSelectedPlaceId(placeId)} className={`pointer-events-auto absolute grid size-5 place-items-center rounded-full border-2 border-white/70 shadow-lg transition hover:scale-150 ${level.pin} ${selectedPlaceId === placeId ? "scale-150 ring-4 ring-cyan-200/30" : ""}`} style={{ left: `${12 + index * 23 % 78}%`, top: `${18 + index * 31 % 68}%` }} title={item.name || item.company}><span className="size-1.5 rounded-full bg-white" /></button>; })}</div></div></div>;
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
  const checklist = (key, labels) => <div className="rounded-[8px] border border-slate-200 p-4"><h3 className="font-black">{key === "customer_checklist" ? "Müşteri hazırlık kontrolü" : "Kampanya hazırlık kontrolü"}</h3><div className="mt-3 grid gap-2">{labels.map((label) => <label key={label} className="flex gap-2 text-sm text-slate-600"><input type="checkbox" checked={(form[key] || []).includes(label)} onChange={(event) => setForm({ ...form, [key]: event.target.checked ? [...(form[key] || []), label] : (form[key] || []).filter((item) => item !== label) })} />{label}</label>)}</div></div>;
  return <Panel title={mode}><p className="mb-5 text-sm leading-6 text-slate-400">Müşteri hazırlığını, marka analizini, hedef kitleyi ve kampanya yaklaşımını tek çalışma alanında toparlayın.</p><CompanySelect value={form.company_id} onChange={selectCompany} companies={content.companies} /><div className="mt-4 grid gap-4 md:grid-cols-2">{checklist("customer_checklist", ["Firma bilgileri tamamlandı", "Hedef netleştirildi", "Teklif yaklaşımı belirlendi", "İletişim kişisi doğrulandı"])}{checklist("campaign_checklist", ["Ölçümleme kontrol edildi", "Hedef kitle hazırlandı", "Kreatif ihtiyaçları listelendi", "Bütçe ve dönem belirlendi"])}<TextArea label="Marka analizi" value={form.brand_analysis} onChange={(value) => setForm({ ...form, brand_analysis: value })} /><TextArea label="SWOT notları" value={form.swot_notes} onChange={(value) => setForm({ ...form, swot_notes: value })} /><TextArea label="Hedef kitle notları" value={form.target_audience_notes} onChange={(value) => setForm({ ...form, target_audience_notes: value })} /><TextArea label="Teklif konumlandırması" value={form.offer_positioning} onChange={(value) => setForm({ ...form, offer_positioning: value })} /><TextArea label="Müşteri yolculuğu planı" value={form.funnel_planning} onChange={(value) => setForm({ ...form, funnel_planning: value })} /><TextArea label="İçerik fikirleri" value={form.content_ideas} onChange={(value) => setForm({ ...form, content_ideas: value })} /><TextArea label="Reklam açıları" value={form.ad_angle_ideas} onChange={(value) => setForm({ ...form, ad_angle_ideas: value })} /><TextArea label="Prompt kısayolları" value={form.prompt_shortcuts} onChange={(value) => setForm({ ...form, prompt_shortcuts: value })} /></div><div className="mt-5 flex flex-wrap gap-2"><button onClick={save} className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">Hazırlığı kaydet</button><button onClick={() => setActive("AI Studio")} className="rounded-full border border-slate-200 px-4 py-3 text-sm">AI Studio'ya gönder</button><button onClick={() => setActive("CRM")} className="rounded-full border border-slate-200 px-4 py-3 text-sm">CRM'e git</button><button onClick={() => setActive("Teklif Motoru")} className="rounded-full border border-slate-200 px-4 py-3 text-sm">Teklif oluştur</button><button onClick={() => setActive("Raporlar")} className="rounded-full border border-slate-200 px-4 py-3 text-sm">Rapor oluştur</button></div>{message && <p className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-700">{message}</p>}</Panel>;
}

const themePresets = {
  "HK Premium Marka": { background: "#f8fafc", surface: "#ffffff", text: "#334155", mutedText: "#64748b", primaryButton: "#0ea5e9", secondaryButton: "#e0f2fe", accent: "#facc15", sidebar: "#ffffff", header: "#ffffff", border: "#e2e8f0", success: "#16a34a", warning: "#f59e0b", danger: "#dc2626" },
  "HK Light Marka": { background: "#eef4fa", surface: "#ffffff", text: "#2563eb", mutedText: "#475569", primaryButton: "#0369a1", secondaryButton: "#dbeafe", accent: "#b45309", sidebar: "#ffffff", header: "#f8fafc", border: "#b8c7d9", success: "#047857", warning: "#b45309", danger: "#b91c1c" },
  "HK Sarı Vurgu": { background: "#fffdf2", surface: "#ffffff", text: "#1f2937", mutedText: "#64748b", primaryButton: "#eab308", secondaryButton: "#fef3c7", accent: "#facc15", sidebar: "#ffffff", header: "#ffffff", border: "#fde68a", success: "#16a34a", warning: "#d97706", danger: "#dc2626" },
  "Ajans Mavi Turuncu": { background: "#f8fafc", surface: "#ffffff", text: "#1e293b", mutedText: "#64748b", primaryButton: "#38bdf8", secondaryButton: "#e0f2fe", accent: "#fb923c", sidebar: "#ffffff", header: "#f8fafc", border: "#dbe4ef", success: "#16a34a", warning: "#fb923c", danger: "#dc2626" }
};

const themeFieldLabels: Record<string, string> = {
  background: "Arka Plan",
  surface: "Kart Zemini",
  text: "Ana Yazı",
  mutedText: "Yardımcı Yazı",
  primaryButton: "Birincil Buton",
  secondaryButton: "İkincil Buton",
  accent: "Vurgu Rengi",
  sidebar: "Menü Zemini",
  header: "Üst Alan",
  border: "Kenarlık",
  success: "Başarı",
  warning: "Uyarı",
  danger: "Tehlike"
};

function ThemeEditor() {
  const [theme, setTheme] = useState(themePresets["HK Light Marka"]);
  const [message, setMessage] = useState("");
  function apply(next) {
    setTheme(next);
  }
  async function save() {
    const response = await fetch("/api/admin/theme", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(theme) });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? data.message : data.supabaseError || data.error || "Tema kaydedilemedi.");
  }
  return (
    <Panel title="Tema Ayarları">
      <p className="mb-3 text-sm leading-6 text-slate-600">Admin panel artık sabit okunur light tema kullanır. Renk ayarları web sitesi veya marka alanları için kullanılır.</p>
      <p className="mb-5 rounded-[8px] border border-cyan-200 bg-cyan-50 p-3 text-sm font-semibold leading-6 text-cyan-800">Bu ekrandaki renk önizlemeleri admin arayüzü yüzeylerini değiştirmez; admin panel beyaz, okunur ve sabit light tema ile çalışır.</p>
      <div className="mb-5 flex flex-wrap gap-2">
        {Object.entries(themePresets).map(([label, preset]) => (
          <button key={label} onClick={() => apply(preset)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold">{label}</button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(theme).map(([key, value]) => (
            <Field key={key} label={themeFieldLabels[key] || key} type="color" value={value} onChange={(next) => apply({ ...theme, [key]: next })} />
          ))}
        </div>
        <div className="rounded-[8px] border p-4" style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}>
          <p className="text-xs font-black uppercase" style={{ color: theme.accent }}>Canlı önizleme</p>
          <h3 className="mt-3 text-xl font-black">HK Dijital Premium Panel</h3>
          <p className="mt-2 text-sm" style={{ color: theme.mutedText }}>Marka ve web sitesi renklerini burada birlikte değerlendirin.</p>
          <button className="mt-5 rounded-full px-4 py-2 text-sm font-black" style={{ backgroundColor: theme.primaryButton, color: theme.background }}>Birincil işlem</button>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button onClick={save} className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">Temayı kaydet</button>
        <button onClick={() => apply(themePresets["HK Light Marka"])} className="rounded-full border border-slate-200 px-5 py-3 text-sm">Varsayılanlara dön</button>
      </div>
      {message && <p className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-700">{message}</p>}
    </Panel>
  );
}


function AnalysisSearchForm({ form, setForm, buttonLabel, loading, onSubmit }: any) {
  const districts = analysisDistrictOptions[form.city] || analysisDistrictOptions.Manisa;
  function updateCity(city) {
    const nextDistricts = analysisDistrictOptions[city] || analysisDistrictOptions.Manisa;
    setForm({ ...form, city, district: nextDistricts[0] || "" });
  }
  return <div className="rounded-[8px] border border-amber-200/15 bg-slate-50 p-4 shadow-[0_22px_70px_rgba(0,0,0,.2)]"><div className="grid gap-4 md:grid-cols-3"><SelectField label="İl seç" value={form.city} onChange={updateCity} options={cityOptions} /><SelectField label="İlçe seç" value={form.district} onChange={(district) => setForm({ ...form, district })} options={districts} /><OtherSelectField label="Sektör seç" value={form.sector} onChange={(sector) => setForm({ ...form, sector })} options={sectorOptions} manualLabel="Sektörü yazın" /></div><button onClick={onSubmit} disabled={loading} className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-amber-300 px-6 text-sm font-black text-slate-950 shadow-[0_16px_42px_rgba(251,191,36,.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Analiz ediliyor..." : buttonLabel}</button></div>;
}

function valueOrMissing(value: any) {
  return value ? String(value) : "Bulunamadı";
}

function auditFilenameFallback(businessName: string) {
  const name = String(businessName || "business").toLocaleLowerCase("tr").replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ]+/gi, "-").replace(/^-|-$/g, "") || "business";
  return `hk-dijital-mini-audit-${name}-${new Date().toISOString().slice(0, 10)}.pdf`;
}

function filenameFromDisposition(disposition: string | null, fallback: string) {
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
}

async function downloadAuditPdf(payload: any) {
  const response = await fetch("/api/admin/pdf-audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("application/pdf")) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "PDF oluşturulamadı. Geçersiz PDF verisi alındı.");
  }
  const arrayBuffer = await response.arrayBuffer();
  const header = new TextDecoder().decode(arrayBuffer.slice(0, 5));
  console.log("[pdf-audit] response", { size: arrayBuffer.byteLength, contentType, header });
  if (arrayBuffer.byteLength <= 1024 || !header.startsWith("%PDF-")) {
    throw new Error("PDF oluşturulamadı. Geçersiz PDF verisi alındı.");
  }
  const blob = new Blob([arrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filenameFromDisposition(response.headers.get("content-disposition"), auditFilenameFallback(payload.businessName));
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
    <div className="fixed inset-0 z-[80] grid place-items-center bg-white/70 p-4">
      <div className="premium-scrollbar max-h-[92vh] w-full max-w-4xl overflow-auto rounded-[8px] border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className={`text-xs font-black uppercase tracking-[.16em] ${kind === "meta" ? "text-orange-700" : "text-yellow-200"}`}>{kind === "meta" ? "Meta Analiz Detayı" : "Google Ads Analiz Detayı"}</p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">{item.name}</h2>
            <AiUsageBadge meta={aiMeta} />
          </div>
          <button onClick={onClose} className="grid size-10 place-items-center rounded-full border border-slate-200"><X size={18} /></button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-[8px] border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-500">{label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{valueOrMissing(value)}</p>
            </div>
          ))}
        </div>
        {!!linkRows.length && <div className="mt-4 flex flex-wrap gap-2">{linkRows.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer" className="rounded-full border border-cyan-200/20 px-4 py-2 text-xs font-black text-cyan-700">{label}</a>)}</div>}
        {message && <p className={`mt-4 rounded-[8px] border p-3 text-sm ${message.includes("zaten") || message.includes("hata") ? "border-amber-300/25 bg-amber-300/10 text-amber-700" : "border-emerald-300/25 bg-emerald-300/10 text-emerald-700"}`}>{message}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-slate-200 px-4 py-2 text-sm">Kapat</button>
          <button onClick={onSave} disabled={saving || saved} className="rounded-full bg-amber-300 px-5 py-2 text-sm font-black text-slate-950 disabled:opacity-60">{saved ? "CRM’e Kaydedildi" : saving ? "CRM’e kaydediliyor..." : "CRM’e Kaydet"}</button>
        </div>
      </div>
    </div>
  );
}

function AnalysisResultCard({ kind, item, form, aiMeta, saved, saving, message, onOpen, onSave }: any) {
  const isMeta = kind === "meta";
  async function downloadResultPdf(event: any) {
    event.stopPropagation();
    try {
      await downloadAuditPdf({
        businessName: item.name,
        source: isMeta ? "Meta Analiz" : "Google Ads Analiz",
        leadScore: { score: isMeta ? 70 : item.searchVisibilityScore || 65, temperature: isMeta ? "Ilık" : Number(item.searchVisibilityScore || 0) >= 80 ? "Sıcak" : "Ilık" },
        ai: aiMeta,
        platforms: [{ platform: isMeta ? item.platform || "Facebook / Instagram" : "Google", username: item.name, profileUrl: item.adUrl || item.metaAdLibraryUrl || item.website || item.googleSearchUrl }],
        outputs: [
          { action: "Executive Summary", text: item.summary || item.adActivitySignal || item.googleBusinessPresence, ai: aiMeta },
          { action: "Düzeltilmesi Gerekenler", text: item.ctaAnalysis || item.opportunityNote || item.adActivitySignal || "" },
          { action: "Meta Reklam Stratejisi", text: item.creativeAnalysis || item.summary || "" },
          { action: "Google Reklam Stratejisi", text: Array.isArray(item.keywordOpportunities) ? item.keywordOpportunities.join("\n") : item.adActivitySignal || "" },
          { action: "Teklif Hazırlama", text: "Starter: 10.000 TL\nPro: 15.000 TL\nPremium: 25.000 TL" }
        ],
        summary: item.summary || item.adActivitySignal || item.googleBusinessPresence
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : "PDF oluşturulamadı. Geçersiz PDF verisi alındı.");
    }
  }
  return (
    <button type="button" onClick={onOpen} className="rounded-[8px] border border-slate-200 bg-white/[0.045] p-5 text-left shadow-[0_22px_70px_rgba(0,0,0,.22)] transition hover:-translate-y-1 hover:border-amber-200/40 hover:bg-white/[0.07]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-black uppercase tracking-[.14em] ${isMeta ? "text-orange-700" : "text-yellow-200"}`}>{isMeta ? (item.platform || "Facebook / Instagram") : "Google Ads Analiz"}</p>
          <h3 className="mt-2 text-lg font-black text-slate-900">{item.name}</h3>
          <p className="mt-1 text-xs text-slate-500">{isMeta ? `${form.city} / ${form.district} / ${form.sector}` : (item.website || "Website bilgisi yok")}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-black ${isMeta ? (item.active ? "bg-emerald-300/12 text-emerald-700" : "bg-slate-400/10 text-slate-600") : "bg-yellow-300/12 text-yellow-100"}`}>{isMeta ? (item.active ? "Aktif reklam var" : "Aktif reklam sinyali yok") : `${item.searchVisibilityScore}/100 görünürlük`}</span>
          {isMeta && item.demo && <span className="rounded-full bg-amber-300/14 px-3 py-1 text-xs font-black text-amber-700">Demo Veri</span>}
          {saved && <span className="rounded-full bg-emerald-300/12 px-3 py-1 text-xs font-black text-emerald-700">CRM’e Kaydedildi</span>}
        </div>
      </div>
      <AiUsageBadge meta={aiMeta} />
      <p className="mt-4 text-sm leading-6 text-slate-600">{item.summary || item.adActivitySignal || item.googleBusinessPresence}</p>
      <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
        {isMeta ? <>
          <span>Tahmini kategori: <strong className="text-slate-700">{item.category || item.sector || "-"}</strong></span>
          <span>CTA: <strong className="text-slate-700">{item.cta || "-"}</strong></span>
          <span>Başlangıç: <strong className="text-slate-700">{item.startDate || "-"}</strong></span>
          <span>Yoğunluk: <strong className="text-slate-700">{item.estimatedAdIntensity || item.activeStatus || "-"}</strong></span>
        </> : <>
          <span>Google Business: <strong className="text-slate-700">{item.googleBusinessPresence}</strong></span>
          <span>Reklam sinyali: <strong className="text-slate-700">{item.adActivitySignal}</strong></span>
          <span>Telefon: <strong className="text-slate-700">{item.phone || "Bulunamadı"}</strong></span>
          <span>Adres: <strong className="text-slate-700">{item.address || "Bulunamadı"}</strong></span>
        </>}
      </div>
      {!isMeta && <div className="mt-4 flex flex-wrap gap-2">{(item.keywordOpportunities || []).map((keyword) => <span key={keyword} className="rounded-full border border-yellow-200/20 px-3 py-1 text-xs text-yellow-100">{keyword}</span>)}</div>}
      {message && <p className={`mt-4 rounded-[8px] border p-2 text-xs ${message.includes("zaten") || message.includes("hata") ? "border-amber-300/25 bg-amber-300/10 text-amber-700" : "border-emerald-300/25 bg-emerald-300/10 text-emerald-700"}`}>{message}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={(event) => { event.stopPropagation(); onSave(); }} disabled={saving || saved} className="rounded-full bg-amber-300 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-60">{saved ? "CRM’e Kaydedildi" : saving ? "CRM’e kaydediliyor..." : "CRM’e Kaydet"}</button>
        {isMeta && (item.adUrl || item.metaAdLibraryUrl) && <a href={item.adUrl || item.metaAdLibraryUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="rounded-full border border-orange-200/25 px-4 py-2 text-xs font-black text-orange-700">Reklamı Aç</a>}
        {isMeta && <button type="button" onClick={(event) => { event.stopPropagation(); onOpen(); }} className="rounded-full border border-cyan-200/25 px-4 py-2 text-xs font-black text-cyan-700">AI ile Reklamı Yorumla</button>}
        <button type="button" onClick={downloadResultPdf} className="rounded-full border border-amber-200/25 px-4 py-2 text-xs font-black text-amber-700">PDF Audit Oluştur</button>
        <span className="rounded-full border border-slate-200 px-4 py-2 text-xs font-black text-slate-600">Detayı aç</span>
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
  const { askAiProvider, chooserModal } = useAiProviderChooser();
  const [form, setForm] = useState({ city: "Manisa", district: "Yunusemre", sector: "Restoran" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [results, setResults] = useState([]);
  const [aiMeta, setAiMeta] = useState(aiMetaFromApi({ activeProvider: "Demo Modu", model: "meta-analysis-demo", demoMode: true }));
  const [metaStatusMessage, setMetaStatusMessage] = useState("");
  const crm = useAnalysisCrmSaving("meta", form);
  async function analyze(aiProvider = "Groq") {
    setLoading(true);
    setError("");
    setWarning("");
    setResults([]);
    try {
      const response = await fetch("/api/admin/meta-analysis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, aiProvider }) });
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
  async function testMetaConnection() {
    setMetaStatusMessage("Meta bağlantısı test ediliyor...");
    const response = await fetch("/api/admin/meta-status");
    const data = await response.json().catch(() => ({}));
    setMetaStatusMessage(response.ok ? data.message || "Meta bağlantısı test edildi." : data.errorMessage || data.error || "Meta bağlantısı test edilemedi.");
  }
  return <Panel title="Meta Analiz"><div className="mb-5 rounded-[8px] border border-orange-300/20 bg-gradient-to-br from-orange-300/12 via-yellow-200/5 to-transparent p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-orange-700">Meta Business Suite Workspace</p><h2 className="mt-2 text-2xl font-black text-slate-900">Facebook ve Instagram reklam sinyallerini ayrı analiz edin</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">İl, ilçe ve sektör seçimine göre Meta Ad Library odaklı gözlemler, CTA ve kreatif metin özetleri üretir.</p></div><div className="flex flex-wrap gap-2"><button disabled={loading} onClick={() => askAiProvider(analyze)} className="rounded-[8px] bg-orange-300 px-4 py-3 text-xs font-black text-slate-950 disabled:opacity-60">Meta Sonuçlarını Yenile</button><button onClick={testMetaConnection} className="rounded-[8px] border border-orange-200/30 px-4 py-3 text-xs font-black text-orange-700">Meta Bağlantısını Test Et</button></div></div></div><div className="mb-5 grid gap-3 md:grid-cols-3"><div className="rounded-[8px] border border-orange-200/20 bg-orange-300/[0.08] p-4"><p className="text-xs font-black text-orange-700">Ad Preview</p><p className="mt-2 text-sm leading-6 text-slate-600">Kreatif, CTA ve platform sinyalleri kart bazında okunur.</p></div><div className="rounded-[8px] border border-cyan-200/20 bg-cyan-300/[0.08] p-4"><p className="text-xs font-black text-cyan-700">CTA Analysis</p><p className="mt-2 text-sm leading-6 text-slate-600">Mesaj, form, trafik ve teklif açısı birlikte değerlendirilir.</p></div><div className="rounded-[8px] border border-pink-200/20 bg-pink-300/[0.08] p-4"><p className="text-xs font-black text-pink-100">Creative Analysis</p><p className="mt-2 text-sm leading-6 text-slate-600">Reklam dili ve kreatif fırsatlar CRM'e taşınabilir.</p></div></div><AnalysisSearchForm form={form} setForm={setForm} loading={loading} onSubmit={() => askAiProvider(analyze)} buttonLabel="Meta Reklamlarını Analiz Et" />{metaStatusMessage && <p className="mt-4 rounded-[8px] border border-orange-300/25 bg-orange-300/10 p-3 text-sm text-orange-700">{metaStatusMessage}</p>}{warning && <p className="mt-4 rounded-[8px] border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-700">{warning}</p>}{error && <p className="mt-4 rounded-[8px] border border-red-300/25 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}<div className="mt-5 grid gap-4 lg:grid-cols-2">{results.map((item) => { const id = item.id || item.name; return <AnalysisResultCard key={id} kind="meta" item={item} form={form} aiMeta={aiMeta} saved={crm.savedIds[id]} saving={crm.savingId === id} message={crm.messages[id]} onOpen={() => askAiProvider(() => crm.setSelected(item))} onSave={() => crm.save(item)} />; })}{!loading && !error && !results.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400 lg:col-span-2">Bu seçim için sonuç bulunamadı.</p>}</div>{crm.selected && <AnalysisDetailModal kind="meta" item={crm.selected} form={form} aiMeta={aiMeta} saved={crm.savedIds[crm.selected.id || crm.selected.name]} saving={crm.savingId === (crm.selected.id || crm.selected.name)} message={crm.messages[crm.selected.id || crm.selected.name]} onClose={() => crm.setSelected(null)} onSave={() => crm.save(crm.selected)} />}{chooserModal}</Panel>;
}

function GoogleAdsAnalysisSection() {
  const { askAiProvider, chooserModal } = useAiProviderChooser();
  const [form, setForm] = useState({ city: "Manisa", district: "Yunusemre", sector: "Restoran" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [results, setResults] = useState([]);
  const [aiMeta, setAiMeta] = useState(aiMetaFromApi({ activeProvider: "Demo Modu", model: "google-analysis-demo", demoMode: true }));
  const crm = useAnalysisCrmSaving("google", form);
  async function analyze(aiProvider = "Groq") {
    setLoading(true);
    setError("");
    setWarning("");
    setResults([]);
    try {
      const response = await fetch("/api/admin/google-analysis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, aiProvider }) });
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
  return <Panel title="Google Ads Analiz"><div className="mb-5 rounded-[8px] border border-yellow-300/20 bg-gradient-to-br from-yellow-300/12 via-orange-200/5 to-transparent p-5"><p className="text-xs font-black uppercase tracking-[.16em] text-yellow-200">Google Ads Workspace</p><h2 className="mt-2 text-2xl font-black text-slate-900">Arama görünürlüğü ve yerel reklam fırsatlarını ayrı analiz edin</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Google Maps ve işletme sinyallerinden arama görünürlüğü, anahtar kelime fırsatı ve kampanya tipi önerileri üretir.</p></div><div className="mb-5 grid gap-3 md:grid-cols-4"><div className="rounded-[8px] border border-sky-200/20 bg-sky-300/[0.08] p-4"><p className="text-xs font-black text-sky-100">Keyword Opportunities</p><p className="mt-2 text-sm leading-6 text-slate-600">Yüksek niyetli arama kelimeleri.</p></div><div className="rounded-[8px] border border-emerald-200/20 bg-emerald-300/[0.08] p-4"><p className="text-xs font-black text-emerald-700">Business Signals</p><p className="mt-2 text-sm leading-6 text-slate-600">Maps, yorum ve görünürlük sinyalleri.</p></div><div className="rounded-[8px] border border-amber-200/20 bg-amber-300/[0.08] p-4"><p className="text-xs font-black text-amber-700">Competition Level</p><p className="mt-2 text-sm leading-6 text-slate-600">Rekabet ve bütçe önerileri.</p></div><div className="rounded-[8px] border border-indigo-200/20 bg-indigo-300/[0.08] p-4"><p className="text-xs font-black text-indigo-100">Campaign Cards</p><p className="mt-2 text-sm leading-6 text-slate-600">Arama, lokal ve remarketing açısı.</p></div></div><AnalysisSearchForm form={form} setForm={setForm} loading={loading} onSubmit={() => askAiProvider(analyze)} buttonLabel="Google Reklamlarını Analiz Et" />{warning && <p className="mt-4 rounded-[8px] border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-700">{warning}</p>}{error && <p className="mt-4 rounded-[8px] border border-red-300/25 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}<div className="mt-5 grid gap-4 lg:grid-cols-2">{results.map((item) => { const id = item.id || item.name; return <AnalysisResultCard key={id} kind="google" item={item} form={form} aiMeta={aiMeta} saved={crm.savedIds[id]} saving={crm.savingId === id} message={crm.messages[id]} onOpen={() => askAiProvider(() => crm.setSelected(item))} onSave={() => crm.save(item)} />; })}{!loading && !error && !results.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400 lg:col-span-2">Bu seçim için sonuç bulunamadı.</p>}</div>{crm.selected && <AnalysisDetailModal kind="google" item={crm.selected} form={form} aiMeta={aiMeta} saved={crm.savedIds[crm.selected.id || crm.selected.name]} saving={crm.savingId === (crm.selected.id || crm.selected.name)} message={crm.messages[crm.selected.id || crm.selected.name]} onClose={() => crm.setSelected(null)} onSave={() => crm.save(crm.selected)} />}{chooserModal}</Panel>;
}

const socialAuditActions = ["Düzeltilmesi Gerekenler", "30 Günlük Sosyal Medya Planı", "Meta Reklam Stratejisi", "Google Reklam Stratejisi", "İçerik Fikirleri", "Teklif Hazırlama", "PDF Audit Oluştur", "WhatsApp Teklifi Hazırla", "CRM’e Kaydet"];
const socialAiOptions = ["Groq", "Gemini", "OpenAI", "Otomatik", "Demo Modu", "Yerel Mod"];

function SocialMediaAuditCenter() {
  const { askAiProvider, chooserModal } = useAiProviderChooser();
  const [form, setForm] = useState({ businessName: "", city: "Manisa", district: "Yunusemre", sector: "Restoran", notes: "", aiProvider: "Groq" });
  const [platforms, setPlatforms] = useState(socialPlatforms.map((platform) => ({
    platform,
    username: "",
    profileUrl: "",
    profileImageUrl: "",
    displayName: "",
    bio: "",
    website: "",
    publicTitle: "",
    publicDescription: "",
    fetchMode: "manual",
    fetchStatus: "Sınırlı veri",
    fetchWarning: ""
  })));
  const [screenshots, setScreenshots] = useState([]);
  const [actions, setActions] = useState(["Düzeltilmesi Gerekenler", "30 Günlük Sosyal Medya Planı", "İçerik Fikirleri"]);
  const [outputs, setOutputs] = useState([]);
  const [leadScore, setLeadScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [crmMessage, setCrmMessage] = useState("");
  const [crmSaving, setCrmSaving] = useState(false);
  const [profileFetching, setProfileFetching] = useState({});
  function toggleAction(action) {
    setActions(actions.includes(action) ? actions.filter((item) => item !== action) : [...actions, action]);
  }
  function generatedProfileUrl(platform: string, username: string) {
    const rawUsername = String(username || "").trim();
    const cleanUsername = rawUsername.replace(/^@+/, "");
    if (!cleanUsername) return "";
    if (platform === "Instagram") return `https://www.instagram.com/${cleanUsername}`;
    if (platform === "TikTok") return `https://www.tiktok.com/@${cleanUsername}`;
    if (platform === "X (Twitter)") return `https://x.com/${cleanUsername}`;
    if (platform === "Facebook") return `https://www.facebook.com/${cleanUsername}`;
    if (platform === "YouTube" && rawUsername.startsWith("@")) return `https://www.youtube.com/${rawUsername}`;
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
      const normalizedPatch = { ...patch };
      if ("username" in normalizedPatch) normalizedPatch.username = String(normalizedPatch.username || "").trim().replace(/^@+/, "");
      const next = { ...item, ...normalizedPatch };
      if ("username" in normalizedPatch && next.platform === "Instagram") {
        next.profileUrl = generatedProfileUrl(next.platform, normalizedPatch.username);
      } else if ("username" in normalizedPatch && !next.profileUrl) {
        next.profileUrl = generatedProfileUrl(next.platform, normalizedPatch.username);
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
    return platforms.filter((item) => item.username || item.profileUrl || item.profileImageUrl || item.displayName || item.bio || item.publicTitle);
  }
  function profileFetchStatus(item) {
    if (item.fetchStatus) return item.fetchStatus;
    if (item.displayName || item.bio || item.profileImageUrl) return "Profil bilgileri alındı";
    if (item.publicTitle || item.publicDescription || item.profileUrl) return "Sınırlı veri";
    return "Alınamadı";
  }
  async function scanProfile(index) {
    const current = platforms[index];
    if (!current) return;
    setProfileFetching({ ...profileFetching, [current.platform]: true });
    setMessage(current.platform === "Instagram" ? "Instagram profili taranıyor..." : "Profil bilgileri taranıyor...");
    try {
      const response = await fetch("/api/admin/social-profile-fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: current.platform, username: String(current.username || "").trim().replace(/^@+/, ""), profileUrl: current.profileUrl })
      });
      const data = await response.json().catch(() => ({}));
      const fetchedStatus = data.success
        ? (data.displayName || data.bio || data.profileImageUrl ? "Profil bilgileri alındı" : "Sınırlı veri")
        : "Alınamadı";
      setPlatforms((items) => items.map((item, itemIndex) => itemIndex === index ? {
        ...item,
        username: data.username || item.username,
        profileUrl: data.profileUrl || item.profileUrl,
        displayName: data.displayName || item.displayName,
        bio: data.bio || item.bio,
        profileImageUrl: data.profileImageUrl || item.profileImageUrl,
        website: data.website || item.website,
        publicTitle: data.publicTitle || item.publicTitle,
        publicDescription: data.publicDescription || item.publicDescription,
        fetchMode: data.fetchMode || item.fetchMode,
        fetchStatus: fetchedStatus,
        fetchWarning: data.warning || ""
      } : item));
      setMessage(data.success ? "Profil bilgileri alındı." : data.warning || "Instagram bazı profil verilerini engelliyor. Ekran görüntüsü yüklerseniz AI daha doğru analiz yapar.");
    } catch {
      setPlatforms((items) => items.map((item, itemIndex) => itemIndex === index ? {
        ...item,
        fetchStatus: "Alınamadı",
        fetchWarning: "Instagram bazı profil verilerini engelliyor. Ekran görüntüsü yüklerseniz AI daha doğru analiz yapar."
      } : item));
      setMessage("Instagram bazı profil verilerini engelliyor. Ekran görüntüsü yüklerseniz AI daha doğru analiz yapar.");
    } finally {
      setProfileFetching((items) => ({ ...items, [current.platform]: false }));
    }
  }
  const primaryProfile = activePlatforms()[0] || platforms[0];
  async function runAudit(aiProvider = "Groq") {
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
      body: JSON.stringify({ ...form, platforms: activePlatforms(), instagramProfile: activePlatforms().find((item) => item.platform === "Instagram") || null, allPlatformUrls: activePlatforms().map((item) => ({ platform: item.platform, profileUrl: item.profileUrl })), screenshots: screenshots.map(({ name, type, order }) => ({ name, type, order })), selectedActions: analysisActions, aiProvider, actions: analysisActions })
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
  async function downloadMiniAuditPdf() {
    setMessage("PDF Audit oluşturuluyor...");
    try {
      await downloadAuditPdf({
        businessName: form.businessName || primaryProfile?.displayName || primaryProfile?.username || primaryProfile?.profileUrl,
        source: "Sosyal İstihbarat Merkezi",
        leadScore,
        ai: outputs.find((item) => item.ai)?.ai,
        profileImageUrl: primaryProfile?.profileImageUrl || "",
        platforms: activePlatforms(),
        outputs,
        summary: outputs.find((item) => item.action === "PDF Audit Oluştur")?.text || form.notes,
        notes: form.notes
      });
      setMessage("PDF Audit indirildi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "PDF oluşturulamadı. Geçersiz PDF verisi alındı.");
    }
  }
  function whatsappText() {
    const selected = outputs.find((item) => item.action === "WhatsApp Teklifi Hazırla")?.text || outputs.map((item) => `${item.action}\n${item.text}`).join("\n\n");
    return selected || `${form.businessName || primaryProfile?.displayName || "İşletmeniz"} için sosyal medya, Meta reklam ve Google reklam fırsatlarını değerlendirmek isteriz.`;
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
        businessName: form.businessName || primaryProfile?.displayName || primaryProfile?.username || primaryProfile?.profileUrl,
        website: primaryProfile?.website || primaryProfile?.profileUrl || "",
        phone: "",
        email: "",
        address: "",
        links: { website: primaryProfile?.website || primaryProfile?.profileUrl, sourceUrl: primaryProfile?.profileUrl },
        summary: summary || primaryProfile?.bio || form.notes,
        platform: activePlatforms().map((item) => item.platform).join(", "),
        platforms: activePlatforms(),
        profileImageUrl: primaryProfile?.profileImageUrl || "",
        leadScore: leadScore?.score,
        leadTemperature: leadScore?.temperature,
        aiNote: summary || primaryProfile?.bio
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
  const latestScreenshot = screenshots[screenshots.length - 1];
  const previewProfile = primaryProfile || {};
  const previewStatus = profileFetchStatus(previewProfile);
  const previewName = previewProfile.displayName || previewProfile.publicTitle || form.businessName || "Profil bilgisi bekleniyor.";
  const previewUsername = previewProfile.username ? "@" + String(previewProfile.username).replace(/^@/, "") : "@kullanici";
  const previewBio = previewProfile.bio || previewProfile.publicDescription || "Profil bilgisi bekleniyor.";
  const socialActionCards = [
    ["Düzeltilmesi Gerekenler", "Profil, bio, kreatif ve funnel tarafında hızlı düzeltme listesi.", <AlertTriangle size={17} />],
    ["30 Günlük Sosyal Medya Planı", "Paylaşım ritmi, tema ve kampanya takvimi.", <Activity size={17} />],
    ["Meta Reklam Stratejisi", "Meta kampanya yapısı ve hedef kitle önerileri.", <BarChart3 size={17} />],
    ["Google Reklam Stratejisi", "Arama niyeti ve lokal reklam önerileri.", <Search size={17} />],
    ["İçerik Fikirleri", "Markaya uygun içerik açısı ve kreatif fikirler.", <Sparkles size={17} />],
    ["Teklif Hazırlama", "Satış görüşmesine uygun teklif yaklaşımı.", <MessageSquareText size={17} />],
    ["PDF Audit Oluştur", "Analiz çıktısını mini audit olarak dışa aktar.", <FileBarChart size={17} />],
    ["WhatsApp Teklifi Hazırla", "Müşteriye gönderilebilir kısa teklif metni.", <MessageSquareText size={17} />],
    ["CRM’e Kaydet", "Bu fırsatı Sosyal İstihbarat kaynağıyla CRM'e aktar.", <UsersRound size={17} />]
  ];

  return (
    <Panel title="Sosyal İstihbarat Merkezi">
      <div className="mb-7 overflow-hidden rounded-[8px] border border-yellow-300/25 bg-gradient-to-br from-yellow-300/16 via-cyan-300/8 to-white/[0.03] p-6 shadow-[0_26px_90px_rgba(250,204,21,.10)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-yellow-200">AI Powered Social Intelligence Center</p>
            <h2 className="mt-2 text-3xl font-black text-slate-900">Sosyal profilleri premium bir audit akışında inceleyin</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">İşletme bilgileri, profil alanları, ekran görüntüleri ve seçili aksiyonlar daha temiz bir akışta birlikte değerlendirilir.</p>
          </div>
          <div className="w-full max-w-xs rounded-[8px] border border-slate-200 bg-slate-50 p-3">
            <SelectField label="AI sağlayıcısı" value={form.aiProvider} onChange={(aiProvider) => setForm({ ...form, aiProvider })} options={socialAiOptions} />
          </div>
        </div>
      </div>

      <div className="grid gap-7 xl:grid-cols-2 xl:items-start">
        <div className="grid gap-5">
          <section className="rounded-[8px] border border-slate-200 bg-white/[0.045] p-5 shadow-[0_18px_70px_rgba(15,23,42,.22)]">
            <div className="mb-4"><p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">İşletme bilgileri</p><h3 className="mt-1 text-lg font-black text-slate-900">Analiz bağlamı</h3></div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="İşletme adı" value={form.businessName} onChange={(businessName) => setForm({ ...form, businessName })} />
              <SelectField label="İl" value={form.city} onChange={updateCity} options={cityOptions} />
              <SelectField label="İlçe" value={form.district} onChange={(district) => setForm({ ...form, district })} options={districts} />
              <OtherSelectField label="Sektör" value={form.sector} onChange={(sector) => setForm({ ...form, sector })} options={sectorOptions} manualLabel="Sektörü yazın" />
              <div className="md:col-span-2"><TextArea label="Ek not" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} /></div>
            </div>
          </section>

          <section className="grid gap-4">
            <div><p className="text-xs font-black uppercase tracking-[.14em] text-yellow-200">Platform kartları</p><h3 className="mt-1 text-lg font-black text-slate-900">Profil kaynakları</h3></div>
            <div className="grid gap-4 lg:grid-cols-2">
              {platforms.map((item, index) => {
                const status = profileFetchStatus(item);
                return <div key={item.platform} className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,.18)]"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-base font-black text-slate-900">{item.platform}</p><p className="mt-1 text-xs leading-5 text-slate-400">{item.platform === "Instagram" ? "Kullanıcı adı girildiğinde profil URL otomatik oluşur." : "Profil URL veya kullanıcı adı ekleyin."}</p></div><span className={"rounded-full px-3 py-1 text-xs font-black " + (status === "Profil bilgileri alındı" ? "bg-emerald-300/12 text-emerald-700" : status === "Sınırlı veri" ? "bg-amber-300/12 text-amber-700" : "bg-slate-300/10 text-slate-600")}>{status}</span></div><div className="mt-4 grid gap-4"><Field label={usernameLabel(item.platform)} value={item.username} onChange={(username) => updatePlatform(index, { username: String(username || "").replace(/^@+/, "") })} /><Field label={urlLabel(item.platform)} value={item.profileUrl} onChange={(profileUrl) => updatePlatform(index, { profileUrl })} /><Field label="Profil görsel URL (opsiyonel)" value={item.profileImageUrl} onChange={(profileImageUrl) => updatePlatform(index, { profileImageUrl, fetchStatus: profileImageUrl ? "Sınırlı veri" : item.fetchStatus })} /></div><div className="mt-4 flex flex-wrap gap-2">{item.platform === "Instagram" && <button type="button" disabled={profileFetching[item.platform]} onClick={() => scanProfile(index)} className="rounded-full bg-yellow-300 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-60">{profileFetching[item.platform] ? "Taranıyor..." : "Instagram Profilini Tara"}</button>}{item.platform !== "Instagram" && <button type="button" disabled={profileFetching[item.platform]} onClick={() => scanProfile(index)} className="rounded-full border border-yellow-200/30 px-4 py-2 text-xs font-black text-yellow-100 disabled:opacity-60">{profileFetching[item.platform] ? "Taranıyor..." : "Profili Tara"}</button>}{item.profileUrl && <a href={item.profileUrl} target="_blank" rel="noreferrer" className="rounded-full border border-cyan-200/20 px-4 py-2 text-xs font-black text-cyan-700">Profili Aç</a>}</div>{(item.displayName || item.bio || item.fetchWarning) && <div className="mt-4 rounded-[8px] border border-dashed border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600"><p className="font-black text-slate-900">{item.displayName || item.publicTitle || item.username || item.platform}</p>{item.bio && <p className="mt-1">{item.bio}</p>}{item.website && <p className="mt-1 break-all text-emerald-700">{item.website}</p>}{item.fetchWarning && <p className="mt-2 text-amber-700">{item.fetchWarning}</p>}</div>}</div>;
              })}
            </div>
          </section>

          <section className="rounded-[8px] border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-black text-slate-900">Ekran Görüntüsü Yükle</p><p className="mt-1 text-xs leading-5 text-slate-400">PNG, JPG, JPEG veya WEBP yükleyin. Instagram bazı profil verilerini engelliyor. Ekran görüntüsü yüklerseniz AI daha doğru analiz yapar.</p></div><label className="cursor-pointer rounded-full bg-yellow-300 px-4 py-2 text-sm font-black text-slate-950"><input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" multiple className="hidden" onChange={(event) => addScreenshots(event.target.files)} />Ekran Görüntüsü Yükle</label></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{screenshots.map((shot, index) => <div key={shot.id} className="rounded-[8px] border border-slate-200 bg-slate-50 p-3"><img src={shot.url} alt={shot.name} className="h-32 w-full rounded-[6px] object-cover" /><p className="mt-2 truncate text-xs font-bold text-slate-900">{shot.name}</p><div className="mt-2 flex gap-2"><a href={shot.url} target="_blank" rel="noreferrer" className="rounded-full border border-cyan-200/20 px-3 py-1 text-xs text-cyan-700">Görüntüle</a><button onClick={() => moveScreenshot(index, -1)} className="rounded-full border border-slate-200 px-2 text-slate-600"><ArrowUp size={14} /></button><button onClick={() => moveScreenshot(index, 1)} className="rounded-full border border-slate-200 px-2 text-slate-600"><ArrowDown size={14} /></button><button onClick={() => setScreenshots(screenshots.filter((current) => current.id !== shot.id))} className="rounded-full border border-red-300/20 px-2 text-red-200"><Trash2 size={14} /></button></div></div>)}{!screenshots.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-5 text-sm text-slate-400 xl:col-span-3">Yüklü ekran görüntüsü yok.</p>}</div></section>
        </div>

        <aside className="grid gap-5 self-start xl:sticky xl:top-5">
          <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-[linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.025))] p-5 shadow-[0_28px_95px_rgba(0,0,0,.28)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[.14em] text-yellow-200">Canlı Profil Önizleme</p>
                <h3 className="mt-1 text-lg font-black text-slate-900">Premium phone preview</h3>
              </div>
              <span className={"rounded-full px-3 py-1 text-[10px] font-black " + (previewStatus === "Profil bilgileri alındı" ? "bg-emerald-300/12 text-emerald-700" : previewStatus === "Sınırlı veri" ? "bg-amber-300/12 text-amber-700" : "bg-slate-300/10 text-slate-600")}>{previewStatus}</span>
            </div>
            <div className="mx-auto mt-5 w-full max-w-[460px] rounded-[46px] border border-slate-200 bg-gradient-to-br from-slate-800 via-slate-950 to-black p-4 shadow-[0_40px_120px_rgba(0,0,0,.55)]">
              <div className="overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-inner">
                <div className="relative flex items-center justify-center border-b border-slate-200 px-5 py-4 text-xs font-black text-slate-900">
                  <span className="absolute left-5">{previewUsername}</span>
                  <span className="h-1.5 w-20 rounded-full bg-white/18" />
                  <span className="absolute right-5 rounded-full bg-yellow-300/15 px-2 py-1 text-yellow-100">{previewProfile.platform || "Instagram"}</span>
                </div>
                {latestScreenshot ? (
                  <img src={latestScreenshot.url} alt={latestScreenshot.name} className="h-64 w-full object-cover sm:h-80" />
                ) : (
                  <div className="flex h-64 items-center justify-center bg-slate-50 px-8 text-center text-base font-black text-slate-400 sm:h-80">
                    {previewStatus === "Alınamadı" || previewStatus === "Sınırlı veri" ? "Profil bilgisi bekleniyor" : previewName}
                  </div>
                )}
                <div className="p-5 sm:p-6">
                  <div className="flex gap-4">
                    <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 sm:size-28">
                      {previewProfile.profileImageUrl ? <img src={previewProfile.profileImageUrl} alt="Profil fotoğrafı" className="size-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <ImagePlus size={26} className="text-slate-500" />}
                    </div>
                    <div className="grid flex-1 grid-cols-3 gap-2 text-center text-xs text-slate-400">
                      <div><p className="text-2xl font-black text-slate-900">—</p><p>Gönderi</p></div>
                      <div><p className="text-2xl font-black text-slate-900">—</p><p>Takipçi</p></div>
                      <div><p className="text-2xl font-black text-slate-900">—</p><p>Takip</p></div>
                    </div>
                  </div>
                  <p className="mt-5 text-base font-black text-slate-900">{previewName}</p>
                  <p className="mt-1 break-all text-sm font-bold text-yellow-100">{previewUsername}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{previewBio}</p>
                  {previewProfile.website && <p className="mt-3 break-all text-sm font-bold text-emerald-700">{previewProfile.website}</p>}
                  {previewProfile.profileUrl && <p className="mt-2 break-all text-xs text-slate-500">{previewProfile.profileUrl}</p>}
                  <div className="mt-5 flex gap-2">
                    <a href={previewProfile.profileUrl || "#"} target="_blank" rel="noreferrer" className="flex-1 rounded-full bg-white px-3 py-3 text-center text-xs font-black text-slate-950">Profili Aç</a>
                    <label className="flex-1 cursor-pointer rounded-full border border-slate-200 px-3 py-3 text-center text-xs font-black text-slate-900 transition hover:bg-white/10"><input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={(event) => addScreenshots(event.target.files)} />Ekran Görüntüsü Yükle</label>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_20px_70px_rgba(0,0,0,.16)]">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">AI Analysis Actions</p><h3 className="mt-1 text-lg font-black text-slate-900">Seçili aksiyonlar</h3></div>
              <span className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-black text-slate-400">{actions.length} seçili</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {socialActionCards.map(([action, description, icon]) => {
                const selected = actions.includes(action);
                return (
                  <button key={action} type="button" onClick={() => toggleAction(action)} className={"min-h-28 rounded-[8px] border p-4 text-left transition hover:-translate-y-0.5 " + (selected ? "border-yellow-200/45 bg-yellow-300/12 text-yellow-50 shadow-[0_16px_44px_rgba(250,204,21,.10)]" : "border-slate-200 bg-slate-50 text-slate-400 hover:border-cyan-200/30 hover:bg-cyan-200/[0.06] hover:text-cyan-700")}>
                    <span className="flex items-start justify-between gap-3"><span className="grid size-9 place-items-center rounded-[8px] border border-current/20 bg-white/10">{icon}</span><span className="rounded-full border border-current/20 px-2 py-1 text-[10px] font-black">{selected ? "Seçildi" : "Seç"}</span></span>
                    <span className="mt-4 block text-sm font-black text-slate-900">{action}</span>
                    <span className="mt-2 block text-xs leading-5 opacity-75">{description}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 grid gap-2">
              <button disabled={loading || !actions.filter((action) => action !== "CRM’e Kaydet").length || !hasInput} onClick={() => askAiProvider(runAudit)} className="min-h-14 rounded-full bg-yellow-300 px-5 text-sm font-black text-slate-950 shadow-[0_18px_50px_rgba(250,204,21,.18)] disabled:opacity-60">{loading ? "Analiz ediliyor..." : "Seçili Analizleri Başlat"}</button>
              {actions.includes("CRM’e Kaydet") && <button disabled={crmSaving || (!outputs.length && !hasInput)} onClick={saveToCrm} className="rounded-full border border-yellow-200/30 px-5 py-3 text-sm font-black text-yellow-100 disabled:opacity-60">{crmSaving ? "CRM’e kaydediliyor..." : "CRM’e Kaydet"}</button>}
              {pdfOutput && <button onClick={downloadMiniAuditPdf} className="rounded-full border border-cyan-200/25 px-5 py-3 text-sm font-black text-cyan-700">PDF Audit Oluştur</button>}
              {whatsappOutput && <a href={'https://wa.me/?text=' + encodeURIComponent(whatsappText())} target="_blank" rel="noreferrer" className="rounded-full border border-emerald-200/25 px-5 py-3 text-center text-sm font-black text-emerald-700">WhatsApp’ta Aç</a>}
              {whatsappOutput && <button onClick={() => navigator.clipboard?.writeText(whatsappText())} className="rounded-full border border-slate-200 px-5 py-3 text-sm font-black text-slate-700">Mesajı Kopyala</button>}
            </div>
          </section>
        </aside>
      </div>

      <section className="mt-6 rounded-[8px] border border-rose-200/20 bg-rose-300/[0.07] p-5 shadow-[0_18px_70px_rgba(0,0,0,.14)]">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-rose-700">PDF Audit Workspace</p>
            <h3 className="mt-2 text-xl font-black text-slate-900">Doküman önizleme ve dışa aktarma alanı</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">İşletme bilgileri, profil verisi, ekran görüntüleri ve seçili analiz çıktıları PDF audit akışına hazırlanır.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {["Profil özeti", "Audit bölümleri", "Export kontrolleri"].map((item) => <span key={item} className="rounded-[8px] border border-slate-200 bg-slate-50 p-3 text-xs font-black text-slate-700">{item}</span>)}
            </div>
          </div>
          <div className="rounded-[8px] border border-slate-200 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[.14em] text-rose-100">Client / Business</p>
            <p className="mt-2 text-lg font-black text-slate-900">{form.businessName || previewName}</p>
            <p className="mt-1 text-sm text-slate-600">{form.city} / {form.district} · {form.sector}</p>
            <button disabled={!outputs.length} onClick={downloadMiniAuditPdf} className="mt-4 w-full rounded-[8px] bg-rose-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-60">Generate PDF Audit</button>
          </div>
        </div>
      </section>

      {leadScore && <div className={"mt-5 rounded-[8px] border p-4 " + (leadScore.temperature === "Sıcak" ? "border-red-300/25 bg-red-300/10 text-red-100" : leadScore.temperature === "Ilık" ? "border-amber-300/25 bg-amber-300/10 text-amber-700" : "border-slate-300/20 bg-slate-300/10 text-slate-700")}><p className="text-xs font-black uppercase tracking-[.16em]">Lead Score</p><p className="mt-2 text-2xl font-black">{leadScore.score}/100 · {leadScore.temperature}</p><p className="mt-2 text-sm opacity-80">Skor; website/profil URL, platform sayısı, ekran görüntüsü, teklif ihtiyacı ve ticari fırsat sinyallerinden hesaplandı.</p></div>}
      {message && <p className="mt-4 rounded-[8px] border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-700">{message}</p>}
      {crmMessage && <p className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-700">{crmMessage}</p>}
      <div className="mt-6 grid gap-4">{outputs.map((item) => <div key={item.action} className="rounded-[8px] border border-slate-200 bg-white/[0.045] p-5"><p className="text-xs font-black uppercase tracking-[.16em] text-yellow-200">{item.action}</p><AiUsageBadge meta={item.ai} /><pre className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{item.text}</pre></div>)}{!loading && !outputs.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">Sosyal istihbarat çıktısı için profil, ekran görüntüsü veya işletme bilgisi girip aksiyon seçin.</p>}</div>
      {chooserModal}
    </Panel>
  );
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
    {result && <pre className="mt-5 whitespace-pre-wrap rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-4 text-sm leading-7 text-cyan-700">{result}</pre>}
  </Panel>;
}

function v4Money(value: any) {
  return `${Number(value || 0).toLocaleString("tr-TR")} TL`;
}

function companyById(content: any, id: string) {
  return (content.companies || []).find((company: any) => company.id === id);
}

function leadCompanyName(lead: any) {
  return lead?.company || lead?.name || lead?.business_name || "İsimsiz lead";
}

function buildLocalAudit(form: any, target: any = {}) {
  const hasWebsite = Boolean(form.website || target.website);
  const hasInstagram = Boolean(form.instagram || target.instagram);
  const hasGoogle = Boolean(form.googleBusinessUrl);
  const hasLocation = Boolean(form.city || target.city);
  const sector = String(form.sector || target.sector || target.business_type || "").toLocaleLowerCase("tr");
  const highPotential = ["emlak", "oto", "klinik", "güzellik", "diş", "eğitim", "restoran", "avukat"].some((item) => sector.includes(item));
  const digitalScore = Math.min(100, 20 + (hasWebsite ? 24 : 0) + (hasInstagram ? 18 : 0) + (hasGoogle ? 18 : 0) + (hasLocation ? 10 : 0) + (highPotential ? 10 : 0));
  const adScore = Math.min(100, 35 + (!hasWebsite ? 18 : 8) + (hasInstagram ? 12 : 4) + (hasLocation ? 10 : 0) + (highPotential ? 20 : 8) + (target.phone ? 8 : 0));
  const monthlyBudget = adScore >= 80 ? "35.000 - 75.000 TL" : adScore >= 60 ? "20.000 - 40.000 TL" : "12.000 - 25.000 TL";
  const packageName = adScore >= 80 ? "Premium" : adScore >= 60 ? "Standart" : "Temel";
  return {
    digitalScore,
    adScore,
    monthlyBudget,
    packageName,
    sections: [
      ["Web sitesi analizi", hasWebsite ? "Web sitesi var. Landing page, hız, ölçümleme ve dönüşüm takipleri kontrol edilmeli." : "Web sitesi bulunamadı. Reklam trafiği için landing page veya hızlı teklif sayfası güçlü fırsat."],
      ["Instagram analizi", hasInstagram ? "Instagram varlığı mevcut. Profil bio, sabit içerikler, teklif CTA ve reklam kreatifleri güçlendirilebilir." : "Instagram bilgisi eksik. Sosyal kanıt ve içerik düzeni için profil çalışması önerilir."],
      ["Google profil analizi", hasGoogle ? "Google işletme bağlantısı girilmiş. Yorum, puan, kategori ve harita görünürlüğü takip edilmeli." : "Google işletme bağlantısı yok. Harita görünürlüğü ve yorum yönetimi başlangıç fırsatı."],
      ["Meta reklam fırsatları", "Mesaj, lead ve remarketing akışıyla hızlı geri dönüş alınabilecek reklam yapısı kurulabilir."],
      ["Google Ads fırsatları", "Yerel arama niyetleri, marka dışı anahtar kelimeler ve dönüşüm odaklı kampanyalar test edilebilir."],
      ["SEO başlangıç notları", "Sektör + şehir odaklı temel sayfa başlıkları, yerel içerik ve hızlı teknik iyileştirme önerilir."]
    ],
    missing: [
      !hasWebsite && "Website / landing page eksik",
      !hasInstagram && "Instagram profil bilgisi eksik",
      !hasGoogle && "Google işletme bağlantısı eksik",
      "Ölçümleme ve dönüşüm takibi kontrol edilmeli"
    ].filter(Boolean),
    actions: ["Ölçümleme kurulumu", "Teklif odaklı landing page", "Meta mesaj/lead kampanyası", "Google arama kampanyası", "7 gün kreatif testi"]
  };
}

function AiAuditCenter({ content, setContent, save, setActive, notify }: any) {
  const [form, setForm] = useState({ sourceType: "Müşteri", companyId: "", leadId: "", website: "", instagram: "", googleBusinessUrl: "", sector: "", city: "", district: "" });
  const [audit, setAudit] = useState<any>(null);
  const selectedCompany = companyById(content, form.companyId);
  const selectedLead = (content.leads || []).find((lead: any) => lead.id === form.leadId);
  const target = selectedCompany || selectedLead || {};
  const targetName = selectedCompany?.name || leadCompanyName(selectedLead) || "Yeni işletme";
  function update(patch: any) {
    setForm((current) => ({ ...current, ...patch }));
  }
  function generate() {
    const result = buildLocalAudit(form, target);
    setAudit(result);
    notify?.("✓ AI denetim yerel analiz ile oluşturuldu", "success");
  }
  function saveLead() {
    const now = new Date().toISOString();
    const lead = {
      id: selectedLead?.id || createLocalId(),
      company_id: selectedCompany?.id || selectedLead?.company_id || "",
      name: targetName,
      company: targetName,
      website: form.website || target.website || "",
      instagram: form.instagram || target.instagram || "",
      city: form.city || target.city || "",
      district: form.district || target.district || "",
      sector: form.sector || target.sector || target.business_type || "",
      source: "AI Denetim",
      status: selectedLead?.status || "Teklif Hazırlanıyor",
      pipeline_stage: selectedLead?.pipeline_stage || "Yeni Lead",
      score: audit?.adScore || selectedLead?.score || 0,
      notes: `${selectedLead?.notes || ""}\n\nAI Denetim: Dijital ${audit?.digitalScore || 0}/100, Reklam ${audit?.adScore || 0}/100. Önerilen paket: ${audit?.packageName || "-"}.`.trim(),
      created_at: selectedLead?.created_at || now,
      updated_at: now
    };
    const exists = (content.leads || []).some((item: any) => item.id === lead.id);
    const next = { ...content, leads: exists ? (content.leads || []).map((item: any) => item.id === lead.id ? lead : item) : [lead, ...(content.leads || [])] };
    setContent(next);
    save?.(next);
    notify?.("✓ Denetim CRM lead kaydına işlendi", "success");
  }
  function saveDocument(type = "PDF Denetim Raporu") {
    if (!audit) return notify?.("⚠ Önce denetim oluşturun", "warning");
    const doc = {
      id: createLocalId(),
      company_id: selectedCompany?.id || selectedLead?.company_id || "",
      title: `${type} · ${targetName}`,
      document_type: type.includes("PDF") ? "Rapor" : "AI Denetim",
      document_date: new Date().toISOString().slice(0, 10),
      description: `Dijital Olgunluk: ${audit.digitalScore}/100\nReklam Potansiyeli: ${audit.adScore}/100\nÖnerilen paket: ${audit.packageName}\nÖnerilen bütçe: ${audit.monthlyBudget}\n\nEksikler:\n${audit.missing.map((item: string) => `- ${item}`).join("\n")}\n\nÖncelikli aksiyonlar:\n${audit.actions.map((item: string) => `- ${item}`).join("\n")}`,
      visible_to_customer: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const next = { ...content, customerDocuments: [doc, ...(content.customerDocuments || [])] };
    setContent(next);
    save?.(next);
    notify?.("✓ Denetim müşteri belgelerine kaydedildi", "success");
  }
  const whatsapp = `Merhaba, ${targetName} için hızlı bir dijital denetim hazırladık. Reklam potansiyeli ${audit?.adScore || "-"}/100 görünüyor. İsterseniz eksikleri ve 30 günlük aksiyon planını paylaşabilirim.`;
  return (
    <Panel title="AI Denetim Sistemi">
      <p className="mb-5 text-sm leading-6 text-slate-400">Müşteri, lead veya yeni işletme için dijital olgunluk, reklam potansiyeli ve teklif öncesi aksiyon planı oluşturun. AI sağlayıcı yoksa deterministik yerel analiz kullanılır.</p>
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <GlassCard className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField label="Denetim kaynağı" value={form.sourceType} onChange={(sourceType) => update({ sourceType })} options={["Müşteri", "Lead", "Yeni İşletme"]} />
            {form.sourceType === "Müşteri" && <CompanySelect value={form.companyId} onChange={(companyId) => update({ companyId })} companies={content.companies} />}
            {form.sourceType === "Lead" && <SelectField label="Lead" value={form.leadId} onChange={(leadId) => update({ leadId })} options={(content.leads || []).map((lead: any) => ({ value: lead.id, label: leadCompanyName(lead) }))} />}
            <Field label="Website URL" value={form.website || target.website || ""} onChange={(website) => update({ website })} />
            <Field label="Instagram hesabı" value={form.instagram || target.instagram || ""} onChange={(instagram) => update({ instagram })} />
            <Field label="Google işletme bağlantısı" value={form.googleBusinessUrl} onChange={(googleBusinessUrl) => update({ googleBusinessUrl })} />
            <Field label="Sektör" value={form.sector || target.sector || target.business_type || ""} onChange={(sector) => update({ sector })} />
            <Field label="İl" value={form.city || target.city || ""} onChange={(city) => update({ city })} />
            <Field label="İlçe" value={form.district || target.district || ""} onChange={(district) => update({ district })} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={generate} className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">AI Denetim Oluştur</button>
            <button onClick={saveLead} disabled={!audit} className="rounded-full border border-emerald-300/30 px-5 py-3 text-sm font-black text-emerald-700 disabled:opacity-50">CRM’e Kaydet</button>
            <button onClick={() => setActive("Teklif Oluştur")} disabled={!audit} className="rounded-full border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 disabled:opacity-50">Teklif Oluştur</button>
            <button onClick={() => saveDocument("PDF Denetim Raporu")} disabled={!audit} className="rounded-full border border-cyan-200/20 px-5 py-3 text-sm font-black text-cyan-700 disabled:opacity-50">PDF Denetim Raporu</button>
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Denetim Çıktısı</p>
          {!audit ? <p className="mt-4 rounded-[8px] border border-dashed border-slate-200 p-5 text-sm text-slate-400">Denetim oluşturulduğunda skorlar, eksikler ve aksiyon planı burada görünür.</p> : (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <AgencyStatCard label="Dijital Olgunluk" value={`${audit.digitalScore}/100`} note="Dijital varlık seviyesi" />
                <AgencyStatCard label="Reklam Potansiyeli" value={`${audit.adScore}/100`} note="Satış fırsatı skoru" tone="amber" />
              </div>
              <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-4"><p className="font-black text-slate-900">Önerilen paket: {audit.packageName}</p><p className="mt-1 text-sm text-slate-600">Tahmini aylık reklam bütçesi: {audit.monthlyBudget}</p></div>
              {audit.sections.map(([title, text]: any) => <div key={title} className="rounded-[8px] border border-slate-200 bg-slate-50 p-3"><p className="text-sm font-black text-cyan-700">{title}</p><p className="mt-1 text-sm leading-6 text-slate-600">{text}</p></div>)}
              <div className="grid gap-3 md:grid-cols-2">
                <div><p className="font-black text-slate-900">Eksikler</p><ul className="mt-2 space-y-1 text-sm text-slate-600">{audit.missing.map((item: string) => <li key={item}>- {item}</li>)}</ul></div>
                <div><p className="font-black text-slate-900">Öncelikli aksiyonlar</p><ul className="mt-2 space-y-1 text-sm text-slate-600">{audit.actions.map((item: string) => <li key={item}>- {item}</li>)}</ul></div>
              </div>
              <div className="rounded-[8px] border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm leading-6 text-emerald-700">{whatsapp}</div>
              <button onClick={() => navigator.clipboard.writeText(whatsapp)} className="rounded-full border border-emerald-300/30 px-4 py-2 text-xs font-black text-emerald-700">WhatsApp Mesajı Hazırla</button>
            </div>
          )}
        </GlassCard>
      </div>
    </Panel>
  );
}

function LeadFollowUpCenter({ content, setContent, save, setActive, notify }: any) {
  const [filters, setFilters] = useState({ date: "", status: "", sector: "", score: "", stage: "" });
  const today = new Date().toISOString().slice(0, 10);
  const leads = (content.leads || []).filter((lead: any) => !isLeadDeleted(lead));
  const matches = (lead: any) => {
    const actionDate = dateOnly(lead.next_action_at || lead.follow_up_date || lead.updated_at || lead.created_at);
    if (filters.date && actionDate !== filters.date) return false;
    if (filters.status && !String(lead.status || "").includes(filters.status)) return false;
    if (filters.sector && !String(lead.sector || lead.business_type || "").toLocaleLowerCase("tr").includes(filters.sector.toLocaleLowerCase("tr"))) return false;
    if (filters.score && Number(lead.score || lead.lead_score || 0) < Number(filters.score)) return false;
    if (filters.stage && pipelineStageForLead(lead) !== filters.stage) return false;
    return true;
  };
  const filtered = leads.filter(matches);
  const buckets = [
    ["Bugün aranacaklar", filtered.filter((lead: any) => dateOnly(lead.next_action_at || lead.follow_up_date) === today && !String(lead.next_action || "").toLocaleLowerCase("tr").includes("whatsapp"))],
    ["Bugün WhatsApp atılacaklar", filtered.filter((lead: any) => dateOnly(lead.next_action_at || lead.follow_up_date) === today && String(lead.next_action || "").toLocaleLowerCase("tr").includes("whatsapp"))],
    ["Takip gecikenler", filtered.filter((lead: any) => dateOnly(lead.next_action_at || lead.follow_up_date) && dateOnly(lead.next_action_at || lead.follow_up_date) < today)],
    ["Teklif bekleyenler", filtered.filter((lead: any) => String(lead.status || "").includes("Teklif") || pipelineStageForLead(lead) === "Teklif Gönderildi")],
    ["Toplantı bekleyenler", filtered.filter((lead: any) => String(lead.next_action || lead.notes || "").toLocaleLowerCase("tr").includes("toplantı"))],
    ["Kazanılmaya yakın leadler", filtered.filter((lead: any) => Number(lead.score || lead.lead_score || 0) >= 75 || ["Takipte", "Teklif Gönderildi"].includes(pipelineStageForLead(lead)))]
  ];
  function patchLead(id: string, patch: any, message = "Lead güncellendi") {
    const next = { ...content, leads: (content.leads || []).map((lead: any) => lead.id === id ? { ...lead, ...patch, updated_at: new Date().toISOString() } : lead) };
    setContent(next);
    save?.(next);
    notify?.(`✓ ${message}`, "success");
  }
  function whatsappText(lead: any) {
    return `Merhaba, ${leadCompanyName(lead)} için kısa dijital reklam ve büyüme analizi hazırlayabiliriz. İsterseniz bugün uygun olduğunuz bir saatte detayları paylaşayım.`;
  }
  return (
    <Panel title="Takip Merkezi">
      <p className="mb-5 text-sm leading-6 text-slate-400">Lead takipleri, teklif bekleyenler ve kazanılmaya yakın fırsatları tek operasyon ekranında yönetin.</p>
      <GlassCard className="mb-5 p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <Field label="Tarih" type="date" value={filters.date} onChange={(date) => setFilters({ ...filters, date })} />
          <SelectField label="Durum" value={filters.status} onChange={(status) => setFilters({ ...filters, status })} options={leadStatuses} />
          <Field label="Sektör" value={filters.sector} onChange={(sector) => setFilters({ ...filters, sector })} />
          <SelectField label="Minimum lead skoru" value={filters.score} onChange={(score) => setFilters({ ...filters, score })} options={[{ value: "80", label: "80+" }, { value: "60", label: "60+" }, { value: "40", label: "40+" }]} />
          <SelectField label="Pipeline aşaması" value={filters.stage} onChange={(stage) => setFilters({ ...filters, stage })} options={salesPipelineStages} />
        </div>
      </GlassCard>
      <div className="grid gap-4 xl:grid-cols-2">
        {buckets.map(([title, items]: any) => (
          <GlassCard key={title} className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-lg font-black text-slate-900">{title}</h3><span className="rounded-full bg-cyan-300 px-3 py-1 text-xs font-black text-slate-950">{items.length}</span></div>
            <div className="grid gap-3">
              {items.slice(0, 8).map((lead: any) => (
                <div key={lead.id} className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black text-slate-900">{leadCompanyName(lead)}</p><p className="mt-1 text-xs text-slate-400">{lead.phone || "Telefon yok"} · {lead.sector || lead.business_type || "Sektör yok"} · {pipelineStageForLead(lead)}</p></div><span className="rounded-full border border-amber-300/30 px-3 py-1 text-xs text-amber-700">Skor {lead.score || lead.lead_score || 0}</span></div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => navigator.clipboard.writeText(whatsappText(lead))} className="rounded-full border border-emerald-300/30 px-3 py-2 text-xs text-emerald-700">WhatsApp Mesajı Hazırla</button>
                    <a href={lead.phone ? `tel:${lead.phone}` : "#"} className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-700">Ara</a>
                    <a href={lead.email ? `mailto:${lead.email}` : "#"} className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-700">E-posta Gönder</a>
                    <button onClick={() => patchLead(lead.id, { notes: `${lead.notes || ""}\n${new Date().toLocaleDateString("tr-TR")} · Takip notu eklendi`.trim() }, "Takip notu eklendi")} className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-700">Not Ekle</button>
                    <button onClick={() => patchLead(lead.id, { next_action_at: today, next_action: "WhatsApp takip" }, "Sıradaki aksiyon belirlendi")} className="rounded-full border border-cyan-200/25 px-3 py-2 text-xs text-cyan-700">Sıradaki aksiyon belirle</button>
                    <button onClick={() => setActive("Teklif Oluştur")} className="rounded-full bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950">Teklif Oluştur</button>
                    <button onClick={() => patchLead(lead.id, { status: "Kazanıldı", pipeline_stage: "Kazanıldı" }, "Lead müşteriye dönüştürüldü")} className="rounded-full border border-emerald-300/30 px-3 py-2 text-xs text-emerald-700">Müşteriye Dönüştür</button>
                  </div>
                </div>
              ))}
              {!items.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-4 text-sm text-slate-400">Bu bölümde kayıt yok.</p>}
            </div>
          </GlassCard>
        ))}
      </div>
    </Panel>
  );
}

function PdfReportDesignCenter({ content, setContent, save, notify }: any) {
  const settings = content.settings || {};
  const template = settings.reportDesign || { coverTitle: "HK Dijital Aylık Performans Raporu", brandColor: "#22d3ee", logoUrl: "", aiEnabled: true, sevenDayPlan: true, agencyNote: true, sections: { summary: true, meta: true, google: true, social: true, campaigns: true, payments: false } };
  const [draft, setDraft] = useState(template);
  function update(patch: any) {
    setDraft((current: any) => ({ ...current, ...patch }));
  }
  function toggleSection(key: string, value: boolean) {
    setDraft((current: any) => ({ ...current, sections: { ...current.sections, [key]: value } }));
  }
  function persist() {
    const next = { ...content, settings: { ...settings, reportDesign: draft } };
    setContent(next);
    save?.(next);
    notify?.("✓ PDF rapor tasarımı kaydedildi", "success");
  }
  return (
    <Panel title="PDF Rapor Tasarım Merkezi">
      <p className="mb-5 text-sm leading-6 text-slate-400">Müşteri raporu çıktısında görünecek kapak, marka rengi ve bölüm sırasını yönetin. PDF motoru yoksa yazdırılabilir HTML önizleme kullanılır.</p>
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <GlassCard className="p-5">
          <div className="grid gap-4">
            <Field label="Logo URL" value={draft.logoUrl || ""} onChange={(logoUrl) => update({ logoUrl })} />
            <Field label="Kapak başlığı" value={draft.coverTitle || ""} onChange={(coverTitle) => update({ coverTitle })} />
            <Field label="Marka rengi" type="color" value={draft.brandColor || "#22d3ee"} onChange={(brandColor) => update({ brandColor })} />
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={Boolean(draft.aiEnabled)} onChange={(event) => update({ aiEnabled: event.target.checked })} /> AI yorumu etkin</label>
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={Boolean(draft.sevenDayPlan)} onChange={(event) => update({ sevenDayPlan: event.target.checked })} /> 7 günlük aksiyon planı etkin</label>
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={Boolean(draft.agencyNote)} onChange={(event) => update({ agencyNote: event.target.checked })} /> Ajans notu etkin</label>
            <div className="grid gap-2">{[["summary", "Özet"], ["meta", "Meta Ads"], ["google", "Google Ads"], ["social", "Sosyal Medya"], ["campaigns", "Kampanyalar"], ["payments", "Tahsilat / hizmet notu"]].map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-[8px] border border-slate-200 p-3 text-sm"><input type="checkbox" checked={draft.sections?.[key] !== false} onChange={(event) => toggleSection(key, event.target.checked)} /> {label}</label>)}</div>
            <button onClick={persist} className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">Kaydet</button>
          </div>
        </GlassCard>
        <div className="rounded-[18px] border border-slate-200 bg-white p-8 text-slate-950 shadow-2xl">
          <div className="flex items-center justify-between gap-4 border-b pb-5" style={{ borderColor: draft.brandColor || "#22d3ee" }}>
            <div>{draft.logoUrl ? <img src={draft.logoUrl} alt="Rapor logosu" className="h-12 max-w-48 object-contain" /> : <p className="text-xl font-black">HK Dijital</p>}<p className="mt-1 text-sm text-slate-500">Müşteri performans raporu</p></div>
            <span className="rounded-full px-4 py-2 text-sm font-black text-slate-900" style={{ backgroundColor: draft.brandColor || "#22d3ee" }}>Önizleme</span>
          </div>
          <h3 className="mt-8 text-3xl font-black">{draft.coverTitle}</h3>
          <div className="mt-6 grid gap-3 md:grid-cols-3">{["Gösterim", "Tıklama", "Harcama"].map((label, index) => <div key={label} className="rounded-[14px] bg-slate-100 p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{[94378, 1205, "18.500 TL"][index]}</p></div>)}</div>
          <div className="mt-6 space-y-3">{Object.entries(draft.sections || {}).filter(([, enabled]) => enabled !== false).map(([key]) => <div key={key} className="rounded-[12px] border border-slate-200 p-4"><p className="font-black">{({ summary: "Özet", meta: "Meta Ads", google: "Google Ads", social: "Sosyal Medya", campaigns: "Kampanyalar", payments: "Tahsilat / hizmet notu" } as any)[key] || key}</p><p className="mt-1 text-sm text-slate-600">Bu bölüm müşteri raporunda temiz ve okunabilir şekilde gösterilir.</p></div>)}</div>
          <div className="mt-5 flex gap-2"><button onClick={() => window.print()} className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-900">PDF / Yazdır</button><button onClick={persist} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-black">Müşteri paneline yayınla</button></div>
        </div>
      </div>
    </Panel>
  );
}

function RevenueForecastCenter({ content, setActive }: any) {
  const payments = content.paymentRecords || [];
  const expenses = content.agencyExpenses || [];
  const campaigns = content.campaigns || [];
  const month = new Date().toISOString().slice(0, 7);
  const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().slice(0, 7);
  const thisMonthPayments = payments.filter((item: any) => String(item.service_period || item.due_date || "").startsWith(month));
  const nextMonthPayments = payments.filter((item: any) => String(item.service_period || item.due_date || "").startsWith(nextMonth));
  const paid = thisMonthPayments.filter((item: any) => item.status === "Ödendi").reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
  const pending = thisMonthPayments.filter((item: any) => ["Bekliyor", "Gecikmiş"].includes(item.status)).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
  const overdue = thisMonthPayments.filter((item: any) => item.status === "Gecikmiş" || (item.status !== "Ödendi" && dateOnly(item.due_date) && dateOnly(item.due_date) < new Date().toISOString().slice(0, 10))).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
  const expected = paid + pending;
  const expenseTotal = expenses.filter((item: any) => String(item.date || "").startsWith(month)).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
  const nextExpected = nextMonthPayments.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
  const campaignSpend = campaigns.reduce((sum: number, item: any) => sum + Number(item.spent_budget ?? item.spent ?? 0), 0);
  const profit = paid + pending - expenseTotal;
  const status = overdue > expected * 0.35 ? "Kritik" : overdue > expected * 0.15 ? "Riskli" : "Güvenli";
  const tone = status === "Kritik" ? "red" : status === "Riskli" ? "amber" : "emerald";
  return (
    <Panel title="Gelir Tahmini">
      <p className="mb-5 text-sm leading-6 text-slate-400">Tahsilat, gider ve kampanya verilerinden gelir öngörüsü oluşturulur. Gecikmiş ödemeler riskli gelir olarak işaretlenir.</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AgencyStatCard label="Bu ay beklenen gelir" value={v4Money(expected)} note="Ödenen + bekleyen tahsilatlar" />
        <AgencyStatCard label="Kesinleşen gelir" value={v4Money(paid)} note="Ödenmiş kayıtlar" tone="emerald" />
        <AgencyStatCard label="Bekleyen tahsilat" value={v4Money(pending)} note="Bekleyen ve gecikmiş kayıtlar" tone="amber" />
        <AgencyStatCard label="Riskli gelir" value={v4Money(overdue)} note="Gecikmiş tahsilatlar" tone={tone} />
        <AgencyStatCard label="Tahmini kâr" value={v4Money(profit)} note="Gelir eksi gider" tone="cyan" />
        <AgencyStatCard label="Gelecek ay beklenen" value={v4Money(nextExpected)} note="Gelecek ay ödeme kayıtları" />
        <AgencyStatCard label="Meta/Google harcama sinyali" value={v4Money(campaignSpend)} note="Kampanya harcama toplamı" tone="amber" />
        <GlassCard className="p-4"><p className="text-sm text-slate-400">Forecast durumu</p><p className={`mt-2 text-3xl font-black ${status === "Güvenli" ? "text-emerald-700" : status === "Riskli" ? "text-amber-700" : "text-red-100"}`}>{status}</p><p className="mt-2 text-xs leading-5 text-slate-400">Bu tutar bekleyen tahsilatlardan hesaplandı. Gecikmiş ödemeler riskli gelir olarak işaretlendi.</p></GlassCard>
      </div>
      <div className="mt-5 flex flex-wrap gap-2"><button onClick={() => setActive("Tahsilat")} className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">Tahsilatları Aç</button><button onClick={() => setActive("Karlılık")} className="rounded-full border border-slate-200 px-5 py-3 text-sm font-black text-slate-700">Karlılık Detayı</button></div>
    </Panel>
  );
}

function ContractGeneratorCenter({ content, setContent, save, notify }: any) {
  const [form, setForm] = useState({ companyId: "", packageName: "Standart", startDate: new Date().toISOString().slice(0, 10), duration: "6 Ay", monthlyFee: "15000", adBudget: "30000", paymentDay: "5", specialTerms: "" });
  const company = companyById(content, form.companyId);
  const preview = `HK Dijital Hizmet Sözleşmesi Taslağı

Müşteri: ${company?.name || "Müşteri seçilmedi"}
Hizmet Paketi: ${form.packageName}
Başlangıç Tarihi: ${form.startDate}
Hizmet Süresi: ${form.duration}
Aylık Hizmet Bedeli: ${Number(form.monthlyFee || 0).toLocaleString("tr-TR")} TL + KDV
Önerilen Reklam Bütçesi: ${Number(form.adBudget || 0).toLocaleString("tr-TR")} TL
Ödeme Günü: Her ayın ${form.paymentDay}. günü

Kapsam:
- Dijital reklam hesaplarının operasyonel yönetimi
- Kampanya kurulumu ve optimizasyon takibi
- Aylık performans raporu
- Müşteri paneli üzerinden görünür not ve rapor paylaşımı

Özel Şartlar:
${form.specialTerms || "Özel şart eklenmedi."}

Not: Bu taslak hukuki danışmanlık yerine geçmez. İmzadan önce tarafların hukuki danışmanına inceletmesi önerilir.`;
  function saveContract() {
    if (!company) return notify?.("⚠ Sözleşme için müşteri seçin", "warning");
    const doc = { id: createLocalId(), company_id: company.id, title: `Sözleşme · ${company.name}`, document_type: "Sözleşme", document_date: form.startDate, description: preview, document_url: "", visible_to_customer: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const next = { ...content, customerDocuments: [doc, ...(content.customerDocuments || [])] };
    setContent(next);
    save?.(next);
    notify?.("✓ Sözleşme müşteri belgelerine kaydedildi", "success");
  }
  return (
    <Panel title="Sözleşme Oluştur">
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <GlassCard className="p-5"><div className="grid gap-4"><CompanySelect value={form.companyId} onChange={(companyId) => setForm({ ...form, companyId })} companies={content.companies} /><SelectField label="Hizmet paketi" value={form.packageName} onChange={(packageName) => setForm({ ...form, packageName })} options={["Temel", "Standart", "Premium", "Özel"]} /><Field label="Hizmet başlangıç tarihi" type="date" value={form.startDate} onChange={(startDate) => setForm({ ...form, startDate })} /><Field label="Hizmet süresi" value={form.duration} onChange={(duration) => setForm({ ...form, duration })} /><Field label="Aylık bedel" type="number" value={form.monthlyFee} onChange={(monthlyFee) => setForm({ ...form, monthlyFee })} /><Field label="Reklam bütçesi" type="number" value={form.adBudget} onChange={(adBudget) => setForm({ ...form, adBudget })} /><Field label="Ödeme günü" value={form.paymentDay} onChange={(paymentDay) => setForm({ ...form, paymentDay })} /><TextArea label="Özel şartlar" value={form.specialTerms} onChange={(specialTerms) => setForm({ ...form, specialTerms })} /></div><div className="mt-5 flex flex-wrap gap-2"><button onClick={saveContract} className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">Müşteri belgelerine kaydet</button><button onClick={() => window.print()} className="rounded-full border border-slate-200 px-5 py-3 text-sm text-slate-700">PDF / Yazdır</button></div></GlassCard>
        <GlassCard className="p-5"><pre className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{preview}</pre></GlassCard>
      </div>
    </Panel>
  );
}

function WhatsAppReminderCenter({ content, setContent, save, notify, setActive }: any) {
  const templates = {
    "İlk temas": "Merhaba {ad}, HK Dijital olarak işletmeniz için kısa bir dijital büyüme analizi hazırlayabiliriz. Uygun olduğunuzda detayları paylaşmak isterim.",
    "Ücretsiz analiz": "Merhaba {ad}, ücretsiz analiziniz hazır. Website, reklam ve sosyal medya tarafındaki fırsatları kısa bir görüşmede paylaşabiliriz.",
    "Teklif takibi": "Merhaba {ad}, gönderdiğimiz teklif için sorularınız varsa yardımcı olmak isterim. Uygunsa bugün kısa bir değerlendirme yapabiliriz.",
    "Ödeme hatırlatma": "Merhaba {ad}, ödeme kaydınız için nazik bir hatırlatma yapmak istedim. Detay gerekiyorsa hemen paylaşabilirim.",
    "Rapor hazır": "Merhaba {ad}, performans raporunuz Digital Center panelinize eklendi. İnceledikten sonra sonraki adımları birlikte netleştirebiliriz.",
    "Kampanya sonucu": "Merhaba {ad}, kampanya sonuçlarınızda dikkat çeken noktaları ve önerilen aksiyonları paylaşmak isterim.",
    "Toplantı hatırlatma": "Merhaba {ad}, planlanan görüşmemizi hatırlatmak istedim. Uygunluk durumunuzu teyit edebilir misiniz?"
  };
  const [form, setForm] = useState({ template: "İlk temas", context: "Müşteri", companyId: "", leadId: "", paymentId: "", campaignId: "", reportId: "" });
  const company = companyById(content, form.companyId);
  const lead = (content.leads || []).find((item: any) => item.id === form.leadId);
  const targetName = company?.name || leadCompanyName(lead);
  const message = (templates as any)[form.template].replaceAll("{ad}", targetName || "Merhaba");
  function addNote() {
    if (!lead) return notify?.("⚠ Takip notu için lead seçin", "warning");
    const next = { ...content, leads: (content.leads || []).map((item: any) => item.id === lead.id ? { ...item, notes: `${item.notes || ""}\n${new Date().toLocaleDateString("tr-TR")} · WhatsApp hatırlatma: ${form.template}`.trim(), updated_at: new Date().toISOString() } : item) };
    setContent(next);
    save?.(next);
    notify?.("✓ Takip notu eklendi", "success");
  }
  return (
    <Panel title="WhatsApp Hatırlatma Merkezi">
      <p className="mb-5 text-sm leading-6 text-slate-400">Mesajları bağlama göre hazırlar, ancak otomatik göndermez. Mesajı kopyalayabilir veya WhatsApp’ta açabilirsiniz.</p>
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <GlassCard className="p-5"><div className="grid gap-4"><SelectField label="Şablon" value={form.template} onChange={(template) => setForm({ ...form, template })} options={Object.keys(templates)} /><SelectField label="Bağlam" value={form.context} onChange={(context) => setForm({ ...form, context })} options={["Müşteri", "Lead", "Ödeme", "Teklif", "Rapor", "Kampanya"]} /><CompanySelect value={form.companyId} onChange={(companyId) => setForm({ ...form, companyId })} companies={content.companies} /><SelectField label="Lead" value={form.leadId} onChange={(leadId) => setForm({ ...form, leadId })} options={(content.leads || []).map((item: any) => ({ value: item.id, label: leadCompanyName(item) }))} /></div><div className="mt-5 flex flex-wrap gap-2"><button onClick={() => navigator.clipboard.writeText(message)} className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">Mesajı Kopyala</button><a href={`https://wa.me/${String(company?.phone || lead?.phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="rounded-full border border-emerald-300/30 px-5 py-3 text-sm font-black text-emerald-700">WhatsApp’ta Aç</a><button onClick={addNote} className="rounded-full border border-slate-200 px-5 py-3 text-sm text-slate-700">Takip notu ekle</button><button onClick={() => setActive("Takip Merkezi")} className="rounded-full border border-cyan-200/20 px-5 py-3 text-sm text-cyan-700">Takip Merkezini Aç</button></div></GlassCard>
        <GlassCard className="p-5"><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Mesaj Önizleme</p><p className="mt-4 whitespace-pre-wrap rounded-[8px] border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">{message}</p></GlassCard>
      </div>
    </Panel>
  );
}

function ProposalEngine({ content, setContent, save, setActive }: any) {
  const { askAiProvider, chooserModal } = useAiProviderChooser();
  const [leadId, setLeadId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [packageType, setPackageType] = useState("Standart");
  const [services, setServices] = useState("Meta Ads yönetimi\nGoogle Ads kurulumu\nCRM ve lead takibi\nAylık raporlama");
  const [excludedServices, setExcludedServices] = useState("Reklam bütçesi hizmet bedeline dahil değildir.\nÜçüncü parti yazılım lisansları ayrıca değerlendirilir.");
  const [monthlyFee, setMonthlyFee] = useState("15000");
  const [adBudget, setAdBudget] = useState("30000");
  const [setupFee, setSetupFee] = useState("5000");
  const [duration, setDuration] = useState("3 ay başlangıç dönemi");
  const [paymentNote, setPaymentNote] = useState("Hizmet bedeli ay başında, reklam bütçesi platform hesabına ayrıca ödenir.");
  const [nextSteps, setNextSteps] = useState("1. Hesap erişimleri ve ölçümleme kontrolü\n2. Kreatif ve kampanya planı\n3. Yayın ve ilk 7 gün optimizasyon\n4. Aylık rapor ve yeni aksiyon planı");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState("");
  const [proposalAiMeta, setProposalAiMeta] = useState({ provider: "Groq", model: "llama-3.3-70b-versatile", mode: "Canlı", badge: "Groq ile üretildi" });
  const selectedLead = (content.leads || []).find((item) => item.id === leadId);
  const selectedCompany = (content.companies || []).find((item) => item.id === companyId) || (selectedLead ? (content.companies || []).find((company) => String(company.name || "").toLocaleLowerCase("tr") === String(selectedLead.company || "").toLocaleLowerCase("tr")) : null);
  const selectedCampaign = (content.campaigns || []).find((item) => item.id === campaignId);
  const target = selectedCompany || selectedLead || selectedCampaign || {};
  const targetName = target.name || target.company || selectedCampaign?.name || "Seçili işletme";
  const sector = target.sector || target.business_type || target.businessType || selectedLead?.business_type || "-";
  function generate(aiProvider = "Groq") {
    if (!selectedLead && !selectedCompany && !selectedCampaign) return setResult("Teklif hazırlamak için lead, müşteri veya kampanya seçin.");
    const fee = Number(monthlyFee || 0);
    const budget = Number(adBudget || 0);
    const packageMultiplier = packageType === "Temel" ? 0.8 : packageType === "Premium" ? 1.35 : packageType === "Özel" ? 1 : 1;
    const finalFee = Math.round(fee * packageMultiplier);
    setProposalAiMeta(aiMetaFromRecord({ provider: aiProvider, model: aiProvider === "Groq" ? "llama-3.3-70b-versatile" : aiProvider === "Gemini" ? "gemini-2.0-flash" : aiProvider === "OpenAI" ? "gpt-4.1-mini" : aiProvider === "Demo Modu" ? "demo-local" : aiProvider === "Yerel Mod" ? "local-rules" : "automatic-fallback", mode: ["Demo Modu", "Yerel Mod"].includes(aiProvider) ? (aiProvider === "Demo Modu" ? "Demo" : "Yerel") : "Canlı", isDemo: aiProvider === "Demo Modu", isLocal: aiProvider === "Yerel Mod", badge: `${aiProvider} ile üretildi` }));
    setResult(`HK Dijital Teklif Önizlemesi

Müşteri: ${targetName}
Sektör: ${sector}
Bağlı kampanya: ${selectedCampaign?.name || "Henüz seçilmedi"}

Problem Özeti:
${selectedLead?.message || selectedLead?.notes || notes || "Dijital reklam, takip ve raporlama süreçlerinin tek merkezden yönetilmesi gerekiyor."}

Önerilen Paket: ${packageType}
Aylık Hizmet Bedeli: ${finalFee.toLocaleString("tr-TR")} TL + KDV
Kurulum Bedeli: ${Number(setupFee || 0).toLocaleString("tr-TR")} TL + KDV
Önerilen Reklam Bütçesi: ${budget.toLocaleString("tr-TR")} TL
Süre: ${duration}

Önerilen Strateji:
Reklam bütçesi; ilk temas, yeniden pazarlama ve dönüşüm odaklı kampanya akışına bölünür. Sistem satış garantisi vermez; performansı ölçülebilir hale getirir ve reklam bütçesini daha kontrollü yönetmeye yardımcı olur.

Neden bu bütçe?
${budget.toLocaleString("tr-TR")} TL seviyesindeki bütçe; yeterli veri toplama, kreatif testi ve remarketing havuzu oluşturma için başlangıç aralığıdır. Bütçe, ilk 7-14 gün sonuçlarına göre optimize edilir.

Dahil Hizmetler:
${services.split("\n").filter(Boolean).map((item) => `- ${item}`).join("\n")}

Hariç Hizmetler:
${excludedServices.split("\n").filter(Boolean).map((item) => `- ${item}`).join("\n")}

Beklenen Çıktılar:
- Reklam hesaplarının düzenli ve ölçümlenebilir hale gelmesi
- Lead, WhatsApp veya form dönüşümlerinin takip edilmesi
- Haftalık optimizasyon notları ve aylık raporlama
- 30 günlük aksiyon planıyla kontrollü büyüme sistemi

30 Günlük Aksiyon Planı:
${nextSteps}

Ödeme Notu:
${paymentNote}

Sonraki Adımlar:
${nextSteps}

Hizmetler:
${services.split("\n").filter(Boolean).map((item) => `- ${item}`).join("\n")}

Notlar:
${notes || "Satış garantisi verilmez. Sistem; reklam bütçesini daha kontrollü yönetmeye, performansı görünür kılmaya ve lead takibini düzenlemeye yardımcı olur."}`);
  }
  function printProposal() {
    if (!result) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>HK Dijital Teklif</title><style>body{font-family:Arial,sans-serif;padding:32px;line-height:1.6;color:#2563eb}pre{white-space:pre-wrap}h1{color:#0891b2}</style></head><body><h1>HK Dijital Teklif</h1><pre>${result.replace(/[<>&]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[char] || char)}</pre></body></html>`);
    printWindow.document.close();
    printWindow.print();
  }
  async function saveProposalDocument() {
    if (!result) return setResult("Kaydetmeden önce teklif önizlemesi oluşturun.");
    const company_id = selectedCompany?.id || companyId || selectedCampaign?.company_id || "";
    const item = { id: createLocalId(), company_id, title: `Teklif · ${targetName}`, document_type: "Teklif", document_date: new Date().toISOString().slice(0, 10), description: result, document_url: "", visible_to_customer: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const next = { ...content, customerDocuments: [item, ...(content.customerDocuments || [])] };
    setContent(next);
    await save(next);
    setResult(`${result}\n\nTeklif müşteri profilindeki Belgeler/Teklifler alanına kaydedildi.`);
  }
  function archiveProposal() {
    setResult((current) => current ? `${current}\n\nArşiv notu: Bu teklif taslağı arşivlendi.` : "Arşivlenecek teklif taslağı yok.");
  }
  function whatsappProposal() {
    const message = `Merhaba, ${targetName} için ${packageType} paket teklif taslağını hazırladım. Hizmet bedeli ${Number(monthlyFee || 0).toLocaleString("tr-TR")} TL, önerilen reklam bütçesi ${Number(adBudget || 0).toLocaleString("tr-TR")} TL aralığında planlandı. İsterseniz PDF olarak paylaşabilirim.`;
    navigator.clipboard.writeText(message);
    setResult((current) => `${current || ""}\n\nWhatsApp teklif mesajı kopyalandı:\n${message}`.trim());
  }
  return <Panel title="Proposal Engine V2 · Teklif Motoru">
    <p className="mb-5 text-sm leading-6 text-slate-400">Lead, müşteri, kampanya veya AI denetim çıktısından profesyonel teklif üretin. Teklif müşteri belgelerine kaydedilebilir, yazdırılabilir veya WhatsApp mesajına dönüştürülebilir.</p>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <SelectField label="Başvuru" value={leadId} onChange={setLeadId} options={(content.leads || []).map((lead) => ({ value: lead.id, label: lead.company || lead.name || lead.email || "İsimsiz başvuru" }))} placeholder="Başvuru seçin" />
      <CompanySelect label="Müşteri" value={companyId} onChange={setCompanyId} companies={content.companies} />
      <SelectField label="Kampanya" value={campaignId} onChange={setCampaignId} options={(content.campaigns || []).map((campaign) => ({ value: campaign.id, label: campaign.name || "İsimsiz kampanya" }))} placeholder="Kampanya seçin" />
      <SelectField label="Paket" value={packageType} onChange={setPackageType} options={["Temel", "Standart", "Premium", "Özel"]} />
      <Field label="Aylık hizmet bedeli" type="number" value={monthlyFee} onChange={setMonthlyFee} />
      <Field label="Önerilen reklam bütçesi" type="number" value={adBudget} onChange={setAdBudget} />
      <Field label="Kurulum bedeli" type="number" value={setupFee} onChange={setSetupFee} />
      <Field label="Süre" value={duration} onChange={setDuration} />
      <div className="md:col-span-2 xl:col-span-3"><TextArea label="Hizmetler" value={services} onChange={setServices} /></div>
      <div className="md:col-span-2 xl:col-span-3"><TextArea label="Hariç hizmetler" value={excludedServices} onChange={setExcludedServices} /></div>
      <div className="md:col-span-2 xl:col-span-3"><TextArea label="Ödeme notu" value={paymentNote} onChange={setPaymentNote} /></div>
      <div className="md:col-span-2 xl:col-span-3"><TextArea label="Sonraki adımlar / 30 günlük plan" value={nextSteps} onChange={setNextSteps} /></div>
      <div className="md:col-span-2 xl:col-span-3"><TextArea label="Notlar" value={notes} onChange={setNotes} /></div>
    </div>
    <div className="mt-5 flex flex-wrap gap-2">
      <button type="button" onClick={() => askAiProvider(generate)} className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">Teklif önizlemesi oluştur</button>
      <button type="button" onClick={printProposal} className="rounded-full border border-slate-200 px-5 py-3 text-sm font-black text-slate-700">PDF / Yazdır</button>
      <button type="button" onClick={saveProposalDocument} className="rounded-full border border-emerald-200/25 px-5 py-3 text-sm font-black text-emerald-700">Müşteri Belgelerine Kaydet</button>
      <button type="button" onClick={whatsappProposal} className="rounded-full border border-emerald-200/25 px-5 py-3 text-sm font-black text-emerald-700">WhatsApp teklif mesajı oluştur</button>
      <button type="button" onClick={archiveProposal} className="rounded-full border border-amber-200/25 px-5 py-3 text-sm font-black text-amber-700">Arşivle</button>
      <button type="button" onClick={() => setResult("")} className="rounded-full border border-red-200/25 px-5 py-3 text-sm font-black text-red-100">Sil</button>
      <button type="button" onClick={() => setActive?.("AI Denetim")} className="rounded-full border border-cyan-200/20 px-5 py-3 text-sm font-black text-cyan-700">AI Denetimden teklif üret</button>
    </div>
    {result && <div className="mt-5 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-4"><AiUsageBadge meta={proposalAiMeta} /><pre className="mt-4 whitespace-pre-wrap text-sm leading-7 text-cyan-700">{result}</pre><button type="button" onClick={() => navigator.clipboard.writeText(result)} className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-100/20 px-4 py-2 text-sm text-cyan-700"><Copy size={15} /> Kopyala</button></div>}
    {chooserModal}
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
        <p className="text-sm font-black text-cyan-700">HK Dijital çalışma rehberi</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">İhtiyacınız olan ekranı veya işlemi arayın. Her başlık temel adımları kısa ve anlaşılır biçimde açıklar.</p>
        <label className="mt-4 flex min-h-11 items-center gap-2 rounded-[8px] border border-slate-200 bg-slate-50 px-3">
          <Search size={16} className="text-cyan-700" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Kılavuzda ara..." className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500" />
        </label>
      </div>
      <div className="grid gap-4">
        {filtered.map(([id, title, items]) => (
          <div id={id} key={id} className="scroll-mt-28 rounded-[8px] border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-black">{title}</h3>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">{items.map((item) => <li key={item} className="flex gap-2"><span className="text-cyan-700">-</span><span>{item}</span></li>)}</ul>
          </div>
        ))}
        {!filtered.length && <p className="rounded-[8px] border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">Aramanızla eşleşen bir kılavuz başlığı bulunamadı.</p>}
      </div>
    </Panel>
  );
}

function MiniCollection({ title, items, setItems, fields, empty }: any) {
  const update = (index, patch) => setItems(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  return (
    <div className="mb-6 rounded-[8px] border border-slate-200 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-black">{title}</h3>
        <button onClick={() => setItems([...items, { id: `${Date.now()}`, ...empty }])} className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950"><Plus size={14} /> Ekle</button>
      </div>
      <div className="grid gap-4">
        {items.map((item, index) => (
          <div key={item.id || index} className="grid gap-3 rounded-[8px] bg-slate-50 p-3 md:grid-cols-2">
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
