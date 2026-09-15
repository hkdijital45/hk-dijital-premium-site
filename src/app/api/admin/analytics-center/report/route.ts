import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { recordActivity } from "@/lib/activity-log";
import { uploadGeneratedDocument } from "@/lib/customer-assets";
import { buildDocumentFileName, DOCUMENT_MIME_TYPES, generatePdfBuffer, type DocumentPayload } from "@/lib/server/document-generator";
import { getAllProviderKpis } from "@/lib/analytics-center/kpi";
import { queryContentMetrics } from "@/lib/analytics-center/metrics-store";
import { PROVIDER_LABELS } from "@/lib/analytics-center/capabilities";
import { buildProviderInsights, buildGoogleAdsInsights, buildGoogleBusinessInsights, topContentInsight, strongestAndWeakestPlatform } from "@/lib/analytics-center/insights";
import { ANALYTICS_PROVIDERS } from "@/lib/analytics-center/types";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import type { AnalyticsProvider, KpiCardValue } from "@/lib/analytics-center/types";

function formatKpiLine(kpi: KpiCardValue): string {
  if (kpi.value === null) return `${kpi.label}: veri yok`;
  const value = kpi.unit === "currency" ? `${kpi.value.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL` : kpi.unit === "percent" ? `${kpi.value.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%` : kpi.value.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
  const change = kpi.changePercent !== null ? ` (önceki döneme göre ${kpi.changePercent >= 0 ? "+" : ""}${kpi.changePercent.toFixed(1)}%)` : "";
  return `${kpi.label}: ${value}${change}`;
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("analiz-raporlama");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const companyId = String(body.companyId || "");
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  const startDate = String(body.startDate || "");
  const endDate = String(body.endDate || "");
  if (!startDate || !endDate) return NextResponse.json({ error: "Rapor için tarih aralığı seçin." }, { status: 400 });

  const providers: AnalyticsProvider[] = Array.isArray(body.platforms) && body.platforms.length
    ? body.platforms.filter((p: string) => ANALYTICS_PROVIDERS.includes(p as AnalyticsProvider))
    : ANALYTICS_PROVIDERS;
  if (!providers.length) return NextResponse.json({ error: "En az bir platform seçin." }, { status: 400 });

  try {
    const companyRows = await supabaseRest<Array<{ id: string; name: string }>>(`companies?id=eq.${encodeURIComponent(companyId)}&select=id,name&limit=1`);
    const company = companyRows[0];
    if (!company) return NextResponse.json({ error: "Müşteri kaydı bulunamadı." }, { status: 404 });

    const range = { startDate, endDate };
    const kpisByProvider = await getAllProviderKpis(companyId, providers, range);
    const contentProviders = providers.filter((p): p is "instagram" | "facebook" | "youtube" => ["instagram", "facebook", "youtube"].includes(p));
    const contentByProvider = Object.fromEntries(
      await Promise.all(contentProviders.map(async (p) => [p, await queryContentMetrics(companyId, [p], range, 10)] as const))
    );

    const { strongest, weakest } = strongestAndWeakestPlatform(kpisByProvider);
    const summaryLines: string[] = [];
    if (strongest) summaryLines.push(`En güçlü performans gösteren platform: ${PROVIDER_LABELS[strongest]}.`);
    if (weakest && weakest !== strongest) summaryLines.push(`En çok dikkat gerektiren platform: ${PROVIDER_LABELS[weakest]}.`);
    const topContent = topContentInsight(contentByProvider);
    if (topContent) summaryLines.push(topContent);

    const sections: DocumentPayload["sections"] = [];
    for (const provider of providers) {
      const kpis = kpisByProvider[provider] || [];
      const withData = kpis.filter((k) => k.value !== null);
      if (!withData.length) {
        sections.push({ title: PROVIDER_LABELS[provider], text: "Bu dönem için veri bulunamadı (bağlantı yok, izin eksik veya senkronizasyon henüz yapılmadı)." });
        continue;
      }
      const insightLines = provider === "google_ads" ? buildGoogleAdsInsights(kpis) : provider === "google_business_profile" ? buildGoogleBusinessInsights(kpis) : buildProviderInsights(provider, kpis);
      sections.push({
        title: PROVIDER_LABELS[provider],
        items: [...withData.map(formatKpiLine), ...insightLines]
      });
    }

    if (topContent || strongest) {
      sections.push({ title: "En İyi İçerikler ve Gözlemler", items: [...(topContent ? [topContent] : [])] });
    }

    const title = String(body.title || `${company.name} — Analiz & Raporlama`);
    const periodLabel = `${startDate} — ${endDate}`;
    const payload: DocumentPayload = {
      title,
      customerName: company.name,
      period: periodLabel,
      executiveSummary: summaryLines.join(" ") || "Seçili dönem için özet oluşturulamadı; bağlı platform verisi bulunamadı.",
      sections,
      footerNote: "Bu rapor HK Dijital Analiz & Raporlama Merkezi tarafından, bağlı platformların resmi API verilerinden otomatik olarak oluşturulmuştur."
    };

    const pdfBuffer = await generatePdfBuffer(payload);
    const fileName = buildDocumentFileName(company.name, "Analiz Raporu", "pdf");
    const uploaded = await uploadGeneratedDocument(companyId, Buffer.from(pdfBuffer), fileName, DOCUMENT_MIME_TYPES.pdf);

    const documentRows = await supabaseRest<Array<{ id: string }>>("customer_documents", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        company_id: companyId,
        title,
        document_type: "Rapor",
        document_url: uploaded.url,
        document_date: new Date().toISOString().slice(0, 10),
        visible_to_customer: Boolean(body.visibleToCustomer),
        status: "Aktif",
        storage_path: uploaded.path,
        mime_type: uploaded.mimeType,
        file_size: uploaded.size,
        uploaded_by: session.profileId || null,
        source_module: "Analiz Merkezi",
        created_by: session.profileId || null
      })
    });
    const document = documentRows[0];

    const reportRows = await supabaseRest<Array<Record<string, unknown>>>("analytics_reports", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        company_id: companyId,
        title,
        period_start: startDate,
        period_end: endDate,
        comparison_mode: body.comparisonMode || "previous_period",
        platforms: providers,
        sections: sections.map((s) => s.title),
        summary: { lines: summaryLines },
        document_id: document?.id || null,
        created_by: session.profileId || null
      })
    });

    await recordActivity({
      session,
      action: "Oluşturma",
      entity: "Analiz Raporu",
      entityId: reportRows[0]?.id as string | undefined,
      companyId,
      details: { message: `${title} raporu oluşturuldu (${periodLabel}).`, platforms: providers }
    }).catch(() => null);

    return NextResponse.json({ ok: true, report: reportRows[0], document, pdfUrl: uploaded.url });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}
