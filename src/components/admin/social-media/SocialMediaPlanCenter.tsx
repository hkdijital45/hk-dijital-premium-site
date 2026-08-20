"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
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

// Real production data model (supabase/migrations/20260610_agency_operating_system_modules.sql):
//   social_media_plans: id, company_id, sector, goal, platform, duration, plan_items jsonb, notes, created_at, updated_at
// plan_items is a schemaless jsonb array — this module extends each item with
// status/scheduled_date/responsible_user_id/notes/ai_generated/platform_variants
// fields. No migration is required: existing rows without these fields simply
// get sane defaults (status "Taslak", scheduled date derived from the plan's
// created_at + day offset).

const contentTypes = ["Reels", "Hikaye", "Gönderi", "Carousel (kaydırmalı gönderi)"];
const platformOptions = ["Instagram", "Facebook", "LinkedIn", "TikTok"];
const statusOptions = ["Taslak", "Onay Bekliyor", "Onaylandı", "Zamanlandı", "Yayına Hazır", "Arşivlendi"];

function createSocialPlanItems({ sector, goal, platform, duration }: any) {
  const count = duration === "7 gün" ? 7 : duration === "14 gün" ? 14 : 30;
  return Array.from({ length: count }, (_, index) => ({
    day: index + 1,
    contentType: contentTypes[index % contentTypes.length],
    caption: `${sector || "İşletme"} için ${goal || "Bilinirlik"} odaklı ${platform || "Instagram"} içerik fikri`,
    visualIdea: index % 2 ? "Müşteri sorusu ve çözüm anlatımı" : "Hizmet/fayda odaklı kısa video",
    cta: goal === "Satış" ? "Teklif alın" : goal === "Randevu" ? "Randevu oluşturun" : "Mesaj gönderin",
    hashtags: [`#${String(sector || "hkdijital").replace(/\s+/g, "")}`, "#dijitalpazarlama", "#yerelisletme"],
    status: "Taslak",
    scheduled_date: null,
    responsible_user_id: "",
    notes: "",
    ai_generated: false,
    platform_variants: {}
  }));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function itemDate(plan: any, item: any) {
  if (item.scheduled_date) return item.scheduled_date;
  const base = plan.created_at ? new Date(plan.created_at) : new Date();
  return toDateOnly(addDays(base, Number(item.day || 1) - 1));
}

function statusTone(status: string): "success" | "warning" | "info" | "neutral" | "danger" {
  if (status === "Onaylandı" || status === "Yayına Hazır") return "success";
  if (status === "Zamanlandı") return "info";
  if (status === "Onay Bekliyor") return "warning";
  if (status === "Arşivlendi") return "neutral";
  return "neutral";
}

function TinyField({ label, value, onChange, type = "text", placeholder = "" }: any) {
  return <label className="grid gap-1.5 text-xs font-bold text-[var(--admin-text-secondary)]">{label}<input type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-9 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-text-primary)] placeholder:text-[var(--admin-text-muted)]" /></label>;
}
function TinySelect({ label, value, onChange, options, placeholder = "Tümü" }: any) {
  return (
    <label className="grid gap-1.5 text-xs font-bold text-[var(--admin-text-secondary)]">
      {label}
      <select value={value ?? ""} onChange={(event) => onChange(event.target.value)} className="min-h-9 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-text-primary)]">
        <option value="">{placeholder}</option>
        {options.map((option: any) => typeof option === "string" ? <option key={option} value={option}>{option}</option> : <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
function TinyTextArea({ label, value, onChange, rows = 4 }: any) {
  return <label className="grid gap-1.5 text-xs font-bold text-[var(--admin-text-secondary)]">{label}<textarea rows={rows} value={value ?? ""} onChange={(event) => onChange(event.target.value)} className="rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-text-primary)]" /></label>;
}

export function SocialMediaPlanCenter({ content, setContent, save, notify }: any) {
  const plans = useMemo(() => content.socialMediaPlans || [], [content.socialMediaPlans]);
  const companies = useMemo(() => filterSelectableCustomers(content.companies || []), [content.companies]);
  const companyName = (id: string) => (content.companies || []).find((company: any) => company.id === id)?.name || "-";
  const responsibleOptions = useMemo(() => (content.users || []).map((user: any) => ({ value: user.id, label: user.full_name || user.email })), [content.users]);
  const responsibleName = (id: string) => responsibleOptions.find((option: any) => option.value === id)?.label || "Atanmadı";

  const [view, setView] = useState<"Tablo" | "Takvim">("Tablo");
  const [companyFilter, setCompanyFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [contentTypeFilter, setContentTypeFilter] = useState("");
  const [responsibleFilter, setResponsibleFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));

  function updatePlan(planId: string, patch: any) {
    setContent((current: any) => ({ ...current, socialMediaPlans: (current.socialMediaPlans || []).map((plan: any) => plan.id === planId ? { ...plan, ...patch } : plan) }));
  }
  function updateItem(planId: string, day: number, patch: any) {
    setContent((current: any) => ({
      ...current,
      socialMediaPlans: (current.socialMediaPlans || []).map((plan: any) => plan.id === planId
        ? { ...plan, plan_items: (plan.plan_items || []).map((item: any) => item.day === day ? { ...item, ...patch } : item) }
        : plan)
    }));
  }

  function addPlan() {
    const company = companies[0];
    if (!company) return notify?.("Plan oluşturmak için önce seçilebilir bir müşteri gerekiyor.", "warning");
    const base = { id: (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}`), company_id: company.id, sector: company.sector || "", goal: "Bilinirlik", platform: "Instagram", duration: "30 gün", notes: "", created_at: new Date().toISOString() };
    const plan = { ...base, plan_items: createSocialPlanItems(base) };
    setContent((current: any) => ({ ...current, socialMediaPlans: [plan, ...(current.socialMediaPlans || [])] }));
    notify?.("Yeni içerik planı taslağı oluşturuldu.", "success");
  }
  function refreshPlanCalendar(plan: any) {
    if (!confirm("Bu planın tüm günlük içerik fikirleri yeniden üretilsin mi? Mevcut düzenlemeler kaybolur.")) return;
    updatePlan(plan.id, { plan_items: createSocialPlanItems(plan) });
  }
  function deletePlan(planId: string) {
    if (!confirm("Bu içerik planını silmek istediğinize emin misiniz?")) return;
    setContent((current: any) => ({ ...current, socialMediaPlans: (current.socialMediaPlans || []).filter((plan: any) => plan.id !== planId) }));
    notify?.("İçerik planı silindi.", "success");
  }

  const flatItems = useMemo(() => plans.flatMap((plan: any) => (plan.plan_items || []).map((item: any) => ({
    key: `${plan.id}-${item.day}`,
    planId: plan.id,
    company_id: plan.company_id,
    platform: plan.platform,
    sector: plan.sector,
    goal: plan.goal,
    date: itemDate(plan, item),
    ...item
  }))), [plans]);

  const filteredItems = useMemo(() => flatItems
    .filter((item: any) => !companyFilter || item.company_id === companyFilter)
    .filter((item: any) => !platformFilter || item.platform === platformFilter)
    .filter((item: any) => !statusFilter || (item.status || "Taslak") === statusFilter)
    .filter((item: any) => !contentTypeFilter || item.contentType === contentTypeFilter)
    .filter((item: any) => !responsibleFilter || item.responsible_user_id === responsibleFilter)
    .filter((item: any) => !startDate || item.date >= startDate)
    .filter((item: any) => !endDate || item.date <= endDate)
    .filter((item: any) => !search.trim() || `${item.caption || ""} ${item.visualIdea || ""} ${item.notes || ""}`.toLocaleLowerCase("tr").includes(search.trim().toLocaleLowerCase("tr")))
    .sort((a: any, b: any) => a.date.localeCompare(b.date)), [flatItems, companyFilter, platformFilter, statusFilter, contentTypeFilter, responsibleFilter, startDate, endDate, search]);

  const selected = selectedKey ? flatItems.find((item: any) => item.key === selectedKey) || null : null;

  async function generateCaptionAi(item: any) {
    setBusyKey(item.key);
    try {
      const prompt = `${item.sector || "İşletme"} için ${item.goal || "Bilinirlik"} hedefli, ${item.platform || "Instagram"} platformunda paylaşılacak bir "${item.contentType}" içeriği için Türkçe, samimi ve satış baskısı yapmayan bir sosyal medya metni (caption) yaz. Görsel fikri: ${item.visualIdea || "-"}.`;
      const response = await fetch("/api/admin/ai-generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.output) throw new Error(data.error || "AI metni üretilemedi.");
      updateItem(item.planId, item.day, { caption: data.output, ai_generated: true });
      notify?.("AI caption üretildi.", "success");
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "AI metni üretilemedi.", "error");
    } finally {
      setBusyKey("");
    }
  }

  async function generateVariantAi(item: any, platform: string) {
    const busyId = `${item.key}-${platform}`;
    setBusyKey(busyId);
    try {
      const prompt = `Aşağıdaki sosyal medya metnini ${platform} platformunun üslubuna ve karakter sınırlarına uyacak şekilde Türkçe olarak yeniden yaz:\n\n${item.caption || ""}`;
      const response = await fetch("/api/admin/ai-generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.output) throw new Error(data.error || "Varyant üretilemedi.");
      updateItem(item.planId, item.day, { platform_variants: { ...(item.platform_variants || {}), [platform]: data.output } });
      notify?.(`${platform} varyantı üretildi.`, "success");
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "Varyant üretilemedi.", "error");
    } finally {
      setBusyKey("");
    }
  }

  function duplicateItem(item: any) {
    const plan = plans.find((candidate: any) => candidate.id === item.planId);
    if (!plan) return;
    const nextDay = Math.max(0, ...(plan.plan_items || []).map((entry: any) => Number(entry.day || 0))) + 1;
    const copy = {
      day: nextDay,
      contentType: item.contentType,
      caption: item.caption,
      visualIdea: item.visualIdea,
      cta: item.cta,
      hashtags: item.hashtags,
      status: "Taslak",
      scheduled_date: null,
      responsible_user_id: item.responsible_user_id,
      notes: item.notes,
      ai_generated: false,
      platform_variants: {}
    };
    updatePlan(plan.id, { plan_items: [...(plan.plan_items || []), copy] });
    notify?.("İçerik kopyalandı.", "success");
  }
  function archiveItem(item: any) {
    if (!confirm("Bu içeriği arşivlemek istediğinize emin misiniz?")) return;
    updateItem(item.planId, item.day, { status: "Arşivlendi" });
  }
  function deleteItem(item: any) {
    if (!confirm("Bu içeriği kalıcı olarak silmek istediğinize emin misiniz?")) return;
    setContent((current: any) => ({
      ...current,
      socialMediaPlans: (current.socialMediaPlans || []).map((plan: any) => plan.id === item.planId
        ? { ...plan, plan_items: (plan.plan_items || []).filter((entry: any) => entry.day !== item.day) }
        : plan)
    }));
    if (selectedKey === item.key) setSelectedKey("");
    notify?.("İçerik silindi.", "success");
  }

  async function persist() {
    setBusyKey("__save__");
    const ok = await save?.();
    notify?.(ok === false ? "Kaydedilemedi." : "İçerik planları kaydedildi.", ok === false ? "error" : "success");
    setBusyKey("");
  }

  const columns: AdminDataGridColumn<any>[] = [
    { key: "company", header: "Müşteri", render: (item: any) => companyName(item.company_id) },
    { key: "platform", header: "Platform", render: (item: any) => item.platform || "-" },
    { key: "content", header: "İçerik", render: (item: any) => <div className="min-w-0"><strong className="block truncate">{item.contentType}</strong><span className="block truncate text-[11px]" style={{ color: "var(--admin-text-muted)" }}>{item.caption}</span></div> },
    { key: "status", header: "Onay Durumu", render: (item: any) => <AdminStatusBadge tone={statusTone(item.status || "Taslak")}>{item.status || "Taslak"}{item.ai_generated ? " · AI" : ""}</AdminStatusBadge> },
    { key: "date", header: "Zamanlama", render: (item: any) => item.date },
    { key: "responsible", header: "Sorumlu", render: (item: any) => responsibleName(item.responsible_user_id) }
  ];

  const kpis = [
    { key: "total", label: "Toplam içerik", value: flatItems.length, icon: "📋", tone: "primary" as const },
    { key: "pending", label: "Onay bekleyen", value: flatItems.filter((item: any) => item.status === "Onay Bekliyor").length, icon: "⏳", tone: "warning" as const },
    { key: "scheduled", label: "Zamanlanan", value: flatItems.filter((item: any) => item.status === "Zamanlandı").length, icon: "🗓️", tone: "info" as const },
    { key: "ready", label: "Yayına hazır", value: flatItems.filter((item: any) => item.status === "Yayına Hazır").length, icon: "✅", tone: "success" as const }
  ];

  const calendarDays = useMemo(() => {
    const [year, month] = calendarMonth.split("-").map(Number);
    const first = new Date(year, month - 1, 1);
    const firstWeekday = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();
    const cells: { date: string | null; items: any[] }[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push({ date: null, items: [] });
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${calendarMonth}-${String(day).padStart(2, "0")}`;
      cells.push({ date: dateStr, items: filteredItems.filter((item: any) => item.date === dateStr) });
    }
    return cells;
  }, [calendarMonth, filteredItems]);

  return (
    <AdminWorkspace
      eyebrow="İçerik ve AI · Sosyal Medya"
      title="Sosyal Medya Planı"
      description="Müşteri bazlı sosyal medya içerik operasyonları; onay, zamanlama ve AI destekli caption/varyant üretimi. Gerçek platform yayını entegre değildir — durumlar dahili onay/zamanlama akışını gösterir."
      headerActions={<>
        <AdminButton compact variant={view === "Tablo" ? "info" : "secondary"} onClick={() => setView("Tablo")}>Tablo</AdminButton>
        <AdminButton compact variant={view === "Takvim" ? "info" : "secondary"} onClick={() => setView("Takvim")}>Takvim</AdminButton>
        <AdminButton compact variant="primary" onClick={addPlan}>+ Yeni Plan</AdminButton>
      </>}
      leftPanel={
        <AdminControlPanel>
          <AdminFilterSection title="Filtreler">
            <div className="grid gap-2">
              <TinyField label="Ara" value={search} onChange={setSearch} placeholder="Caption, görsel fikri, not..." />
              <TinySelect label="Müşteri" value={companyFilter} onChange={setCompanyFilter} options={companies.map((company: any) => ({ value: company.id, label: company.name }))} />
              <TinySelect label="Platform" value={platformFilter} onChange={setPlatformFilter} options={platformOptions} />
              <TinySelect label="Onay Durumu" value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
              <TinySelect label="İçerik Türü" value={contentTypeFilter} onChange={setContentTypeFilter} options={contentTypes} />
              <TinySelect label="Sorumlu Kullanıcı" value={responsibleFilter} onChange={setResponsibleFilter} options={responsibleOptions} />
              <TinyField label="Başlangıç tarihi" type="date" value={startDate} onChange={setStartDate} />
              <TinyField label="Bitiş tarihi" type="date" value={endDate} onChange={setEndDate} />
              <AdminButton compact variant="secondary" onClick={() => { setCompanyFilter(""); setPlatformFilter(""); setStatusFilter(""); setContentTypeFilter(""); setResponsibleFilter(""); setStartDate(""); setEndDate(""); setSearch(""); }}>Filtreleri Temizle</AdminButton>
            </div>
          </AdminFilterSection>
          <AdminFilterSection title="Planlar">
            <div className="grid gap-1.5">
              {plans.map((plan: any) => (
                <div key={plan.id} className="rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2 text-xs">
                  <strong className="block truncate">{companyName(plan.company_id)}</strong>
                  <span style={{ color: "var(--admin-text-muted)" }}>{plan.platform} · {plan.duration} · {(plan.plan_items || []).length} içerik</span>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <button type="button" onClick={() => refreshPlanCalendar(plan)} className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-black text-cyan-800">Takvimi Yenile</button>
                    <button type="button" onClick={() => deletePlan(plan.id)} className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-700">Sil</button>
                  </div>
                </div>
              ))}
              {!plans.length && <p className="text-xs text-[var(--admin-text-muted)]">Henüz plan yok.</p>}
            </div>
          </AdminFilterSection>
        </AdminControlPanel>
      }
      rightPanel={
        <AdminDetailInspector
          title={selected ? `${selected.contentType} · Gün ${selected.day}` : undefined}
          subtitle={selected ? `${companyName(selected.company_id)} · ${selected.platform}` : undefined}
          emptyTitle="Bir içerik seçin"
          emptyDescription="Tablodan veya takvimden bir içeriğe tıklayarak detaylarını buradan yönetin."
          actions={selected ? <>
            <AdminButton compact variant="ai" disabled={busyKey === selected.key} onClick={() => generateCaptionAi(selected)}>{busyKey === selected.key ? "Üretiliyor..." : "AI Caption Üret"}</AdminButton>
            {selected.status === "Taslak" && <AdminButton compact variant="warning" onClick={() => updateItem(selected.planId, selected.day, { status: "Onay Bekliyor" })}>Onaya Gönder</AdminButton>}
            {selected.status === "Onay Bekliyor" && <AdminButton compact variant="success" onClick={() => updateItem(selected.planId, selected.day, { status: "Onaylandı" })}>Onayla</AdminButton>}
            {selected.status === "Onay Bekliyor" && <AdminButton compact variant="secondary" onClick={() => updateItem(selected.planId, selected.day, { status: "Taslak" })}>Reddet</AdminButton>}
            {selected.status === "Onaylandı" && <AdminButton compact variant="info" onClick={() => updateItem(selected.planId, selected.day, { status: "Zamanlandı", scheduled_date: selected.date })}>Zamanla</AdminButton>}
            {selected.status === "Zamanlandı" && <AdminButton compact variant="success" onClick={() => updateItem(selected.planId, selected.day, { status: "Yayına Hazır" })}>Yayına Hazır İşaretle</AdminButton>}
            <AdminButton compact variant="secondary" onClick={() => duplicateItem(selected)}>Kopyala</AdminButton>
            <AdminButton compact variant="warning" onClick={() => archiveItem(selected)}>Arşivle</AdminButton>
            <AdminButton compact variant="danger" onClick={() => deleteItem(selected)}>Sil</AdminButton>
          </> : undefined}
        >
          {selected && (
            <div className="grid gap-2">
              <TinyTextArea label="Caption" value={selected.caption || ""} onChange={(value: string) => updateItem(selected.planId, selected.day, { caption: value, ai_generated: false })} rows={4} />
              <TinyField label="Görsel Fikri" value={selected.visualIdea || ""} onChange={(value: string) => updateItem(selected.planId, selected.day, { visualIdea: value })} />
              <TinyField label="CTA" value={selected.cta || ""} onChange={(value: string) => updateItem(selected.planId, selected.day, { cta: value })} />
              <TinyField label="Hashtag'ler (virgülle ayırın)" value={(selected.hashtags || []).join(", ")} onChange={(value: string) => updateItem(selected.planId, selected.day, { hashtags: value.split(",").map((tag: string) => tag.trim()).filter(Boolean) })} />
              <TinyField label="Zamanlanan tarih" type="date" value={selected.scheduled_date || selected.date} onChange={(value: string) => updateItem(selected.planId, selected.day, { scheduled_date: value })} />
              <TinySelect label="Sorumlu kullanıcı" value={selected.responsible_user_id || ""} onChange={(value: string) => updateItem(selected.planId, selected.day, { responsible_user_id: value })} options={responsibleOptions} placeholder="Atanmadı" />
              <TinyTextArea label="Not" value={selected.notes || ""} onChange={(value: string) => updateItem(selected.planId, selected.day, { notes: value })} rows={2} />
              <div className="rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] p-2">
                <p className="mb-1.5 text-[10px] font-black uppercase tracking-[.1em] text-[var(--admin-text-muted)]">Platform Varyantları</p>
                <div className="grid gap-1.5">
                  {["Instagram", "LinkedIn", "Facebook"].map((platform) => (
                    <div key={platform} className="rounded-[8px] bg-[var(--admin-surface)] p-2">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-black text-[var(--admin-text-secondary)]">{platform}</span>
                        <button type="button" disabled={busyKey === `${selected.key}-${platform}`} onClick={() => generateVariantAi(selected, platform)} className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-black text-purple-700 disabled:opacity-50">{busyKey === `${selected.key}-${platform}` ? "Üretiliyor..." : "AI Üret"}</button>
                      </div>
                      <p className="text-xs text-[var(--admin-text-secondary)]">{selected.platform_variants?.[platform] || "Henüz üretilmedi."}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </AdminDetailInspector>
      }
      bottomBar={
        <AdminActionBar statusText={`${filteredItems.length} / ${flatItems.length} içerik gösteriliyor`}>
          <AdminButton compact variant="primary" disabled={busyKey === "__save__"} onClick={persist}>{busyKey === "__save__" ? "Kaydediliyor..." : "Kaydet"}</AdminButton>
        </AdminActionBar>
      }
    >
      <AdminCompactKpiStrip items={kpis.map((item) => ({ ...item, icon: <span>{item.icon}</span> }))} />
      {view === "Tablo" && (
        <AdminDataGrid columns={columns} rows={filteredItems} rowKey={(item: any) => item.key} activeId={selectedKey} onRowClick={(item: any) => setSelectedKey(item.key)} emptyTitle={flatItems.length ? "Filtrelere uygun içerik yok." : "Henüz içerik planı yok."} emptyDescription={flatItems.length ? "Filtreleri temizleyin." : "Sol panelden veya üst çubuktan yeni plan oluşturun."} />
      )}
      {view === "Takvim" && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => { const [y, m] = calendarMonth.split("-").map(Number); const prev = new Date(y, m - 2, 1); setCalendarMonth(prev.toISOString().slice(0, 7)); }} className="rounded-full border border-[var(--admin-border)] px-3 py-1 text-xs font-black">‹ Önceki Ay</button>
            <strong className="text-sm">{new Date(`${calendarMonth}-01`).toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}</strong>
            <button type="button" onClick={() => { const [y, m] = calendarMonth.split("-").map(Number); const next = new Date(y, m, 1); setCalendarMonth(next.toISOString().slice(0, 7)); }} className="rounded-full border border-[var(--admin-border)] px-3 py-1 text-xs font-black">Sonraki Ay ›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-[10px] font-black uppercase text-[var(--admin-text-muted)]">
            {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((day) => <div key={day} className="p-1 text-center">{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((cell, index) => (
              <div key={index} className="min-h-24 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1">
                {cell.date && <p className="text-[10px] font-black text-slate-400">{cell.date.slice(8, 10)}</p>}
                <div className="grid gap-1">
                  {cell.items.slice(0, 3).map((item: any) => (
                    <button key={item.key} type="button" onClick={() => setSelectedKey(item.key)} className={`truncate rounded-[6px] px-1.5 py-1 text-left text-[10px] font-bold ${selectedKey === item.key ? "bg-cyan-100 text-cyan-900" : "bg-[var(--admin-surface-soft)] text-[var(--admin-text-secondary)]"}`}>
                      {item.platform}: {item.contentType}
                    </button>
                  ))}
                  {cell.items.length > 3 && <span className="text-[10px] text-slate-400">+{cell.items.length - 3} daha</span>}
                </div>
              </div>
            ))}
          </div>
          {!filteredItems.length && <div className="mt-3"><AdminEmptyState title="Bu ay için içerik yok." description="Filtreleri temizleyin veya yeni bir plan oluşturun." /></div>}
        </div>
      )}
    </AdminWorkspace>
  );
}
