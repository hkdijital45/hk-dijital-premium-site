"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/purity */

import { useMemo, useState } from "react";

const adminUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const taskHistoryFilters = ["Tümü", "Yapılacak", "Devam Ediyor", "Beklemede", "Tamamlandı", "İptal", "Arşivlenenler"];
const taskStatusOptions = ["Yapılacak", "Devam Ediyor", "Beklemede", "Tamamlandı", "İptal"];

type CustomerProfileTasksProps = {
  company: any;
  content: any;
  setContent: any;
  items: any[];
  notify?: (message: string, type?: string) => void;
  canManage?: boolean;
};

function createLocalId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const source = `${Date.now()}${Math.random()}`.replace(/\D/g, "").padEnd(32, "0").slice(0, 32);
  return `${source.slice(0, 8)}-${source.slice(8, 12)}-4${source.slice(13, 16)}-8${source.slice(17, 20)}-${source.slice(20, 32)}`;
}

function isArchivedRecord(item: any) {
  return Boolean(item?.archived_at || item?.deleted_at);
}

function dateOnly(value: any) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function matchesTaskDate(item: any, startDate = "", endDate = "") {
  const date = dateOnly(item.due_date || item.completed_at || item.updated_at || item.created_at);
  if (!date) return true;
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

function filterTasks(items: any[], filters: any = {}) {
  const { status = "Tümü", startDate = "", endDate = "" } = filters;
  return (items || []).filter((item) => {
    const archived = isArchivedRecord(item);
    if (status === "Arşivlenenler") {
      if (!archived) return false;
    } else if (archived) {
      return false;
    } else if (status !== "Tümü" && (item.status || "Yapılacak") !== status) {
      return false;
    }
    return matchesTaskDate(item, startDate, endDate);
  });
}

function stampTaskStatus(item: any, status: string) {
  const now = new Date().toISOString();
  return {
    ...item,
    status,
    completed_at: status === "Tamamlandı" ? (item.completed_at || now) : null,
    cancelled_at: status === "İptal" ? (item.cancelled_at || now) : null,
    archived_at: status === "Yapılacak" ? null : item.archived_at || null,
    deleted_at: status === "Yapılacak" ? null : item.deleted_at || null,
    updated_at: now
  };
}

function TaskField({ label, value, onChange, type = "text", placeholder = "" }: any) {
  return <label className="grid gap-2 text-sm font-semibold text-slate-700">{label}<input type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-11 rounded-[8px] border border-slate-200 bg-slate-50 px-3 text-slate-900 placeholder:text-slate-500" /></label>;
}

function TaskTextArea({ label, value, onChange, rows = 4 }: any) {
  return <label className="grid gap-2 text-sm font-semibold text-slate-700">{label}<textarea rows={rows} value={value ?? ""} onChange={(event) => onChange(event.target.value)} className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-3 text-slate-900" /></label>;
}

function TaskSelectField({ label, value, onChange, options, placeholder = "Seçin" }: any) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <select value={value ?? ""} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-[8px] border border-slate-200 bg-slate-50 px-3 text-slate-900">
        <option value="">{placeholder}</option>
        {options.map((option: any) => typeof option === "string" ? <option key={option} value={option}>{option}</option> : <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function CustomerProfileTasks({ company, content, setContent, items, notify, canManage = true }: CustomerProfileTasksProps) {
  const [statusFilter, setStatusFilter] = useState("Tümü");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busyId, setBusyId] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");

  const taskTemplates = useMemo(() => [
    { key: "onboarding", title: "Yeni müşteri onboarding", description: "Sözleşme, panel erişimi, hesap bağlantıları ve ilk rapor planı kontrol edilecek.", priority: "Yüksek" },
    { key: "meta_pixel", title: "Meta Pixel kurulumu", description: "Pixel ID, Conversion API, test event ve website eventleri doğrulanacak.", priority: "Kritik" },
    { key: "first_report", title: "İlk rapor hazırlığı", description: "İlk performans raporu için Meta, Google ve çalışma notları hazırlanacak.", priority: "Yüksek" },
    { key: "proposal_followup", title: "Teklif takip", description: "Teklif gönderilen lead/müşteri aranacak ve karar durumu not edilecek.", priority: "Orta" },
    { key: "payment_reminder", title: "Tahsilat hatırlatma", description: "Vadesi yaklaşan veya geciken ödeme için müşteriye hatırlatma yapılacak.", priority: "Yüksek" },
    { key: "content_plan", title: "İçerik planı", description: "Haftalık sosyal medya içerik başlıkları ve kreatif ihtiyaçları çıkarılacak.", priority: "Orta" },
    { key: "campaign_check", title: "Kampanya kontrol", description: "Aktif kampanyaların bütçe, CTR, CPC ve lead maliyetleri kontrol edilecek.", priority: "Yüksek" },
    { key: "satisfaction_call", title: "Müşteri memnuniyet araması", description: "Müşteriyle son durum, beklenti ve memnuniyet görüşmesi yapılacak.", priority: "Orta" }
  ], []);

  const updateLocal = (id: string, patch: any) => setContent((current: any) => ({ ...current, agencyTasks: (current.agencyTasks || []).map((item: any) => item.id === id ? { ...item, ...patch } : item) }));
  const sortedItems = filterTasks(items, { status: statusFilter, startDate, endDate })
    .filter((item: any) => !item.parent_task_id)
    .sort((a: any, b: any) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.due_date || "").localeCompare(String(b.due_date || "")));
  const subtasksFor = (parentId: string) => (items || [])
    .filter((item: any) => item.parent_task_id === parentId && !isArchivedRecord(item))
    .sort((a: any, b: any) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

  function add() {
    const draft = { id: createLocalId(), _draft: true, isNew: true, company_id: company.id, title: "", description: "", notes: "", status: "Yapılacak", priority: "Orta", due_date: new Date().toISOString().slice(0, 10), assigned_user_id: "", visible_to_customer: false, sort_order: (items || []).length + 1, recurring_rule: "", reminder_at: "", metadata: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    setContent((current: any) => ({ ...current, agencyTasks: [draft, ...(current.agencyTasks || [])] }));
    notify?.("Görev taslağı açıldı. Başlık girip Kaydet düğmesine basın.", "info");
  }

  function addSubtask(parent: any) {
    const draft = { id: createLocalId(), _draft: true, isNew: true, company_id: company.id, parent_task_id: parent.id, is_subtask: true, title: "", description: "", status: "Yapılacak", priority: parent.priority || "Orta", due_date: parent.due_date || "", visible_to_customer: parent.visible_to_customer || false, sort_order: subtasksFor(parent.id).length + 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    setContent((current: any) => ({ ...current, agencyTasks: [draft, ...(current.agencyTasks || [])] }));
    notify?.("Alt görev taslağı açıldı.", "info");
  }

  function addFromTemplate(template: any) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (template.key === "payment_reminder" ? 2 : 3));
    const draft = { id: createLocalId(), _draft: true, isNew: true, company_id: company.id, title: template.title, description: template.description, notes: template.description, status: "Yapılacak", priority: template.priority, due_date: dueDate.toISOString().slice(0, 10), visible_to_customer: false, template_key: template.key, sort_order: (items || []).length + 1, metadata: { source: "template" }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    setContent((current: any) => ({ ...current, agencyTasks: [draft, ...(current.agencyTasks || [])] }));
    notify?.("Şablondan görev taslağı oluşturuldu.", "success");
  }

  function createAiDraft() {
    const text = aiPrompt.trim();
    if (!text) return notify?.("AI görev metni boş olamaz.", "warning");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + (text.includes("yarın") ? 1 : text.includes("hafta") ? 7 : 2));
    const priority = /kritik|acil|önemli/i.test(text) ? "Kritik" : /düşük/i.test(text) ? "Düşük" : "Orta";
    const title = text.length > 72 ? `${text.slice(0, 69)}...` : text;
    const draft = { id: createLocalId(), _draft: true, isNew: true, company_id: company.id, title, description: text, notes: text, status: "Yapılacak", priority, due_date: tomorrow.toISOString().slice(0, 10), visible_to_customer: false, ai_generated: true, sort_order: (items || []).length + 1, metadata: { ai_prompt: text, parser: "local-fallback" }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    setContent((current: any) => ({ ...current, agencyTasks: [draft, ...(current.agencyTasks || [])] }));
    setAiPrompt("");
    notify?.("AI görev taslağı oluşturuldu. Kontrol edip Kaydet düğmesine basın.", "success");
  }

  async function persist(item: any, patch: any = {}, successMessage = "Görev kaydedildi.") {
    const candidate = { ...item, ...patch, company_id: company.id };
    if (!String(candidate.title || "").trim()) {
      notify?.("Görev başlığı zorunludur.", "warning");
      return null;
    }
    setBusyId(item.id);
    try {
      const response = await fetch("/api/admin/customer-operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resource: "task", item: candidate }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.item) throw new Error(data.detail || data.error || "Görev kaydedilemedi.");
      const refreshed = await fetch(`/api/admin/customer-operations?companyId=${encodeURIComponent(company.id)}`).then((res) => res.json()).catch(() => null);
      setContent((current: any) => ({
        ...current,
        agencyTasks: Array.isArray(refreshed?.tasks)
          ? [...refreshed.tasks, ...(current.agencyTasks || []).filter((currentItem: any) => currentItem.company_id !== company.id)]
          : (current.agencyTasks || []).map((currentItem: any) => currentItem.id === item.id ? data.item : currentItem)
      }));
      notify?.(successMessage, "success");
      return data.item;
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "Görev kaydedilemedi.", "error");
      return null;
    } finally {
      setBusyId("");
    }
  }

  async function archive(item: any) {
    if (!confirm("Bu görevi arşivlemek istediğinize emin misiniz?")) return;
    if (!adminUuidPattern.test(String(item.id || ""))) {
      setContent((current: any) => ({ ...current, agencyTasks: (current.agencyTasks || []).filter((currentItem: any) => currentItem.id !== item.id) }));
      notify?.("Kaydedilmemiş görev taslağı kaldırıldı.", "info");
      return;
    }
    setBusyId(item.id);
    try {
      const response = await fetch("/api/admin/customer-operations", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resource: "task", id: item.id, company_id: company.id }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || data.error || "Görev arşivlenemedi.");
      updateLocal(item.id, { archived_at: data.item?.archived_at || new Date().toISOString() });
      notify?.("Görev arşivlendi.", "success");
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "Görev arşivlenemedi.", "error");
    } finally {
      setBusyId("");
    }
  }

  async function moveTask(item: any, direction: number) {
    const nextOrder = Math.max(0, Number(item.sort_order || 0) + direction);
    updateLocal(item.id, { sort_order: nextOrder });
    if (adminUuidPattern.test(String(item.id || ""))) await persist({ ...item, sort_order: nextOrder }, {}, "Görev sırası güncellendi.");
  }

  return <div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-slate-900">Yapılacaklar</h3><p className="mt-1 text-sm text-slate-500">Görevler doğrudan Supabase’e kaydedilir ve Görevler modülüyle aynı kayıtları kullanır.</p></div>{canManage && <button onClick={add} className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-black text-white">Görev Ekle</button>}</div>
    <div className="mb-4 grid gap-3 rounded-[14px] border border-slate-200 bg-white p-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <TaskField label="AI ile görev oluştur" value={aiPrompt} onChange={setAiPrompt} placeholder="Örn: ACN için pixel kontrolü yap, yarına kritik görev oluştur" />
        <button onClick={createAiDraft} className="self-end rounded-[10px] bg-purple-600 px-4 py-3 text-sm font-black text-white">AI Taslak Oluştur</button>
      </div>
      <div className="flex flex-wrap gap-2">{taskTemplates.map((template) => <button key={template.key} onClick={() => addFromTemplate(template)} className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-800">{template.title}</button>)}</div>
    </div>
    <div className="mb-4 grid gap-3 md:grid-cols-4"><TaskSelectField label="Durum filtresi" value={statusFilter} onChange={setStatusFilter} options={taskHistoryFilters} /><TaskField label="Başlangıç tarihi" type="date" value={startDate} onChange={setStartDate} /><TaskField label="Bitiş tarihi" type="date" value={endDate} onChange={setEndDate} /><button onClick={() => { setStatusFilter("Tümü"); setStartDate(""); setEndDate(""); }} className="self-end rounded-[8px] border border-slate-200 px-4 py-3 text-sm font-black text-slate-700">Filtreleri Temizle</button></div>
    <div className="grid gap-3">{sortedItems.map((item: any) => {
      const overdue = item.due_date && item.due_date < new Date().toISOString().slice(0, 10) && !["Tamamlandı", "İptal"].includes(item.status);
      const reminderSoon = item.reminder_at && new Date(item.reminder_at).getTime() - Date.now() < 86400000 && !item.reminder_sent_at;
      const subtasks = subtasksFor(item.id);
      return <div key={item.id} className={`rounded-[14px] border p-4 ${overdue ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"}`}><div className="mb-3 flex flex-wrap gap-2">{overdue && <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">Geciken görev</span>}{reminderSoon && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700">Hatırlatma yaklaşıyor</span>}{item.ai_generated && <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-black text-purple-700">AI taslak</span>}{item.recurring_rule && <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">Tekrarlayan</span>}</div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><TaskField label="Başlık" value={item.title || ""} onChange={(value: string) => updateLocal(item.id, { title: value })} /><TaskSelectField label="Durum" value={item.status || "Yapılacak"} onChange={(value: string) => updateLocal(item.id, stampTaskStatus(item, value))} options={taskStatusOptions} /><TaskSelectField label="Öncelik" value={item.priority || "Orta"} onChange={(value: string) => updateLocal(item.id, { priority: value })} options={["Düşük", "Orta", "Yüksek", "Kritik"]} /><TaskField label="Sıra" type="number" value={item.sort_order || 0} onChange={(value: string) => updateLocal(item.id, { sort_order: Number(value || 0) })} /><TaskField label="Son tarih" type="date" value={item.due_date || ""} onChange={(value: string) => updateLocal(item.id, { due_date: value })} /><TaskField label="Hatırlatma" type="datetime-local" value={String(item.reminder_at || "").slice(0, 16)} onChange={(value: string) => updateLocal(item.id, { reminder_at: value })} /><TaskSelectField label="Tekrar" value={item.recurring_rule || ""} onChange={(value: string) => updateLocal(item.id, { recurring_rule: value })} options={["", "Günlük", "Haftalık", "Aylık", "Özel"]} placeholder="Tekrar yok" /><TaskField label="Tekrar bitişi" type="date" value={item.recurring_until || ""} onChange={(value: string) => updateLocal(item.id, { recurring_until: value })} /><TaskSelectField label="Atanan kullanıcı" value={item.assigned_user_id || ""} onChange={(value: string) => updateLocal(item.id, { assigned_user_id: value })} options={(content.users || []).map((user: any) => ({ value: user.id, label: user.full_name || user.email }))} placeholder="Atanmadı" /><label className="flex items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={Boolean(item.visible_to_customer)} onChange={(event) => updateLocal(item.id, { visible_to_customer: event.target.checked })} /> Müşteriye görünür</label><div className="md:col-span-2 xl:col-span-4"><TaskTextArea label="Açıklama / not" value={item.description || item.notes || ""} onChange={(value: string) => updateLocal(item.id, { description: value, notes: value })} /></div></div>{subtasks.length > 0 && <div className="mt-4 rounded-[12px] border border-slate-200 bg-white p-3"><p className="mb-2 text-xs font-black uppercase tracking-[.12em] text-slate-500">Alt görevler</p><div className="grid gap-2">{subtasks.map((subtask: any) => <div key={subtask.id} className="grid gap-2 rounded-[10px] bg-slate-50 p-3 md:grid-cols-[1fr_150px_auto]"><TaskField label="Alt görev" value={subtask.title || ""} onChange={(value: string) => updateLocal(subtask.id, { title: value })} /><TaskSelectField label="Durum" value={subtask.status || "Yapılacak"} onChange={(value: string) => updateLocal(subtask.id, stampTaskStatus(subtask, value))} options={taskStatusOptions} /><button disabled={busyId === subtask.id} onClick={() => persist(subtask)} className="self-end rounded-[8px] bg-cyan-500 px-3 py-2 text-xs font-black text-white">Kaydet</button></div>)}</div></div>}<div className="mt-4 flex flex-wrap justify-end gap-2">{canManage && <button disabled={busyId === item.id} onClick={() => moveTask(item, -1)} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-black text-slate-700">Yukarı</button>}{canManage && <button disabled={busyId === item.id} onClick={() => moveTask(item, 1)} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-black text-slate-700">Aşağı</button>}{canManage && <button disabled={busyId === item.id} onClick={() => addSubtask(item)} className="rounded-full border border-blue-300 px-4 py-2 text-xs font-black text-blue-700">Alt Görev Ekle</button>}{canManage && <button disabled={busyId === item.id} onClick={() => archive(item)} className="rounded-full border border-amber-300 px-4 py-2 text-xs font-black text-amber-700 disabled:opacity-50">Arşivle</button>}{canManage && <button disabled={busyId === item.id} onClick={() => persist(item, stampTaskStatus(item, item.status === "Tamamlandı" ? "Yapılacak" : "Tamamlandı"), item.status === "Tamamlandı" ? "Görev yeniden açıldı." : "Görev tamamlandı.")} className="rounded-full border border-emerald-300 px-4 py-2 text-xs font-black text-emerald-700 disabled:opacity-50">{item.status === "Tamamlandı" ? "Tekrar Aç" : "Tamamlandı Yap"}</button>}{canManage && <button disabled={busyId === item.id} onClick={() => persist(item)} className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-black text-white disabled:opacity-50">{busyId === item.id ? "Kaydediliyor..." : "Kaydet"}</button>}</div></div>;
    })}{!sortedItems.length && <p className="rounded-[12px] border border-dashed border-slate-200 p-5 text-sm text-slate-500">Bu müşteri için görev kaydı bulunamadı.</p>}</div>
  </div>;
}
