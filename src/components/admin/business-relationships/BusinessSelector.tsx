"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount pattern, same accepted precedent as ManualEvaluationSection.tsx */

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { RELATIONSHIP_LABELS, type BusinessEntityRef, type BusinessUnitRecord, type LinkedBusiness } from "@/lib/business-relationships-shared";

// Shared "İşletme" selector for Reklam Doktoru Pro. Given the selected
// customer/lead (or BAĞIMSIZ business), lists the main business plus its
// linked branches/related brands. Renders nothing when there are none, so
// single-business targets look exactly as before.

export type SelectedBusiness = { entity: BusinessEntityRef; name: string; instagram: string | null; website: string | null; phone: string | null; address: string | null };

export function BusinessSelector({ owner, ownerName, selectedId, onSelect, refreshKey = 0 }: { owner: BusinessEntityRef; ownerName: string; selectedId: string; onSelect: (business: SelectedBusiness | null) => void; refreshKey?: number }) {
  const [businesses, setBusinesses] = useState<LinkedBusiness[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    fetch(`/api/admin/business-relationships?type=${owner.type}&id=${owner.id}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) { setBusinesses([]); setError(body.error || ""); return; }
        setBusinesses(body.businesses || []);
      })
      .catch(() => { if (!cancelled) setBusinesses([]); });
    return () => { cancelled = true; };
  }, [owner.type, owner.id, refreshKey]);

  if (error) return <p className="mt-2 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>İşletme ilişkileri okunamadı: {error}</p>;
  if (!businesses.length) return null;

  const pill = (active: boolean) => (active ? { background: "#0891b2", color: "#fff", borderColor: "#0891b2" } : { color: "var(--admin-text-secondary)", borderColor: "var(--admin-border)", background: "var(--admin-surface)" });

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="İşletme seçimi">
      <span className="text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>İşletme</span>
      <button type="button" role="radio" aria-checked={!selectedId} onClick={() => onSelect(null)} className="min-h-9 rounded-full border px-3 py-1.5 text-xs font-black" style={pill(!selectedId)}>
        {ownerName} <span className="opacity-75">(Ana işletme)</span>
      </button>
      {businesses.map((business) => (
        <button
          key={business.relationshipId}
          type="button"
          role="radio"
          aria-checked={selectedId === business.entity.id}
          onClick={() => onSelect({ entity: business.entity, name: business.name, instagram: business.instagram, website: business.website, phone: business.phone, address: business.address })}
          className="min-h-9 rounded-full border px-3 py-1.5 text-xs font-black"
          style={pill(selectedId === business.entity.id)}
        >
          {business.name} <span className="opacity-75">({business.direction === "parent" ? "Üst işletme" : RELATIONSHIP_LABELS[business.relationshipType]})</span>
        </button>
      ))}
    </div>
  );
}

/** BAĞIMSIZ mode: persistent independent businesses (neither lead nor customer). */
export function IndependentBusinessPicker({ selectedId, onSelect }: { selectedId: string; onSelect: (unit: BusinessUnitRecord | null) => void }) {
  const [units, setUnits] = useState<BusinessUnitRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [instagram, setInstagram] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/business-relationships?independent=1")
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setError(body.error || "Bağımsız işletmeler yüklenemedi.");
        else { setError(""); setUnits(body.units || []); }
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) { setError("Bağımsız işletmeler yüklenemedi."); setLoaded(true); } });
    return () => { cancelled = true; };
  }, [reload]);

  async function create() {
    if (!name.trim()) { setError("İşletme adı zorunludur."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/business-relationships", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create_independent", unit: { name, instagram } }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "İşletme oluşturulamadı.");
      setCreating(false);
      setName("");
      setInstagram("");
      setReload((value) => value + 1);
      onSelect(body.unit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşletme oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "min-h-10 rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm font-bold text-[var(--admin-text-primary)]";
  return (
    <div className="mt-3 grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <select value={selectedId} onChange={(e) => onSelect(units.find((unit) => unit.id === e.target.value) || null)} className={`${inputClass} max-w-full`} aria-label="Bağımsız işletme seç">
          <option value="">{loaded ? (units.length ? "Kayıtlı bağımsız işletme seç (isteğe bağlı)" : "Kayıtlı bağımsız işletme yok") : "Yükleniyor..."}</option>
          {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}{unit.instagram ? ` · ${unit.instagram}` : ""}</option>)}
        </select>
        <button type="button" onClick={() => { setCreating((value) => !value); setError(""); }} className="hk-button hk-button-neutral hk-button-compact"><Plus size={14} /> Bağımsız İşletme Ekle</button>
      </div>
      {creating && (
        <div className="flex flex-wrap items-end gap-2 rounded-[10px] border p-3" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }}>
          <label className="grid gap-1 text-xs font-black" style={{ color: "var(--admin-text-secondary)" }}>İşletme adı *<input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} /></label>
          <label className="grid gap-1 text-xs font-black" style={{ color: "var(--admin-text-secondary)" }}>Instagram<input className={inputClass} value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@kullaniciadi" autoCapitalize="none" maxLength={200} /></label>
          <button type="button" onClick={create} disabled={busy} className="hk-button hk-button-primary">{busy ? "Kaydediliyor..." : "Kaydet"}</button>
        </div>
      )}
      {error && <p className="text-xs font-bold" style={{ color: "#b91c1c" }}>{error}</p>}
    </div>
  );
}
