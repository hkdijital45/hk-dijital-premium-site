"use client";

import { useState } from "react";
import { validateNewPassword } from "@/lib/password-policy";

export function ResetPasswordForm({ mode = "recovery" }: { mode?: "recovery" | "forced" }) {
  const forced = mode === "forced";
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

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/digital-center";
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const validationError = validateNewPassword(password, passwordConfirm);
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(forced ? "/api/auth/change-password" : "/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(forced ? { password, passwordConfirm } : { accessToken, password, passwordConfirm })
      });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await response.json().catch(() => ({}))
        : {};

      if (!response.ok) {
        setError(data.error || "Şifre güncellenemedi. Lütfen tekrar deneyin.");
        return;
      }

      setMessage(data.message || (forced ? "Şifreniz başarıyla değiştirildi." : "Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz."));
      if (forced) {
        window.setTimeout(() => { window.location.href = data.redirectTo || "/musteri-paneli"; }, 700);
      } else {
        window.history.replaceState(null, "", "/sifre-sifirla");
      }
    } catch {
      setError("Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto grid w-full max-w-xl gap-4 rounded-[8px] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl">
      {!forced && !accessToken && (
        <p className="rounded-[8px] bg-amber-300/10 p-3 text-sm text-amber-100">
          Şifre sıfırlama bağlantısı bulunamadı. Lütfen e-postanızdaki son bağlantıyı kullanın.
        </p>
      )}
      <label className="grid gap-2 text-sm font-semibold text-slate-200">
        Yeni Şifre
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" className="min-h-12 rounded-[8px] border border-white/10 bg-black/30 px-4 text-white focus:ring-2 focus:ring-cyan-300" />
      </label>
      <p className="text-xs leading-5 text-slate-400">En az 8 karakter; büyük harf, küçük harf, rakam ve özel karakter kullanın.</p>
      <label className="grid gap-2 text-sm font-semibold text-slate-200">
        Yeni Şifre Tekrar
        <input type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" className="min-h-12 rounded-[8px] border border-white/10 bg-black/30 px-4 text-white focus:ring-2 focus:ring-cyan-300" />
      </label>
      {error && <p role="alert" className="rounded-[8px] bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      {message && <p role="status" className="rounded-[8px] bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</p>}
      <button type="submit" disabled={loading || (!forced && !accessToken)} title={!forced && !accessToken ? "Şifre sıfırlama bağlantısı gerekli." : undefined} className="min-h-12 rounded-full bg-cyan-300 font-black text-slate-950 disabled:opacity-60">
        {loading ? "Şifre değiştiriliyor..." : forced ? "Şifremi Değiştir" : "Şifremi Güncelle"}
      </button>
      {forced
        ? <button type="button" onClick={logout} className="w-full text-center text-sm font-semibold text-cyan-100">Çıkış Yap</button>
        : <a href="/digital-center" className="text-center text-sm font-semibold text-cyan-100">Digital Center’a dön</a>}
    </form>
  );
}
