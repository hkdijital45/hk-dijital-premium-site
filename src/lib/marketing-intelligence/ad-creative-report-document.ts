// Builds the DocumentPayload (server/document-generator.ts's
// generatePdfBuffer/generateDocxBuffer — the same canonical, Turkish-
// glyph-safe, HK Dijital-branded engine every export in the app already
// goes through) for a Reklam Kreatif Raporu — Müşteri Raporu or Dahili
// Rapor. Pure/no I/O. Field-level hierarchy (one section per field group,
// gold-label/body split via titleSize) matches the same readable layout
// already shipped for İçerik Takip's PDF export.
import { CREATIVE_FORMATS, type AdCreativeReportRecord, type CreativeItem } from "./ad-creative-reports";
import type { DocumentPayload, DocumentSection } from "@/lib/server/document-generator";

export type CreativeReportDocumentMode = "client" | "internal";

const FIELD_TITLE_SIZE = 10.5;
const FORMAT_LABELS: Record<string, string> = { reels: "Reels", video: "Video", story: "Story", static: "Statik Görsel", carousel: "Carousel" };

function formatLabel(format?: string): string {
  return (format && FORMAT_LABELS[format]) || format || "—";
}

function line(label: string, value?: string | null): string | null {
  return value ? `${label}: ${value}` : null;
}

function creativeSections(item: CreativeItem, index: number, mode: CreativeReportDocumentMode): DocumentSection[] {
  const sections: DocumentSection[] = [];
  const headerLines = [
    `Format: ${formatLabel(item.format)}`,
    item.campaign ? `Kampanya: ${item.campaign}` : "",
    item.adSet ? `Reklam Seti: ${item.adSet}` : "",
    item.priority ? `Öncelik: ${item.priority}` : ""
  ].filter(Boolean).join("\n");

  sections.push({
    title: `${index + 1}. ${(item.title || "Kreatif").toLocaleUpperCase("tr")}`,
    titleSize: 14,
    spacingBefore: index === 0 ? 0 : 18,
    minSpaceBefore: 90,
    text: headerLines
  });

  const pushField = (label: string, value?: string | null) => {
    if (value) sections.push({ title: label, titleSize: FIELD_TITLE_SIZE, text: value });
  };

  pushField("Hook", item.hook);
  pushField("CTA", item.cta);
  if (mode === "internal") {
    pushField("Funnel Aşaması", item.funnelStage);
    pushField("Kreatif Açısı", item.angle);
  }

  if (item.videoScenes?.length) {
    const rows = [...item.videoScenes].sort((a, b) => (a.order || 0) - (b.order || 0)).map((s) => [
      String(s.order ?? "—"), s.visual || "—", s.onScreenText || "—", s.voiceover || "—", s.purpose || "—"
    ]);
    sections.push({ title: "SAHNE PLANI", titleSize: FIELD_TITLE_SIZE, table: { headers: ["Sıra", "Görüntü", "Ekran Yazısı", "Seslendirme", "Amaç"], rows } });
  }
  if (item.carouselSlides?.length) {
    const rows = [...item.carouselSlides].sort((a, b) => (a.order || 0) - (b.order || 0)).map((s) => [
      String(s.order ?? "—"), s.title || "—", s.subtext || "—", s.visualSuggestion || "—"
    ]);
    sections.push({ title: "CAROUSEL SLAYTLARI", titleSize: FIELD_TITLE_SIZE, table: { headers: ["Sıra", "Başlık", "Alt Metin", "Görsel Önerisi"], rows } });
  }
  if (item.staticFields && Object.values(item.staticFields).some(Boolean)) {
    const sf = item.staticFields;
    const text = [
      line("Ölçü/Platform", [sf.size, sf.platform].filter(Boolean).join(" · ")),
      line("Görsel Konsept", sf.visualConcept), line("Ana Görsel", sf.mainVisual),
      line("Başlık", sf.headline), line("Alt Başlık", sf.subheadline), line("Teklif", sf.offer),
      line("Tasarım Hiyerarşisi", sf.designHierarchy), line("Kaçınılacaklar", sf.designPitfallsToAvoid)
    ].filter(Boolean).join("\n");
    if (text) sections.push({ title: "TASARIM DETAYLARI", titleSize: FIELD_TITLE_SIZE, text });
  }
  if (item.storyFields && Object.values(item.storyFields).some(Boolean)) {
    const stf = item.storyFields;
    const text = [line("Ana Mesaj", stf.mainMessage), line("Görsel/Video Önerisi", stf.visualSuggestion), line("Aksiyon", stf.action), line("Sekans", stf.sequence)].filter(Boolean).join("\n");
    if (text) sections.push({ title: "STORY DETAYLARI", titleSize: FIELD_TITLE_SIZE, text });
  }
  if (item.adCopy && Object.values(item.adCopy).some(Boolean)) {
    const ac = item.adCopy;
    const text = [line("Reklam Metni", ac.primaryText), line("Headline", ac.headline), line("Description", ac.description), line("CTA", ac.cta)].filter(Boolean).join("\n");
    if (text) sections.push({ title: "REKLAM METİNLERİ", titleSize: FIELD_TITLE_SIZE, text });
  }
  pushField(mode === "internal" ? "DETAY / ÜRETİM NOTLARI" : "ÜRETİM NOTLARI", item.details);
  if (mode === "internal") pushField("AJANS İÇİ NOT", item.internalNotes);

  return sections;
}

