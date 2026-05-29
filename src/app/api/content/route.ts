import { NextResponse } from "next/server";
import { getSiteContent, saveSiteContent } from "@/lib/content";
import { isAdminAuthenticated } from "@/lib/auth";
import type { SiteContent } from "@/lib/types";

export async function GET() {
  const content = await getSiteContent();
  if (await isAdminAuthenticated()) {
    return NextResponse.json(content);
  }
  return NextResponse.json({
    ...content,
    settings: {
      ...content.settings,
      api: { ...content.settings.api, geminiApiKey: "", groqApiKey: "", openAiApiKey: "" }
    }
  });
}

export async function PUT(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const content = (await request.json()) as SiteContent;
  try {
    await saveSiteContent(content);
    return NextResponse.json({ ok: true, content });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kaydedilemedi. Supabase bağlantısını ve ortam değişkenlerini kontrol edin." },
      { status: 500 }
    );
  }
}
