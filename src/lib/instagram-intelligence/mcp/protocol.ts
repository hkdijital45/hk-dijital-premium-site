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
  { name: "get_latest_ads_strategy_plan", description: "Bir müşterinin en son kaydedilmiş reklam stratejisini (tam yapılandırılmış hâliyle) döner — kurulum rehberliği veya geçmiş karşılaştırması için kullanılır. Read-only.", permission: "READ_ONLY", inputSchema: { type: "object", properties: { companyId }, required: ["companyId"], additionalProperties: false } }
];

function toolByName(name: string): Tool {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new ControlError("UNKNOWN_TOOL", "Unknown tool.", 404);
  return tool;
}

async function fetchPlanRows(filter: "history" | "upcoming", limit: number): Promise<ContentPlanItem[]> {
  const { supabaseRest } = await import("@/lib/supabase");
  const { HK_DIJITAL_COMPANY_ID, CONTENT_PLAN_TABLE } = await import("@/lib/content-plan/types");
  const today = new Date().toISOString().slice(0, 10);
  const scope = filter === "upcoming"
    ? `&is_published=eq.false&scheduled_date=gte.${today}`
    : `&is_published=eq.true`;
  // Scoped to HK Dijital's own company_id — İçerik Takip is now
  // multi-client, but Instagram Intelligence only ever reasons about HK
  // Dijital's own account, so it must never read/count a customer's rows.
  return supabaseRest<ContentPlanItem[]>(
    `${CONTENT_PLAN_TABLE}?company_id=eq.${HK_DIJITAL_COMPANY_ID}&select=*${scope}&order=scheduled_date.${filter === "upcoming" ? "asc" : "desc"}&limit=${limit}`
  );
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
        throw error;
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

    default:
      throw new ControlError("UNKNOWN_TOOL", "Unknown tool.", 404);
  }
}

export { toolByName, validateArguments };
