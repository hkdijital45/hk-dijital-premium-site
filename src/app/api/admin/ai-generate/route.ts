import { NextResponse } from "next/server";
import { generateAiText } from "@/lib/ai-provider";
import { requireModuleAccess } from "@/lib/permissions";

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
    const generated = await generateAiText(prompt, localFallback(prompt));
    return NextResponse.json({ ok: true, output: generated.text, ai: generated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Analiz sırasında bir hata oluştu." }, { status: 503 });
  }
}
