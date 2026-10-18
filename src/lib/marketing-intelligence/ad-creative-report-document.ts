// Builds the DocumentPayload (server/document-generator.ts's
// generatePdfBuffer/generateDocxBuffer — the same canonical, Turkish-
// glyph-safe, HK Dijital-branded engine every export in the app already
// goes through) for a Reklam Kreatif Raporu — Müşteri Raporu or Dahili
// Rapor.
//
// Readability redesign: every field is its own bullet ("bir bilgi = bir
// madde") instead of several labeled facts joined into one paragraph;
// known jargon (Hook, CTA, Reels, Funnel, FPS, ...) always renders with
// its short Turkish meaning in parentheses, unless that meaning is
// already present anywhere in the same text (Claude-authored free text
// frequently self-explains a term already — optionalText() must be
// idempotent, never re-wrap an already-explained term). Pure/no I/O,
// presentation + content-normalization only — no new field is invented;
// every bullet maps to a real value already on the record (see
// ad-creative-reports.ts).
import { CREATIVE_FORMATS, type AdCreativeReportRecord, type CreativeItem } from "./ad-creative-reports";
import type { DocumentPayload, DocumentSection } from "@/lib/server/document-generator";
import { CREATIVE_GLOSSARY, buildGlossarySection } from "@/lib/report-glossary";
import { formatReportDate } from "@/lib/report-timestamp";

export type CreativeReportDocumentMode = "client" | "internal";

const FIELD_TITLE_SIZE = 10.5;
const FORMAT_LABELS: Record<string, string> = {
  reels: "Reels (Kısa dikey video)",
  video: "Video",
  story: "Story (Hikâye)",
  static: "Statik Görsel",
  carousel: "Carousel (Kaydırmalı gönderi)"
};

function formatLabel(format?: string): string {
  return (format && FORMAT_LABELS[format]) || format || "—";
}

// Jargon (Hook, CTA, Reels, ...) is explained once, in a closing
// "Terimler Sözlüğü" section (report-glossary.ts) — free text is never
// rewritten with in-sentence explanations, which broke Turkish suffixes
// and nested explanations inside each other.
function optionalText(text?: string | null): string | undefined {
  return text || undefined;
}

// Claude's own free-text sections (internal_report/client_report and
// item.details/internalNotes) are sometimes authored as literal Markdown
// ("- **Durum:** ..."), since our own prompt asks for "bullets". Our PDF/
// DOCX engine has no Markdown renderer and no bold font, so a raw
// Markdown line would show up as a literal "•  - **Durum:**" (bullet
// prefix + leftover list marker + leftover asterisks). Strip the
// Markdown syntax while keeping the label text intact — "**Durum:**"
// becomes "Durum:", which already matches our own "Label: value" bullet
// convention.
function stripMarkdown(line: string): string {
  return line.replace(/^\s*[-*•]\s+/, "").replace(/\*\*/g, "").trim();
}

// Safe, conservative text -> bullet-line splitting — same precedent as
// content-plan/pdf-payload.ts's splitIntoReadableChunks: prefer the
// author's own line breaks; fall back to sentence-boundary splitting
// only if it produces >=2 confident chunks; otherwise keep the text as
// one unsplit line (kept intact is safer than wrongly split).
function splitIntoBulletLines(text?: string | null): string[] {
  if (!text) return [];
  const trimmed = text.trim();
  if (!trimmed) return [];
  const byNewline = trimmed.split(/\n+/).map((l) => stripMarkdown(l)).filter(Boolean);
  if (byNewline.length > 1) return byNewline;
  const bySentence = trimmed
    .split(/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ0-9])/)
    .map((l) => stripMarkdown(l))
    .filter(Boolean);
  if (bySentence.length > 1 && bySentence.every((s) => s.length >= 3)) return bySentence;
  return [stripMarkdown(trimmed)];
}

// Author-written production-notes blobs (item.details) are already free
// text, but for video/Reels/Story creatives they typically describe both
// shooting and editing in one blob (our own Claude prompt asks for
// "çekim talimatları" + "kurgu planı" together). Classify each line by
// its own real keywords instead of inventing structure the source text
// doesn't have — anything unrecognized still renders, just under a
// generic fallback heading, so nothing is ever silently dropped.
const SHOOT_KEYWORDS = /\b(çekim|kamera|telefon|işık|tripod|arka ?plan|zoom|fps|9:16|dikey|konum|çözünürlük|kadraj)\b/i;
const EDIT_KEYWORDS = /\b(kurgu|kesim|müzik|ekran yazı|hız|sahne sırası|geçiş|son cta)\b/i;

