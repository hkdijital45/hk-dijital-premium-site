"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount pattern, same accepted precedent as ManualEvaluationSection.tsx */
/* eslint-disable @next/next/no-img-element -- logo previews come from Supabase Storage public URLs (already allowed by the CSP img-src); next/image adds nothing for these small admin thumbnails */

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Globe, ImageUp, X } from "lucide-react";
import type { LogoOwner } from "@/lib/business-logos-shared";

// Firma Logosu — status + actions for one lead / customer / linked business.
// Only a "Doğrulandı" logo is ever used on PDF covers; candidates found on
// the web wait here for an explicit "Onayla".

type LogoRow = { id: string; status: string; source_type: string; sourceLabel: string; publicUrl: string | null; source_url: string | null; evidence: Record<string, unknown>; width: number | null; height: number | null };
type Summary = { status: string; label: string; primary: LogoRow | null; candidates: LogoRow[]; legacyBrandingLogoUrl: string | null; website: string | null };

const STATUS_STYLE: Record<string, { bg: string; fg: string; border: string }> = {
  VERIFIED: { bg: "#ecfdf5", fg: "#065f46", border: "#a7f3d0" },
  PENDING_REVIEW: { bg: "#fffbeb", fg: "#92400e", border: "#fde68a" },
  NOT_FOUND: { bg: "#f1f5f9", fg: "#334155", border: "#cbd5e1" },
  NONE: { bg: "#f8fafc", fg: "#475569", border: "#e2e8f0" }
};

