import { NextResponse } from "next/server";
import { scoreProviderForTask, type AgentProviderKey, type AgentTaskType } from "@/lib/agent-hub";
import { runRealAgentProvider } from "@/lib/agent-providers";
import { unifiedAiProviderOptions, normalizeUnifiedAiProvider } from "@/lib/ai-provider-options";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

type RunRow = {
  requested_provider?: string | null;
  actual_provider?: string | null;
  selected_provider?: string | null;
  status?: string | null;
  response_ms?: number | null;
  estimated_cost?: number | null;
  provider_error?: string | null;
  error_message?: string | null;
  created_at?: string | null;
};

async function requireAiProviderAccess() {
  return await requireModuleAccess("agent-hub")
    || await requireModuleAccess("ai-studio")
    || await requireModuleAccess("google-analiz")
    || await requireModuleAccess("meta-analiz")
    || await requireModuleAccess("sosyal-medya-denetimi")
    || await requireModuleAccess("raporlar");
}

function envFor(key: string) {
  const option = unifiedAiProviderOptions.find((item) => item.key === key);
  return option?.env || [];
}

function missingEnv(key: string) {
  return envFor(key).filter((envKey) => !process.env[envKey]);
}

function statusFor(key: string) {
  if (key === "auto") return "Çalışıyor";
  if (key === "demo") return "Demo";
  const missing = missingEnv(key);
  if (key === "manus" && missing.includes("MANUS_API_ENDPOINT")) return "Eksik endpoint";
  return missing.length ? "Eksik" : "Çalışıyor";
}

async function recentRuns() {
  if (!hasSupabaseConfig()) return [] as RunRow[];
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return supabaseRest<RunRow[]>(`agent_runs?created_at=gte.${encodeURIComponent(since)}&select=requested_provider,actual_provider,selected_provider,status,response_ms,estimated_cost,provider_error,error_message,created_at&order=created_at.desc&limit=500`).catch(() => []);
}

function providerRunKey(run: RunRow) {
  const raw = run.actual_provider || run.selected_provider || run.requested_provider || "demo";
  const normalized = normalizeUnifiedAiProvider(raw);
  return normalized === "auto" ? "demo" : normalized;
}

function buildHealth(rows: RunRow[]) {
  return unifiedAiProviderOptions.map((option) => {
    const key = option.key;
    const providerRows = rows.filter((run) => providerRunKey(run) === key);
    const failures = providerRows.filter((run) => String(run.status || "").includes("failed") || run.provider_error || run.error_message);
    const success = providerRows.length - failures.length;
    const avgResponse = providerRows.length ? Math.round(providerRows.reduce((sum, run) => sum + Number(run.response_ms || 0), 0) / providerRows.length) : null;
    const avgCost = providerRows.length ? Number((providerRows.reduce((sum, run) => sum + Number(run.estimated_cost || 0), 0) / providerRows.length).toFixed(4)) : 0;
    const score = key === "auto" ? null : scoreProviderForTask({
      provider_key: key as AgentProviderKey,
      provider_name: option.label,
      status: missingEnv(key).length && key !== "demo" ? "not_configured" : "active",
      configured: !missingEnv(key).length || key === "demo",
      secret_mask: missingEnv(key).length ? null : "Tanımlı"
    }, "ad_analysis", {
      averageResponseMs: avgResponse || undefined,
      successRate: providerRows.length ? success / providerRows.length : undefined
    });
    return {
      key,
      name: option.label,
      status: statusFor(key),
      missingEnv: missingEnv(key),
      lastTestAt: providerRows[0]?.created_at || null,
      lastSuccessAt: providerRows.find((run) => !String(run.status || "").includes("failed") && !run.provider_error && !run.error_message)?.created_at || null,
      responseMs: avgResponse,
      lastError: failures[0]?.provider_error || failures[0]?.error_message || null,
      errorCount24h: failures.length,
      successRate24h: providerRows.length ? Math.round((success / providerRows.length) * 100) : null,
      averageCost: avgCost,
      averageResponseMs: avgResponse,
      score
    };
  });
}

export async function GET() {
  const session = await requireAiProviderAccess();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const rows = await recentRuns();
  return NextResponse.json({ providers: buildHealth(rows) });
}

export async function POST(request: Request) {
  const session = await requireAiProviderAccess();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const selected = normalizeUnifiedAiProvider(body.provider || body.providerKey || "demo");
  if (selected === "auto") return NextResponse.json({ error: "Sağlık testi için belirli bir sağlayıcı seçin." }, { status: 400 });
  if (missingEnv(selected).length && selected !== "demo") {
    return NextResponse.json({
      status: "Eksik",
      provider: selected,
      missingEnv: missingEnv(selected),
      message: "Sağlayıcı testi çalıştırılamadı. Gerekli environment değişkenleri eksik."
    }, { status: 200 });
  }
  const startedAt = Date.now();
  const result = await runRealAgentProvider({
    provider: selected as AgentProviderKey,
    taskType: "fast_answer" as AgentTaskType,
    prompt: "Kısa sağlık kontrolü yanıtı üret.",
    systemPrompt: "Türkçe, tek cümlelik sağlayıcı sağlık kontrolü yanıtı ver.",
    timeoutMs: 12000
  });
  return NextResponse.json({
    status: result.usedFallback ? "Hatalı" : "Çalışıyor",
    provider: result.provider,
    requestedProvider: selected,
    model: result.model,
    responseMs: result.responseMs || Date.now() - startedAt,
    usedFallback: result.usedFallback,
    message: result.usedFallback ? `Sağlayıcı çalıştırılamadı: ${result.errorMessage || "Bilinmeyen hata"}` : "Sağlayıcı başarıyla yanıt verdi."
  });
}
