"use client";

import { useMemo, useState } from "react";
import { Bot, MessageCircle, Send, Sparkles, X } from "lucide-react";

type AssistantContext = "admin" | "customer";

const quickActions: Record<AssistantContext, string[]> = {
  admin: ["Ajans operasyonunu özetle", "Reklam önerisi üret", "Görevleri özetle", "İçerik fikri ver"],
  customer: ["Raporumu yorumla", "Reklam önerisi üret", "Görevleri özetle", "İçerik fikri ver"]
};

function buildFallbackAnswer(context: AssistantContext, prompt: string) {
  const scope = context === "admin"
    ? "Admin görünümünde müşteri, reklam, görev ve rapor akışlarını birlikte değerlendiririm."
    : "Müşteri görünümünde yalnız size açık rapor, görev ve reklam özetleri üzerinden yardımcı olurum.";
  const action = prompt || "Bugünkü öncelikleri kontrol et";
  return `${scope} "${action}" için önerim: önce açık işleri ve eksik entegrasyonları kontrol edin, ardından rapor veya reklam aksiyonunu net bir sonraki adıma bağlayın. Gerçek yapay zekâ sağlayıcısı aktif olduğunda cevaplar canlı verilerle zenginleşir.`;
}

export function HKAssistantWidget({ context = "customer" }: { context?: AssistantContext }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);

  const title = useMemo(() => context === "admin" ? "HK Asistan · Admin" : "HK Asistan", [context]);

  function submit(value = prompt) {
    const cleaned = value.trim();
    if (!cleaned) return;
    setMessages((current) => [
      ...current,
      { role: "user", text: cleaned },
      { role: "assistant", text: buildFallbackAnswer(context, cleaned) }
    ]);
    setPrompt("");
  }

  return (
    <div className="fixed bottom-5 right-5 z-[95]">
      {open && (
        <section className="mb-3 w-[min(380px,calc(100vw-2.5rem))] overflow-hidden rounded-[22px] border border-cyan-200/40 bg-white shadow-[0_28px_90px_rgba(15,23,42,.24)]">
          <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-cyan-600 via-blue-600 to-violet-600 p-4 text-white">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.14em] text-cyan-100"><Sparkles size={14} /> {title}</p>
              <h2 className="mt-1 text-lg font-black">Rapor, reklam, görev ve içerik desteği</h2>
              <p className="mt-1 text-xs leading-5 text-cyan-50">Yetki kapsamına göre güvenli demo yanıt üretir.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-full border border-white/20 bg-white/10" aria-label="HK Asistan kapat">
              <X size={16} />
            </button>
          </div>

          <div className="max-h-[360px] overflow-y-auto p-4">
            <div className="grid gap-2">
              {quickActions[context].map((item) => (
                <button key={item} type="button" onClick={() => submit(item)} className="rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-bold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50">
                  {item}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3">
              {messages.length === 0 && (
                <p className="rounded-[14px] border border-dashed border-slate-200 p-4 text-sm leading-6 text-slate-500">Bir hızlı aksiyon seçin veya sorunuzu yazın. Gerçek yapay zekâ bağlantısı yoksa güvenli örnek cevap gösterilir.</p>
              )}
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`rounded-[14px] p-3 text-sm leading-6 ${message.role === "user" ? "ml-8 bg-cyan-50 font-bold text-cyan-950" : "mr-8 bg-slate-100 text-slate-700"}`}>
                  {message.text}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 border-t border-slate-200 bg-slate-50 p-3">
            <input value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submit(); }} className="min-h-11 flex-1 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-cyan-300" placeholder="Sorunuzu yazın..." />
            <button type="button" onClick={() => submit()} className="grid size-11 place-items-center rounded-full bg-cyan-500 text-white" aria-label="Gönder">
              <Send size={17} />
            </button>
          </div>
        </section>
      )}
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 text-white shadow-[0_18px_55px_rgba(34,211,238,.35)] ring-1 ring-white/40" aria-label="HK Asistan aç">
        {open ? <MessageCircle size={24} /> : <Bot size={25} />}
      </button>
    </div>
  );
}
