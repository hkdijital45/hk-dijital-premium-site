"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/purity */

import { useMemo, useState } from "react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";
import { AdminWorkspace } from "@/components/admin/workspace/AdminWorkspace";
import { AdminControlPanel, AdminFilterSection } from "@/components/admin/workspace/AdminControlPanel";
import { AdminDataGrid, type AdminDataGridColumn } from "@/components/admin/workspace/AdminDataGrid";
import { AdminDetailInspector } from "@/components/admin/workspace/AdminDetailInspector";
import { AdminActionBar } from "@/components/admin/workspace/AdminActionBar";

const adminUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const taskHistoryFilters = ["Tümü", "Yapılacak", "Devam Ediyor", "Beklemede", "Tamamlandı", "İptal", "Arşivlenenler"];
const taskStatusOptions = ["Yapılacak", "Devam Ediyor", "Beklemede", "Tamamlandı", "İptal"];
const taskPriorityOptions = ["Düşük", "Orta", "Yüksek", "Kritik"];

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
  return <label className="grid gap-1.5 text-xs font-bold text-[var(--admin-text-secondary)]">{label}<input type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-9 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-text-primary)] placeholder:text-[var(--admin-text-muted)]" /></label>;
}

function TaskTextArea({ label, value, onChange, rows = 4 }: any) {
  return <label className="grid gap-1.5 text-xs font-bold text-[var(--admin-text-secondary)]">{label}<textarea rows={rows} value={value ?? ""} onChange={(event) => onChange(event.target.value)} className="rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-text-primary)]" /></label>;
}

