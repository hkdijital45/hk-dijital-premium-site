import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { runRealAgentProvider } from "@/lib/agent-providers";
import { hasSupabaseConfig } from "@/lib/supabase";

export async function POST(request: Request) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const key = String(body.key || "");
  const started = Date.now();

  if (key === "supabase") {
    return NextResponse.json({ ok: hasSupabaseConfig(), status: hasSupabaseConfig() ? "Çalışıyor" : "Eksik", responseMs: Date.now() - started, message: hasSupabaseConfig() ? "Supabase bağlantı değişkenleri mevcut." : "Supabase env değerleri eksik." });
  }
  if (key === "discord") {
    return NextResponse.json({ ok: Boolean(process.env.DISCORD_WEBHOOK_URL), status: process.env.DISCORD_WEBHOOK_URL ? "Çalışıyor" : "Eksik", responseMs: Date.now() - started, message: process.env.DISCORD_WEBHOOK_URL ? "Discord webhook yapılandırılmış." : "DISCORD_WEBHOOK_URL eksik." });
  }
  if (key === "resend") {
    return NextResponse.json({ ok: Boolean(process.env.RESEND_API_KEY), status: process.env.RESEND_API_KEY ? "Çalışıyor" : "Eksik", responseMs: Date.now() - started, message: process.env.RESEND_API_KEY ? "Resend API anahtarı yapılandırılmış." : "RESEND_API_KEY eksik." });
  }
  if (["openai", "gemini", "groq", "anthropic", "openrouter", "manus", "ollama"].includes(key)) {
    const result = await runRealAgentProvider({ provider: key, taskType: "fast_answer", prompt: "Kısa bağlantı testi yap.", outputFormat: "kısa özet", timeoutMs: 12000 });
    return NextResponse.json({ ok: !result.usedFallback, status: result.usedFallback ? "Eksik" : "Çalışıyor", responseMs: result.responseMs, message: result.usedFallback ? result.errorMessage || "Sağlayıcı yedek akışa düştü." : "Sağlayıcı test yanıtı verdi." });
  }
  return NextResponse.json({ ok: false, status: "Test edilmedi", message: "Bu entegrasyon için otomatik test tanımlı değil.", responseMs: Date.now() - started });
}
