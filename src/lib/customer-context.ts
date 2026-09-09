import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

// Real, structured marketing context for one customer, assembled from
// existing tables only (companies, preparation_notes, meta_adset_metrics,
// reports) — no new table. Before this module existed, runAgentTask() only
// ever loaded that customer's *past AI run summaries* (agent_memories); the
// customer's actual CRM record (sector, budget, brand brief, real ad
// performance) never reached the prompt at all, so "for this customer"
// tasks had no real customer data to work from. Every field here is either
// real data (explicitly labeled with its source and as-of date) or is
// explicitly marked missing — never fabricated or estimated silently.

type CompanyRow = {
  id: string;
  name?: string | null;
  sector?: string | null;
  city?: string | null;
  website?: string | null;
  instagram?: string | null;
  status?: string | null;
  customer_package_type?: string | null;
  monthly_ad_budget?: number | null;
  created_at?: string | null;
};

type PreparationNotesRow = {
  brand_analysis?: string | null;
  swot_notes?: string | null;
  target_audience_notes?: string | null;
  offer_positioning?: string | null;
  funnel_planning?: string | null;
  content_ideas?: string | null;
  ad_angle_ideas?: string | null;
};

type MetaMetricRow = {
  date?: string | null;
  spend?: number | null;
  impressions?: number | null;
  clicks?: number | null;
  leads?: number | null;
  purchases?: number | null;
};

type ReportRow = { report_type?: string | null; created_at?: string | null };

export type CustomerContextSummary = {
  companyId: string;
  companyName: string | null;
  hasBrief: boolean;
  hasMetaPerformance: boolean;
  metaDateRange: { from: string; to: string } | null;
  reportCount: number;
  asOf: string;
  missingFields: string[];
};

export type CustomerContext = {
  summary: CustomerContextSummary;
  // Turkish, prompt-ready block — every line is either real data (labeled
  // with its source) or an explicit "Kayıtlı değil" (not recorded) marker,
  // so the model is instructed never to invent a value for a missing field.
  contextBlock: string;
};

function fmtMoney(value: number) {
  return `${value.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL`;
}

