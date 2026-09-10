// Builds the actual MCP `Server` (transport-agnostic — see mcp/server.ts at
// the repo root for the stdio/HTTP process entry that connects a transport
// to this). Uses the LOW-LEVEL @modelcontextprotocol/sdk Server API rather
// than the high-level McpServer/registerTool convenience wrapper: the
// existing tool catalogue (../control/protocol.ts) already describes each
// tool's inputSchema as plain JSON Schema — exactly what the MCP wire
// protocol expects for `tools/list` — so handing it through directly avoids
// a lossy JSON-Schema<->Zod conversion layer for no benefit.
//
// This file is the ONLY place that adapts between the MCP protocol and this
// application's Social Autopilot business logic. It calls nothing except:
//   - ../control/protocol.ts's tool catalogue/validator/sanitizer (the exact
//     same ones any other future control surface would use), and
//   - an injected `execute(name, args)` — in production this is
//     ../control/services.ts's execute(), the single dispatcher. No
//     Instagram/DB/renderer logic lives here — no second copy of the
//     Social Autopilot business logic is created.
import { createHash } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListResourcesRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { authorizeConnectorTool, ControlError, failure, sanitize, success, tools, validateArguments } from "./protocol";
import type { Mode } from "./protocol";

export type ExecuteFn = (name: string, args: Record<string, unknown>) => Promise<unknown>;

const SERVER_INFO = { name: "hk-dijital-social-autopilot", version: "1.0.0" };
const SERVER_INSTRUCTIONS =
  "Secure Instagram analytics, content, publishing and autopilot tools for HK Dijital's Social Autopilot module. " +
  "READ_ONLY tools are always safe to call. WRITE_SAFE tools generate/render/schedule but never publish. " +
  "WRITE_PUBLISH tools (publish now, resume autopilot, run the daily cycle) only succeed when this connector " +
  "is configured in FULL_CONTROL mode AND the application's own production/test-mode safety checks pass — " +
  "a refusal from one of those is expected and correct in development. Use autopilot_get_readiness or the " +
  "health://status resource before relying on any write tool. Content ids are this application's own content " +
  "UUIDs, not Instagram's media ids.";

// MCP tool calls carry no client-supplied idempotency key. This is a
// best-effort guard against a client retrying an identical mutating call
// within a few seconds; the durable protection against actually publishing
// something twice remains the database-level queue locking in
// ../publish-queue.ts, unchanged by this.
const DEDUPE_WINDOW_MS = 5000;
const MAX_TRACKED_KEYS = 5000;

function toolResult(payload: { success: boolean; data: unknown; error: unknown }) {
  const clean = sanitize(payload) as Record<string, unknown>;
  return { content: [{ type: "text" as const, text: JSON.stringify(clean) }], structuredContent: clean, isError: payload.success === false };
}

export function createMcpConnectorServer(mode: Mode, execute: ExecuteFn) {
  const server = new Server(SERVER_INFO, { capabilities: { tools: {}, resources: {} }, instructions: SERVER_INSTRUCTIONS });
  const recentWrites = new Map<string, number>();

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema }))
  }));

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [{
      uri: "health://status",
      name: "HK Social Autopilot Health",
      description: "Database, Instagram connection/permissions, storage, renderer, scheduler, publish queue and analytics readiness (READY/WARNING/NOT_READY per component).",
      mimeType: "application/json"
    }]
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    if (request.params.uri !== "health://status") throw new ControlError("NOT_FOUND", "Unknown resource.", 404);
    const data = sanitize(await execute("health", {}));
    return { contents: [{ uri: "health://status", mimeType: "application/json", text: JSON.stringify(data) }] };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const tool = tools.find((candidate) => candidate.name === request.params.name);
      if (!tool) throw new ControlError("UNKNOWN_TOOL", "Unknown tool.", 404);
      authorizeConnectorTool(tool, mode);
      const args = validateArguments(tool, request.params.arguments ?? {});

      if (tool.permission !== "READ_ONLY") {
        const dedupeKey = `${tool.name}:${createHash("sha256").update(JSON.stringify(args)).digest("hex")}`;
        const now = Date.now();
        const last = recentWrites.get(dedupeKey);
        if (last !== undefined && now - last < DEDUPE_WINDOW_MS) {
          throw new ControlError("DUPLICATE_REQUEST", "Identical write call repeated too quickly. Check the resulting state (e.g. content_get_today, instagram_get_publish_queue) before retrying.", 409);
        }
        recentWrites.set(dedupeKey, now);
        if (recentWrites.size > MAX_TRACKED_KEYS) for (const [key, seenAt] of recentWrites) if (now - seenAt > DEDUPE_WINDOW_MS) recentWrites.delete(key);
      }

      return toolResult(success(await execute(tool.name, args)));
    } catch (error) {
      return toolResult(failure(error));
    }
  });

  return server;
}
