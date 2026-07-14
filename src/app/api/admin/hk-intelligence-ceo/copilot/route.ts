import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { executeAiTask } from "@/lib/server/ai-router";

function asList(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function labelOf(item: unknown) {
  if (!item || typeof item !== "object") return "";
  const record = item as Record<string, unknown>;
  return String(record.title || record.module || record.action || "").trim();
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("hk-intelligence-ceo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const question = String(body.question || "").trim();
  if (!question) return NextResponse.json({ error: "Soru boş olamaz." }, { status: 400 });

  const context = body.context || {};
  const summary = String(context.summary || "Sistem özeti henüz sınırlı veriyle hazırlanıyor.");
  const risks = asList(context.risks).slice(0, 3).map(labelOf).filter(Boolean);
  const recommendations = asList(context.recommendations).slice(0, 3).map(labelOf).filter(Boolean);

  const answer = [
    "HK Intelligence Final Layer yanıtı:",
    summary,
    risks.length ? `Öncelikli riskler: ${risks.join("; ")}.` : "Öncelikli kritik risk görünmüyor.",
    recommendations.length ? `Önerilen aksiyonlar: ${recommendations.join("; ")}.` : "Öneri üretmek için daha fazla operasyon verisi gerekir.",
    "7 günlük plan: bugün kritik riskleri kapat, 48 saat içinde tahsilat ve takipleri tamamla, hafta sonunda rapor ve öğrenme kayıtlarını güncelle.",
    "Not: Bu cevap karar destek amaçlıdır; satış veya performans garantisi içermez."
  ].join("\n");

  const result = await executeAiTask({
    taskType: "strategy",
    module: "HK Intelligence CEO Copilot",
    endpoint: "/api/admin/hk-intelligence-ceo/copilot",
    prompt: `Yönetici sorusu: ${question}\nSistem özeti: ${summary}\nRiskler: ${risks.join("; ") || "Kritik risk yok"}\nÖneriler: ${recommendations.join("; ") || "Henüz öneri yok"}`,
    expectedOutput: "Yönetici özeti, öncelikli karar ve 7 günlük plan",
    fallbackText: answer,
    createdBy: session.profileId || session.authUserId || null
  }, { cacheTtlMs: 2 * 60_000 });

  return NextResponse.json({
    question,
    answer: result.text,
    ai: result,
    finalLayer: "HK Intelligence",
    confidenceScore: recommendations.length || risks.length ? 78 : 54,
    generatedAt: new Date().toISOString()
  });
}