function TaskSelectField({ label, value, onChange, options, placeholder = "Seçin" }: any) {
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

export function CustomerProfileTasks({ company, content, setContent, items, notify, canManage = true }: CustomerProfileTasksProps) {
  const [statusFilter, setStatusFilter] = useState("Tümü");
  const [priorityFilter, setPriorityFilter] = useState("Tümü");
  const [responsibleFilter, setResponsibleFilter] = useState("Tümü");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busyId, setBusyId] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");

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

  const responsibleOptions = useMemo(() => (content.users || []).map((user: any) => ({ value: user.id, label: user.full_name || user.email })), [content.users]);

  const updateLocal = (id: string, patch: any) => setContent((current: any) => ({ ...current, agencyTasks: (current.agencyTasks || []).map((item: any) => item.id === id ? { ...item, ...patch } : item) }));

  const sortedItems = filterTasks(items, { status: statusFilter, startDate, endDate })
    .filter((item: any) => !item.parent_task_id)
    .filter((item: any) => priorityFilter === "Tümü" || (item.priority || "Orta") === priorityFilter)
    .filter((item: any) => responsibleFilter === "Tümü" || (item.assigned_user_id || "") === responsibleFilter)
    .filter((item: any) => !searchQuery.trim() || `${item.title || ""} ${item.description || ""}`.toLocaleLowerCase("tr").includes(searchQuery.trim().toLocaleLowerCase("tr")))
    .sort((a: any, b: any) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.due_date || "").localeCompare(String(b.due_date || "")));

  const subtasksFor = (parentId: string) => (items || [])
    .filter((item: any) => item.parent_task_id === parentId && !isArchivedRecord(item))
    .sort((a: any, b: any) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

  function add() {
    const draft = { id: createLocalId(), _draft: true, isNew: true, company_id: company.id, title: "", description: "", notes: "", status: "Yapılacak", priority: "Orta", due_date: new Date().toISOString().slice(0, 10), assigned_user_id: "", visible_to_customer: false, sort_order: (items || []).length + 1, recurring_rule: "", reminder_at: "", metadata: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    setContent((current: any) => ({ ...current, agencyTasks: [draft, ...(current.agencyTasks || [])] }));
    setSelectedTaskId(draft.id);
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
    setSelectedTaskId(draft.id);
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
    setSelectedTaskId(draft.id);
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
      if (selectedTaskId === item.id) setSelectedTaskId(data.item.id);
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
      if (selectedTaskId === item.id) setSelectedTaskId("");
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

  const selectedTask = selectedTaskId ? (items || []).find((item: any) => item.id === selectedTaskId) || null : null;
  const selectedSubtasks = selectedTask ? subtasksFor(selectedTask.id) : [];
  const responsibleName = (id: string) => responsibleOptions.find((option: any) => option.value === id)?.label || "Atanmadı";

  const taskColumns: AdminDataGridColumn<any>[] = [
    {
      key: "title",
      header: "Başlık",
      render: (item: any) => {
        const overdue = item.due_date && item.due_date < new Date().toISOString().slice(0, 10) && !["Tamamlandı", "İptal"].includes(item.status);
        return <div className="min-w-0">
          <strong className="block truncate">{item.title || "(Başlıksız görev)"}</strong>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {overdue && <AdminStatusBadge tone="danger">Geciken</AdminStatusBadge>}
            {item.ai_generated && <AdminStatusBadge tone="ai">AI taslak</AdminStatusBadge>}
            {item.recurring_rule && <AdminStatusBadge tone="info">Tekrarlayan</AdminStatusBadge>}
          </div>
        </div>;
      }
    },
    { key: "status", header: "Durum", render: (item: any) => <AdminStatusBadge tone={item.status === "Tamamlandı" ? "success" : item.status === "İptal" ? "neutral" : item.status === "Devam Ediyor" ? "info" : "warning"}>{item.status || "Yapılacak"}</AdminStatusBadge> },
    { key: "priority", header: "Öncelik", render: (item: any) => <AdminStatusBadge tone={item.priority === "Kritik" ? "danger" : item.priority === "Yüksek" ? "warning" : "neutral"}>{item.priority || "Orta"}</AdminStatusBadge> },
    { key: "assigned", header: "Sorumlu", render: (item: any) => responsibleName(item.assigned_user_id) },
    { key: "due", header: "Son Tarih", render: (item: any) => dateOnly(item.due_date) || "-" },
    { key: "subtasks", header: "Alt Görev", align: "center", render: (item: any) => {
      const subtasks = subtasksFor(item.id);
      if (!subtasks.length) return "-";
      const done = subtasks.filter((subtask: any) => subtask.status === "Tamamlandı").length;
      return `${done}/${subtasks.length}`;
    } },
    { key: "updated", header: "Son Güncelleme", render: (item: any) => dateOnly(item.updated_at) || "-" }
  ];

  return (
    <AdminWorkspace
      eyebrow="Müşteri Profili"
      title="Yapılacaklar"
      description="Görevler modülüyle aynı kayıtları kullanır. Alt görevler, AI taslak ve şablonlar seçili görevin detayında düzenlenir."
      leftPanel={
        <AdminControlPanel>
          <AdminFilterSection title="Ara ve Filtrele">
            <div className="grid gap-2">
              <TaskField label="Ara" value={searchQuery} onChange={setSearchQuery} placeholder="Başlık veya açıklamada ara..." />
              <TaskSelectField label="Durum" value={statusFilter} onChange={setStatusFilter} options={taskHistoryFilters} />
              <TaskSelectField label="Öncelik" value={priorityFilter} onChange={setPriorityFilter} options={["Tümü", ...taskPriorityOptions]} />
              <TaskSelectField label="Sorumlu kullanıcı" value={responsibleFilter} onChange={setResponsibleFilter} options={[{ value: "Tümü", label: "Tümü" }, ...responsibleOptions]} />
              <TaskField label="Başlangıç tarihi" type="date" value={startDate} onChange={setStartDate} />
              <TaskField label="Bitiş tarihi" type="date" value={endDate} onChange={setEndDate} />
              <AdminButton compact variant="secondary" onClick={() => { setStatusFilter("Tümü"); setPriorityFilter("Tümü"); setResponsibleFilter("Tümü"); setSearchQuery(""); setStartDate(""); setEndDate(""); }}>Filtreleri Temizle</AdminButton>
            </div>
          </AdminFilterSection>
          {canManage && (
            <AdminFilterSection title="AI ile Görev Oluştur">
              <div className="grid gap-2">
                <TaskTextArea label="" value={aiPrompt} onChange={setAiPrompt} rows={3} />
                <AdminButton compact variant="ai" onClick={createAiDraft}>AI Taslak Oluştur</AdminButton>
              </div>
            </AdminFilterSection>
          )}
          {canManage && (
            <AdminFilterSection title="Şablondan Ekle">
              <div className="flex flex-wrap gap-1.5">
                {taskTemplates.map((template) => <button key={template.key} onClick={() => addFromTemplate(template)} className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-black text-cyan-800">{template.title}</button>)}
              </div>
            </AdminFilterSection>
          )}
        </AdminControlPanel>
      }
      rightPanel={
        <AdminDetailInspector
          title={selectedTask ? (selectedTask.title || "(Başlıksız görev)") : undefined}
          subtitle={selectedTask ? `${selectedTask.status || "Yapılacak"} · ${selectedTask.priority || "Orta"}` : undefined}
          emptyTitle="Bir görev seçin"
          emptyDescription="Listeden bir satıra tıklayarak detaylarını buradan düzenleyin."
          actions={selectedTask ? <>
            {canManage && <AdminButton compact variant="secondary" disabled={busyId === selectedTask.id} onClick={() => moveTask(selectedTask, -1)}>Yukarı</AdminButton>}
            {canManage && <AdminButton compact variant="secondary" disabled={busyId === selectedTask.id} onClick={() => moveTask(selectedTask, 1)}>Aşağı</AdminButton>}
            {canManage && <AdminButton compact variant="info" disabled={busyId === selectedTask.id} onClick={() => addSubtask(selectedTask)}>Alt Görev Ekle</AdminButton>}
            {canManage && <AdminButton compact variant="warning" disabled={busyId === selectedTask.id} onClick={() => archive(selectedTask)}>Arşivle</AdminButton>}
            {canManage && <AdminButton compact variant="success" disabled={busyId === selectedTask.id} onClick={() => persist(selectedTask, stampTaskStatus(selectedTask, selectedTask.status === "Tamamlandı" ? "Yapılacak" : "Tamamlandı"), selectedTask.status === "Tamamlandı" ? "Görev yeniden açıldı." : "Görev tamamlandı.")}>{selectedTask.status === "Tamamlandı" ? "Tekrar Aç" : "Tamamlandı Yap"}</AdminButton>}
            {canManage && <AdminButton compact variant="primary" disabled={busyId === selectedTask.id} onClick={() => persist(selectedTask)}>{busyId === selectedTask.id ? "Kaydediliyor..." : "Kaydet"}</AdminButton>}
          </> : undefined}
        >
          {selectedTask && (
            <div className="grid gap-3">
              <div className="grid gap-2">
                <TaskField label="Başlık" value={selectedTask.title || ""} onChange={(value: string) => updateLocal(selectedTask.id, { title: value })} />
                <div className="grid grid-cols-2 gap-2">
                  <TaskSelectField label="Durum" value={selectedTask.status || "Yapılacak"} onChange={(value: string) => updateLocal(selectedTask.id, stampTaskStatus(selectedTask, value))} options={taskStatusOptions} />
                  <TaskSelectField label="Öncelik" value={selectedTask.priority || "Orta"} onChange={(value: string) => updateLocal(selectedTask.id, { priority: value })} options={taskPriorityOptions} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <TaskField label="Son tarih" type="date" value={selectedTask.due_date || ""} onChange={(value: string) => updateLocal(selectedTask.id, { due_date: value })} />
                  <TaskField label="Hatırlatma" type="datetime-local" value={String(selectedTask.reminder_at || "").slice(0, 16)} onChange={(value: string) => updateLocal(selectedTask.id, { reminder_at: value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <TaskSelectField label="Tekrar" value={selectedTask.recurring_rule || ""} onChange={(value: string) => updateLocal(selectedTask.id, { recurring_rule: value })} options={["", "Günlük", "Haftalık", "Aylık", "Özel"]} placeholder="Tekrar yok" />
                  <TaskField label="Tekrar bitişi" type="date" value={selectedTask.recurring_until || ""} onChange={(value: string) => updateLocal(selectedTask.id, { recurring_until: value })} />
                </div>
                <TaskSelectField label="Atanan kullanıcı" value={selectedTask.assigned_user_id || ""} onChange={(value: string) => updateLocal(selectedTask.id, { assigned_user_id: value })} options={responsibleOptions} placeholder="Atanmadı" />
                <label className="flex items-center gap-2 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2.5 py-2 text-xs font-bold text-[var(--admin-text-secondary)]"><input type="checkbox" checked={Boolean(selectedTask.visible_to_customer)} onChange={(event) => updateLocal(selectedTask.id, { visible_to_customer: event.target.checked })} /> Müşteriye görünür</label>
                <TaskTextArea label="Açıklama / not" value={selectedTask.description || selectedTask.notes || ""} onChange={(value: string) => updateLocal(selectedTask.id, { description: value, notes: value })} />
              </div>
              <div className="rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] p-2">
                <p className="mb-1.5 text-[10px] font-black uppercase tracking-[.1em] text-[var(--admin-text-muted)]">Alt görevler{selectedSubtasks.length ? ` (${selectedSubtasks.length})` : ""}</p>
                {selectedSubtasks.length > 0 ? (
                  <div className="grid gap-1.5">
                    {selectedSubtasks.map((subtask: any) => (
                      <div key={subtask.id} className="grid gap-1.5 rounded-[8px] bg-[var(--admin-surface)] p-2 md:grid-cols-[1fr_140px_auto]">
                        <TaskField label="Alt görev" value={subtask.title || ""} onChange={(value: string) => updateLocal(subtask.id, { title: value })} />
                        <TaskSelectField label="Durum" value={subtask.status || "Yapılacak"} onChange={(value: string) => updateLocal(subtask.id, stampTaskStatus(subtask, value))} options={taskStatusOptions} />
                        {canManage && <AdminButton compact variant="primary" disabled={busyId === subtask.id} onClick={() => persist(subtask)}>{busyId === subtask.id ? "Kaydediliyor..." : "Kaydet"}</AdminButton>}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-[var(--admin-text-muted)]">Bu göreve bağlı alt görev yok.</p>}
              </div>
            </div>
          )}
        </AdminDetailInspector>
      }
      bottomBar={
        <AdminActionBar statusText={`${sortedItems.length} görev listeleniyor`}>
          {canManage && <AdminButton compact variant="primary" onClick={add}>+ Görev Ekle</AdminButton>}
        </AdminActionBar>
      }
    >
      <AdminDataGrid
        columns={taskColumns}
        rows={sortedItems}
        rowKey={(item: any) => item.id}
        activeId={selectedTaskId}
        onRowClick={(item: any) => setSelectedTaskId(item.id)}
        emptyTitle="Bu müşteri için görev kaydı bulunamadı."
        emptyDescription="Filtreleri temizleyin ya da yeni bir görev ekleyin."
      />
    </AdminWorkspace>
  );
}
