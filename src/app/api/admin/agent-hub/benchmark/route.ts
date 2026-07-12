import { NextResponse } from "next/server";
import { runRealAgentProvider } from "@/lib/agent-providers";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import type { AgentProviderKey, AgentTaskType } from "@/lib/agent-hub";

const allowedProviders = new Set<AgentProviderKey>(["openai", "gemini", "anthropic", "groq", "openrouter", "demo"]);
const allowedTasks = new Set<AgentTaskType>(["ad_analysis", "crm_summary", "content_generation", "seo_analysis", "competitor_research", "market_research", "pricing_research", "sector_discovery", "deep_report", "proposal_generation", "customer_report", "code_review", "fast_answer", "workflow_task", "long_web_research"]);

export async function GET() {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const benchmarks = hasSupabaseConfig()
    ? await supabaseRest<unknown[]>("agent_benchmarks?select=*&order=created_at.desc&limit=50").catch(() => [])
    : [];
  return NextResponse.json({ benchmarks });
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const requestedTask = String(body.taskType || "fast_answer") as AgentTaskType;
  const taskType: AgentTaskType = allowedTasks.has(requestedTask) ? requestedTask : "fast_answer";
  const prompt = String(body.prompt || "").trim();
  const rawProviders: unknown[] = Array.isArray(body.providers) ? body.providers : ["openai", "gemini", "anthropic", "groq"];
  const providers: AgentProviderKey[] = rawProviders.map(String).filter((item: string): item is AgentProviderKey => allowedProviders.has(item as AgentProviderKey));
  if (!prompt) return NextResponse.json({ error: "Benchmark promptu boş olamaz." }, { status: 400 });

  const results = await Promise.all(providers.map(async (provider) => {
    const started = Date.now();
    const result = await runRealAgentProvider({ provider, taskType, prompt, systemPrompt: "Türkçe, kısa ve karşılaştırılabilir bir benchmark yanıtı üret." });
    return {
      provider,
      responseMs: Date.now() - started,
      estimatedCost: Number(result.tokensUsed || 0) * 0.00001,
      confidence: result.usedFallback ? 0.55 : 0.78,
      strongSide: result.usedFallback ? "Demo fallback ile tutarlı cevap üretti." : "Gerçek sağlayıcı yanıtı alındı.",
      weakSide: result.errorMessage || (result.usedFallback ? "API anahtarı veya sağlayıcı erişimi yok." : "Derin kıyas için insan kontrolü önerilir."),
      summary: result.text.slice(0, 900)
    };
  }));

  const winner = [...results].sort((a, b) => b.confidence - a.confidence || a.responseMs - b.responseMs)[0]?.provider || "demo";
  const hkDecision = `${winner} bu benchmark için en dengeli sonuç verdi. Nihai karar HK Intelligence bağlam kontrolünden sonra kullanılmalıdır.`;
  let benchmark: unknown = { task_type: taskType, prompt, providers, results, winner_provider: winner, hk_decision: hkDecision };
  if (hasSupabaseConfig()) {
    const rows = await supabaseRest("agent_benchmarks", { method: "POST", body: JSON.stringify(benchmark) }).catch(() => []);
    benchmark = Array.isArray(rows) ? rows[0] || benchmark : benchmark;
  }

  return NextResponse.json({ ok: true, benchmark });
}
