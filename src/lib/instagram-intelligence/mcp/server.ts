// Builds the MCP `Server` for the Instagram Intelligence Claude Custom
// Connector. Mirrors ../../social-autopilot/mcp/server.ts's structure
// (same low-level @modelcontextprotocol/sdk Server API, same tool-catalogue
// -> JSON Schema passthrough) but wired to this connector's own, much
// smaller tool set. No Instagram/DB logic lives here — only the adapter
// between the MCP wire protocol and ./protocol.ts's execute().
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { ControlError, failure, sanitize, success, tools, toolByName, validateArguments, execute } from "./protocol";

// Bumped 1.1.0 -> 1.2.0 for the Müşteri Keşfi tool addition (23 -> 26
// tools), then 1.2.0 -> 1.3.0 removing that same Müşteri Keşfi Claude
// integration (26 -> 23 tools), then 1.3.0 -> 1.4.0 adding the Instagram
// Profil Optimizasyonu tools (23 -> 26 tools) — some MCP clients key
// their tools-list cache off server name+version, so a real version bump
// gives a stronger signal to refresh than relying on "Refresh tools
// list" alone.
const SERVER_INFO = { name: "hk-dijital-instagram-intelligence", version: "1.12.1" };
const SERVER_INSTRUCTIONS =
  "HK Dijital Marketing Intelligence tools (extends the original Instagram Intelligence connector — same " +
  "endpoint, same name, backward compatible). get_instagram_account/get_instagram_analysis/" +
  "get_instagram_recent_posts read the real, already-connected Instagram account (Graph API) — never " +
  "publish, edit, schedule, or delete anything on Instagram. get_content_tracking_history/" +
  "get_upcoming_content_plan read İçerik Takip; create_content_plan appends planning rows to it (duplicate-" +
  "safe by date+topic) — Instagram itself is never touched. customer_list/customer_resolve/" +
  "customer_integrations/meta_ads_account/google_ads_account are read-only, real, customer-scoped lookups " +
  "against public.companies and customer_integrations — never fabricate a connection status. " +
  "meta_ads_account/google_ads_account report only whether a real ad account is mapped, not live campaign " +
  "performance (not implemented). save_marketing_intelligence persists a genuinely business-significant " +
  "analysis/strategy/plan into HK Intelligence (hk_intelligence_ceo_runs + hk_recommendations) — call it " +
  "only after producing real, evidence-based findings, never for routine lookups or chat; it is idempotent " +
  "per company+title within a 5-minute window. intelligence_history/recommendations_get are read-only. " +
  "recommendation_update only changes a recommendation's tracked status (open/planned/implemented/" +
  "rejected) — it never touches advertising spend or campaigns. No tool here can change ad spend, " +
  "campaigns, budgets, or targeting. get_pre_audit_context/save_pre_audit_report/" +
  "get_latest_pre_audit_report support Ön İnceleme Merkezi (pre-sale digital research reports): " +
  "get_pre_audit_context verifies the real HK Dijital company before research starts (never guesses on " +
  "an ambiguous name match), save_pre_audit_report persists an explicitly-approved INTERNAL_REPORT or " +
  "CLIENT_REPORT (internal sales fields are always stripped from CLIENT_REPORT server-side) — call it " +
  "only after the user explicitly asks to save/transfer to HK Dijital, never after analysis alone — and " +
  "get_latest_pre_audit_report reads back the latest saved report for a company. " +
  "get_candidate_evaluation_context/save_candidate_evaluation/get_latest_candidate_evaluation support " +
  "Aday Değerlendirme — a separate, lighter MÜŞTERİ ADAYI DEĞERLENDİRME ('is this prospect worth " +
  "pursuing?') qualification report, never to be confused with or merged into the deeper Ön İnceleme " +
  "audit above; same company/lead resolution rules and explicit-save-only rule apply. " +
  "get_instagram_profile_audit_context/save_instagram_profile_audit/get_instagram_profile_audits support " +
  "Instagram Profil Optimizasyonu (post-sale profile-quality consulting for an existing customer's own " +
  "connected Instagram): get_instagram_profile_audit_context returns the real company + connected Instagram " +
  "username/status + the last saved audit; save_instagram_profile_audit persists an explicitly-approved " +
  "report as a NEW history row (never overwrites) — call it only after the user explicitly says to save it, " +
  "never after showing the analysis alone; get_instagram_profile_audits reads back the history list or one " +
  "full report. This never modifies the customer's actual Instagram account (no bio/photo/username/post/" +
  "story/highlight changes) — it only records advice for the user to apply manually, and never fabricates " +
  "Instagram data (highlight covers, post grid visuals, photo quality) this app has no real API access to. " +
  "get_ad_evaluation_context/save_ad_evaluation/get_latest_ad_evaluation support Reklam Değerlendirme " +
  "(evaluating an ALREADY-RUNNING Meta Ads campaign's real performance against its approved ad strategy — " +
  "never a new strategy): get_ad_evaluation_context returns the real campaign, already-synced Meta metrics " +
  "(never a fabricated zero for missing data), active strategy, latest creative report and prior evaluations " +
  "needed before evaluating; save_ad_evaluation must be called ONLY after the user explicitly says something " +
  "like 'sisteme kaydet' / 'HK Dijital'e kaydet' / 'raporu kaydet' — never after showing the analysis alone — " +
  "and persists ONE ad_evaluations row holding both internalReport and clientReport together, then generates " +
  "and privately stores all four report files (internal/client PDF+DOCX) before confirming success, reading " +
  "the saved row back to verify; get_latest_ad_evaluation reads back a compact summary of the latest saved " +
  "evaluation for a company/campaign. These tools never modify any real ad account, campaign, or budget. " +
  "get_lead_instagram_evaluation_context/save_lead_instagram_evaluation/get_lead_instagram_evaluations support " +
  "Instagram Değerlendirme for a registered CRM lead (a prospect NOT yet an existing customer) — distinct from " +
  "get_instagram_profile_audit_context/save_instagram_profile_audit above, which is only for an existing " +
  "customer's own OAuth-connected Instagram. A lead has no connected account, so only public Instagram/web " +
  "research applies; private Insights-only metrics (reach, impressions, profile visits, messages, leads, " +
  "sales, revenue, story views) must never be fabricated for a lead. These three tools write into the exact " +
  "same manual_evaluations row HK Admin's own \"+ Manuel Değerlendirme\" button already uses for the " +
  "`instagram` module, so a row saved here shows up identically in HK Admin's own history/export screens. " +
  "save_lead_instagram_evaluation must be called ONLY after the user explicitly says to save it — analyzing " +
  "or discussing the lead's Instagram alone is never itself a save instruction, and it never converts the " +
  "lead into a customer or modifies its actual Instagram account. " +
  "get_company_logo_status/discover_company_logo manage a business's logo for PDF report covers: only a VERIFIED " +
  "logo is ever printed next to HK Dijital's; discover_company_logo either reads the business's own recorded " +
  "website or stores an official logo URL you found as PENDING_REVIEW for a person to approve — it never " +
  "verifies a logo on your word, never replaces an approved logo and never uses generic search-engine images.";

function toolResult(payload: { success: boolean; data: unknown; error: unknown }) {
  const clean = sanitize(payload) as Record<string, unknown>;
  return { content: [{ type: "text" as const, text: JSON.stringify(clean) }], structuredContent: clean, isError: payload.success === false };
}

export function createInstagramIntelligenceMcpServer() {
  const server = new Server(SERVER_INFO, { capabilities: { tools: {} }, instructions: SERVER_INSTRUCTIONS });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema }))
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const tool = toolByName(request.params.name);
      const args = validateArguments(tool, request.params.arguments ?? {});
      return toolResult(success(await execute(tool.name, args)));
    } catch (error) {
      return toolResult(failure(error));
    }
  });

  return server;
}

export { ControlError };
