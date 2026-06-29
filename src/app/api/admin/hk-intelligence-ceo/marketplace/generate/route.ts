import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";

function list(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function buildPackage(body: Record<string, unknown>) {
  const sector = String(body.sector || "Sektör").trim();
  const niche = String(body.niche || body.subSector || "").trim();
  const region = String(body.region || body.city || "").trim();
  const serviceTypes = list(body.serviceTypes || body.service_types || "Google Ads, Meta Ads, SEO, Landing Page");
  const channels = list(body.channels || "Meta, Google Ads, SEO, WhatsApp");
  const targetCustomer = String(body.targetCustomer || body.target_customer || "Yerel hizmet işletmesi");
  const mainGoal = String(body.mainGoal || body.main_goal || "lead");
  const monthlyBudgetRange = String(body.monthlyBudgetRange || body.monthly_budget_range || "30.000 - 100.000 TL");
  const serviceFeeRange = String(body.serviceFeeRange || body.service_fee_range || "15.000 - 45.000 TL");
  const customerProblem = String(body.customerProblem || body.customer_problem || "Dijital ölçümleme, lead kalitesi ve düzenli raporlama eksikliği");
  const competitionLevel = String(body.competitionLevel || body.competition_level || "Orta");
  const salesProcess = String(body.salesProcess || body.sales_process || "Keşif görüşmesi, teklif, takip, rapor disiplini");
  const offerTone = String(body.offerTone || body.offer_tone || "sade");
  const packageLevel = String(body.packageLevel || body.package_level || "profesyonel");
  const packageDuration = String(body.packageDuration || body.package_duration || "30 gün");
  const sectorLabel = niche ? `${sector} - ${niche}` : sector;
  const prompt = `${sectorLabel} sektöründe ${targetCustomer} için ${channels.join(", ")} kanallarını kullanarak ${mainGoal} hedefli ${packageDuration} büyüme planı üret. Bölge: ${region || "genel"}. Rekabet: ${competitionLevel}. Müşteri problemi: ${customerProblem}. Satış garantisi verme. Riskleri, fırsatları, KPI listesini, teklif dilini ve müşteri takip adımlarını Türkçe ve uygulanabilir yaz.`;
  const workflow = [
    "Müşteri hedefi ve mevcut dijital varlıkları doğrula",
    "Rakip, Google arama ve Meta kreatif fırsatlarını analiz et",
    `${serviceTypes.join(" + ")} hizmet paketini hedefe göre konumlandır`,
    "İlk kampanya, landing page ve WhatsApp takip akışını hazırla",
    "7 günlük aksiyon planı ve aylık rapor şablonu üret"
  ];
  const socialMediaPlan = [
    "Haftalık 3 post: güven kanıtı, hizmet anlatımı ve kampanya çağrısı",
    "Haftalık 2 Reels: süreç, sonuç ve müşteri sorusu formatı",
    "Günlük Story: randevu/iletişim çağrısı ve sosyal kanıt",
    "Ayda 1 müşteri başarı hikayesi veya vaka özeti"
  ];
  const contentCalendar = [
    "Pazartesi: problem farkındalığı içeriği",
    "Çarşamba: hizmet/fayda anlatımı",
    "Cuma: kampanya ve WhatsApp çağrısı",
    "Pazar: haftalık özet ve güven içeriği"
  ];
  const creativeIdeas = [
    `${sectorLabel} için önce/sonra veya süreç odaklı kısa video`,
    "Google arama niyetine uygun landing page banner başlığı",
    "WhatsApp mesajına yönlendiren sosyal kanıt kreatifi",
    "Bölgesel güven ve hızlı dönüş vurgulu reklam görseli"
  ];
  const approvalWorkflow = ["İç brief hazırlandı", "Kreatif taslak üretildi", "İç onay", "Müşteri onayı", "Revize istendi", "Yayına hazır", "Yayınlandı"];
  const campaignOperations = ["Kampanya kurulumu", "Pixel/Dataset kontrolü", "GA4 kontrolü", "Reklam bütçesi", "Hedef kitle", "Kreatif", "İlk 72 saat kontrolü", "7 günlük optimizasyon"];
  const clientCommunicationPlan = ["İlk arama", "Teklif gönderildi", "Sözleşme", "Kurulum bilgilendirmesi", "Haftalık rapor", "Aylık değerlendirme", "Yenileme görüşmesi"];
  const reportApprovalFlow = ["Rapor oluşturuldu", "İç kontrol", "Müşteriye hazır", "Gönderildi", "Müşteri görüntüledi"];
  const ninetyDayPlan = ["1. ay: Ölçümleme, kurulum ve ilk öğrenme", "2. ay: Kreatif, hedef kitle ve teklif optimizasyonu", "3. ay: Bütçe ölçekleme, rapor standardı ve yenileme planı"];
  return {
    package_name: `${sectorLabel} Growth OS Paketi`,
    packageName: `${sectorLabel} Growth OS Paketi`,
    sector,
    niche,
    region,
    target_customer: targetCustomer,
    targetCustomer,
    service_types: serviceTypes,
    serviceTypes,
    channels,
    monthly_budget_range: monthlyBudgetRange,
    monthlyBudgetRange,
    service_fee_range: serviceFeeRange,
    serviceFeeRange,
    customer_problem: customerProblem,
    customerProblem,
    competition_level: competitionLevel,
    competitionLevel,
    sales_process: salesProcess,
    salesProcess,
    offer_tone: offerTone,
    offerTone,
    package_level: packageLevel,
    packageLevel,
    package_duration: packageDuration,
    packageDuration,
    main_goal: mainGoal,
    mainGoal,
    generated_prompt: prompt,
    generatedPrompt: prompt,
    workflow_steps: workflow,
    workflowSteps: workflow,
    ai_team: ["CEO", "Satış Müdürü", "Google Ads Uzmanı", "Meta Ads Uzmanı", "SEO Uzmanı", "Kreatif Direktör", "Raporlama Yöneticisi"],
    aiTeam: ["CEO", "Satış Müdürü", "Google Ads Uzmanı", "Meta Ads Uzmanı", "SEO Uzmanı", "Kreatif Direktör", "Raporlama Yöneticisi"],
    kpi_template: ["Lead sayısı", "Mesaj sayısı", "Randevu oranı", "CPL", "CTR", "CPC", "ROAS", "WhatsApp dönüşümü", "Rapor görünürlüğü"],
    kpiTemplate: ["Lead sayısı", "Mesaj sayısı", "Randevu oranı", "CPL", "CTR", "CPC", "ROAS", "WhatsApp dönüşümü", "Rapor görünürlüğü"],
    operation_plan: ["1. hafta: kurulum ve veri toplama", "2. hafta: ilk optimizasyon", "3. hafta: kreatif / teklif / hedef kitle iyileştirme", "4. hafta: raporlama ve yenileme önerisi"],
    operationPlan: ["1. hafta: kurulum ve veri toplama", "2. hafta: ilk optimizasyon", "3. hafta: kreatif / teklif / hedef kitle iyileştirme", "4. hafta: raporlama ve yenileme önerisi"],
    report_template: ["Yönetici özeti", "Kanal performansı", "Riskler", "Fırsatlar", "7 günlük plan"],
    reportTemplate: ["Yönetici özeti", "Kanal performansı", "Riskler", "Fırsatlar", "7 günlük plan"],
    proposal_draft: `${sectorLabel} için ${monthlyBudgetRange} medya bütçesi ve ${serviceFeeRange} hizmet bedeli aralığında ${serviceTypes.join(" + ")} paketiyle başlanması önerilir. İlk ay hedefi ölçümleme, hızlı öğrenme ve düzenli raporlama disiplinidir.`,
    proposalDraft: `${sectorLabel} için ${monthlyBudgetRange} medya bütçesi ve ${serviceFeeRange} hizmet bedeli aralığında ${serviceTypes.join(" + ")} paketiyle başlanması önerilir. İlk ay hedefi ölçümleme, hızlı öğrenme ve düzenli raporlama disiplinidir.`,
    seven_day_plan: ["Gün 1: Kurulum kontrolü", "Gün 2: Reklam ve hedef kitle kontrolü", "Gün 3: Kreatif kontrolü", "Gün 4: İlk optimizasyon", "Gün 5: Ara rapor", "Gün 6: Müşteri geri bildirimi", "Gün 7: Haftalık rapor ve yeni aksiyonlar"],
    sevenDayPlan: ["Gün 1: Kurulum kontrolü", "Gün 2: Reklam ve hedef kitle kontrolü", "Gün 3: Kreatif kontrolü", "Gün 4: İlk optimizasyon", "Gün 5: Ara rapor", "Gün 6: Müşteri geri bildirimi", "Gün 7: Haftalık rapor ve yeni aksiyonlar"],
    thirty_day_plan: ["1. hafta: Kurulum ve veri toplama", "2. hafta: İlk optimizasyon", "3. hafta: Kreatif / teklif / hedef kitle iyileştirme", "4. hafta: Raporlama ve yenileme önerisi"],
    thirtyDayPlan: ["1. hafta: Kurulum ve veri toplama", "2. hafta: İlk optimizasyon", "3. hafta: Kreatif / teklif / hedef kitle iyileştirme", "4. hafta: Raporlama ve yenileme önerisi"],
    ninety_day_plan: ninetyDayPlan,
    ninetyDayPlan,
    social_media_plan: socialMediaPlan,
    socialMediaPlan,
    content_calendar: contentCalendar,
    contentCalendar,
    creative_ideas: creativeIdeas,
    creativeIdeas,
    approval_workflow: approvalWorkflow,
    approvalWorkflow,
    campaign_operations: campaignOperations,
    campaignOperations,
    client_communication_plan: clientCommunicationPlan,
    clientCommunicationPlan,
    report_approval_flow: reportApprovalFlow,
    reportApprovalFlow,
    tracking_metrics: ["Lead sayısı", "Mesaj sayısı", "Randevu oranı", "CPL", "CTR", "CPC", "ROAS", "Harcama", "WhatsApp dönüşümü", "Google yorumları", "Website form dönüşümü"],
    trackingMetrics: ["Lead sayısı", "Mesaj sayısı", "Randevu oranı", "CPL", "CTR", "CPC", "ROAS", "Harcama", "WhatsApp dönüşümü", "Google yorumları", "Website form dönüşümü"],
    risks: ["Ölçümleme eksikse kampanya öğrenmesi yavaşlar", "Düşük kreatif çeşitliliği performansı sınırlar", "Takip yapılmazsa lead kalitesi düşer"],
    opportunities: ["WhatsApp takip akışıyla dönüşüm artırılabilir", "Google arama niyeti yüksek lead sağlar", "Düzenli raporlama yenileme kararını kolaylaştırır"],
    sales_arguments: [`${sectorLabel} müşterileri hızlı dönüş ve güven kanıtı ister`, "Ölçümleme kurulmadan bütçe artırımı önerilmez", "İlk 30 gün veri toplama ve hızlı optimizasyon dönemidir"],
    customer_summary: `${sectorLabel} için hazırlanan bu paket; ${mainGoal} hedefi, ${channels.join(", ")} kanalları ve düzenli raporlama disipliniyle ilk 30 günü yönetilebilir hale getirir.`,
    customerSummary: `${sectorLabel} için hazırlanan bu paket; ${mainGoal} hedefi, ${channels.join(", ")} kanalları ve düzenli raporlama disipliniyle ilk 30 günü yönetilebilir hale getirir.`,
    version_number: 1,
    versionNumber: 1,
    source: "ai_generated",
    status: "draft",
    mode: process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY ? "real-ai-ready" : "demo-local-fallback"
  };
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("hk-intelligence-ceo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  return NextResponse.json({ ok: true, package: buildPackage(body), message: "Hazır paket üretildi." });
}
