"use client";
/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, CheckCircle2, ExternalLink, MousePointerClick, RefreshCcw, Settings2, ShieldCheck, XCircle } from "lucide-react";
import type { AnalyticsCheckStatus, AnalyticsStatusItem, WebsiteAnalyticsResponse } from "@/lib/website-analytics";
import { WebsiteAnalyticsSummaryCards } from "@/components/admin/WebsiteAnalyticsSummaryCards";

const numberFormat = new Intl.NumberFormat("tr-TR");
const percentFormat = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });

function asPercent(value: number) {
  return `%${percentFormat.format(value || 0)}`;
}

function statusLabel(status?: WebsiteAnalyticsResponse["status"]) {
  if (status === "live") return "Canlı";
  if (status === "partial") return "Kısmi";
  return "Demo";
}

function setupRow(label: string, ready: boolean, description: string) {
  return { label, ready, description };
}

function integrationStatusLabel(status: AnalyticsCheckStatus) {
  if (status === "ready") return "Hazır";
  if (status === "error") return "Hatalı";
  if (status === "optional") return "Opsiyonel";
  if (status === "not_configured") return "Yapılandırılmadı";
  return "Eksik";
}

function integrationStatusClass(status: AnalyticsCheckStatus) {
  if (status === "ready") return "bg-emerald-100 text-emerald-700";
  if (status === "error") return "bg-red-100 text-red-700";
  if (status === "optional") return "bg-sky-100 text-sky-700";
  if (status === "not_configured") return "bg-slate-100 text-slate-700";
  return "bg-amber-100 text-amber-700";
}

function IntegrationCard({ item }: { item: AnalyticsStatusItem }) {
  return (
    <article className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-slate-950">{item.label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{item.help}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black ${integrationStatusClass(item.status)}`}>{integrationStatusLabel(item.status)}</span>
      </div>
      {item.missingEnv.length > 0 && (
        <p className="mt-3 rounded-[12px] border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">
          Eksik env: {item.missingEnv.join(", ")}
        </p>
      )}
      {item.isSecret && <p className="mt-2 text-[11px] font-bold text-slate-500">Secret değer gösterilmez; yalnızca var/yok durumu kontrol edilir.</p>}
    </article>
  );
}

