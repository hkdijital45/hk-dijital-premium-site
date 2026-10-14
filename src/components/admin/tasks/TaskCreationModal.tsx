"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ChevronDown, ChevronUp, Search } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { TASK_TEMPLATE_CATEGORIES, findTemplate } from "@/lib/tasks/templates";

function getAdminPortalRoot(): Element {
  return document.querySelector(".hk-admin") || document.body;
}

type CompanyOption = { id: string; name?: string; company_name?: string };
type LeadOption = { id: string; name?: string; company?: string; sector?: string; business_type?: string; city?: string };
type UserOption = { id: string; full_name?: string; email?: string };

type EntityType = "customer" | "lead" | "internal";

const PRIORITIES = ["Düşük", "Orta", "Yüksek", "Kritik"] as const;

/** Yeni Görev Oluştur — centered modal (reuses the project's own proven
 * portal/backdrop/Escape/scroll-lock pattern, same shape as
 * CenteredLeadModal in AdminDashboard.tsx) replacing the old behavior of
 * "+ Yeni Görev" silently prepending a blank unsaved row. Supports
 * CUSTOMER / LEAD / INTERNAL ownership and a bulk template picker across
 * the 8 standard agency categories — one real, batched POST regardless
 * of how many tasks are selected. */
export function TaskCreationModal({
  companies, leads, users, defaultCompanyId, defaultLeadId, notify, onClose, onCreated
}: {
  companies: CompanyOption[]; leads: LeadOption[]; users: UserOption[];
  defaultCompanyId?: string; defaultLeadId?: string;
  notify?: (message: string, type?: string) => void;
  onClose: () => void;
  onCreated: (tasks: Array<Record<string, unknown>>) => void;
}) {
  const [mode, setMode] = useState<"single" | "bulk">(defaultLeadId || defaultCompanyId ? "bulk" : "single");
  const [entityType, setEntityType] = useState<EntityType>(defaultLeadId ? "lead" : defaultCompanyId ? "customer" : "customer");
  const [companyId, setCompanyId] = useState(defaultCompanyId || "");
  const [leadId, setLeadId] = useState(defaultLeadId || "");
  const [leadSearch, setLeadSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");

  const [singleTitle, setSingleTitle] = useState("");
  const [singleDescription, setSingleDescription] = useState("");

  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("Orta");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [visibleToCustomer, setVisibleToCustomer] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey, true);
    panelRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey, true); document.body.style.overflow = prevOverflow; };
  }, [onClose]);

  const filteredLeads = useMemo(() => {
    const q = leadSearch.trim().toLocaleLowerCase("tr");
    const pool = leads || [];
    return (q ? pool.filter((l) => `${l.company || ""} ${l.name || ""}`.toLocaleLowerCase("tr").includes(q)) : pool).slice(0, 30);
  }, [leads, leadSearch]);

  const filteredCompanies = useMemo(() => {
    const q = companySearch.trim().toLocaleLowerCase("tr");
    const pool = companies || [];
    return (q ? pool.filter((c) => (c.name || c.company_name || "").toLocaleLowerCase("tr").includes(q)) : pool).slice(0, 30);
  }, [companies, companySearch]);

  function toggleTemplate(id: string) {
    setSelectedTemplateIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }
  function toggleCategoryAll(categoryId: string, select: boolean) {
    const cat = TASK_TEMPLATE_CATEGORIES.find((c) => c.id === categoryId);
    if (!cat) return;
    const ids = cat.templates.map((t) => t.id);
    setSelectedTemplateIds((cur) => select ? Array.from(new Set([...cur, ...ids])) : cur.filter((x) => !ids.includes(x)));
  }

  const entityValid = entityType === "customer" ? Boolean(companyId) : entityType === "lead" ? Boolean(leadId) : true;
  const canSubmit = entityValid && (mode === "single" ? singleTitle.trim().length > 0 : selectedTemplateIds.length > 0) && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    const base = {
      company_id: entityType === "customer" ? companyId : null,
      lead_id: entityType === "lead" ? leadId : null,
      priority, due_date: dueDate || null, assigned_user_id: assigneeId || null, visible_to_customer: visibleToCustomer
    };
    const tasks = mode === "single"
      ? [{ ...base, title: singleTitle.trim(), description: singleDescription.trim() || undefined }]
      : selectedTemplateIds.map((id) => ({ ...base, title: findTemplate(id)?.title || id, template_key: id }));

    try {
      const res = await fetch("/api/admin/tasks/bulk-create", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tasks })
      });
      const body = await res.json();
      if (!res.ok) { notify?.(body.error || "Görevler oluşturulamadı.", "error"); setSubmitting(false); return; }
      notify?.(tasks.length > 1 ? `${body.count} görev başarıyla oluşturuldu.` : "Görev başarıyla oluşturuldu.", "success");
      onCreated(body.tasks || []);
      onClose();
    } catch {
      notify?.("Görevler oluşturulamadı.", "error");
      setSubmitting(false);
    }
  }

  if (typeof document === "undefined") return null;

  const fieldStyle = { borderColor: "var(--admin-border)" };
  const mutedStyle = { color: "var(--admin-text-secondary)" };
  const inputClass = "w-full rounded-[10px] border p-2 text-sm";

  return createPortal(
    <div onMouseDown={onClose} className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/55 p-0 sm:p-4">
      <div
        ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className="flex h-full w-full flex-col overflow-hidden bg-[var(--admin-surface)] shadow-2xl outline-none sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-[1100px] sm:rounded-[20px]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="sticky top-0 z-10 border-b p-5 sm:p-6" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black" style={{ color: "var(--admin-text-primary)" }}>Yeni Görev Oluştur</h2>
              <p className="mt-1 text-sm" style={mutedStyle}>Müşteri, potansiyel müşteri veya ajans görevlerini tek tek ya da toplu olarak oluşturun.</p>
            </div>
            <button onClick={onClose} aria-label="Kapat" className="grid size-10 shrink-0 place-items-center rounded-full border" style={fieldStyle}><X size={16} /></button>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => setMode("single")} className="rounded-full border px-4 py-2 text-sm font-black" style={mode === "single" ? { background: "#0e7490", color: "#fff", borderColor: "#0e7490" } : fieldStyle}>Tek Görev</button>
            <button onClick={() => setMode("bulk")} className="rounded-full border px-4 py-2 text-sm font-black" style={mode === "bulk" ? { background: "#0e7490", color: "#fff", borderColor: "#0e7490" } : fieldStyle}>Toplu Görev Ekle</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          <fieldset className="mb-5 rounded-[12px] border p-4" style={fieldStyle}>
            <legend className="px-1 text-sm font-black">Görev Türü</legend>
            <div className="flex flex-wrap gap-2">
              {([["customer", "Müşteri"], ["lead", "Potansiyel Müşteri"], ["internal", "Dahili"]] as const).map(([value, label]) => (
                <button key={value} onClick={() => setEntityType(value)} className="rounded-full border px-3.5 py-1.5 text-xs font-black" style={entityType === value ? { background: "#0891b2", color: "#fff", borderColor: "#0891b2" } : fieldStyle}>{label}</button>
              ))}
            </div>

            {entityType === "customer" && (
              <div className="mt-3">
                {!companyId ? (
                  <div className="grid gap-2">
                    <div className="relative">
                      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input autoFocus value={companySearch} onChange={(e) => setCompanySearch(e.target.value)} placeholder="Müşteri Seç — işletme adıyla ara..." className={`${inputClass} pl-8`} style={fieldStyle} />
                    </div>
                    <div className="grid max-h-40 gap-1 overflow-y-auto rounded-[8px] border p-1" style={fieldStyle}>
                      {filteredCompanies.map((c) => (
                        <button key={c.id} onClick={() => setCompanyId(c.id)} className="rounded-[6px] px-3 py-2 text-left text-sm font-bold hover:bg-[var(--admin-surface-soft)]">{c.name || c.company_name}</button>
                      ))}
                      {!filteredCompanies.length && <p className="p-2 text-center text-xs" style={mutedStyle}>Eşleşen müşteri yok.</p>}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-[8px] border p-2.5 text-sm font-bold" style={fieldStyle}>
                    {companies.find((c) => c.id === companyId)?.name || companies.find((c) => c.id === companyId)?.company_name}
                    <button onClick={() => setCompanyId("")} className="text-xs font-black" style={mutedStyle}>Değiştir</button>
                  </div>
                )}
              </div>
            )}

            {entityType === "lead" && (
              <div className="mt-3">
                {!leadId ? (
                  <div className="grid gap-2">
                    <div className="relative">
                      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input autoFocus value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} placeholder="Potansiyel Müşteri Seç — işletme adıyla ara..." className={`${inputClass} pl-8`} style={fieldStyle} />
                    </div>
                    <div className="grid max-h-40 gap-1 overflow-y-auto rounded-[8px] border p-1" style={fieldStyle}>
                      {filteredLeads.map((l) => (
                        <button key={l.id} onClick={() => setLeadId(l.id)} className="flex items-center justify-between rounded-[6px] px-3 py-2 text-left text-sm font-bold hover:bg-[var(--admin-surface-soft)]">
                          <span>{l.company || l.name}</span>
                          <span className="text-xs font-bold" style={mutedStyle}>{l.sector || l.business_type || "—"} · {l.city || "—"}</span>
                        </button>
                      ))}
                      {!filteredLeads.length && <p className="p-2 text-center text-xs" style={mutedStyle}>Eşleşen lead yok.</p>}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-[8px] border p-2.5 text-sm font-bold" style={fieldStyle}>
                    {leads.find((l) => l.id === leadId)?.company || leads.find((l) => l.id === leadId)?.name}
                    <button onClick={() => setLeadId("")} className="text-xs font-black" style={mutedStyle}>Değiştir</button>
                  </div>
                )}
              </div>
            )}

            {entityType === "internal" && (
              <p className="mt-3 text-xs" style={mutedStyle}>Dahili ajans görevi — bir müşteri veya lead seçmeniz gerekmez.</p>
            )}
          </fieldset>

          {mode === "single" ? (
            <fieldset className="grid gap-3">
              <label><span className="mb-1 block text-xs font-bold" style={mutedStyle}>Görev Başlığı</span><input autoFocus={entityType === "internal"} value={singleTitle} onChange={(e) => setSingleTitle(e.target.value)} className={inputClass} style={fieldStyle} /></label>
              <label><span className="mb-1 block text-xs font-bold" style={mutedStyle}>Açıklama / Not</span><textarea rows={3} value={singleDescription} onChange={(e) => setSingleDescription(e.target.value)} className={inputClass} style={fieldStyle} /></label>
            </fieldset>
          ) : (
            <fieldset>
              <div className="mb-2 flex items-center justify-between">
                <legend className="text-sm font-black">Görev Şablonları</legend>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black" style={{ color: "#0e7490" }}>{selectedTemplateIds.length} görev seçildi</span>
                  <button onClick={() => setSelectedTemplateIds([])} className="text-xs font-bold underline" style={mutedStyle}>Seçimi Temizle</button>
                </div>
              </div>
              <div className="grid gap-2">
                {TASK_TEMPLATE_CATEGORIES.map((cat) => {
                  const open = Boolean(openCategories[cat.id]);
                  const selectedInCat = cat.templates.filter((t) => selectedTemplateIds.includes(t.id)).length;
                  return (
                    <div key={cat.id} className="rounded-[10px] border" style={fieldStyle}>
                      <button onClick={() => setOpenCategories((cur) => ({ ...cur, [cat.id]: !open }))} className="flex w-full items-center justify-between gap-2 p-3 text-left">
                        <span className="text-sm font-black">{cat.label} {selectedInCat > 0 && <span className="ml-1 rounded-full px-2 py-0.5 text-[11px]" style={{ background: "#0891b21A", color: "#0891b2" }}>{selectedInCat}</span>}</span>
                        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      {open && (
                        <div className="border-t p-3" style={fieldStyle}>
                          <div className="mb-2 flex gap-2">
                            <button onClick={() => toggleCategoryAll(cat.id, true)} className="text-xs font-bold underline" style={{ color: "#0e7490" }}>Tümünü Seç</button>
                            <button onClick={() => toggleCategoryAll(cat.id, false)} className="text-xs font-bold underline" style={mutedStyle}>Kategoriyi Temizle</button>
                          </div>
                          <div className="grid gap-1.5 sm:grid-cols-2">
                            {cat.templates.map((t) => (
                              <label key={t.id} className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={selectedTemplateIds.includes(t.id)} onChange={() => toggleTemplate(t.id)} />
                                {t.title}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          )}

          <fieldset className="mt-5 grid gap-3 rounded-[12px] border p-4 sm:grid-cols-2" style={fieldStyle}>
            <legend className="px-1 text-sm font-black">Görev Ayarları {mode === "bulk" && <span className="font-normal" style={mutedStyle}>— seçili tüm görevlere uygulanır</span>}</legend>
            <label><span className="mb-1 block text-xs font-bold" style={mutedStyle}>Öncelik</span>
              <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className={inputClass} style={fieldStyle}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label><span className="mb-1 block text-xs font-bold" style={mutedStyle}>Son Tarih</span><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} style={fieldStyle} /></label>
            <label className="sm:col-span-2"><span className="mb-1 block text-xs font-bold" style={mutedStyle}>Atanan Kullanıcı</span>
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={inputClass} style={fieldStyle}>
                <option value="">Atanmadı</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs font-bold sm:col-span-2" style={mutedStyle}>
              <input type="checkbox" checked={visibleToCustomer} onChange={(e) => setVisibleToCustomer(e.target.checked)} /> Müşteriye gösterilsin
            </label>
          </fieldset>

          {mode === "bulk" && selectedTemplateIds.length > 0 && (
            <div className="mt-5 rounded-[12px] border p-4" style={fieldStyle}>
              <p className="mb-2 text-xs font-black uppercase tracking-[.06em]" style={mutedStyle}>Seçilen Görevler ({selectedTemplateIds.length})</p>
              <ol className="grid gap-1 text-sm">
                {selectedTemplateIds.map((id, i) => (
                  <li key={id} className="flex items-center justify-between gap-2">
                    <span>{i + 1}. {findTemplate(id)?.title}</span>
                    <button onClick={() => toggleTemplate(id)} className="text-xs font-bold text-red-600">Kaldır</button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t p-4" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
          <AdminButton variant="secondary" onClick={onClose}>Vazgeç</AdminButton>
          <AdminButton variant="primary" loading={submitting} disabled={!canSubmit} onClick={submit}>
            {mode === "single" ? "Görevi Oluştur" : `${selectedTemplateIds.length || 0} Görevi Oluştur`}
          </AdminButton>
        </div>
      </div>
    </div>,
    getAdminPortalRoot()
  );
}
