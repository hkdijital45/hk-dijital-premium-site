// The site content ships a placeholder number (+905550000000). It must never
// become a live wa.me link, so a number is only used when it is a real one:
// NEXT_PUBLIC_WHATSAPP_NUMBER first, otherwise the content number if valid.
export function resolvePublicWhatsappNumber(contactNumber?: string | null, envNumber: string | undefined = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER): string | null {
  for (const candidate of [envNumber, contactNumber]) {
    const digits = String(candidate ?? "").replace(/\D/g, "");
    if (digits.length >= 10 && !/0{7}$/.test(digits)) return digits;
  }
  return null;
}