export function CompanyLogoPanel({ owner, compact = false }: { owner: LogoOwner; compact?: boolean }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/admin/business-logos?type=${owner.type}&id=${owner.id}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Logo durumu okunamadı.");
      setSummary(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logo durumu okunamadı.");
    }
  }, [owner.type, owner.id]);

  useEffect(() => { load(); }, [load]);

  async function run(kind: string, request: () => Promise<Response>, success: (body: Record<string, unknown>) => string) {
    setBusy(kind);
    setMessage("");
    try {
      const res = await request();
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "İşlem tamamlanamadı.");
      setMessage(success(body));
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy("");
    }
  }

  function upload(file: File | undefined) {
    if (!file) return;
    const form = new FormData();
    form.set("type", owner.type);
    form.set("id", owner.id);
    form.set("file", file);
    run("upload", () => fetch("/api/admin/business-logos", { method: "POST", body: form }), () => "Logo yüklendi ve raporlarda kullanılmak üzere doğrulandı.");
    if (fileRef.current) fileRef.current.value = "";
  }

  const status = summary?.status || "NONE";
  const style = STATUS_STYLE[status] || STATUS_STYLE.NONE;
  const previewUrl = summary?.primary?.publicUrl || summary?.legacyBrandingLogoUrl || null;
  const pending = (summary?.candidates || []).filter((c) => c.status === "PENDING_REVIEW");

  return (
    <section className={`${compact ? "mt-2" : "mt-4"} rounded-[12px] border p-4`} style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }} aria-label="Firma logosu">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-black uppercase tracking-[.14em]" style={{ color: "var(--admin-text-secondary)" }}>Firma Logosu</p>
          <span className="rounded-full border px-2 py-0.5 text-[11px] font-black" style={{ background: style.bg, color: style.fg, borderColor: style.border }}>{summary?.label || "Yükleniyor..."}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={Boolean(busy)} onClick={() => run("discover", () => fetch("/api/admin/business-logos/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(owner) }), (b) => String(b.message || "Arama tamamlandı."))} className="hk-button hk-button-neutral hk-button-compact">
            <Globe size={14} /> {busy === "discover" ? "Aranıyor..." : "Web Sitesinden Bul"}
          </button>
          <button type="button" disabled={Boolean(busy)} onClick={() => fileRef.current?.click()} className="hk-button hk-button-neutral hk-button-compact">
            <ImageUp size={14} /> {busy === "upload" ? "Yükleniyor..." : previewUrl ? "Logoyu Değiştir" : "Logo Yükle"}
          </button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} aria-label="Logo dosyası" />
        </div>
      </div>

      {error && <p className="mt-2 text-xs font-bold" style={{ color: "#b91c1c" }}>{error}</p>}
      {!error && summary && (
        <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex h-20 w-40 items-center justify-center rounded-[10px] border bg-white p-2" style={{ borderColor: "var(--admin-border)" }}>
            {previewUrl ? <img src={previewUrl} alt="Doğrulanmış firma logosu" className="max-h-full max-w-full object-contain" /> : <span className="text-center text-[11px] font-bold" style={{ color: "#64748b" }}>Raporda yalnızca HK Dijital logosu görünür</span>}
          </div>
          <p className="text-xs leading-5" style={{ color: "var(--admin-text-muted)" }}>
            {summary.primary ? `Kaynak: ${summary.primary.sourceLabel}. Bu logo PDF kapaklarında HK Dijital logosunun yanında kullanılır.`
              : summary.legacyBrandingLogoUrl ? "Müşteri marka varlıklarından yüklenmiş logo kullanılıyor."
                : summary.website ? `Otomatik arama yalnızca kayıtlı web sitesinden (${summary.website}) yapılır. Bulunamazsa logoyu manuel yükleyin.`
                  : "Kayıtlı web sitesi yok; logoyu manuel yükleyin (PNG, JPEG veya WebP, en fazla 5 MB)."}
          </p>
        </div>
      )}

      {pending.length > 0 && (
        <div className="mt-3 grid gap-2">
          <p className="text-xs font-black" style={{ color: "#92400e" }}>Onay bekleyen logo adayları — onaylanmadan raporlarda kullanılmaz</p>
          {pending.map((candidate) => {
            const reasons = Array.isArray(candidate.evidence?.reasons) ? (candidate.evidence.reasons as string[]) : [];
            return (
              <div key={candidate.id} className="grid gap-2 rounded-[10px] border p-2.5 sm:grid-cols-[auto_1fr_auto] sm:items-center" style={{ borderColor: "#fde68a", background: "#fffdf5" }}>
                <div className="flex h-14 w-28 items-center justify-center rounded-[8px] border bg-white p-1.5" style={{ borderColor: "var(--admin-border)" }}>
                  {candidate.publicUrl && <img src={candidate.publicUrl} alt="Logo adayı" className="max-h-full max-w-full object-contain" />}
                </div>
                <div className="min-w-0 text-xs" style={{ color: "var(--admin-text-secondary)" }}>
                  <p className="font-bold">{candidate.sourceLabel}</p>
                  {candidate.source_url && <p className="truncate" title={candidate.source_url}>{candidate.source_url}</p>}
                  {reasons.slice(0, 2).map((reason) => <p key={reason} style={{ color: "var(--admin-text-muted)" }}>{reason}</p>)}
                </div>
                <div className="flex gap-1.5">
                  <button type="button" disabled={Boolean(busy)} onClick={() => run(`approve-${candidate.id}`, () => fetch(`/api/admin/business-logos/${candidate.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve" }) }), () => "Logo onaylandı; raporlarda kullanılacak.")} className="hk-button hk-button-success hk-button-compact"><Check size={13} /> Onayla</button>
                  <button type="button" disabled={Boolean(busy)} onClick={() => run(`reject-${candidate.id}`, () => fetch(`/api/admin/business-logos/${candidate.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reject" }) }), () => "Aday reddedildi.")} className="hk-button hk-button-neutral hk-button-compact"><X size={13} /> Reddet</button>
                </div>
              </div>
            );
          })}
          {summary?.primary && <p className="text-[11px]" style={{ color: "var(--admin-text-muted)" }}>Not: Bir adayı onaylamak mevcut doğrulanmış logonun yerini alır.</p>}
        </div>
      )}
      {message && <p role="status" className="mt-2 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>{message}</p>}
    </section>
  );
}
