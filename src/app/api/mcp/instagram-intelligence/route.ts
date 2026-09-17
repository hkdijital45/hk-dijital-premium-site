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
// Auth: a single static bearer secret (INSTAGRAM_MCP_AUTH_SECRET),
// configured as the connector's Authorization header on claude.ai — the
// same bearer-secret pattern already used by Social Autopilot's own HTTP
// MCP transport (SOCIAL_MCP_AUTH_SECRET), reused here as a second,
// independent secret so the two connectors' trust boundaries never mix.
// Never a Supabase key or Instagram token — those stay server-side inside
// the reused lib functions and are never returned to the client (see
// control/protocol.ts's sanitize(), applied to every tool result).

function unauthorized(message: string) {
  return new Response(JSON.stringify({ error: message }), { status: 401, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

function notConfigured() {
  return new Response(JSON.stringify({ error: "INSTAGRAM_MCP_AUTH_SECRET yapılandırılmadı (en az 32 karakter gerekir)." }), { status: 501, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

async function handle(request: Request): Promise<Response> {
  const secret = process.env.INSTAGRAM_MCP_AUTH_SECRET || "";
  if (secret.length < 32) return notConfigured();

  const authHeader = request.headers.get("authorization");
  if (!safeCompare(authHeader, `Bearer ${secret}`)) return unauthorized("Yetkisiz erişim.");

  const server = createInstagramIntelligenceMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function POST(request: Request) { return handle(request); }
export async function GET(request: Request) { return handle(request); }
export async function DELETE(request: Request) { return handle(request); }
