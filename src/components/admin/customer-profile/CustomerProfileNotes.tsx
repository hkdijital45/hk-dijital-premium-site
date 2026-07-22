/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { AdminWorkspace } from "@/components/admin/workspace/AdminWorkspace";
import { AdminControlPanel, AdminFilterSection } from "@/components/admin/workspace/AdminControlPanel";
import { AdminDetailInspector } from "@/components/admin/workspace/AdminDetailInspector";
import { AdminActionBar } from "@/components/admin/workspace/AdminActionBar";

const noteCategories = ["Genel", "Satış", "Teknik", "Finans", "Müşteri İlişkisi"];

type CustomerNote = {
  id: string;
  company_id: string;
  content: string;
  category: string;
  is_pinned: boolean;
  created_by_name?: string | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function CustomerProfileNotes({ company, notify, canManage = true }: { company: any; notify?: (message: string, type?: string) => void; canManage?: boolean }) {
  const [notes, setNotes] = useState<CustomerNote[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Tümü");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [draft, setDraft] = useState("");
  const [draftCategory, setDraftCategory] = useState("Genel");
  const [draftPinned, setDraftPinned] = useState(false);
  const [busy, setBusy] = useState(false);

  async function loadNotes() {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch(`/api/admin/customers/${company.id}/notes`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || data.error || "Notlar yüklenemedi.");
      setNotes(Array.isArray(data.notes) ? data.notes : []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Notlar yüklenemedi.");
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotes();
  }, [company.id]);

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr");
    return (notes || [])
      .filter((note) => (categoryFilter === "Tümü" ? true : note.category === categoryFilter))
      .filter((note) => (pinnedOnly ? note.is_pinned : true))
      .filter((note) => (query ? note.content.toLocaleLowerCase("tr").includes(query) : true))
      .sort((a, b) => (Number(b.is_pinned) - Number(a.is_pinned)) || String(b.created_at).localeCompare(String(a.created_at)));
  }, [notes, search, categoryFilter, pinnedOnly]);

  const selectedNote = selectedNoteId ? (notes || []).find((note) => note.id === selectedNoteId) || null : null;

  async function addNote() {
    const text = draft.trim();
    if (!text) return notify?.("Not içeriği boş olamaz.", "warning");
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/customers/${company.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, category: draftCategory, is_pinned: draftPinned })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || data.error || "Not eklenemedi.");
      setNotes((current) => [data.note, ...(current || [])]);
      setDraft("");
      setDraftPinned(false);
      notify?.("Not eklendi.", "success");
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "Not eklenemedi.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function updateNote(noteId: string, patch: Record<string, unknown>, successMessage: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/customers/${company.id}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: noteId, ...patch })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || data.error || "Not güncellenemedi.");
      setNotes((current) => (current || []).map((note) => (note.id === noteId ? data.note : note)));
      notify?.(successMessage, "success");
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "Not güncellenemedi.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function archiveNote(noteId: string) {
    if (!confirm("Bu notu arşivlemek istediğinize emin misiniz?")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/customers/${company.id}/notes`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: noteId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || data.error || "Not arşivlenemedi.");
      setNotes((current) => (current || []).map((note) => (note.id === noteId ? data.note : note)));
      if (selectedNoteId === noteId) setSelectedNoteId("");
      notify?.("Not arşivlendi.", "success");
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "Not arşivlenemedi.", "error");
    } finally {
      setBusy(false);
    }
  }

  const pinnedCount = (notes || []).filter((note) => note.is_pinned && !note.archived_at).length;
  const activeCount = (notes || []).filter((note) => !note.archived_at).length;

  return (
    <AdminWorkspace
      eyebrow="Müşteri Profili"
      title="Dahili Notlar"
      description="Sadece admin ekibi görür; müşteri panelinde gösterilmez. Aramaya, kategoriye ve sabitlenmiş notlara göre filtreleyin."
      leftPanel={
        <AdminControlPanel>
          <AdminFilterSection title="Ara ve Filtrele">
            <div className="grid gap-2">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Not içinde ara..."
                className="min-h-9 rounded-[8px] border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 placeholder:text-slate-500"
              />
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="min-h-9 rounded-[8px] border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900">
                <option value="Tümü">Tüm kategoriler</option>
                {noteCategories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <input type="checkbox" checked={pinnedOnly} onChange={(event) => setPinnedOnly(event.target.checked)} /> Sadece sabitlenenler
              </label>
            </div>
          </AdminFilterSection>
          {canManage && (
            <AdminFilterSection title="Hızlı Not Ekle">
              <div className="grid gap-2">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={4}
                  placeholder="Yeni dahili not..."
                  className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                />
                <select value={draftCategory} onChange={(event) => setDraftCategory(event.target.value)} className="min-h-9 rounded-[8px] border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900">
                  {noteCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input type="checkbox" checked={draftPinned} onChange={(event) => setDraftPinned(event.target.checked)} /> Sabitlenmiş olarak ekle
                </label>
                <AdminButton compact variant="primary" disabled={busy || !draft.trim()} onClick={addNote}>{busy ? "Ekleniyor..." : "+ Not Ekle"}</AdminButton>
              </div>
            </AdminFilterSection>
          )}
        </AdminControlPanel>
      }
      rightPanel={
        <AdminDetailInspector
          title={selectedNote ? `${selectedNote.category} notu` : undefined}
          subtitle={selectedNote ? `${selectedNote.created_by_name || "Bilinmeyen"} · ${formatDateTime(selectedNote.created_at)}` : undefined}
          emptyTitle="Bir not seçin"
          emptyDescription="Listeden bir nota tıklayarak düzenleyin, sabitleyin veya arşivleyin."
          actions={selectedNote && canManage ? <>
            <AdminButton compact variant={selectedNote.is_pinned ? "secondary" : "success"} disabled={busy} onClick={() => updateNote(selectedNote.id, { is_pinned: !selectedNote.is_pinned }, selectedNote.is_pinned ? "Sabitleme kaldırıldı." : "Not sabitlendi.")}>
              {selectedNote.is_pinned ? "Sabitlemeyi Kaldır" : "Sabitle"}
            </AdminButton>
            <AdminButton compact variant="warning" disabled={busy} onClick={() => archiveNote(selectedNote.id)}>Arşivle</AdminButton>
          </> : undefined}
        >
          {selectedNote && (
            <div className="grid gap-2">
              <label className="grid gap-1.5 text-xs font-bold text-slate-700">
                Kategori
                <select
                  value={selectedNote.category}
                  disabled={!canManage}
                  onChange={(event) => updateNote(selectedNote.id, { category: event.target.value }, "Kategori güncellendi.")}
                  className="min-h-9 rounded-[8px] border border-slate-200 bg-white px-3 text-sm text-slate-900"
                >
                  {noteCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-slate-700">
                İçerik
                <NoteContentEditor key={selectedNote.id} note={selectedNote} canManage={canManage} busy={busy} onSave={(value) => updateNote(selectedNote.id, { content: value }, "Not güncellendi.")} />
              </label>
              <p className="text-[11px]" style={{ color: "var(--admin-text-muted)" }}>Son güncelleme: {formatDateTime(selectedNote.updated_at)}</p>
            </div>
          )}
        </AdminDetailInspector>
      }
      bottomBar={
        <AdminActionBar statusText={`${activeCount} aktif not · ${pinnedCount} sabitlenmiş`}>
          <AdminButton compact variant="secondary" onClick={loadNotes} disabled={loading}>{loading ? "Yükleniyor..." : "Yenile"}</AdminButton>
        </AdminActionBar>
      }
    >
      {loading && <p className="rounded-[8px] border border-dashed border-slate-200 p-4 text-xs text-slate-500">Notlar yükleniyor...</p>}
      {!loading && loadError && <p className="rounded-[8px] border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">{loadError}</p>}
      {!loading && !loadError && (
        <div className="grid gap-2">
          {filteredNotes.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => setSelectedNoteId(note.id)}
              className={`rounded-[10px] border p-2.5 text-left ${selectedNoteId === note.id ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-white"}`}
            >
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                {note.is_pinned && <AdminStatusBadge tone="warning">Sabitlenmiş</AdminStatusBadge>}
                <AdminStatusBadge tone="info">{note.category}</AdminStatusBadge>
                <span className="text-[11px]" style={{ color: "var(--admin-text-muted)" }}>{note.created_by_name || "Bilinmeyen"} · {formatDateTime(note.created_at)}</span>
              </div>
              <p className="line-clamp-2 text-sm text-slate-800">{note.content}</p>
            </button>
          ))}
          {!filteredNotes.length && <AdminEmptyState title="Not bulunamadı" description="Filtrelere uygun dahili not yok, ya da henüz hiç not eklenmemiş." />}
          {company.notes && (
            <div className="mt-2 rounded-[10px] border border-dashed border-slate-300 bg-slate-50 p-3">
              <p className="mb-1 text-[10px] font-black uppercase tracking-[.1em] text-slate-500">Eski not (taşınmış, salt okunur)</p>
              <p className="whitespace-pre-wrap text-sm text-slate-600">{company.notes}</p>
            </div>
          )}
        </div>
      )}
    </AdminWorkspace>
  );
}

function NoteContentEditor({ note, canManage, busy, onSave }: { note: CustomerNote; canManage: boolean; busy: boolean; onSave: (value: string) => void }) {
  const [value, setValue] = useState(note.content);
  const dirty = value.trim() !== note.content;
  return (
    <div className="grid gap-1.5">
      <textarea
        value={value}
        disabled={!canManage}
        onChange={(event) => setValue(event.target.value)}
        rows={8}
        className="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
      />
      {canManage && (
        <AdminButton compact variant="primary" disabled={busy || !dirty || !value.trim()} onClick={() => onSave(value.trim())}>
          {busy ? "Kaydediliyor..." : "Kaydet"}
        </AdminButton>
      )}
    </div>
  );
}
