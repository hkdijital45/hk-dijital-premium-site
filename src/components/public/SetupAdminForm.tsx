"use client";

import { useEffect, useState } from "react";

export function SetupAdminForm() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/setup-admin")
      .then((response) => response.json())
      .then((data) => setAllowed(Boolean(data.allowed)))
      .catch(() => {
        setAllowed(false);
        setError("Kurulum durumu kontrol edilemedi.");
      });
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalıdır.");
      return;
    }

    if (password !== passwordConfirm) {
      setError("Şifre tekrarı eşleşmiyor.");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/auth/setup-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password, passwordConfirm })
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(data.error || "Yönetici hesabı oluşturulamadı.");
      return;
    }

    setMessage(data.message || "İlk yönetici hesabı oluşturuldu. Giriş yapabilirsiniz.");
    setTimeout(() => {
      window.location.href = "/digital-center?kurulum=basarili";
    }, 900);
  }

  if (allowed === null) {
    return <p className="mx-auto max-w-xl rounded-[8px] border border-white/10 bg-white/[0.06] p-6 text-slate-300">Kurulum durumu kontrol ediliyor...</p>;
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-xl rounded-[8px] border border-white/10 bg-white/[0.06] p-6 text-center">
        <h2 className="text-2xl font-black text-white">Kurulum tamamlandı.</h2>
        <p className="mt-3 text-slate-300">Bu sayfa artık kullanılamaz.</p>
        <a href="/digital-center" className="mt-6 inline-flex rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">
          Digital Center’a dön
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto grid w-full max-w-xl gap-4 rounded-[8px] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl">
      <label className="grid gap-2 text-sm font-semibold text-slate-200">
        Ad Soyad
        <input value={fullName} onChange={(event) => setFullName(event.target.value)} required className="min-h-12 rounded-[8px] border border-white/10 bg-black/30 px-4 text-white focus:ring-2 focus:ring-cyan-300" />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-slate-200">
        E-posta
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className="min-h-12 rounded-[8px] border border-white/10 bg-black/30 px-4 text-white focus:ring-2 focus:ring-cyan-300" />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-slate-200">
        Şifre
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" className="min-h-12 rounded-[8px] border border-white/10 bg-black/30 px-4 text-white focus:ring-2 focus:ring-cyan-300" />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-slate-200">
        Şifre Tekrar
        <input type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} required minLength={8} autoComplete="new-password" className="min-h-12 rounded-[8px] border border-white/10 bg-black/30 px-4 text-white focus:ring-2 focus:ring-cyan-300" />
      </label>
      {error && <p className="rounded-[8px] bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      {message && <p className="rounded-[8px] bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</p>}
      <button disabled={loading} className="min-h-12 rounded-full bg-cyan-300 font-black text-slate-950 disabled:opacity-60">
        {loading ? "Hesap oluşturuluyor..." : "İlk Yönetici Hesabını Oluştur"}
      </button>
    </form>
  );
}
