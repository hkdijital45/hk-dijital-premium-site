"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, BarChart3, Brain, CheckCircle, Copy, FileText, MessageSquareText, RefreshCw, Search, Send, ShieldAlert, Sparkles, Trophy } from "lucide-react";
import { filterSelectableCustomers } from "@/lib/customer-visibility";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { AdminWorkspace } from "@/components/admin/workspace/AdminWorkspace";
import { AdminControlPanel, AdminFilterSection } from "@/components/admin/workspace/AdminControlPanel";
import { AdminDataGrid, type AdminDataGridColumn } from "@/components/admin/workspace/AdminDataGrid";
import { AdminDetailInspector } from "@/components/admin/workspace/AdminDetailInspector";
import { AdminActionBar } from "@/components/admin/workspace/AdminActionBar";
import { AdminCompactKpiStrip } from "@/components/admin/workspace/AdminCompactKpiStrip";

const ranges = [
  ["today", "Bugün"],
  ["last_7d", "Son 7 gün"],
  ["last_14d", "Son 14 gün"],
  ["last_30d", "Son 30 gün"],
  ["this_month", "Bu ay"],
  ["last_month", "Geçen ay"],
  ["custom", "Özel tarih aralığı"]
];

const platforms = [
  ["all", "Tümü"],
  ["meta", "Meta"],
  ["google", "Google"],
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
  ["website", "Website / Pixel"]
];

const campaignTypes = ["Tümü", "Bilinirlik", "Trafik", "Mesaj", "Lead", "Satış", "Yeniden Pazarlama"];
const statusFilters = ["Tümü", "Aktif", "Pasif", "Kritik"];
const analysisLevels = ["Kampanya", "Reklam Seti", "Reklam", "Kreatif"];

const metricExplanations: Record<string, string> = {
  spend: "Harcama",
  impressions: "Gösterim",
  reach: "Erişim",
  clicks: "Tıklama",
  ctr: "CTR",
  cpc: "CPC",
  cpm: "CPM",
  messages: "Mesaj",
  leads: "Lead",
  conversions: "Dönüşüm",
  frequency: "Frekans",
  roas: "ROAS"
};

const descriptions: Record<string, string> = {
  spend: "Seçili dönemde kullanılan toplam reklam bütçesi.",
  impressions: "Reklamların ekranda kaç kez göründüğünü gösterir.",
  reach: "Reklamı gören benzersiz kişi sayısıdır.",
  clicks: "Reklamlardan alınan toplam tıklamadır.",
  ctr: "Reklamı görenlerden kaç kişinin tıkladığını gösterir.",
  cpc: "Bir tıklama için ortalama maliyet.",
  cpm: "Bin gösterim için ortalama maliyet.",
  messages: "Reklam kaynaklı mesaj veya konuşma başlangıcı.",
  leads: "Form, arama veya mesaj gibi potansiyel müşteri sinyali.",
  conversions: "Tanımlı dönüşüm aksiyonlarının toplamı.",
  frequency: "Bir kişinin reklamı ortalama kaç kez gördüğü.",
  roas: "Reklam harcamasına karşılık gelir oranı."
};

function formatMetric(key: string, value: any) {
  const number = Number(value || 0);
  if (["spend", "cpc", "cpm"].includes(key)) return `${number.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} TL`;
  if (["ctr", "frequency", "roas"].includes(key)) return number.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  return number.toLocaleString("tr-TR");
}

function scoreTone(score: number) {
  if (score >= 70) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (score >= 40) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-red-200 bg-red-50 text-red-800";
}

function levelTone(level = "Bilgi") {
  if (level === "Kritik") return "border-red-200 bg-red-50 text-red-800";
  if (level === "Uyarı") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-cyan-200 bg-cyan-50 text-cyan-800";
}

