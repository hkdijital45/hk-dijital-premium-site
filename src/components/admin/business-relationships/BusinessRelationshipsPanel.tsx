"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount pattern, same accepted precedent as ManualEvaluationSection.tsx */

import { useCallback, useEffect, useState } from "react";
import { Building2, GitBranch, ImageIcon, Link2, Pencil, Search, Unlink, X } from "lucide-react";
import { CompanyLogoPanel } from "@/components/admin/business-relationships/CompanyLogoPanel";
import {
  ENTITY_TYPE_LABELS,
  RELATIONSHIP_LABELS,
  RELATIONSHIP_TYPES,
  type BusinessEntityRef,
  type LinkedBusiness,
  type RelationshipType
} from "@/lib/business-relationships-shared";

// İŞLETME VE ŞUBE YÖNETİMİ — shown inside a lead's detail (and reusable for a
// customer or a BAĞIMSIZ business). Branches/related brands are always an
// explicit, user-chosen relationship; unlinking never deletes a record.

type UnitForm = { name: string; business_name: string; instagram: string; website: string; phone: string; address: string; description: string };
const EMPTY_FORM: UnitForm = { name: "", business_name: "", instagram: "", website: "", phone: "", address: "", description: "" };

type Mode = { kind: "create"; relationshipType: RelationshipType } | { kind: "link" } | { kind: "edit"; business: LinkedBusiness } | null;

const inputClass = "min-h-11 w-full rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm font-bold text-[var(--admin-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600";

