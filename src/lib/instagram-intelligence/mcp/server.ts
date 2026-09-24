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
const SERVER_INFO = { name: "hk-dijital-instagram-intelligence", version: "1.6.0" };
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
  "get_instagram_profile_audit_context/save_instagram_profile_audit/get_instagram_profile_audits support " +
  "Instagram Profil Optimizasyonu (post-sale profile-quality consulting for an existing customer's own " +
  "connected Instagram): get_instagram_profile_audit_context returns the real company + connected Instagram " +
  "username/status + the last saved audit; save_instagram_profile_audit persists an explicitly-approved " +
  "report as a NEW history row (never overwrites) — call it only after the user explicitly says to save it, " +
  "never after showing the analysis alone; get_instagram_profile_audits reads back the history list or one " +
  "full report. This never modifies the customer's actual Instagram account (no bio/photo/username/post/" +
  "story/highlight changes) — it only records advice for the user to apply manually, and never fabricates " +
  "Instagram data (highlight covers, post grid visuals, photo quality) this app has no real API access to.";

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
