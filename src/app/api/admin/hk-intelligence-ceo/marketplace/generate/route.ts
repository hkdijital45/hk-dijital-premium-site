import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";

function list(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function buildPackage(body: Record<string, unknown>) {
  const sector = String(body.sector || "Sektör").trim();
  const serviceTypes = list(body.serviceTypes || body.service_types || "Google Ads, Meta Ads, SEO, Landing Page");
  const channels = list(body.channels || "Meta, Google Ads, SEO, WhatsApp");
  const targetCustomer = String(body.targetCustomer || body.target_customer || "Yerel hizmet işletmesi");
  const mainGoal = String(body.mainGoal || body.main_goal || "lead");
  const monthlyBudgetRange = String(body.monthlyBudgetRange || body.monthly_budget_range || "30.000 - 100.000 TL");
  const prompt = `${sector} sektöründe ${targetCustomer} için ${channels.join(", ")} kanallarını kullanarak ${mainGoal} hedefli 30 günlük büyüme planı üret. Satış garantisi verme. Riskleri, fırsatları, KPI listesini, teklif dilini ve müşteri takip adımlarını Türkçe ve uygulanabilir yaz.`;
  const workflow = [
    "Müşteri hedefi ve mevcut dijital varlıkları doğrula",
    "Rakip, Google arama ve Meta kreatif fırsatlarını analiz et",
    `${serviceTypes.join(" + ")} hizmet paketini hedefe göre konumlandır`,
    "İlk kampanya, landing page ve WhatsApp takip akışını hazırla",
    "7 günlük aksiyon planı ve aylık rapor şablonu üret"
  ];
  return {
    package_name: `${sector} Growth OS Paketi`,
    packageName: `${sector} Growth OS Paketi`,
    sector,
    target_customer: targetCustomer,
    targetCustomer,
    service_types: serviceTypes,
    serviceTypes,
    channels,
    monthly_budget_range: monthlyBudgetRange,
    monthlyBudgetRange,
    main_goal: mainGoal,
    mainGoal,
    generated_prompt: prompt,
    generatedPrompt: prompt,
    workflow_steps: workflow,
    workflowSteps: workflow,
    ai_team: ["CEO", "Satış Müdürü", "Google Ads Uzmanı", "Meta Ads Uzmanı", "SEO Uzmanı", "Creative Director", "Reporting Manager"],
    aiTeam: ["CEO", "Satış Müdürü", "Google Ads Uzmanı", "Meta Ads Uzmanı", "SEO Uzmanı", "Creative Director", "Reporting Manager"],
    kpi_template: ["Lead sayısı", "Randevu oranı", "CPL", "ROAS", "WhatsApp dönüşümü", "İlk yanıt süresi", "Rapor görünürlüğü"],
    kpiTemplate: ["Lead sayısı", "Randevu oranı", "CPL", "ROAS", "WhatsApp dönüşümü", "İlk yanıt süresi", "Rapor görünürlüğü"],
    operation_plan: ["1. hafta: ölçümleme ve teklif", "2. hafta: kampanya/kreatif yayını", "3. hafta: optimizasyon", "4. hafta: rapor ve yenileme planı"],
    operationPlan: ["1. hafta: ölçümleme ve teklif", "2. hafta: kampanya/kreatif yayını", "3. hafta: optimizasyon", "4. hafta: rapor ve yenileme planı"],
    report_template: ["Yönetici özeti", "Kanal performansı", "Riskler", "Fırsatlar", "7 günlük plan"],
    reportTemplate: ["Yönetici özeti", "Kanal performansı", "Riskler", "Fırsatlar", "7 günlük plan"],
    proposal_draft: `${sector} için ${monthlyBudgetRange} medya bütçesi aralığında ${serviceTypes.join(" + ")} paketiyle başlanması önerilir. İlk ay hedefi ölçümleme, hızlı öğrenme ve düzenli raporlama disiplinidir.`,
    proposalDraft: `${sector} için ${monthlyBudgetRange} medya bütçesi aralığında ${serviceTypes.join(" + ")} paketiyle başlanması önerilir. İlk ay hedefi ölçümleme, hızlı öğrenme ve düzenli raporlama disiplinidir.`,
    status: "draft",
    mode: process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY ? "real-ai-ready" : "demo-local-fallback"
  };
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("hk-intelligence-ceo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  return NextResponse.json({ ok: true, package: buildPackage(body), message: "Marketplace paketi üretildi." });
}
