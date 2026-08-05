import { Bot, Download, FileBarChart, Gauge, LayoutDashboard, MapPinned, Settings2, Sparkles, UsersRound, type LucideIcon } from "lucide-react";

export const adminCategoryIcons: Record<string, LucideIcon> = {
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

// A single, consistent nav accent (HK Cyan) for every module group. Each of
// the 9 groups previously had its own hue (navy/teal/blue/indigo/orange/
// purple/green/slate) — a "rainbow sidebar" that reads as noisy rather than
// premium. The HK Design System reserves color for meaning (status, brand
// actions), not as a per-group decoration: every group now shares the same
// calm accent, and active/hover state (not color) communicates selection.
// Kept as CSS custom properties (not hardcoded classes) so globals.css can
// still style the nav with a single generic rule per state.
const HK_NAV_ACCENT = { solid: "#0B7A88", soft: "#DDF6F8", text: "#0B6B78" };

export function groupAccentStyle(_label: string): React.CSSProperties {
  const accent = HK_NAV_ACCENT;
  return { "--nav-accent": accent.solid, "--nav-accent-soft": accent.soft, "--nav-accent-text": accent.text } as React.CSSProperties;
}

const adminLabelEmojis: Record<string, string> = {
  "Kontrol Merkezi": "🖥️",
  "CRM & Müşteriler": "👥",
  "İstihbarat Merkezi": "🧭",
  "Reklam & Raporlama": "📊",
  "Ajans Operasyonları": "🗂️",
  "Tahsilat & Operasyon": "💳",
  "İçerik & Yapay Zekâ Stüdyosu": "✨",
  "Büyüme Motoru": "🚀",
  "Reklam Operasyon Merkezi": "📡",
  "Araçlar": "🧰",
  "Araçlar & Yardım": "🧰",
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
  "Sistem Sağlık Merkezi": "🩺",
  "HK Intelligence Kontrol Merkezi": "🧠",
  "Funnel Planlayıcı": "🧭",
  "Modül Pazarı": "🛍️",
  "HK Intelligence Commander": "🧠",
  "Risk Merkezi": "🚨",
  "HK Dijital Sistem Rehberi": "📚",
  "Log ve Aktivite Merkezi": "🧾",
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
  "Lead Analizi": "🎯",
  "Takip Merkezi": "📞",
  "Yapay Zekâ Denetim": "🧠",
  "PDF Rapor Tasarım Merkezi": "🖨️",
  "Gelir Tahmini": "📈",
  "Gelir / Gider": "💸",
  "Kârlılık": "💰",
  "Bekleyen Ödemeler": "⏳",
  "Müşteri Finans Özeti": "🧾",
  Export: "📤",
  "Sözleşme Oluştur": "📝",
  "WhatsApp Hatırlatma Merkezi": "💬",
  "Web Site Analitiği": "📊",
  "Reklam Yorum Merkezi": "🧠",
  "Reklam Doktoru Pro": "🧠",
  "HK Agent Hub": "🤖",
  "QA Merkezi": "🧪"
};

export function withAdminEmoji(label: string) {
  const emoji = adminLabelEmojis[label];
  return emoji && !label.startsWith(emoji) ? `${emoji} ${label}` : label;
}
