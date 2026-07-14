import { NextResponse } from "next/server";
import { getSession, isCustomerRole, isStaffRole } from "@/lib/auth";
import { getCustomerAiSettings } from "@/lib/customer-ai-settings";
import { normalizeUnifiedAiProvider } from "@/lib/ai-provider-options";
import { executeAiTask, type IntelligenceProviderKey, type IntelligenceTaskType } from "@/lib/server/ai-router";

const actionContextMap: Record<string, string> = {
  "Raporumu yorumla": "reports",
  "Reklam önerisi üret": "ads",
  "Görevleri özetle": "tasks",
  "İçerik fikri ver": "general",
  "Ajans operasyonunu özetle": "general"
};

function demoAnswer(role: "admin" | "customer", prompt: string, allowedContexts: string[]) {
  const scope = role === "admin"
    ? "Admin modunda ajans operasyonu, müşteri, reklam ve görev sinyallerini birlikte yorumlarım."
    : "Müşteri modunda yalnız size açık rapor, reklam, görev ve genel öneri kapsamındaki bilgileri kullanırım.";
  const contexts = allowedContexts.length ? allowedContexts.join(", ") : "general";
  return `${scope}\n\nİstek: ${prompt || "Genel özet"}\nKullanılan izinli kapsam: ${contexts}\n\nÖnerilen aksiyonlar:\n1. Eksik entegrasyon ve güncel rapor durumunu kontrol edin.\n2. Açık görevleri tamamlanma sırasına göre netleştirin.\n3. Reklam veya içerik aksiyonunu tek bir sonraki adıma bağlayın.\n\nGerçek yapay zekâ modu kapalıysa bu güvenli demo yanıtı gösterilir.`;
}

function taskForContext(context: string, prompt: string): IntelligenceTaskType | undefined {
  if (context === "reports") return "report_interpretation";
  if (context === "ads") return "campaign_analysis";
  if (context === "tasks") return "quick_summary";
  if (context === "general" && /içerik|instagram|sosyal medya/i.test(prompt)) return "social_content";
  return undefined;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum doğrulanamadı." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const prompt = String(body.prompt || body.message || body.question || "").trim();
  const requestedContext = String(body.contextKey || actionContextMap[prompt] || "general");
  const role = isStaffRole(session.role) ? "admin" : "customer";

  if (role === "customer") {
    if (!isCustomerRole(session.role) || !session.companyId) return NextResponse.json({ error: "Müşteri oturumu gerekir." }, { status: 403 });
    const settings = await getCustomerAiSettings(session.companyId);
    if (!settings.assistant_enabled) return NextResponse.json({ error: "HK Asistan bu müşteri için pasif." }, { status: 403 });
    if (!settings.allowed_contexts.includes("general") && !settings.allowed_contexts.includes(requestedContext)) {
      return NextResponse.json({ error: "Bu konu için HK Asistan erişimi kapalı." }, { status: 403 });
    }
    if (!settings.real_ai_enabled || settings.provider === "demo") {
      return NextResponse.json({ mode: "demo", answer: demoAnswer("customer", prompt, settings.allowed_contexts), settings: { provider: settings.provider, real_ai_enabled: false } });
    }
    const requested = normalizeUnifiedAiProvider(settings.provider || "auto") as IntelligenceProviderKey | "auto";
    const result = await executeAiTask({
      taskType: taskForContext(requestedContext, prompt),
      module: "HK Asistan",
      endpoint: "/api/assistant/chat",
      prompt,
      expectedOutput: requestedContext,
      fallbackText: demoAnswer("customer", prompt, settings.allowed_contexts),
      customerId: session.companyId,
      createdBy: session.profileId || session.authUserId || null
    }, { requestedProvider: requested, cacheTtlMs: 60_000 });
    return NextResponse.json({ mode: result.provider === "demo" ? "fallback" : "live", answer: result.text, ai: result, settings: { provider: settings.provider, real_ai_enabled: true } });
  }

  const provider = normalizeUnifiedAiProvider(body.provider || "auto") as IntelligenceProviderKey | "auto";
  const result = await executeAiTask({
    taskType: taskForContext(requestedContext, prompt),
    module: "HK Asistan Admin",
    endpoint: "/api/assistant/chat",
    prompt,
    expectedOutput: requestedContext,
    fallbackText: demoAnswer("admin", prompt, ["general", "reports", "ads", "tasks", "payments", "files"]),
    createdBy: session.profileId || session.authUserId || null
  }, { requestedProvider: provider, cacheTtlMs: 60_000 });
  return NextResponse.json({ mode: result.provider === "demo" ? "fallback" : "live", answer: result.text, ai: result });
}
