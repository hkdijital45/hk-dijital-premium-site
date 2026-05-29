"use client";

import { useState } from "react";

export function AdminLogin() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("hk-dijital-2026");
  const [error, setError] = useState("");

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    if (!response.ok) {
      setError("Giriş başarısız. .env ayarlarınızı kontrol edin.");
      return;
    }
    window.location.reload();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#050711] px-4 text-white">
      <form onSubmit={login} className="w-full max-w-md rounded-[8px] border border-white/10 bg-white/[0.06] p-8 shadow-2xl backdrop-blur-xl">
        <p className="text-sm font-bold uppercase tracking-[.22em] text-cyan-200">HK Dijital</p>
        <h1 className="mt-3 text-3xl font-black">Yönetim Girişi</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">Bu rota public navigasyonda görünmez. Üretimde ADMIN_USERNAME, ADMIN_PASSWORD ve ADMIN_SESSION_SECRET ortam değişkenlerini değiştirin.</p>
        <label className="mt-6 grid gap-2 text-sm font-semibold">
          Kullanıcı adı
          <input value={username} onChange={(event) => setUsername(event.target.value)} className="min-h-12 rounded-[8px] border border-white/10 bg-black/30 px-4 text-white" />
        </label>
        <label className="mt-4 grid gap-2 text-sm font-semibold">
          Şifre
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="min-h-12 rounded-[8px] border border-white/10 bg-black/30 px-4 text-white" />
        </label>
        {error && <p className="mt-4 rounded-[8px] bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        <button className="mt-6 min-h-12 w-full rounded-full bg-cyan-300 font-black text-slate-950">Giriş Yap</button>
      </form>
    </main>
  );
}
