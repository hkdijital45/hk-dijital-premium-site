/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { BarChart3, FileText, Lightbulb, MessageCircle, Sparkles, UserRound } from "lucide-react";
import { getSession, isCustomerRole, isStaffRole } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { getCustomerCenterData, summarizeMetrics } from "@/lib/customer-center";
import { hasSupabaseConfig } from "@/lib/supabase";
import { CustomerReports } from "@/components/customer/CustomerReports";
import { AnimatedChart, CustomerMetricCard, GlassCard } from "@/components/premium/PremiumUI";
import { Logo } from "@/components/public/Logo";
import { getSiteContent } from "@/lib/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HK Dijital Marketing Center",
  description: "Reklam çalışmalarınızı, süreç notlarınızı ve performans özetlerinizi tek ekrandan takip edin."
};

function MetricCard({ title, value, help }: { title: string; value: string | number; help: string }) {
  return <CustomerMetricCard title={title} value={value} help={help} />;
}

export default async function MusteriPaneliPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/digital-center");
  const params = await searchParams;
  const isAdminPreview = isStaffRole(session.role) && Boolean(params.company);
  if (!isCustomerRole(session.role) && !isAdminPreview) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#050711] px-4 text-white">
        <div className="max-w-md rounded-[8px] border border-white/10 bg-white/[0.06] p-6 text-center">
          <h1 className="text-2xl font-black">Bu sayfaya erişim yetkiniz yok.</h1>
          <a href="/digital-center" className="mt-5 inline-flex rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">Digital Center’a dön</a>
        </div>
      </main>
    );
  }

  const selectedCompanyId = isAdminPreview ? params.company : session.companyId;
  const siteContent = await getSiteContent();
  const data = await getCustomerCenterData(selectedCompanyId);
  if (isCustomerRole(session.role)) {
    await recordActivity({
      session,
      action: "Görüntüleme",
      entity: "Müşteri Paneli",
      companyId: selectedCompanyId,
      details: { message: "Müşteri panelini görüntüledi" }
    });
  }
  const totals = summarizeMetrics(data.metrics);
  const visibility = data.visibility;
  const reportVisibility = data.customerReportVisibility || [];
  const canShowReport = (sectionKey: string, metricKey = "__section") => {
    const rule = reportVisibility.find((item: any) => item.section_key === sectionKey && item.metric_key === metricKey);
    return rule?.is_visible ?? true;
  };
  const hasCompany = Boolean(selectedCompanyId && data.company);
  const visibleUpdates = visibility.show_strategy_notes ? data.updates : data.updates.filter((update) => update.update_type !== "Strateji Notu");
  const latestUpdate = visibleUpdates[0];
  const branding = data.branding || {};
  const portalName = branding.brand_name || data.company?.name || "HK Dijital";
  const portalTitle = `${portalName} Digital Center`;
  const welcomeText = branding.welcome_text || "Performans raporlarınız, kampanya notlarınız ve dijital büyüme verileriniz burada.";
  const paymentSummary = data.payments.reduce((total, item) => ({ paid: total.paid + (item.status === "Ödendi" ? Number(item.amount || 0) : 0), pending: total.pending + (item.status !== "Ödendi" && item.status !== "İptal" ? Number(item.amount || 0) : 0) }), { paid: 0, pending: 0 });
  const visibleTimeline = [
    ...data.campaigns.map((item) => ({ date: item.updated_at || item.created_at || item.start_date, title: "Kampanya güncellendi", text: `${item.name || "Kampanya"} · ${item.status || "Durum yok"}` })),
    ...data.reports.map((item) => ({ date: item.created_at || item.report_date || item.endDate, title: "Rapor yayınlandı", text: item.report_type || "Müşteri raporu" })),
    ...data.monthlyReports.map((item) => ({ date: item.report_month, title: "Aylık rapor hazır", text: item.summary || "Aylık performans özeti" })),
    ...data.documents.map((item) => ({ date: item.document_date || item.created_at, title: "Belge eklendi", text: item.title || item.document_type || "Belge" })),
    ...visibleUpdates.map((item) => ({ date: item.created_at || item.update_date, title: item.title || "Ajans notu", text: item.next_step || item.description || item.update_type || "Güncelleme" })),
    ...data.payments.map((item) => ({ date: item.payment_date || item.due_date || item.created_at, title: item.status === "Ödendi" ? "Ödeme alındı" : "Ödeme kaydı", text: `${item.service_period || "Hizmet dönemi"} · ${item.status || "Bekliyor"}` }))
  ].filter((item) => item.date).sort((a, b) => Number(new Date(b.date)) - Number(new Date(a.date))).slice(0, 8);
  const nextSteps = visibleUpdates.filter((item) => item.next_step).slice(0, 4);
  const activeCampaigns = data.campaigns.filter((item) => item.status === "Aktif");

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050711] text-white">
      <div className="premium-grid pointer-events-none absolute inset-0 opacity-45" />
      <header className="relative border-b border-white/10 bg-[#050711]/90 px-4 py-5 shadow-[0_16px_48px_rgba(0,0,0,.2)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {branding.logo_url ? <Image src={branding.logo_url} alt={`${portalName} logosu`} width={170} height={48} unoptimized className="h-12 max-w-[170px] rounded-[8px] object-contain" /> : <Logo content={siteContent} compact />}
            <div>
            <p className="text-sm font-bold uppercase tracking-[.22em] text-cyan-200">Müşteri Performans Merkezi</p>
            <h1 className="mt-2 text-3xl font-black">{portalTitle}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{welcomeText}</p>
            </div>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="rounded-full border border-white/10 px-5 py-3 text-sm font-bold">Çıkış Yap</button>
          </form>
        </div>
      </header>

      <div className="relative mx-auto max-w-7xl px-4 py-8">
        {!hasSupabaseConfig() && (
          <div className="mb-6 rounded-[8px] border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
            Panel verileri şu anda yüklenemiyor. Lütfen kısa süre sonra yeniden deneyin veya HK Dijital ile iletişime geçin.
          </div>
        )}

        {!hasCompany && (
          <div className="mb-6 rounded-[8px] border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
            Hesabınıza henüz bir firma atanmamış. Müşteri paneli verilerinin görünmesi için HK Dijital Kontrol Merkezi üzerinden firma ataması yapılmalıdır.
          </div>
        )}

        {isAdminPreview && (
          <div className="mb-6 rounded-[8px] border border-cyan-200/30 bg-cyan-200/10 p-4 text-sm text-cyan-100">
            Yönetici önizlemesi: Bu ekran seçilen müşterinin göreceği bilgilerle hazırlanmıştır.
          </div>
        )}

        <nav className="mb-6 flex flex-wrap gap-2 rounded-[8px] border border-white/10 bg-white/[0.04] p-3 text-sm font-bold">
          {visibility.show_metrics && <a href="#performans" className="rounded-full border border-cyan-200/20 px-4 py-2 text-cyan-100 hover:bg-cyan-200/10">Performans</a>}
          {data.reports.length > 0 || data.monthlyReports.length > 0 ? <a href="#raporlar" className="rounded-full border border-cyan-200/20 px-4 py-2 text-cyan-100 hover:bg-cyan-200/10">Raporlar</a> : null}
          {data.campaigns.length > 0 ? <a href="#kampanyalar" className="rounded-full border border-cyan-200/20 px-4 py-2 text-cyan-100 hover:bg-cyan-200/10">Kampanyalar</a> : null}
          {visibility.show_work_updates && <a href="#notlar" className="rounded-full border border-cyan-200/20 px-4 py-2 text-cyan-100 hover:bg-cyan-200/10">Notlar</a>}
          {(visibility.show_files || data.documents.length > 0) && <a href="#belgeler" className="rounded-full border border-cyan-200/20 px-4 py-2 text-cyan-100 hover:bg-cyan-200/10">Belgeler</a>}
          {data.payments.length > 0 && <a href="#odemeler" className="rounded-full border border-amber-200/20 px-4 py-2 text-amber-100 hover:bg-amber-200/10">Ödemeler</a>}
        </nav>

        <section className="glass-card mb-8 overflow-hidden p-6 sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-100">Hoş geldiniz</p>
              <h2 className="mt-3 text-3xl font-black">{portalTitle}</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">{welcomeText}</p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-black text-emerald-100"><Sparkles size={15} /> {data.campaigns[0]?.status || "Raporlama hazırlanıyor"}</div>
            </div>
            <AnimatedChart label="Son dönem performans eğilimi" values={[24, 29, 41, 38, 54, 61, 72, 79]} />
          </div>
        </section>

        <section className="mb-8 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <GlassCard className="p-5">
            <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-100">Customer Portal 2.0</p>
            <h2 className="mt-2 text-2xl font-black">Bu ayki operasyon özeti</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard title="Bu ay performans" value={totals.impressions ? `${totals.impressions.toLocaleString("tr-TR")} gösterim` : "Veri yok"} help="Müşteriye görünür metriklerden hesaplanır." />
              <MetricCard title="Aktif kampanya" value={activeCampaigns.length} help="Sadece müşteriye görünür kampanyalar listelenir." />
              <MetricCard title="Yayınlanan rapor" value={data.reports.length + data.monthlyReports.length} help="Müşteri paneline açık raporlar." />
              <MetricCard title="Görünür belge" value={data.documents.length + data.files.length} help="Sadece görünür olarak işaretlenen belgeler." />
            </div>
            <div className="mt-5 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-4">
              <p className="font-black text-cyan-50">Sonraki adımlar</p>
              <div className="mt-3 grid gap-2">
                {nextSteps.map((item) => <p key={item.id} className="rounded-[8px] bg-black/20 p-3 text-sm leading-6 text-cyan-50">{item.next_step}</p>)}
                {!nextSteps.length && <p className="text-sm text-cyan-100/80">Henüz görünür sonraki adım eklenmedi. Raporlar ve ajans notları yayınlandıkça burada görünür.</p>}
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-5">
            <h2 className="text-xl font-black">Son görünür hareketler</h2>
            <div className="mt-5 grid gap-3">
              {visibleTimeline.map((item, index) => <div key={`${item.title}-${index}`} className="rounded-[8px] border border-white/10 bg-black/20 p-3"><p className="text-xs font-black text-cyan-100">{item.date ? new Date(item.date).toLocaleDateString("tr-TR") : "Tarih yok"}</p><p className="mt-1 font-black">{item.title}</p><p className="mt-1 text-sm leading-6 text-slate-300">{item.text}</p></div>)}
              {!visibleTimeline.length && <p className="rounded-[8px] border border-dashed border-white/10 p-4 text-sm text-slate-400">Henüz müşteriye görünür hareket bulunmuyor.</p>}
            </div>
          </GlassCard>
        </section>

        {visibility.show_metrics && canShowReport("overview") && <section id="performans" className="grid scroll-mt-28 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {canShowReport("metrics", "impressions") && <MetricCard title="Reklamınız kaç kez gösterildi" value={totals.impressions} help="Reklamınızın ekranda toplam görüntülenme sayısıdır." />}
          {canShowReport("metrics", "reach") && <MetricCard title="Reklamınız kaç kişiye ulaştı" value={totals.reach} help={`Reklamınız bu ay ${totals.reach} kişiye ulaştı.`} />}
          {canShowReport("metrics", "clicks") && <MetricCard title="Reklamlarınıza gelen tıklama" value={totals.clicks} help={`Reklamlarınıza ${totals.clicks} tıklama geldi.`} />}
          {canShowReport("metrics", "messages") && <MetricCard title="Mesaj başlatma" value={totals.messages || 0} help={`Bu süreçte ${totals.messages || 0} kişi mesaj ile iletişime geçti.`} />}
          {visibility.show_leads && canShowReport("metrics", "leads") && <MetricCard title="Potansiyel müşteri" value={totals.leads} help={`Bu süreçte ${totals.leads} potansiyel müşteri oluştu.`} />}
          {visibility.show_spent && canShowReport("metrics", "spend") && <MetricCard title="Harcanan reklam bütçesi" value={`${totals.spent} TL`} help="Reklam platformlarında kullanılan toplam bütçedir." />}
          {visibility.show_spent && canShowReport("metrics", "cpc") && <MetricCard title="Ortalama tıklama maliyeti" value={`${totals.cpc} TL`} help="CPC: Reklam tıklaması başına ortalama maliyeti gösterir." />}
          {visibility.show_leads && visibility.show_spent && canShowReport("metrics", "leads") && <MetricCard title="Ortalama potansiyel müşteri maliyeti" value={`${totals.cost_per_lead} TL`} help="Bir potansiyel müşteri kaydı için ortalama reklam maliyetidir." />}
          <MetricCard title="Kampanya durumu" value={data.campaigns[0]?.status || "Hazırlanıyor"} help="Kampanya durumu, aktif çalışma aşamasını özetler." />
        </section>}

        <section id="kampanyalar" className="mt-8 grid scroll-mt-28 gap-6 lg:grid-cols-[1.1fr_.9fr]">
          {visibility.show_campaigns && canShowReport("campaigns") && (
            <GlassCard className="p-5">
              <h2 className="flex items-center gap-2 text-xl font-black"><BarChart3 className="text-cyan-200" /> Reklam Performansı</h2>
              <div className="mt-5 grid gap-3">
                {data.campaigns.map((campaign) => {
                  const totalBudget = Number(campaign.total_budget ?? campaign.budget ?? 0);
                  const spentBudget = Number(campaign.spent_budget ?? campaign.spent ?? 0);
                  return (
                    <div key={campaign.id} className="rounded-[8px] bg-black/25 p-4">
                      <p className="font-black">{campaign.name}</p>
                      <p className="mt-1 text-sm text-slate-400">{campaign.platform} · {campaign.objective}{canShowReport("metrics", "lifecycle_status") ? ` · ${campaign.status}` : ""}</p>
                      {(canShowReport("metrics", "lifecycle_start") || canShowReport("metrics", "lifecycle_end") || canShowReport("metrics", "lifecycle_days_remaining")) && <p className="mt-2 text-xs text-slate-400">
                        {canShowReport("metrics", "lifecycle_start") && `Başlangıç: ${campaign.meta_start_time || campaign.start_date || "Veri yok"} · `}
                        {canShowReport("metrics", "lifecycle_end") && `Bitiş: ${campaign.meta_stop_time || campaign.end_date || "Veri yok"} · `}
                        {canShowReport("metrics", "lifecycle_days_remaining") && `Gün kaldı: ${campaign.days_remaining ?? "Veri yok"}`}
                      </p>}
                      <div className="mt-3 h-2 rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.min(100, totalBudget ? (spentBudget / totalBudget) * 100 : 0)}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-slate-400">
                        {visibility.show_budget && `Bütçe: ${totalBudget} TL · `}
                        {visibility.show_spent && `Harcama: ${spentBudget} TL · `}
                        {campaign.notes}
                      </p>
                    </div>
                  );
                })}
                {!data.campaigns.length && <p className="rounded-[8px] border border-dashed border-white/10 p-5 text-sm text-slate-400">Henüz görüntülenebilir kampanya bulunmuyor.</p>}
              </div>
            </GlassCard>
          )}

          <GlassCard className="p-5">
            <h2 className="flex items-center gap-2 text-xl font-black"><Lightbulb className="text-cyan-200" /> Sıradaki Önerilen Adım</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">{visibleUpdates.find((update) => update.next_step)?.next_step || "Veriler düzenli güncellendikçe kampanya bütçesi, kreatif denemeleri ve müşteri yolculuğu için sonraki adım burada netleştirilir."}</p>
            <p className="mt-4 border-t border-white/10 pt-4 text-sm leading-6 text-slate-400">Son çalışma: {latestUpdate?.title || "Henüz çalışma notu eklenmedi."}</p>
          </GlassCard>
        </section>

        {visibility.show_work_updates && (
          <section id="notlar" className="glass-card mt-8 scroll-mt-28 p-5">
            <h2 className="text-xl font-black">Yapılan Çalışmalar ve Strateji Notları</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {visibleUpdates.map((update) => (
                <div key={update.id} className="rounded-[8px] bg-black/25 p-4">
                  <p className="text-sm font-bold text-cyan-100">{update.update_type}</p>
                  <h3 className="mt-2 font-black">{update.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{update.description}</p>
                  {update.why_it_matters && <p className="mt-2 text-sm leading-6 text-slate-400">Neden önemli: {update.why_it_matters}</p>}
                  {update.next_step && <p className="mt-2 text-sm leading-6 text-cyan-100">Sıradaki adım: {update.next_step}</p>}
                  <p className="mt-3 text-xs text-slate-500">{new Date(update.created_at).toLocaleDateString("tr-TR")}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {visibility.show_metrics && <section id="raporlar" className="scroll-mt-28"><CustomerReports reports={data.reports} initialInterpretations={data.interpretations} reportUpdates={data.reportUpdates} visibilityRules={reportVisibility} /></section>}

        {(canShowReport("adsets") || canShowReport("ads") || canShowReport("conversions") || canShowReport("video") || canShowReport("analysis")) && (
          <section className="glass-card mt-8 scroll-mt-28 p-5">
            <h2 className="text-xl font-black">Meta Gelişmiş Reklam Verileri</h2>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {canShowReport("adsets") && <div className="rounded-[8px] border border-white/10 bg-black/25 p-4">
                <h3 className="font-black">Reklam Setleri</h3>
                <div className="mt-3 grid gap-2">{data.metaAdsetMetrics.slice(0, 5).map((item: any) => <p key={item.id} className="text-sm text-slate-300">{item.adset_name || "Reklam seti"} · {item.status || "-"} · {canShowReport("metrics", "lifecycle_days_remaining") ? `Gün kaldı: ${item.days_remaining ?? "Veri yok"}` : `${Number(item.spend || 0).toLocaleString("tr-TR")} TL`}</p>)}{!data.metaAdsetMetrics.length && <p className="text-sm text-slate-400">Bu veri henüz çekilmedi veya Meta tarafından sağlanmadı.</p>}</div>
              </div>}
              {canShowReport("ads") && <div className="rounded-[8px] border border-white/10 bg-black/25 p-4">
                <h3 className="font-black">Reklamlar / Kreatifler</h3>
                <div className="mt-3 grid gap-2">{data.metaAdMetrics.slice(0, 5).map((item: any) => <p key={item.id} className="text-sm text-slate-300">{item.ad_name || "Reklam"} · CTR {Number(item.ctr || 0).toFixed(2)}% {canShowReport("metrics", "roas") ? `· ROAS ${Number(item.roas || 0).toFixed(2)}` : ""}</p>)}{!data.metaAdMetrics.length && <p className="text-sm text-slate-400">Bu veri henüz çekilmedi veya Meta tarafından sağlanmadı.</p>}</div>
              </div>}
              {canShowReport("conversions") && <div className="rounded-[8px] border border-white/10 bg-black/25 p-4">
                <h3 className="font-black">Dönüşümler</h3>
                <div className="mt-3 grid gap-2">{data.metaConversionEvents.slice(0, 5).map((item: any) => <p key={item.id} className="text-sm text-slate-300">{item.event_name} · {Number(item.event_count || 0).toLocaleString("tr-TR")} · {Number(item.cost_per_event || 0).toFixed(2)} TL</p>)}{!data.metaConversionEvents.length && <p className="text-sm text-slate-400">Bu veri henüz çekilmedi veya Meta tarafından sağlanmadı.</p>}</div>
              </div>}
              {canShowReport("analysis") && <div className="rounded-[8px] border border-white/10 bg-black/25 p-4">
                <h3 className="font-black">HK Intelligence Analizi</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{data.metaAnalysisSnapshots[0]?.ai_summary || data.metaAnalysisSnapshots[0]?.funnel_diagnosis || "Bu veri henüz çekilmedi veya Meta tarafından sağlanmadı."}</p>
              </div>}
            </div>
          </section>
        )}

        {data.monthlyReports.length > 0 && (
          <section id={visibility.show_metrics ? undefined : "raporlar"} className="glass-card mt-8 scroll-mt-28 p-5">
            <h2 className="text-xl font-black">Aylık Raporlar</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {data.monthlyReports.map((report) => (
                <div key={report.id} className="rounded-[8px] border border-white/10 bg-black/25 p-4">
                  <p className="text-xs font-black uppercase tracking-[.14em] text-cyan-100">{report.report_month}</p>
                  <h3 className="mt-2 font-black">{data.company?.name || "Müşteri"} aylık performans özeti</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{report.summary || "Bu ay için özet hazırlanıyor."}</p>
                  {report.ai_interpretation && <p className="mt-3 rounded-[8px] bg-cyan-300/10 p-3 text-sm leading-6 text-cyan-50">{report.ai_interpretation}</p>}
                  {report.next_month_recommendations && <p className="mt-3 text-sm leading-6 text-slate-300">Önümüzdeki ay: {report.next_month_recommendations}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {visibility.show_files && (
          <section id="belgeler" className="glass-card mt-8 scroll-mt-28 p-5">
            <h2 className="flex items-center gap-2 text-xl font-black"><FileText className="text-cyan-200" /> Dosyalar</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {data.files.map((file) => (
                <a key={file.id} href={`/api/customer/files/${file.id}`} target="_blank" className="rounded-[8px] bg-black/25 p-4 text-sm font-bold text-cyan-100">
                  {file.title}
                </a>
              ))}
              {!data.files.length && <p className="text-sm text-slate-400">Henüz görünür dosya yok.</p>}
            </div>
          </section>
        )}

        {data.documents.length > 0 && (
          <section id={visibility.show_files ? undefined : "belgeler"} className="glass-card mt-8 scroll-mt-28 p-5">
            <h2 className="flex items-center gap-2 text-xl font-black"><FileText className="text-cyan-200" /> Belgeler</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {data.documents.map((document) => (
                <a key={document.id} href={document.document_url || "#"} target="_blank" rel="noreferrer" className="rounded-[8px] border border-white/10 bg-black/25 p-4 text-sm">
                  <span className="block text-xs font-black uppercase tracking-[.14em] text-cyan-100">{document.document_type}</span>
                  <span className="mt-2 block font-black text-white">{document.title}</span>
                  <span className="mt-2 block text-xs text-slate-400">{document.document_date ? new Date(document.document_date).toLocaleDateString("tr-TR") : "Tarih yok"}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        {data.payments.length > 0 && (
          <section id="odemeler" className="glass-card mt-8 scroll-mt-28 p-5">
            <h2 className="text-xl font-black">Ödeme Durumu</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-[8px] border border-emerald-300/20 bg-emerald-300/10 p-4"><p className="text-sm text-emerald-100">Ödenen toplam</p><p className="mt-2 text-2xl font-black">{paymentSummary.paid.toLocaleString("tr-TR")} TL</p></div>
              <div className="rounded-[8px] border border-amber-300/20 bg-amber-300/10 p-4"><p className="text-sm text-amber-100">Bekleyen toplam</p><p className="mt-2 text-2xl font-black">{paymentSummary.pending.toLocaleString("tr-TR")} TL</p></div>
            </div>
            <div className="mt-4 grid gap-2">
              {data.payments.map((payment) => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-white/10 bg-black/20 p-3 text-sm"><span>{payment.service_period || "Hizmet dönemi"} · {payment.status}</span><span className="font-black">{Number(payment.amount || 0).toLocaleString("tr-TR")} TL</span></div>)}
            </div>
          </section>
        )}

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {visibility.show_contact_person && (
          <GlassCard className="p-5">
            <h2 className="flex items-center gap-2 text-xl font-black"><MessageCircle className="text-cyan-200" /> İletişim</h2>
            <p className="mt-3 text-sm text-slate-300">Raporlar veya kampanya notları için HK Dijital ile iletişime geçebilirsiniz.</p>
            <a href="/iletisim" className="mt-4 inline-flex rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950">HK Dijital ile iletişime geçin</a>
          </GlassCard>
          )}
          <GlassCard className="p-5">
            <h2 className="flex items-center gap-2 text-xl font-black"><UserRound className="text-cyan-200" /> Hesabım</h2>
            <p className="mt-3 text-sm text-slate-300">{session.fullName} · {data.company?.name || "Şirket ataması bekleniyor"}</p>
          </GlassCard>
        </section>
      </div>
    </main>
  );
}