function classifyProductionNotes(details?: string | null): { shoot: string[]; edit: string[]; other: string[] } {
  const lines = splitIntoBulletLines(optionalText(details));
  const shoot: string[] = [];
  const edit: string[] = [];
  const other: string[] = [];
  for (const line of lines) {
    if (SHOOT_KEYWORDS.test(line)) shoot.push(line);
    else if (EDIT_KEYWORDS.test(line)) edit.push(line);
    else other.push(line);
  }
  return { shoot, edit, other };
}

// Per-creative sections are pushed directly (never deduped against each
// other or against the top-level sections) — every creative legitimately
// repeats subheadings like "Kısa Özet" / "Reklam Metni" / "Nasıl
// Çekilecek?"; deduping those by title would silently delete creative
// 2/3/4's own content, which is exactly the bug this fixes.
function creativeSections(item: CreativeItem, index: number, mode: CreativeReportDocumentMode): DocumentSection[] {
  const sections: DocumentSection[] = [];
  const isInternal = mode === "internal";
  const isVideoLike = item.format === "video" || item.format === "reels" || item.format === "story";

  // The main "N. TITLE" heading must always carry real content — a
  // DocumentSection with no items/text/table is silently skipped by the
  // render loop (generatePdfBuffer/generateDocxBuffer only draw a
  // heading when it has a body), which previously made every creative's
  // own separator heading vanish from the actual PDF/DOCX output. A
  // short one-line format caption guarantees it always renders.
  sections.push({
    title: `${index + 1}. ${(item.title || "Kreatif").toLocaleUpperCase("tr")}`,
    titleSize: 16,
    spacingBefore: index === 0 ? 0 : 22,
    minSpaceBefore: 120,
    text: `Format: ${formatLabel(item.format)}`
  });

  const summaryItems: string[] = [];
  if (item.campaign) summaryItems.push(`Kampanya: ${item.campaign}`);
  if (item.adSet) summaryItems.push(`Reklam seti (Ad Set): ${item.adSet}`);
  if (item.priority) summaryItems.push(`Öncelik: ${item.priority}`);
  if (item.videoDuration) summaryItems.push(`Video süresi: ${item.videoDuration}`);
  if (isInternal && item.funnelStage) summaryItems.push(`Satış hunisi aşaması (funnel): ${item.funnelStage}`);
  if (isInternal && item.angle) summaryItems.push(`Kreatif açısı: ${item.angle}`);
  if (item.hook) summaryItems.push(`Hook (Dikkat çekici açılış): ${item.hook}`);
  if (item.cta) summaryItems.push(`CTA (Eylem çağrısı): ${item.cta}`);
  if (summaryItems.length) sections.push({ title: "Kısa Özet", titleSize: 13, spacingBefore: 6, items: summaryItems });

  const reasonItems: string[] = [];
  if (item.hook) reasonItems.push(`İlk saniyelerde izleyicinin durmasını sağlamak için "${item.hook}" mesajıyla başlıyoruz.`);
  if (isInternal && item.angle) reasonItems.push(`Kreatif açısı: ${item.angle}.`);
  if (item.cta) reasonItems.push(`İzleyiciyi net bir şekilde "${item.cta}" eylemine yönlendiriyoruz.`);
  if (reasonItems.length) sections.push({ title: "Neden Bu Kreatifi Kullanıyoruz?", titleSize: 13, spacingBefore: 6, items: reasonItems });

  if (item.videoScenes?.length) {
    const rows = [...item.videoScenes].sort((a, b) => (a.order || 0) - (b.order || 0)).map((s) => [
      String(s.order ?? "—"), optionalText(s.visual) || "—", optionalText(s.onScreenText) || "—", optionalText(s.voiceover) || "—", optionalText(s.purpose) || "—"
    ]);
    sections.push({
      title: "Sahne Planı", titleSize: 13, spacingBefore: 6,
      table: { headers: ["Sahne", "Ne çekilecek?", "Ekran yazısı", "Ses-konuşma", "Bu sahnenin amacı"], rows }
    });
  }
  if (item.carouselSlides?.length) {
    const rows = [...item.carouselSlides].sort((a, b) => (a.order || 0) - (b.order || 0)).map((s) => [
      String(s.order ?? "—"), optionalText(s.title) || "—", optionalText(s.subtext) || "—", optionalText(s.visualSuggestion) || "—"
    ]);
    sections.push({ title: "Carousel Slaytları", titleSize: 13, spacingBefore: 6, table: { headers: ["Sıra", "Başlık", "Alt Metin", "Görsel Önerisi"], rows } });
  }

  if (item.staticFields && Object.values(item.staticFields).some(Boolean)) {
    const sf = item.staticFields;
    const items: string[] = [];
    if (sf.size || sf.platform) items.push(`Ölçü / Platform: ${[sf.size, sf.platform].filter(Boolean).join(" · ")}`);
    if (sf.visualConcept) items.push(`Görsel konsept: ${sf.visualConcept}`);
    if (sf.mainVisual) items.push(`Ana görsel: ${sf.mainVisual}`);
    if (sf.background) items.push(`Arka plan: ${sf.background}`);
    if (sf.headline) items.push(`Başlık (Headline): ${sf.headline}`);
    if (sf.subheadline) items.push(`Alt başlık: ${sf.subheadline}`);
    if (sf.offer) items.push(`Teklif: ${sf.offer}`);
    if (sf.cta) items.push(`CTA (Eylem çağrısı): ${sf.cta}`);
    if (sf.logoPlacement) items.push(`Logo yerleşimi: ${sf.logoPlacement}`);
    if (isInternal && sf.designHierarchy) items.push(`Tasarım hiyerarşisi: ${sf.designHierarchy}`);
    if (isInternal && sf.textDensity) items.push(`Metin yoğunluğu: ${sf.textDensity}`);
    if (isInternal && sf.designPitfallsToAvoid) items.push(...splitIntoBulletLines(optionalText(sf.designPitfallsToAvoid)).map((l) => `Kaçınılacak: ${l}`));
    if (items.length) sections.push({ title: "Tasarım Detayları", titleSize: FIELD_TITLE_SIZE, items });
  }

  if (item.storyFields && Object.values(item.storyFields).some(Boolean)) {
    const stf = item.storyFields;
    const items: string[] = [];
    if (stf.aspectRatio) items.push(`Boyut oranı: ${stf.aspectRatio}`);
    if (stf.hook) items.push(`Hook (Dikkat çekici açılış): ${stf.hook}`);
    if (stf.mainMessage) items.push(`Ana mesaj: ${stf.mainMessage}`);
    if (stf.visualSuggestion) items.push(`Görsel/Video önerisi: ${stf.visualSuggestion}`);
    if (stf.cta) items.push(`CTA (Eylem çağrısı): ${stf.cta}`);
    if (stf.action) items.push(`Aksiyon: ${stf.action}`);
    if (isInternal && stf.textPlacement) items.push(`Metin yerleşimi: ${stf.textPlacement}`);
    if (isInternal && stf.safeArea) items.push(`Güvenli alan: ${stf.safeArea}`);
    if (stf.sequence) items.push(`Sekans: ${stf.sequence}`);
    if (items.length) sections.push({ title: "Story Detayları", titleSize: FIELD_TITLE_SIZE, items });
  }

  if (item.adCopy && Object.values(item.adCopy).some(Boolean)) {
    const ac = item.adCopy;
    const items: string[] = [];
    if (ac.primaryText) items.push(`Ana reklam metni (Primary Text): ${ac.primaryText}`);
    if (ac.headline) items.push(`Başlık (Headline): ${ac.headline}`);
    if (ac.description) items.push(`Açıklama (Description): ${ac.description}`);
    if (ac.cta) items.push(`CTA (Eylem çağrısı): ${ac.cta}`);
    if (items.length) sections.push({ title: "Reklam Metni", titleSize: FIELD_TITLE_SIZE, items });
  }

  if (item.details) {
    if (isVideoLike) {
      const { shoot, edit, other } = classifyProductionNotes(item.details);
      if (shoot.length) sections.push({ title: "Nasıl Çekilecek?", titleSize: FIELD_TITLE_SIZE, items: shoot });
      if (edit.length) sections.push({ title: "Nasıl Kurgulanacak?", titleSize: FIELD_TITLE_SIZE, items: edit });
      if (other.length) sections.push({ title: isInternal ? "Detay / Üretim Notları" : "Üretim Notları", titleSize: FIELD_TITLE_SIZE, items: other });
    } else {
      const items = splitIntoBulletLines(optionalText(item.details));
      if (items.length) sections.push({ title: isInternal ? "Detay / Üretim Notları" : "Üretim Notları", titleSize: FIELD_TITLE_SIZE, items });
    }
  }
  if (isInternal && item.internalNotes) {
    const items = splitIntoBulletLines(optionalText(item.internalNotes));
    if (items.length) sections.push({ title: "Ajans İçi Not", titleSize: FIELD_TITLE_SIZE, items });
  }

  return sections;
}

