import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { executeAiTask } from "@/lib/server/ai-router";

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    return await supabaseRest<T>(path);
  } catch {
    return fallback;
  }
}

export async function POST() {
  const session = await requireModuleAccess("operational-quality");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [failures, qaFindings, testRuns] = await Promise.all([
    safeFetch<Array<{ action_type: string; title: string | null; summary: string | null; created_at: string }>>(
      `action_result_logs?status=neq.success&created_at=gte.${since}&select=action_type,title,summary,created_at&order=created_at.desc&limit=30`,
      []
    ),
    safeFetch<Array<{ title: string; module: string | null; severity: string }>>(`qa_audit_findings?status=eq.Açık&select=title,module,severity&order=severity.desc&limit=15`, []),
    safeFetch<Array<{ status: string; error_count: number; created_at: string }>>(
      `system_test_runs?created_at=gte.${since}&select=status,error_count,created_at&order=created_at.desc&limit=5`,
      []
    )
  ]);

  if (!failures.length && !qaFindings.length && !testRuns.some((run) => run.error_count > 0)) {
    return NextResponse.json({
      summary: "Son 24 saatte kritik hata veya açık bulgu tespit edilmedi.",
      severity: "none",
      generatedAt: new Date().toISOString(),
      aiCalled: false
    });
  }

  const promptSummary = [
    `Son 24 saatte başarısız işlem: ${failures.length} (${failures.slice(0, 5).map((row) => row.action_type).join(", ") || "yok"}).`,
    `Açık QA bulgusu: ${qaFindings.length} (${qaFindings.slice(0, 5).map((row) => row.title).join("; ") || "yok"}).`,
    `Son sistem test çalışmaları hata sayısı: ${testRuns.reduce((sum, run) => sum + (run.error_count || 0), 0)}.`
  ].join("\n");

  const ai = await executeAiTask({
    taskType: "qa_analysis",
    module: "Operasyonel Kalite Merkezi",
    endpoint: "/api/admin/operational-quality/ai-summary",
    prompt: `Aşağıdaki son 24 saatlik sistem kalite verisinden kısa bir özet çıkar. Severity (düşük/orta/yüksek/kritik), muhtemel kök neden, etkilenen modül ve önerilen ilk aksiyonu belirt. Max 100 kelime.\n\n${promptSummary}`,
    expectedOutput: "severity, kök neden, etkilenen modül, önerilen aksiyon içeren kısa özet",
    fallbackText: `Son 24 saatte ${failures.length} başarısız işlem ve ${qaFindings.length} açık QA bulgusu var. Önce en yüksek önemli bulguları inceleyin.`,
    createdBy: null
  }, { cacheTtlMs: 10 * 60_000 });

  return NextResponse.json({
    summary: ai.text,
    severity: failures.length > 5 || qaFindings.some((row) => row.severity === "critical") ? "high" : "medium",
    generatedAt: new Date().toISOString(),
    aiCalled: true,
    provider: ai.provider
  });
}
