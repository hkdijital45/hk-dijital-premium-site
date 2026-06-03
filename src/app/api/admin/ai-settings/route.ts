import { NextResponse } from "next/server";
import { getSiteContent, saveSiteContent } from "@/lib/content";
import { requireModuleAccess } from "@/lib/permissions";

export async function POST(request: Request) {
  if (!(await requireModuleAccess("api-ayarlari"))) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const content = await getSiteContent();
  const api = content.settings.api;
  const activeProvider = body.active_ai_provider || body.activeProvider || api.active_ai_provider || api.activeProvider || "gemini";
  const providerPriority = Array.isArray(body.ai_provider_priority)
    ? body.ai_provider_priority
    : Array.isArray(api.ai_provider_priority)
      ? api.ai_provider_priority
      : ["gemini", "openai", "groq", "demo", "local"];
  const nextApi = {
    ...api,
    activeProvider,
    active_ai_provider: activeProvider,
    model: body.model || api.model || (String(activeProvider).toLocaleLowerCase("tr") === "gemini" ? "gemini-2.0-flash" : "automatic-fallback"),
    active_ai_model: body.active_ai_model || body.model || api.active_ai_model || api.model || (String(activeProvider).toLocaleLowerCase("tr") === "gemini" ? "gemini-2.0-flash" : "automatic-fallback"),
    ai_mode: body.ai_mode || (activeProvider === "Yerel Mod" || activeProvider === "local" ? "local" : activeProvider === "Demo Modu" || activeProvider === "demo" ? "demo" : "live"),
    ai_provider_priority: providerPriority,
    demoMode: activeProvider === "Demo Modu" || activeProvider === "demo"
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
