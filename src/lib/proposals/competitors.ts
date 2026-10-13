import type { ProposalCompetitor } from "./schema";

// Fixes the real bug the brief points at: an empty competitor row (added
// by the wizard's "Rakip Ekle" button and left blank) and a malformed
// URL (missing protocol, typos) were both reaching the generated Claude
// prompt as if they were real data. This module NEVER rewrites a
// malformed URL — it only validates and reports, per the brief's own
// "Do not automatically rewrite malformed URLs without validation" rule.
export function isValidHttpUrl(value: string | undefined | null): boolean {
  if (!value) return false;
  return /^https?:\/\/[^\s]+\.[^\s]+/i.test(value.trim());
}

export function isEmptyCompetitor(c: ProposalCompetitor): boolean {
  return !c.name?.trim() && !c.website?.trim() && !c.notes?.trim() && !c.sourceUrl?.trim();
}

export type SanitizedCompetitor = ProposalCompetitor & { urlWarning?: string };

export type CompetitorSanitizeResult = {
  competitors: SanitizedCompetitor[];
  warnings: string[];
};

/** Drops fully-empty rows, flags (but never silently fixes) a malformed
 * website/sourceUrl, and strips an unearned "verified" claim — a
 * competitor can only be verified if it actually carries a real,
 * well-formed sourceUrl (mirrors validateHkProposalV1's own rule, applied
 * here one stage earlier, before the prompt is even built). */
export function sanitizeCompetitorsForPrompt(competitors: ProposalCompetitor[] | undefined): CompetitorSanitizeResult {
  const warnings: string[] = [];
  const kept = (competitors || []).filter((c) => !isEmptyCompetitor(c));
  const droppedCount = (competitors || []).length - kept.length;
  if (droppedCount > 0) warnings.push(`${droppedCount} boş rakip kaydı Claude promptundan çıkarıldı.`);

  const sanitized: SanitizedCompetitor[] = kept.map((c) => {
    const next: SanitizedCompetitor = { ...c };
    const urlToCheck = c.sourceUrl || c.website;
    if (urlToCheck && !isValidHttpUrl(urlToCheck)) {
      next.urlWarning = `"${c.name || "İsimsiz rakip"}" için girilen URL geçersiz görünüyor (${urlToCheck}) — düzeltilmeden bırakıldı, lütfen manuel kontrol edin.`;
      warnings.push(next.urlWarning);
      if (next.verified) {
        next.verified = false;
        warnings.push(`"${c.name}" geçersiz/doğrulanamayan URL nedeniyle "doğrulanmamış" olarak işaretlendi.`);
      }
    } else if (next.verified && !isValidHttpUrl(c.sourceUrl)) {
      // verified:true with no real sourceUrl at all — same rule
      // validateHkProposalV1 enforces for Claude's own output, applied
      // here to user-entered data before it ever reaches the prompt.
      next.verified = false;
      warnings.push(`"${c.name}" için kaynak URL olmadan "doğrulanmış" işaretlenemez — otomatik olarak doğrulanmamışa çevrildi.`);
    }
    return next;
  });

  return { competitors: sanitized, warnings };
}
