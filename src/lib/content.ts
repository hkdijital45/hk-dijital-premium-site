import { promises as fs } from "fs";
import path from "path";
import type { SiteContent } from "./types";
import { hasSupabaseConfig, supabaseRest } from "./supabase";
import { SITE_PACKAGE_ITEMS } from "./packages";

const contentPath = path.join(process.cwd(), "src", "data", "site-content.json");
const siteContentKey = "site_content";

function normalizeAiDefaults<T extends SiteContent>(content: T): T {
  const api = content.settings?.api || {};
  const provider = String(api.active_ai_provider || api.activeProvider || "").toLocaleLowerCase("tr");
  const legacyDemoDefault = (!provider || provider === "automatic" || provider === "otomatik") && String(api.activeProvider || "").toLocaleLowerCase("tr") === "demo" && api.demoMode && api.ai_mode !== "demo";
  if (provider || !api.demoMode) return legacyDemoDefault ? {
    ...content,
    settings: {
      ...content.settings,
      api: {
        ...api,
        activeProvider: "automatic",
        active_ai_provider: "automatic",
        active_ai_model: "automatic-fallback",
        ai_mode: "live",
        ai_provider_priority: api.ai_provider_priority || ["gemini", "openai", "anthropic", "groq", "openrouter", "demo", "local"],
        demoMode: false,
        model: "automatic-fallback"
      }
    }
  } : content;
  return {
    ...content,
    settings: {
      ...content.settings,
      api: {
        ...api,
        activeProvider: "automatic",
        active_ai_provider: "automatic",
        active_ai_model: "automatic-fallback",
        ai_mode: "live",
        ai_provider_priority: ["gemini", "openai", "anthropic", "groq", "openrouter", "demo", "local"],
        demoMode: false,
        model: "automatic-fallback"
      }
    }
  };
}

function polishPublicCopy<T>(value: T, key = ""): T {
  if (["id", "url", "logoUrl", "footerLogoUrl", "faviconUrl", "loginLogoUrl", "customerLogoUrl", "pdfLogoUrl", "emailLogoUrl", "openGraphLogoUrl", "fileUrl", "verificationUrl", "activeProvider", "active_ai_provider", "active_ai_model", "ai_mode", "ai_provider_priority", "model"].includes(key)) return value;
  if (Array.isArray(value)) return value.map((item) => polishPublicCopy(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, polishPublicCopy(childValue, childKey)])) as T;
  }
  if (typeof value !== "string") return value;
  return value
    .replace(/CRM müşteri ilişki yönetimi sistemi/gi, "müşteri ilişki yönetimi sistemi")
    .replace(/CRM & Lead Takip Sistemi/gi, "Müşteri İlişki Yönetimi ve Talep Takibi")
    .replace(/CRM müşteri takip sistemi/gi, "müşteri takip sistemi")
    .replace(/CRM odaklı/gi, "müşteri ilişki yönetimi odaklı")
    .replace(/CRM takibi/gi, "müşteri takibi")
    .replace(/CRM ile/gi, "müşteri ilişki yönetimi ile")
    .replace(/\bCRM\b/gi, "müşteri ilişki yönetimi")
    .replace(/AI destekli/gi, "yapay zekâ destekli")
    .replace(/AI analiz/gi, "yapay zekâ analizi")
    .replace(/lead scoring/gi, "potansiyel müşteri önceliklendirmesi")
    .replace(/\blead\b/gi, "potansiyel müşteri")
    .replace(/\bfunnel\b/gi, "müşteri yolculuğu")
    .replace(/\bremarketing\b/gi, "yeniden pazarlama")
    .replace(/landing page/gi, "dönüşüm odaklı açılış sayfası")
    .replace(/mini audit/gi, "ön değerlendirme") as T;
}

export async function getSeedContent(): Promise<SiteContent> {
  const data = await fs.readFile(contentPath, "utf8");
  return normalizeAiDefaults(polishPublicCopy(JSON.parse(data) as SiteContent));
}

export async function getSiteContent(): Promise<SiteContent> {
  const seed = await getSeedContent();
  const withPackages = (content: SiteContent): SiteContent => ({
    ...content,
    packages: SITE_PACKAGE_ITEMS,
    pages: {
      ...content.pages,
      packages: {
        ...content.pages.packages,
        intro: "Meta, Google Ads, kombin reklam yönetimi ve sosyal medya hizmetlerini net kapsam, fiyat ve raporlama disipliniyle karşılaştırın."
      }
    }
  });
  if (!hasSupabaseConfig()) return withPackages(seed);

  try {
    const rows = await supabaseRest<Array<{ value: SiteContent }>>(
      `site_settings?key=eq.${siteContentKey}&select=value&limit=1`
    );
    return withPackages(rows[0]?.value ? normalizeAiDefaults(polishPublicCopy({ ...seed, ...rows[0].value })) : seed);
  } catch {
    return withPackages(seed);
  }
}

export async function getSiteTheme() {
  const fallback = {
    name: "HK Cyan",
    background: "#f7f8fb",
    surface: "#ffffff",
    text: "#0f172a",
    mutedText: "#475569",
    primaryButton: "#0891b2",
    accent: "#06b6d4",
    border: "#e2e8f0"
  };
  if (!hasSupabaseConfig()) return fallback;
  const rows = await supabaseRest<Array<{ value?: Record<string, string> }>>(
    "site_settings?key=eq.admin_theme&select=value&limit=1"
  ).catch(() => []);
  return { ...fallback, ...(rows[0]?.value || {}) };
}

export async function saveSiteContent(content: SiteContent) {
  if (hasSupabaseConfig()) {
    await supabaseRest("site_settings?key=eq.site_content", {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ value: content, updated_at: new Date().toISOString() })
    }).catch(async () => {
      await supabaseRest("site_settings", {
        method: "POST",
        body: JSON.stringify({ key: siteContentKey, value: content })
      });
    });
    return content;
  }

  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    throw new Error("Supabase bağlantısı yapılandırılmadı. Canlı ortamda kaydetme çalışmaz.");
  }

  await fs.writeFile(contentPath, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  return content;
}

export function getPackageById(content: SiteContent, id: string) {
  return content.packages.find((item) => item.id === id) ?? content.packages[0];
}

export const disclaimerText =
  "Satış garantisi verilmez. Reklam bütçesi hizmet bedeline dahil değildir. Fiyatlara KDV dahil değildir. Sonuçlar sektör, bütçe, hedef kitle, teklif ve rekabet durumuna göre değişebilir.";
