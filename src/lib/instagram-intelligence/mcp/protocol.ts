// Instagram Intelligence — Claude Custom Connector tool catalogue and
// dispatcher. A small, purpose-built surface (6 tools) separate from
// Social Autopilot's own 37-tool MCP connector (../../social-autopilot/
// control/protocol.ts) — deliberately not the same catalogue, since this
// connector's whole point is a much narrower, read-mostly surface. Reuses
// that file's generic (not Social-Autopilot-specific) primitives directly:
// ControlError, authenticate, success/failure/sanitize envelopes, the Tool
// type and its argument validator.
//
// The Instagram/İçerik Takip business logic is imported with dynamic
// import() INSIDE execute()'s branches rather than as static top-level
// imports: tools/list and initialize never call execute() at all, so a
// cold Lambda handling just those doesn't need to load the Graph API
// client, the analysis engine, or the plan writer — only an actual
// tools/call pays for that. Found to matter in practice while diagnosing
// a slow-handshake report from Claude.ai's connector validator.
import {
  ControlError, authenticate, success, failure, sanitize, validateArguments,
  type Tool
} from "@/lib/social-autopilot/control/protocol";
// Type-only imports are erased at compile time (zero runtime cold-start
// cost) — only the VALUE imports of these modules are deferred below.
import type { ContentPlanItem } from "@/lib/content-plan/types";

export { ControlError, authenticate, success, failure, sanitize };

const limit: Tool["inputSchema"]["properties"][string] = { type: "integer", minimum: 1, maximum: 100 };
const plan: Tool["inputSchema"]["properties"][string] = { type: "array" };
const companyId: Tool["inputSchema"]["properties"][string] = { type: "string", format: "uuid" };
const text: Tool["inputSchema"]["properties"][string] = { type: "string" };
const arr: Tool["inputSchema"]["properties"][string] = { type: "array" };
const obj: Tool["inputSchema"]["properties"][string] = { type: "object" };
const dateField: Tool["inputSchema"]["properties"][string] = { type: "string", format: "date" };

