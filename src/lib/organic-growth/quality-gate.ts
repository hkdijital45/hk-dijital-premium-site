// Deterministic pre-publish quality gate for an autopilot-generated
// article. Never blocks the draft from being SAVED (a weak draft sitting
// in DRAFT status for human review is safe — it is never public) — only
// annotates it with transparent, rule-based warnings so an editor knows
// exactly what to check before approving. Zero external imports, pure.

// The exact clichés this brief/the Claude Project explicitly bans.
const FORBIDDEN_PHRASES = [
  "günümüzün dijital dünyasında",
  "dijitalleşen dünyada",
  "her geçen gün",
  "artık her zamankinden daha önemli",
  "sonuç olarak"
];

export type QualityWarning = { code: string; message: string };

export function runQualityGate(input: { title: string; content: string; wordCount: number; minWordCount: number }): QualityWarning[] {
  const warnings: QualityWarning[] = [];
  const normalizedContent = input.content.toLocaleLowerCase("tr");

  if (input.wordCount < input.minWordCount) {
    warnings.push({ code: "SHORT_BODY", message: `İçerik ${input.wordCount} kelime — hedef minimum ${input.minWordCount} kelimenin altında.` });
  }

  const foundCliches = FORBIDDEN_PHRASES.filter((phrase) => normalizedContent.includes(phrase));
  if (foundCliches.length) {
    warnings.push({ code: "GENERIC_AI_PHRASE", message: `Yasaklı klişe ifade(ler) tespit edildi: ${foundCliches.join(", ")}.` });
  }

  const headingCount = (input.content.match(/^#{2,3}\s/gm) || []).length;
  if (headingCount === 0) {
    warnings.push({ code: "NO_HEADINGS", message: "İçerikte alt başlık (H2/H3) bulunamadı." });
  }

  // A very short/empty line immediately after a heading often means the
  // model emitted a placeholder ("...", "TODO", "[buraya gelecek]").
  const placeholderPattern = /\[.*?(buraya|todo|placeholder|doldur).*?\]/i;
  if (placeholderPattern.test(input.content)) {
    warnings.push({ code: "PLACEHOLDER_TEXT", message: "İçerikte yer tutucu/placeholder metin izi bulundu." });
  }

  if (!input.title.trim()) {
    warnings.push({ code: "NO_TITLE", message: "Başlık boş." });
  }

  return warnings;
}
