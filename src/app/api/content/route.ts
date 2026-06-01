import { NextResponse } from "next/server";
import { getSiteContent, saveSiteContent } from "@/lib/content";
import { isAdminAuthenticated } from "@/lib/auth";
import type { SiteContent } from "@/lib/types";

function withoutApiKeys(content: SiteContent) {
  return {
    ...content,
    settings: {
      ...content.settings,
      api: { ...content.settings.api, geminiApiKey: "", groqApiKey: "", openAiApiKey: "" }
    }
  };
}

export async function GET() {
  const content = await getSiteContent();
  return NextResponse.json(withoutApiKeys(content));
}

export async function PUT(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const content = (await request.json()) as SiteContent;
  try {
    const current = await getSiteContent();
    const next = {
      ...content,
      settings: {
        ...content.settings,
        api: {
          ...content.settings.api,
          geminiApiKey: content.settings.api.geminiApiKey || current.settings.api.geminiApiKey,
          groqApiKey: content.settings.api.groqApiKey || current.settings.api.groqApiKey,
          openAiApiKey: content.settings.api.openAiApiKey || current.settings.api.openAiApiKey
        }
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
