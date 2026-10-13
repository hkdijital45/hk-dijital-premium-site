// Builds the complete, copyable Claude Project prompt for Teklif Motoru —
// the ONLY "AI integration" this feature has (no API key, no server-side
// LLM call). A human copies this into a real Claude Project chat, then
// pastes the HK_PROPOSAL_V1 JSON result back into the Import screen.
import { HK_PROPOSAL_SCHEMA_VERSION, type ProposalCompetitor } from "./schema";
import { sanitizeCompetitorsForPrompt } from "./competitors";

export type ProposalQuestionnaire = {
  business: {
    name?: string; sector?: string; subsector?: string; city?: string; district?: string;
    serviceArea?: string; businessModel?: string; website?: string; instagram?: string; facebook?: string;
    googleBusinessProfile?: string; existingAdAccounts?: string; mainProducts?: string; mainServices?: string;
    targetCustomers?: string; currentChallenges?: string;
  };
  platforms: string[]; // Google Ads, Meta Ads, Instagram, Facebook, Social Media Management, SEO, Website, Landing Page, Other
  objectives: string[];
  audience: {
    city?: string; districts?: string; serviceRadius?: string; ageRange?: string; genderRelevance?: string;
    needs?: string; buyingIntent?: string; interests?: string; remarketingEligible?: string;
    existingAudienceAvailable?: string; geographicRestrictions?: string;
  };
  budget: {
    monthlyTotal?: number | null; googleAllocation?: number | null; metaAllocation?: number | null;
    otherAllocation?: number | null; dailyBudgetPreference?: string; testingBudget?: number | null;
    notDetermined?: boolean;
  };
  fees: {
    monthlyManagementFee?: number; setupFee?: number; additionalServiceFees?: string;
    contractDurationMonths?: number; paymentTerms?: string; taxes?: string; discounts?: string;
    includedServices?: string; excludedServices?: string;
  };
  strategy: {
    mainPriority?: string; mainConversionAction?: string; currentProblems?: string; existingCreatives?: string;
    newCreativeAvailable?: string; landingPageAvailable?: string; trackingAvailable?: string;
    existingPerformance?: string; competitors?: string; specialRestrictions?: string;
  };
  research: { notes?: string; competitorUrls?: string[]; websiteUrls?: string[]; instagramUrls?: string[]; sourceReferences?: string[] };
  // User-supplied competitor knowledge gathered during the wizard, BEFORE
  // Claude's own research — real businesses the staff member already
  // knows about, never a placeholder/fabricated entry (same
  // verified+sourceUrl discipline as the post-Claude HK_PROPOSAL_V1
  // competitors array in schema.ts).
  competitors?: ProposalCompetitor[];
  roadmap?: {
    first30Days?: string; days31to60?: string; days61to90?: string;
    campaignStructure?: string; optimizationStrategy?: string; measurementPlan?: string;
  };
};

function section(title: string, lines: Array<[string, unknown]>): string {
  const body = lines.filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("\n");
  return body ? `${title}\n${body}` : "";
}

export type PromptFindingsContext = {
  preAudit: string; instagram: string; adEvaluation: string; sourcesSummary: string;
};

