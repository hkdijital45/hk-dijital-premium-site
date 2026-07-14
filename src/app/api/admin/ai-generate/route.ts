import { NextResponse } from "next/server";
import { normalizeUnifiedAiProvider } from "@/lib/ai-provider-options";
import { requireModuleAccess } from "@/lib/permissions";
import { executeAiTask, type IntelligenceProviderKey } from "@/lib/server/ai-router";

function localFallback(prompt: string) {
  return [
    "HK Dijital yerel üretim taslağı:",
    prompt,
    "Öneri: Mesajı kısa, ölçülebilir ve beklenti yönetimi net olacak şekilde düzenleyin. Satış garantisi vermeden hedef, süreç ve takip adımlarını açıklayın."
  ].join("\n\n");
}

export async function POST(request: Request) {
  if (!(await requireModuleAccess("ai-studio"))) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const prompt = String(body.prompt || "").trim();
  if (!prompt) return NextResponse.json({ error: "Komut girin." }, { status: 400 });

  try {
    const requested = normalizeUnifiedAiProvider(body.aiProvider || "auto");
    const generated = await executeAiTask({
      taskType: body.taskType,
      module: body.module || "Yapay Zekâ Stüdyosu",
      endpoint: "/api/admin/ai-generate",
      prompt,
      expectedOutput: body.expectedOutput,
      fallbackText: localFallback(prompt),
      createdBy: undefined
    }, {
      requestedProvider: requested as IntelligenceProviderKey | "auto",
      cacheTtlMs: 2 * 60_000
    });
    return NextResponse.json({ ok: true, output: generated.text, ai: generated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Analiz sırasında bir hata oluştu." }, { status: 503 });
  }
}
