import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig } from "@/lib/supabase";

type IntegrationStatus = "Çalışıyor" | "Eksik" | "Hatalı" | "Test edilmedi";

const checks = [
  { key: "openai", name: "OpenAI", env: ["OPENAI_API_KEY"], fix: "OPENAI_API_KEY değerini Vercel Environment Variables alanına ekleyin." },
  { key: "gemini", name: "Gemini", env: ["GEMINI_API_KEY"], fix: "GEMINI_API_KEY değerini Vercel’e ekleyin." },
  { key: "groq", name: "Groq", env: ["GROQ_API_KEY"], fix: "GROQ_API_KEY değerini Vercel’e ekleyin." },
  { key: "anthropic", name: "Claude / Anthropic", env: ["ANTHROPIC_API_KEY"], fix: "ANTHROPIC_API_KEY değerini Vercel’e ekleyin." },
  { key: "openrouter", name: "OpenRouter", env: ["OPENROUTER_API_KEY"], fix: "OPENROUTER_API_KEY değerini Vercel’e ekleyin." },
  { key: "manus", name: "Manus", env: ["MANUS_API_KEY", "MANUS_API_BASE_URL", "MANUS_API_ENDPOINT"], fix: "MANUS_API_KEY, MANUS_API_BASE_URL ve MANUS_API_ENDPOINT değerlerini birlikte yapılandırın." },
  { key: "ollama", name: "Ollama", env: ["OLLAMA_BASE_URL"], fix: "OLLAMA_BASE_URL değerini yalnız yerel/özel ağ modeli kullanıyorsanız ekleyin." },
  { key: "resend", name: "Resend / E-posta", env: ["RESEND_API_KEY"], fix: "E-posta gönderimi için RESEND_API_KEY ve gönderici adresini yapılandırın." },
  { key: "discord", name: "Discord Webhook", env: ["DISCORD_WEBHOOK_URL"], fix: "Discord bildirimi için DISCORD_WEBHOOK_URL değerini ekleyin." },
  { key: "meta", name: "Meta Graph API", env: ["META_ACCESS_TOKEN"], fix: "Meta canlı veri için META_ACCESS_TOKEN ve ilgili hesap bilgilerini yapılandırın." },
  { key: "google_ads", name: "Google Ads API", env: ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET"], fix: "Google Ads API için developer token ve OAuth bilgilerini ekleyin." },
  { key: "supabase", name: "Supabase", env: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"], fix: "Supabase URL, anon key ve service role key değerlerini ekleyin." },
  { key: "cron", name: "Cron Secret", env: ["AGENT_HUB_CRON_SECRET"], fix: "Planlı görev endpointini korumak için AGENT_HUB_CRON_SECRET ekleyin." }
];

function envStatus(env: string[]): { status: IntegrationStatus; missingEnv: string[] } {
  const missingEnv = env.filter((key) => !process.env[key]);
  return { status: missingEnv.length ? "Eksik" : "Çalışıyor", missingEnv };
}

export async function GET() {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const integrations = checks.map((item) => {
    const state = item.key === "supabase" ? { status: hasSupabaseConfig() ? "Çalışıyor" as IntegrationStatus : "Eksik" as IntegrationStatus, missingEnv: item.env.filter((key) => !process.env[key]) } : envStatus(item.env);
    return {
      ...item,
      status: state.status,
      missingEnv: state.missingEnv,
      lastTestAt: null,
      responseMs: null,
      lastError: state.missingEnv.length ? "Gerekli environment değişkenleri eksik." : null
    };
  });
  return NextResponse.json({ integrations });
}
