"use client";

import { useState } from "react";
import { MetricCard } from "./MetricCard";
import { AnalyticsAreaChart, AnalyticsBarChart, type SeriesPoint } from "./charts";
import { ContentTable, type ContentRow } from "./ContentTable";
import { platformTheme } from "./theme";
import type { AnalyticsProvider, KpiCardValue, ProviderConnectionStatus } from "@/lib/analytics-center/types";

export type DailySeriesByMetric = Record<string, Array<{ date: string; value: number }>>;

export type PlatformViewProps = {
  kpis: KpiCardValue[];
  daily: DailySeriesByMetric;
  content: ContentRow[];
  connection: ProviderConnectionStatus | null;
  loading: boolean;
};

function formatDateLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

function seriesFor(daily: DailySeriesByMetric, key: string): SeriesPoint[] {
  return (daily[key] || []).map((point) => ({ label: formatDateLabel(point.date), value: point.value }));
}

function kpiValue(kpis: KpiCardValue[], key: string) {
  return kpis.find((k) => k.key === key) || null;
}

function formatKpiValue(kpi: KpiCardValue | null): string {
  if (!kpi || kpi.value === null) return "—";
  if (kpi.unit === "currency") return `${kpi.value.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL`;
  if (kpi.unit === "percent") return `%${kpi.value.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`;
  if (kpi.unit === "seconds") return `${Math.round(kpi.value)} sn`;
  if (kpi.unit === "rating") return kpi.value.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
  return kpi.value.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

function KpiCell({ variant, label, kpis, metricKey, unsupportedNote }: { variant: AnalyticsProvider; label: string; kpis: KpiCardValue[]; metricKey: string; unsupportedNote?: string }) {
  const kpi = kpiValue(kpis, metricKey);
  if (!kpi) {
    return <MetricCard variant={variant} label={label} value="—" note={unsupportedNote || "Bu metrik platform API'si tarafından sunulmuyor."} />;
  }
  return <MetricCard variant={variant} label={label} value={formatKpiValue(kpi)} changePercent={kpi.changePercent} />;
}

function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>;
}

function SubTabs({ tabs, active, onChange, variant }: { tabs: string[]; active: string; onChange: (t: string) => void; variant: AnalyticsProvider }) {
  const theme = platformTheme(variant);
  return (
    <div className="flex flex-wrap gap-2" role="tablist">
      {tabs.map((tab) => (
        <button key={tab} role="tab" aria-selected={active === tab} type="button" onClick={() => onChange(tab)}
          className="rounded-full px-4 py-2 text-sm font-black transition"
          style={active === tab ? { background: theme.accent, color: "white" } : { background: "var(--admin-surface-soft)", color: "var(--admin-text-secondary)" }}>
          {tab}
        </button>
      ))}
    </div>
  );
}

function UnsupportedNote({ text }: { text: string }) {
  return (
    <div className="grid place-items-center rounded-[18px] bg-white p-10 text-center dark:bg-slate-900">
      <p className="text-sm font-bold" style={{ color: "var(--admin-text-muted)" }}>{text}</p>
    </div>
  );
}

export function InstagramView({ kpis, daily, content, loading }: PlatformViewProps) {
  const [tab, setTab] = useState("Topluluk");
  return (
    <div className="grid gap-5">
      <SubTabs tabs={["Topluluk", "Demografi", "Hesap", "İçerikler"]} active={tab} onChange={setTab} variant="instagram" />
      {tab === "Topluluk" && (
        <div className="grid gap-5">
          <KpiGrid>
            <KpiCell variant="instagram" label="Takipçi" kpis={kpis} metricKey="followers" />
            <KpiCell variant="instagram" label="Takip Edilen" kpis={kpis} metricKey="following" />
            <KpiCell variant="instagram" label="Yeni Takipçi" kpis={kpis} metricKey="followers_gained" />
            <KpiCell variant="instagram" label="Kaybedilen" kpis={kpis} metricKey="followers_lost" />
            <KpiCell variant="instagram" label="Net Büyüme" kpis={kpis} metricKey="followers_net" />
            <MetricCard variant="instagram" label="İçerik Sayısı" value={content.length ? String(content.length) : "0"} note="Seçili dönemde yayınlanan içerik" />
          </KpiGrid>
          <AnalyticsAreaChart title="Takipçi Büyümesi" subtitle="Seçili dönem" data={seriesFor(daily, "followers")} color={platformTheme("instagram").accent} loading={loading} />
        </div>
      )}
      {tab === "Demografi" && <UnsupportedNote text="Bu metrik platform API'si tarafından sunulmuyor. Instagram takipçi demografisi (cinsiyet/yaş/ülke/şehir dağılımı) için ek Meta izinleri ve onayı gerekir." />}
      {tab === "Hesap" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <AnalyticsAreaChart title="Erişim" data={seriesFor(daily, "reach")} color={platformTheme("instagram").accent} loading={loading} />
          <AnalyticsAreaChart title="Etkileşimde Bulunan Hesaplar" data={seriesFor(daily, "accounts_engaged")} color={platformTheme("instagram").accent} loading={loading} />
        </div>
      )}
      {tab === "İçerikler" && <ContentTable rows={content} showPlatformColumn={false} emptyMessage="Seçili dönemde Instagram içeriği bulunamadı." />}
    </div>
  );
}

