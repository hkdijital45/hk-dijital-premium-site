// Runtime companion to SiteContent (src/lib/types.ts) — TypeScript only
// checks the shape of a PUT /api/content body at compile time; a direct
// request (curl, a modified client bundle) can send any JSON object at
// runtime, including an unrecognized top-level key that would otherwise
// get written straight into the shared site_settings JSONB row. This
// rejects that instead of silently storing it.
export const SITE_CONTENT_TOP_LEVEL_KEYS = [
  "brand",
  "socials",
  "contact",
  "mediaAssets",
  "settings",
  "seo",
  "pages",
  "certificates",
  "services",
  "packages",
  "quoteWizard",
  "leads",
  "media"
] as const;

/** Returns the posted top-level keys that aren't part of SiteContent, or [] if the payload is clean. */
export function findUnauthorizedTopLevelKeys(payload: Record<string, unknown>): string[] {
  const allowed = new Set<string>(SITE_CONTENT_TOP_LEVEL_KEYS);
  return Object.keys(payload).filter((key) => !allowed.has(key));
}

// Client-side counterpart used by AdminDashboard's save() to build the
// PUT /api/content body: SITE_CONTENT_TOP_LEVEL_KEYS minus "leads". The
// admin's single merged `content` React state also carries real
// operational collections (users, companies, campaigns, leads, ...one
// object per the center-data GET response spread in on top of the site
// settings, see getAdminPageData) that are not this endpoint's job to
// touch — leads specifically already has its own real save path
// (upsertItems in /api/admin/center-data) and is excluded here even
// though the server-side allow-list above still permits it (it's a real
// SiteContent field, just not one the website-settings screen should
// ever be the one sending). AdminDashboard explicitly picks only these
// fields off `content` before every PUT /api/content call — it must
// never spread the whole merged state into that request.
export const SITE_CONTENT_EDITABLE_FROM_ADMIN_UI = SITE_CONTENT_TOP_LEVEL_KEYS.filter((key) => key !== "leads");
