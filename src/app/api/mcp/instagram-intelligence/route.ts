import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { safeCompare } from "@/lib/secure-compare";
import { createInstagramIntelligenceMcpServer } from "@/lib/instagram-intelligence/mcp/server";

// Remote MCP endpoint for the "Instagram Intelligence" Claude Custom
// Connector — a small, purpose-built surface (6 tools, see ../../../lib/
// instagram-intelligence/mcp/protocol.ts) reusing the existing Instagram
// OAuth/token layer, the existing Instagram Intelligence analysis engine,
// and the existing İçerik Takip read/write logic. This route adds no new
// Instagram capability and no AI provider — it only exposes what already
// exists through the MCP wire protocol.
//
// Deliberately separate from Social Autopilot's own MCP connector
// (mcp/server.mts, a standalone stdio/local-HTTP process): this one runs
// as an ordinary Next.js route so it deploys with the rest of the app on
// Vercel and is reachable at a real public HTTPS URL, which is what a
// Claude.ai Custom Connector needs. Stateless mode (sessionIdGenerator:
// undefined) is used deliberately — a serverless function instance is not
// guaranteed to survive between requests, so no MCP session state is kept
// in memory across calls; each request is handled independently, exactly
// as the SDK's stateless mode is designed for.
//
// Two compatibility fixes found while diagnosing "Couldn't reach..." from
// Claude.ai's connector UI:
//   1. GET is intentionally NOT wired to the transport. The Streamable
//      HTTP spec treats GET as opening an optional, long-lived standalone
//      SSE stream for server-initiated pushes; this connector never sends
//      any (all 6 tools are plain request/response, no notifications) but
//      the transport doesn't know that — an authenticated GET with
//      `Accept: text/event-stream` opens a stream that never closes,
//      which hangs a serverless function until Vercel's own timeout kills
//      it (verified: reproduced a 15s+ hang against production). Since
//      supporting the GET stream is optional per spec, GET instead
//      returns a fast, real, non-streaming status response.
//   2. CORS headers were entirely absent. If the connector's reachability
//      check runs from the claude.ai origin in a browser context, a
//      missing Access-Control-Allow-Origin fails the request before
//      Claude's own JS ever sees the real HTTP response — which reads to
//      the user as exactly "Couldn't reach..." with no further detail.
//      Real access control here is the bearer secret, not CORS (CORS only
//      restricts browser JS; a wildcard origin reveals nothing that a
//      direct server-to-server call couldn't already reach), so an open
//      Access-Control-Allow-Origin is safe.
//
// Auth: a single static bearer secret (INSTAGRAM_MCP_AUTH_SECRET),
// configured as the connector's Authorization header on claude.ai — the
// same bearer-secret pattern already used by Social Autopilot's own HTTP
// MCP transport (SOCIAL_MCP_AUTH_SECRET), reused here as a second,
// independent secret so the two connectors' trust boundaries never mix.
// Never a Supabase key or Instagram token — those stay server-side inside
// the reused lib functions and are never returned to the client (see
// control/protocol.ts's sanitize(), applied to every tool result).

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Max-Age": "86400"
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function jsonResponse(status: number, body: unknown): Response {
  return withCors(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }));
}

function checkAuth(request: Request): Response | null {
  const secret = process.env.INSTAGRAM_MCP_AUTH_SECRET || "";
  if (secret.length < 32) return jsonResponse(501, { error: "INSTAGRAM_MCP_AUTH_SECRET yapılandırılmadı (en az 32 karakter gerekir)." });
  if (!safeCompare(request.headers.get("authorization"), `Bearer ${secret}`)) return jsonResponse(401, { error: "Yetkisiz erişim." });
  return null;
}

export async function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}

export async function GET(request: Request) {
  const authError = checkAuth(request);
  if (authError) return authError;
  // No server-initiated notifications exist on this connector, so the
  // optional standalone SSE stream (what a bare GET would otherwise open)
  // is deliberately not supported — see the file-level comment.
  return jsonResponse(200, { status: "ok", server: "hk-dijital-instagram-intelligence", transport: "streamable-http (POST only; GET does not open a stream)" });
}

export async function POST(request: Request) {
  const authError = checkAuth(request);
  if (authError) return authError;
  try {
    const server = createInstagramIntelligenceMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    return withCors(response);
  } catch (error) {
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Sunucu hatası." });
  }
}

export async function DELETE(request: Request) {
  const authError = checkAuth(request);
  if (authError) return authError;
  try {
    const server = createInstagramIntelligenceMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    return withCors(response);
  } catch (error) {
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Sunucu hatası." });
  }
}