function priorityTone(priority = "Orta") {
  if (priority === "Kritik") return "border-red-200 bg-red-50 text-red-800";
  if (priority === "Yüksek") return "border-orange-200 bg-orange-50 text-orange-800";
  if (priority === "Orta") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function connectionLabel(value: any, missing: string) {
  return value ? <span className="font-black text-slate-950">{value}</span> : <span className="font-bold text-amber-700">{missing}</span>;
}

function changeBadge(value: any) {
  const number = Number(value || 0);
  const tone = number > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : number < 0 ? "border-red-200 bg-red-50 text-red-800" : "border-slate-200 bg-slate-50 text-slate-700";
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${tone}`}>{number > 0 ? "+" : ""}{number.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%</span>;
}

function adTitle(ad: any) {
  return ad?.name || ad?.campaign_name || ad?.ad_name || "Reklam verisi yok";
}

function formatDate(value: any) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("tr-TR");
}

function sectionTitle(title: string, description: string, icon?: ReactNode) {
  return <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black text-slate-950">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{description}</p></div>{icon}</div>;
}

export function AdInsightsCenter({ content, notify }: { content: any; notify?: (message: string, type?: string) => void }) {
  const companies = useMemo(() => filterSelectableCustomers(content.companies || []), [content.companies]);
  const [companyId, setCompanyId] = useState(companies[0]?.id || "");
  const [range, setRange] = useState("last_30d");
  const [platform, setPlatform] = useState("all");
  const [campaignType, setCampaignType] = useState("Tümü");
  const [statusFilter, setStatusFilter] = useState("Tümü");
  const [analysisLevel, setAnalysisLevel] = useState("Kampanya");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState("");
  const [data, setData] = useState<any>(null);
  const [completedActions, setCompletedActions] = useState<Record<string, boolean>>({});
  const [selectedDiagnosisIndex, setSelectedDiagnosisIndex] = useState<number | null>(null);
  const selectedCompany = companies.find((company: any) => company.id === companyId);
  const metrics = data?.metrics || {};
  const diagnoses = data?.diagnoses || [];
  const prescription = data?.prescription || {};
  const creativeAnalysis = data?.creativeAnalysis || {};
  const trendAnalysis = data?.trendAnalysis || {};
  const competitorAnalysis = data?.competitorAnalysis || {};
  const doctorSummary = data?.doctorSummary || {};
  const customerMessage = data?.customerMessage || doctorSummary.customerMessage || data?.analysis?.customer || "";

  async function request(path: string, method = "GET") {
    if (!companyId) {
      notify?.("Önce müşteri seçin.", "warning");
      return;
    }
    const params = new URLSearchParams({ companyId, range, platform, from, to, campaignType, status: statusFilter, analysisLevel });
    setLoading(path);
    try {
      const response = method === "GET"
        ? await fetch(`/api/admin/ad-insights?${params}`)
        : await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, range, platform, from, to, campaignType, status: statusFilter, analysisLevel }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || payload.error || "Reklam analizi alınamadı.");
      setData(payload);
      notify?.(method === "GET" ? "Reklam doktoru analizi hazırlandı." : payload.message || "İşlem tamamlandı.", "success");
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "İşlem başarısız oldu.", "error");
    } finally {
      setLoading("");
    }
  }

  function clearFilters() {
    setCompanyId("");
    setRange("last_30d");
    setPlatform("all");
    setCampaignType("Tümü");
    setStatusFilter("Tümü");
    setAnalysisLevel("Kampanya");
    setFrom("");
    setTo("");
    setData(null);
    notify?.("Filtreler temizlendi.", "info");
  }

  async function copyText(text: string, message = "Metin kopyalandı.") {
    if (!text) return notify?.("Kopyalanacak metin yok.", "warning");
    await navigator.clipboard?.writeText(text);
    notify?.(message, "success");
  }

  function openWhatsApp() {
    if (!customerMessage) return notify?.("WhatsApp mesajı için önce analiz oluşturun.", "warning");
    const rawPhone = selectedCompany?.phone || selectedCompany?.whatsapp || selectedCompany?.contact_phone || "";
    const phone = String(rawPhone).replace(/\D/g, "");
    if (!phone) {
      copyText(customerMessage, "Müşteri telefonu yok; mesaj metni kopyalandı.");
      return;
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(customerMessage)}`, "_blank", "noopener,noreferrer");
    notify?.("WhatsApp mesajı hazırlandı.", "success");
  }

  async function createTask(action: any, all = false) {
    if (!companyId) return notify?.("Müşteri seçili değil.", "warning");
    const actions = all ? (prescription.all || []) : [action];
    if (!actions.length) return notify?.("Göreve çevrilecek reçete aksiyonu yok.", "warning");
    setLoading("task");
    try {
      for (const item of actions) {
        const due = new Date();
        due.setDate(due.getDate() + Number(item.dueInDays || 0));
        const response = await fetch("/api/admin/customer-operations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resource: "task",
            item: {
              company_id: companyId,
              title: item.title,
              description: `${item.description}\n\nİlgili reklam/kampanya: ${item.related || "-"}\nBeklenen etki: ${item.expectedImpact || "-"}`,
              status: "Yapılacak",
              priority: item.priority || "Orta",
              due_date: due.toISOString().slice(0, 10),
              visible_to_customer: false,
              template_key: "ad_doctor_prescription",
              metadata: { source: "ad-doctor-pro", prescription: item }
            }
          })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.detail || payload.error || "Görev oluşturulamadı.");
      }
      notify?.(all ? "Tüm reçete görev olarak oluşturuldu." : "CRM görevi oluşturuldu.", "success");
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "Görev oluşturulamadı.", "error");
    } finally {
      setLoading("");
    }
  }

  function openSnapshot(snapshot: any) {
    const insights = snapshot.insights || {};
    setData((current: any) => ({
      ...current,
      metrics: snapshot.metrics || current?.metrics || {},
      previousMetrics: snapshot.previous_metrics || current?.previousMetrics || {},
      weeklyChange: snapshot.weekly_change || insights.weekly_change || current?.weeklyChange || {},
      wastedBudgetEstimate: snapshot.wasted_budget_estimate || insights.wasted_budget_estimate || 0,
      bestAd: snapshot.best_ad || insights.best_ad || current?.bestAd || null,
      worstAd: snapshot.worst_ad || insights.worst_ad || current?.worstAd || null,
      winningCreative: snapshot.winning_creative || insights.winning_creative || current?.winningCreative || null,
      actionRecommendations: snapshot.action_recommendations || insights.action_recommendations || current?.actionRecommendations || [],
      healthScore: snapshot.health_score || current?.healthScore || 0,
      doctorStatus: snapshot.health_score >= 70 ? "Sağlıklı" : snapshot.health_score >= 40 ? "Riskli" : "Kritik",
      diagnoses: insights.diagnoses || current?.diagnoses || [],
      prescription: insights.prescription || current?.prescription || {},
      creativeAnalysis: insights.creative_analysis || current?.creativeAnalysis || {},
      trendAnalysis: insights.trend_analysis || current?.trendAnalysis || {},
      competitorAnalysis: insights.competitor_analysis || current?.competitorAnalysis || {},
      doctorSummary: insights.doctor_summary || current?.doctorSummary || {},
      customerMessage: insights.customer_message || current?.customerMessage || "",
      urgency: insights.urgency || current?.urgency || {},
      potentialImprovement: insights.potential_improvement || current?.potentialImprovement || 0,
      sourceType: snapshot.source_type || current?.sourceType || "Kayıtlı analiz"
    }));
    notify?.("Snapshot açıldı.", "success");
  }

  const doctorCards = [
    ["Sağlık Skoru", `${data?.healthScore ?? "-"} / 100`, data?.doctorStatus || data?.healthLabel || "Veri bekleniyor", scoreTone(Number(data?.healthScore || 0))],
    ["Aciliyet", data?.urgency?.label || "-", data?.urgency?.description || "Analiz sonrası görünür.", levelTone(data?.urgency?.tone)],
    ["Tahmini bütçe kaçağı", Number(data?.wastedBudgetEstimate || 0) ? `${Number(data.wastedBudgetEstimate).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} TL` : "Hesaplanamadı", "Verimsiz kampanya/tıklama sinyallerine göre.", "border-orange-200 bg-orange-50 text-orange-800"],
    ["En riskli kampanya", adTitle(data?.worstAd), "Düşük CTR, yüksek CPC veya düşük dönüşüm sinyaline göre.", "border-red-200 bg-red-50 text-red-800"],
    ["En iyi kampanya", adTitle(data?.bestAd), "Yüksek sonuç ve düşük maliyet kombinasyonu.", "border-emerald-200 bg-emerald-50 text-emerald-800"],
    ["En yorgun kreatif", creativeAnalysis.items?.find((item: any) => item.fatigueRisk)?.name || "Belirgin risk yok", "Frekans ve CTR sinyaline göre.", "border-purple-200 bg-purple-50 text-purple-800"],
    ["Potansiyel iyileşme", `%${Number(data?.potentialImprovement || 0)}`, "Sorun giderilirse beklenen göreli iyileşme alanı.", "border-cyan-200 bg-cyan-50 text-cyan-800"]
  ];

  const diagnosisColumns: AdminDataGridColumn<any>[] = [
    { key: "name", header: "Sorun", render: (item: any) => <strong className="block truncate">{item.name}</strong> },
    { key: "level", header: "Seviye", render: (item: any) => <AdminStatusBadge tone={item.level === "Kritik" ? "danger" : item.level === "Uyarı" ? "warning" : "info"}>{item.level}</AdminStatusBadge> },
    { key: "priority", header: "Öncelik", align: "right", render: (item: any) => item.priorityScore },
    { key: "impact", header: "İş Etkisi", render: (item: any) => <span className="line-clamp-1">{item.businessImpact}</span> }
  ];
  const selectedDiagnosis = selectedDiagnosisIndex !== null ? diagnoses[selectedDiagnosisIndex] : null;
  const relatedPrescriptionActions = selectedDiagnosis
    ? [...(prescription.today || []), ...(prescription.threeDays || []), ...(prescription.sevenDays || [])].filter((action: any) => String(action.related || "").toLocaleLowerCase("tr").includes(String(selectedDiagnosis.name || "").toLocaleLowerCase("tr")))
    : [];

  return (
    <AdminWorkspace
      eyebrow="Reklam ve Performans"
      title="Reklam Doktoru Pro"
      description="Meta ve Google reklam verilerini doktor mantığıyla analiz eder; performans sorunlarını, bütçe kaçaklarını, kreatif yorgunluğunu ve aksiyon reçetesini tek ekranda gösterir. Teşhisler sağlanan veriden kural motoruyla türetilir; AI yorumu yalnız 'Performansı Yorumla' çalıştırıldığında eklenir."
      headerActions={<div className={`rounded-[10px] border px-3 py-1.5 text-xs font-black ${scoreTone(Number(data?.healthScore || 0))}`}>Skor: {data?.healthScore ?? "-"}/100 · {data?.doctorStatus || data?.healthLabel || "Veri bekleniyor"}</div>}
      leftPanel={
        <AdminControlPanel>
          <AdminFilterSection title="Analiz Filtreleri">
            <div className="grid gap-2">
              <label className="grid gap-1.5 text-xs font-bold text-slate-700">Müşteri
                <select value={companyId} onChange={(event) => setCompanyId(event.target.value)} className="min-h-9 rounded-[8px] border border-slate-200 bg-white px-3 text-sm text-slate-900">
                  <option value="">Müşteri seç</option>
                  {companies.map((company: any) => <option key={company.id} value={company.id}>{company.name || company.company_name}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-slate-700">Tarih aralığı
                <select value={range} onChange={(event) => setRange(event.target.value)} className="min-h-9 rounded-[8px] border border-slate-200 bg-white px-3 text-sm text-slate-900">{ranges.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              </label>
              {range === "custom" && <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-xs font-bold text-slate-700">Başlangıç<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="min-h-9 rounded-[8px] border border-slate-200 px-2 text-sm" /></label>
                <label className="grid gap-1 text-xs font-bold text-slate-700">Bitiş<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="min-h-9 rounded-[8px] border border-slate-200 px-2 text-sm" /></label>
              </div>}
              <label className="grid gap-1.5 text-xs font-bold text-slate-700">Platform
                <select value={platform} onChange={(event) => setPlatform(event.target.value)} className="min-h-9 rounded-[8px] border border-slate-200 bg-white px-3 text-sm text-slate-900">{platforms.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-slate-700">Kampanya türü
                <select value={campaignType} onChange={(event) => setCampaignType(event.target.value)} className="min-h-9 rounded-[8px] border border-slate-200 bg-white px-3 text-sm text-slate-900">{campaignTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-slate-700">Durum
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-9 rounded-[8px] border border-slate-200 bg-white px-3 text-sm text-slate-900">{statusFilters.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-slate-700">Analiz seviyesi
                <select value={analysisLevel} onChange={(event) => setAnalysisLevel(event.target.value)} className="min-h-9 rounded-[8px] border border-slate-200 bg-white px-3 text-sm text-slate-900">{analysisLevels.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              </label>
              <AdminButton compact variant="ai" disabled={Boolean(loading)} onClick={() => request("/api/admin/ad-insights")}><Search size={14} className="mr-1 inline" />{loading === "/api/admin/ad-insights" ? "Analiz ediliyor..." : "Analiz Et"}</AdminButton>
              <AdminButton compact variant="secondary" onClick={clearFilters}>Temizle</AdminButton>
            </div>
          </AdminFilterSection>
          <AdminFilterSection title="Snapshot Geçmişi">
            <div className="grid gap-1.5">
              {(data?.snapshots || []).map((snapshot: any) => (
                <div key={snapshot.id || snapshot.created_at} className="rounded-[8px] border border-slate-200 bg-white p-2 text-xs">
                  <p className="font-black text-slate-800">{formatDate(snapshot.created_at)} — {snapshot.health_score ?? "-"}/100</p>
                  <p className="text-[11px] text-slate-500">{snapshot.source_type || "Kayıtlı analiz"}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <button type="button" onClick={() => openSnapshot(snapshot)} className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-700">Aç</button>
                    <button type="button" onClick={() => window.print()} className="rounded-full border border-amber-200 px-2 py-0.5 text-[10px] font-black text-amber-700">PDF</button>
                    <button type="button" onClick={() => createTask({ title: "Reklam doktoru snapshot notu", description: `Snapshot skoru: ${snapshot.health_score}/100`, related: "Reklam Doktoru Pro", priority: "Orta", expectedImpact: "Geçmiş analiz takibi", dueInDays: 1 })} className="rounded-full border border-emerald-200 px-2 py-0.5 text-[10px] font-black text-emerald-700">Görev Ekle</button>
                  </div>
                </div>
              ))}
              {!data?.snapshots?.length && <p className="text-[11px] text-slate-500">Henüz snapshot kaydı yok.</p>}
            </div>
          </AdminFilterSection>
        </AdminControlPanel>
      }
      rightPanel={
        <AdminDetailInspector
          title={selectedDiagnosis ? selectedDiagnosis.name : undefined}
          subtitle={selectedDiagnosis ? `${selectedDiagnosis.level} · Öncelik ${selectedDiagnosis.priorityScore}` : undefined}
          emptyTitle="Bir teşhis seçin"
          emptyDescription="Merkezdeki teşhis listesinden bir satıra tıklayarak detayını buradan görüntüleyin."
          fields={selectedDiagnosis ? [
            { label: "Belirti", value: selectedDiagnosis.symptom || "-" },
            { label: "Muhtemel sebep", value: selectedDiagnosis.likelyCause || "-" },
            { label: "İş etkisi", value: selectedDiagnosis.businessImpact || "-" },
            { label: "Önerilen çözüm", value: selectedDiagnosis.recommendation || "-" },
            { label: "Kaynak", value: "Sağlanan veriden kural motoruyla türetildi (AI yorumu değil)" }
          ] : undefined}
          actions={selectedDiagnosis ? <>
            {relatedPrescriptionActions.map((action: any, index: number) => (
              <AdminButton key={index} compact variant="success" disabled={loading === "task"} onClick={() => createTask(action)}>İlgili Aksiyonu Göreve Çevir</AdminButton>
            ))}
            <AdminButton compact variant="secondary" onClick={() => copyText(`${selectedDiagnosis.name}: ${selectedDiagnosis.recommendation}`)}>Kopyala</AdminButton>
          </> : undefined}
        />
      }
      bottomBar={
        <AdminActionBar statusText={`${diagnoses.length} teşhis · ${data?.sourceType || "Analiz bekleniyor"}`}>
          <AdminButton compact variant="success" disabled={loading === "task" || !prescription.today} onClick={() => createTask(null, true)}>Tüm Reçeteyi Göreve Çevir</AdminButton>
          <AdminButton compact variant="secondary" onClick={() => request("/api/admin/ad-insights/sync", "POST")} disabled={Boolean(loading)}><RefreshCw size={14} className="mr-1 inline" />Snapshot Kaydet</AdminButton>
        </AdminActionBar>
      }
    >
    {!selectedCompany && <AdminEmptyState title="Reklam doktoru analizini başlatmak için aktif bir müşteri seçin." />}

    {selectedCompany && <section className="mb-4 grid gap-3 lg:grid-cols-3">
      <div className="rounded-[10px] border border-slate-200 bg-white p-3 lg:col-span-2">
        <h3 className="text-sm font-black text-slate-950">Müşteri Reklam Bağlantı Durumu</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <p className="rounded-[8px] bg-slate-50 p-2 text-xs text-slate-600">Meta Business ID<br />{connectionLabel(data?.connection?.metaBusinessId, "Meta reklam hesabı/veri bağlantısı eksik.")}</p>
          <p className="rounded-[8px] bg-slate-50 p-2 text-xs text-slate-600">Meta Ad Account ID<br />{connectionLabel(data?.connection?.metaAdAccountId, "Meta Ads Account ID eksik.")}</p>
          <p className="rounded-[8px] bg-slate-50 p-2 text-xs text-slate-600">Google Ads Customer ID<br />{connectionLabel(data?.connection?.googleAdsCustomerId, "Google Ads Customer ID eksik.")}</p>
          <p className="rounded-[8px] bg-slate-50 p-2 text-xs text-slate-600">Website / Pixel<br />{connectionLabel(data?.connection?.websiteUrl || data?.connection?.metaPixelId, "Website veya Pixel bilgisi eksik.")}</p>
        </div>
      </div>
      <div className="rounded-[10px] border border-slate-200 bg-white p-3">
        <h3 className="text-sm font-black text-slate-950">Veri Kaynağı</h3>
        <p className="mt-2 rounded-[8px] border border-cyan-200 bg-cyan-50 p-2 text-xs font-bold text-cyan-800">{data?.sourceType || "Analiz bekleniyor"}</p>
      </div>
    </section>}

    {data && (
      <AdminCompactKpiStrip items={[
        { key: "health", label: "Sağlık Skoru", value: `${data?.healthScore ?? "-"}/100`, icon: <span>🩺</span>, tone: Number(data?.healthScore || 0) >= 70 ? "success" : Number(data?.healthScore || 0) >= 40 ? "warning" : "danger" },
        { key: "urgency", label: "Aciliyet", value: data?.urgency?.label || "-", icon: <span>⏱️</span>, tone: "warning" },
        { key: "waste", label: "Tahmini bütçe kaçağı", value: Number(data?.wastedBudgetEstimate || 0) ? `${Number(data.wastedBudgetEstimate).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL` : "Hesaplanamadı", icon: <span>💸</span>, tone: "danger" },
        { key: "improvement", label: "Potansiyel iyileşme", value: `%${Number(data?.potentialImprovement || 0)}`, icon: <span>📈</span>, tone: "info" }
      ]} />
    )}

    {data && <section className="my-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Object.keys(metricExplanations).map((key) => <div key={key} title={descriptions[key]} className="rounded-[10px] border border-slate-200 bg-white p-3">
        <p className="text-[10px] font-black uppercase tracking-[.1em] text-slate-500">{metricExplanations[key]}</p>
        <strong className="mt-1 block text-lg font-black text-slate-950">{formatMetric(key, metrics[key])}</strong>
      </div>)}
    </section>}

    {data && <section className="mb-4 grid gap-3 md:grid-cols-3">
      {doctorCards.slice(3, 6).map(([title, value, description, tone]) => <article key={title} className={`rounded-[10px] border p-3 ${tone}`}>
        <p className="text-[10px] font-black uppercase tracking-[.1em] opacity-80">{title}</p>
        <strong className="mt-1 block text-sm font-black">{value}</strong>
        <p className="mt-1 text-[11px] leading-4">{description}</p>
      </article>)}
    </section>}

    {data && <section className="mb-4 rounded-[10px] border border-slate-200 bg-white p-3">
      {sectionTitle("Doktor Teşhisleri", "Her teşhis metriklerden hesaplanır; sağlanan veriden kural motoruyla türetilir. Seçmek için bir satıra tıklayın.", <ShieldAlert className="text-red-600" size={18} />)}
      <div className="mt-3">
        <AdminDataGrid columns={diagnosisColumns} rows={diagnoses} rowKey={(item: any, index: number) => `${item.name}-${index}`} activeId={selectedDiagnosisIndex !== null ? `${diagnoses[selectedDiagnosisIndex]?.name}-${selectedDiagnosisIndex}` : undefined} onRowClick={(row: any) => setSelectedDiagnosisIndex(diagnoses.indexOf(row))} emptyTitle="Teşhis bulunamadı." emptyDescription="Analiz Et düğmesiyle bir doktor analizi çalıştırın." />
      </div>
      <div className="mt-3 rounded-[8px] bg-slate-50 p-3 text-xs leading-6 text-slate-700">
        <p className="mb-1 text-[10px] font-black uppercase tracking-[.1em] text-slate-500">Skor Açıklaması</p>
        {doctorSummary.general || "Analiz bekleniyor."}
        <div className="mt-2 grid gap-1.5">{(doctorSummary.why || []).map((item: string) => <p key={item} className="rounded-[8px] border border-slate-200 bg-white p-2 text-xs text-slate-700">{item}</p>)}</div>
      </div>
    </section>}

    {data && <section className="mb-4 rounded-[10px] border border-slate-200 bg-white p-3">
      {sectionTitle("Reklam Doktoru Reçetesi", "Bugün, 3 gün ve 7 gün içinde yapılacak aksiyonlar göreve çevrilebilir.", <CheckCircle className="text-emerald-600" />)}
      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {[
          ["Bugün yapılacaklar", prescription.today || []],
          ["3 gün içinde", prescription.threeDays || []],
          ["7 gün içinde", prescription.sevenDays || []]
        ].map(([title, actions]: any) => <div key={title} className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
          <h4 className="font-black text-slate-950">{title}</h4>
          <div className="mt-3 grid gap-3">{actions.map((action: any, index: number) => {
            const key = `${title}-${index}-${action.title}`;
            return <article key={key} className="rounded-[14px] bg-white p-4 ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-slate-950">{action.title}</strong><span className={`rounded-full border px-2 py-1 text-[11px] font-black ${priorityTone(action.priority)}`}>{action.priority}</span></div>
              <p className="mt-2 text-xs leading-5 text-slate-600">{action.description}</p>
              <p className="mt-2 text-xs font-bold text-slate-500">İlgili: {action.related || "-"}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">Beklenen etki: {action.expectedImpact || "-"}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => createTask(action)} disabled={loading === "task"} className="rounded-full bg-emerald-500 px-3 py-2 text-xs font-black text-white disabled:opacity-50">CRM Görevi Oluştur</button>
                <button onClick={() => createTask(action)} disabled={loading === "task"} className="rounded-full border border-emerald-200 px-3 py-2 text-xs font-black text-emerald-700 disabled:opacity-50">Müşteri Yapılacaklarına Ekle</button>
                <button onClick={() => setCompletedActions((current) => ({ ...current, [key]: true }))} className="rounded-full border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">{completedActions[key] ? "Tamamlandı" : "Tamamlandı İşaretle"}</button>
              </div>
            </article>;
          })}</div>
        </div>)}
      </div>
      <button onClick={() => createTask(null, true)} disabled={loading === "task"} className="mt-5 rounded-[14px] bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">Tüm Reçeteyi Göreve Çevir</button>
    </section>}

    {data && <section className="grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
      <div className="rounded-[20px] border border-slate-200 bg-white p-6">
        {sectionTitle("Kreatif Doktoru", "Kreatif skoru, CTA, teklif netliği, mobil okunabilirlik ve yorgunluk riski.", <Sparkles className="text-purple-600" />)}
        <p className="mt-4 rounded-[14px] bg-purple-50 p-4 text-sm font-bold leading-6 text-purple-900">Kreatif skoru: {creativeAnalysis.score || 0}/100 — {creativeAnalysis.summary || "Kreatif analizi bekleniyor."}</p>
        <div className="mt-4 grid gap-3">
          {(creativeAnalysis.items || []).map((item: any) => <article key={item.name} className="rounded-[14px] border border-slate-200 p-4">
            {item.thumbnail && <img src={item.thumbnail} alt={item.name} className="mb-3 aspect-video w-full rounded-[12px] object-cover" />}
            <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-slate-950">{item.name}</strong><span className={`rounded-full border px-3 py-1 text-xs font-black ${scoreTone(item.score)}`}>{item.score}/100</span></div>
            <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
              <span>CTA: {item.hasCta ? "Var" : "Eksik"}</span>
              <span>Teklif netliği: {item.hasClearOffer ? "Net" : "Zayıf"}</span>
              <span>Marka görünürlüğü: {item.brandVisible ? "Var" : "Bilinmiyor"}</span>
              <span>Yorgunluk riski: {item.fatigueRisk ? "Var" : "Düşük"}</span>
            </div>
            <p className="mt-3 text-xs font-bold text-slate-500">Öneri: {item.recommendedVariation}</p>
          </article>)}
          {!creativeAnalysis.items?.length && <p className="rounded-[14px] border border-dashed border-slate-300 p-4 text-sm text-slate-500">Görsel/video verisi yok. Reklam başlığı ve metni üzerinden öneriler üretilir.</p>}
        </div>
      </div>
      <div className="rounded-[20px] border border-slate-200 bg-white p-6">
        {sectionTitle("Kreatif Varyasyon Önerileri", "Yeni başlık, açıklama, CTA, video ve statik görsel fikirleri.", <Trophy className="text-amber-600" />)}
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div><h4 className="font-black text-slate-950">Başlık</h4>{(creativeAnalysis.suggestions?.headlines || []).map((item: string) => <p key={item} className="mt-2 rounded-[10px] bg-slate-50 p-3 text-sm text-slate-700">{item}</p>)}</div>
          <div><h4 className="font-black text-slate-950">Açıklama</h4>{(creativeAnalysis.suggestions?.descriptions || []).map((item: string) => <p key={item} className="mt-2 rounded-[10px] bg-slate-50 p-3 text-sm text-slate-700">{item}</p>)}</div>
          <div><h4 className="font-black text-slate-950">CTA</h4>{(creativeAnalysis.suggestions?.ctas || []).map((item: string) => <p key={item} className="mt-2 rounded-[10px] bg-slate-50 p-3 text-sm text-slate-700">{item}</p>)}</div>
        </div>
        <p className="mt-4 rounded-[14px] border border-slate-200 p-4 text-sm text-slate-700"><strong>Kısa video fikri:</strong> {creativeAnalysis.suggestions?.videoIdea}</p>
        <p className="mt-3 rounded-[14px] border border-slate-200 p-4 text-sm text-slate-700"><strong>Statik görsel fikri:</strong> {creativeAnalysis.suggestions?.staticIdea}</p>
      </div>
    </section>}

    {data && <section className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-[20px] border border-slate-200 bg-white p-6">
        {sectionTitle("Yorgunluk ve Trend Analizi", "Frekans, CTR, CPC, CPM, harcama ve sonuç trendleri.", <BarChart3 className="text-cyan-600" />)}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {["ctr", "cpc", "cpm", "spend", "impressions", "clicks", "leads", "messages"].map((key) => <div key={key} className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[.12em] text-slate-500">{metricExplanations[key] || key}</p>
            <div className="mt-2">{changeBadge(data.weeklyChange?.[key])}</div>
          </div>)}
        </div>
        <div className="mt-4 grid gap-2">{(trendAnalysis.rules || []).map((item: string) => <p key={item} className="rounded-[12px] border border-slate-200 p-3 text-sm text-slate-700">{item}</p>)}</div>
      </div>
      <div className="rounded-[20px] border border-slate-200 bg-white p-6">
        {sectionTitle("Rakip Doktoru", "Rakip reklam verisi bağlıysa karşı hamle önerileri üretir.", <AlertTriangle className="text-orange-600" />)}
        <p className="mt-4 rounded-[14px] bg-orange-50 p-4 text-sm leading-6 text-orange-900">{competitorAnalysis.message}</p>
        <div className="mt-4 grid gap-2">{(competitorAnalysis.counterMoves || []).map((item: string) => <p key={item} className="rounded-[12px] border border-orange-100 bg-white p-3 text-sm text-slate-700">{item}</p>)}</div>
      </div>
    </section>}

    {data && <section className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-[20px] border border-slate-200 bg-white p-6">
        {sectionTitle("AI ve Doktor Yorum Paneli", "Rule-based analiz önce hazırlanır; AI varsa metni ajans diliyle iyileştirir.", <Brain className="text-purple-600" />)}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button onClick={() => request("/api/admin/ad-insights/analyze", "POST")} disabled={Boolean(loading)} className="rounded-[12px] bg-purple-600 px-4 py-3 text-sm font-black text-white">Performansı Yorumla</button>
          <button onClick={() => request("/api/admin/ad-insights/analyze", "POST")} disabled={Boolean(loading)} className="rounded-[12px] bg-red-500 px-4 py-3 text-sm font-black text-white"><ShieldAlert size={15} className="mr-1 inline" /> Sorunları Bul</button>
          <button onClick={() => request("/api/admin/ad-insights/analyze", "POST")} disabled={Boolean(loading)} className="rounded-[12px] bg-cyan-500 px-4 py-3 text-sm font-black text-white">7 Günlük Aksiyon Planı Oluştur</button>
          <button onClick={() => request("/api/admin/ad-insights/sync", "POST")} disabled={Boolean(loading)} className="rounded-[12px] bg-slate-800 px-4 py-3 text-sm font-black text-white"><RefreshCw size={15} className="mr-1 inline" /> Analiz Snapshot’ı Kaydet</button>
        </div>
        <p className="mt-3 rounded-[12px] bg-slate-50 p-3 text-xs leading-5 text-slate-500">Analiz Snapshot’ı Kaydet: O anki reklam sağlık skoru, teşhisler, reçete aksiyonları ve müşteri özetini geçmiş analiz olarak kaydeder.</p>
        <pre className="mt-5 whitespace-pre-wrap rounded-[16px] border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">{data.analysis?.admin || "Analiz için Performansı Yorumla düğmesini kullanın."}</pre>
      </div>
      <div className="rounded-[20px] border border-slate-200 bg-white p-6">
        {sectionTitle("Müşteriye Gönderilecek Sade Özet", "Panik oluşturmayan, metrikleri sadeleştiren müşteri mesajı.", <Send className="text-cyan-600" />)}
        <p className="mt-4 whitespace-pre-wrap rounded-[16px] border border-cyan-100 bg-cyan-50 p-4 text-sm leading-7 text-slate-700">{customerMessage || "Müşteri özeti analiz sonrası burada görünür."}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => copyText(customerMessage)} className="rounded-[12px] border border-cyan-200 px-4 py-3 text-sm font-black text-cyan-700"><Copy size={15} className="mr-1 inline" /> Metni Kopyala</button>
          <button onClick={openWhatsApp} className="rounded-[12px] bg-emerald-500 px-4 py-3 text-sm font-black text-white"><MessageSquareText size={15} className="mr-1 inline" /> WhatsApp Mesajı Hazırla</button>
          <button onClick={() => window.print()} className="rounded-[12px] bg-amber-400 px-4 py-3 text-sm font-black text-slate-950"><FileText size={15} className="mr-1 inline" /> PDF Rapor Taslağı Oluştur</button>
        </div>
      </div>
    </section>}

    {!data && selectedCompany && (
      <AdminEmptyState title="Doktor analizi henüz çalıştırılmadı." description="Sol panelden müşteri, tarih ve platform filtrelerini seçip “Analiz Et” düğmesine basın." />
    )}
    </AdminWorkspace>
  );
}
