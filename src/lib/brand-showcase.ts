// "HK Dijital ile Çalışan Markalar" — admin-managed brand showcase shown on
// the public homepage. Pure, alias-free helpers only (unit-testable with
// plain Node): persistence, auth and storage live in the API routes.
export type BrandShowcaseRow = {
  id: string;
  name: string;
  logo_url: string | null;
  services: unknown;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at?: string | null;
};

export const BRAND_NAME_MAX = 120;
export const BRAND_DESCRIPTION_MAX = 400;
export const BRAND_SERVICE_MAX = 60;
export const BRAND_SERVICES_MAX_COUNT = 12;

export const BRAND_LOGO_MAX_SIZE = 5 * 1024 * 1024;
export const BRAND_LOGO_MIME_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp"
};

// Services are a small, order-preserving list the admin edits as chips — a
// JSONB string array is the simplest fit, not a relational table.
// Preset options offered as checkboxes in the admin "Verdiğimiz Hizmetler"
// picker. Purely a UI convenience list — the stored field is still the same
// free-form services string array, so older/custom values never need a
// migration and a preset never needs its own column.
export const BRAND_PRESET_SERVICES = [
  "Meta Ads Yönetimi",
  "Google Ads Yönetimi",
  "Sosyal Medya Yönetimi",
  "İçerik Üretimi",
  "SEO",
  "Web Tasarım",
  "Raporlama & Analiz",
  "Remarketing"
] as const;

const PRESET_LOOKUP = new Map(BRAND_PRESET_SERVICES.map((preset) => [preset.toLocaleLowerCase("tr"), preset]));

// Case-insensitive match against the preset list, returning the preset's
// canonical label (so a legacy value with different casing still renders
// as the checkbox option, never as a duplicate custom chip).
export function matchPresetService(value: string): string | null {
  return PRESET_LOOKUP.get(String(value ?? "").trim().toLocaleLowerCase("tr")) ?? null;
}

// Splits a saved services array into "which presets are checked" and
// "everything else" (legacy values and genuinely custom entries) — this is
// what guarantees backward compatibility: nothing in `custom` is ever lost.
export function splitServices(services: string[]): { presets: string[]; custom: string[] } {
  const presets: string[] = [];
  const custom: string[] = [];
  for (const service of services) {
    const preset = matchPresetService(service);
    if (preset) {
      if (!presets.includes(preset)) presets.push(preset);
    } else {
      custom.push(service);
    }
  }
  return { presets, custom };
}

// One toggle for both preset checkboxes and custom-chip removal: present ->
// remove (case-insensitive), absent -> add through the same normalization
// used by the server, so duplicates are never possible either way.
export function toggleService(services: string[], value: string): string[] {
  const key = String(value ?? "").trim().toLocaleLowerCase("tr");
  const has = services.some((service) => service.toLocaleLowerCase("tr") === key);
  if (has) return services.filter((service) => service.toLocaleLowerCase("tr") !== key);
  return normalizeServices([...services, value]);
}

export function normalizeServices(input: unknown): string[] {
  const list = Array.isArray(input) ? input : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const value = String(raw ?? "").trim().replace(/\s+/g, " ").slice(0, BRAND_SERVICE_MAX);
    if (!value) continue;
    const key = value.toLocaleLowerCase("tr");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= BRAND_SERVICES_MAX_COUNT) break;
  }
  return out;
}

export type BrandInputFields = { name: string; services: string[]; description: string | null };

export function parseBrandFields(input: unknown): { ok: true; value: BrandInputFields } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Geçersiz istek." };
  const body = input as Record<string, unknown>;
  const name = String(body.name ?? "").trim().slice(0, BRAND_NAME_MAX);
  if (!name) return { ok: false, error: "Firma / marka adı zorunludur." };
  const services = normalizeServices(body.services);
  const descriptionRaw = String(body.description ?? "").trim().slice(0, BRAND_DESCRIPTION_MAX);
  return { ok: true, value: { name, services, description: descriptionRaw || null } };
}

export function extensionForBrandLogo(mimeType: string): string | null {
  return BRAND_LOGO_MIME_TYPES[mimeType] ?? null;
}

export function validateBrandLogoMeta(file: { type: string; size: number }): { ok: true } | { ok: false; error: string } {
  if (!file || file.size <= 0) return { ok: false, error: "Logo dosyası okunamadı." };
  if (file.size > BRAND_LOGO_MAX_SIZE) return { ok: false, error: "Logo dosyası 5 MB sınırını aşıyor." };
  if (!extensionForBrandLogo(file.type)) return { ok: false, error: "Logo PNG, JPG veya WEBP formatında olmalı." };
  return { ok: true };
}

// Simple, maintainable reordering: swap sort_order with the previous/next
// row in display order (no drag & drop, no renumbering the whole table).
export function swapPlan(
  rows: Array<{ id: string; sort_order: number }>,
  id: string,
  direction: "up" | "down"
): { ok: true; a: { id: string; sort_order: number }; b: { id: string; sort_order: number } } | { ok: false; error: string } {
  const ordered = [...rows].sort((x, y) => x.sort_order - y.sort_order || x.id.localeCompare(y.id));
  const index = ordered.findIndex((row) => row.id === id);
  if (index === -1) return { ok: false, error: "Kayıt bulunamadı." };
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= ordered.length) return { ok: false, error: "Sıralama bu yönde değiştirilemez." };
  const current = ordered[index];
  const neighbor = ordered[targetIndex];
  return {
    ok: true,
    a: { id: current.id, sort_order: neighbor.sort_order },
    b: { id: neighbor.id, sort_order: current.sort_order }
  };
}

export function servicesArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    } catch {
      return [];
    }
  }
  return [];
}
