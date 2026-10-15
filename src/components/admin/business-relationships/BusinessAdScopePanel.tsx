"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount pattern, same accepted precedent as ManualEvaluationSection.tsx */

import { useCallback, useEffect, useState } from "react";
import { Link2, ShieldCheck, Unlink } from "lucide-react";
import type { BusinessAdCampaignLink, CampaignOption } from "@/lib/business-ad-scope-shared";

// Kampanya Eşleştirme — a staff member explicitly confirms which of the
// customer's REAL synced campaigns belong to this branch/brand. Nothing is
// guessed from names or Instagram handles; unconfirmed = not linked.

const platformLabel = (platform: string) => (platform === "google" ? "Google Ads" : "Meta Ads");

export function BusinessAdScopePanel({ companyId, businessUnitId, businessName, onChanged }: { companyId: string; businessUnitId: string; businessName: string; onChanged?: () => void }) {
  const [links, setLinks] = useState<BusinessAdCampaignLink[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [sharedKeys, setSharedKeys] = useState<string[]>([]);
  const [claimedBy, setClaimedBy] = useState<Array<{ platform: string; campaign_key: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pick, setPick] = useState("");
  const [accountLabel, setAccountLabel] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/business-ad-scope?companyId=${companyId}&businessUnitId=${businessUnitId}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Kampanya eşleştirmeleri yüklenemedi.");
      setLinks(body.links || []);
      setCampaigns(body.campaigns || []);
      setSharedKeys(body.sharedKeys || []);
      setClaimedBy(body.claimedBy || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kampanya eşleştirmeleri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [companyId, businessUnitId]);

  useEffect(() => { load(); }, [load]);

  const linkedIds = new Set(links.map((link) => `${link.platform}:${link.campaign_key}`));
  const claimedIds = new Set(claimedBy.map((link) => `${link.platform}:${link.campaign_key}`));
  const available = campaigns.filter((campaign) => !linkedIds.has(`${campaign.platform}:${campaign.campaignKey}`));
  const picked = available.find((campaign) => `${campaign.platform}:${campaign.campaignKey}` === pick);

  async function verify() {
    if (!picked || !confirmed) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/business-ad-scope", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, businessUnitId, platform: picked.platform, campaignKey: picked.campaignKey, adAccountLabel: accountLabel, confirmed: true }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Eşleştirme kaydedilemedi.");
      setPick("");
      setConfirmed(false);
      setMessage(`${picked.campaignName} → ${businessName} olarak doğrulandı.`);
      await load();
      onChanged?.();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Eşleştirme kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/business-ad-scope?id=${id}&companyId=${companyId}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Eşleştirme kaldırılamadı.");
      setMessage("Eşleştirme kaldırıldı (reklam verisi silinmedi).");
      await load();
      onChanged?.();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Eşleştirme kaldırılamadı.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "min-h-10 w-full rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm font-bold text-[var(--admin-text-primary)]";
  return (
    <section className="mb-5 rounded-[18px] border p-4 sm:p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }} aria-label="Kampanya eşleştirme">
      <h3 className="text-base font-black" style={{ color: "var(--admin-text-primary)" }}>Kampanya Eşleştirme — {businessName}</h3>
      <p className="mt-1 text-sm leading-6" style={{ color: "var(--admin-text-muted)" }}>Bu işletmenin reklam analizi yalnızca burada doğruladığınız kampanyalardan hesaplanır. Müşteri hesabının toplam verisi bu işletmeye atfedilmez; işletme adı veya Instagram üzerinden otomatik eşleştirme yapılmaz.</p>
      {loading && <p className="mt-3 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>Yükleniyor...</p>}
      {!loading && error && <p className="mt-3 text-xs font-bold" style={{ color: "#b91c1c" }}>{error}</p>}
      {!loading && !error && (
        <>
          <div className="mt-3 grid gap-1.5">
            {links.length === 0 && <p className="text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>Henüz doğrulanmış kampanya yok — analiz bu işletme için çalıştırılamaz.</p>}
            {links.map((link) => (
              <div key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border p-2.5" style={{ borderColor: "var(--admin-border)" }}>
                <span className="min-w-0 text-sm font-bold" style={{ color: "var(--admin-text-primary)" }}>
                  <ShieldCheck size={14} className="mr-1 inline" style={{ color: "#059669" }} />{link.campaign_name} <span className="text-xs" style={{ color: "var(--admin-text-muted)" }}>· {platformLabel(link.platform)}{link.ad_account_label ? ` · ${link.ad_account_label}` : ""}{sharedKeys.includes(`${link.platform}:${link.campaign_key}`) ? " · başka işletmeyle ortak" : ""}</span>
                </span>
                <button type="button" disabled={busy} onClick={() => remove(link.id)} className="hk-button hk-button-neutral hk-button-compact"><Unlink size={13} /> Kaldır</button>
              </div>
            ))}
          </div>
          {sharedKeys.length > 0 && <p className="mt-2 rounded-[8px] border p-2 text-xs font-bold" style={{ borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" }}>{sharedKeys.length} kampanya başka bir bağlı işletmeyle ortak doğrulanmış. Bu kampanyaların metrikleri kampanyanın toplamıdır; yalnızca bu işletmenin performansı değildir.</p>}
          <div className="mt-3 grid gap-2 sm:grid-cols-[1.4fr_1fr]">
            <select className={inputClass} value={pick} onChange={(e) => { setPick(e.target.value); setConfirmed(false); }} aria-label="Kampanya seç">
              <option value="">{available.length ? "Müşterinin senkronize kampanyalarından seçin" : "Eşleştirilebilecek kampanya yok"}</option>
              {available.map((campaign) => {
                const id = `${campaign.platform}:${campaign.campaignKey}`;
                return <option key={id} value={id}>{platformLabel(campaign.platform)} · {campaign.campaignName}{claimedIds.has(id) ? " (başka işletmede de eşleşmiş)" : ""}</option>;
              })}
            </select>
            <input className={inputClass} value={accountLabel} onChange={(e) => setAccountLabel(e.target.value)} placeholder="Reklam hesabı notu (isteğe bağlı)" maxLength={120} aria-label="Reklam hesabı notu" />
          </div>
          {picked && (
            <label className="mt-2 flex items-start gap-2 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>
              <input type="checkbox" className="mt-0.5 size-4" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              <span>&quot;{picked.campaignName}&quot; kampanyasının {businessName} işletmesine ait olduğunu reklam yöneticisinde kontrol ettim ve onaylıyorum.</span>
            </label>
          )}
          <div className="mt-2">
            <button type="button" disabled={!picked || !confirmed || busy} onClick={verify} className="hk-button hk-button-primary"><Link2 size={14} /> {busy ? "Kaydediliyor..." : "Doğrula ve Eşleştir"}</button>
          </div>
          {message && <p role="status" className="mt-2 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>{message}</p>}
        </>
      )}
    </section>
  );
}
