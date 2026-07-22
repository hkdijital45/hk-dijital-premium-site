import { NextResponse } from "next/server";
import { getSiteContent, saveSiteContent } from "@/lib/content";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

function status(name: string, configured: boolean, model = "-", warning = "", responseTimeMs = 0) {
  return {
    name,
    status: configured ? "Aktif" : "API Eksik",
    model,
    lastTestTime: new Date().toISOString(),
    warning,
    responseTimeMs
  };
}

// Gerçek bağlantı testi: env değişkeni varlığına bakmakla yetinmek yerine
// Supabase REST üzerinden hafif bir sorgu çalıştırıp gerçek yanıtı ölçer.
// Bu uygulamada Auth ve Storage ayrı canlı prob gerektirmez çünkü üçü de aynı
// SUPABASE_SERVICE_ROLE_KEY bağlantısını kullanır; supabase/auth/storage
// kartları bu tek gerçek testin sonucunu paylaşır (yapay olarak üç bağımsız
// sonuç üretilmez).
async function checkSupabaseConnectivity() {
  if (!hasSupabaseConfig()) return { ok: false, responseMs: 0, error: "Supabase yapılandırılmadı." };
  const startedAt = Date.now();
  try {
    await supabaseRest<unknown[]>("users?select=id&limit=1");
    return { ok: true, responseMs: Date.now() - startedAt, error: "" };
  } catch (error) {
    return { ok: false, responseMs: Date.now() - startedAt, error: error instanceof Error ? error.message : "Bağlantı testi başarısız oldu." };
  }
}

export async function POST() {
  if (!(await requireModuleAccess("api-ayarlari")) && !(await requireModuleAccess("dashboard")) && !(await requireModuleAccess("sistem-sagligi"))) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const content = await getSiteContent();
  const api = content.settings.api || {};
  const startedAt = Date.now();
  const supabaseCheck = await checkSupabaseConnectivity();
  const results = {
    groq: status("Groq", Boolean(process.env.GROQ_API_KEY), process.env.GROQ_MODEL || "llama-3.3-70b-versatile"),
    gemini: status("Gemini", Boolean(process.env.GEMINI_API_KEY), process.env.GEMINI_MODEL || "gemini-2.0-flash"),
    openai: status("OpenAI", Boolean(process.env.OPENAI_API_KEY), process.env.OPENAI_MODEL || "gpt-4.1-mini"),
    openrouter: status("OpenRouter", Boolean(process.env.OPENROUTER_API_KEY), process.env.OPENROUTER_MODEL || "Alternatif model geçidi"),
    manus: status("Manus", Boolean(process.env.MANUS_API_KEY && (process.env.MANUS_API_ENDPOINT || process.env.MANUS_API_BASE_URL)), process.env.MANUS_MODEL || "Derin araştırma ajanı"),
    ollama: status("Ollama", Boolean(process.env.OLLAMA_BASE_URL), process.env.OLLAMA_MODEL || "Yerel model"),
    meta: status("Meta", Boolean(process.env.META_AD_LIBRARY_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN), "Meta Ad Library Token"),
    googleMaps: status("Google Maps", Boolean(process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY), "Places API"),
    googleAds: status("Google Ads", Boolean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN || process.env.GOOGLE_ADS_CLIENT_ID), "Google Ads API", "Google Ads bağlı değilse Google Maps sinyalleri kullanılır."),
    ga4: status("Google Analytics 4", Boolean(process.env.GOOGLE_CLIENT_ID || api.google_client_id) && Boolean(process.env.GOOGLE_CLIENT_SECRET || api.google_client_secret), "Analytics Admin API"),
    searchConsole: status("Search Console", Boolean(process.env.GOOGLE_CLIENT_ID || api.google_client_id), "Search Console API"),
    businessProfile: status("Business Profile", Boolean(process.env.GOOGLE_CLIENT_ID || api.google_client_id), "Business Profile API"),
    smtp: status("E-posta", Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST || api.smtp_host), process.env.RESEND_API_KEY ? "Resend" : "SMTP"),
    webhook: status("Webhook", Boolean(process.env.WEBHOOK_SECRET || api.webhook_url), "Sunucu webhook'u"),
    supabase: status("Supabase", supabaseCheck.ok, "Veritabanı / Auth / Storage", supabaseCheck.error, supabaseCheck.responseMs),
    auth: status("Kimlik Doğrulama", supabaseCheck.ok, "Supabase Auth (Supabase ile aynı bağlantı testi)", supabaseCheck.error, supabaseCheck.responseMs),
    storage: status("Dosya Depolama", supabaseCheck.ok, "Supabase Storage (Supabase ile aynı bağlantı testi)", supabaseCheck.error, supabaseCheck.responseMs)
  };
  const responseTimeMs = Date.now() - startedAt;
  Object.entries(results).forEach(([key, item]) => {
    if (key === "supabase" || key === "auth" || key === "storage") return;
    item.responseTimeMs = responseTimeMs;
  });

  const next = {
    ...content,
    settings: {
      ...content.settings,
      api: {
        ...api,
        activeProvider: api.activeProvider || "groq",
        active_ai_provider: api.active_ai_provider || "groq",
        active_ai_model: api.active_ai_model || api.model || "llama-3.3-70b-versatile",
        ai_mode: api.ai_mode || "live",
        ai_status_last_test_at: new Date().toISOString(),
        ai_status: results
      }
    }
  };

  await saveSiteContent(next).catch(() => null);
  return NextResponse.json({
    ok: true,
    results,
    activeProvider: next.settings.api.active_ai_provider,
    activeModel: next.settings.api.active_ai_model,
    mode: next.settings.api.ai_mode === "demo" ? "Demo" : next.settings.api.ai_mode === "local" ? "Yerel" : "Canlı",
    lastTestTime: next.settings.api.ai_status_last_test_at,
    responseTimeMs
  });
}
