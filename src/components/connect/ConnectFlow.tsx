"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount pattern (open the just-authorized provider's asset picker), same accepted precedent as ContentPlanningCenter.tsx */

import { useEffect, useState } from "react";

type Asset = { id: string; provider: string; platform: string; account_type: string; provider_account_id: string; provider_account_name: string; status?: string };

const LABELS: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", meta_ads: "Meta Ads", google_ads: "Google Ads", ga4: "GA4", search_console: "Search Console" };
const META_CAPS = ["facebook", "instagram", "meta_ads"];
const GOOGLE_CAPS = ["google_ads", "ga4", "search_console"];

export function ConnectFlow({ token, requested, initialCompleted, justAuthorized }: { token: string; requested: string[]; initialCompleted: string[]; justAuthorized: "meta" | "google" | null }) {
  const [completed, setCompleted] = useState<string[]>(initialCompleted);
  const [pickerProvider, setPickerProvider] = useState<"meta" | "google" | null>(null);
  const [accounts, setAccounts] = useState<Asset[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metaRequested = META_CAPS.some((c) => requested.includes(c));
  const googleRequested = GOOGLE_CAPS.some((c) => requested.includes(c));
  const metaDone = META_CAPS.filter((c) => requested.includes(c)).every((c) => completed.includes(c));
  const googleDone = GOOGLE_CAPS.filter((c) => requested.includes(c)).every((c) => completed.includes(c));
  const allDone = requested.every((c) => completed.includes(c));

  async function openPicker(provider: "meta" | "google") {
    setPickerProvider(provider);
    setAccounts(null);
    setSelected(new Set());
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/public/connect-accounts?connectToken=${encodeURIComponent(token)}&provider=${provider}`);
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.message || "Hesaplar alınamadı.");
      setAccounts(body.accounts || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (justAuthorized && !completed.includes(justAuthorized === "meta" ? "facebook" : "google_ads")) {
      openPicker(justAuthorized);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount from the OAuth redirect-back only
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function save() {
    if (!pickerProvider || !accounts) return;
    const chosen = accounts.filter((a) => selected.has(a.id));
    if (!chosen.length) { setError("En az bir hesap seçin."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/public/connect-select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectToken: token, provider: pickerProvider, accounts: chosen })
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error || body.message || "Kaydedilemedi.");
      const caps = pickerProvider === "meta" ? META_CAPS : GOOGLE_CAPS;
      setCompleted((prev) => Array.from(new Set([...prev, ...caps.filter((c) => requested.includes(c))])));
      setPickerProvider(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    } finally {
      setSaving(false);
    }
  }

  if (allDone) {
    return <p className="mt-4 text-lg font-black text-[#15803d]">Bağlantılar tamamlandı ✓</p>;
  }

  return (
    <div className="mt-6 grid gap-3">
      {error && <p className="text-sm font-bold text-[#dc2626]">{error}</p>}

      {metaRequested && (
        <div className="rounded-[10px] border p-3" style={{ borderColor: "#e2e2e2" }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-black">Meta (Facebook / Instagram / Meta Ads)</p>
            <span className="text-xs font-bold" style={{ color: metaDone ? "#15803d" : "#b45309" }}>{metaDone ? "Bağlandı ✓" : "Bekliyor"}</span>
          </div>
          {!metaDone && (
            pickerProvider === "meta" ? (
              <AssetPicker accounts={accounts} loading={loading} saving={saving} selected={selected} onToggle={toggle} onSave={save} onCancel={() => setPickerProvider(null)} />
            ) : (
              <a href={`/api/integrations/meta/connect?connectToken=${encodeURIComponent(token)}`} className="mt-2 block rounded-[10px] px-4 py-2.5 text-center text-sm font-black text-white" style={{ background: "#1877F2" }}>
                Meta ile Bağlan
              </a>
            )
          )}
        </div>
      )}

      {googleRequested && (
        <div className="rounded-[10px] border p-3" style={{ borderColor: "#e2e2e2" }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-black">Google (Ads / GA4 / Search Console)</p>
            <span className="text-xs font-bold" style={{ color: googleDone ? "#15803d" : "#b45309" }}>{googleDone ? "Bağlandı ✓" : "Bekliyor"}</span>
          </div>
          {!googleDone && (
            pickerProvider === "google" ? (
              <AssetPicker accounts={accounts} loading={loading} saving={saving} selected={selected} onToggle={toggle} onSave={save} onCancel={() => setPickerProvider(null)} />
            ) : (
              <a href={`/api/integrations/google/connect?connectToken=${encodeURIComponent(token)}`} className="mt-2 block rounded-[10px] border px-4 py-2.5 text-center text-sm font-black" style={{ borderColor: "#e2e2e2" }}>
                Google ile Bağlan
              </a>
            )
          )}
        </div>
      )}
    </div>
  );
}

function AssetPicker({ accounts, loading, saving, selected, onToggle, onSave, onCancel }: { accounts: Asset[] | null; loading: boolean; saving: boolean; selected: Set<string>; onToggle: (id: string) => void; onSave: () => void; onCancel: () => void }) {
  if (loading) return <p className="mt-2 text-xs font-bold text-slate-500">Yükleniyor…</p>;
  if (!accounts) return null;
  if (!accounts.length) return <p className="mt-2 text-xs font-bold text-slate-500">Uygun varlık bulunamadı.</p>;
  return (
    <div className="mt-2">
      <div className="grid gap-1.5">
        {accounts.map((a) => (
          <label key={a.id} className="flex items-center gap-2 text-xs font-bold">
            <input type="checkbox" checked={selected.has(a.id)} onChange={() => onToggle(a.id)} />
            {a.provider_account_name} <span className="text-slate-400">({LABELS[a.account_type] || a.account_type})</span>
          </label>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onSave} disabled={saving} className="rounded-[8px] px-3 py-2 text-xs font-black text-white" style={{ background: "#0891b2" }}>{saving ? "Kaydediliyor…" : "Seçimi Kaydet"}</button>
        <button type="button" onClick={onCancel} className="rounded-[8px] px-3 py-2 text-xs font-black" style={{ color: "#64748b" }}>Vazgeç</button>
      </div>
    </div>
  );
}
