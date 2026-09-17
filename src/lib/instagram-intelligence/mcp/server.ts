// Builds the MCP `Server` for the Instagram Intelligence Claude Custom
// Connector. Mirrors ../../social-autopilot/mcp/server.ts's structure
// (same low-level @modelcontextprotocol/sdk Server API, same tool-catalogue
// -> JSON Schema passthrough) but wired to this connector's own, much
// smaller tool set. No Instagram/DB logic lives here — only the adapter
// between the MCP wire protocol and ./protocol.ts's execute().
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { ControlError, failure, sanitize, success, tools, toolByName, validateArguments, execute } from "./protocol";

const SERVER_INFO = { name: "hk-dijital-instagram-intelligence", version: "1.0.0" };
const SERVER_INSTRUCTIONS =
  "Read-only Instagram Intelligence tools for HK Dijital. get_instagram_account/get_instagram_analysis/" +
  "get_instagram_recent_posts read the real, already-connected Instagram account (Graph API) — never " +
  "publish, edit, schedule, or delete anything on Instagram. get_content_tracking_history/" +
  "get_upcoming_content_plan read İçerik Takip (the manual content tracker). create_content_plan is the " +
  "only write tool: it appends planning rows to İçerik Takip, never Instagram — it is duplicate-safe " +
  "(same date+topic is skipped, never re-inserted) and never touches existing rows.";

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
