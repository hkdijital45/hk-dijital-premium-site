// Single source for public contact CTAs. Placeholder values (ending in seven
// zeros, e.g. +90 555 000 00 00) are rejected, so a CTA is hidden instead
// of pointing at a fake number. Env vars win over content values.

// A social URL that's just the platform's bare domain root (e.g.
// "https://instagram.com/" with no username/channel path) is not a real
// business account link — it's what's left in the field when nobody has
// ever filled it in for real. Shown as-is, it reads as "follow us on
// Instagram" pointing at Instagram's own homepage, which is worse than
// showing nothing. Used both to hide the CTA at display time (SocialLinks,
// /iletisim) and to reject it at save time (public-contact-validation.ts)
// so the admin isn't allowed to save this looking like it's configured.
// whatsapp is exempt from the empty-path check: unlike instagram.com/,
// a bare wa.me/https://wa.me with no number is still caught separately by
// isPlausiblePhoneDigits on the actual contact.whatsappNumber field, and a
// configured socials.whatsapp link legitimately always has its number in
// the path, never the bare domain.
export function isRealProfileUrl(key: string, href: string): boolean {
  try {
    const url = new URL(href);
    const path = url.pathname.replace(/\/+$/, "");
    if (!path || path === "") return key === "whatsapp";
    return path !== "/" && !["/hk", "/profile"].includes(path.toLowerCase());
  } catch {
    return false;
  }
}

export function realPhoneDigits(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 10 && !/0{7}$/.test(digits) ? digits : null;
}

export function resolvePublicPhoneNumber(contactPhone?: string | null, envPhone: string | undefined = process.env.NEXT_PUBLIC_PHONE_NUMBER): string | null {
  return realPhoneDigits(envPhone) ?? realPhoneDigits(contactPhone);
}

export function resolvePublicPhoneE164(contactPhone?: string | null, envPhone: string | undefined = process.env.NEXT_PUBLIC_PHONE_NUMBER): string | null {
  const digits = resolvePublicPhoneNumber(contactPhone, envPhone);
  return digits ? `+${digits}` : null;
}

export function resolvePublicTelHref(contactPhone?: string | null, envPhone: string | undefined = process.env.NEXT_PUBLIC_PHONE_NUMBER): string | null {
  const e164 = resolvePublicPhoneE164(contactPhone, envPhone);
  return e164 ? `tel:${e164}` : null;
}

const PLACEHOLDER_NUMBER_DIGITS = "905550000000";

export function resolvePublicWhatsappNumber(contactNumber?: string | null, envNumber: string | undefined = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER): string | null {
  return realPhoneDigits(envNumber) ?? realPhoneDigits(contactNumber);
}

// defaultMessage (from the admin's "WhatsApp varsayılan mesaj" field) is
// appended as a URL-encoded ?text= param — only onto a wa.me link we build
// ourselves (envDigits/contactDigits), never onto a raw socials.whatsapp
// URL, since that may already be a full custom link the admin configured.
export function resolvePublicWhatsappUrl(socialsUrl?: string | null, contactNumber?: string | null, envNumber: string | undefined = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER, defaultMessage?: string | null): string | null {
  const text = defaultMessage?.trim() ? `?text=${encodeURIComponent(defaultMessage.trim())}` : "";
  const envDigits = resolvePublicWhatsappNumber(null, envNumber);
  if (envDigits) return `https://wa.me/${envDigits}${text}`;
  const social = String(socialsUrl ?? "").trim();
  if (social && !social.replace(/\D/g, "").includes(PLACEHOLDER_NUMBER_DIGITS)) return social;
  const contactDigits = resolvePublicWhatsappNumber(contactNumber, undefined);
  return contactDigits ? `https://wa.me/${contactDigits}${text}` : null;
}