export const tools: Tool[] = [
  { name: "get_instagram_account", description: "HK Dijital'in bağlı Instagram hesabının bağlantı durumunu döner (kullanıcı adı, bağlantı zamanı, token durumu). Read-only.", permission: "READ_ONLY", inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false } },
  { name: "get_instagram_analysis", description: "Gerçek Instagram gönderi geçmişine dayalı deterministik analiz: tema dağılımı, eksik/eskimiş temalar, format performansı, tekrar riski, paylaşım sıklığı. AI kullanmaz, hiçbir metrik uydurulmaz. Read-only.", permission: "READ_ONLY", inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false } },
  { name: "get_instagram_recent_posts", description: "Instagram hesabındaki en son gönderilerin ham listesi (caption, format, tarih, beğeni/yorum sayısı, permalink). Read-only.", permission: "READ_ONLY", inputSchema: { type: "object", properties: { limit }, required: [], additionalProperties: false } },
  { name: "get_content_tracking_history", description: "İçerik Takip'teki geçmiş (yayınlanmış) kayıtlar — tarih, platform, tema, konu, format, durum. Read-only.", permission: "READ_ONLY", inputSchema: { type: "object", properties: { limit }, required: [], additionalProperties: false } },
  { name: "get_upcoming_content_plan", description: "İçerik Takip'teki bugünden itibaren planlanmış (henüz paylaşılmamış) kayıtlar. Read-only.", permission: "READ_ONLY", inputSchema: { type: "object", properties: { limit }, required: [], additionalProperties: false } },
  { name: "create_content_plan", description: "Yazılmış bir içerik planını İçerik Takip'e kaydeder (tarih+konu bazında tekrar korumalı — aynı plan iki kez gönderilse bile kayıt çoğalmaz). Instagram'a HİÇBİR ŞEY YAYINLAMAZ, sadece İçerik Takip'e planlama satırı ekler.", permission: "WRITE_SAFE", inputSchema: { type: "object", properties: { items: plan }, required: ["items"], additionalProperties: false } },

  // --- HK Marketing Intelligence: customer resolution + integration status ---
  { name: "customer_list", description: "HK Dijital'in gerçek müşteri listesi (public.companies) — id ve isim. Read-only.", permission: "READ_ONLY", inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false } },
  { name: "customer_resolve", description: "Müşteri adına göre arama yapar, olası eşleşen müşterileri (id+isim) döner. Tek bir sonuç yoksa asla tahmin etme — kullanıcıya seçenekleri sun. Read-only.", permission: "READ_ONLY", inputSchema: { type: "object", properties: { query: text }, required: ["query"], additionalProperties: false } },
  { name: "customer_integrations", description: "Bir müşterinin Instagram/Facebook/TikTok/YouTube bağlantı durumu (customer_integrations üzerinden, gerçek veri) + Meta Ads/Google Ads hesap eşleşme durumu. Uydurulmuş 'bağlı' durumu asla döndürmez. Read-only.", permission: "READ_ONLY", inputSchema: { type: "object", properties: { companyId }, required: ["companyId"], additionalProperties: false } },
  { name: "meta_ads_account", description: "Bir müşterinin Meta Ads hesap eşleşme durumu (yalnızca eşleşme — gerçek performans için meta_ads_performance kullan). Read-only.", permission: "READ_ONLY", inputSchema: { type: "object", properties: { companyId }, required: ["companyId"], additionalProperties: false } },
  { name: "google_ads_account", description: "Bir müşterinin Google Ads hesap eşleşme durumu (yalnızca eşleşme — gerçek performans için google_ads_performance kullan). Read-only.", permission: "READ_ONLY", inputSchema: { type: "object", properties: { companyId }, required: ["companyId"], additionalProperties: false } },
  { name: "meta_ads_performance", description: "Bir müşterinin gerçek Meta Ads performansı: kampanyalar, harcama, gösterim, erişim, tıklama, CTR, CPC, CPM, dönüşüm (mevcut olduğunda). API'den gelmeyen alanlar uydurulmaz. Read-only — kampanya/bütçe değiştirmez.", permission: "READ_ONLY", inputSchema: { type: "object", properties: { companyId, rangePreset: text, dateFrom: text, dateTo: text }, required: ["companyId"], additionalProperties: false } },
  { name: "google_ads_performance", description: "Bir müşterinin gerçek Google Ads performansı: kampanyalar, maliyet, gösterim, tıklama, CTR, ortalama CPC, dönüşüm, dönüşüm değeri. API'den gelmeyen alanlar uydurulmaz. Read-only — kampanya/bütçe değiştirmez.", permission: "READ_ONLY", inputSchema: { type: "object", properties: { companyId, dateFrom: text, dateTo: text }, required: ["companyId"], additionalProperties: false } },

  // --- HK Marketing Intelligence: business memory (reuses hk_intelligence_ceo_runs / hk_recommendations) ---
  { name: "save_marketing_intelligence", description: "Anlamlı bir analiz/strateji/plan sonucunu HK Intelligence'a kalıcı olarak kaydeder (aktivite + bulgular + öneriler). Basit sohbet veya veri okuma için ÇAĞIRMA — yalnızca gerçekten iş değeri olan bir sonuç üretildiğinde kullan. Aynı müşteri+başlık 5 dakika içinde tekrar gönderilirse yeni kayıt oluşturmaz (idempotent).", permission: "WRITE_SAFE", inputSchema: { type: "object", properties: { companyId, title: text, activityType: text, sources: arr, periodStart: text, periodEnd: text, summary: text, findings: arr, hypotheses: arr, recommendations: arr, actions: arr, measurementPlan: arr }, required: ["companyId", "title", "activityType", "sources", "summary"], additionalProperties: false } },
  { name: "intelligence_history", description: "Bir müşteri için geçmiş HK Intelligence kayıtlarını (analizler, stratejiler, planlar) tarih sırasıyla döner. Read-only.", permission: "READ_ONLY", inputSchema: { type: "object", properties: { companyId, limit }, required: ["companyId"], additionalProperties: false } },
  { name: "recommendations_get", description: "Bir müşteri için kayıtlı önerileri döner (isteğe bağlı status filtresiyle: open/planned/implemented/rejected). Read-only.", permission: "READ_ONLY", inputSchema: { type: "object", properties: { companyId, status: text, limit }, required: ["companyId"], additionalProperties: false } },
  { name: "recommendation_update", description: "Tek bir önerinin durumunu günceller (open/planned/implemented/rejected). Reklam harcaması veya kampanya değiştirmez — yalnızca öneri kaydının durumunu günceller.", permission: "WRITE_SAFE", inputSchema: { type: "object", properties: { id: text, status: text }, required: ["id", "status"], additionalProperties: false } },

  // --- HK Ads Intelligence: strategy context / save / read (read-only ad access — never creates/publishes/changes a campaign or budget) ---
  { name: "get_ads_strategy_context", description: "Bir müşteri için reklam stratejisi hazırlamaya yetecek TEK, kompakt bağlam: şirket bilgisi, gerçek entegrasyon durumu, Instagram/Facebook organik özet (veri yoksa data_unavailable+neden), gerçek Meta Ads/Google Ads performansı (varsa), önceki HK Intelligence kayıtları ve varsa en son reklam stratejisi özeti. Read-only.", permission: "READ_ONLY", inputSchema: { type: "object", properties: { companyId }, required: ["companyId"], additionalProperties: false } },
  { name: "save_ads_strategy_plan", description: "Claude'un ürettiği yapılandırılmış reklam stratejisini (iş özeti, Meta stratejisi, Google Ads stratejisi, gerekçeli bütçe planı, 30 günlük yol haritası, KPI'lar, isteğe bağlı implementation_guide) HK Dijital'e kaydeder. Şema kontrollüdür — eksik zorunlu alan reddedilir. Hiçbir reklam hesabında değişiklik yapmaz, yalnızca planı kaydeder.", permission: "WRITE_SAFE", inputSchema: { type: "object", properties: { strategy: { type: "object" } }, required: ["strategy"], additionalProperties: false } },
  { name: "get_latest_ads_strategy_plan", description: "Bir müşterinin en son kaydedilmiş reklam stratejisini (tam yapılandırılmış hâliyle) döner — kurulum rehberliği veya geçmiş karşılaştırması için kullanılır. Read-only.", permission: "READ_ONLY", inputSchema: { type: "object", properties: { companyId }, required: ["companyId"], additionalProperties: false } },

  // --- Ön İnceleme Merkezi: pre-sale digital research context / save / read ---
  {
    name: "get_pre_audit_context",
    description: "Get the canonical HK Dijital company or lead context required before researching or preparing a pre-audit report. Use this first to identify and verify the correct business. Accepts companyId and/or companyName for an existing customer/prospect company, OR leadId for a Müşteri Keşfi discovery candidate not yet a company (leadId is unambiguous, no name search needed). Never internet research — only existing HK Dijital data (business profile, integration summary where applicable, lead/customer status, prior pre-audit count and latest date). Returns an ambiguous result with candidates instead of silently guessing when more than one company matches by name.",
    permission: "READ_ONLY",
    inputSchema: { type: "object", properties: { companyId, companyName: text, leadId: text }, required: [], additionalProperties: false }
  },
  {
    name: "save_pre_audit_report",
    description: "Save an explicitly approved pre-audit / sales intelligence report to the verified HK Dijital company or lead. Pass exactly one of companyId (existing company) or leadId (a Müşteri Keşfi discovery candidate pre-review — saving here automatically completes that lead's pre-review queue status, the only status this tool ever changes). Supports report_type INTERNAL_REPORT (HK Dijital's own use — sales notes, script, objections, DM/WhatsApp drafts) and CLIENT_REPORT (clean, presentable version — internal-only fields are always stripped server-side regardless of what is sent). Pass analysisGroupId (returned by a prior save in the same research pass) to link a CLIENT_REPORT to its INTERNAL_REPORT sibling; omit it to start a new research pass. Only use after the user explicitly asks to save or transfer the report to HK Dijital — analyzing, researching, or drafting alone is never itself a save instruction. Always inserts a new row; never overwrites a prior report.",
    permission: "WRITE_SAFE",
    inputSchema: {
      type: "object",
      properties: {
        companyId, leadId: text, analysisGroupId: text, reportType: text, title: text, status: text, reportDate: dateField,
        executiveSummary: text,
        digitalPresence: obj, googleAnalysis: obj, mapsAnalysis: obj, websiteAnalysis: obj, seoAnalysis: obj, socialAnalysis: obj,
        metaAdsAnalysis: obj, googleAdsAnalysis: obj, marketAnalysis: obj, competitorAnalysis: obj, swot: obj,
        digitalGaps: arr, opportunities: arr, recommendedServices: arr, recommendedPackage: obj, adStrategy: obj, budgetPlan: obj, sources: arr,
        salesNotes: text, salesScript: text, instagramDm: text, whatsappInitial: text, whatsappWithPdf: text, objections: arr
      },
      required: ["reportType"],
      additionalProperties: false
    }
  },
  {
    name: "get_latest_pre_audit_report",
    description: "Get the latest saved pre-audit report for a verified HK Dijital company or lead, including the related internal/client report versions from the same research pass when available. Accepts companyId (and companyName as a fallback) for a company, or leadId for a Müşteri Keşfi discovery candidate. Optional reportType filters to only INTERNAL_REPORT or only CLIENT_REPORT. Returns not_found (never a fake placeholder) if no report exists yet.",
    permission: "READ_ONLY",
    inputSchema: { type: "object", properties: { companyId, companyName: text, leadId: text, reportType: text }, required: [], additionalProperties: false }
  }
];

