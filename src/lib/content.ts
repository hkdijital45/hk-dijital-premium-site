import { promises as fs } from "fs";
import path from "path";
import { cache } from "react";
import type { PublicSiteContent, SiteContent } from "./types";
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
        ai_provider_priority: api.ai_provider_priority || ["gemini", "groq", "openai", "openrouter", "local", "demo"],
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
        ai_provider_priority: ["gemini", "groq", "openai", "openrouter", "local", "demo"],
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

// React's request-scoped cache — dedupes what used to be a real, repeated
// Supabase round-trip: every public page calls this once directly AND once
// again via PublicShell (Header/Footer need it too), so a single request
// was doing the identical fetch twice back-to-back. This never persists
// past one request/render, so it changes nothing about how fresh admin
// edits are — it only removes the duplicate network call within a single
// page load. Measured via Lighthouse: this and the homepage's own
// unstable_cache (see src/app/page.tsx) together were needed to bring
// server-response-time down from its original ~2.2s.
export const getSiteContent = cache(async (): Promise<SiteContent> => {
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
});

// 2026-10-11 perf fix: getSiteContent() above fetches the ENTIRE
// site_settings "site_content" row — in production that row is ~3.2MB,
// because it's shared storage for leads/users/customer
// documents/integrations/ad metrics/activity logs/etc. that have nothing
// to do with public marketing content (see PublicSiteContent's doc
// comment in types.ts, and the security fix this was found alongside:
// that data was never supposed to reach a public page in the first place).
// Public pages only ever need brand/socials/contact (services was dropped
// 2026-10-11 Phase 4 once the homepage stopped rendering a service
// explorer — nothing public reads it via this type anymore; /hizmetler
// fetches its own services directly via getSiteContent), so this queries
// Supabase with PostgREST's JSON-path select (`value->brand`, etc.) to
// fetch only those three fields — confirmed via direct curl against
// production: a few KB instead of ~3.2 MB. This directly targets the
// server-response-time bottleneck Lighthouse measured (previously ~2.2s,
// now a fraction of that), on top of the already-fixed client-payload
// leak. Reuses getSeedContent() for the local-dev/Supabase-down fallback
// rather than introducing a second seed source.
export const getPublicSiteContent = cache(async (): Promise<PublicSiteContent> => {
  const seed = await getSeedContent();
  const base: PublicSiteContent = { brand: seed.brand, socials: seed.socials, contact: seed.contact };
  if (!hasSupabaseConfig()) return base;

  try {
    const rows = await supabaseRest<Array<Partial<PublicSiteContent>>>(
      `site_settings?key=eq.${siteContentKey}&select=brand:value->brand,socials:value->socials,contact:value->contact&limit=1`
    );
    const row = rows[0];
    if (!row) return base;
    return polishPublicCopy<PublicSiteContent>({
      brand: row.brand ? { ...base.brand, ...row.brand } : base.brand,
      socials: row.socials ? { ...base.socials, ...row.socials } : base.socials,
      contact: row.contact ? { ...base.contact, ...row.contact } : base.contact
    });
  } catch {
    return base;
  }
});

// Same selective-fetch idea as getPublicSiteContent, for the one other
// field PublicShell needs server-side only (a className string, never
// passed into a Client Component prop, so it was never part of the
// security issue — just folded in here to avoid a second full fetch).
export const getPublicPerformanceMode = cache(async (): Promise<"ultra" | "balanced" | "performance"> => {
  if (!hasSupabaseConfig()) return "balanced";
  try {
    const rows = await supabaseRest<Array<{ performanceMode: SiteContent["settings"]["performanceMode"] }>>(
      `site_settings?key=eq.${siteContentKey}&select=performanceMode:value->settings->>performanceMode&limit=1`
    );
    return rows[0]?.performanceMode || "balanced";
  } catch {
    return "balanced";
  }
});

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
    // PostgREST returns 200 with an empty array when a PATCH filter matches
    // no rows (not an error), so a missing site_content row — e.g. a freshly
    // connected/never-initialized database — must be detected from the
    // result, not from a thrown error, or this silently no-ops forever.
    const patched = await supabaseRest<unknown[]>("site_settings?key=eq.site_content", {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ value: content, updated_at: new Date().toISOString() })
    }).catch(() => [] as unknown[]);
    if (!Array.isArray(patched) || patched.length === 0) {
      await supabaseRest("site_settings", {
        method: "POST",
        body: JSON.stringify({ key: siteContentKey, value: content })
      });
    }
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
