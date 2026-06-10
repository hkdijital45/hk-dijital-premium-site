"use client";

import { useState } from "react";

export function SuperAdminBootstrapForm({ enabled = true }: { enabled?: boolean }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bootstrapSecret, setBootstrapSecret] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalıdır.");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/auth/bootstrap-super-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password, bootstrapSecret })
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(data.error || "Süper admin hesabı oluşturulamadı veya onarılamadı.");
      return;
    }

    setMessage(data.message || "Süper admin hesabı oluşturuldu veya onarıldı. Artık giriş yapabilirsiniz.");
  }

  return (
    <form onSubmit={submit} className="mx-auto grid w-full max-w-xl gap-4 rounded-[8px] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl">
      {!enabled && (
        <div className="rounded-[8px] border border-red-300/30 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
          Süper admin kurulumu kapalı.
        </div>
      )}
      <div className="rounded-[8px] border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
        Bu sayfa sadece ilk kurulum veya acil admin onarımı içindir. İşlem bitince BOOTSTRAP_ADMIN_SECRET ve FORCE_BOOTSTRAP_ADMIN değişkenlerini Vercel’den kaldırın.
      </div>

      <label className="grid gap-2 text-sm font-semibold text-slate-200">
        Ad Soyad
        <input disabled={!enabled} value={fullName} onChange={(event) => setFullName(event.target.value)} required autoComplete="name" className="min-h-12 rounded-[8px] border border-white/10 bg-black/30 px-4 text-white focus:ring-2 focus:ring-cyan-300 disabled:opacity-60" />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-slate-200">
        E-posta
        <input disabled={!enabled} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className="min-h-12 rounded-[8px] border border-white/10 bg-black/30 px-4 text-white focus:ring-2 focus:ring-cyan-300 disabled:opacity-60" />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-slate-200">
        Şifre
        <input disabled={!enabled} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" className="min-h-12 rounded-[8px] border border-white/10 bg-black/30 px-4 text-white focus:ring-2 focus:ring-cyan-300 disabled:opacity-60" />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-slate-200">
        Bootstrap Secret
        <input disabled={!enabled} type="password" value={bootstrapSecret} onChange={(event) => setBootstrapSecret(event.target.value)} required autoComplete="off" className="min-h-12 rounded-[8px] border border-white/10 bg-black/30 px-4 text-white focus:ring-2 focus:ring-cyan-300 disabled:opacity-60" />
      </label>

      {error && <p className="rounded-[8px] bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      {message && (
        <div className="rounded-[8px] bg-emerald-500/10 p-3 text-sm text-emerald-200">
          <p>{message}</p>
          <a href="/digital-center" className="mt-3 inline-flex rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950">
            Digital Center’a git
          </a>
        </div>
      )}

      <button disabled={loading || !enabled} className="min-h-12 rounded-full bg-cyan-300 font-black text-slate-950 disabled:opacity-60">
        {loading ? "Süper admin hazırlanıyor..." : "Süper Admin Oluştur / Onar"}
      </button>
    </form>
  );
}
