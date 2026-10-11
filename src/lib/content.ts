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

// Request-scoped (cache()) fetch of the raw site_settings row, including
// updated_at — the one place that column is read, so getSiteContent() and
// the optimistic-concurrency helpers below never issue two separate
// queries for the same row within a request.
const getSiteContentRow = cache(async (): Promise<{ value: SiteContent | null; updatedAt: string | null }> => {
  if (!hasSupabaseConfig()) return { value: null, updatedAt: null };
  try {
    const rows = await supabaseRest<Array<{ value: SiteContent; updated_at: string }>>(
      `site_settings?key=eq.${siteContentKey}&select=value,updated_at&limit=1`
    );
    const row = rows[0];
    return { value: row?.value ?? null, updatedAt: row?.updated_at ?? null };
  } catch {
    return { value: null, updatedAt: null };
  }
});

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

  const row = await getSiteContentRow();
  return withPackages(row.value ? normalizeAiDefaults(polishPublicCopy({ ...seed, ...row.value })) : seed);
});

// The site_settings row's updated_at, used as an optimistic-concurrency
// token (see saveSiteContentIfUnchanged) — exposed to admin callers so a
// save can be rejected instead of silently overwriting a newer save that
// happened in between this request's read and its write.
export async function getSiteContentVersion(): Promise<string | null> {
  const row = await getSiteContentRow();
  return row.updatedAt;
}

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

// Data-integrity fix (2026-10-11): site_settings.value is the one real
// JSONB store for brand/socials/contact/settings/seo/pages/certificates/
// services/packages/quoteWizard/media — plain saveSiteContent() replaces
// that whole column, so two admins (or two tabs) editing DIFFERENT parts
// of it concurrently could silently clobber each other: whichever request
// lands last wins, discarding the other's legitimate save with no error.
//
// This performs the same write as a single, atomic, conditionally-filtered
// PostgREST PATCH — "update the row only if its updated_at still matches
// what I read before I started editing". If someone else saved in between,
// the filter matches zero rows, PostgREST returns an empty array (not an
// error), and this returns {ok:false} instead of overwriting the newer
// data. The caller must re-fetch and ask for a retry — never silently
// merge or force the write.
//
// expectedVersion is null for a brand-new row (nothing to conflict with
// yet) or in local dev without Supabase — both fall back to the existing
// insert-if-missing / file-write behavior via saveSiteContent.
export async function saveSiteContentIfUnchanged(
  content: SiteContent,
  expectedVersion: string | null
): Promise<{ ok: true; version: string | null } | { ok: false }> {
  if (!hasSupabaseConfig() || expectedVersion == null) {
    // No prior row to conflict against (brand-new DB / local dev without
    // Supabase) — saveSiteContent's own insert-if-missing path sets
    // updated_at implicitly via the DB default, but that value is never
    // echoed back here, so the version this returns is only used to seed
    // the very next OCC attempt, not treated as DB-verified.
    await saveSiteContent(content);
    return { ok: true, version: hasSupabaseConfig() ? new Date().toISOString() : null };
  }

  const nextVersion = new Date().toISOString();
  const patched = await supabaseRest<Array<{ updated_at: string }>>(
    `site_settings?key=eq.${siteContentKey}&updated_at=eq.${encodeURIComponent(expectedVersion)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ value: content, updated_at: nextVersion })
    }
  ).catch(() => [] as Array<{ updated_at: string }>);

  if (Array.isArray(patched) && patched.length > 0) return { ok: true, version: patched[0].updated_at };
  return { ok: false };
}

// For narrow, server-computed patches (AI settings/status, media uploads)
// where there is no human in the loop to ask "please retry" — reads the
// current content fresh, applies mutate, and retries the OCC save a few
// times if another write lands in the same instant. Never loops forever:
// after the last attempt it writes unconditionally via saveSiteContent
// rather than dropping the change (these are small, additive patches, not
// full-form saves, so the residual race window this leaves is the same
// one that already existed everywhere before this fix — strictly better,
// never worse).
export async function mutateSiteContent(mutate: (current: SiteContent) => SiteContent, attempts = 3): Promise<SiteContent> {
  const seed = await getSeedContent();
  // Deliberately bypasses getSiteContentRow's request-scoped cache() on
  // every attempt — a retry loop that re-read the same memoized value on
  // each pass would never see the conflicting write it's retrying against.
  const readFresh = async (): Promise<{ content: SiteContent; version: string | null }> => {
    if (!hasSupabaseConfig()) return { content: seed, version: null };
    try {
      const rows = await supabaseRest<Array<{ value: SiteContent; updated_at: string }>>(
        `site_settings?key=eq.${siteContentKey}&select=value,updated_at&limit=1`
      );
      const row = rows[0];
      return { content: row?.value ? normalizeAiDefaults(polishPublicCopy({ ...seed, ...row.value })) : seed, version: row?.updated_at ?? null };
    } catch {
      return { content: seed, version: null };
    }
  };

  let last: { content: SiteContent; version: string | null } | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await readFresh();
    const next = mutate(last.content);
    const result = await saveSiteContentIfUnchanged(next, last.version);
    if (result.ok) return next;
  }
  const next = mutate((last ?? (await readFresh())).content);
  await saveSiteContent(next);
  return next;
}

export function getPackageById(content: SiteContent, id: string) {
  return content.packages.find((item) => item.id === id) ?? content.packages[0];
}

export const disclaimerText =
  "Satış garantisi verilmez. Reklam bütçesi hizmet bedeline dahil değildir. Fiyatlara KDV dahil değildir. Sonuçlar sektör, bütçe, hedef kitle, teklif ve rekabet durumuna göre değişebilir.";
