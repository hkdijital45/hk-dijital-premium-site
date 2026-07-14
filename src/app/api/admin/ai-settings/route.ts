import { NextResponse } from "next/server";
import { getSiteContent, saveSiteContent } from "@/lib/content";
import { normalizeUnifiedAiProvider, unifiedAiPriorityKeys } from "@/lib/ai-provider-options";
import { requireModuleAccess } from "@/lib/permissions";

const allowedModes = new Set(["live", "demo", "local"]);

export async function POST(request: Request) {
  if (!(await requireModuleAccess("api-ayarlari"))) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const content = await getSiteContent();
  const api = content.settings.api;
  const requestedProvider = normalizeUnifiedAiProvider(body.active_ai_provider || body.activeProvider || api.active_ai_provider || api.activeProvider || "auto");
  const activeProvider = requestedProvider === "auto" ? "automatic" : requestedProvider === "ollama" ? "local" : requestedProvider;
  const allowedPriority = new Set<string>(unifiedAiPriorityKeys.map((key) => key === "ollama" ? "local" : key));
  const normalizePriority = (value: unknown): string[] => (Array.isArray(value) ? value : [])
    .map((item) => normalizeUnifiedAiProvider(String(item)))
    .map((item) => item === "ollama" ? "local" : item)
    .filter((item) => allowedPriority.has(item));
  const providerPriority = Array.isArray(body.ai_provider_priority)
    ? [...new Set(normalizePriority(body.ai_provider_priority))]
    : Array.isArray(api.ai_provider_priority)
      ? normalizePriority(api.ai_provider_priority)
      : ["gemini", "groq", "openai", "openrouter", "local", "demo"];
  const nextApi = {
    ...api,
    activeProvider,
    active_ai_provider: activeProvider,
    model: body.model || api.model || (String(activeProvider).toLocaleLowerCase("tr") === "groq" ? "llama-3.3-70b-versatile" : String(activeProvider).toLocaleLowerCase("tr") === "gemini" ? "gemini-2.0-flash" : "automatic-fallback"),
    active_ai_model: body.active_ai_model || body.model || api.active_ai_model || api.model || (String(activeProvider).toLocaleLowerCase("tr") === "groq" ? "llama-3.3-70b-versatile" : String(activeProvider).toLocaleLowerCase("tr") === "gemini" ? "gemini-2.0-flash" : "automatic-fallback"),
    ai_mode: allowedModes.has(String(body.ai_mode)) ? String(body.ai_mode) : activeProvider === "local" ? "local" : activeProvider === "demo" ? "demo" : "live",
    ai_provider_priority: providerPriority,
    demoMode: activeProvider === "demo"
  };

  const next = { ...content, settings: { ...content.settings, api: nextApi } };
  await saveSiteContent(next);
  return NextResponse.json({
    ok: true,
    message: "AI sağlayıcı ayarları kaydedildi.",
    api: {
      activeProvider: nextApi.activeProvider,
      active_ai_provider: nextApi.active_ai_provider,
      model: nextApi.model,
      active_ai_model: nextApi.active_ai_model,
      ai_mode: nextApi.ai_mode,
      ai_provider_priority: nextApi.ai_provider_priority,
      demoMode: nextApi.demoMode
    }
  });
}