export function buildProposalClaudePrompt(q: ProposalQuestionnaire, targetLabel: string, findings?: PromptFindingsContext): string {
  const { competitors: sanitizedCompetitors, warnings: competitorWarnings } = sanitizeCompetitorsForPrompt(q.competitors);
  const parts: string[] = [
    "HK Dijital için gerçek bir işletmeye yönelik profesyonel bir reklam/dijital pazarlama teklifi stratejisi hazırlamanı istiyorum.",
    "",
    "ROL: Kıdemli Dijital Pazarlama Stratejisti, Google Ads Uzmanı, Meta Ads Uzmanı, Yerel Pazar Araştırma Analisti, Sosyal Medya Stratejisti, Dönüşüm Optimizasyonu Uzmanı ve Ajans Ticari Direktörü olarak davran.",
    "",
    `İŞLETME: ${targetLabel}`,
    "",
    section("İŞLETME BİLGİLERİ", Object.entries(q.business || {})),
    section("SEÇİLEN REKLAM PLATFORMLARI", [["Platformlar", q.platforms]]),
    section("KAMPANYA HEDEFLERİ", [["Hedefler", q.objectives]]),
    section("HEDEF KİTLE", Object.entries(q.audience || {})),
    section("REKLAM BÜTÇESİ", Object.entries(q.budget || {})),
    section("AJANS ÜCRETLERİ (reklam harcamasından ayrı)", Object.entries(q.fees || {})),
    section("STRATEJİ DETAYLARI", Object.entries(q.strategy || {})),
    section("90 GÜNLÜK YOL HARİTASI (kullanıcı girdisi)", Object.entries(q.roadmap || {})),
    section("ARAŞTIRMA MATERYALLERİ", Object.entries(q.research || {})),
    sanitizedCompetitors.length
      ? `BİLİNEN RAKİPLER (kullanıcı tarafından önceden girildi — bunları olduğu gibi kullan, isim uydurma, ek rakipler bulursan verified alanını dürüstçe işaretle):\n${sanitizedCompetitors.map((c) => `- ${c.name}${c.website ? ` (${c.website})` : ""} — doğrulanmış: ${c.verified ? "evet" : "hayır"}${c.sourceUrl ? `, kaynak: ${c.sourceUrl}` : ""}${c.notes ? `, not: ${c.notes}` : ""}${c.urlWarning ? ` [UYARI: ${c.urlWarning}]` : ""}`).join("\n")}`
      : "",
    competitorWarnings.length ? `RAKİP VERİSİ UYARILARI:\n${competitorWarnings.map((w) => `- ${w}`).join("\n")}` : "",
    "",
    findings ? [
      "HK ADMIN'DE DAHA ÖNCE TAMAMLANMIŞ ANALİZLER (gerçek, kayıtlı veriler — bunları temel al, tekrar araştırma yapmana gerek yok ama doğrulayabiliyorsan güncelle):",
      "",
      "ÖN İNCELEME BULGULARI:",
      findings.preAudit,
      "",
      "INSTAGRAM DEĞERLENDİRME BULGULARI:",
      findings.instagram,
      "",
      "REKLAM DEĞERLENDİRME BULGULARI:",
      findings.adEvaluation,
      "",
      "VERİ KAYNAKLARI:",
      findings.sourcesSummary
    ].join("\n") : "",
    "",
    "ZORUNLU ANALİZ BAŞLIKLARI:",
    "1. İşletme değerlendirmesi\n2. Pazar analizi\n3. Rakip araştırması\n4. Rakiplerin dijital varlığı\n5. Google Ads fırsatları\n" +
      "6. Meta Ads fırsatları\n7. Platform uygunluğu\n8. Hedef kitle stratejisi\n9. Arama niyeti analizi\n10. Anahtar kelime temaları\n" +
      "11. Negatif anahtar kelime temaları\n12. Kampanya mimarisi\n13. Coğrafi hedefleme\n14. Kreatif strateji\n15. Dönüşüm stratejisi\n" +
      "16. Ölçümleme gereksinimleri\n17. Üç bütçe senaryosu (Başlangıç / Önerilen / Büyüme)\n18. Önerilen ajans hizmetleri\n" +
      "19. İlk 30 günlük uygulama planı\n20. 90 günlük büyüme yol haritası\n21. Riskler ve varsayımlar\n22. Profesyonel ticari teklif içeriği\n" +
      "23. Yukarıda 'HK ADMIN'DE DAHA ÖNCE TAMAMLANMIŞ ANALİZLER' bölümü doluysa, bu gerçek bulguları analizine ENTEGRE ET — tekrar sıfırdan tahmin üretme, var olan bulguyu temel alıp derinleştir.",
    "",
    "KRİTİK ARAŞTIRMA KURALLARI:",
    "- Rakip isimlerini ASLA uydurma. Gerçek bir rakip bulamıyorsan, competitors dizisini boş bırak veya 'verified: false' ile sadece genel bir gözlem yaz.",
    "- Reklam harcaması, CPC, CPM, CPA, ROAS veya dönüşüm oranlarını ASLA uydurma.",
    "- Doğrulanmış gerçekleri varsayımlardan ayır (competitors[].verified alanını kullan).",
    "- Dış kaynak kullandığında kaynak URL'si ve erişim tarihi belirt (sources dizisi).",
    "- Canlı tarama/gezinme yeteneğin yoksa, bunu açıkça belirt — araştırmayı tamamlanmış gibi gösterme.",
    "- Hiçbir sonucu (lead, sipariş, gelir, ROAS) garanti etme; tahminler her zaman koşullu ve varsayımlarla birlikte sunulmalı.",
    "",
    "ÇIKTI FORMATI — İKİ AYRI ÇIKTI İSTİYORUM:",
    "ÇIKTI A: Profesyonel, okunabilir Türkçe analiz metni (yukarıdaki 22 başlığı kapsayan).",
    "ÇIKTI B: Aşağıdaki şemaya UYGUN, geçerli, makine tarafından okunabilir TEK BİR JSON nesnesi (başka hiçbir metin eklemeden, yalnızca JSON kod bloğu içinde):",
    "",
    "```json",
    JSON.stringify({
      schema_version: HK_PROPOSAL_SCHEMA_VERSION,
      business: {}, market_analysis: {}, competitors: [{ name: "", verified: false, notes: "", sourceUrl: "", accessDate: "" }],
      google_ads_strategy: {}, meta_ads_strategy: {}, audience_strategy: {},
      budget_scenarios: [{ name: "Başlangıç", monthlyBudget: 0, objective: "" }, { name: "Önerilen", monthlyBudget: 0, objective: "" }, { name: "Büyüme", monthlyBudget: 0, objective: "" }],
      recommended_services: [], implementation_plan: [{ day: "", action: "" }], roadmap_90_days: [{ phase: "", action: "" }],
      risks: [], assumptions: [], sources: [{ url: "", accessDate: "", note: "" }], customer_proposal: {}, internal_recommendations: {}
    }, null, 2),
    "```",
    "",
    `Bu JSON'u ÇIKTI B olarak üret ve "schema_version": "${HK_PROPOSAL_SCHEMA_VERSION}" alanını AYNEN koru. Sonucu HK Admin'e yapıştıracağım.`
  ];
  return parts.filter(Boolean).join("\n\n");
}
