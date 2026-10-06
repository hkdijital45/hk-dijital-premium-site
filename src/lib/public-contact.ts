// Single source for public contact CTAs. Placeholder values (ending in seven
// zeros, e.g. +90 555 000 00 00) are rejected, so a CTA is hidden instead
// of pointing at a fake number. Env vars win over content values.

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

export function resolvePublicWhatsappUrl(socialsUrl?: string | null, contactNumber?: string | null, envNumber: string | undefined = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER): string | null {
  const envDigits = resolvePublicWhatsappNumber(null, envNumber);
  if (envDigits) return `https://wa.me/${envDigits}`;
  const social = String(socialsUrl ?? "").trim();
  if (social && !social.replace(/\D/g, "").includes(PLACEHOLDER_NUMBER_DIGITS)) return social;
  const contactDigits = resolvePublicWhatsappNumber(contactNumber, undefined);
  return contactDigits ? `https://wa.me/${contactDigits}` : null;
}
