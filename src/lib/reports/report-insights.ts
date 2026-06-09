export type HealthDimension = {
  label: string;
  score: number | null;
  status: string;
  explanation: string;
};

export type HealthScore = {
  score: number;
  label: string;
  explanation: string;
  dimensions: HealthDimension[];
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

export function parseTurkishNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = cleanText(value).replace(/[^\d,.-]/g, "");
  if (!cleaned || cleaned === "-") return 0;
  const negative = cleaned.startsWith("-");
  const unsigned = cleaned.replace(/^-+/, "");
  const lastComma = unsigned.lastIndexOf(",");
  const lastDot = unsigned.lastIndexOf(".");
  let normalized = unsigned;
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    normalized = unsigned.replace(new RegExp(`\\${thousandsSeparator}`, "g"), "").replace(decimalSeparator, ".");
  } else if (lastComma >= 0) {
    const parts = unsigned.split(",");
    normalized = parts.length > 2 || parts.at(-1)?.length === 3 ? parts.join("") : unsigned.replace(",", ".");
  } else if (lastDot >= 0) {
    const parts = unsigned.split(".");
    normalized = parts.length > 2 || parts.at(-1)?.length === 3 ? parts.join("") : unsigned;
  }
  const parsed = Number(`${negative ? "-" : ""}${normalized}`);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getMetricValue(source: any, keys: string[], fallback = 0) {
  const metrics = source?.metrics || source || {};
  for (const key of keys) {
    const value = metrics?.[key];
    if (value !== undefined && value !== null && value !== "") return parseTurkishNumber(value);
  }
  return fallback;
}

export function normalizeReportType(value: unknown) {
  return cleanText(value)
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ıİ]/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

