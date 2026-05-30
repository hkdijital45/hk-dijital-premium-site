"use client";

import { useEffect } from "react";

export function AuthCallbackHandler() {
  useEffect(() => {
    const hash = window.location.hash || "";
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const type = params.get("type");

    if (type === "recovery" || params.has("access_token")) {
      window.location.replace(`/sifre-sifirla${hash}`);
      return;
    }

    window.location.replace("/giris");
  }, []);

  return (
    <div className="mx-auto max-w-xl rounded-[8px] border border-white/10 bg-white/[0.06] p-6 text-center text-slate-200">
      Güvenli yönlendirme hazırlanıyor...
    </div>
  );
}
