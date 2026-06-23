"use client";

import { useEffect, useState } from "react";
import { BarChart3, ExternalLink, MousePointerClick, PhoneCall, Target, TrendingUp } from "lucide-react";
import type { WebsiteAnalyticsResponse } from "@/lib/website-analytics";

const formatter = new Intl.NumberFormat("tr-TR");

function percent(value: number) {
  return `%${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value || 0)}`;
}

export function WebsiteAnalyticsSummaryCards({ onOpen }: { onOpen?: () => void }) {
  const [data, setData] = useState<WebsiteAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/admin/website-analytics", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Website Analytics verisi alınamadı.");
        if (mounted) setData(payload);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Website Analytics verisi alınamadı.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const summary = data?.summary;
  const items = [
    { label: "Bugünkü Sayfa Görüntüleme", value: summary?.todayPageViews ?? 0, note: "Bugün public sitede ölçülen PageView (sayfa görüntüleme).", icon: <BarChart3 size={18} />, tone: "bg-sky-100 text-sky-700" },
    { label: "Son 7 Gün PageView", value: summary?.last7DaysPageViews ?? 0, note: "Son 7 günlük toplam sayfa görüntüleme.", icon: <TrendingUp size={18} />, tone: "bg-cyan-100 text-cyan-700" },
    { label: "WhatsApp / Contact Tıklaması", value: summary?.contacts ?? 0, note: "Contact (iletişim) ve WhatsApp tıklamaları.", icon: <PhoneCall size={18} />, tone: "bg-emerald-100 text-emerald-700" },
    { label: "Lead Sayısı", value: summary?.leads ?? 0, note: "Başarılı form ve teklif/demoya dönüşen lead kayıtları.", icon: <Target size={18} />, tone: "bg-amber-100 text-amber-700" },
    { label: "Dönüşüm Oranı", value: percent(summary?.conversionRate ?? 0), note: "Lead / PageView oranı.", icon: <MousePointerClick size={18} />, tone: "bg-violet-100 text-violet-700" },
    { label: "En Çok Ziyaret Edilen Sayfa", value: summary?.topPage || "/", note: "En yüksek PageView alan public sayfa.", icon: <ExternalLink size={18} />, tone: "bg-rose-100 text-rose-700" }
  ];

  const hasData = summary && Object.values({
    todayPageViews: summary.todayPageViews,
    last7DaysPageViews: summary.last7DaysPageViews,
    contacts: summary.contacts,
    leads: summary.leads,
    ctaClicks: summary.ctaClicks
  }).some((value) => Number(value) > 0);

  return (
    <section className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Web Site Analitiği</p>
          <h3 className="mt-1 text-lg font-black text-slate-950">Public site ölçüm özeti</h3>
          <p className="mt-1 text-sm text-slate-600">Meta Pixel ve GA4 (Google Analytics 4) verileri için yönetim özeti.</p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-black text-white shadow-[0_8px_22px_rgba(6,182,212,.22)] transition hover:-translate-y-0.5 hover:bg-cyan-600"
        >
          Merkezi Aç
        </button>
      </div>
      {loading && <p className="rounded-[14px] border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">Website Analytics verileri hazırlanıyor...</p>}
      {error && <p className="rounded-[14px] border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
      {!loading && !error && (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {items.map((item) => (
              <article key={item.label} className="min-w-0 rounded-[16px] border border-slate-200 bg-slate-50 p-4">
                <span className={`grid size-10 place-items-center rounded-[14px] ${item.tone}`}>{item.icon}</span>
                <p className="mt-4 truncate text-2xl font-black text-slate-950">{typeof item.value === "number" ? formatter.format(item.value) : item.value}</p>
                <h4 className="mt-1 text-sm font-black text-slate-800">{item.label}</h4>
                <p className="mt-2 text-xs leading-5 text-slate-500">{item.note}</p>
              </article>
            ))}
          </div>
          {!hasData && <p className="mt-4 rounded-[14px] border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">Henüz yeterli veri yok. Pixel ve GA4 verileri geldikçe burada görünecek.</p>}
        </>
      )}
    </section>
  );
}
