"use client";

import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);

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
    <form onSubmit={submit} className={`relative mx-auto w-full overflow-hidden rounded-[32px] border border-white/15 bg-white/[0.085] p-7 text-left shadow-[0_36px_120px_rgba(0,0,0,.45),0_0_90px_rgba(34,211,238,.16)] backdrop-blur-2xl sm:p-9 ${desktopMode ? "max-w-md" : "max-w-2xl"}`}>
      <div className="pointer-events-none absolute -right-24 -top-24 size-56 rounded-full bg-cyan-300/20 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-28 left-12 size-60 rounded-full bg-yellow-300/10 blur-3xl" aria-hidden="true" />

      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-4 py-2 text-[11px] font-black uppercase tracking-[.22em] text-cyan-100">
          <LockKeyhole size={14} /> HK Dijital Güvenli Giriş
        </div>
        <h2 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl">Digital Center’a Giriş Yap</h2>
        <p className="mt-3 max-w-xl text-base leading-7 text-slate-300">Admin operasyon merkezi ve müşteri paneli için rapor, entegrasyon, reklam performansı ve proje verilerine güvenli erişim.</p>
      </div>

      <label className="relative mt-8 grid gap-2 text-sm font-bold text-slate-100">
        E-posta
        <span className="relative block">
          <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cyan-100/70" size={19} />
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="ornek@firma.com" className="min-h-14 w-full rounded-[16px] border border-white/12 bg-black/35 py-3 pl-12 pr-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200/70 focus:ring-2 focus:ring-cyan-300/35" />
        </span>
      </label>

      <label className="relative mt-5 grid gap-2 text-sm font-bold text-slate-100">
        Şifre
        <span className="relative block">
          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cyan-100/70" size={19} />
          <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" placeholder="Şifrenizi yazın" className="min-h-14 w-full rounded-[16px] border border-white/12 bg-black/35 py-3 pl-12 pr-14 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200/70 focus:ring-2 focus:ring-cyan-300/35" />
          <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"} className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white">
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </span>
      </label>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-3 rounded-full border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold text-slate-200">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="size-4 accent-cyan-300" />
          Beni Hatırla
        </label>

        <button type="button" onClick={forgotPassword} disabled={resetLoading} className="rounded-full px-3 py-2 text-sm font-bold text-cyan-100 transition hover:bg-white/10 disabled:opacity-60">
          {resetLoading ? "Gönderiliyor..." : "Şifremi unuttum"}
        </button>
      </div>

      {notice && <p className="mt-4 rounded-[8px] bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</p>}
      {resetMessage && <p className="mt-4 rounded-[8px] bg-emerald-500/10 p-3 text-sm text-emerald-200">{resetMessage}</p>}
      {error && <p className="mt-4 rounded-[8px] bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

      <button type="submit" disabled={loading} className="mt-7 min-h-14 w-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-yellow-300 px-6 text-base font-black text-slate-950 shadow-[0_0_44px_rgba(34,211,238,.28)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60">
        {loading ? "Giriş yapılıyor..." : "Digital Center’a Giriş Yap"}
      </button>
      <p className="mt-5 text-center text-xs leading-5 text-slate-400">Güvenli Digital Center erişimi. Rolünüze göre admin paneline veya müşteri paneline yönlendirilirsiniz.</p>
    </form>
  );
}