export function FacebookView({ kpis, daily, content, loading }: PlatformViewProps) {
  const [tab, setTab] = useState("Sayfa Genel Bakış");
  return (
    <div className="grid gap-5">
      <SubTabs tabs={["Sayfa Genel Bakış", "Gönderiler", "Kitle"]} active={tab} onChange={setTab} variant="facebook" />
      {tab === "Sayfa Genel Bakış" && (
        <div className="grid gap-5">
          <KpiGrid>
            <KpiCell variant="facebook" label="Takipçi" kpis={kpis} metricKey="page_fans" />
            <KpiCell variant="facebook" label="Görüntülenme" kpis={kpis} metricKey="page_impressions" />
            <KpiCell variant="facebook" label="Erişim" kpis={kpis} metricKey="page_impressions_unique" />
            <KpiCell variant="facebook" label="Etkileşimde Bulunan" kpis={kpis} metricKey="page_engaged_users" />
            <KpiCell variant="facebook" label="Gönderi Etkileşimi" kpis={kpis} metricKey="page_post_engagements" />
            <KpiCell variant="facebook" label="Video Görüntülenmesi" kpis={kpis} metricKey="page_video_views" />
          </KpiGrid>
          <div className="grid gap-5 lg:grid-cols-2">
            <AnalyticsAreaChart title="Takipçi Büyümesi" data={seriesFor(daily, "page_fans")} color={platformTheme("facebook").accent} loading={loading} />
            <AnalyticsAreaChart title="Sayfa Görüntülenme" data={seriesFor(daily, "page_impressions_unique")} color={platformTheme("facebook").accent} loading={loading} />
          </div>
        </div>
      )}
      {tab === "Gönderiler" && <ContentTable rows={content} showPlatformColumn={false} emptyMessage="Seçili dönemde Facebook gönderisi bulunamadı." />}
      {tab === "Kitle" && (
        <div className="grid gap-5">
          <AnalyticsAreaChart title="Takipçi Dengesi" data={seriesFor(daily, "page_fans")} color={platformTheme("facebook").accent} loading={loading} />
          <UnsupportedNote text="Detaylı kitle demografisi (yaş/cinsiyet/konum dağılımı) bu izin kapsamında sunulmuyor." />
        </div>
      )}
    </div>
  );
}

export function TikTokView({ kpis, daily, content, loading, connection }: PlatformViewProps) {
  const [tab, setTab] = useState("Topluluk");
  if (connection && !connection.parentConnected) {
    return <UnsupportedNote text="TikTok hesabını bağla — Bağlantı Yönetimi'nden TikTok girişini tamamlayın." />;
  }
  return (
    <div className="grid gap-5">
      <SubTabs tabs={["Topluluk", "Videolar"]} active={tab} onChange={setTab} variant="tiktok" />
      {tab === "Topluluk" && (
        <div className="grid gap-5">
          <KpiGrid>
            <KpiCell variant="tiktok" label="Takipçi" kpis={kpis} metricKey="followers" />
            <KpiCell variant="tiktok" label="Takip Edilen" kpis={kpis} metricKey="following" />
            <KpiCell variant="tiktok" label="Toplam Beğeni" kpis={kpis} metricKey="likes_total" />
            <KpiCell variant="tiktok" label="Video Sayısı" kpis={kpis} metricKey="video_count" />
          </KpiGrid>
          <AnalyticsAreaChart title="Takipçi Büyümesi" subtitle="Her senkronizasyonda gerçek anlık değer kaydedilir" data={seriesFor(daily, "followers")} color={platformTheme("tiktok").accent} loading={loading} />
        </div>
      )}
      {tab === "Videolar" && <ContentTable rows={content} showPlatformColumn={false} emptyMessage="Bu TikTok hesabında herkese açık video bulunamadı." />}
    </div>
  );
}