export function normalizeDateOnly(value?: string | null) {
  const raw = cleanText(value);
  if (!raw) return "";
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const local = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!local) return raw.slice(0, 10);
  const year = local[3].length === 2 ? `20${local[3]}` : local[3];
  return `${year}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
}

export function calculateReportPeriodOverlap(reportStart?: string | null, reportEnd?: string | null, selectedStart?: string | null, selectedEnd?: string | null) {
  const start = normalizeDateOnly(reportStart);
  const end = normalizeDateOnly(reportEnd || reportStart);
  const rangeStart = normalizeDateOnly(selectedStart);
  const rangeEnd = normalizeDateOnly(selectedEnd || selectedStart);
  if (!start || !end || !rangeStart || !rangeEnd) return true;
  return start <= rangeEnd && end >= rangeStart;
}

function bounded(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreLabel(score: number) {
  if (score >= 85) return "Çok İyi";
  if (score >= 70) return "İyi";
  if (score >= 40) return "Geliştirilebilir";
  return "Dikkat Gerekli";
}

function dimension(label: string, score: number | null, explanation: string): HealthDimension {
  return { label, score, status: score === null ? "Veri yok" : scoreLabel(score), explanation };
}

export function calculateHealthScore(report: any): HealthScore {
  const impressions = getMetricValue(report, ["impressions"]);
  const reach = getMetricValue(report, ["reach"]);
  const clicks = getMetricValue(report, ["clicks", "link_clicks"]);
  const spend = getMetricValue(report, ["spent", "spend", "cost"]);
  const ctr = getMetricValue(report, ["ctr"], impressions > 0 ? (clicks / impressions) * 100 : 0);
  const cpc = getMetricValue(report, ["cpc", "average_cpc"], clicks > 0 ? spend / clicks : 0);
  const cpm = getMetricValue(report, ["cpm"], impressions > 0 ? (spend / impressions) * 1000 : 0);
  const leads = getMetricValue(report, ["leads", "results", "conversions", "messages"]);

  const dimensions = [
    dimension("CTR kalitesi", impressions && clicks ? bounded((ctr / 2) * 100) : null, "CTR, reklamı gören kişilerin ne kadarının tıkladığını gösterir."),
    dimension("CPC verimliliği", cpc ? bounded(100 - Math.max(0, cpc - 5) * 2) : null, "CPC düştükçe aynı bütçeyle daha fazla trafik alınabilir."),
    dimension("CPM verimliliği", cpm ? bounded(100 - Math.max(0, cpm - 40)) : null, "CPM, bin gösterim için oluşan maliyeti anlatır."),
    dimension("Erişim dengesi", impressions && reach ? bounded((Math.min(reach / impressions, 1) * 80) + 20) : null, "Erişim ve gösterim dengesi frekansın sağlıklı kalmasına yardımcı olur."),
    dimension("Lead / sonuç üretimi", leads ? bounded(60 + Math.min(leads, 40)) : null, "Lead, mesaj veya sonuç verisi kampanyanın iş çıktısını gösterir."),
    dimension("Bütçe kullanımı", spend ? bounded(70 + Math.min(spend / 1000, 20)) : null, "Harcama verisi kampanyanın aktif ölçüldüğünü gösterir.")
  ];
  const available = dimensions.filter((item) => item.score !== null);
  const score = available.length ? bounded(available.reduce((sum, item) => sum + Number(item.score), 0) / available.length) : 0;
  return {
    score,
    label: available.length ? scoreLabel(score) : "Veri yok",
    explanation: available.length ? `Mevcut metriklere göre reklam sağlığı ${scoreLabel(score).toLocaleLowerCase("tr-TR")} seviyesinde.` : "Skor için yeterli reklam metriği bulunamadı.",
    dimensions
  };
}

export function calculateHKIntelligenceScore(report: any, updates: any[] = []) {
  const ads = calculateHealthScore(report);
  const metrics = report?.metrics || {};
  const socialRaw = getMetricValue(metrics, ["engagement", "followers_growth", "profile_visits"]);
  const webRaw = getMetricValue(metrics, ["conversions", "leads", "messages", "results"]);
  const activityRaw = updates.length;
  const dimensions = [
    { label: "Reklam Sağlık Skoru", score: ads.score || null, explanation: ads.explanation },
    { label: "Sosyal Medya Skoru", score: socialRaw ? bounded(55 + Math.min(socialRaw / 20, 35)) : null, explanation: socialRaw ? "Sosyal etkileşim ve profil sinyalleri mevcut." : "Sosyal medya verisi yok." },
    { label: "Web / Dönüşüm Skoru", score: webRaw ? bounded(60 + Math.min(webRaw * 2, 35)) : null, explanation: webRaw ? "Dönüşüm veya lead sinyali mevcut." : "Web veya dönüşüm verisi yok." },
    { label: "Rapor Düzenliliği", score: activityRaw ? bounded(60 + Math.min(activityRaw * 10, 30)) : null, explanation: activityRaw ? "Ajans çalışma günlüğü bu dönemde güncellenmiş." : "Bu dönem için çalışma günlüğü verisi yok." }
  ];
  const available = dimensions.filter((item) => item.score !== null);
  const score = available.length ? bounded(available.reduce((sum, item) => sum + Number(item.score), 0) / available.length) : 0;
  return { score, label: available.length ? scoreLabel(score) : "Veri yok", dimensions };
}

export function calculateRoasRoi(input: { adSpend?: unknown; salesCount?: unknown; revenue?: unknown; averageOrderValue?: unknown; serviceFee?: unknown }) {
  const adSpend = parseTurkishNumber(input.adSpend);
  const salesCount = parseTurkishNumber(input.salesCount);
  const revenue = parseTurkishNumber(input.revenue) || salesCount * parseTurkishNumber(input.averageOrderValue);
  const serviceFee = parseTurkishNumber(input.serviceFee);
  const totalCost = adSpend + serviceFee;
  const roas = adSpend > 0 ? revenue / adSpend : 0;
  const roi = totalCost > 0 ? ((revenue - totalCost) / totalCost) * 100 : 0;
  const costPerSale = salesCount > 0 ? totalCost / salesCount : 0;
  const text = !adSpend || !revenue ? "Harcama ve ciro girildiğinde değerlendirme netleşir." : roi >= 0 ? "Gelir, toplam maliyetin üzerinde görünüyor. Karlılık detayları için satış kalitesi takip edilmeli." : "Gelir toplam maliyetin altında görünüyor. Hedefleme, teklif ve dönüşüm takibi yeniden kontrol edilmeli.";
  return { adSpend, salesCount, revenue, serviceFee, roas, roi, costPerSale, text };
}

export function buildActionPlan(report: any, updates: any[] = []) {
  const metrics = report?.metrics || {};
  const override = Array.isArray(metrics.action_plan) ? metrics.action_plan : cleanText(metrics.action_plan).split(/\r?\n/).filter(Boolean);
  if (override.length) return override.slice(0, 5);
  const health = calculateHealthScore(report);
  const actions = [
    "Yeni kreatif testi planla ve en az iki farklı mesaj dene.",
    "Hedef kitle performansını kontrol edip daraltma/genişletme kararı al.",
    "Remarketing ve piksel / dönüşüm takibini kontrol et.",
    "Bütçeyi en iyi dönüşüm üreten kampanya veya reklam setine göre optimize et.",
    "WhatsApp ve lead dönüşüm adımlarını satış ekibiyle birlikte takip et."
  ];
  if (health.score >= 80) actions[3] = "İyi çalışan kampanyalarda kontrollü bütçe artırımı değerlendir.";
  if (updates[0]?.next_action) actions[0] = updates[0].next_action;
  return actions.slice(0, 5);
}

export function getWorkLogItems(updates: any[] = []) {
  return updates.map((item) => ({
    id: item.id,
    date: item.update_date || item.created_at,
    title: item.title || "Ajans çalışması",
    description: item.customer_note || item.agency_comment || item.description || "",
    category: item.update_type || "Raporlama",
    status: item.status || "Yapıldı"
  }));
}

export function getCompetitorEntries(report: any) {
  const value = report?.metrics?.competitors || report?.raw_extracted_data?.competitors || [];
  if (Array.isArray(value)) return value;
  return cleanText(value).split(/\r?\n/).filter(Boolean).map((line) => ({ name: line, notes: line }));
}

export function getCreativeItems(report: any) {
  const value = report?.metrics?.creatives || report?.raw_extracted_data?.creatives || [];
  if (Array.isArray(value)) return value;
  return cleanText(value).split(/\r?\n/).filter(Boolean).map((line) => ({ caption: line, platform: report?.platform || "Meta" }));
}

export function getLeadTracking(report: any) {
  const metrics = report?.metrics || {};
  return {
    total: getMetricValue(metrics, ["lead_total", "leads", "results", "conversions"]),
    called: getMetricValue(metrics, ["lead_called", "called"]),
    proposed: getMetricValue(metrics, ["lead_proposed", "proposal_count"]),
    sold: getMetricValue(metrics, ["lead_sold", "sales_count"]),
    pending: getMetricValue(metrics, ["lead_pending", "follow_up_count"])
  };
}

export function formatCurrency(value: number) {
  return `${Number(value || 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} TL`;
}

export function formatNumber(value: number, digits = 0) {
  return Number(value || 0).toLocaleString("tr-TR", { maximumFractionDigits: digits });
}
