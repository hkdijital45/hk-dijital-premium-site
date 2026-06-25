"use client";

import { useState } from "react";

export function ResetPasswordForm() {
  const [accessToken] = useState(() => {
    if (typeof window === "undefined") return "";
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    return hash.get("access_token") || query.get("access_token") || "";
  });
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken, password, passwordConfirm })
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(data.error || "Şifre güncellenemedi.");
      return;
    }

    setMessage(data.message || "Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.");
    window.history.replaceState(null, "", "/sifre-sifirla");
  }

  return (
    <form onSubmit={submit} className="mx-auto grid w-full max-w-xl gap-4 rounded-[8px] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl">
      {!accessToken && (
        <p className="rounded-[8px] bg-amber-300/10 p-3 text-sm text-amber-100">
          Şifre sıfırlama bağlantısı bulunamadı. Lütfen e-postanızdaki son bağlantıyı kullanın.
        </p>
      )}
      <label className="grid gap-2 text-sm font-semibold text-slate-200">
        Yeni Şifre
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" className="min-h-12 rounded-[8px] border border-white/10 bg-black/30 px-4 text-white focus:ring-2 focus:ring-cyan-300" />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-slate-200">
        Yeni Şifre Tekrar
        <input type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} required minLength={8} autoComplete="new-password" className="min-h-12 rounded-[8px] border border-white/10 bg-black/30 px-4 text-white focus:ring-2 focus:ring-cyan-300" />
      </label>
      {error && <p className="rounded-[8px] bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      {message && <p className="rounded-[8px] bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</p>}
      <button type="submit" disabled={loading || !accessToken} title={!accessToken ? "Şifre sıfırlama bağlantısı gerekli." : undefined} className="min-h-12 rounded-full bg-cyan-300 font-black text-slate-950 disabled:opacity-60">
        {loading ? "Şifre güncelleniyor..." : "Şifremi Güncelle"}
      </button>
      <a href="/digital-center" className="text-center text-sm font-semibold text-cyan-100">Digital Center’a dön</a>
    </form>
  );
}
