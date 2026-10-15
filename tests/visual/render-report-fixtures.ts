// Visual QA harness for the Premium Report System (not part of the unit
// test glob). Renders representative PDFs from FICTIONAL fixtures so the
// output can be rasterized (pdftoppm) and inspected page by page.
//   node --conditions=react-server --import tsx tests/visual/render-report-fixtures.ts <outDir> <logoDir>
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { generatePdfBuffer, type DocumentPayload } from "../../src/lib/server/document-generator.ts";
import { normalizeLogoImage } from "../../src/lib/server/logo-image.ts";
import { buildManualEvaluationDocumentPayload } from "../../src/lib/manual-evaluation-document.ts";
import { buildAdEvaluationDocumentPayload } from "../../src/lib/marketing-intelligence/ad-evaluation-document.ts";
import { buildProposalDocumentPayload } from "../../src/lib/proposals/document.ts";
import { financialsFromQuestionnaire } from "../../src/lib/proposals/financials.ts";

const outDir = process.argv[2];
const logoDir = process.argv[3];

async function logo(file: string) {
  const n = await normalizeLogoImage(readFileSync(join(logoDir, file)));
  return { png: new Uint8Array(n.png), width: n.width, height: n.height };
}

const longText = "İşletmenin Google İşletme Profili güncel ve 4,7 puanlı; ancak web sitesinde mobil hız sorunları ve eksik meta açıklamaları dönüşümü sınırlıyor. Instagram hesabı düzenli paylaşım yapıyor fakat profil biyografisinde net bir çağrı (CTA) ve WhatsApp bağlantısı bulunmuyor. Çğışöü ÇĞİŞÖÜ ıİ testi.";