export function BusinessRelationshipsPanel({ owner, ownerName, onChanged, allowCreateBranch = true, title = "İşletme ve Şube Yönetimi" }: { owner: BusinessEntityRef; ownerName?: string; onChanged?: (businesses: LinkedBusiness[]) => void; allowCreateBranch?: boolean; title?: string }) {
  const [businesses, setBusinesses] = useState<LinkedBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState<Mode>(null);
  const [form, setForm] = useState<UnitForm>(EMPTY_FORM);
  const [linkType, setLinkType] = useState<RelationshipType>("related_brand");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Array<{ entity: BusinessEntityRef; name: string; detail: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState("");
  const [logoFor, setLogoFor] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`/api/admin/business-relationships?type=${owner.type}&id=${owner.id}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "İşletme ilişkileri yüklenemedi.");
      setBusinesses(body.businesses || []);
      onChanged?.(body.businesses || []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "İşletme ilişkileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [owner.type, owner.id, onChanged]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (mode?.kind !== "link") return;
    const query = search.trim();
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/business-relationships?search=${encodeURIComponent(query)}`);
        const body = await res.json().catch(() => ({}));
        const linkedIds = new Set(businesses.map((item) => item.entity.id));
        setResults((body.results || []).filter((item: { entity: BusinessEntityRef }) => item.entity.id !== owner.id && !linkedIds.has(item.entity.id)));
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, mode, businesses, owner.id]);

  function openMode(next: Mode) {
    setMessage(null);
    setConfirmUnlink("");
    setMode(next);
    if (next?.kind === "edit") {
      const b = next.business;
      setForm({ ...EMPTY_FORM, name: b.name, instagram: b.instagram || "", website: b.website || "", phone: b.phone || "", address: b.address || "", description: b.description || "" });
    } else {
      setForm(EMPTY_FORM);
      setSearch("");
      setResults([]);
    }
  }

  async function send(method: string, payload: unknown, successText: string, url = "/api/admin/business-relationships") {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: payload ? JSON.stringify(payload) : undefined });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "İşlem tamamlanamadı.");
      setMessage({ tone: "success", text: successText });
      setMode(null);
      await load();
      return true;
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "İşlem tamamlanamadı." });
      return false;
    } finally {
      setBusy(false);
    }
  }

  function submitForm() {
    if (!form.name.trim()) { setMessage({ tone: "error", text: "Ad alanı zorunludur." }); return; }
    if (mode?.kind === "create") {
      send("POST", { action: "create_unit", parent: owner, relationshipType: mode.relationshipType, unit: form }, `${RELATIONSHIP_LABELS[mode.relationshipType]} eklendi: ${form.name.trim()}`);
    } else if (mode?.kind === "edit") {
      if (mode.business.entity.type !== "unit") return;
      const unit = { name: form.name, instagram: form.instagram, website: form.website, phone: form.phone, address: form.address, description: form.description };
      send("PATCH", { unitId: mode.business.entity.id, unit }, "İşletme bilgileri güncellendi.");
    }
  }

  const ownerLabel = ownerName || "Bu işletme";
  const formTitle = mode?.kind === "create" ? (mode.relationshipType === "branch" ? "Yeni Şube" : "Yeni Bağlı Marka") : mode?.kind === "edit" ? `Düzenle: ${mode.business.name}` : "";

  return (
    <section className="mt-4 rounded-[12px] border p-4" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }} aria-label="İşletme ve şube yönetimi">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[.14em]" style={{ color: "var(--admin-text-secondary)" }}>{title}</p>
        <div className="flex flex-wrap gap-2">
          {allowCreateBranch && <button type="button" onClick={() => openMode({ kind: "create", relationshipType: "branch" })} className="hk-button hk-button-neutral hk-button-compact"><GitBranch size={14} /> Şube Ekle</button>}
          <button type="button" onClick={() => openMode({ kind: "create", relationshipType: "related_brand" })} className="hk-button hk-button-neutral hk-button-compact"><Building2 size={14} /> Bağlı Marka Ekle</button>
          <button type="button" onClick={() => openMode({ kind: "link" })} className="hk-button hk-button-neutral hk-button-compact"><Link2 size={14} /> Mevcut İşletmeyi Bağla</button>
        </div>
      </div>

      {(mode?.kind === "create" || mode?.kind === "edit") && (
        <div className="mt-3 rounded-[10px] border p-3" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-black" style={{ color: "var(--admin-text-primary)" }}>{formTitle}</p>
            <button type="button" onClick={() => setMode(null)} aria-label="Kapat" className="hk-button hk-button-neutral hk-button-compact"><X size={14} /></button>
          </div>
          {mode.kind === "create" && (
            <p className="mt-1 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>
              {mode.relationshipType === "branch"
                ? `${ownerLabel} markasının başka bir lokasyonu/birimi olarak kaydedilir.`
                : `Ayrı bir marka kimliği olarak kaydedilir (kendi Instagram'ı ve değerlendirmeleriyle); ${ownerLabel} şubesi sayılmaz.`}
            </p>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-black" style={{ color: "var(--admin-text-secondary)" }}>{mode.kind === "create" && mode.relationshipType === "branch" ? "Şube adı *" : "Marka / işletme adı *"}
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} />
            </label>
            {mode.kind === "create" && (
              <label className="grid gap-1 text-xs font-black" style={{ color: "var(--admin-text-secondary)" }}>Ticari unvan / işletme adı
                <input className={inputClass} value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} maxLength={200} />
              </label>
            )}
            <label className="grid gap-1 text-xs font-black" style={{ color: "var(--admin-text-secondary)" }}>Instagram
              <input className={inputClass} value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@kullaniciadi" autoCapitalize="none" autoCorrect="off" maxLength={200} />
            </label>
            <label className="grid gap-1 text-xs font-black" style={{ color: "var(--admin-text-secondary)" }}>Website
              <input className={inputClass} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} inputMode="url" autoCapitalize="none" maxLength={200} />
            </label>
            <label className="grid gap-1 text-xs font-black" style={{ color: "var(--admin-text-secondary)" }}>Telefon
              <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" maxLength={200} />
            </label>
            <label className="grid gap-1 text-xs font-black sm:col-span-2" style={{ color: "var(--admin-text-secondary)" }}>Adres
              <input className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={500} />
            </label>
            <label className="grid gap-1 text-xs font-black sm:col-span-2" style={{ color: "var(--admin-text-secondary)" }}>Açıklama
              <textarea className={`${inputClass} min-h-20 py-2`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={submitForm} disabled={busy} className="hk-button hk-button-primary">{busy ? "Kaydediliyor..." : "Kaydet"}</button>
            <button type="button" onClick={() => setMode(null)} className="hk-button hk-button-neutral">Vazgeç</button>
          </div>
        </div>
      )}

      {mode?.kind === "link" && (
        <div className="mt-3 rounded-[10px] border p-3" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-black" style={{ color: "var(--admin-text-primary)" }}>Mevcut İşletmeyi Bağla</p>
            <button type="button" onClick={() => setMode(null)} aria-label="Kapat" className="hk-button hk-button-neutral hk-button-compact"><X size={14} /></button>
          </div>
          <p className="mt-1 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>Kayıtlı lead, müşteri veya bağımsız işletmeyi arayın. Kayıt kopyalanmaz; yalnızca ilişki oluşturulur.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
            <label className="relative block">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--admin-text-muted)" }} />
              <input className={`${inputClass} pl-8`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="İşletme adı veya Instagram ara..." aria-label="İşletme ara" autoCapitalize="none" />
            </label>
            <label className="grid gap-1 text-xs font-black" style={{ color: "var(--admin-text-secondary)" }}>
              <span className="sr-only">İlişki türü</span>
              <select className={inputClass} value={linkType} onChange={(e) => setLinkType(e.target.value as RelationshipType)} aria-label="İlişki türü">
                {RELATIONSHIP_TYPES.map((type) => <option key={type} value={type}>{RELATIONSHIP_LABELS[type]}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-2 grid max-h-56 gap-1 overflow-y-auto">
            {searching && <p className="p-2 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>Aranıyor...</p>}
            {!searching && search.trim().length >= 2 && results.length === 0 && <p className="p-2 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>Bağlanabilecek eşleşme yok.</p>}
            {results.map((item) => (
              <button
                key={`${item.entity.type}-${item.entity.id}`}
                type="button"
                disabled={busy}
                onClick={() => send("POST", { action: "link_existing", parent: owner, child: item.entity, relationshipType: linkType }, `${item.name} ${RELATIONSHIP_LABELS[linkType].toLocaleLowerCase("tr")} olarak bağlandı.`)}
                className="flex items-center justify-between gap-2 rounded-[8px] border px-3 py-2 text-left text-sm font-bold hover:bg-[var(--admin-surface)]"
                style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-primary)" }}
              >
                <span className="min-w-0"><span className="block truncate">{item.name}</span><span className="block truncate text-xs" style={{ color: "var(--admin-text-muted)" }}>{item.detail}</span></span>
                <span className="shrink-0 text-xs font-black" style={{ color: "#0891b2" }}>Bağla</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {message && (
        <p role="status" className="mt-3 rounded-[8px] border p-2.5 text-sm font-bold" style={message.tone === "success" ? { borderColor: "#a7f3d0", background: "#ecfdf5", color: "#065f46" } : { borderColor: "#fecaca", background: "#fef2f2", color: "#991b1b" }}>{message.text}</p>
      )}

      <div className="mt-3 grid gap-2">
        {loading && <p className="text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>Yükleniyor...</p>}
        {!loading && loadError && <p className="text-xs font-bold" style={{ color: "#b91c1c" }}>{loadError}</p>}
        {!loading && !loadError && businesses.length === 0 && (
          <p className="text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>{allowCreateBranch ? <>Henüz bağlı şube veya marka yok. Farklı lokasyon için &quot;Şube Ekle&quot;, ayrı Instagram/marka kimliği için &quot;Bağlı Marka Ekle&quot; kullanın.</> : <>Henüz bağlı marka veya işletme yok. Ayrı Instagram/marka kimliği için &quot;Bağlı Marka Ekle&quot; kullanın.</>}</p>
        )}
        {businesses.map((business) => (
          <div key={business.relationshipId} className="rounded-[10px] border p-3" style={{ borderColor: "var(--admin-border)" }}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-black" style={{ color: "var(--admin-text-primary)" }}>{business.name}</p>
                <p className="mt-0.5 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>
                  {business.direction === "parent" ? `Üst işletme · ${RELATIONSHIP_LABELS[business.relationshipType]} ilişkisi` : RELATIONSHIP_LABELS[business.relationshipType]}
                  {business.entity.type !== "unit" ? ` · ${ENTITY_TYPE_LABELS[business.entity.type]} kaydı` : ""}
                  {business.instagram ? ` · ${business.instagram}` : ""}
                </p>
                {(business.phone || business.website || business.address) && (
                  <p className="mt-0.5 break-words text-xs" style={{ color: "var(--admin-text-secondary)" }}>{[business.phone, business.website, business.address].filter(Boolean).join(" · ")}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {business.entity.type === "unit" && (
                  <button type="button" onClick={() => openMode({ kind: "edit", business })} className="hk-button hk-button-neutral hk-button-compact"><Pencil size={13} /> Düzenle</button>
                )}
                {business.entity.type === "unit" && (
                  <button type="button" onClick={() => setLogoFor(logoFor === business.entity.id ? "" : business.entity.id)} className="hk-button hk-button-neutral hk-button-compact"><ImageIcon size={13} /> Logo</button>
                )}
                {confirmUnlink === business.relationshipId ? (
                  <>
                    <button type="button" disabled={busy} onClick={() => send("DELETE", null, `${business.name} bağlantısı kaldırıldı (kayıt silinmedi).`, `/api/admin/business-relationships?relationshipId=${business.relationshipId}`)} className="hk-button hk-button-danger hk-button-compact">Bağlantıyı Kaldır</button>
                    <button type="button" onClick={() => setConfirmUnlink("")} className="hk-button hk-button-neutral hk-button-compact">Vazgeç</button>
                  </>
                ) : (
                  <button type="button" onClick={() => setConfirmUnlink(business.relationshipId)} className="hk-button hk-button-neutral hk-button-compact"><Unlink size={13} /> Bağlantıyı Kaldır</button>
                )}
              </div>
            </div>
            {business.description && <p className="mt-1.5 text-xs leading-5" style={{ color: "var(--admin-text-secondary)" }}>{business.description}</p>}
            {logoFor === business.entity.id && business.entity.type === "unit" && <CompanyLogoPanel owner={{ type: "unit", id: business.entity.id }} compact />}
          </div>
        ))}
      </div>
    </section>
  );
}
