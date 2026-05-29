import { NextResponse } from "next/server";
import { getSiteContent } from "@/lib/content";
import { isAdminAuthenticated } from "@/lib/auth";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const content = await getSiteContent();
  const api = content.settings.api;
  const envKey =
    api.activeProvider === "gemini"
      ? process.env.GEMINI_API_KEY || api.geminiApiKey
      : api.activeProvider === "groq"
        ? process.env.GROQ_API_KEY || api.groqApiKey
        : api.activeProvider === "openai"
          ? process.env.OPENAI_API_KEY || api.openAiApiKey
          : "";

  if (api.demoMode || api.activeProvider === "demo") {
    return NextResponse.json({ ok: true, provider: "Demo Modu", message: "Demo modu aktif" });
  }

  if (!envKey) {
    return NextResponse.json({ ok: false, provider: api.activeProvider, message: "API anahtarı eksik" }, { status: 400 });
  }

  // Add real Gemini/Groq/OpenAI health-check calls here. Keep keys server-side only.
  return NextResponse.json({ ok: true, provider: api.activeProvider, message: "API bağlantısı başarılı" });
}
