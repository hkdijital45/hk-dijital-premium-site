// Pure, dependency-free prompt builder for "Promptu Kopyala" — no React
// import, same precedent as ad-creative-report-prompt.ts/
// instagram-profile-audit-prompt.ts, trivially unit-testable with plain
// node:test. Builds the full deterministic evaluation prompt for the
// "HK Dijital Reklam Değerlendirme" Claude Project: real company/campaign/
// strategy/metrics data (never fabricated — the caller supplies it from
// getAdEvaluationContext, the single source of truth), asks Claude for
// two separate reports PLUS a machine-parsable delimited block
// (ad-evaluation-parser.ts reads these exact markers) so the human-
// readable reports never have to be hand-copied back in as raw JSON.
import type { AdEvaluationContext } from "./ad-evaluations";

export const EVALUATION_DELIMITERS = {
  internalStart: "===INTERNAL_REPORT_START===",
  internalEnd: "===INTERNAL_REPORT_END===",
  clientStart: "===CLIENT_REPORT_START===",
  clientEnd: "===CLIENT_REPORT_END===",
  decision: "===DECISION===",
  nextReview: "===NEXT_REVIEW==="
};

function fmtMoney(n: unknown): string {
  const v = Number(n);
  return Number.isFinite(v) ? `${v.toLocaleString("tr-TR")} TL` : "Veri yok";
}

function metricsBlock(snapshot: AdEvaluationContext["metricsSnapshot"]): string {
  if (!snapshot?.campaign) return "Bu dönem için kampanya seviyesinde senkronize edilmiş performans verisi yok (Veri yok).";
  const c = snapshot.campaign;
  const lines = [
    `Harcama: ${fmtMoney(c.spend)}`,
    `Erişim: ${c.reach ?? "Veri yok"}`,
    `Gösterim: ${c.impressions ?? "Veri yok"}`,
    `Frekans: ${c.frequency ?? "Veri yok"}`,
    `Bağlantı Tıklaması: ${c.linkClicks ?? "Veri yok"}`,
    `Tüm Tıklamalar: ${c.clicksAll ?? "Veri yok"}`,
    `CTR (Tümü): ${c.ctrAll != null ? `%${c.ctrAll}` : "Veri yok"}`,
    `CPC (Tümü): ${c.cpcAll != null ? fmtMoney(c.cpcAll) : "Veri yok"}`,
    `Bağlantı CTR: ${c.linkCtr != null ? `%${c.linkCtr}` : "Veri yok"}`,
    `Bağlantı CPC: ${c.linkCpc != null ? fmtMoney(c.linkCpc) : "Veri yok"}`,
    `CPM: ${c.cpm != null ? fmtMoney(c.cpm) : "Veri yok"}`,
    `Sonuç: ${c.results ?? "Veri yok"}`,
    `Mesaj: ${c.messages ?? "Veri yok"}`,
    `Sonuç başı maliyet: ${c.costPerResult != null ? fmtMoney(c.costPerResult) : "Veri yok"}`
  ];
  const adsets = snapshot.adsets?.length
    ? snapshot.adsets.map((a: any) => `- ${a.name} (${a.status || "-"}): harcama ${fmtMoney(a.spend)}, erişim ${a.reach ?? "Veri yok"}, bağlantı tıklaması ${a.linkClicks ?? "Veri yok"}, bağlantı CTR ${a.linkCtr != null ? `%${a.linkCtr}` : "Veri yok"}, sonuç ${a.results ?? "Veri yok"}`).join("\n")
    : "Reklam seti seviyesinde senkronize veri yok.";
  const ads = snapshot.ads?.length
    ? snapshot.ads.map((a: any) => `- ${a.name} (${a.status || "-"}): harcama ${fmtMoney(a.spend)}, gösterim ${a.impressions ?? "Veri yok"}, bağlantı tıklaması ${a.linkClicks ?? "Veri yok"}, bağlantı CTR ${a.linkCtr != null ? `%${a.linkCtr}` : "Veri yok"}, sonuç ${a.results ?? "Veri yok"}`).join("\n")
    : "Reklam/kreatif seviyesinde yeterli senkronize veri yok.";
  const periodNote = snapshot.periodFallback
    ? `\n(Not: "${snapshot.periodRequested}" için senkronize veri yok — aşağıdaki rakamlar gerçekte senkronize edilmiş "${snapshot.periodUsed}" dönemine aittir, uydurulmuş veya karıştırılmış değildir.)`
    : "";
  return [lines.join("\n"), periodNote, "\nReklam Setleri:", adsets, "\nReklamlar:", ads].join("\n");
}

