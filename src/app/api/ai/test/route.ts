import { NextResponse } from "next/server";
import { normalizeUnifiedAiProvider } from "@/lib/ai-provider-options";
import { getSiteContent } from "@/lib/content";
import { isAdminAuthenticated } from "@/lib/auth";
import { executeAiTask, type IntelligenceProviderKey } from "@/lib/server/ai-router";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const content = await getSiteContent();
  const api = content.settings.api;
  const selected = normalizeUnifiedAiProvider(api.active_ai_provider || api.activeProvider || "auto");
  const result = await executeAiTask({
    taskType: "quick_summary",
    module: "AI Ayarları",
    endpoint: "/api/ai/test",
    prompt: "HK Intelligence Router sağlık kontrolü için tek cümlelik Türkçe yanıt üret.",
    fallbackText: "HK Intelligence Router hazır; canlı sağlayıcı bağlantısı bekleniyor."
  }, {
    requestedProvider: selected as IntelligenceProviderKey | "auto",
    timeoutMs: 12_000,
    cacheTtlMs: 0,
    recordExecution: false
  });
  return NextResponse.json({
    ok: result.provider !== "demo",
    provider: result.providerLabel,
    model: result.model,
    mode: result.mode,
    fallbackUsed: result.fallbackUsed,
    message: result.provider === "demo" ? result.notice : `${result.providerLabel} bağlantısı başarıyla doğrulandı.`
  }, { status: result.provider === "demo" && selected !== "demo" ? 200 : 200 });
}
