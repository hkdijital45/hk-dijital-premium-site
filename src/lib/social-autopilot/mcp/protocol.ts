// Claude MCP connector — configuration and authorization layer. A thin,
// connector-specific counterpart to ../control/protocol.ts: the tool
// catalogue, argument validation, secret sanitization and bearer-auth
// comparison are all reused verbatim from there, so the connector can never
// drift into inconsistent permission/validation behavior. Only the pieces
// genuinely specific to running as an MCP connector — its own env-driven
// config and its own operating-mode gate — live here.
import { authenticate, ControlError, failure, sanitize, success, tools, validateArguments } from "../control/protocol";
import type { Mode, Permission, Tool } from "../control/protocol";

export { authenticate, ControlError, failure, sanitize, success, tools, validateArguments };
export type { Mode, Permission, Tool };

export type ConnectorTransport = "stdio" | "http";

export type ConnectorConfig = {
  transport: ConnectorTransport;
  mode: Mode;
  host: string;
  port: number;
  secret: string;
  publicBaseUrl: string | null;
};

/** Reads SOCIAL_MCP_* env vars (see .env.example). Fails closed: an invalid
 * or missing value throws rather than silently falling back to something
 * permissive. secret is only required (and only checked) for the HTTP
 * transport — stdio's trust boundary is the OS process-spawn relationship
 * with the MCP client, not a bearer token, matching how every other stdio
 * MCP server works. */
export function connectorConfig(env: Record<string, string | undefined> = process.env): ConnectorConfig {
  const transport = (env.SOCIAL_MCP_TRANSPORT || "stdio") as ConnectorTransport;
  if (transport !== "stdio" && transport !== "http") throw new ControlError("INVALID_CONFIG", 'SOCIAL_MCP_TRANSPORT must be "stdio" or "http".');

  const mode = (env.SOCIAL_MCP_MODE || "ASSISTED") as Mode;
  if (!["READ_ONLY", "ASSISTED", "FULL_CONTROL"].includes(mode)) throw new ControlError("INVALID_CONFIG", "SOCIAL_MCP_MODE must be READ_ONLY, ASSISTED or FULL_CONTROL.");

  const host = env.SOCIAL_MCP_HOST || "127.0.0.1";
  const port = Number(env.SOCIAL_MCP_PORT || 3300);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ControlError("INVALID_CONFIG", "Invalid SOCIAL_MCP_PORT.");

  if (transport === "http" && (!env.SOCIAL_MCP_AUTH_SECRET || env.SOCIAL_MCP_AUTH_SECRET.length < 32)) {
    throw new ControlError("INVALID_CONFIG", "Set SOCIAL_MCP_AUTH_SECRET to at least 32 random characters for the HTTP transport.");
  }

  return { transport, mode, host, port, secret: env.SOCIAL_MCP_AUTH_SECRET || "", publicBaseUrl: env.SOCIAL_MCP_PUBLIC_BASE_URL || null };
}

/** Connector-specific permission gate. WRITE_PUBLISH requires FULL_CONTROL
 * connector mode; the actual production/test-mode/emergency-pause/readiness
 * gates are enforced a second time, independently, inside
 * ../control/services.ts's execute() (via publicationAllowed()/
 * computeReadinessReport()) — the SAME checks every other caller of
 * execute() goes through, connector or not. This function only decides
 * whether THIS connector, in its OWN configured mode, is even allowed to
 * attempt the call. */
export function authorizeConnectorTool(tool: Tool, mode: Mode) {
  if (tool.permission !== "READ_ONLY" && mode === "READ_ONLY") {
    throw new ControlError("READ_ONLY", "Writes are disabled in READ_ONLY connector mode.", 403);
  }
  if (tool.permission === "WRITE_PUBLISH" && mode !== "FULL_CONTROL") {
    throw new ControlError(
      "PUBLISH_DISABLED",
      "FULL_CONTROL connector mode is required for publish/resume/daily-cycle tools. Application-wide production safety checks (NODE_ENV, INSTAGRAM_PUBLISH_ENABLED, social_autopilot_settings.test_mode/emergency_pause) are enforced separately and still apply.",
      403
    );
  }
}
