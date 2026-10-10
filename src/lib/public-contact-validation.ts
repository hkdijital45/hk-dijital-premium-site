// Shared client+server validation for the admin "İletişim ve Sosyal Medya"
// settings — used by both the admin save form (src/components/admin/
// AdminDashboard.tsx) and the PUT /api/content route, so a request that
// bypasses the UI (curl, a compromised admin tab) can't sneak a dangerous
// value past the server. Pure functions, zero imports — unit-testable
// with the plain node test runner.

const DANGEROUS_URL_SCHEMES = /^\s*(javascript|data|vbscript|file):/i;

export function isSafeHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true; // empty is always allowed — it just means "not shown"
  if (DANGEROUS_URL_SCHEMES.test(trimmed)) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

// Google Maps embed specifically must be an actual Google Maps iframe
// embed source, not just any https URL — otherwise this field is a way to
// render an arbitrary attacker-controlled iframe on the public site.
export function isSafeMapsEmbedUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (!isSafeHttpUrl(trimmed)) return false;
  try {
    const url = new URL(trimmed);
    return /(^|\.)google\.com$/.test(url.hostname) && url.pathname.startsWith("/maps/embed");
  } catch {
    return false;
  }
}

export function normalizeWhatsappNumber(value: string): string {
  return value.replace(/[^\d]/g, "");
}

// Loose on purpose per "gereksiz katı kontrollerle geçerli yabancı telefon
// numaralarını... engelleme" — just real digit count for a plausible
// international number (7–15 digits, E.164's own bound), not a strict
// per-country format.
export function isPlausiblePhoneDigits(value: string): boolean {
  if (!value.trim()) return true;
  const digits = normalizeWhatsappNumber(value);
  return digits.length >= 7 && digits.length <= 15;
}

export const SOCIAL_URL_FIELDS = ["instagram", "facebook", "youtube", "twitter", "linkedin", "tiktok"] as const;

export type ContactSettingsInput = {
  phone?: string;
  whatsappNumber?: string;
  whatsappDefaultMessage?: string;
  email?: string;
  address?: string;
  city?: string;
  district?: string;
  workingHours?: string;
  addressVisible?: boolean;
  mapsEmbedUrl?: string;
};

export type SocialsInput = Partial<Record<(typeof SOCIAL_URL_FIELDS)[number] | "whatsapp", string>>;

/** Returns a human-readable Turkish error for the first invalid field, or null if everything is safe. */
export function validateContactAndSocials(contact: ContactSettingsInput, socials: SocialsInput): string | null {
  if (contact.mapsEmbedUrl && !isSafeMapsEmbedUrl(contact.mapsEmbedUrl)) {
    return "Harita bağlantısı yalnızca geçerli bir Google Haritalar gömme (embed) adresi olabilir.";
  }
  if (contact.whatsappNumber && !isPlausiblePhoneDigits(contact.whatsappNumber)) {
    return "WhatsApp numarası geçerli görünmüyor.";
  }
  if (contact.phone && !isPlausiblePhoneDigits(contact.phone)) {
    return "Telefon numarası geçerli görünmüyor.";
  }
  for (const key of [...SOCIAL_URL_FIELDS, "whatsapp"] as const) {
    const value = socials[key];
    if (value && !isSafeHttpUrl(value)) {
      return `${key} bağlantısı geçerli bir http(s) adresi olmalı.`;
    }
  }
  return null;
}
