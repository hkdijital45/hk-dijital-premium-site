"use client";

import { useState } from "react";
import { AlertTriangle, ImageOff } from "lucide-react";

function isValidImageUrl(value: string) {
  if (!value.trim()) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function CoverImageField({ url, alt, onUrlChange, onAltChange }: { url: string; alt: string; onUrlChange: (value: string) => void; onAltChange: (value: string) => void }) {
  const [broken, setBroken] = useState(false);
  const valid = isValidImageUrl(url);

  return (
    <div className="grid gap-3">
      <label className="grid gap-2 text-sm font-bold text-slate-300">
        Kapak görseli URL
        <input
          value={url}
          onChange={(event) => { onUrlChange(event.target.value); setBroken(false); }}
          placeholder="https://..."
          className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300"
        />
      </label>
      {url.trim() && !valid ? (
        <p className="flex items-center gap-2 rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-xs font-bold text-amber-100"><AlertTriangle size={14} /> Geçerli bir http(s) görsel adresi girin.</p>
      ) : null}
      {valid && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" onError={() => setBroken(true)} className="h-32 w-full rounded-xl border border-white/10 object-cover" />
      ) : null}
      {valid && broken ? (
        <p className="flex items-center gap-2 rounded-xl border border-rose-300/25 bg-rose-400/10 p-3 text-xs font-bold text-rose-100"><ImageOff size={14} /> Görsel yüklenemedi; adresi kontrol edin.</p>
      ) : null}
      <label className="grid gap-2 text-sm font-bold text-slate-300">
        Alt metin {url.trim() ? <span className="text-rose-300">(zorunlu)</span> : null}
        <input
          value={alt}
          onChange={(event) => onAltChange(event.target.value)}
          placeholder="Görseli kısaca ve doğal biçimde tanımlayın"
          className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300"
        />
      </label>
      {url.trim() && !alt.trim() ? (
        <p className="flex items-center gap-2 rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-xs font-bold text-amber-100"><AlertTriangle size={14} /> Kapak görseli eklendi ama alt metin eksik. Ekran okuyucular ve görsel SEO için gerekli.</p>
      ) : null}
    </div>
  );
}
