export type DigitalVisibilitySection = {
  title: string;
  summary?: string;
  items: string[];
};

export type DigitalVisibilityReport = {
  summary?: string;
  sections: DigitalVisibilitySection[];
  score?: number | null;
  scoreLabel?: string | null;
};

type UnknownRecord = Record<string, unknown>;

const RAW_JSON_MARKERS = [
  "{\"summary\":",
  "\"sections\":",
  "\"items\":",
  "[{",
  "}]",
  "\\\"",
  "\\n",
  "```"
];

const ALTERNATIVE_SECTION_TITLES: Array<[string, string]> = [
  ["overview", "Genel Değerlendirme"],
  ["generalAssessment", "Genel Değerlendirme"],
  ["digitalVisibility", "Genel Değerlendirme"],
  ["strengths", "Güçlü Yönler"],
  ["weaknesses", "Geliştirilmesi Gerekenler"],
  ["improvements", "Geliştirilmesi Gerekenler"],
  ["findings", "Geliştirilmesi Gerekenler"],
  ["opportunities", "Fırsatlar"],
  ["recommendations", "Önerilen Aksiyonlar"],
  ["actions", "Önerilen Aksiyonlar"]
];

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripCodeFence(value: string) {
  let text = value.trim();
  const fenceMatch = text.match(/^```(?:json|JSON|markdown|md)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) text = fenceMatch[1].trim();
  return text.replace(/^```(?:json|JSON|markdown|md)?\s*/g, "").replace(/\s*```$/g, "").trim();
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function decodeJsonishString(value: string): unknown {
  let candidate: unknown = stripCodeFence(value);
  for (let index = 0; index < 4; index += 1) {
    if (typeof candidate !== "string") return candidate;
    const text = stripCodeFence(candidate.trim());
    if (!text) return "";

    const parsed = safeJsonParse(text);
    if (parsed !== null) {
      candidate = parsed;
      continue;
    }

    if ((text.startsWith("\\{") || text.startsWith("{\\\"")) && text.includes("\\\"")) {
      const unescaped = text.replace(/\\"/g, "\"").replace(/\\\\n/g, "\n").replace(/\\n/g, "\n");
      const unescapedParsed = safeJsonParse(unescaped);
      if (unescapedParsed !== null) {
        candidate = unescapedParsed;
        continue;
      }
    }

    return text;
  }
  return candidate;
}

function cleanText(value: unknown, maxLength = 1_500) {
  const text = String(value ?? "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, "\"")
    .replace(/[\u0000-\u0008\u000B-\u001F]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);

  return RAW_JSON_MARKERS.reduce((current, marker) => current.replaceAll(marker, ""), text).trim();
}

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function looksLikeStructuredReportText(value: unknown) {
  if (typeof value !== "string") return false;
  const text = stripCodeFence(value);
  return /summary|sections|items|strengths|weaknesses|recommendations|digitalVisibility/i.test(text) && /[{}[\]]/.test(text);
}

function textItemsFromValue(value: unknown): string[] {
  const decoded = typeof value === "string" ? decodeJsonishString(value) : value;
  if (Array.isArray(decoded)) return decoded.flatMap((item) => textItemsFromValue(item)).filter(Boolean).slice(0, 12);
  if (isRecord(decoded)) {
    const nested = normalizeDigitalVisibilityReport(decoded);
    return [
      nested.summary,
      ...nested.sections.flatMap((section) => [section.summary, ...section.items])
    ].filter((item): item is string => Boolean(item));
  }

  const text = cleanText(decoded, 2_000);
  if (!text) return [];
  const bulletLines = text
    .split(/\n+/)
    .map((line) => cleanText(line.replace(/^[-*•]\s*/, "").replace(/^\d+[.)]\s*/, ""), 800))
    .filter(Boolean);
  if (bulletLines.length > 1) return bulletLines.slice(0, 12);
  return [text];
}

function sectionFromValue(title: string, value: unknown): DigitalVisibilitySection | null {
  if (value === null || value === undefined || value === "") return null;
  const decoded = typeof value === "string" ? decodeJsonishString(value) : value;
  if (isRecord(decoded) && ("title" in decoded || "items" in decoded || "summary" in decoded)) {
    const normalizedTitle = cleanText(decoded.title || title, 120);
    const items = textItemsFromValue(decoded.items || decoded.content || decoded.text || decoded.value);
    const summary = cleanText(decoded.summary, 600);
    if (!normalizedTitle || (!summary && !items.length)) return null;
    return { title: normalizedTitle, ...(summary ? { summary } : {}), items };
  }

  const items = textItemsFromValue(decoded);
  if (!items.length) return null;
  return { title, items };
}

function markdownToReport(value: string): DigitalVisibilityReport {
  const text = cleanText(stripCodeFence(value), 10_000);
  if (!text) return { sections: [] };

  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const sections: DigitalVisibilitySection[] = [];
  const summaryParts: string[] = [];
  let current: DigitalVisibilitySection | null = null;

  for (const line of lines) {
    const heading = line.match(/^#{1,4}\s+(.+)$/) || line.match(/^(.+):$/);
    const bullet = line.match(/^[-*•]\s+(.+)$/) || line.match(/^\d+[.)]\s+(.+)$/);
    if (heading) {
      if (current && (current.summary || current.items.length)) sections.push(current);
      current = { title: cleanText(heading[1], 120), items: [] };
      continue;
    }
    if (bullet) {
      if (!current) current = { title: "Genel Değerlendirme", items: [] };
      current.items.push(cleanText(bullet[1], 800));
      continue;
    }
    if (current) {
      current.summary = [current.summary, cleanText(line, 800)].filter(Boolean).join(" ");
    } else {
      summaryParts.push(cleanText(line, 800));
    }
  }
  if (current && (current.summary || current.items.length)) sections.push(current);

  if (!sections.length) return { summary: summaryParts.join(" "), sections: [] };
  return { summary: summaryParts.join(" ") || undefined, sections };
}

function normalizeSections(value: unknown): DigitalVisibilitySection[] {
  const decoded = typeof value === "string" ? decodeJsonishString(value) : value;
  if (Array.isArray(decoded)) {
    return decoded
      .map((section, index) => sectionFromValue(`Bölüm ${index + 1}`, section))
      .filter((section): section is DigitalVisibilitySection => Boolean(section));
  }
  if (isRecord(decoded)) {
    return Object.entries(decoded)
      .map(([key, sectionValue]) => sectionFromValue(cleanText(key, 120), sectionValue))
      .filter((section): section is DigitalVisibilitySection => Boolean(section));
  }
  return [];
}

function reportFromObject(value: UnknownRecord): DigitalVisibilityReport {
  const sectionsInput = value.sections || value.section || value.blocks;

  if (Array.isArray(sectionsInput)) {
    const embedded = sectionsInput
      .flatMap((section) => (isRecord(section) ? textItemsFromValue(section.items) : textItemsFromValue(section)))
      .find(looksLikeStructuredReportText);
    if (embedded) {
      const nested = normalizeDigitalVisibilityReport(embedded);
      if (nested.sections.length) return nested;
    }
  }

  const sections = normalizeSections(sectionsInput);
  for (const [key, title] of ALTERNATIVE_SECTION_TITLES) {
    if (title === "Genel Değerlendirme") continue;
    const section = sectionFromValue(title, value[key]);
    if (!section) continue;
    sections.push(section);
  }

  const overview = ALTERNATIVE_SECTION_TITLES
    .filter(([, title]) => title === "Genel Değerlendirme")
    .map(([key]) => value[key])
    .find((item) => item !== undefined);
  const summary = cleanText(value.summary || value.overview || value.generalAssessment || value.digitalVisibility || overview, 1_500);

  return {
    ...(summary ? { summary } : {}),
    sections,
    score: numberOrNull(value.score ?? value.digitalScore ?? value.visibilityScore),
    scoreLabel: cleanText(value.scoreLabel ?? value.score_label ?? value.statusLabel, 80) || null
  };
}

export function normalizeDigitalVisibilityReport(input: unknown): DigitalVisibilityReport {
  if (input === null || input === undefined || input === "") return { sections: [] };

  const decoded = typeof input === "string" ? decodeJsonishString(input) : input;
  if (isRecord(decoded)) {
    const report = reportFromObject(decoded);
    if (report.summary || report.sections.length || report.score !== null) return report;
  }

  if (typeof decoded === "string") {
    const parsed = markdownToReport(decoded);
    if (parsed.summary || parsed.sections.length) return parsed;
  }

  const text = cleanText(decoded, 5_000);
  return text ? { summary: text, sections: [] } : { sections: [] };
}

export function digitalVisibilityReportToPlainText(report: DigitalVisibilityReport, title = "DİJİTAL GÖRÜNÜRLÜK RAPORU") {
  const lines = [title, ""];
  if (report.summary) lines.push("Genel Değerlendirme", report.summary, "");
  if (report.score !== null && report.score !== undefined) {
    lines.push(`Skor: ${report.score}/100${report.scoreLabel ? ` - ${report.scoreLabel}` : ""}`, "");
  }
  for (const section of report.sections) {
    lines.push(section.title);
    if (section.summary) lines.push(section.summary);
    section.items.forEach((item, index) => {
      const prefix = /aksiyon|öneri/i.test(section.title) ? `${index + 1}.` : "-";
      lines.push(`${prefix} ${item}`);
    });
    lines.push("");
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
