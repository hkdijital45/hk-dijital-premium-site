"use client";

import { useState } from "react";

export function LoginForm() {
  const [userType, setUserType] = useState<"admin" | "customer">("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("kurulum") === "basarili"
      ? "İlk yönetici hesabı oluşturuldu. Giriş yapabilirsiniz."
      : ""
  );
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, userType })
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(data.error || "Giriş yapılamadı. Bilgilerinizi kontrol edin.");
      return;
    }

    window.location.href = data.redirectTo || (userType === "admin" ? "/hk-admin" : "/musteri-paneli");
  }

  async function forgotPassword() {
    setError("");
    setResetMessage("");
    if (!email.trim()) {
      setError("Şifre sıfırlama için e-posta adresinizi yazın.");
      return;
    }
    setResetLoading(true);
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await response.json().catch(() => ({}));
    setResetLoading(false);
    if (!response.ok) {
      setError(data.error || "Şifre sıfırlama e-postası gönderilemedi.");
      return;
    }
    setResetMessage(data.message || "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.");
  }

  return (
    <form onSubmit={submit} className="glass-card mx-auto w-full max-w-xl p-6 sm:p-8">
      <p className="text-xs font-black uppercase tracking-[.18em] text-amber-100">Oturum açın</p>
      <h2 className="mt-3 text-2xl font-black text-white">Hesabınıza güvenli giriş</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">Size uygun panel türünü seçerek devam edin.</p>
      <div className="mt-6 grid grid-cols-2 gap-2 rounded-[8px] border border-white/10 bg-black/25 p-1">
        <button type="button" onClick={() => setUserType("customer")} className={`min-h-11 rounded-[8px] text-sm font-black ${userType === "customer" ? "bg-cyan-300 text-slate-950" : "text-slate-300"}`}>
          Müşteri
        </button>
        <button type="button" onClick={() => setUserType("admin")} className={`min-h-11 rounded-[8px] text-sm font-black ${userType === "admin" ? "bg-cyan-300 text-slate-950" : "text-slate-300"}`}>
          Yönetici
        </button>
      </div>

      <label className="mt-6 grid gap-2 text-sm font-semibold text-slate-200">
        E-posta
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className="min-h-12 rounded-[8px] border border-white/10 bg-black/30 px-4 text-white focus:ring-2 focus:ring-cyan-300" />
      </label>

      <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-200">
        Şifre
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" className="min-h-12 rounded-[8px] border border-white/10 bg-black/30 px-4 text-white focus:ring-2 focus:ring-cyan-300" />
      </label>

      <button type="button" onClick={forgotPassword} disabled={resetLoading} className="mt-4 text-sm font-semibold text-cyan-100 disabled:opacity-60">
        {resetLoading ? "Gönderiliyor..." : "Şifremi unuttum"}
      </button>

      {notice && <p className="mt-4 rounded-[8px] bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</p>}
      {resetMessage && <p className="mt-4 rounded-[8px] bg-emerald-500/10 p-3 text-sm text-emerald-200">{resetMessage}</p>}
      {error && <p className="mt-4 rounded-[8px] bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

      <button disabled={loading} className="mt-6 min-h-12 w-full rounded-full bg-cyan-300 font-black text-slate-950 disabled:opacity-60">
        {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
      </button>
    </form>
  );
}
