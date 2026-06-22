"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, CheckCircle2, MousePointerClick, RefreshCcw, Settings2, ShieldCheck, XCircle } from "lucide-react";
import type { WebsiteAnalyticsResponse } from "@/lib/website-analytics";
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
            <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-700">Website Analytics Center</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Website Analytics</h2>
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