export function YoutubeView({ kpis, daily, content, loading }: PlatformViewProps) {
  const [tab, setTab] = useState("Topluluk");
  return (
    <div className="grid gap-5">
      <SubTabs tabs={["Topluluk", "Yayınlanan Videolar", "Video Performansı"]} active={tab} onChange={setTab} variant="youtube" />
      {tab === "Topluluk" && (
        <div className="grid gap-5">
          <KpiGrid>
            <KpiCell variant="youtube" label="Abone" kpis={kpis} metricKey="subscribers" />
            <KpiCell variant="youtube" label="Görüntülenme" kpis={kpis} metricKey="views" />
            <KpiCell variant="youtube" label="İzlenme Süresi (dk)" kpis={kpis} metricKey="estimatedMinutesWatched" />
            <KpiCell variant="youtube" label="Ort. İzlenme Süresi" kpis={kpis} metricKey="averageViewDuration" />
            <KpiCell variant="youtube" label="Kazanılan Abone" kpis={kpis} metricKey="subscribersGained" />
            <KpiCell variant="youtube" label="Kaybedilen Abone" kpis={kpis} metricKey="subscribersLost" />
          </KpiGrid>
          <AnalyticsAreaChart title="Abone Büyümesi" data={seriesFor(daily, "subscribers")} color={platformTheme("youtube").accent} loading={loading} />
        </div>
      )}
      {tab === "Yayınlanan Videolar" && <ContentTable rows={content} showPlatformColumn={false} emptyMessage="Seçili dönemde yayınlanan video bulunamadı." />}
      {tab === "Video Performansı" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <AnalyticsAreaChart title="Görüntülenme Trendi" data={seriesFor(daily, "views")} color={platformTheme("youtube").accent} loading={loading} />
          <AnalyticsAreaChart title="İzlenme Süresi Trendi" data={seriesFor(daily, "estimatedMinutesWatched")} color={platformTheme("youtube").accent} loading={loading} />
        </div>
      )}
    </div>
  );
}

export function GoogleAdsView({ kpis, daily, loading }: PlatformViewProps) {
  return (
    <div className="grid gap-5">
      <KpiGrid>
        <KpiCell variant="google_ads" label="Harcama" kpis={kpis} metricKey="cost" />
        <KpiCell variant="google_ads" label="Gösterim" kpis={kpis} metricKey="impressions" />
        <KpiCell variant="google_ads" label="Tıklama" kpis={kpis} metricKey="clicks" />
        <KpiCell variant="google_ads" label="TO (CTR)" kpis={kpis} metricKey="ctr" />
        <KpiCell variant="google_ads" label="Ort. TBM (CPC)" kpis={kpis} metricKey="averageCpc" />
        <KpiCell variant="google_ads" label="Dönüşüm" kpis={kpis} metricKey="conversions" />
        <KpiCell variant="google_ads" label="Dönüşüm Değeri" kpis={kpis} metricKey="conversionsValue" />
        <KpiCell variant="google_ads" label="Dönüşüm Başına Maliyet" kpis={kpis} metricKey="costPerConversion" />
      </KpiGrid>
      <div className="grid gap-5 lg:grid-cols-2">
        <AnalyticsAreaChart title="Harcama Trendi" data={seriesFor(daily, "cost")} color={platformTheme("google_ads").accent} loading={loading} />
        <AnalyticsBarChart title="Tıklama Trendi" data={seriesFor(daily, "clicks")} color={platformTheme("google_ads").accent} loading={loading} />
      </div>
    </div>
  );
}

export function GoogleBusinessView({ kpis, daily, loading }: PlatformViewProps) {
  return (
    <div className="grid gap-5">
      <KpiGrid>
        <KpiCell variant="google_business_profile" label="Masaüstü Harita Gösterimi" kpis={kpis} metricKey="BUSINESS_IMPRESSIONS_DESKTOP_MAPS" />
        <KpiCell variant="google_business_profile" label="Mobil Harita Gösterimi" kpis={kpis} metricKey="BUSINESS_IMPRESSIONS_MOBILE_MAPS" />
        <KpiCell variant="google_business_profile" label="Telefon Araması" kpis={kpis} metricKey="CALL_CLICKS" />
        <KpiCell variant="google_business_profile" label="Web Sitesi Tıklaması" kpis={kpis} metricKey="WEBSITE_CLICKS" />
        <KpiCell variant="google_business_profile" label="Yol Tarifi İsteği" kpis={kpis} metricKey="BUSINESS_DIRECTION_REQUESTS" />
        <KpiCell variant="google_business_profile" label="Toplam Yorum" kpis={kpis} metricKey="review_count" />
        <KpiCell variant="google_business_profile" label="Ortalama Puan" kpis={kpis} metricKey="average_rating" />
      </KpiGrid>
      <AnalyticsAreaChart title="Yerel Görünürlük (Mobil Arama Gösterimi)" data={seriesFor(daily, "BUSINESS_IMPRESSIONS_MOBILE_SEARCH")} color={platformTheme("google_business_profile").accent} loading={loading} />
    </div>
  );
}
