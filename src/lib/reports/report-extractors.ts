const aliases: Record<string, string[]> = {
  date: ["date", "day", "tarih", "gün"],
  campaign_name: ["campaign name", "kampanya adı"],
  impressions: ["impressions", "gösterimler", "gösterim"],
  reach: ["reach", "erişim"],
  clicks: ["clicks", "tıklamalar", "tıklama"],
  link_clicks: ["link clicks", "bağlantı tıklamaları", "bağlantı tıklaması"],
  landing_page_views: ["landing page views", "açılış sayfası görüntülemeleri"],
  spent: ["amount spent", "harcanan tutar", "spend", "maliyet", "cost"],
  conversions: ["conversions", "dönüşümler", "dönüşüm"],
  leads: ["leads", "potansiyel müşteriler", "potansiyel müşteri"],
  messages: ["messaging conversations started", "başlatılan mesajlaşmalar", "gelen mesaj"],
  calls: ["calls", "aramalar", "arama"],
  ctr: ["ctr", "to"],
  cpc: ["cpc", "tbm", "average cpc", "ortalama tbm"],
  cpm: ["cpm", "bin gösterim maliyeti"],
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
  return String(value || "").trim().toLocaleLowerCase("tr-TR");
}

function keyFor(header: string) {
  return Object.entries(aliases).find(([, values]) => values.some((value) => normalize(value) === normalize(header)))?.[0];
}

function number(value: any) {
  if (typeof value === "number") return value;
  const normalized = String(value || "").replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  return Number(normalized || 0);
}

export async function extractReportFile(file: File) {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) throw new Error("PDF rapor ayrıştırma henüz desteklenmiyor. Raporu CSV olarak dışa aktarıp yeniden yükleyin.");
  if (/\.(xlsx|xls)$/i.test(file.name)) throw new Error("XLSX ve XLS ayrıştırma paketi bu kurulumda etkin değil. Raporu CSV olarak dışa aktarıp yeniden yükleyin.");
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  const delimiter = (lines[0]?.match(/;/g) || []).length > (lines[0]?.match(/,/g) || []).length ? ";" : ",";
  const parseLine = (line: string) => line.split(delimiter).map((item) => item.trim().replace(/^"|"$/g, ""));
  const headers = parseLine(lines[0] || "");
  const rawRows = lines.slice(1).map((line) => Object.fromEntries(parseLine(line).map((value, index) => [headers[index], value])));
  const rows = rawRows.map((row) => Object.fromEntries(Object.entries(row).map(([header, value]) => [keyFor(header) || header, value])));
  const timeSeries = rows.map((row) => ({
    date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date || ""),
    impressions: number(row.impressions), reach: number(row.reach), clicks: number(row.clicks || row.link_clicks),
    spent: number(row.spent), conversions: number(row.conversions), leads: number(row.leads), messages: number(row.messages),
    engagement: number(row.engagement), followers_growth: number(row.followers_growth)
  })).filter((row) => row.date);
  const metrics = rows.reduce((total, row) => {
    Object.keys(aliases).forEach((key) => {
      if (key === "date" || key === "campaign_name") return;
      total[key] = Number(total[key] || 0) + number(row[key]);
    });
    return total;
  }, {} as Record<string, number>);
  return { metrics, timeSeries, raw: { headers: Object.keys(rawRows[0] || {}), rows: rawRows }, rowCount: rows.length };
}
