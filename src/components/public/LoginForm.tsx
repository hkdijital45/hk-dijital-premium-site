"use client";

import { useState } from "react";

export function LoginForm() {
  const [userType, setUserType] = useState<"admin" | "customer">("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-xl rounded-[8px] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl">
      <div className="grid grid-cols-2 gap-2 rounded-[8px] border border-white/10 bg-black/25 p-1">
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

      <button type="button" className="mt-4 text-sm font-semibold text-cyan-100">
        Şifremi unuttum
      </button>

      {error && <p className="mt-4 rounded-[8px] bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

      <button disabled={loading} className="mt-6 min-h-12 w-full rounded-full bg-cyan-300 font-black text-slate-950 disabled:opacity-60">
        {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
      </button>
    </form>
  );
}
