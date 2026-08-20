"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Copy, KeyRound, Link2, Loader2, X } from "lucide-react";
import { TEMPORARY_CUSTOMER_PASSWORD } from "@/lib/password-policy";

type ResetCustomerPasswordButtonProps = {
  userId: string;
  customerName: string;
  email?: string;
  disabled?: boolean;
  disabledReason?: string;
  source?: string;
  onSuccess?: (user: Record<string, unknown>) => void;
};

async function readApiPayload(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return {};
  return response.json().catch(() => ({}));
}

export function ResetCustomerPasswordButton({
  userId,
  customerName,
  email,
  disabled = false,
  disabledReason = "Bu müşteriye bağlı aktif giriş hesabı bulunmuyor.",
  source = "admin_user_management",
  onSuccess
}: ResetCustomerPasswordButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"reset" | "link" | "">("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resetComplete, setResetComplete] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, busy]);

  function showResetDialog() {
    if (disabled || busy) return;
    setError("");
    setMessage("");
    setResetComplete(false);
    setCopied(false);
    setOpen(true);
  }

  async function resetPassword() {
    if (busy) return;
    setBusy("reset");
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source })
      });
      const data = await readApiPayload(response) as { error?: string; message?: string; user?: Record<string, unknown> };
      if (!response.ok) throw new Error(data.error || "Geçici şifre oluşturulamadı. Lütfen tekrar deneyin.");
      setResetComplete(true);
      setMessage(data.message || "Müşteri şifresi geçici olarak sıfırlandı. Müşteri ilk girişinde yeni bir şifre belirlemek zorundadır.");
      if (data.user) onSuccess?.(data.user);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Geçici şifre oluşturulamadı. Lütfen tekrar deneyin.");
    } finally {
      setBusy("");
    }
  }

  async function sendResetLink() {
    if (disabled || busy) return;
    setBusy("link");
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email, source })
      });
      const data = await readApiPayload(response) as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error || "Şifre sıfırlama bağlantısı gönderilemedi.");
      setMessage(data.message || "Şifre sıfırlama bağlantısı gönderildi.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Şifre sıfırlama bağlantısı gönderilemedi.");
    } finally {
      setBusy("");
    }
  }

  async function copyTemporaryPassword() {
    try {
      await navigator.clipboard.writeText(TEMPORARY_CUSTOMER_PASSWORD);
      setCopied(true);
    } catch {
      setError("Geçici şifre kopyalanamadı. Lütfen güvenli şekilde elle paylaşın.");
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={showResetDialog} disabled={disabled || Boolean(busy)} title={disabled ? disabledReason : undefined} className="inline-flex min-h-11 items-center gap-2 rounded-[12px] bg-amber-500 px-4 text-sm font-black text-white transition hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:bg-slate-300">
          <KeyRound size={16} /> Şifreyi Sıfırla
        </button>
        <button type="button" onClick={sendResetLink} disabled={disabled || Boolean(busy)} title={disabled ? disabledReason : undefined} className="inline-flex min-h-11 items-center gap-2 rounded-[12px] border border-slate-300 bg-[var(--admin-surface)] px-4 text-sm font-black text-[var(--admin-text-secondary)] transition hover:border-cyan-300 hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-50">
          {busy === "link" ? <Loader2 className="animate-spin" size={16} /> : <Link2 size={16} />}
          {busy === "link" ? "Gönderiliyor..." : "Sıfırlama Bağlantısı Gönder"}
        </button>
      </div>
      {disabled && <p className="text-xs font-semibold text-[var(--admin-text-muted)]">{disabledReason}</p>}
      {!open && message && <p className="rounded-[10px] border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p>}
      {!open && error && <p className="rounded-[10px] border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

      {open && (
        <div className="fixed inset-0 z-[10000] grid place-items-center bg-slate-950/70 p-4" role="presentation" onMouseDown={() => { if (!busy) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby={`reset-password-title-${userId}`} className="w-full max-w-lg rounded-[22px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 text-[var(--admin-text-primary)] shadow-2xl sm:p-6" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[.16em] text-amber-700">Güvenli Hesap İşlemi</p>
                <h2 id={`reset-password-title-${userId}`} className="mt-2 text-2xl font-black">Müşteri Şifresini Sıfırla</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={Boolean(busy)} aria-label="Pencereyi kapat" className="grid size-11 place-items-center rounded-full border border-[var(--admin-border)] text-[var(--admin-text-secondary)] hover:bg-[var(--admin-surface-soft)] disabled:opacity-50"><X size={18} /></button>
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--admin-text-secondary)]">Bu işlem {customerName} hesabının mevcut şifresini geçersiz kılar. Geçici şifre oluşturulduktan sonra müşteri ilk girişinde yeni bir şifre belirlemek zorundadır.</p>
            <div className="mt-5 rounded-[16px] border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-black uppercase tracking-[.14em] text-amber-700">Geçici şifre</p>
              <p className="mt-2 font-mono text-2xl font-black tracking-[.12em] text-[var(--admin-text-primary)]">{TEMPORARY_CUSTOMER_PASSWORD}</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-amber-900">Bu şifreyi yalnızca müşteriye güvenli bir kanaldan iletin.</p>
            </div>
            {message && <p className="mt-4 flex items-start gap-2 rounded-[12px] border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold leading-6 text-emerald-800"><CheckCircle2 className="mt-0.5 shrink-0" size={18} /> {message}</p>}
            {error && <p className="mt-4 rounded-[12px] border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setOpen(false)} disabled={Boolean(busy)} className="min-h-11 rounded-[12px] border border-slate-300 px-5 text-sm font-black text-[var(--admin-text-secondary)] disabled:opacity-50">{resetComplete ? "Kapat" : "Vazgeç"}</button>
              {resetComplete ? (
                <button type="button" onClick={copyTemporaryPassword} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-cyan-600 px-5 text-sm font-black text-white"><Copy size={16} /> {copied ? "Kopyalandı" : "Geçici Şifreyi Kopyala"}</button>
              ) : (
                <button type="button" onClick={resetPassword} disabled={Boolean(busy)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-amber-500 px-5 text-sm font-black text-white hover:bg-amber-600 disabled:opacity-60">
                  {busy === "reset" && <Loader2 className="animate-spin" size={16} />}
                  {busy === "reset" ? "Şifre sıfırlanıyor..." : "Şifreyi Sıfırla"}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
