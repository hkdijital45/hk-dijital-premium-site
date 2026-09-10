// HK Dijital Social Autopilot — Claude MCP connector process entry. Run
// with:
//   npm run mcp        (stdio — Claude Desktop / Claude Code local config)
//   npm run mcp:http    (Streamable HTTP — local testing or a real remote
//                        deployment)
// Unlike a plain Next.js request, this is a standalone Node process, so it
// loads .env.local/.env itself before importing anything that reads
// process.env (Supabase URL/keys, Meta app credentials, encryption key).
//
// The "mcp"/"mcp:http" npm scripts run this with `--conditions=react-server`:
// the Social Autopilot business logic reuses HK Admin's existing AI-provider
// router (src/lib/agent-providers.ts), which transitively imports the
// "server-only" marker package. That package's default export throws
// outside a live Next.js server-component request; its "react-server"
// conditional export (used under this flag) is a no-op instead, which is
// what lets this plain Node process import the same server-only business
// logic the Next.js app and its cron routes use, unchanged.
// File extension note: this entry point uses top-level await, which esbuild
// (via tsx) refuses to emit as CommonJS. Since this repo's package.json has
// no "type": "module", a plain ".ts" extension here would be transpiled to
// CJS and fail; ".mts" forces tsx to always treat this specific file as ESM,
// regardless of the package.json "type" field.
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

const { connectorConfig, authenticate, ControlError, sanitize } = await import("../src/lib/social-autopilot/mcp/protocol");
const { createMcpConnectorServer } = await import("../src/lib/social-autopilot/mcp/server");

function errorBody(error: unknown) {
  return JSON.stringify(sanitize({
    success: false,
    data: null,
    error: {
      code: error instanceof ControlError ? error.code : "SERVER_ERROR",
      message: error instanceof ControlError ? error.message : "Request failed; check connector configuration.",
      retryable: false
    }
  }));
}

async function main() {
  const settings = connectorConfig();
  const { execute } = await import("../src/lib/social-autopilot/control/services");
  const server = createMcpConnectorServer(settings.mode, execute);

  if (settings.transport === "stdio") {
    const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
    await server.connect(new StdioServerTransport());
    // stdout is the MCP JSON-RPC channel — all diagnostic output goes to stderr.
    console.error(`HK Social Autopilot connector: stdio transport ready (${settings.mode} mode).`);
    return;
  }

  const { createServer } = await import("node:http");
  const { randomUUID } = await import("node:crypto");
  const { StreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server/streamableHttp.js");

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
  await server.connect(transport);

  const httpServer = createServer(async (req, res) => {
    try {
      // Loopback-only by default — an operator who deliberately sets
      // SOCIAL_MCP_HOST to something else (a real remote deployment) has
      // opted into that themselves; a reverse proxy's traffic will never
      // look like a loopback connection.
      if (settings.host === "127.0.0.1") {
        if (req.socket.localAddress !== "127.0.0.1" || req.socket.remoteAddress !== "127.0.0.1") {
          throw new ControlError("LOCAL_ONLY", "Loopback access only in local mode. Set SOCIAL_MCP_HOST/SOCIAL_MCP_PUBLIC_BASE_URL for a real remote deployment.", 403);
        }
        // A bearer secret alone doesn't stop a malicious page open in the
        // same browser from driving a request at 127.0.0.1 (the classic
        // "localhost drive-by"). Real MCP clients (Claude Desktop's
        // connector logic, curl, this project's own tooling) never send
        // Origin or Sec-Fetch-Site; only a browser context does — so reject
        // any request carrying either.
        if (req.headers.origin || req.headers["sec-fetch-site"] || req.headers.host !== `127.0.0.1:${req.socket.localPort}`) {
          throw new ControlError("LOCAL_ONLY", "Use the loopback address from a local non-browser client.", 403);
        }
      }
      authenticate(req.headers.authorization, settings.secret);
      if (req.url !== "/mcp") throw new ControlError("NOT_FOUND", "Unknown endpoint. The connector endpoint is /mcp.", 404);
      await transport.handleRequest(req, res);
    } catch (error) {
      if (res.headersSent) { res.end(); return; }
      res.writeHead(error instanceof ControlError ? error.status : 500, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(errorBody(error));
    }
  });

  httpServer.on("error", () => { console.error("HK Social Autopilot connector could not bind. Check SOCIAL_MCP_HOST/SOCIAL_MCP_PORT."); process.exitCode = 1; });
  httpServer.listen(settings.port, settings.host, () => {
    console.log(`HK Social Autopilot connector: http://${settings.host}:${settings.port}/mcp (${settings.mode})`);
    if (settings.publicBaseUrl) console.log(`Public endpoint (per SOCIAL_MCP_PUBLIC_BASE_URL): ${settings.publicBaseUrl.replace(/\/$/, "")}/mcp`);
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => { httpServer.close(); httpServer.closeAllConnections?.(); });
  }
}

main().catch((error) => {
  console.error("HK Social Autopilot connector failed to start. Check SOCIAL_MCP_* configuration (see .env.example).", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