export function buildCreativeReportDocumentPayload(companyName: string, report: AdCreativeReportRecord, mode: CreativeReportDocumentMode): DocumentPayload {
  const sections: DocumentSection[] = [];
  const isInternal = mode === "internal";

  // Dedup scope is deliberately limited to TOP-LEVEL/document-wide
  // headings only (front-matter, strategy summary, the record's own
  // free-text report sections, materials/checklist/A-B-test group
  // headings) — never applied to per-creative sections, which are
  // pushed straight into `sections` below and legitimately repeat
  // subheadings across creatives.
  const seenTopTitles = new Set<string>();
  const pushTopSection = (section: DocumentSection) => {
    const key = section.title.trim().toLocaleUpperCase("tr");
    if (seenTopTitles.has(key)) return;
    seenTopTitles.add(key);
    sections.push(section);
  };

  const summaryText = (isInternal ? report.internal_report : report.client_report)?.executiveSummary;
  if (summaryText) {
    const items = splitIntoBulletLines(optionalText(summaryText));
    if (items.length) pushTopSection({ title: "Yönetici Özeti", items });
  }

  if (!isInternal) {
    pushTopSection({
      title: "Bu Rapor Nasıl Kullanılır?",
      titleSize: 13,
      items: [
        "Bu rapor, önümüzdeki dönemde yayınlanacak reklam kreatiflerini içerir.",
        "Her kreatif için ne çekileceği, nasıl çekileceği ve hangi metinlerin kullanılacağı adım adım anlatılır.",
        "Teknik terimlerin (Hook, CTA, Reels gibi) yanında parantez içinde Türkçe açıklaması verilmiştir.",
        "Prodüksiyon Kontrol Listesi'ni tamamlamanız, çekim için gereken materyallerin hazır olduğu anlamına gelir."
      ]
    });
  } else {
    const uncheckedMaterials = (report.production_checklist || []).filter((c) => !c.checked).length;
    const actionItems: string[] = [];
    if (uncheckedMaterials) actionItems.push(`Müşteriden eksik ${uncheckedMaterials} materyal/onayı takip edin.`);
    if (report.creatives?.length) actionItems.push(`Toplam ${report.creatives.length} kreatifin çekim/kurgu durumunu kontrol edin.`);
    if (report.ab_test_plan?.length) actionItems.push(`${report.ab_test_plan.length} adet A/B Testi (İki farklı versiyonu karşılaştırma testi) planını gözden geçirin.`);
    actionItems.push("Yayına almadan önce Meta hesap eşleşmesini doğrulayın.");
    actionItems.push("Yayına almadan önce son QA kontrolünü tamamlayın.");
    pushTopSection({ title: "Ajans İçin Hızlı Aksiyon Özeti", titleSize: 13, items: actionItems });
  }

  const s = report.strategy_summary || {};
  const summaryItems: string[] = [];
  if (s.campaignGoal) summaryItems.push(`Kampanya amacı: ${s.campaignGoal}`);
  if (s.creativeRole) summaryItems.push(`Kreatiflerin görevi: ${s.creativeRole}`);
  if (s.targetAudience) summaryItems.push(`Hedef kitle: ${s.targetAudience}`);
  if (isInternal && s.funnelStage) summaryItems.push(`Satış hunisi aşaması (funnel): ${s.funnelStage}`);
  if (isInternal && s.awarenessLevel) summaryItems.push(`Farkındalık seviyesi: ${s.awarenessLevel}`);
  if (s.keyMessage) summaryItems.push(`Ana mesaj: ${s.keyMessage}`);
  if (s.primaryCta) summaryItems.push(`Ana CTA (Eylem çağrısı): ${s.primaryCta}`);
  if (s.creativeAngles?.length) summaryItems.push(`Kreatif açılar: ${s.creativeAngles.join(", ")}`);
  if (summaryItems.length) pushTopSection({ title: "Kreatif Strateji Özeti", items: summaryItems });

  const report_ = isInternal ? report.internal_report : report.client_report;
  if (report_?.sections?.length) {
    for (const sec of report_.sections) {
      if (!sec.title || !sec.content) continue;
      const items = splitIntoBulletLines(optionalText(sec.content));
      if (items.length) pushTopSection({ title: sec.title, items });
    }
  }

  const creatives = [...(report.creatives || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  for (let i = 0; i < creatives.length; i++) {
    // Never deduped — see creativeSections() comment above.
    sections.push(...creativeSections(creatives[i], i, mode));
  }

  if (report.required_materials?.length) {
    pushTopSection({
      title: "Müşteriden İstenecek Materyaller", titleSize: 13, spacingBefore: 14,
      text: `Toplam ${report.required_materials.length} materyal listelenmiştir.`
    });
    for (const m of report.required_materials) {
      const items: string[] = [];
      if (m.quantity) items.push(`Kaç adet?: ${m.quantity}`);
      if (m.format) items.push(`Format: ${m.format}`);
      if (m.instructions) items.push(`Nasıl çekilecek?: ${m.instructions}`);
      if (m.description) items.push(`Not: ${m.description}`);
      if (items.length) sections.push({ title: m.name || "Materyal", titleSize: FIELD_TITLE_SIZE, items });
    }
  }

  if (report.production_checklist?.length) {
    pushTopSection({ title: "Prodüksiyon Kontrol Listesi", titleSize: 13, spacingBefore: 10, items: report.production_checklist.map((c) => `${c.checked ? "[x]" : "[ ]"} ${c.label}`) });
  }

  if (isInternal && report.ab_test_plan?.length) {
    pushTopSection({
      title: "A/B Testi (İki farklı versiyonu karşılaştırma testi) Planı", titleSize: 13, spacingBefore: 10,
      text: `Toplam ${report.ab_test_plan.length} test planlanmıştır.`
    });
    report.ab_test_plan.forEach((t, i) => {
      const items: string[] = [];
      if (t.hypothesis) items.push(`Hipotez: ${t.hypothesis}`);
      if (t.variable) items.push(`Değiştirilecek şey: ${t.variable}`);
      if (t.constants) items.push(`Sabit tutulacaklar: ${t.constants}`);
      if (t.expectedBehavior) items.push(`Takip edilecek sonuç: ${t.expectedBehavior}`);
      if (t.evaluationCriteria) items.push(`Ne zaman değerlendirilecek?: ${t.evaluationCriteria}`);
      if (items.length) sections.push({ title: `Test ${i + 1}${t.variable ? ` — ${t.variable}` : ""}`, titleSize: FIELD_TITLE_SIZE, items });
    });
  }

  const glossary = buildGlossarySection(sections, CREATIVE_GLOSSARY);
  if (glossary) sections.push(glossary);

  return {
    title: mode === "internal" ? "Reklam Kreatif Raporu — Dahili Rapor" : "Reklam Kreatif Raporu — Müşteri Raporu",
    customerName: companyName,
    period: formatReportDate(report.created_at),
    executiveSummary: "",
    sections,
    confidentialLabel: mode === "internal" ? "Dahili Kullanım" : undefined,
    metaLines: [
      `Müşteri: ${companyName}`,
      mode === "internal" ? `Versiyon: v${report.version} · ${report.creatives?.length || 0} kreatif` : `Hazırlanma tarihi: ${formatReportDate(new Date())}`
    ],
    footerNote: mode === "internal" ? "HK Dijital · Dahili Operasyon Belgesi · hkdijital.com.tr" : "HK Dijital · hkdijital.com.tr",
    logo: true
  };
}

export { CREATIVE_FORMATS };
