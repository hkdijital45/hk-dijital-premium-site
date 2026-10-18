// Evidence-scoped wording for Google indexing findings in Ön İnceleme
// reports. Pure and framework-free (unit-testable under plain node).
//
// Root cause this guards against: a `<meta name="robots" content="noindex">`
// tag seen on ONE page (usually the home page) — sometimes combined with a
// single `site:` query snapshot — was written up as a site-wide, absolute
// conclusion ("Google'da hiçbir sayfası görünmüyor", "organik trafik fiilen
// kapalı"). Neither a page-level meta tag nor a point-in-time search result
// proves the indexing state of every page or that organic traffic is zero;
// only Google Search Console data can establish that.
//
// This module NEVER rewrites saved text. It only (1) gives the prompt /
// tool description one canonical rule and example sentence, and (2)
// returns advisory warnings from save_pre_audit_report so the author can
// correct the wording themselves. Stored reports are left untouched.

export const NOINDEX_EVIDENCE_RULE = [
  "GOOGLE İNDEKSLEME İFADELERİ (kanıt kapsamı kuralı):",
  "- noindex/nofollow etiketini yalnızca gerçekten kontrol ettiğin sayfa(lar) için yaz; yalnızca ana sayfa kontrol edildiyse açıkça \"ana sayfada\" de.",
  "- Google arama gözlemlerini kontrol edilen sorgu ve tarihle sınırla (ör. \"18.10.2026 tarihli site: sorgusunda sonuç listelenmedi\").",
  "- Google Search Console verisi olmadan tüm sayfaların indekslenmediğini, sitenin Google'da hiç görünmediğini veya organik trafiğin sıfır/kapalı olduğunu kesin olarak yazma.",
  "- Doğru örnek: \"18.10.2026 tarihinde yapılan kontrolde web sitesinin ana sayfasında arama motorlarına indekslememe talimatı veren noindex etiketi tespit edilmiştir. Bu ayar ana sayfanın Google arama sonuçlarında görünmesini engelleyebilir. Diğer sayfaların indekslenme durumu Google Search Console üzerinden ayrıca doğrulanmalıdır.\""
].join("\n");

export type EvidenceWordingWarning = {
  /** Dotted path of the field the phrase was found in (e.g. "seo_analysis.Etki"). */
  path: string;
  /** The exact matched text, so the author can find it. */
  phrase: string;
  guidance: string;
};

const GUIDANCE_SITE_WIDE =
  "Kesin ve site geneli bir indeksleme hükmü içeriyor. Kontrol edilen sayfayı (ör. ana sayfa), sorguyu ve tarihi belirt; diğer sayfalar için Google Search Console doğrulaması gerektiğini ekle.";
const GUIDANCE_TRAFFIC =
  "Organik trafiğin sıfır/kapalı olduğu Search Console veya analitik verisi olmadan kanıtlanamaz. \"organik görünürlüğü olumsuz etkileyebilir\" gibi koşullu bir ifade kullan.";
const GUIDANCE_OPEN_TO_GOOGLE =
  "\"Site Google'a açılmalı\" tüm sitenin kapalı olduğunu ima eder. Doğrulanan sayfadaki noindex ayarının kontrol edilmesini öner.";

// Turkish-aware, case-insensitive patterns. Kept deliberately narrow:
// each one is an absolute/site-wide claim, never a scoped observation.
const PATTERNS: Array<{ re: RegExp; guidance: string }> = [
  { re: /google['’]?da\s+(?:hiçbir|hiç\s+bir|hiç)\s+sayfa(?:sı|ları)?\s+(?:görünmüyor|yok|listelenmiyor|çıkmıyor)/giu, guidance: GUIDANCE_SITE_WIDE },
  { re: /(?:site(?:niz|nin|si)?|web\s+site(?:niz|nin|si)?)\s+(?:fiilen\s+|şu\s+an\s+)?google['’]?da\s+(?:yok|görünmüyor)/giu, guidance: GUIDANCE_SITE_WIDE },
  { re: /google['’]?da\s+(?:fiilen\s+)?(?:görünmüyor|görünmemesi|görünmemektedir)/giu, guidance: GUIDANCE_SITE_WIDE },
  { re: /google\s+dizin(?:in)?de\s+(?:yok|görünmüyor|değil|olmaması|olmadığı)/giu, guidance: GUIDANCE_SITE_WIDE },
  { re: /dizin(?:de|li)\s+(?:değil|olmaması|olmadığı)/giu, guidance: GUIDANCE_SITE_WIDE },
  { re: /(?:tüm|bütün|her)\s+(?:site(?:nin)?\s+)?sayfa(?:lar)?(?:ın)?da\s+[`"']?noindex/giu, guidance: GUIDANCE_SITE_WIDE },
  { re: /(?:tüm|bütün)\s+site(?:nin)?\s+(?:google\s+tarafından\s+)?(?:engellen|indekslen|dizinlen)\w*/giu, guidance: GUIDANCE_SITE_WIDE },
  { re: /organik\s+(?:\(ücretsiz\)\s+)?(?:arama\s+)?(?:trafi(?:ği|k)|görünürlük|görünürlüğü)[^.\n]{0,40}?(?:fiilen\s+)?(?:kapalı|sıfır|yok)/giu, guidance: GUIDANCE_TRAFFIC },
  { re: /google['’]?a\s+açıl(?:ması|malı|madığı|ırsa|dığında)/giu, guidance: GUIDANCE_OPEN_TO_GOOGLE }
];

function collectStrings(value: unknown, path: string, out: Array<{ path: string; text: string }>, depth = 0) {
  if (depth > 12 || value === null || value === undefined) return;
  if (typeof value === "string") {
    if (value.trim()) out.push({ path, text: value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStrings(item, `${path}[${index}]`, out, depth + 1));
    return;
  }
  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      collectStrings(entry, path ? `${path}.${key}` : key, out, depth + 1);
    }
  }
}

/** Advisory scan of every string in a report payload for absolute,
 * site-wide Google indexing / organic-traffic claims. Returns one warning
 * per match (deduplicated per path+phrase). Never mutates the input. */
export function findIndexingOverclaims(report: Record<string, unknown>): EvidenceWordingWarning[] {
  const strings: Array<{ path: string; text: string }> = [];
  for (const [key, value] of Object.entries(report)) collectStrings(value, key, strings);
  const seen = new Set<string>();
  const warnings: EvidenceWordingWarning[] = [];
  for (const { path, text } of strings) {
    for (const { re, guidance } of PATTERNS) {
      re.lastIndex = 0;
      for (const match of text.matchAll(re)) {
        const phrase = match[0].trim();
        const id = `${path}|${phrase.toLocaleLowerCase("tr")}`;
        if (seen.has(id)) continue;
        seen.add(id);
        warnings.push({ path, phrase, guidance });
      }
    }
  }
  return warnings;
}
