/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { BarChart3, Download, FileText, Lightbulb, MessageCircle, Sparkles, UserRound } from "lucide-react";
import { getSession, isCustomerRole, isStaffRole } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { getCustomerCenterData, summarizeMetrics } from "@/lib/customer-center";
import { hasSupabaseConfig } from "@/lib/supabase";
import { CustomerReports } from "@/components/customer/CustomerReports";
import { AnimatedChart, CustomerMetricCard } from "@/components/premium/PremiumUI";
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
      <main className="grid min-h-screen place-items-center bg-[#f7f8fb] px-4 text-slate-950">
        <div className="max-w-md rounded-[18px] border border-slate-200 bg-white p-6 text-center shadow-[0_10px_30px_rgba(15,23,42,.06)]">
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
  const portalTitle = branding.report_title || `${portalName} Digital Center`;
  const welcomeText = branding.welcome_text || "Performans raporlarınız, kampanya notlarınız ve dijital büyüme verileriniz burada.";
  const brandAccentColor = branding.brand_accent_color || branding.primary_color || "#0891b2";
  const contactWhatsapp = String(branding.contact_whatsapp || "").replace(/\D/g, "");
  const contactHref = contactWhatsapp ? `https://wa.me/${contactWhatsapp}` : branding.contact_email ? `mailto:${branding.contact_email}` : branding.contact_phone ? `tel:${branding.contact_phone}` : "/iletisim";
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
  const ctrValue = totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : "0.00";
  const latestReportDate = data.reports[0]?.created_at || data.monthlyReports[0]?.report_month;
  const getCustomerFileUrl = (file: any) => file.file_url || file.document_url || file.url || "";
  const getCustomerFileType = (file: any) => file.file_type || file.document_type || file.type || "Diğer";
  const imageTypeLabels = ["Görsel", "Reklam Görseli", "Kreatif"];
  const isImageFile = (file: any) => {
    const url = getCustomerFileUrl(file);
    const type = getCustomerFileType(file);
    return imageTypeLabels.includes(type) || /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(url);
  };
  const isPdfFile = (file: any) => getCustomerFileType(file).toLocaleLowerCase("tr").includes("pdf") || /\.pdf(\?|$)/i.test(getCustomerFileUrl(file));
  const isVideoFile = (file: any) => getCustomerFileType(file).toLocaleLowerCase("tr").includes("video") || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(getCustomerFileUrl(file));
  const fileButtonLabel = (file: any) => {
    if (isPdfFile(file)) return "PDF Aç";
    if (isVideoFile(file)) return "Videoyu Aç";
    if (isImageFile(file)) return "Görseli Aç";
    return "Dosyayı Aç";
  };
  const creativeFiles = data.files.filter((file: any) => file.visible_to_customer !== false && (file.show_in_creative_center || imageTypeLabels.includes(getCustomerFileType(file))));
  const fileUpdatedLabel = (file: any) => file.updated_at || file.uploaded_at || file.created_at ? new Date(file.updated_at || file.uploaded_at || file.created_at).toLocaleDateString("tr-TR") : "Tarih yok";

  return (
    <main className="customer-portal relative min-h-screen overflow-hidden bg-[#f7f8fb] text-slate-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,.18),transparent_32%),radial-gradient(circle_at_78%_10%,rgba(250,204,21,.14),transparent_28%)]" />
      <header className="relative border-b border-slate-200 bg-white px-4 py-5 shadow-[0_8px_30px_rgba(15,23,42,.06)]">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {branding.logo_url ? <Image src={branding.logo_url} alt={`${portalName} logosu`} width={170} height={48} unoptimized className="h-12 max-w-[170px] rounded-[8px] object-contain" /> : <Logo content={siteContent} compact />}
            <div>
            <p className="text-sm font-bold uppercase tracking-[.22em] text-cyan-700">Müşteri Performans Merkezi</p>
            <h1 className="mt-2 text-3xl font-black">Performans Merkeziniz</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Reklam, rapor, çalışma notları ve dosyalarınızı tek yerden takip edin.</p>
            </div>
          </div>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-cyan-200 hover:text-cyan-700">Çıkış Yap</button>
          </form>
        </div>
      </header>

      <div className="relative mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        {!hasSupabaseConfig() && (
          <div className="mb-6 rounded-[14px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Panel verileri şu anda yüklenemiyor. Lütfen kısa süre sonra yeniden deneyin veya HK Dijital ile iletişime geçin.
          </div>
        )}

        {!hasCompany && (
          <div className="mb-6 rounded-[14px] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            Hesabınıza henüz bir firma atanmamış. Müşteri paneli verilerinin görünmesi için HK Dijital Kontrol Merkezi üzerinden firma ataması yapılmalıdır.
          </div>
        )}

        {isAdminPreview && (
          <div className="mb-6 rounded-[14px] border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-800">
            Yönetici önizlemesi: Bu ekran seçilen müşterinin göreceği bilgilerle hazırlanmıştır.
          </div>
        )}

        <nav className="mb-6 flex flex-wrap gap-2 rounded-[18px] border border-slate-200 bg-white p-3 text-sm font-bold shadow-[0_8px_30px_rgba(15,23,42,.05)]">
          {visibility.show_metrics && <a href="#performans" className="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-cyan-800 hover:bg-cyan-100">Performans</a>}
          {data.reports.length > 0 || data.monthlyReports.length > 0 ? <a href="#raporlar" className="rounded-full border border-slate-200 px-4 py-2 text-slate-700 hover:border-cyan-200 hover:bg-cyan-50">Raporlar</a> : null}
          {visibility.show_files && <a href="#kreatif-merkezi" className="rounded-full border border-slate-200 px-4 py-2 text-slate-700 hover:border-cyan-200 hover:bg-cyan-50">Kreatif Merkezi</a>}
          {data.campaigns.length > 0 ? <a href="#kampanyalar" className="rounded-full border border-slate-200 px-4 py-2 text-slate-700 hover:border-cyan-200 hover:bg-cyan-50">Kampanyalar</a> : null}
          {visibility.show_work_updates && <a href="#notlar" className="rounded-full border border-slate-200 px-4 py-2 text-slate-700 hover:border-cyan-200 hover:bg-cyan-50">Notlar</a>}
          {(visibility.show_files || data.documents.length > 0) && <a href="#belgeler" className="rounded-full border border-slate-200 px-4 py-2 text-slate-700 hover:border-cyan-200 hover:bg-cyan-50">Belgeler</a>}
          {data.competitorSummaries.length > 0 && <a href="#rakip-ozeti" className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-emerald-800 hover:bg-emerald-100">Rakip Özeti</a>}
          {data.payments.length > 0 && <a href="#odemeler" className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-amber-800 hover:bg-amber-100">Ödemeler</a>}
        </nav>

        <section className="glass-card mb-8 overflow-hidden border-t-4 p-6 sm:p-7" style={{ borderTopColor: branding.primary_color || "#22d3ee" }}>
          <div className="grid gap-6 xl:grid-cols-[1fr_420px] xl:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-700">Genel Bakış</p>
              <h2 className="mt-3 text-3xl font-black">{portalTitle}</h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">{welcomeText}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-800"><Sparkles size={15} /> {data.campaigns[0]?.status || "Raporlama hazırlanıyor"}</div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black text-slate-700">Son güncelleme: {latestUpdate?.created_at ? new Date(latestUpdate.created_at).toLocaleDateString("tr-TR") : "Henüz yok"}</div>
              </div>
            </div>
            <AnimatedChart label="Son dönem performans eğilimi" values={[24, 29, 41, 38, 54, 61, 72, 79]} />
          </div>
        </section>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,.05)]">
            <p className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Müşteri</p>
            <p className="mt-3 text-lg font-black text-slate-950">{data.company?.name || "Şirket ataması bekleniyor"}</p>
          </div>
          <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,.05)]">
            <p className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Aktif hizmet</p>
            <p className="mt-3 text-lg font-black text-slate-950">{data.company?.sector || activeCampaigns[0]?.objective || "Dijital büyüme"}</p>
          </div>
          <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,.05)]">
            <p className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Son rapor</p>
            <p className="mt-3 text-lg font-black text-slate-950">{latestReportDate ? new Date(latestReportDate).toLocaleDateString("tr-TR") : "Henüz yok"}</p>
          </div>
          <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,.05)]">
            <p className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Kampanya durumu</p>
            <p className="mt-3 text-lg font-black text-slate-950">{activeCampaigns[0]?.status || data.campaigns[0]?.status || "Hazırlanıyor"}</p>
          </div>
          <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,.05)]">
            <p className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Reklam sağlık skoru</p>
            <p className="mt-3 text-lg font-black text-emerald-700">{totals.impressions || totals.clicks ? "İyi" : "Veri bekleniyor"}</p>
          </div>
          <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,.05)]">
            <p className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Son güncelleme</p>
            <p className="mt-3 text-lg font-black text-slate-950">{latestUpdate?.created_at ? new Date(latestUpdate.created_at).toLocaleDateString("tr-TR") : "Henüz yok"}</p>
          </div>
        </section>

        <section className="mb-8 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <section className="glass-card p-5">
            <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-700">Müşteri Paneli</p>
            <h2 className="mt-2 text-2xl font-black">Bu ayki operasyon özeti</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard title="Bu ay performans" value={totals.impressions ? `${totals.impressions.toLocaleString("tr-TR")} gösterim` : "Veri yok"} help="Müşteriye görünür metriklerden hesaplanır." />
              <MetricCard title="Aktif kampanya" value={activeCampaigns.length} help="Sadece müşteriye görünür kampanyalar listelenir." />
              <MetricCard title="Yayınlanan rapor" value={data.reports.length + data.monthlyReports.length} help="Müşteri paneline açık raporlar." />
              <MetricCard title="Görünür belge" value={data.documents.length + data.files.length} help="Sadece görünür olarak işaretlenen belgeler." />
            </div>
            <div className="mt-5 rounded-[14px] border border-cyan-200 bg-cyan-50 p-4">
              <p className="font-black text-cyan-900">Sonraki adımlar</p>
              <div className="mt-3 grid gap-2">
                {nextSteps.map((item) => <p key={item.id} className="rounded-[10px] bg-white p-3 text-sm leading-6 text-slate-700">{item.next_step}</p>)}
                {!nextSteps.length && <p className="text-sm text-cyan-800">Henüz görünür sonraki adım eklenmedi. Raporlar ve ajans notları yayınlandıkça burada görünür.</p>}
              </div>
            </div>
          </section>
          <section className="glass-card p-5">
            <h2 className="text-xl font-black">Son görünür hareketler</h2>
            <div className="mt-5 grid gap-3">
              {visibleTimeline.map((item, index) => <div key={`${item.title}-${index}`} className="rounded-[12px] border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-black text-cyan-700">{item.date ? new Date(item.date).toLocaleDateString("tr-TR") : "Tarih yok"}</p><p className="mt-1 font-black text-slate-950">{item.title}</p><p className="mt-1 text-sm leading-6 text-slate-600">{item.text}</p></div>)}
              {!visibleTimeline.length && <p className="rounded-[12px] border border-dashed border-slate-200 p-4 text-sm text-slate-500">Henüz müşteriye görünür hareket bulunmuyor.</p>}
            </div>
          </section>
        </section>

        {visibility.show_metrics && canShowReport("overview") && <section id="performans" className="grid scroll-mt-28 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {visibility.show_spent && canShowReport("metrics", "spend") && <MetricCard title="Toplam Harcama" value={`${totals.spent} TL`} help="Reklam platformlarında kullanılan toplam bütçedir." />}
          {canShowReport("metrics", "reach") && <MetricCard title="Erişim" value={totals.reach} help="Erişim: Reklamınızı gören benzersiz kişi sayısıdır." />}
          {canShowReport("metrics", "impressions") && <MetricCard title="Gösterim" value={totals.impressions} help="Gösterim: Reklamınızın ekranda toplam görüntülenme sayısıdır." />}
          {canShowReport("metrics", "clicks") && <MetricCard title="Tıklama" value={totals.clicks} help="Tıklama: Reklamınızdan web sitesi, WhatsApp veya form alanına giden aksiyon sayısıdır." />}
          <MetricCard title="CTR" value={`%${ctrValue}`} help="CTR (tıklama oranı): Tıklamaların gösterimlere oranıdır." />
          {visibility.show_leads && canShowReport("metrics", "leads") && <MetricCard title="Lead / Mesaj / Dönüşüm" value={totals.leads + (totals.messages || 0)} help="Lead, mesaj veya dönüşüm gibi müşteri aksiyonlarının toplam görünür özetidir." />}
          {visibility.show_spent && canShowReport("metrics", "cpc") && <MetricCard title="Ortalama tıklama maliyeti" value={`${totals.cpc} TL`} help="CPC: Reklam tıklaması başına ortalama maliyeti gösterir." />}
          {visibility.show_leads && visibility.show_spent && canShowReport("metrics", "leads") && <MetricCard title="Ortalama potansiyel müşteri maliyeti" value={`${totals.cost_per_lead} TL`} help="Bir potansiyel müşteri kaydı için ortalama reklam maliyetidir." />}
          <MetricCard title="Kampanya durumu" value={data.campaigns[0]?.status || "Hazırlanıyor"} help="Kampanya durumu, aktif çalışma aşamasını özetler." />
        </section>}

        <section id="kampanyalar" className="mt-8 grid scroll-mt-28 gap-6 lg:grid-cols-[1.1fr_.9fr]">
          {visibility.show_campaigns && canShowReport("campaigns") && (
            <section className="glass-card p-5">
              <h2 className="flex items-center gap-2 text-xl font-black"><BarChart3 className="text-cyan-600" /> Aktif Kampanyalar</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Yayında olan veya yakın zamanda yönetilen kampanyalarınızı buradan takip edebilirsiniz.</p>
              <div className="mt-5 grid gap-3">
                {data.campaigns.map((campaign) => {
                  const totalBudget = Number(campaign.total_budget ?? campaign.budget ?? 0);
                  const spentBudget = Number(campaign.spent_budget ?? campaign.spent ?? 0);
                  return (
                    <div key={campaign.id} className="rounded-[14px] border border-slate-200 bg-slate-50 p-4">
                      <p className="font-black text-slate-950">{campaign.name}</p>
                      <p className="mt-1 text-sm text-slate-600">{campaign.platform} · {campaign.objective}{canShowReport("metrics", "lifecycle_status") ? ` · ${campaign.status}` : ""}</p>
                      {(canShowReport("metrics", "lifecycle_start") || canShowReport("metrics", "lifecycle_end") || canShowReport("metrics", "lifecycle_days_remaining")) && <p className="mt-2 text-xs text-slate-500">
                        {canShowReport("metrics", "lifecycle_start") && `Başlangıç: ${campaign.meta_start_time || campaign.start_date || "Veri yok"} · `}
                        {canShowReport("metrics", "lifecycle_end") && `Bitiş: ${campaign.meta_stop_time || campaign.end_date || "Veri yok"} · `}
                        {canShowReport("metrics", "lifecycle_days_remaining") && `Gün kaldı: ${campaign.days_remaining ?? "Veri yok"}`}
                      </p>}
                      <div className="mt-3 h-2 rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.min(100, totalBudget ? (spentBudget / totalBudget) * 100 : 0)}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        {visibility.show_budget && `Bütçe: ${totalBudget} TL · `}
                        {visibility.show_spent && `Harcama: ${spentBudget} TL · `}
                        {campaign.notes}
                      </p>
                    </div>
                  );
                })}
                {!data.campaigns.length && <p className="rounded-[12px] border border-dashed border-slate-200 p-5 text-sm text-slate-500">Henüz görüntülenebilir kampanya bulunmuyor.</p>}
              </div>
            </section>
          )}

          <section className="glass-card p-5">
            <h2 className="flex items-center gap-2 text-xl font-black"><Lightbulb className="text-cyan-600" /> Sıradaki Önerilen Adım</h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">{visibleUpdates.find((update) => update.next_step)?.next_step || "Veriler düzenli güncellendikçe kampanya bütçesi, kreatif denemeleri ve müşteri yolculuğu için sonraki adım burada netleştirilir."}</p>
            <p className="mt-4 border-t border-slate-200 pt-4 text-sm leading-6 text-slate-500">Son çalışma: {latestUpdate?.title || "Henüz çalışma notu eklenmedi."}</p>
          </section>
        </section>

        {visibility.show_work_updates && (
          <section id="notlar" className="glass-card mt-8 scroll-mt-28 p-5">
            <h2 className="text-xl font-black">Yapılan Çalışmalar ve Strateji Notları</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">HK Dijital ekibinin sizin için yaptığı operasyonel çalışmaları gösterir.</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {visibleUpdates.map((update) => (
                <div key={update.id} className="rounded-[14px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-bold text-cyan-700">{update.update_type}</p>
                  <h3 className="mt-2 font-black text-slate-950">{update.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{update.description}</p>
                  {update.why_it_matters && <p className="mt-2 text-sm leading-6 text-slate-500">Neden önemli: {update.why_it_matters}</p>}
                  {update.next_step && <p className="mt-2 text-sm leading-6 text-cyan-700">Sıradaki adım: {update.next_step}</p>}
                  <p className="mt-3 text-xs text-slate-500">{new Date(update.created_at).toLocaleDateString("tr-TR")}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.competitorSummaries.length > 0 && (
          <section id="rakip-ozeti" className="glass-card mt-8 scroll-mt-28 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">Rakip Görünürlük Özeti</p>
                <h2 className="mt-2 text-xl font-black">Bu hafta rakiplerde ne değişti?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">HK Dijital ekibinin müşteriye açık olarak işaretlediği sade rekabet özetleri burada görünür. Teknik analiz ve iç operasyon notları gösterilmez.</p>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">{data.competitorSummaries.length} görünür özet</span>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {data.competitorSummaries.map((item: any) => {
                const recommendations = Array.isArray(item.customer_recommendations) ? item.customer_recommendations.slice(0, 3) : [];
                const actionPlan = Array.isArray(item.customer_action_plan) ? item.customer_action_plan.slice(0, 7) : [];
                return (
                  <article key={item.id} className="rounded-[16px] border border-emerald-200 bg-emerald-50 p-4">
                    <h3 className="font-black text-slate-950">{item.competitor_name || "Rakip görünürlük özeti"}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-700">{item.customer_summary || item.customer_visible_summary || "Rakip hareketleri bu hafta takip edildi. Uygulanabilir aksiyonlar aşağıda özetlendi."}</p>
                    {recommendations.length > 0 && (
                      <div className="mt-4 rounded-[12px] bg-white p-3">
                        <p className="font-black text-slate-900">3 kısa öneri</p>
                        <div className="mt-2 grid gap-2 text-sm text-slate-700">
                          {recommendations.map((line: string) => <p key={line}>• {line}</p>)}
                        </div>
                      </div>
                    )}
                    {actionPlan.length > 0 && (
                      <div className="mt-4 rounded-[12px] bg-white p-3">
                        <p className="font-black text-slate-900">Bu hafta yapılacaklar</p>
                        <ol className="mt-2 grid gap-1 text-sm text-slate-700">
                          {actionPlan.map((line: string, index: number) => <li key={line}>{index + 1}. {String(line).replace(/^Gün \d+:\s*/, "")}</li>)}
                        </ol>
                      </div>
                    )}
                    <p className="mt-3 text-xs font-bold text-emerald-800">Son kontrol: {item.last_checked_at ? new Date(item.last_checked_at).toLocaleDateString("tr-TR") : "Henüz kontrol tarihi yok"}</p>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {visibility.show_metrics && <section id="raporlar" className="scroll-mt-28">
          <div className="mb-4 rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,.05)]">
            <h2 className="text-2xl font-black text-slate-950">Raporlar</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Ajans tarafından hazırlanan dönemsel performans raporlarınız. PDF, Word ve Excel çıktıları buradan indirilebilir.</p>
          </div>
          <CustomerReports reports={data.reports} initialInterpretations={data.interpretations} reportUpdates={data.reportUpdates} visibilityRules={reportVisibility} />
        </section>}

        {visibility.show_files && (
          <section id="kreatif-merkezi" className="glass-card mt-8 scroll-mt-28 p-5">
            <h2 className="flex items-center gap-2 text-xl font-black"><Sparkles className="text-cyan-600" /> Kreatif Merkezi</h2>
            <p className="mt-2 text-sm text-slate-600">Reklam görselleri, kreatif dosyalar ve paylaşılabilir tasarımlar burada yer alır.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {creativeFiles.map((file: any) => (
                <div key={file.id} className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,.05)]">
                  {getCustomerFileUrl(file) ? (
                    <img src={getCustomerFileUrl(file)} alt={file.title || "Kreatif görsel"} className="h-48 w-full bg-slate-100 object-cover" />
                  ) : (
                    <div className="flex h-48 items-center justify-center bg-slate-50 text-sm font-bold text-slate-500">Önizleme yok</div>
                  )}
                  <div className="p-4">
                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-800">{getCustomerFileType(file)}</span>
                    <h3 className="mt-3 font-black text-slate-950">{file.title || "Kreatif"}</h3>
                    {file.description && <p className="mt-2 text-sm leading-6 text-slate-600">{file.description}</p>}
                    <p className="mt-2 text-xs font-bold text-slate-500">Güncelleme: {fileUpdatedLabel(file)}</p>
                    {getCustomerFileUrl(file) ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <a href={`/api/customer/files/${file.id}`} target="_blank" rel="noreferrer" className="inline-flex rounded-full bg-cyan-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-cyan-700">
                          Görseli Aç
                        </a>
                        <a href={getCustomerFileUrl(file)} download className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-cyan-200 hover:text-cyan-700">
                          <Download size={14} /> İndir
                        </a>
                      </div>
                    ) : (
                      <p className="mt-4 rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">Dosya bağlantısı bulunamadı.</p>
                    )}
                  </div>
                </div>
              ))}
              {!creativeFiles.length && <p className="rounded-[14px] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">Kreatif dosyası henüz paylaşılmadı.</p>}
            </div>
          </section>
        )}

        {(canShowReport("adsets") || canShowReport("ads") || canShowReport("conversions") || canShowReport("video") || canShowReport("analysis")) && (
          <section className="glass-card mt-8 scroll-mt-28 p-5">
            <h2 className="text-xl font-black">Meta Gelişmiş Reklam Verileri</h2>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {canShowReport("adsets") && <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-black">Reklam Setleri</h3>
                <div className="mt-3 grid gap-2">{data.metaAdsetMetrics.slice(0, 5).map((item: any) => <p key={item.id} className="text-sm text-slate-600">{item.adset_name || "Reklam seti"} · {item.status || "-"} · {canShowReport("metrics", "lifecycle_days_remaining") ? `Gün kaldı: ${item.days_remaining ?? "Veri yok"}` : `${Number(item.spend || 0).toLocaleString("tr-TR")} TL`}</p>)}{!data.metaAdsetMetrics.length && <p className="text-sm text-slate-500">Bu veri henüz çekilmedi veya Meta tarafından sağlanmadı.</p>}</div>
              </div>}
              {canShowReport("ads") && <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-black">Reklamlar / Kreatifler</h3>
                <div className="mt-3 grid gap-2">{data.metaAdMetrics.slice(0, 5).map((item: any) => <p key={item.id} className="text-sm text-slate-600">{item.ad_name || "Reklam"} · CTR {Number(item.ctr || 0).toFixed(2)}% {canShowReport("metrics", "roas") ? `· ROAS ${Number(item.roas || 0).toFixed(2)}` : ""}</p>)}{!data.metaAdMetrics.length && <p className="text-sm text-slate-500">Bu veri henüz çekilmedi veya Meta tarafından sağlanmadı.</p>}</div>
              </div>}
              {canShowReport("conversions") && <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-black">Dönüşümler</h3>
                <div className="mt-3 grid gap-2">{data.metaConversionEvents.slice(0, 5).map((item: any) => <p key={item.id} className="text-sm text-slate-600">{item.event_name} · {Number(item.event_count || 0).toLocaleString("tr-TR")} · {Number(item.cost_per_event || 0).toFixed(2)} TL</p>)}{!data.metaConversionEvents.length && <p className="text-sm text-slate-500">Bu veri henüz çekilmedi veya Meta tarafından sağlanmadı.</p>}</div>
              </div>}
              {canShowReport("analysis") && <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-black">HK Intelligence Analizi</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{data.metaAnalysisSnapshots[0]?.ai_summary || data.metaAnalysisSnapshots[0]?.funnel_diagnosis || "Bu veri henüz çekilmedi veya Meta tarafından sağlanmadı."}</p>
              </div>}
            </div>
          </section>
        )}

        {data.monthlyReports.length > 0 && (
          <section id={visibility.show_metrics ? undefined : "raporlar"} className="glass-card mt-8 scroll-mt-28 p-5">
            <h2 className="text-xl font-black">Aylık Raporlar</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {data.monthlyReports.map((report) => (
                <div key={report.id} className="rounded-[14px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">{report.report_month}</p>
                  <h3 className="mt-2 font-black">{data.company?.name || "Müşteri"} aylık performans özeti</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{report.summary || "Bu ay için özet hazırlanıyor."}</p>
                  {report.ai_interpretation && <p className="mt-3 rounded-[10px] bg-cyan-50 p-3 text-sm leading-6 text-cyan-800">{report.ai_interpretation}</p>}
                  {report.next_month_recommendations && <p className="mt-3 text-sm leading-6 text-slate-600">Önümüzdeki ay: {report.next_month_recommendations}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {visibility.show_files && (
          <section id="belgeler" className="glass-card mt-8 scroll-mt-28 p-5">
            <h2 className="flex items-center gap-2 text-xl font-black"><FileText className="text-cyan-200" /> Dosyalar</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Müşteriye açık dosyalarınızı burada önizleyebilir, açabilir veya indirebilirsiniz.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.files.map((file) => (
                <div key={file.id} className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,.05)]">
                  {isImageFile(file) && getCustomerFileUrl(file) ? (
                    <img src={getCustomerFileUrl(file)} alt={file.title || "Müşteri dosyası"} className="h-40 w-full bg-slate-100 object-cover" />
                  ) : (
                    <div className="flex h-32 items-center justify-center bg-slate-50 text-sm font-black text-slate-500">
                      {getCustomerFileType(file)}
                    </div>
                  )}
                  <div className="p-4">
                    <span className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-black text-cyan-800">{getCustomerFileType(file)}</span>
                    <h3 className="mt-3 font-black text-slate-950">{file.title || "Müşteri dosyası"}</h3>
                    {file.description && <p className="mt-2 text-sm leading-6 text-slate-600">{file.description}</p>}
                    <p className="mt-2 text-xs font-bold text-slate-500">Güncelleme: {fileUpdatedLabel(file)}</p>
                    {getCustomerFileUrl(file) ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <a href={`/api/customer/files/${file.id}`} target="_blank" rel="noreferrer" className="inline-flex rounded-full bg-cyan-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-cyan-700">
                          {fileButtonLabel(file)}
                        </a>
                        <a href={getCustomerFileUrl(file)} download className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-cyan-200 hover:text-cyan-700">
                          <Download size={14} /> İndir
                        </a>
                      </div>
                    ) : (
                      <p className="mt-4 rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">Dosya bağlantısı bulunamadı.</p>
                    )}
                  </div>
                </div>
              ))}
              {!data.files.length && <p className="text-sm text-slate-400">Henüz görünür dosya yok.</p>}
            </div>
          </section>
        )}

        {data.documents.length > 0 && (
          <section id={visibility.show_files ? undefined : "belgeler"} className="glass-card mt-8 scroll-mt-28 p-5">
            <h2 className="flex items-center gap-2 text-xl font-black"><FileText className="text-cyan-600" /> Belgeler</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {data.documents.map((document) => (
                <a key={document.id} href={document.document_url || "#"} target="_blank" rel="noreferrer" className="rounded-[14px] border border-slate-200 bg-slate-50 p-4 text-sm transition hover:border-cyan-200 hover:bg-cyan-50">
                  <span className="block text-xs font-black uppercase tracking-[.14em] text-cyan-700">{document.document_type}</span>
                  <span className="mt-2 block font-black text-slate-950">{document.title}</span>
                  <span className="mt-2 block text-xs text-slate-500">{document.document_date ? new Date(document.document_date).toLocaleDateString("tr-TR") : "Tarih yok"}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        {data.payments.length > 0 && (
          <section id="odemeler" className="glass-card mt-8 scroll-mt-28 p-5">
            <h2 className="text-xl font-black">Ödeme Durumu</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Müşteriye görünür ödeme kayıtları ve hizmet dönemleri burada listelenir.</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm font-bold text-emerald-700">Ödenen toplam</p><p className="mt-2 text-2xl font-black text-emerald-900">{paymentSummary.paid.toLocaleString("tr-TR")} TL</p></div>
              <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-bold text-amber-700">Bekleyen toplam</p><p className="mt-2 text-2xl font-black text-amber-900">{paymentSummary.pending.toLocaleString("tr-TR")} TL</p></div>
            </div>
            <div className="mt-4 grid gap-2">
              {data.payments.map((payment) => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><span>{payment.service_period || "Hizmet dönemi"} · {payment.status}</span><span className="font-black text-slate-950">{Number(payment.amount || 0).toLocaleString("tr-TR")} TL</span></div>)}
            </div>
          </section>
        )}

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {visibility.show_contact_person && (
          <section className="glass-card p-5">
            <h2 className="flex items-center gap-2 text-xl font-black"><MessageCircle className="text-cyan-600" /> İletişim</h2>
            <p className="mt-3 text-sm text-slate-600">Raporlar, kampanya notları veya sonraki adımlar için kayıtlı iletişim kanalını kullanabilirsiniz.</p>
            <a href={contactHref} target={contactHref.startsWith("http") ? "_blank" : undefined} rel={contactHref.startsWith("http") ? "noreferrer" : undefined} className="mt-4 inline-flex rounded-full px-4 py-2 text-sm font-black text-white" style={{ backgroundColor: brandAccentColor }}>{contactWhatsapp ? "WhatsApp ile iletişime geçin" : branding.contact_email ? "E-posta gönderin" : "İletişime geçin"}</a>
          </section>
          )}
          <section className="glass-card p-5">
            <h2 className="flex items-center gap-2 text-xl font-black"><UserRound className="text-cyan-600" /> Hesabım</h2>
            <p className="mt-3 text-sm text-slate-600">{session.fullName} · {data.company?.name || "Şirket ataması bekleniyor"}</p>
          </section>
        </section>
      </div>
    </main>
  );
}