function toolByName(name: string): Tool {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new ControlError("UNKNOWN_TOOL", "Unknown tool.", 404);
  return tool;
}

// Known, well-understood data/config failures get a real ControlError code
// instead of falling through to the generic SERVICE_UNAVAILABLE — that
// genericness is exactly what masked the stale-company-id bug this was
// added for (see hk-dijital-company.ts). A raw error that doesn't match one
// of these still surfaces as SERVICE_UNAVAILABLE, which is correct for an
// actual outage.
async function toKnownControlError(error: unknown): Promise<ControlError | null> {
  const { HkDijitalCompanyNotFoundError } = await import("@/lib/content-plan/hk-dijital-company");
  if (error instanceof HkDijitalCompanyNotFoundError) {
    return new ControlError("CONFIGURATION_ERROR", error.message, 500);
  }
  const message = error instanceof Error ? error.message : "";
  if (/foreign key/i.test(message)) {
    return new ControlError(
      "CONFIGURATION_ERROR",
      "İçerik Takip kaydı geçersiz bir company_id referansı içeriyor — HK Dijital şirket kaydını kontrol edin.",
      500
    );
  }
  return null;
}

async function fetchPlanRows(filter: "history" | "upcoming", limit: number): Promise<ContentPlanItem[]> {
  const { supabaseRest } = await import("@/lib/supabase");
  const { CONTENT_PLAN_TABLE } = await import("@/lib/content-plan/types");
  const { resolveHkDijitalCompanyId } = await import("@/lib/content-plan/hk-dijital-company");
  const today = new Date().toISOString().slice(0, 10);
  const scope = filter === "upcoming"
    ? `&is_published=eq.false&scheduled_date=gte.${today}`
    : `&is_published=eq.true`;
  try {
    // Scoped to HK Dijital's own company_id — İçerik Takip is now
    // multi-client, but Instagram Intelligence only ever reasons about HK
    // Dijital's own account, so it must never read/count a customer's rows.
    const companyId = await resolveHkDijitalCompanyId();
    return await supabaseRest<ContentPlanItem[]>(
      `${CONTENT_PLAN_TABLE}?company_id=eq.${companyId}&select=*${scope}&order=scheduled_date.${filter === "upcoming" ? "asc" : "desc"}&limit=${limit}`
    );
  } catch (error) {
    throw (await toKnownControlError(error)) ?? error;
  }
}