export function buildCreativeReportDocumentPayload(companyName: string, report: AdCreativeReportRecord, mode: CreativeReportDocumentMode): DocumentPayload {
  const sections: DocumentSection[] = [];
  const s = report.strategy_summary || {};
  const summaryLines = [
    line("Kampanya Amacı", s.campaignGoal), line("Kreatiflerin Görevi", s.creativeRole), line("Hedef Kitle", s.targetAudience),
    ...(mode === "internal" ? [line("Funnel Aşaması", s.funnelStage), line("Farkındalık Seviyesi", s.awarenessLevel)] : []),
    line("Ana Mesaj", s.keyMessage), line("Ana CTA", s.primaryCta),
    s.creativeAngles?.length ? `Kreatif Açılar: ${s.creativeAngles.join(", ")}` : null
  ].filter(Boolean).join("\n");
  if (summaryLines) sections.push({ title: "Kreatif Strateji Özeti", text: summaryLines });

  const report_ = mode === "internal" ? report.internal_report : report.client_report;
  if (report_?.sections?.length) sections.push(...report_.sections.filter((sec) => sec.title && sec.content).map((sec) => ({ title: sec.title, text: sec.content })));

  const creatives = [...(report.creatives || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  for (let i = 0; i < creatives.length; i++) sections.push(...creativeSections(creatives[i], i, mode));

  if (report.required_materials?.length) {
    const rows = report.required_materials.map((m) => [m.name || "—", m.description || "—", m.quantity || "—", m.format || "—", m.instructions || "—"]);
    sections.push({ title: "Müşteriden İstenecek Materyaller", titleSize: 13, spacingBefore: 14, table: { headers: ["Materyal", "Açıklama", "Adet", "Format", "Talimat"], rows } });
  }
  if (report.production_checklist?.length) {
    sections.push({ title: "Prodüksiyon Kontrol Listesi", titleSize: 13, spacingBefore: 10, items: report.production_checklist.map((c) => `${c.checked ? "[x]" : "[ ]"} ${c.label}`) });
  }
  if (mode === "internal" && report.ab_test_plan?.length) {
    const rows = report.ab_test_plan.map((t) => [t.hypothesis || "—", t.variable || "—", t.constants || "—", t.expectedBehavior || "—", t.evaluationCriteria || "—"]);
    sections.push({ title: "A/B Test Planı", titleSize: 13, spacingBefore: 10, table: { headers: ["Hipotez", "Değişken", "Sabitler", "Beklenen Davranış", "Değerlendirme"], rows } });
  }

  return {
    title: mode === "internal" ? "Reklam Kreatif Raporu — Dahili Rapor" : "Reklam Kreatif Raporu — Müşteri Raporu",
    customerName: companyName,
    period: new Date(report.created_at).toLocaleDateString("tr-TR"),
    executiveSummary: report_?.executiveSummary || "",
    sections,
    confidentialLabel: mode === "internal" ? "Dahili Kullanım" : undefined,
    metaLines: [
      `Müşteri: ${companyName}`,
      mode === "internal" ? `Versiyon: v${report.version} · ${report.creatives?.length || 0} kreatif` : `Hazırlanma tarihi: ${new Date().toLocaleDateString("tr-TR")}`
    ],
    footerNote: mode === "internal" ? "HK Dijital · Dahili Operasyon Belgesi · hkdijital.com.tr" : "HK Dijital · hkdijital.com.tr",
    logo: true
  };
}

export { CREATIVE_FORMATS };
