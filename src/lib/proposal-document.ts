// Pure formatting helpers for /api/admin/proposals/pdf, split out so the
// filename-safety and reference-number logic can be unit tested without
// pulling in Next.js server internals or a real Supabase session.
const TURKISH_TRANSLITERATION: Record<string, string> = {
  ı: "i", İ: "I", ğ: "g", Ğ: "G", ş: "s", Ş: "S", ç: "c", Ç: "C", ö: "o", Ö: "O", ü: "u", Ü: "U"
};

export function sanitizeForFilename(value: string): string {
  return value
    .replace(/[ığĞşŞçÇöÖüÜİ]/g, (char) => TURKISH_TRANSLITERATION[char] ?? char)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "Teklif";
}

// There is no dedicated `proposals` table (only proposal_followups, which
// doesn't carry every field a proposal document needs), so there is no
// database sequence to draw a proposal number from. This mints a real,
// unique document reference at generation time from a real UUID — it is a
// document reference, not a claim about a persisted sequential ID.
export function buildProposalNumber(now: Date, randomSuffix: string): string {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `HK-${datePart}-${randomSuffix.slice(0, 8).toUpperCase()}`;
}

export function buildProposalFilename(companyName: string, proposalNumber: string): string {
  return `HK-Dijital-Teklif-${sanitizeForFilename(companyName)}-${proposalNumber}.pdf`;
}
