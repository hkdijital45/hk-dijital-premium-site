"use client";

import { useState } from "react";

export function LoginForm({ desktopMode = false }: { desktopMode?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [notice] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("kurulum") === "basarili"
      ? "İlk yönetici hesabı oluşturuldu. Giriş yapabilirsiniz."
      : typeof window !== "undefined" && new URLSearchParams(window.location.search).get("error") === "yetkisiz"
      ? "Bu alan sadece yetkili kullanıcılar içindir."
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
      body: JSON.stringify({ email, password, remember })
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(data.error || "Giriş yapılamadı. Bilgilerinizi kontrol edin.");
      return;
    }

    const target = data.redirectTo || "/musteri-paneli";
    window.location.href = desktopMode && target.startsWith("/hk-admin") ? `${target}?desktop=1` : target;
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
    <form onSubmit={submit} className={`glass-card mx-auto w-full p-6 sm:p-8 ${desktopMode ? "max-w-md" : "max-w-xl"}`}>
      <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-100">Güvenli erişim alanı</p>
      <h2 className="mt-3 text-3xl font-black text-white">Digital Center</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">Raporlarınıza, projelerinize ve dijital performans verilerinize güvenli şekilde erişin.</p>

      <label className="mt-6 grid gap-2 text-sm font-semibold text-slate-200">
        E-posta
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className="min-h-12 rounded-[8px] border border-white/10 bg-black/30 px-4 text-white focus:ring-2 focus:ring-cyan-300" />
      </label>

      <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-200">
        Şifre
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" className="min-h-12 rounded-[8px] border border-white/10 bg-black/30 px-4 text-white focus:ring-2 focus:ring-cyan-300" />
      </label>

      <label className="mt-4 flex items-center gap-3 rounded-[8px] border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-slate-200">
        <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="size-4 accent-cyan-300" />
        Beni Hatırla
      </label>

      <button type="button" onClick={forgotPassword} disabled={resetLoading} className="mt-4 text-sm font-semibold text-cyan-100 disabled:opacity-60">
        {resetLoading ? "Gönderiliyor..." : "Şifremi unuttum"}
      </button>

      {notice && <p className="mt-4 rounded-[8px] bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</p>}
      {resetMessage && <p className="mt-4 rounded-[8px] bg-emerald-500/10 p-3 text-sm text-emerald-200">{resetMessage}</p>}
      {error && <p className="mt-4 rounded-[8px] bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

      <button type="submit" disabled={loading} className="mt-6 min-h-12 w-full rounded-full bg-cyan-300 font-black text-slate-950 disabled:opacity-60">
        {loading ? "Giriş yapılıyor..." : "Digital Center’a Giriş Yap"}
      </button>
      <p className="mt-4 text-center text-xs leading-5 text-slate-500">Güvenli erişim alanı. Hesabınıza ait performans ve rapor verileri korunur.</p>
    </form>
  );
}