export async function execute(name: string, args: Record<string, unknown>): Promise<unknown> {
  const toolLimit = Number(args.limit || 20);
  switch (name) {
    case "get_instagram_account": {
      const { getInstagramConnectionStatus } = await import("@/lib/social-autopilot/instagram-oauth");
      return getInstagramConnectionStatus();
    }
    case "get_instagram_analysis": {
      const { analyzeInstagramAccount, InstagramNotConnectedError } = await import("@/lib/instagram-intelligence/analysis");
      try {
        return await analyzeInstagramAccount();
      } catch (error) {
        if (error instanceof InstagramNotConnectedError) throw new ControlError("NOT_CONNECTED", error.message, 409);
        throw error;
      }
    }
    case "get_instagram_recent_posts": {
      const { getUsableInstagramToken, InstagramNotConnectedError } = await import("@/lib/social-autopilot/instagram-oauth");
      const { getRecentInstagramMedia } = await import("@/lib/social-autopilot/instagram-graph-client");
      try {
        const { accessToken, igUserId } = await getUsableInstagramToken();
        const result = await getRecentInstagramMedia(accessToken, igUserId, toolLimit);
        return { source: "instagram", posts: result.data };
      } catch (error) {
        if (error instanceof InstagramNotConnectedError) throw new ControlError("NOT_CONNECTED", error.message, 409);
        throw error;
      }
    }
    case "get_content_tracking_history":
      return fetchPlanRows("history", toolLimit);
    case "get_upcoming_content_plan":
      return fetchPlanRows("upcoming", toolLimit);
    case "create_content_plan": {
      const { validatePlanItems, createContentPlanItems, PlanInputError } = await import("@/lib/instagram-intelligence/plan");
      try {
        const items = validatePlanItems(args.items);
        return await createContentPlanItems(items);
      } catch (error) {
        if (error instanceof PlanInputError) throw new ControlError("INVALID_ARGUMENTS", error.message, 400);
        throw (await toKnownControlError(error)) ?? error;
      }
    }

    case "customer_list": {
      const { listCustomers } = await import("@/lib/marketing-intelligence/customers");
      return listCustomers();
    }
    case "customer_resolve": {
      const { resolveCustomer } = await import("@/lib/marketing-intelligence/customers");
      return resolveCustomer(String(args.query || ""));
    }
    case "customer_integrations": {
      const { getCustomerIntegrations } = await import("@/lib/marketing-intelligence/customers");
      return getCustomerIntegrations(String(args.companyId));
    }
    case "meta_ads_account": {
      const { getMetaAdsAccount } = await import("@/lib/marketing-intelligence/ad-accounts");
      return getMetaAdsAccount(String(args.companyId));
    }
    case "google_ads_account": {
      const { getGoogleAdsAccount } = await import("@/lib/marketing-intelligence/ad-accounts");
      return getGoogleAdsAccount(String(args.companyId));
    }
    case "meta_ads_performance": {
      const { getMetaAdsPerformance } = await import("@/lib/marketing-intelligence/ad-performance");
      return getMetaAdsPerformance(
        String(args.companyId),
        typeof args.rangePreset === "string" ? args.rangePreset : "last_30d",
        typeof args.dateFrom === "string" ? args.dateFrom : undefined,
        typeof args.dateTo === "string" ? args.dateTo : undefined
      );
    }
    case "google_ads_performance": {
      const { getGoogleAdsPerformance } = await import("@/lib/marketing-intelligence/ad-performance");
      const range = typeof args.dateFrom === "string" && typeof args.dateTo === "string"
        ? { startDate: args.dateFrom, endDate: args.dateTo }
        : undefined;
      return getGoogleAdsPerformance(String(args.companyId), range);
    }
    case "save_marketing_intelligence": {
      const { saveIntelligence } = await import("@/lib/marketing-intelligence/intelligence-store");
      const recommendations = Array.isArray(args.recommendations)
        ? (args.recommendations as unknown[]).filter((r): r is Record<string, unknown> => !!r && typeof r === "object").map((r) => ({
            title: String(r.title || ""),
            recommendation_type: String(r.recommendation_type || "general"),
            expected_impact: r.expected_impact ? String(r.expected_impact) : undefined,
            priority: r.priority ? String(r.priority) : undefined
          })).filter((r) => r.title)
        : [];
      return saveIntelligence({
        companyId: String(args.companyId),
        title: String(args.title),
        activityType: String(args.activityType),
        sources: Array.isArray(args.sources) ? args.sources.map(String) : [],
        periodStart: typeof args.periodStart === "string" ? args.periodStart : null,
        periodEnd: typeof args.periodEnd === "string" ? args.periodEnd : null,
        summary: String(args.summary),
        findings: Array.isArray(args.findings) ? args.findings.map(String) : [],
        hypotheses: Array.isArray(args.hypotheses) ? args.hypotheses.map(String) : [],
        recommendations,
        actions: Array.isArray(args.actions) ? args.actions.map(String) : [],
        measurementPlan: Array.isArray(args.measurementPlan) ? args.measurementPlan.map(String) : []
      });
    }
    case "intelligence_history": {
      const { getIntelligenceHistory } = await import("@/lib/marketing-intelligence/intelligence-store");
      return getIntelligenceHistory(String(args.companyId), toolLimit);
    }
    case "recommendations_get": {
      const { getRecommendations } = await import("@/lib/marketing-intelligence/intelligence-store");
      return getRecommendations(String(args.companyId), typeof args.status === "string" ? args.status : undefined, toolLimit);
    }
    case "recommendation_update": {
      const { updateRecommendation } = await import("@/lib/marketing-intelligence/intelligence-store");
      try {
        return await updateRecommendation(String(args.id), String(args.status));
      } catch (error) {
        throw new ControlError("INVALID_ARGUMENTS", error instanceof Error ? error.message : "Geçersiz durum.", 400);
      }
    }

    case "get_ads_strategy_context": {
      const { getAdsStrategyContext } = await import("@/lib/marketing-intelligence/ads-strategy");
      return getAdsStrategyContext(String(args.companyId));
    }
    case "save_ads_strategy_plan": {
      const { validateAdsStrategy, saveAdsStrategy, AdsStrategyValidationError } = await import("@/lib/marketing-intelligence/ads-strategy");
      try {
        const strategy = validateAdsStrategy(args.strategy);
        return await saveAdsStrategy(strategy);
      } catch (error) {
        if (error instanceof AdsStrategyValidationError) throw new ControlError("INVALID_ARGUMENTS", error.message, 400);
        throw error;
      }
    }
    case "get_latest_ads_strategy_plan": {
      const { getLatestAdsStrategy } = await import("@/lib/marketing-intelligence/ads-strategy");
      const run = await getLatestAdsStrategy(String(args.companyId));
      if (!run) throw new ControlError("NOT_FOUND", "Bu müşteri için kayıtlı reklam stratejisi yok.", 404);
      return run;
    }

    case "get_pre_audit_context": {
      const { getPreAuditCompanyContext, getPreAuditLeadContext } = await import("@/lib/pre-audit/reports");
      try {
        if (typeof args.leadId === "string" && args.leadId) return await getPreAuditLeadContext(args.leadId);
        return await getPreAuditCompanyContext(
          typeof args.companyId === "string" ? args.companyId : undefined,
          typeof args.companyName === "string" ? args.companyName : undefined
        );
      } catch (error) {
        throw (await toKnownControlError(error)) ?? error;
      }
    }
    case "save_pre_audit_report": {
      const { validatePreAuditReport, savePreAuditReport, PreAuditValidationError, PreAuditCompanyNotFoundError } = await import("@/lib/pre-audit/reports");
      const str = (v: unknown) => (typeof v === "string" ? v : undefined);
      try {
        const payload = validatePreAuditReport({
          company_id: str(args.companyId),
          lead_id: str(args.leadId),
          report_type: args.reportType,
          title: str(args.title), status: str(args.status), report_date: str(args.reportDate),
          executive_summary: str(args.executiveSummary),
          digital_presence: args.digitalPresence, google_analysis: args.googleAnalysis, maps_analysis: args.mapsAnalysis,
          website_analysis: args.websiteAnalysis, seo_analysis: args.seoAnalysis, social_analysis: args.socialAnalysis,
          meta_ads_analysis: args.metaAdsAnalysis, google_ads_analysis: args.googleAdsAnalysis, market_analysis: args.marketAnalysis,
          competitor_analysis: args.competitorAnalysis, swot: args.swot,
          digital_gaps: args.digitalGaps, opportunities: args.opportunities, recommended_services: args.recommendedServices,
          recommended_package: args.recommendedPackage, ad_strategy: args.adStrategy, budget_plan: args.budgetPlan, sources: args.sources,
          sales_notes: str(args.salesNotes), sales_script: str(args.salesScript), instagram_dm: str(args.instagramDm),
          whatsapp_initial: str(args.whatsappInitial), whatsapp_with_pdf: str(args.whatsappWithPdf), objections: args.objections
        });
        return await savePreAuditReport(payload, str(args.analysisGroupId));
      } catch (error) {
        if (error instanceof PreAuditValidationError) throw new ControlError("INVALID_ARGUMENTS", error.message, 400);
        if (error instanceof PreAuditCompanyNotFoundError) throw new ControlError("NOT_FOUND", error.message, 404);
        throw (await toKnownControlError(error)) ?? error;
      }
    }
    case "get_latest_pre_audit_report": {
      const { getPreAuditCompanyContext, getLatestPreAuditReport } = await import("@/lib/pre-audit/reports");
      try {
        const leadId = typeof args.leadId === "string" ? args.leadId : undefined;
        let companyId = typeof args.companyId === "string" ? args.companyId : undefined;
        if (!leadId && !companyId && typeof args.companyName === "string") {
          const context = await getPreAuditCompanyContext(undefined, args.companyName);
          if (context.status !== "resolved") return context;
          companyId = context.company.id;
        }
        if (!leadId && !companyId) throw new ControlError("INVALID_ARGUMENTS", "companyId, companyName veya leadId zorunludur.", 400);
        const reportType = args.reportType === "INTERNAL_REPORT" || args.reportType === "CLIENT_REPORT" ? args.reportType : undefined;
        const result = await getLatestPreAuditReport(companyId, reportType, leadId);
        return result || { status: "not_found" };
      } catch (error) {
        throw (await toKnownControlError(error)) ?? error;
      }
    }

    default:
      throw new ControlError("UNKNOWN_TOOL", "Unknown tool.", 404);
  }
}

export { toolByName, validateArguments };