export function WebsiteAnalyticsCenter() {
  const [data, setData] = useState<WebsiteAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/website-analytics", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Website Analytics verisi alınamadı.");
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Website Analytics verisi alınamadı.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const setupItems = useMemo(() => {
    const setup = data?.setup;
    return [
      setupRow("Meta Pixel ID", Boolean(setup?.metaPixelId), "Public site PageView ve CTA olaylarını Meta tarafına gönderen kimlik."),
      setupRow("Meta Dataset (veri seti) ID", Boolean(setup?.metaDatasetId), "Meta Event Manager verisini server-side okumak için hazırlanır."),
      setupRow("Meta API (uygulama programlama arayüzü) token", Boolean(setup?.metaAccessToken), "Sunucu tarafında saklanır, tarayıcıya gönderilmez."),
      setupRow("GA4 (Google Analytics 4) Measurement ID", Boolean(setup?.gaMeasurementId), "Public site Google Analytics ölçüm kimliği."),
      setupRow("GA4 Property ID", Boolean(setup?.gaPropertyId), "Google Analytics raporlama mülkü."),
      setupRow("Google servis hesabı", Boolean(setup?.gaServiceAccount), "GA4 API raporları için server-side servis hesabı.")
    ];
  }, [data?.setup]);

  const summary = data?.summary;
  const criticalMissing = data?.integrationStatus?.criticalMissing || [];
  const overviewCards = [
    { label: "PageView", value: summary?.last7DaysPageViews ?? 0, description: "Son 7 günlük sayfa görüntüleme." },
    { label: "Contact", value: summary?.contacts ?? 0, description: "WhatsApp ve iletişim tıklamaları." },
    { label: "Lead", value: summary?.leads ?? 0, description: "Başarılı form ve teklif talepleri." },
    { label: "CTA tıklamaları", value: summary?.ctaClicks ?? 0, description: "Paket, demo, teklif ve iletişim butonları." },
    { label: "Dönüşüm oranı", value: asPercent(summary?.conversionRate ?? 0), description: "Lead / PageView oranı." },
    { label: "Son olay zamanı", value: data?.lastSyncedAt ? new Date(data.lastSyncedAt).toLocaleString("tr-TR") : "Henüz yok", description: "Son senkron veya olay zamanı." }
  ];

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-700">Web Site Analitik Merkezi</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Web Site Analitiği</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Public HK Dijital web sitesindeki PageView (sayfa görüntüleme), Event (olay), Contact (iletişim) ve Lead (potansiyel müşteri) sinyallerini izlemek için güvenli yönetim merkezi.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${data?.status === "live" ? "bg-emerald-100 text-emerald-700" : data?.status === "partial" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>
              {statusLabel(data?.status)}
            </span>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-4 py-2 text-xs font-black text-white shadow-[0_8px_22px_rgba(6,182,212,.22)] transition hover:-translate-y-0.5 hover:bg-cyan-600 disabled:opacity-60"
            >
              <RefreshCcw size={15} /> {loading ? "Yenileniyor..." : "Yenile"}
            </button>
          </div>
        </div>
        {error && <p className="mt-5 rounded-[14px] border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
      </section>

      <WebsiteAnalyticsSummaryCards />

      <section className="rounded-[22px] border border-amber-200 bg-amber-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-amber-700">Eksik Entegrasyonlar</p>
            <h3 className="mt-2 text-xl font-black text-slate-950">
              {criticalMissing.length ? `${criticalMissing.length} gelişmiş ölçüm eksiği var` : "Temel ölçüm hazır görünüyor"}
            </h3>
            <p className="mt-1 text-sm leading-6 text-amber-900">
              Pixel ve GA4 public ölçüm varsa temel ölçüm çalışır. Meta Dataset ve Google servis hesabı gelişmiş server-side raporlama için gerekir.
            </p>
          </div>
          <a href="https://vercel.com/docs/projects/environment-variables" target="_blank" rel="noreferrer" className="rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-black text-amber-800">
            Vercel env rehberi
          </a>
        </div>
        {criticalMissing.length > 0 && <p className="mt-3 text-sm font-semibold text-amber-900">Öncelikli eksikler: {criticalMissing.slice(0, 6).join(", ")}</p>}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {overviewCards.map((card) => (
          <article key={card.label} className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <p className="text-sm font-black text-slate-700">{card.label}</p>
            <p className="mt-3 text-3xl font-black text-slate-950">{typeof card.value === "number" ? numberFormat.format(card.value) : card.value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{card.description}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-[16px] bg-sky-100 text-sky-700"><BarChart3 size={20} /></span>
            <div>
              <h3 className="text-lg font-black text-slate-950">Sayfa Performansı</h3>
              <p className="text-sm text-slate-500">Sayfa bazında görüntüleme ve dönüşüm katkısı.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            {(data?.pages || []).map((page) => (
              <div key={page.path} className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{page.label}</p>
                    <p className="text-xs font-semibold text-slate-500">{page.path}</p>
                  </div>
                  <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-black text-cyan-700">{asPercent(page.conversionRate)}</span>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <MiniMetric label="Görüntüleme" value={page.pageViews} />
                  <MiniMetric label="Contact katkısı" value={page.contacts} />
                  <MiniMetric label="Lead katkısı" value={page.leads} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-[16px] bg-emerald-100 text-emerald-700"><MousePointerClick size={20} /></span>
            <div>
              <h3 className="text-lg font-black text-slate-950">Dönüşümler</h3>
              <p className="text-sm text-slate-500">Event (olay) bazında mini trend hazırlığı.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            {(data?.events || []).map((event) => (
              <div key={event.id} className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-900">{event.label}</p>
                  <span className="text-lg font-black text-slate-950">{numberFormat.format(event.count)}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-cyan-500" style={{ width: `${Math.min(100, event.count * 8)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
        <div className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-[16px] bg-amber-100 text-amber-700"><Activity size={20} /></span>
            <div>
              <h3 className="text-lg font-black text-slate-950">Trafik Kaynakları</h3>
              <p className="text-sm text-slate-500">GA4 (Google Analytics 4) API bağlantısı sonrası gerçek veriyle dolacak.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            {(data?.sources || []).map((source) => (
              <div key={source.source} className="flex items-center justify-between gap-3 rounded-[16px] border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="font-black text-slate-950">{source.source}</p>
                  <p className="text-xs font-semibold text-slate-500">{source.status === "hazir" ? "Veri hazır" : "GA4 bağlantısı bekleniyor"}</p>
                </div>
                <div className="text-right text-xs font-bold text-slate-500">
                  <p>{numberFormat.format(source.pageViews)} görüntüleme</p>
                  <p>{numberFormat.format(source.leads)} lead</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-[16px] bg-violet-100 text-violet-700"><Settings2 size={20} /></span>
            <div>
              <h3 className="text-lg font-black text-slate-950">Kurulum Durumu</h3>
              <p className="text-sm text-slate-500">Gizli anahtarlar tarayıcıya gönderilmeden yalnızca durum olarak gösterilir.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {setupItems.map((item) => (
              <div key={item.label} className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  {item.ready ? <CheckCircle2 className="mt-0.5 text-emerald-600" size={18} /> : <XCircle className="mt-0.5 text-amber-600" size={18} />}
                  <div>
                    <p className="font-black text-slate-950">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                    <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-[11px] font-black ${item.ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{item.ready ? "Hazır" : "Eksik"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-[16px] border border-cyan-200 bg-cyan-50 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 text-cyan-700" size={19} />
              <div>
                <p className="font-black text-cyan-950">Güvenli veri mimarisi</p>
                <p className="mt-1 text-sm leading-6 text-cyan-800">META_ACCESS_TOKEN ve GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY gibi gizli değerler sadece server-side okunur. Client tarafına yalnızca kurulum durumu gönderilir.</p>
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            {(data?.recommendations || []).map((item) => (
              <p key={item} className="rounded-[14px] border border-slate-200 bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-600">{item}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-[16px] bg-cyan-100 text-cyan-700"><Settings2 size={20} /></span>
          <div>
            <h3 className="text-lg font-black text-slate-950">Veri Kaynakları ve Güvenli Env Kontrolü</h3>
            <p className="text-sm text-slate-500">Token, private key ve secret değerleri tarayıcıya gönderilmeden yalnızca durum olarak gösterilir.</p>
          </div>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          {[
            ["Meta", data?.integrationStatus?.meta || []],
            ["Google Analytics 4", data?.integrationStatus?.ga4 || []],
            ["Search Console", data?.integrationStatus?.searchConsole || []],
            ["Google Ads", data?.integrationStatus?.googleAds || []],
            ["Google Tag Manager", data?.integrationStatus?.tagManager || []],
            ["Microsoft Clarity", data?.integrationStatus?.clarity || []],
            ["Hotjar", data?.integrationStatus?.hotjar || []]
          ].map(([title, items]: any) => (
            <div key={title} className="rounded-[18px] border border-slate-200 p-4">
              <h4 className="mb-3 font-black text-slate-950">{title}</h4>
              <div className="grid gap-3">{items.map((item: AnalyticsStatusItem) => <IntegrationCard key={item.key} item={item} />)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-[16px] bg-emerald-100 text-emerald-700"><BarChart3 size={20} /></span>
          <div>
            <h3 className="text-lg font-black text-slate-950">Müşteri Entegrasyon Durumu</h3>
            <p className="text-sm text-slate-500">Her müşterinin domain, Meta, Google, GA4, Google Ads ve davranış analitiği hazırlığını özetler.</p>
          </div>
        </div>
        <div className="grid gap-3">
          {(data?.customerIntegrations || []).map((item) => (
            <article key={item.companyId} className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black text-slate-950">{item.companyName}</p>
                  <p className="text-xs font-semibold text-slate-500">{item.domain || "Domain girilmedi"} · Son kontrol: {item.lastCheckedAt ? new Date(item.lastCheckedAt).toLocaleString("tr-TR") : "Henüz yok"}</p>
                </div>
                <a href={`/hk-admin/musteriler?companyId=${item.companyId}&tab=integrations`} className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-4 py-2 text-xs font-black text-white">
                  Müşteri Profilinde Düzenle <ExternalLink size={13} />
                </a>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-5">
                <MiniStatus label="Kurulum" value={`%${item.setupProgress}`} status={item.setupProgress >= 70 ? "ready" : "missing"} />
                <MiniStatus label="Meta" value={integrationStatusLabel(item.metaStatus)} status={item.metaStatus} />
                <MiniStatus label="GA4" value={integrationStatusLabel(item.ga4Status)} status={item.ga4Status} />
                <MiniStatus label="Google Ads" value={integrationStatusLabel(item.googleAdsStatus)} status={item.googleAdsStatus} />
                <MiniStatus label="Clarity/Hotjar" value={integrationStatusLabel(item.behaviorStatus)} status={item.behaviorStatus} />
              </div>
            </article>
          ))}
          {!data?.customerIntegrations?.length && <p className="rounded-[16px] border border-dashed border-slate-200 p-5 text-sm font-semibold text-slate-500">Henüz müşteri entegrasyon kaydı yok. Müşteri profilindeki Entegrasyonlar sekmesinden başlayın.</p>}
        </div>
      </section>

      <section className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <h3 className="text-lg font-black text-slate-950">Kurulum Rehberi</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {[
            ["Meta Dataset ID nasıl alınır?", "Meta Business > Events Manager > Pixel/Dataset > Settings alanından Dataset ID değerini kopyalayıp Vercel Environment Variables içine META_DATASET_ID olarak ekleyin."],
            ["Google servis hesabı nasıl oluşturulur?", "Google Cloud Console’da servis hesabı oluşturun, Analytics Data API’yi etkinleştirin, client_email/private_key/project_id değerlerini Vercel’e ekleyin ve GA4 Property Access Management alanında yetki verin."],
            ["Search Console nasıl bağlanır?", "GOOGLE_SEARCH_CONSOLE_SITE_URL env değerini ekleyin, servis hesabı mailine property yetkisi verin ve Search Console API erişimini aktif edin."],
            ["Google Ads nasıl bağlanır?", "GOOGLE_ADS_CUSTOMER_ID, developer token, OAuth Client ID/Secret ve refresh token gerekir. MCC kullanıyorsanız LOGIN_CUSTOMER_ID ekleyin."],
            ["Vercel redeploy uyarısı", "Environment Variable ekledikten sonra Vercel’de Redeploy yapmalısın. Aksi halde yeni değerler production runtime’a geçmez."],
            ["Private key formatı", "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY çok satırlı olabilir; Vercel’de newline karakterleri \\n olarak saklanabilir."]
          ].map(([title, text]) => (
            <div key={title} className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
              <p className="font-black text-slate-950">{title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MiniStatus({ label, value, status }: { label: string; value: string; status: AnalyticsCheckStatus }) {
  return (
    <div className="rounded-[12px] bg-white p-3">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className={`mt-2 inline-flex rounded-full px-3 py-1 text-[11px] font-black ${integrationStatusClass(status)}`}>{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[14px] bg-white p-3">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950">{numberFormat.format(value)}</p>
    </div>
  );
}
