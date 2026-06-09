const aliases: Record<string, string[]> = {
  date: ["date", "day", "tarih", "gün", "rapor başlangıcı", "reporting starts", "başlangıç tarihi"],
  end_date: ["rapor sonu", "reporting ends", "bitiş tarihi"],
  campaign_name: ["campaign name", "kampanya adı", "kampanya adi"],
  impressions: ["impressions", "gösterimler", "gösterim"],
  reach: ["reach", "erişim"],
  clicks: ["clicks", "tıklamalar", "tıklama", "link clicks", "bağlantı tıklamaları", "bağlantı tıklaması"],
  link_clicks: ["link clicks", "bağlantı tıklamaları", "bağlantı tıklaması"],
  landing_page_views: ["landing page views", "açılış sayfası görüntülemeleri"],
  spent: ["amount spent", "amount spent (try)", "harcanan tutar", "harcanan tutar (try)", "spend", "maliyet", "cost"],
  conversions: ["conversions", "dönüşümler", "dönüşüm"],
  leads: ["leads", "potansiyel müşteriler", "potansiyel müşteri", "sonuçlar", "results"],
  messages: ["messaging conversations started", "mesaj başlatma", "mesajlaşma konuşmaları başlatıldı", "başlatılan mesajlaşmalar", "gelen mesaj"],
  calls: ["calls", "aramalar", "arama"],
  ctr: ["ctr", "ctr (bağlantı tıklama oranı)", "tıklanma oranı", "link ctr", "to"],
  cpc: ["cpc", "cpc (bağlantı tıklaması başına ücret)", "tıklama başı maliyet", "cost per link click", "tbm", "average cpc", "ortalama tbm"],
  cpm: ["cpm", "cpm (1000 gösterim başına ücret)", "bin gösterim maliyeti"],
  cost_per_lead: ["sonuç başına ücret", "sonuç başına maliyet", "cost per result", "ortalama potansiyel müşteri maliyeti"],
  frequency: ["frequency", "frekans"],
  followers_growth: ["follower growth", "takipçi artışı", "yeni takipçiler"],
  profile_visits: ["profile visits", "profil ziyareti", "profil ziyaretleri"],
  engagement: ["engagement", "etkileşim"],
  likes: ["likes", "beğeni"],
  comments: ["comments", "yorum"],
  saves: ["saves", "kaydetme"],
  shares: ["shares", "paylaşım"]
};

function normalize(value: unknown) {
  return String(value || "")
    .trim()
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

function keyFor(header: string) {
  return Object.entries(aliases).find(([, values]) => values.some((value) => normalize(value) === normalize(header)))?.[0];
}

function number(value: any) {
  if (typeof value === "number") return value;
  const cleaned = String(value || "").trim().replace(/[^\d,.-]/g, "");
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

export async function extractReportFile(file: File) {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) throw new Error("PDF rapor ayrıştırma henüz desteklenmiyor. Raporu CSV olarak dışa aktarıp yeniden yükleyin.");
  if (/\.(xlsx|xls)$/i.test(file.name)) throw new Error("XLSX ve XLS ayrıştırma paketi bu kurulumda etkin değil. Raporu CSV olarak dışa aktarıp yeniden yükleyin.");
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  const delimiter = (lines[0]?.match(/;/g) || []).length > (lines[0]?.match(/,/g) || []).length ? ";" : ",";
  const parseLine = (line: string) => line.split(delimiter).map((item) => item.trim().replace(/^"|"$/g, ""));
  const headers = parseLine(lines[0] || "");
  if (process.env.NODE_ENV === "development") console.debug("[report-import] CSV headers", headers);
  const rawRows = lines.slice(1).map((line) => Object.fromEntries(parseLine(line).map((value, index) => [headers[index], value])));
  const rows = rawRows.map((row) => Object.fromEntries(Object.entries(row).map(([header, value]) => [keyFor(header) || header, value])));
  if (process.env.NODE_ENV === "development") console.debug("[report-import] mapped metric object", rows[0] || {});
  const timeSeries = rows.map((row) => ({
    date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date || ""),
    impressions: number(row.impressions), reach: number(row.reach), clicks: number(row.clicks || row.link_clicks),
    spent: number(row.spent), conversions: number(row.conversions || row.leads), leads: number(row.leads), messages: number(row.messages),
    ctr: number(row.ctr), cpc: number(row.cpc), cpm: number(row.cpm), cost_per_lead: number(row.cost_per_lead),
    engagement: number(row.engagement), followers_growth: number(row.followers_growth), end_date: String(row.end_date || "")
  })).filter((row) => row.date);
  const metrics = rows.reduce((total, row) => {
    Object.keys(aliases).forEach((key) => {
      if (key === "date" || key === "end_date" || key === "campaign_name") return;
      total[key] = Number(total[key] || 0) + number(row[key]);
    });
    return total;
  }, {} as Record<string, number>);
  return { metrics, timeSeries, startDate: String(rows[0]?.date || ""), endDate: String(rows[0]?.end_date || rows[rows.length - 1]?.date || ""), raw: { headers: Object.keys(rawRows[0] || {}), rows: rawRows }, rowCount: rows.length };
}
