import type { Metadata } from "next";
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
  if (!session) redirect("/giris");
  const params = await searchParams;
  const isAdminPreview = isStaffRole(session.role) && Boolean(params.company);
  if (!isCustomerRole(session.role) && !isAdminPreview) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#050711] px-4 text-white">
        <div className="max-w-md rounded-[8px] border border-white/10 bg-white/[0.06] p-6 text-center">
          <h1 className="text-2xl font-black">Bu sayfaya erişim yetkiniz yok.</h1>
          <a href="/giris" className="mt-5 inline-flex rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">Giriş ekranına dön</a>
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
  const hasCompany = Boolean(selectedCompanyId && data.company);
  const visibleUpdates = visibility.show_strategy_notes ? data.updates : data.updates.filter((update) => update.update_type !== "Strateji Notu");
  const latestUpdate = visibleUpdates[0];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050711] text-white">
      <div className="premium-grid pointer-events-none absolute inset-0 opacity-45" />
      <header className="relative border-b border-white/10 bg-[#050711]/90 px-4 py-5 shadow-[0_16px_48px_rgba(0,0,0,.2)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Logo content={siteContent} compact />
            <div>
            <p className="text-sm font-bold uppercase tracking-[.22em] text-cyan-200">Müşteri Performans Merkezi</p>
            <h1 className="mt-2 text-3xl font-black">HK Dijital Marketing Center</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Reklam çalışmalarınızı, süreç notlarınızı ve performans özetlerinizi tek ekrandan takip edin.</p>
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

        <section className="glass-card mb-8 overflow-hidden p-6 sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-100">Hoş geldiniz</p>
              <h2 className="mt-3 text-3xl font-black">{data.company?.name || "Müşteri hesabı"}</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">Reklam çalışmalarınızın güncel durumunu, son yapılan işlemleri ve sıradaki önerilen adımı sade bir özetle takip edebilirsiniz.</p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-black text-emerald-100"><Sparkles size={15} /> {data.campaigns[0]?.status || "Raporlama hazırlanıyor"}</div>
            </div>
            <AnimatedChart label="Son dönem performans eğilimi" values={[24, 29, 41, 38, 54, 61, 72, 79]} />
          </div>
        </section>

        {visibility.show_metrics && <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Reklamınız kaç kez gösterildi" value={totals.impressions} help="Reklamınızın ekranda toplam görüntülenme sayısıdır." />
          <MetricCard title="Reklamınız kaç kişiye ulaştı" value={totals.reach} help={`Reklamınız bu ay ${totals.reach} kişiye ulaştı.`} />
          <MetricCard title="Reklamlarınıza gelen tıklama" value={totals.clicks} help={`Reklamlarınıza ${totals.clicks} tıklama geldi.`} />
          <MetricCard title="Mesaj başlatma" value={totals.messages || 0} help={`Bu süreçte ${totals.messages || 0} kişi mesaj ile iletişime geçti.`} />
          {visibility.show_leads && <MetricCard title="Potansiyel müşteri" value={totals.leads} help={`Bu süreçte ${totals.leads} potansiyel müşteri oluştu.`} />}
          {visibility.show_spent && <MetricCard title="Harcanan reklam bütçesi" value={`${totals.spent} TL`} help="Reklam platformlarında kullanılan toplam bütçedir." />}
          {visibility.show_spent && <MetricCard title="Ortalama tıklama maliyeti" value={`${totals.cpc} TL`} help="CPC: Reklam tıklaması başına ortalama maliyeti gösterir." />}
          {visibility.show_leads && visibility.show_spent && <MetricCard title="Ortalama potansiyel müşteri maliyeti" value={`${totals.cost_per_lead} TL`} help="Bir potansiyel müşteri kaydı için ortalama reklam maliyetidir." />}
          <MetricCard title="Kampanya durumu" value={data.campaigns[0]?.status || "Hazırlanıyor"} help="Kampanya durumu, aktif çalışma aşamasını özetler." />
        </section>}

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          {visibility.show_campaigns && (
            <GlassCard className="p-5">
              <h2 className="flex items-center gap-2 text-xl font-black"><BarChart3 className="text-cyan-200" /> Reklam Performansı</h2>
              <div className="mt-5 grid gap-3">
                {data.campaigns.map((campaign) => (
                  <div key={campaign.id} className="rounded-[8px] bg-black/25 p-4">
                    <p className="font-black">{campaign.name}</p>
                    <p className="mt-1 text-sm text-slate-400">{campaign.platform} · {campaign.objective} · {campaign.status}</p>
                    <div className="mt-3 h-2 rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.min(100, campaign.budget ? (Number(campaign.spent || 0) / Number(campaign.budget)) * 100 : 0)}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      {visibility.show_budget && `Bütçe: ${campaign.budget || 0} TL · `}
                      {visibility.show_spent && `Harcama: ${campaign.spent || 0} TL · `}
                      {campaign.notes}
                    </p>
                  </div>
                ))}
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
          <section className="glass-card mt-8 p-5">
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

        {visibility.show_metrics && <CustomerReports reports={data.reports} initialInterpretations={data.interpretations} reportUpdates={data.reportUpdates} />}

        {visibility.show_files && (
          <section className="glass-card mt-8 p-5">
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