export function buildAdEvaluationPrompt(context: AdEvaluationContext): string {
  const ageHours = context.campaignAgeHours;
  const ageLine = ageHours == null
    ? "Kampanya başlangıç tarihi bilinmiyor — çalışma süresi hesaplanamadı."
    : ageHours < 12
      ? `Kampanya ${ageHours} saattir yayında (0–12 saat: çok erken, yalnızca gözlem).`
      : ageHours < 24
        ? `Kampanya ${ageHours} saattir yayında (12–24 saat: ilk sinyal).`
        : ageHours < 72
          ? `Kampanya ${(ageHours / 24).toFixed(1)} gündür yayında (24–72 saat: ilk anlamlı değerlendirme).`
          : ageHours < 168
            ? `Kampanya ${(ageHours / 24).toFixed(1)} gündür yayında (3–7 gün: kreatif ve optimizasyon karşılaştırması yapılabilir).`
            : `Kampanya ${(ageHours / 24).toFixed(1)} gündür yayında (7+ gün: daha güçlü optimizasyon kararı verilebilir).`;

  const strategyBlock = context.strategy
    ? `Onaylı Reklam Stratejisi v${context.strategy.version} (${context.strategy.status}): "${context.strategy.strategyTitle}" — Ana hedef: ${context.strategy.primaryGoal || "-"}, Ana KPI: ${context.strategy.primaryKpi || "-"}. Kampanya sırası: ${JSON.stringify(context.strategy.campaignSequence || [])}`
    : "Bu müşteri için onaylı/aktif bir Reklam Stratejisi kaydı yok — strateji karşılaştırması yapılamaz, bunu raporda açıkça belirt.";

  const creativeBlock = context.creativeStrategy
    ? `Reklam Kreatif Raporu v${context.creativeStrategy.version} (${context.creativeStrategy.status}) mevcut — ${Array.isArray(context.creativeStrategy.creatives) ? context.creativeStrategy.creatives.length : 0} kreatif tanımlı.`
    : "Reklam Kreatif Raporu kaydı yok.";

  const previousBlock = context.previousEvaluations.length
    ? context.previousEvaluations.map((e) => `- ${new Date(e.createdAt).toLocaleDateString("tr-TR")} (${e.periodStart || "-"} → ${e.periodEnd || "-"}): karar ${e.decision || "kaydedilmemiş"}`).join("\n")
    : "Bu kampanya için önceki değerlendirme kaydı yok.";

  const lines = [
    "Kıdemli Performance Marketing Specialist / Meta Ads Analyst olarak davran. GÖREVİN yeni bir strateji oluşturmak DEĞİL — mevcut, yayında olan kampanyanın gerçek performansını aşağıdaki gerçek Meta verileri ve onaylı reklam stratejisiyle karşılaştırarak değerlendirmek.",
    "",
    "A) MÜŞTERİ",
    `İşletme: ${context.company.name}${context.company.sector ? ` · Sektör: ${context.company.sector}` : ""}${context.company.city ? ` · Şehir: ${context.company.city}` : ""}`,
    "",
    "B) ONAYLI REKLAM STRATEJİSİ",
    strategyBlock,
    "",
    "C) REKLAM KREATİF STRATEJİSİ",
    creativeBlock,
    "",
    "D) DEĞERLENDİRME DÖNEMİ",
    `Kampanya: ${context.campaign?.name || "Bilinmiyor"} (durum: ${context.campaign?.status || "-"}, amaç: ${context.campaign?.objective || "-"})`,
    ageLine,
    "",
    "E) META ADS GERÇEK VERİLERİ (yalnızca aşağıdaki veriyi kullan, eksik olanı asla uydurma)",
    metricsBlock(context.metricsSnapshot),
    "",
    "F) ÖNCEKİ DEĞERLENDİRMELER",
    previousBlock,
    "",
    "G) ZORUNLU KURALLAR",
    "- Yukarıda verilmeyen hiçbir metriği uydurma; eksikse raporda \"Veri yok\" yaz.",
    "- Yetersiz veriyi başarılı veya başarısız ilan etme; veri hacmi ve harcama düşükse süre dolmuş olsa bile \"veri yetersiz\" diyebilirsin.",
    "- Tek bir metriğe bakarak karar verme; birden fazla sinyali birlikte değerlendir.",
    "- Az süredir (örn. 6 saat) yayında olan bir kampanyayı yalnızca düşük/yüksek sonuç maliyetine bakarak kapatmayı önerme.",
    "- Reklam performansı (erişim, CTR, mesaj sayısı) ile satış performansını (gerçek satış/ciro) birbirinden ayır — \"30 mesaj + 0 satış\" durumunda reklamı otomatik başarısız ilan etme; mesaj niteliği, fiyatlandırma, işletmenin dönüş süresi ve satış kapatma sürecinin ayrı değişkenler olduğunu belirt.",
    "- Onaylı strateji varsa mutlaka onunla karşılaştır (Planlanan / Gerçekleşen / Değerlendirme).",
    "- Raporların SONUNDA net bir karar, somut bir sonraki aksiyon ve bir sonraki kontrol zamanı/koşulu üret.",
    "",
    "H) ÇIKTI FORMATI — İKİ AYRI RAPOR + MAKİNE OKUNABİLİR BLOK",
    "Uzun paragraflar yazma; madde/tablo tabanlı, başlıklı (##) yapı kullan — bir bilgi = bir madde.",
    "",
    "1. \"HK Dijital Dahili Reklam Değerlendirme Raporu\" — bölümler: Yönetici Özeti, Veri Yeterliliği, Ana Metrikler, Kampanya Analizi, Reklam Seti Analizi (varsa), Kreatif/Reklam Analizi (varsa), Strateji ile Karşılaştırma (Planlanan/Gerçekleşen/Değerlendirme tablosu), Olumlu Sinyaller, Sorunlar/Riskler (Kritik/Önemli/İzlenecek), Yapılmaması Gerekenler, Şimdi Ne Yapılmalı (numaralı maddeler), Sonraki Kontrol, Nihai Karar.",
    `Bu raporu AYNEN şu şekilde sınırla:\n${EVALUATION_DELIMITERS.internalStart}\n(## başlıklarıyla rapor içeriği)\n${EVALUATION_DELIMITERS.internalEnd}`,
    "",
    "2. \"Müşteri Reklam Performans Raporu\" — bölümler: Rapor Bilgileri, Kısa Özet, Reklamın Mevcut Durumu, Performans Metrikleri (yalnızca mevcut olan metrikleri, HER metrik adının yanında Türkçe parantez açıklamasıyla — örn. \"Erişim (Reklamı en az bir kez gören farklı kişi sayısı)\", \"CTR (Reklamı gören kişilerden bağlantıya tıklayanların oranı)\"), Neler İyi Gidiyor, Neleri Takip Ediyoruz, Sonraki Adımlar, Sonraki Değerlendirme, Genel Durum. İçinde internal teknik not, raw veri, developer jargonu, kesin garanti veya gereksiz benchmark iddiası OLMASIN.",
    `Bu raporu AYNEN şu şekilde sınırla:\n${EVALUATION_DELIMITERS.clientStart}\n(## başlıklarıyla rapor içeriği)\n${EVALUATION_DELIMITERS.clientEnd}`,
    "",
    "3. İki raporun ardından, AYNEN şu formatta (başka hiçbir şey eklemeden) karar bloğu ekle:",
    `${EVALUATION_DELIMITERS.decision}`,
    "TEK_KELİME_KARAR  (şunlardan biri: OBSERVE, CONTINUE, NO_CHANGE, MONITOR, CREATIVE_TEST, CREATIVE_CHANGE, AUDIENCE_TEST, BUDGET_OPTIMIZATION, ADSET_OPTIMIZATION, REMARKETING, TECHNICAL_ISSUE, SALES_PROCESS_REVIEW, INSUFFICIENT_DATA)",
    `${EVALUATION_DELIMITERS.nextReview}`,
    "YYYY-MM-DD | sonraki kontrolde nelere bakılacağına dair kısa not"
  ];
  return lines.join("\n");
}