async function main() {
  const square = await logo("logo-square.png");
  const wide = await logo("logo-wide.png");
  const transparent = await logo("logo-transparent.png");

  const audit: DocumentPayload = {
    title: "HK Dijital — Ön İnceleme Raporu",
    customerName: "Örnek Kafe & Pastane Çiğdem Şubesi",
    period: "15 Ekim 2026",
    executiveSummary: `${longText}\n\nBu rapor, işletmenin erişilebilen açık dijital varlıklarına dayanır; tahmini veri içermez.`,
    logo: true,
    clientLogo: square,
    headlineMetrics: [
      { label: "Google Puanı", value: "4,7 / 5", note: "312 yorum", tone: "positive" },
      { label: "Instagram Takipçi", value: "8.420" },
      { label: "Web Sitesi Mobil Hız", value: "%42", note: "İyileştirme gerekli", tone: "negative" },
      { label: "Dijital Olgunluk", value: "Orta", tone: "warning" }
    ],
    metaLines: ["Firma: Örnek Kafe & Pastane Çiğdem Şubesi", "Rapor Tarihi: 15 Ekim 2026 14:30", "Hazırlayan: HK Dijital", "Rapor Türü: Dijital Ön İnceleme"],
    footerNote: "HK Dijital · Dijital Pazarlama & Büyüme Çözümleri · hkdijital.com.tr",
    sections: [
      { title: "Bu Rapor Hakkında", text: "Bu ön inceleme, işletmenin erişilebilen dijital varlıkları ve doğrulanabilen açık veriler üzerinden hazırlanmıştır." },
      { title: "Dijital Varlıklar", intro: "Ne inceledik? Google, web sitesi ve sosyal medya kanallarının erişilebilirliğini.", items: ["Google İşletme Profili: Aktif, 4,7 puan", "Web sitesi: Mevcut, SSL aktif", "  Mobil hız düşük", "Instagram: @ornekkafe — 8.420 takipçi"] },
      { title: "Dijital Varlıklar — Kaynak Doğrulama Tablosu", table: { headers: ["Kanal", "Durum", "Kaynak", "Not"], rows: [
        ["Google İşletme Profili", "🟢 Doğrulandı", { label: "Bağlantıyı Aç", url: "https://maps.google.com/?cid=1" }, "Adres ve telefon tutarlı"],
        ["Instagram", "Muhtemel", { label: "Bağlantıyı Aç", url: "https://instagram.com/ornekkafe" }, "Biyografide şube adı farklı yazılmış; uzun açıklama satır kırılımı testi için eklenmiştir."],
        ["Facebook", "Bulunamadı", "—", "—"],
        ["Web Sitesi", "Doğrulandı", { label: "Bağlantıyı Aç", url: "https://example.com" }, "—"]
      ] } },
      { title: "Önerilen Aylık Bütçe Dağılımı (Öneri)", charts: [{ type: "donut", title: "Önerilen Aylık Reklam Bütçesi", valueFormat: "currency", data: [{ label: "Meta Ads", value: 12000 }, { label: "Google Ads", value: 8000 }, { label: "Yeniden Pazarlama", value: 2500 }], caption: "Bu dağılım bir öneridir; gerçekleşen harcama değildir. Meta ağırlığı, görsel ürün yapısı ve yerel kitle nedeniyle seçilmiştir." }] },
      { title: "SWOT", table: { headers: ["Kategori", "Değerlendirme"], rows: [["Güçlü Yönler", "Yüksek Google puanı; sadık yerel müşteri kitlesi; görsel olarak güçlü ürünler."], ["Geliştirilebilecek Alanlar", "Web sitesi hızı; Instagram'da net çağrı eksikliği."], ["Fırsatlar", "Yerel arama reklamları; Reels içerik üretimi."], ["Rekabet / Dikkat Edilmesi Gerekenler", "Bölgede 3 güçlü rakip zincir."]] } },
      { title: "30/60/90 Günlük Yol Haritası", timeline: [{ label: "İlk 30 Gün", items: ["Google profil optimizasyonu", "Pixel ve dönüşüm kurulumu"] }, { label: "31–60. Gün", items: ["Meta reklam testleri", "Reels içerik takvimi"] }, { label: "61–90. Gün", items: ["Kazanan kreatiflerle ölçekleme", "Aylık raporlama"] }] },
      { title: "Sonraki Adım", callout: { title: "Neden önemli?", text: "Mobil hız sorunu, reklamdan gelen ziyaretçilerin yaklaşık yarısının sayfa açılmadan çıkmasına yol açabilir; reklam bütçesi artırılmadan önce giderilmelidir.", tone: "warning" } }
    ]
  };

  const ads: DocumentPayload = {
    title: "Reklam Performans Raporu",
    customerName: "Şimşek Yapı Malzemeleri Ticaret A.Ş.",
    period: "2026-09-01 → 2026-09-30",
    executiveSummary: "",
    logo: true,
    clientLogo: wide,
    metaLines: ["Müşteri: Şimşek Yapı Malzemeleri Ticaret A.Ş.", "Kampanya: Eylül Mesaj Kampanyası", "Rapor Tarihi ve Saati: 15 Ekim 2026 09:12", "İncelenen dönem: 1–30 Eylül 2026"],
    sections: [
      { title: "Kampanya Özeti", metrics: [
        { label: "Harcanan Tutar", value: "12.480,35 TL" }, { label: "Erişim", value: "48.210" }, { label: "Gösterim", value: "131.904" }, { label: "Bağlantı Tıklaması", value: "2.144" },
        { label: "Bağlantı CTR", value: "%1,63", tone: "positive", note: "Sektör ortalamasının üzerinde" }, { label: "Bağlantı CPC", value: "5,82 TL" }, { label: "Sonuç", value: "186" }, { label: "Sonuç Başına Maliyet", value: "67,10 TL", tone: "negative", note: "Hedefin %12 üzerinde" }
      ] },
      { title: "Reklamlara Göre Harcama", charts: [
        { type: "hbar", title: "Reklam Bazında Harcama", valueFormat: "currency", data: [{ label: "Kış Kampanyası Video 1 — çok uzun reklam adı testi", value: 4820.5 }, { label: "Karusel Ürünler", value: 3110 }, { label: "Tek Görsel A", value: 2410.85 }, { label: "Tek Görsel B", value: 1300 }, { label: "Story Dikey", value: 839 }, { label: "Eksik veri", value: null }], caption: "En yüksek harcama video reklamda; sonuç başına maliyeti de en düşük olan reklam budur." },
        { type: "line", title: "Günlük Harcama Trendi", valueFormat: "currency", data: Array.from({ length: 14 }, (_, i) => ({ label: `${i + 1} Eyl`, value: 300 + Math.round(Math.sin(i / 2) * 120 + i * 18) })), caption: "Harcama ay ortasında dengelendi." },
        { type: "bar", title: "Haftalık Sonuçlar", data: [{ label: "1. Hafta", value: 38 }, { label: "2. Hafta", value: 51 }, { label: "3. Hafta", value: 44 }, { label: "4. Hafta", value: 53 }], caption: "Sonuç: Meta'nın kampanya hedefine göre saydığı mesaj başlatma." }
      ] },
      { title: "Değerlendirme", items: ["Video reklam en verimli kreatif.", "Story yerleşiminde maliyet yüksek; bütçe kaydırılmalı."] },
      { title: "Reklam Seti Tablosu", table: { headers: ["Reklam Seti", "Durum", "Harcama", "Gösterim", "Tıklama", "CTR", "CPC", "Sonuç"], rows: Array.from({ length: 22 }, (_, i) => [`Reklam seti ${i + 1} — İzmir 25-44 yaş`, i % 3 === 0 ? "🔴 Aksiyon Gerekebilir" : i % 3 === 1 ? "🟢 İyi" : "🟡 İzle", `${(500 + i * 37).toLocaleString("tr-TR")} TL`, `${(4000 + i * 211).toLocaleString("tr-TR")}`, String(60 + i), "%1,4", "6,10 TL", String(5 + i)]) } }
    ]
  };

  const proposal: DocumentPayload = {
    title: "HK Dijital — Teklif (TKL-2026-0042)",
    customerName: "Zirve Eğitim Kurumları",
    period: "15.10.2026",
    executiveSummary: "",
    logo: true,
    clientLogo: transparent,
    metaLines: ["Firma: Zirve Eğitim Kurumları", "Teklif No: TKL-2026-0042", "Tarih: 15.10.2026", "Geçerlilik: 30.10.2026", "Hazırlayan: HK Dijital"],
    sections: [
      { title: "Teklif Kapsamı", items: ["Zirve Eğitim Kurumları — Ana işletme", "Robotik Atölye — Bağlı marka (@robotikatolye)"] },
      { title: "Finansal Özet", metrics: [{ label: "İlk Ay Toplamı (KDV Dahil)", value: "38.400,00 TL", tone: "accent" }, { label: "Sonraki Aylar (KDV Dahil)", value: "31.200,00 TL" }, { label: "Aylık Reklam Bütçesi", value: "20.000,00 TL", note: "Platforma ödenir, KDV'ye tabi değil" }],
        charts: [{ type: "donut", title: "Aylık Maliyet Dağılımı", valueFormat: "currency", data: [{ label: "Google Ads bütçesi", value: 12000 }, { label: "Meta Ads bütçesi", value: 8000 }, { label: "Ajans hizmet bedeli", value: 9600 }, { label: "İşletme bazlı hizmetler", value: 1600 }], caption: "Reklam bütçesi doğrudan platforma ödenir; ajans hizmet bedelinden ayrı gösterilmiştir." }],
        table: { headers: ["Kalem", "Tutar"], rows: [["Toplam Aylık Reklam Bütçesi (platforma ödenir, KDV'ye tabi değil)", "20.000,00 TL"], ["Aylık Ajans Yönetim Ücreti (KDV Dahil)", "9.600,00 TL"], ["Kurulum Ücreti (KDV Dahil)", "7.200,00 TL"], ["Web Sitesi (tek seferlik, KDV Dahil)", "18.000,00 TL"], ["Alan Adı Yenileme (yıllık)", "450,00 TL"], ["Hosting Yenileme (yıllık)", "2.400,00 TL"]] } },
      { title: "İşletme Bazlı Hizmet Kalemleri", table: { headers: ["İşletme", "Hizmet", "Aylık (KDV Dahil)", "Kurulum (KDV Dahil)"], rows: [["Robotik Atölye", "Instagram yönetimi", "1.600,00 TL", "-"]] } }
    ]
  };

  const minimal: DocumentPayload = {
    title: "İçerik Planı",
    customerName: "HK Dijital",
    period: "Ekim 2026",
    executiveSummary: "",
    sections: [{ title: "Plan", items: ["1 Ekim — Reels", "3 Ekim — Karusel"] }]
  };

  const internalLegacy: DocumentPayload = {
    title: "HK Dijital — Dahili Ön İnceleme Raporu",
    customerName: "Uzun İsimli Gıda Sanayi ve Dış Ticaret Limited Şirketi Çorlu Organize Sanayi Bölgesi Şubesi",
    period: "15.10.2026 10:00",
    executiveSummary: "Eski (V3 öncesi) biçimde kaydedilmiş rapor: yalnızca metin ve maddeler.",
    footerNote: "HK Dijital · Dahili Kullanım · Müşteriyle Paylaşılmaz",
    logo: true,
    confidentialLabel: "Dahili Kullanım",
    metaLines: ["Firma: Uzun İsimli Gıda Sanayi ve Dış Ticaret Limited Şirketi", "Rapor Tarihi: 15.10.2026 10:00", "Hazırlayan: HK Dijital", "Rapor Türü: Dahili Satış & Toplantı Hazırlığı"],
    sections: [
      { title: "Satış Notları", text: longText },
      { title: "İtirazlar", items: Array.from({ length: 30 }, (_, i) => `İtiraz ${i + 1}: Fiyat yüksek bulunabilir; değer önerisi ve ölçülebilir hedeflerle karşılanmalı.`) },
      { title: "Boş grafik testi", charts: [{ type: "bar", title: "Veri yok", data: [{ label: "A", value: null }, { label: "B", value: 0 }] }], text: "Yetersiz veriyle grafik çizilmemelidir." }
    ]
  };

  // --- Real builders (fictional records) ---
  const now = "2026-10-15T09:00:00Z";
  const instagram = buildManualEvaluationDocumentPayload("Robotik Atölye", {
    id: "e1", module: "instagram", company_id: null, lead_id: "l1", business_unit_id: "u1", target_label: "Robotik Atölye", title: "Instagram Değerlendirmesi — Ekim", status: "submitted",
    data: { businessName: "Robotik Atölye", instagramUsername: "@robotikatolye", followers: 3120, posts: 214, reelsCount: 18, carouselCount: 9, staticPostCount: 6, storyCount: 40, analysisStartDate: "2026-09-15", analysisEndDate: "2026-10-15", bioQuality: "Orta" },
    derived_metrics: { er: { label: "Etkileşim Oranı", value: 3.42, unit: "%", formula: "x" }, freq: { label: "Haftalık Paylaşım", value: 4.1, unit: "adet", formula: "y" } },
    source: "manual", claude_import: null, notes: "", created_by: null, created_at: now, updated_at: now
  } as never, "client");
  instagram.clientLogo = square;

  const adEval = buildAdEvaluationDocumentPayload("Şimşek Yapı", "Eylül Mesaj Kampanyası", {
    id: "a1", company_id: "c1", campaign_id: null, meta_campaign_id: "m1", evaluation_period_start: "2026-09-01", evaluation_period_end: "2026-09-30", created_at: now,
    metrics_snapshot: { syncedAt: now, campaign: { spend: 12480.35, reach: 48210, impressions: 131904, linkClicks: 2144, linkCtr: 1.63, linkCpc: 5.82, results: 186, costPerResult: 67.1, frequency: 2.74 },
      adsets: [{ name: "İzmir 25-44", spend: 7400 }, { name: "Manisa 25-44", spend: 3600.35 }, { name: "Remarketing", spend: 1480 }],
      ads: [{ name: "Video 1", spend: 4820.5, results: 81 }, { name: "Karusel", spend: 3110, results: 52 }, { name: "Tek Görsel A", spend: 2410.85, results: 31 }, { name: "Story", spend: 2139, results: 22 }] },
    client_report: { executiveSummary: "Kampanya hedefin üzerinde mesaj getirdi; video reklam en verimli kreatif.", sections: [{ title: "Öneriler", content: "- Video bütçesi artırılmalı.\n- Story yerleşimi durdurulmalı." }] },
    internal_report: {}, decision: null, next_review_at: null, next_review_note: null
  } as never, "client");
  adEval.clientLogo = wide;

  const q = { platforms: ["Google Ads", "Meta Ads"], budget: { googleAllocation: 12000, metaAllocation: 8000 }, fees: { monthlyManagementFee: 8000, setupFee: 6000, contractDurationMonths: 3, paymentTerms: "Her ayın 1'inde peşin", taxes: "KDV %20", packageName: "3 Aylık Büyüme Paketi" },
    businessScope: [{ key: "lead:11111111-1111-4111-8111-111111111111", name: "Zirve Eğitim Kurumları", role: "main" }, { key: "unit:33333333-3333-4333-8333-333333333333", name: "Robotik Atölye", role: "related_brand", instagram: "@robotikatolye" }],
    businessServiceLines: [{ businessKey: "unit:33333333-3333-4333-8333-333333333333", description: "Instagram yönetimi", monthlyFee: 2500, setupFee: 0 }] };
  const proposalDoc = buildProposalDocumentPayload({
    id: "p1", company_id: null, lead_id: "l1", target_label: "Zirve Eğitim Kurumları", proposal_number: "TKL-2026-0042", title: "Teklif", status: "Taslak", version: 1, previous_proposal_id: null,
    questionnaire: q as never, financials: financialsFromQuestionnaire(q),
    data: { roadmap_90_days: [{ phase: "İlk 30 Gün", action: "Hesap ve ölçüm kurulumu" }, { phase: "İlk 30 Gün", action: "İlk kampanyalar" }, { phase: "31–60. Gün", action: "Kreatif testleri" }, { phase: "61–90. Gün", action: "Ölçekleme ve raporlama" }] } as never,
    source: "manual", claude_import: null, valid_until: "2026-10-30", sent_at: null, accepted_at: null, rejected_at: null, created_by: null, created_at: now, updated_at: now, archived_at: null, archived_by: null, deleted_at: null, deleted_by: null
  }, "client");
  proposalDoc.clientLogo = transparent;

  const cases: Array<[string, DocumentPayload]> = [["06-builder-instagram", instagram], ["07-builder-ad-evaluation", adEval], ["08-builder-proposal", proposalDoc], ["01-audit-square-logo", audit], ["02-ads-wide-logo", ads], ["03-proposal-transparent-logo", proposal], ["04-minimal-no-logo", minimal], ["05-internal-legacy-long-name", internalLegacy]];
  for (const [name, payload] of cases) {
    const buffer = await generatePdfBuffer(payload);
    writeFileSync(join(outDir, `${name}.pdf`), buffer);
    console.log(name, buffer.length);
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