function fmtNum(value: number) {
  return value.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

// periodDays controls only the Meta performance lookback window (default 30
// gün) — company/brief fields are always current-record, not period-scoped.
export async function loadCustomerContext(companyId: string, periodDays = 30): Promise<CustomerContext | null> {
  if (!hasSupabaseConfig() || !companyId) return null;

  const fromIso = new Date(Date.now() - periodDays * 86400000).toISOString().slice(0, 10);
  const [companies, notes, metaRows, reports] = await Promise.all([
    supabaseRest<CompanyRow[]>(`companies?id=eq.${encodeURIComponent(companyId)}&select=id,name,sector,city,website,instagram,status,customer_package_type,monthly_ad_budget,created_at&limit=1`).catch(() => []),
    supabaseRest<PreparationNotesRow[]>(`preparation_notes?company_id=eq.${encodeURIComponent(companyId)}&select=brand_analysis,swot_notes,target_audience_notes,offer_positioning,funnel_planning,content_ideas,ad_angle_ideas&limit=1`).catch(() => []),
    supabaseRest<MetaMetricRow[]>(`meta_adset_metrics?company_id=eq.${encodeURIComponent(companyId)}&date=gte.${fromIso}&select=date,spend,impressions,clicks,leads,purchases&order=date.asc&limit=1000`).catch(() => []),
    supabaseRest<ReportRow[]>(`reports?company_id=eq.${encodeURIComponent(companyId)}&select=report_type,created_at&order=created_at.desc&limit=3`).catch(() => [])
  ]);

  const company = companies[0] || null;
  if (!company) return null;
  const brief = notes[0] || null;

  const missingFields: string[] = [];
  const lines: string[] = ["GERÇEK MÜŞTERİ VERİSİ (aşağıdaki alanlar dışında hiçbir müşteri bilgisi uydurma; eksik olan açıkça 'Kayıtlı değil' olarak işaretlenmiştir):"];

  lines.push(`- Firma: ${company.name || "—"}`);
  lines.push(`- Sektör: ${company.sector || "Kayıtlı değil"}`);
  if (!company.sector) missingFields.push("sektör");
  lines.push(`- Şehir/Bölge: ${company.city || "Kayıtlı değil"}`);
  if (!company.city) missingFields.push("bölge");
  lines.push(`- Paket: ${company.customer_package_type || "Kayıtlı değil"}`);
  lines.push(`- Aylık reklam bütçesi (gerçek kayıt): ${company.monthly_ad_budget ? fmtMoney(Number(company.monthly_ad_budget)) : "Kayıtlı değil"}`);
  if (!company.monthly_ad_budget) missingFields.push("bütçe");
  lines.push(`- Web sitesi: ${company.website || "Kayıtlı değil"} · Instagram: ${company.instagram || "Kayıtlı değil"}`);
  lines.push(`- Müşteri durumu: ${company.status || "—"} · Kayıt tarihi: ${company.created_at ? new Date(company.created_at).toLocaleDateString("tr-TR") : "—"}`);

  if (brief && (brief.brand_analysis || brief.target_audience_notes || brief.offer_positioning || brief.swot_notes)) {
    lines.push("");
    lines.push("Müşteri Hazırlık Notu (Hazırlık ekranında admin tarafından girilmiş, gerçek kayıt):");
    if (brief.brand_analysis) lines.push(`- Marka analizi: ${brief.brand_analysis.slice(0, 600)}`);
    if (brief.target_audience_notes) lines.push(`- Hedef kitle notu: ${brief.target_audience_notes.slice(0, 600)}`);
    else missingFields.push("hedef kitle");
    if (brief.offer_positioning) lines.push(`- Konumlandırma: ${brief.offer_positioning.slice(0, 400)}`);
    if (brief.swot_notes) lines.push(`- SWOT notu: ${brief.swot_notes.slice(0, 600)}`);
    if (brief.funnel_planning) lines.push(`- Funnel planı: ${brief.funnel_planning.slice(0, 400)}`);
    if (brief.ad_angle_ideas) lines.push(`- Reklam açısı fikirleri: ${brief.ad_angle_ideas.slice(0, 400)}`);
  } else {
    missingFields.push("marka/hedef kitle brifi (Hazırlık notu girilmemiş)");
    lines.push("");
    lines.push("Müşteri Hazırlık Notu: Kayıtlı değil (marka dili, hedef kitle ve konumlandırma bilgisi bu müşteri için henüz girilmemiş — bu alanlarda varsayım yapma, eksik olarak belirt).");
  }

  let metaRange: { from: string; to: string } | null = null;
  if (metaRows.length) {
    const totals = metaRows.reduce<{ spend: number; impressions: number; clicks: number; leads: number; purchases: number }>((acc, row) => ({
      spend: acc.spend + Number(row.spend || 0),
      impressions: acc.impressions + Number(row.impressions || 0),
      clicks: acc.clicks + Number(row.clicks || 0),
      leads: acc.leads + Number(row.leads || 0),
      purchases: acc.purchases + Number(row.purchases || 0)
    }), { spend: 0, impressions: 0, clicks: 0, leads: 0, purchases: 0 });
    metaRange = { from: metaRows[0].date || fromIso, to: metaRows[metaRows.length - 1].date || fromIso };
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : null;
    const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : null;
    const cpl = totals.leads > 0 ? totals.spend / totals.leads : null;
    lines.push("");
    lines.push(`Gerçek Meta Reklam Performansı (${metaRange.from} → ${metaRange.to}, meta_adset_metrics tablosundan gerçek senkronize veri):`);
    lines.push(`- Harcama: ${fmtMoney(totals.spend)} · Gösterim: ${fmtNum(totals.impressions)} · Tıklama: ${fmtNum(totals.clicks)}`);
    lines.push(`- Lead: ${fmtNum(totals.leads)} · Satın alma: ${fmtNum(totals.purchases)}`);
    lines.push(`- Hesaplanan CTR: ${ctr !== null ? `%${ctr.toFixed(2)}` : "Hesaplanamadı (gösterim 0)"}`);
    lines.push(`- Hesaplanan CPC: ${cpc !== null ? fmtMoney(cpc) : "Hesaplanamadı (tıklama 0)"}`);
    lines.push(`- Hesaplanan CPL (lead başı maliyet): ${cpl !== null ? fmtMoney(cpl) : "Hesaplanamadı (lead 0)"}`);
    lines.push("Not: Bu CTR/CPC/CPL değerleri yukarıdaki gerçek toplamlardan hesaplanmıştır (Hesaplanan Metrik) — sıfıra bölme veya veri eksikliği durumunda 'Hesaplanamadı' olarak işaretlenmiştir, asla uydurulmamıştır.");
  } else {
    missingFields.push(`son ${periodDays} gün Meta reklam verisi`);
    lines.push("");
    lines.push(`Reklam Performansı: Bu müşteri için seçilen dönemde (son ${periodDays} gün) senkronize Meta reklam verisi yok — reklam hesabı bağlı değil veya bu dönemde veri senkronize edilmemiş olabilir. ROAS/CPA/CTR gibi metrikleri uydurma; "veri yok" olarak belirt.`);
  }
  lines.push("Not: Google Ads için bu sistemde ayrı, gerçek zamanlı senkronize edilen bir performans tablosu yoktur — Google Ads rakamı isteniyorsa yalnızca 'Rapor Merkezi'nde manuel girilmiş bir rapor varsa ondan söz et, yoksa veri yok de.");

  if (reports.length) {
    lines.push("");
    lines.push(`Son Raporlar (reports tablosu, gerçek kayıt): ${reports.map((report) => `${report.report_type || "Rapor"} (${report.created_at ? new Date(report.created_at).toLocaleDateString("tr-TR") : "tarih yok"})`).join(", ")}`);
  } else {
    missingFields.push("geçmiş rapor kaydı");
  }

  return {
    summary: {
      companyId,
      companyName: company.name || null,
      hasBrief: Boolean(brief && (brief.brand_analysis || brief.target_audience_notes)),
      hasMetaPerformance: metaRows.length > 0,
      metaDateRange: metaRange,
      reportCount: reports.length,
      asOf: new Date().toISOString(),
      missingFields
    },
    contextBlock: lines.join("\n")
  };
}
