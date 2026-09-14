import "server-only";

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";

// Canonical HK Admin El Kitabı (handbook) source — bundled under src/assets
// (not docs/, not public/) so it (a) ships inside the Vercel serverless
// function like the Geist font already does via the same readFileSync(
// join(process.cwd(), "src", ...)) pattern, and (b) is never reachable as a
// public static file — every access goes through an authenticated
// /hk-admin page or /api/admin route, same as the rest of HK Admin.
const HANDBOOK_DIR = join(process.cwd(), "src", "assets", "hk-admin-el-kitabi");
const HANDBOOK_MD_PATH = join(HANDBOOK_DIR, "handbook.md");
export const HANDBOOK_SCREENSHOTS_DIR = join(HANDBOOK_DIR, "screenshots");

// Filenames intentionally match ekran-goruntuleri-dizini.md's "Şekil NN"
// index exactly, so the figure number in the text always resolves to the
// right file with no separate mapping table to keep in sync.
const AVAILABLE_SCREENSHOTS = new Set(
  (() => {
    try {
      return readdirSync(HANDBOOK_SCREENSHOTS_DIR).filter((name) => name.endsWith(".png"));
    } catch {
      return [];
    }
  })()
);

function figureFileFor(num: string): string | null {
  const match = [...AVAILABLE_SCREENSHOTS].find((name) => name.startsWith(`${num}-`));
  return match || null;
}

export function listHandbookScreenshotFiles(): string[] {
  return [...AVAILABLE_SCREENSHOTS].sort();
}

export function readHandbookScreenshot(fileName: string): Buffer | null {
  if (!AVAILABLE_SCREENSHOTS.has(fileName)) return null; // allowlist only — never resolve an arbitrary path
  return readFileSync(join(HANDBOOK_SCREENSHOTS_DIR, fileName));
}

export function readHandbookMarkdown(): string {
  return readFileSync(HANDBOOK_MD_PATH, "utf8");
}

const CALLOUT_LABELS: Record<string, string> = {
  "BU EKRANDASIN": "📍 Bu ekrandasın",
  "HK İPUCU": "💡 HK İpucu",
  "PROFESYONEL KULLANIM": "🎯 Profesyonel Kullanım",
  "SATIŞ İPUCU": "📈 Satış İpucu",
  "OPERASYON İPUCU": "⚙️ Operasyon İpucu",
  "AI NOTU": "🤖 AI Notu",
  "DİKKAT": "⚠️ Dikkat",
  "KISA YOL": "⌨️ Kısa Yol",
  "SIRADAKİ ADIM": "➡️ Sıradaki Adım",
  "SIK YAPILAN HATA": "🔁 Sık Yapılan Hata",
  "GERÇEK VERİ": "✅ Gerçek Veri",
  "AI YORUMU": "🧠 AI Yorumu"
};

// Bracket-tagged callout blocks are this handbook's own convention (see
// "Kutu ve etiket sistemi" in the handbook's own intro) — not standard
// markdown. [GÖRSEL ÖNERİSİ] / [PREMIUM SAYFA TASARIMI] blocks were
// illustration-generation prompts for an earlier, now-abandoned
// AI-illustrated approach (superseded by real screenshots) and are dropped
// entirely from the rendered output; [EKRAN GÖRÜNTÜSÜ — ŞEKİL NN] becomes a
// real <img> when that figure has been captured, otherwise a plain
// "hazırlanıyor" note. Every other tag becomes a styled callout div, with
// its body rendered through markdown-it independently (a nested call, kept
// as an HTML island the outer render pass leaves untouched) so lists/bold
// inside a callout still render correctly.
const innerMd = new MarkdownIt({ html: false, linkify: true, breaks: false });

function renderFigure(num: string): string {
  const file = figureFileFor(num);
  if (!file) return `<p class="hk-figure-pending">📷 Şekil ${num} — bu baskıda henüz eklenmedi (bkz. ekran görüntüsü durumu notu).</p>`;
  return `<figure class="hk-figure"><img src="/api/admin/system-guide/el-kitabi/screenshots/${file}" alt="Şekil ${num} — HK Admin ekran görüntüsü" loading="lazy" /><figcaption>Şekil ${num}</figcaption></figure>`;
}

