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
