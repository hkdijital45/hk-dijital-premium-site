import { NextResponse } from "next/server";
import { getSiteContent, saveSiteContent } from "@/lib/content";
import { requireModuleAccess } from "@/lib/permissions";
import type { SiteContent } from "@/lib/types";

const sensitiveApiKeys = [
  "geminiApiKey",
  "groqApiKey",
  "openAiApiKey",
  "meta_app_secret",
  "meta_access_token",
  "google_maps_key",
  "google_ads_key",
  "smtp_password",
  "webhook_secret"
];

function withoutApiKeys(content: SiteContent) {
  const api = { ...(content.settings.api as Record<string, unknown>) };
  sensitiveApiKeys.forEach((key) => {
    if (key in api) api[key] = "";
  });
  return {
    ...content,
    settings: {
      ...content.settings,
      api
    }
  };
}

export async function GET() {
  const content = await getSiteContent();
  return NextResponse.json(withoutApiKeys(content));
}

export async function PUT(request: Request) {
  if (!(await requireModuleAccess("site-ayarlari"))) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const content = (await request.json()) as SiteContent;
  try {
    const current = await getSiteContent();
    const nextApi = { ...(content.settings.api as Record<string, unknown>) };
    sensitiveApiKeys.forEach((key) => {
      if (!nextApi[key] || nextApi[key] === "••••••••") {
        nextApi[key] = (current.settings.api as Record<string, unknown>)[key] || "";
      }
    });
    const next = {
      ...content,
      settings: {
        ...content.settings,
        api: nextApi
      }
    };
    await saveSiteContent(next);
    return NextResponse.json({ ok: true, content: withoutApiKeys(next) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kaydedilemedi. Supabase bağlantısını ve ortam değişkenlerini kontrol edin." },
      { status: 500 }
    );
  }
}
