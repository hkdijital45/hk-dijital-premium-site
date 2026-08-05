"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, MessageCircle, Send, Sparkles, X } from "lucide-react";

type AssistantContext = "admin" | "customer";
type AssistantSettings = {
  assistant_enabled?: boolean;
  real_ai_enabled?: boolean;
  provider?: string;
  allowed_contexts?: string[];
  daily_message_limit?: number;
  welcome_message?: string;
};

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
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<AssistantSettings | null>(context === "admin" ? { assistant_enabled: true, welcome_message: "" } : null);

  const title = useMemo(() => context === "admin" ? "HK Asistan · Admin" : "HK Asistan", [context]);

  useEffect(() => {
    if (context !== "customer") return;
    let active = true;
    fetch("/api/customer/ai-settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (active) setSettings(payload.settings || { assistant_enabled: true });
      })
      .catch(() => {
        if (active) setSettings({ assistant_enabled: true, real_ai_enabled: false, provider: "demo", allowed_contexts: ["general"] });
      });
    return () => { active = false; };
  }, [context]);

  async function submit(value = prompt) {
    const cleaned = value.trim();
    if (!cleaned) return;
    setMessages((current) => [...current, { role: "user", text: cleaned }]);
    setPrompt("");
    setLoading(true);
    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: cleaned, contextKey: cleaned.includes("Rapor") ? "reports" : cleaned.includes("Reklam") ? "ads" : cleaned.includes("Görev") ? "tasks" : "general" })
      });
      const payload = await response.json().catch(() => ({}));
      const answer = response.ok ? payload.answer : payload.error;
      setMessages((current) => [...current, { role: "assistant", text: answer || buildFallbackAnswer(context, cleaned) }]);
    } catch {
      setMessages((current) => [...current, { role: "assistant", text: buildFallbackAnswer(context, cleaned) }]);
    } finally {
      setLoading(false);
    }
  }

  if (context === "customer" && settings?.assistant_enabled === false) return null;

  return (
    <div className="fixed bottom-3 right-3 z-[95] sm:bottom-5 sm:right-5">
      {open && (
        <section className="hk-floating-assistant-panel mb-3 flex max-h-[min(680px,calc(100dvh-6rem))] w-[min(380px,calc(100vw-1.5rem))] flex-col overflow-hidden">
          <div className="hk-floating-assistant-head">
            <div>
              <p className="hk-floating-assistant-eyebrow"><Sparkles size={14} /> {title}</p>
              <h2 className="hk-floating-assistant-title">Rapor, reklam, görev ve içerik desteği</h2>
              <p className="hk-floating-assistant-sub">{settings?.welcome_message || "Yetki kapsamına göre güvenli yanıt üretir."}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="hk-floating-assistant-close" aria-label="HK Asistan kapat">
              <X size={16} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="grid gap-2">
              {quickActions[context].map((item) => (
                <button key={item} type="button" onClick={() => submit(item)} className="hk-floating-assistant-quick-action">
                  {item}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3">
              {messages.length === 0 && (
                <p className="hk-floating-assistant-empty">Bir hızlı aksiyon seçin veya sorunuzu yazın. Gerçek yapay zekâ bağlantısı yoksa güvenli örnek cevap gösterilir.</p>
              )}
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`hk-floating-assistant-bubble ${message.role === "user" ? "is-user" : "is-assistant"}`}>
                  {message.text}
                </div>
              ))}
              {loading && <div className="hk-floating-assistant-typing"><span /><span /><span /></div>}
            </div>
          </div>

          <div className="hk-floating-assistant-footer">
            <input value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submit(); }} className="hk-floating-assistant-input" placeholder="Sorunuzu yazın..." />
            <button type="button" onClick={() => submit()} disabled={loading} className="hk-floating-assistant-send" aria-label="Gönder">
              <Send size={17} />
            </button>
          </div>
        </section>
      )}
      <button type="button" onClick={() => setOpen((value) => !value)} className="hk-floating-assistant-trigger" aria-label="HK Asistan aç">
        {open ? <MessageCircle size={24} /> : <Bot size={25} />}
      </button>
    </div>
  );
}
