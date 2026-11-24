"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminConfirmDialog } from "@/components/admin/ui/AdminConfirmDialog";
import {
  TASK_NOTE_MAX,
  TASK_TITLE_MAX,
  filterPlannerTasks,
  formatTrDate,
  isDoneStatus,
  istanbulToday,
  plannerCounts,
  sortPlannerTasks,
  taskDraftMessages,
  validateTaskDraft
} from "@/lib/task-planner";

type Props = {
  content: any;
  setContent: (updater: (current: any) => any) => void;
  notify?: (message: string, type?: string) => void;
};

type Draft = { id?: string; company_id: string; due_date: string; title: string; description: string };

const inputClass = "min-h-10 w-full min-w-0 rounded-[8px] border border-slate-200 bg-white px-3 text-sm text-slate-900";

export function DashboardDailyPlan({ content, setContent, notify }: Props) {
  const today = istanbulToday();
  const [companyId, setCompanyId] = useState("");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [deleting, setDeleting] = useState<any>(null);

  const companies = useMemo(
    () => (content.companies || []).filter((company: any) => !company.deleted_at && !company.archived_at).sort((a: any, b: any) => String(a.name || "").localeCompare(String(b.name || ""), "tr")),
    [content.companies]
  );
  const companyName = useCallback((id?: string | null) => (content.companies || []).find((company: any) => company.id === id)?.name || "Müşteri bulunamadı", [content.companies]);

  const upsertTasks = useCallback((rows: any[]) => {
    setContent((current: any) => {
      const byId = new Map<string, any>((current.agencyTasks || []).map((task: any) => [task.id, task]));
      rows.forEach((row) => byId.set(row.id, { ...byId.get(row.id), ...row }));
      return { ...current, agencyTasks: Array.from(byId.values()) };
    });
  }, [setContent]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ scope: "planner" });
      if (companyId) params.set("companyId", companyId);
      if (from) params.set("from", from);
      if (to || from) params.set("to", to || from);
      const response = await fetch(`/api/admin/customer-operations?${params}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.tasks)) throw new Error(data.detail || data.error || "Görevler yüklenemedi.");
      upsertTasks(data.tasks);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Görevler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [companyId, from, to, upsertTasks]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void load(true); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);

  const tasks = useMemo(
    () => sortPlannerTasks(filterPlannerTasks(content.agencyTasks || [], { companyId, from, to: to || from })),
    [content.agencyTasks, companyId, from, to]
  );
  const counts = plannerCounts(tasks);

  function setFromDate(value: string) {
    setFrom(value);
    if (!value) setTo("");
    else if (!to || to < value) setTo(value);
  }

  async function save(task: any) {
    const response = await fetch("/api/admin/customer-operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resource: "task", item: task }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.item) throw new Error(data.detail || data.error || "Görev kaydedilemedi.");
    upsertTasks([data.item]);
    return data.item;
  }

  async function toggle(task: any) {
    if (busyId) return;
    const nextDone = !isDoneStatus(task.status);
    setBusyId(task.id);
    try {
      await save({ ...task, status: nextDone ? "Tamamlandı" : "Yapılacak", completed_at: nextDone ? new Date().toISOString() : null });
      notify?.(nextDone ? "Görev tamamlandı." : "Görev yeniden bekliyor durumuna alındı.", "success");
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "Durum güncellenemedi.", "error");
    } finally {
      setBusyId("");
    }
  }

  async function submit() {
    if (!draft || savingRef.current) return;
    const problem = validateTaskDraft(draft);
    if (problem) return notify?.(taskDraftMessages[problem], "warning");
    savingRef.current = true;
    setSaving(true);
    try {
      const existing = draft.id ? (content.agencyTasks || []).find((task: any) => task.id === draft.id) : null;
      await save({ ...(existing || {}), id: draft.id, company_id: draft.company_id, due_date: draft.due_date, title: draft.title.trim(), description: draft.description.trim(), notes: draft.description.trim(), status: existing?.status || "Yapılacak" });
      notify?.(draft.id ? "Görev güncellendi." : "Görev oluşturuldu.", "success");
      setDraft(null);
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "Görev kaydedilemedi.", "error");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      const response = await fetch("/api/admin/customer-operations", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resource: "task", id: deleting.id, company_id: deleting.company_id }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || data.error || "Görev silinemedi.");
      upsertTasks([{ id: deleting.id, archived_at: data.item?.archived_at || new Date().toISOString() }]);
      notify?.("Görev silindi.", "success");
      setDeleting(null);
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "Görev silinemedi.", "error");
    } finally {
      setBusyId("");
    }
  }

  const openNew = () => setDraft({ company_id: companyId, due_date: from && from === (to || from) ? from : today, title: "", description: "" });
  const openEdit = (task: any) => setDraft({ id: task.id, company_id: task.company_id || "", due_date: String(task.due_date || today).slice(0, 10), title: task.title || "", description: task.description || task.notes || "" });
  const isToday = from === today && (to || from) === today;

  return (
    <section className="admin-card min-w-0 rounded-[20px] p-4 sm:p-5" aria-labelledby="daily-plan-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="daily-plan-title" className="text-lg font-black" style={{ color: "var(--admin-text-primary)" }}>Bugünün Planı</h3>
          <p className="mt-1 text-sm" style={{ color: "var(--admin-text-secondary)" }}>
            {from ? `${formatTrDate(from)}${(to || from) !== from ? ` – ${formatTrDate(to)}` : ""}` : "Tüm tarihler"}{isToday ? " (bugün)" : ""} · {counts.total} görev · {counts.done} tamamlandı · {counts.pending} bekliyor
          </p>
        </div>
        <AdminButton variant="primary" compact onClick={openNew}>+ Yeni Görev</AdminButton>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-bold">
        <div className="admin-card-soft rounded-[12px] p-2"><span className="block text-lg font-black">{counts.total}</span>Toplam</div>
        <div className="admin-card-soft rounded-[12px] p-2"><span className="block text-lg font-black text-emerald-600">{counts.done}</span>Tamamlanan</div>
        <div className="admin-card-soft rounded-[12px] p-2"><span className="block text-lg font-black text-amber-600">{counts.pending}</span>Bekleyen</div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))_auto]">
        <label className="grid gap-1 text-xs font-bold text-slate-700">Müşteri
          <select className={inputClass} value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
            <option value="">Tüm müşteriler</option>
            {companies.map((company: any) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-700">Başlangıç tarihi
          <input type="date" className={inputClass} value={from} onChange={(event) => setFromDate(event.target.value)} />
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-700">Bitiş tarihi
          <input type="date" className={inputClass} value={to} min={from || undefined} disabled={!from} onChange={(event) => setTo(event.target.value || from)} />
        </label>
        <div className="flex items-end gap-2">
          <AdminButton variant="secondary" compact onClick={() => { setFrom(today); setTo(today); }}>Bugün</AdminButton>
          <AdminButton variant="secondary" compact onClick={() => { setFrom(""); setTo(""); }}>Tüm Tarihler</AdminButton>
        </div>
      </div>

      {loadError && <p role="alert" className="mt-3 rounded-[10px] border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{loadError} <button type="button" className="font-black underline" onClick={() => void load()}>Tekrar dene</button></p>}

      <div className="mt-4 min-w-0">
        <div className="hidden grid-cols-[110px_minmax(0,1fr)_minmax(0,2fr)_130px_160px] gap-3 px-3 pb-2 text-[11px] font-black uppercase tracking-wide text-slate-500 md:grid">
          <span>Tarih</span><span>Müşteri</span><span>Yapılacak İş</span><span>Durum</span><span>İşlemler</span>
        </div>
        <ul className="grid gap-2">
          {tasks.map((task: any) => {
            const done = isDoneStatus(task.status);
            const busy = busyId === task.id;
            return (
              <li key={task.id} className="admin-card-soft grid min-w-0 gap-2 rounded-[14px] p-3 md:grid-cols-[110px_minmax(0,1fr)_minmax(0,2fr)_130px_160px] md:items-center md:gap-3">
                <span className="text-sm font-bold tabular-nums">{formatTrDate(task.due_date)}</span>
                <span className="min-w-0 truncate text-sm font-bold" title={companyName(task.company_id)}>{companyName(task.company_id)}</span>
                <span className="min-w-0">
                  <span className={`block break-words text-sm font-semibold ${done ? "text-slate-500 line-through decoration-slate-400" : ""}`}>{task.title}</span>
                  {(task.description || task.notes) && <span className="mt-0.5 block line-clamp-2 break-words text-xs text-slate-500">{task.description || task.notes}</span>}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => toggle(task)}
                  aria-pressed={done}
                  aria-label={done ? "Tamamlandı, bekliyor olarak işaretle" : "Bekliyor, tamamlandı olarak işaretle"}
                  className={`min-h-9 w-fit rounded-full px-3 text-xs font-black ring-1 transition disabled:opacity-50 ${done ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"}`}
                >{busy ? "…" : done ? "✓ Tamamlandı" : "Bekliyor"}</button>
                <span className="flex gap-2">
                  <AdminButton variant="secondary" compact onClick={() => openEdit(task)} disabled={busy}>Düzenle</AdminButton>
                  <AdminButton variant="danger" compact onClick={() => setDeleting(task)} disabled={busy}>Sil</AdminButton>
                </span>
              </li>
            );
          })}
        </ul>
        {loading && !tasks.length && <p className="rounded-[14px] border border-dashed border-slate-200 p-4 text-sm text-slate-500">Görevler yükleniyor…</p>}
        {!loading && !tasks.length && !loadError && <p className="rounded-[14px] border border-dashed border-slate-200 p-4 text-sm text-slate-500">Seçili müşteri ve tarih için görev bulunmuyor.</p>}
      </div>

      {draft && (
        <div role="dialog" aria-modal="true" aria-label={draft.id ? "Görevi düzenle" : "Yeni görev"} className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4" style={{ background: "var(--admin-overlay, rgba(15,23,42,.55))" }} onMouseDown={() => !saving && setDraft(null)}>
          <form onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); void submit(); }} className="grid w-full max-w-lg min-w-0 gap-3 rounded-[20px] bg-white p-5 shadow-2xl">
            <h2 className="text-lg font-black text-slate-950">{draft.id ? "Görevi Düzenle" : "Yeni Görev"}</h2>
            <label className="grid gap-1 text-xs font-bold text-slate-700">Müşteri *
              <select required className={inputClass} value={draft.company_id} onChange={(event) => setDraft({ ...draft, company_id: event.target.value })}>
                <option value="">Müşteri seçin</option>
                {companies.map((company: any) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold text-slate-700">Görev tarihi *
              <input required type="date" className={inputClass} value={draft.due_date} onChange={(event) => setDraft({ ...draft, due_date: event.target.value })} />
            </label>
            <label className="grid gap-1 text-xs font-bold text-slate-700">Yapılacak iş *
              <input required className={inputClass} maxLength={TASK_TITLE_MAX} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Örn. Instagram reklam kampanyası hazırlanacak" />
            </label>
            <label className="grid gap-1 text-xs font-bold text-slate-700">Açıklama / ek not
              <textarea rows={3} className={`${inputClass} py-2`} maxLength={TASK_NOTE_MAX} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <AdminButton type="button" variant="secondary" onClick={() => setDraft(null)} disabled={saving}>Vazgeç</AdminButton>
              <AdminButton type="submit" variant="primary" loading={saving}>{draft.id ? "Kaydet" : "Görevi Oluştur"}</AdminButton>
            </div>
          </form>
        </div>
      )}

      <AdminConfirmDialog
        open={Boolean(deleting)}
        title="Görev silinsin mi?"
        description={deleting ? `“${deleting.title}” görevi hem Dashboard'dan hem ${companyName(deleting.company_id)} müşteri profilinden kaldırılacak.` : ""}
        confirmLabel="Sil"
        busy={Boolean(deleting) && busyId === deleting?.id}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </section>
  );
}
