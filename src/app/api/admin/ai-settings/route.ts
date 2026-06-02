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
  const nextApi = {
    ...api,
    activeProvider: body.activeProvider || api.activeProvider,
    active_ai_provider: body.active_ai_provider || body.activeProvider || api.active_ai_provider || api.activeProvider,
    model: body.model || api.model,
    active_ai_model: body.active_ai_model || body.model || api.active_ai_model || api.model,
    ai_mode: body.ai_mode || api.ai_mode || "live",
    demoMode: Boolean(body.demoMode)
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
      demoMode: nextApi.demoMode
    }
  });
}