function convertCallouts(markdown: string): string {
  // Matches a `[TAG]` on its own line, followed by everything up to the
  // next blank line, next bracket tag, or next heading.
  const pattern = /^\[([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ0-9 —]*)\]\n([\s\S]*?)(?=\n\s*\n|\n\[[A-ZÇĞİÖŞÜ]|\n#{1,3} |$)/gm;
  return markdown.replace(pattern, (full, rawTag: string, body: string) => {
    const tag = rawTag.trim();
    if (tag === "GÖRSEL ÖNERİSİ" || tag === "PREMIUM SAYFA TASARIMI") return "";
    if (tag.startsWith("EKRAN GÖRÜNTÜSÜ")) {
      const figureMatch = tag.match(/ŞEKİL (\d+)/);
      return figureMatch ? renderFigure(figureMatch[1]) : "";
    }
    const label = CALLOUT_LABELS[tag] || tag;
    const slug = tag.toLowerCase().replace(/[^a-zçğıöşü0-9]+/g, "-");
    return `<div class="hk-callout hk-callout-${slug}">\n<p class="hk-callout-label">${label}</p>\n\n${innerMd.render(body.trim())}\n</div>`;
  });
}

const outerMd = new MarkdownIt({ html: true, linkify: true, breaks: false });

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "p", "ul", "ol", "li", "strong", "em", "a", "blockquote", "br", "code", "pre",
    "img", "figure", "figcaption", "div", "span", "hr", "table", "thead", "tbody", "tr", "th", "td"
  ],
  allowedAttributes: {
    a: ["href"],
    img: ["src", "alt", "loading"],
    div: ["class"],
    p: ["class"],
    "*": ["id"]
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https", ""] },
  allowedClasses: { div: [/^hk-/], p: [/^hk-/] }
};

export type HandbookChapter = { number: string; title: string; id: string; html: string };

function slugify(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

let cachedChapters: HandbookChapter[] | null = null;

// Splits on top-level `# N. Title` headings (the handbook's own chapter
// convention — see hk-admin-el-kitabi-full.md's İÇİNDEKİLER) into
// independently rendered chapters, so the viewer page can show a real
// chapter-by-chapter table of contents instead of one giant scroll.
export function getHandbookChapters(): HandbookChapter[] {
  if (cachedChapters) return cachedChapters;
  const raw = readHandbookMarkdown();
  const processed = convertCallouts(raw);
  const lines = processed.split("\n");
  const chapters: Array<{ number: string; title: string; lines: string[] }> = [];
  let current: { number: string; title: string; lines: string[] } | null = null;
  for (const line of lines) {
    const heading = line.match(/^# (\d+)\.\s+(.+)$/);
    if (heading) {
      if (current) chapters.push(current);
      current = { number: heading[1], title: heading[2].trim(), lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
    else if (chapters.length === 0 && !current) {
      // Front-matter before chapter 1 (title page, scope note, "how to use
      // this book", table of contents) — kept as a synthetic "0" chapter.
      current = { number: "0", title: "Önsöz ve İçindekiler", lines: [line] };
    }
  }
  if (current) chapters.push(current);

  cachedChapters = chapters.map((chapter) => ({
    number: chapter.number,
    title: chapter.title,
    id: `bolum-${chapter.number}-${slugify(chapter.title)}`,
    html: sanitizeHtml(outerMd.render(chapter.lines.join("\n")), sanitizeOptions)
  }));
  return cachedChapters;
}

export type HandbookPlainSection = { number: string; title: string; text: string };

// Figure -> chapter mapping, straight from docs/hk-admin-el-kitabi/
// ekran-goruntuleri-dizini.md's own table — kept here (not derived) since
// it's small, fixed, and that index file is planning material, not bundled.
export const FIGURE_CHAPTER_MAP: Record<string, string> = {
  "01": "6", "02": "7", "03": "9", "06": "15", "07": "16", "08": "19", "09": "27"
};

// Flattened, styling-free rendition for the PDF generator — one section per
// chapter, images stripped (the PDF embeds real screenshots separately via
// generateHandbookPdfBuffer, which needs raw file bytes, not HTML).
export function getHandbookPlainSections(): HandbookPlainSection[] {
  const raw = readHandbookMarkdown();
  const withoutIllustrationPrompts = raw
    .replace(/^\[GÖRSEL ÖNERİSİ\]\n[\s\S]*?(?=\n\s*\n|\n\[[A-ZÇĞİÖŞÜ]|\n#{1,3} |$)/gm, "")
    .replace(/^\[PREMIUM SAYFA TASARIMI\]\n[\s\S]*?(?=\n\s*\n|\n\[[A-ZÇĞİÖŞÜ]|\n#{1,3} |$)/gm, "")
    .replace(/^\[EKRAN GÖRÜNTÜSÜ[^\]]*\]$/gm, "");
  const chapterBlocks = withoutIllustrationPrompts.split(/\n(?=# \d+\.\s)/);
  return chapterBlocks.map((block) => {
    const heading = block.match(/^# (\d+)\.\s+(.+)$/m);
    const text = block
      .replace(/^#{1,4}\s+.+$/gm, "")
      .replace(/^\[[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ0-9 —]*\]$/gm, "")
      .replace(/[|>#*`]/g, "")
      .replace(/\n{2,}/g, "\n")
      .trim();
    return { number: heading?.[1] || "0", title: heading ? heading[2].trim() : "Önsöz", text };
  }).filter((section) => section.text.length > 0);
}

export function getHandbookMeta() {
  const raw = readHandbookMarkdown();
  // \S+ (not \w+) for the month token — \w doesn't match Turkish letters
  // like the 'ü' in "Eylül" without the /u flag, which silently failed this
  // match entirely and fell through to the file-mtime fallback below
  // (observed live: showed a nonsensical 2018 date from the deploy
  // packaging step instead of the handbook's real "13 Eylül 2026").
  const dateMatch = raw.match(/HK Dijital · (.+?) · (\d{1,2} \S+ \d{4})/);
  const stat = statSync(HANDBOOK_MD_PATH);
  return {
    edition: dateMatch?.[1] || "Birinci baskı",
    publishedLabel: dateMatch?.[2] || new Date(stat.mtime).toLocaleDateString("tr-TR"),
    lastModified: stat.mtime.toISOString(),
    chapterCount: getHandbookChapters().filter((c) => c.number !== "0").length,
    screenshotCount: listHandbookScreenshotFiles().length
  };
}
