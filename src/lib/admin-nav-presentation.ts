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

// Per-module-group nav accent — semantic, not decorative: navy=system,
// turquoise=customer, blue=CRM/analysis, orange=ads/attention, purple=AI,
// green=finance, pink=content/creative. Applied as CSS custom properties so
// globals.css can style the nav with a single generic rule per state.
export const adminGroupAccents: Record<string, { solid: string; soft: string; text: string }> = {
  "Kontrol Merkezi": { solid: "#0f766e", soft: "#f0fdfa", text: "#115e59" },
  "Müşteri Merkezi": { solid: "#0891b2", soft: "#ecfeff", text: "#0e7490" },
  "CRM Merkezi": { solid: "#2563eb", soft: "#eff6ff", text: "#1d4ed8" },
  "Reklam & Performans": { solid: "#ea580c", soft: "#fff7ed", text: "#c2410c" },
  "Yapay Zekâ Merkezi": { solid: "#7c3aed", soft: "#f5f3ff", text: "#6d28d9" },
  "Ajans Operasyonu": { solid: "#4f46e5", soft: "#eef2ff", text: "#4338ca" },
  "Muhasebe": { solid: "#059669", soft: "#f0fdf4", text: "#047857" },
  "Rapor Merkezi": { solid: "#0284c7", soft: "#f0f9ff", text: "#0369a1" },
  "İçerik & Medya": { solid: "#db2777", soft: "#fdf2f8", text: "#be185d" },
  "Entegrasyonlar": { solid: "#334155", soft: "#f8fafc", text: "#1e293b" },
  "Ayarlar": { solid: "#475569", soft: "#f8fafc", text: "#334155" }
};

export function groupAccentStyle(label: string): React.CSSProperties {
  const accent = adminGroupAccents[label] || adminGroupAccents.Ayarlar;
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
