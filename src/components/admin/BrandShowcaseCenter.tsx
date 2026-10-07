"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, CircleCheck, CircleOff, ImagePlus, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminConfirmDialog } from "@/components/admin/ui/AdminConfirmDialog";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";
import { BRAND_NAME_MAX, BRAND_PRESET_SERVICES, BRAND_SERVICES_MAX_COUNT, matchPresetService, normalizeServices, servicesArray, toggleService, type BrandShowcaseRow } from "@/lib/brand-showcase";

type Draft = { id: string | null; name: string; services: string[]; description: string; logoUrl: string };
const EMPTY_DRAFT: Draft = { id: null, name: "", services: [], description: "", logoUrl: "" };

export function BrandShowcaseCenter({ notify }: { notify?: (message: string, type?: string) => void }) {
  const [brands, setBrands] = useState<BrandShowcaseRow[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [serviceInput, setServiceInput] = useState("");
  const [addingCustomService, setAddingCustomService] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<BrandShowcaseRow | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoadError("");
    try {
      const response = await fetch("/api/admin/brand-showcases", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Markalar yüklenemedi.");
      setBrands(data.brands || []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Markalar yüklenemedi.");
    }
  }

  // Mount-only initial load; load is recreated each render and must not re-run.
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  const ordered = useMemo(() => [...(brands ?? [])].sort((a, b) => a.sort_order - b.sort_order), [brands]);

  function openCreate() {
    setServiceInput("");
    setAddingCustomService(false);
    setDraft({ ...EMPTY_DRAFT });
  }

  function openEdit(row: BrandShowcaseRow) {
    setServiceInput("");
    setAddingCustomService(false);
    setDraft({ id: row.id, name: row.name, services: servicesArray(row.services), description: row.description || "", logoUrl: row.logo_url || "" });
  }

  // Shared by preset checkboxes and custom-chip removal: present -> remove,
  // absent -> add through the server's own normalization (trim, case-insensitive
  // dedupe, cap) — so a legacy or custom value is never lost or duplicated.
  function togglePresetOrCustom(value: string) {
    if (!draft) return;
    setDraft({ ...draft, services: toggleService(draft.services, value) });
  }

  function commitCustomService() {
    if (!draft) return;
    const value = serviceInput.trim();
    if (!value) return;
    // Add-only (never a toggle): typing an existing service and pressing
    // Ekle must not remove it. normalizeServices silently drops the
    // case-insensitive duplicate instead.
    setDraft({ ...draft, services: normalizeServices([...draft.services, value]) });
    setServiceInput("");
    setAddingCustomService(false);
  }

  function cancelCustomService() {
    setServiceInput("");
    setAddingCustomService(false);
  }

  async function uploadLogo(file: File) {
    if (!draft) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("logo", file);
      if (draft.logoUrl) form.append("previousUrl", draft.logoUrl);
      const response = await fetch("/api/admin/brand-showcases/upload", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Logo yüklenemedi.");
      setDraft((current) => current && { ...current, logoUrl: data.url });
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "Logo yüklenemedi.", "error");
    } finally {
      setUploading(false);
    }
  }

  function handleFileInput(fileList: FileList | null) {
    const file = fileList?.[0];
    if (file) void uploadLogo(file);
  }

  async function submitDraft() {
    if (!draft) return;
    if (!draft.name.trim()) { notify?.("Firma / marka adı zorunludur.", "error"); return; }
    if (!draft.logoUrl) { notify?.("Logo yüklemeden marka kaydedilemez.", "error"); return; }
    setSaving(true);
    try {
      const payload = { name: draft.name, services: draft.services, description: draft.description, logo_url: draft.logoUrl };
      const response = await fetch(draft.id ? `/api/admin/brand-showcases/${draft.id}` : "/api/admin/brand-showcases", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Marka kaydedilemedi.");
      notify?.(draft.id ? "Marka güncellendi." : "Marka eklendi.", "success");
      setDraft(null);
      await load();
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "Marka kaydedilemedi.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: BrandShowcaseRow) {
    setBusyId(row.id);
    try {
      const response = await fetch(`/api/admin/brand-showcases/${row.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: !row.is_active }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Durum güncellenemedi.");
      setBrands((current) => (current ?? []).map((item) => (item.id === row.id ? data.brand : item)));
      notify?.(row.is_active ? "Marka pasife alındı." : "Marka aktif edildi.", "success");
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "Durum güncellenemedi.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function move(row: BrandShowcaseRow, direction: "up" | "down") {
    setBusyId(row.id);
    try {
      const response = await fetch(`/api/admin/brand-showcases/${row.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ move: direction }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Sıralama değiştirilemedi.");
      setBrands(data.brands || []);
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "Sıralama değiştirilemedi.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDeleteBrand() {
    if (!confirmDelete) return;
    setBusyId(confirmDelete.id);
    try {
      const response = await fetch(`/api/admin/brand-showcases/${confirmDelete.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Marka silinemedi.");
      setBrands((current) => (current ?? []).filter((item) => item.id !== confirmDelete.id));
      notify?.("Marka silindi.", "success");
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "Marka silinemedi.", "error");
    } finally {
      setBusyId(null);
      setConfirmDelete(null);
    }
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-black uppercase tracking-[.14em] text-[var(--admin-text-muted)]">İçerik &amp; Medya</p>
          <h2 className="mt-1 text-3xl font-black text-[var(--admin-text-primary)]">HK Dijital ile Çalışan Markalar</h2>
          <p className="mt-2 max-w-2xl text-base leading-7 text-[var(--admin-text-secondary)]">Web sitesinde gösterilen marka ve iş birliklerini buradan yönetebilirsiniz.</p>
        </div>
        <AdminButton variant="primary" icon={<Plus size={16} />} onClick={openCreate}>Yeni Marka</AdminButton>
      </header>

      {loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border p-4" style={{ borderColor: "#fecdd3", background: "#fff1f2" }}>
          <p className="text-sm font-bold text-[#9f1239]">{loadError}</p>
          <AdminButton variant="secondary" compact onClick={load}>Tekrar dene</AdminButton>
        </div>
      )}

      {brands === null && !loadError && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
          {[0, 1, 2].map((i) => <div key={i} className="h-48 rounded-[16px] border bg-[var(--admin-surface-soft)] motion-safe:animate-pulse" style={{ borderColor: "var(--admin-border)" }} />)}
        </div>
      )}

      {brands !== null && ordered.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-[16px] border border-dashed bg-[#ffffff] px-6 py-14 text-center" style={{ borderColor: "var(--admin-border)" }}>
          <span className="grid size-12 place-items-center rounded-full bg-[#f1f5f9] text-[#475569]" aria-hidden><ImagePlus size={22} /></span>
          <p className="text-lg font-black text-[#0f172a]">Henüz marka eklenmedi.</p>
          <p className="max-w-md text-sm font-semibold text-[#64748b]">Eklediğiniz markalar, logo yüklendikten ve aktif hale getirildikten sonra web sitesinde gösterilir.</p>
          <AdminButton variant="primary" compact icon={<Plus size={14} />} onClick={openCreate}>Yeni Marka</AdminButton>
        </div>
      )}

      {ordered.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Çalışan markalar">
          {ordered.map((row, index) => {
            const services = servicesArray(row.services);
            const rowBusy = busyId === row.id;
            return (
              <li key={row.id} className="grid gap-4 rounded-[16px] border bg-[#ffffff] p-4" style={{ borderColor: "var(--admin-border)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="grid size-16 shrink-0 place-items-center rounded-[12px] border bg-[#f8fafc] p-2" style={{ borderColor: "var(--admin-border)" }}>
                    {row.logo_url ? (
                      <Image src={row.logo_url} alt={`${row.name} logosu`} width={56} height={56} className="h-full w-full object-contain" unoptimized />
                    ) : (
                      <ImagePlus size={20} className="text-[#94a3b8]" aria-hidden />
                    )}
                  </div>
                  <AdminStatusBadge tone={row.is_active ? "success" : "neutral"}>{row.is_active ? "Aktif" : "Pasif"}</AdminStatusBadge>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-black text-[#0f172a]" title={row.name}>{row.name}</p>
                  {services.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {services.map((service) => (
                        <span key={service} className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-xs font-bold text-[#334155]">{service}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm font-semibold text-[#94a3b8]">Hizmet eklenmedi.</p>
                  )}
                  {row.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#64748b]">{row.description}</p>}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3" style={{ borderColor: "var(--admin-border)" }}>
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={rowBusy || index === 0} onClick={() => move(row, "up")} aria-label={`${row.name} sırasını yukarı taşı`} className="hk-icon-button"><ArrowUp size={15} /></button>
                    <button type="button" disabled={rowBusy || index === ordered.length - 1} onClick={() => move(row, "down")} aria-label={`${row.name} sırasını aşağı taşı`} className="hk-icon-button"><ArrowDown size={15} /></button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" disabled={rowBusy} onClick={() => toggleActive(row)} aria-label={row.is_active ? `${row.name} pasife al` : `${row.name} aktif et`} className="hk-icon-button" title={row.is_active ? "Pasife al" : "Aktif et"}>
                      {row.is_active ? <CircleOff size={15} /> : <CircleCheck size={15} />}
                    </button>
                    <button type="button" disabled={rowBusy} onClick={() => openEdit(row)} aria-label={`${row.name} düzenle`} className="hk-icon-button"><Pencil size={15} /></button>
                    <button type="button" disabled={rowBusy} onClick={() => setConfirmDelete(row)} aria-label={`${row.name} sil`} className="hk-icon-button text-red-600"><Trash2 size={15} /></button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {draft && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-[#0f172a]/50 p-4" onMouseDown={() => !saving && setDraft(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="brand-modal-title" className="grid max-h-[90vh] w-full max-w-lg gap-4 overflow-y-auto rounded-[16px] bg-[#ffffff] p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-[.14em] text-cyan-700">{draft.id ? "Markayı düzenle" : "Yeni marka"}</p>
                <h3 id="brand-modal-title" className="mt-1 text-xl font-black text-[#0f172a]">HK Dijital ile Çalışan Markalar</h3>
              </div>
              <button type="button" onClick={() => setDraft(null)} aria-label="Kapat" className="grid size-10 shrink-0 place-items-center rounded-[10px] border" style={{ borderColor: "var(--admin-border)" }}><X size={16} aria-hidden /></button>
            </div>

            <div
              onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => { event.preventDefault(); setDragOver(false); handleFileInput(event.dataTransfer.files); }}
              className={`grid gap-3 rounded-[12px] border-2 border-dashed p-4 text-center ${dragOver ? "border-cyan-500 bg-cyan-50" : "border-[#cbd5e1]"}`}
            >
              <div className="mx-auto grid size-20 place-items-center rounded-[12px] border bg-[#f8fafc] p-2" style={{ borderColor: "var(--admin-border)" }}>
                {uploading ? (
                  <Loader2 size={22} className="animate-spin text-[#64748b]" aria-hidden />
                ) : draft.logoUrl ? (
                  <Image src={draft.logoUrl} alt="Logo önizleme" width={64} height={64} className="h-full w-full object-contain" unoptimized />
                ) : (
                  <ImagePlus size={22} className="text-[#94a3b8]" aria-hidden />
                )}
              </div>
              <p className="text-sm font-bold text-[#334155]">Logoyu buraya sürükleyin veya seçin</p>
              <p className="text-xs font-semibold text-[#64748b]">PNG, JPG veya WEBP · maksimum 5 MB</p>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={(event) => handleFileInput(event.target.files)} />
              <AdminButton variant="secondary" compact disabled={uploading} onClick={() => fileInputRef.current?.click()}>Dosya Seç</AdminButton>
            </div>

            <label className="grid gap-1.5 text-sm font-bold text-[#334155]">
              Firma / Marka Adı
              <input value={draft.name} maxLength={BRAND_NAME_MAX} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="min-h-11 rounded-[10px] border bg-[#ffffff] px-3 text-base font-semibold text-[#0f172a]" style={{ borderColor: "var(--admin-border)" }} />
            </label>

            <div className="grid gap-3">
              <p className="text-sm font-bold text-[#334155]">Verdiğimiz Hizmetler</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {BRAND_PRESET_SERVICES.map((preset) => {
                  const checked = draft.services.some((service) => service.toLocaleLowerCase("tr") === preset.toLocaleLowerCase("tr"));
                  const capped = !checked && draft.services.length >= BRAND_SERVICES_MAX_COUNT;
                  return (
                    <label
                      key={preset}
                      className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[10px] border px-3 text-sm font-bold transition ${capped ? "cursor-not-allowed opacity-50" : ""}`}
                      style={checked ? { borderColor: "#0e7490", background: "#ecfeff", color: "#0e7490" } : { borderColor: "var(--admin-border)", background: "#ffffff", color: "#334155" }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={capped}
                        onChange={() => togglePresetOrCustom(preset)}
                        className="size-4 shrink-0 cursor-pointer accent-cyan-700"
                      />
                      {preset}
                    </label>
                  );
                })}
              </div>

              {(() => {
                const customServices = draft.services.filter((service) => !matchPresetService(service));
                return customServices.length > 0 ? (
                  <div className="grid gap-1.5">
                    <p className="text-xs font-bold text-[#64748b]">Özel Hizmetler</p>
                    <div className="flex flex-wrap gap-1.5">
                      {customServices.map((service) => (
                        <span key={service} className="inline-flex items-center gap-1.5 rounded-full bg-[#f1f5f9] px-2.5 py-1 text-xs font-bold text-[#334155]">
                          {service}
                          <button type="button" onClick={() => togglePresetOrCustom(service)} aria-label={`${service} hizmetini kaldır`} className="text-[#64748b] hover:text-[#0f172a]"><X size={12} aria-hidden /></button>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {addingCustomService ? (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor="brand-custom-service">Özel hizmet adı</label>
                  <input
                    id="brand-custom-service"
                    autoFocus
                    value={serviceInput}
                    onChange={(event) => setServiceInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") { event.preventDefault(); commitCustomService(); }
                      if (event.key === "Escape") { event.preventDefault(); cancelCustomService(); }
                    }}
                    placeholder="Hizmet adını yaz…"
                    className="min-h-10 min-w-[180px] flex-1 rounded-[10px] border bg-[#ffffff] px-3 text-sm font-semibold text-[#0f172a]"
                    style={{ borderColor: "var(--admin-border)" }}
                  />
                  <AdminButton type="button" variant="primary" compact onClick={commitCustomService}>Ekle</AdminButton>
                  <AdminButton type="button" variant="secondary" compact onClick={cancelCustomService}>İptal</AdminButton>
                </div>
              ) : (
                <AdminButton
                  type="button"
                  variant="secondary"
                  compact
                  icon={<Plus size={14} />}
                  disabled={draft.services.length >= BRAND_SERVICES_MAX_COUNT}
                  onClick={() => { setServiceInput(""); setAddingCustomService(true); }}
                >
                  Özel Hizmet Ekle
                </AdminButton>
              )}
              <p className="text-xs font-semibold text-[#94a3b8]">En az bir hizmet eklemeniz önerilir.</p>
            </div>

            <label className="grid gap-1.5 text-sm font-bold text-[#334155]">
              Kısa Açıklama <span className="font-semibold text-[#94a3b8]">(opsiyonel)</span>
              <textarea rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Markanın dijital reklam ve sosyal medya süreçlerini stratejik olarak yönetiyoruz." className="rounded-[10px] border bg-[#ffffff] p-3 text-base font-semibold text-[#0f172a]" style={{ borderColor: "var(--admin-border)" }} />
            </label>

            <div className="flex flex-wrap justify-end gap-2">
              <AdminButton variant="secondary" disabled={saving} onClick={() => setDraft(null)}>Vazgeç</AdminButton>
              <AdminButton variant="primary" loading={saving} disabled={saving || uploading} onClick={submitDraft}>{draft.id ? "Kaydet" : "Marka Ekle"}</AdminButton>
            </div>
          </div>
        </div>
      )}

      <AdminConfirmDialog
        open={Boolean(confirmDelete)}
        title={`${confirmDelete?.name ?? ""} silinsin mi?`}
        description="Bu marka web sitesinden kaldırılır ve işlem geri alınamaz."
        confirmLabel="Markayı Sil"
        cancelLabel="Vazgeç"
        tone="danger"
        busy={Boolean(busyId && busyId === confirmDelete?.id)}
        onConfirm={confirmDeleteBrand}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
