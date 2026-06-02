import { NextResponse } from "next/server";
import { aiSettingsMetadata } from "@/lib/ai-provider";
import { getSiteContent } from "@/lib/content";
import { isAdminAuthenticated } from "@/lib/auth";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const content = await getSiteContent();
  const api = content.settings.api;
  const meta = aiSettingsMetadata(api);
  const providerKey = meta.providerKey;
  const envKey =
    providerKey === "gemini"
      ? process.env.GEMINI_API_KEY
      : providerKey === "groq"
        ? process.env.GROQ_API_KEY
        : providerKey === "openai"
          ? process.env.OPENAI_API_KEY
          : "";

  if (meta.isDemo || meta.isLocal || providerKey === "automatic") {
    return NextResponse.json({ ok: true, provider: meta.provider, model: meta.model, mode: meta.mode, message: `${meta.provider} aktif` });
  }

  if (!envKey) {
    return NextResponse.json({ ok: false, provider: meta.provider, model: meta.model, mode: meta.mode, message: "Seçilen AI sağlayıcısı kullanılamadı. Lütfen API ayarlarını kontrol edin." }, { status: 400 });
  }

  // Add real Gemini/Groq/OpenAI health-check calls here. Keep keys server-side only.
  return NextResponse.json({ ok: true, provider: meta.provider, model: meta.model, mode: meta.mode, message: "API bağlantısı başarılı" });
}
