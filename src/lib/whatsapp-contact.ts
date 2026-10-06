// The site content ships a placeholder number (+905550000000). It must never
// become a live wa.me link. Priority: NEXT_PUBLIC_WHATSAPP_NUMBER, then a
// real socials URL, then the real content number. Returns null otherwise, so
// callers hide the WhatsApp CTA instead of showing a fake one.
const PLACEHOLDER_NUMBER_DIGITS = "905550000000";

export function resolvePublicWhatsappNumber(contactNumber?: string | null, envNumber: string | undefined = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER): string | null {
  for (const candidate of [envNumber, contactNumber]) {
    const digits = String(candidate ?? "").replace(/\D/g, "");
    if (digits.length >= 10 && !/0{7}$/.test(digits)) return digits;
  }
  return null;
}

export function resolvePublicWhatsappUrl(socialsUrl?: string | null, contactNumber?: string | null, envNumber: string | undefined = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER): string | null {
  const envDigits = resolvePublicWhatsappNumber(null, envNumber);
  if (envDigits) return `https://wa.me/${envDigits}`;
  const social = String(socialsUrl ?? "").trim();
  if (social && !social.replace(/\D/g, "").includes(PLACEHOLDER_NUMBER_DIGITS)) return social;
  const contactDigits = resolvePublicWhatsappNumber(contactNumber, undefined);
  return contactDigits ? `https://wa.me/${contactDigits}` : null;
}
