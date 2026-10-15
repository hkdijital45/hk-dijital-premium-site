// Report glossaries — technical terms are explained in ONE separate
// "Terimler Sözlüğü" section instead of being spliced into sentences.
// The old in-sentence replacement (ad evaluation / creative reports)
// broke Turkish suffixes ("Harcanan Tutar (…)ın") and re-explained words
// that appeared inside other explanations. Pure, client-safe.
import type { DocumentSection } from "@/lib/document-model";
import { cellLabel } from "@/lib/document-model";
import { findUsedGlossaryTerms, type GlossaryTerm } from "@/lib/turkish-text";

export const AD_METRIC_GLOSSARY: GlossaryTerm[] = [
  { term: "Harcanan Tutar", definition: "İncelenen dönemde reklam için kullanılan toplam bütçe." },
  { term: "Erişim", definition: "Reklamı en az bir kez gören farklı kişi sayısı." },
  { term: "Gösterim", definition: "Reklamın toplam kaç kez görüntülendiği." },
  { term: "Frekans", definition: "Bir kişinin reklamı ortalama kaç kez gördüğü." },
  { term: "Bağlantı Tıklaması", definition: "Reklamdaki bağlantıya yapılan tıklama sayısı." },
  { term: "Bağlantı CTR", definition: "Reklamdaki bağlantı tıklamalarının gösterimlere oranı." },
  { term: "Bağlantı CPC", definition: "Bir bağlantı tıklamasının ortalama maliyeti." },
  { term: "CTR (Tümü)", definition: "Reklamdaki tüm tıklamaların gösterimlere oranı." },
  { term: "CPC (Tümü)", definition: "Reklamdaki tüm tıklamalardan birinin ortalama maliyeti." },
  { term: "CTR", definition: "Reklamı gören kişilerden tıklayanların oranı (tıklama oranı).", aliases: ["Tıklama Oranı"] },
  { term: "CPC", definition: "Bir tıklamanın ortalama maliyeti (tıklama başına maliyet).", aliases: ["Tıklama Başına Maliyet"] },
  { term: "CPM", definition: "Reklamın 1.000 gösterim başına ortalama maliyeti." },
  { term: "Sonuç", definition: "Meta'nın kampanya hedefine göre saydığı sonuç (ör. başlatılan mesajlaşma)." },
  { term: "Sonuç Başına Maliyet", definition: "Bir sonucu elde etmek için harcanan ortalama reklam tutarı.", aliases: ["Sonuç başı maliyet"] },
  { term: "Mesajlaşma konuşması başlatıldı", definition: "Reklam üzerinden işletmeyle yeni konuşma başlatan kişi sayısı." },
  { term: "ThruPlay", definition: "Videonun en az 15 saniyesinin veya kısa videonun tamamının izlenmesi." },
  { term: "ROAS", definition: "Reklama harcanan her 1 TL karşılığında elde edilen gelir." }
];

export const CREATIVE_GLOSSARY: GlossaryTerm[] = [
  { term: "Hook", definition: "Videonun ilk saniyelerindeki dikkat çekici açılış." },
  { term: "CTA", definition: "İzleyiciyi bir eyleme (mesaj, arama, satın alma) yönlendiren çağrı." },
  { term: "Reels", definition: "Instagram ve Facebook'ta yayınlanan kısa dikey video." },
  { term: "Carousel", definition: "Kaydırılarak gezilen çoklu görselli gönderi." },
  { term: "Story", definition: "24 saat görünen tam ekran dikey içerik (hikâye)." },
  { term: "Feed", definition: "Instagram/Facebook ana akışı." },
  { term: "Funnel", definition: "Müşterinin farkındalıktan satın almaya ilerlediği satış hunisi." },
  { term: "A/B Testi", definition: "İki farklı versiyonun hangisinin daha iyi sonuç verdiğini karşılaştıran test.", aliases: ["A/B Test"] },
  { term: "Remarketing", definition: "Daha önce etkileşime giren kişileri yeniden hedefleme." },
  { term: "CTR", definition: "Reklamı gören kişilerden tıklayanların oranı (tıklama oranı)." },
  { term: "Learning Phase", definition: "Meta'nın reklamı optimize etmek için veri topladığı öğrenme aşaması." },
  { term: "Primary Text", definition: "Reklamın ana metni." },
  { term: "Headline", definition: "Reklam başlığı." },
  { term: "FPS", definition: "Videonun saniyedeki kare sayısı." },
  { term: "Hard Cut", definition: "Geçiş efekti olmadan yapılan sert kesme." },
  { term: "Ad Set", definition: "Hedef kitle ve bütçenin belirlendiği reklam seti.", aliases: ["AdSet"] },
  { term: "Engagement", definition: "Beğeni, yorum, paylaşım gibi etkileşimler." },
  { term: "DM", definition: "Instagram/Facebook üzerinden gönderilen özel mesaj." },
  { term: "Thumb-stop", definition: "Kaydırmayı durdurma; ilk saniyede izleyiciyi tutabilme." }
];

function sectionTexts(section: DocumentSection): string[] {
  const out: string[] = [section.title];
  if (section.intro) out.push(section.intro);
  if (section.text) out.push(section.text);
  if (section.items) out.push(...section.items);
  if (section.metrics) for (const m of section.metrics) out.push(m.label, m.note || "");
  if (section.table) {
    out.push(...section.table.headers);
    for (const row of section.table.rows) for (const cell of row) out.push(cellLabel(cell));
  }
  if (section.callout) out.push(section.callout.title || "", section.callout.text);
  if (section.timeline) for (const p of section.timeline) out.push(p.label, ...(p.items || []));
  return out;
}

/** "Terimler Sözlüğü" for the terms a report actually uses — or null. */
export function buildGlossarySection(sections: DocumentSection[], glossary: GlossaryTerm[], extraTexts: string[] = []): DocumentSection | null {
  const used = findUsedGlossaryTerms([...sections.flatMap(sectionTexts), ...extraTexts], glossary);
  if (!used.length) return null;
  return {
    title: "Terimler Sözlüğü",
    intro: "Raporda geçen teknik terimlerin kısa açıklamaları.",
    table: { headers: ["Terim", "Açıklama"], rows: used.map((t) => [t.term, t.definition]) }
  };
}
