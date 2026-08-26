import { createSign } from "node:crypto";

// Google service-account OAuth2 (JWT Bearer flow), signed with Node's built-in
// crypto — no external dependency needed. This was previously the missing
// piece blocking both GA4 and Search Console from ever fetching real data
// (see google-analytics-server.ts's buildGoogleAuthHeaders(), which still
// returns "Google OAuth JWT imzalama bağımlılığı eklenmeden..." — that
// message predates this file and is now stale for Search Console, which
// uses this helper instead).

type TokenResult = { ok: true; accessToken: string } | { ok: false; error: string };

const tokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function getGoogleServiceAccountCredentials() {
  const email = String(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim();
  const privateKey = String(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
  return { email, privateKey, ready: Boolean(email && privateKey.includes("BEGIN PRIVATE KEY")) };
}

export async function getGoogleServiceAccountAccessToken(scopes: string[]): Promise<TokenResult> {
  const { email, privateKey, ready } = getGoogleServiceAccountCredentials();
  if (!ready) return { ok: false, error: "Google servis hesabı e-postası veya private key eksik/geçersiz." };

  const cacheKey = `${email}:${scopes.slice().sort().join(",")}`;
  const now = Math.floor(Date.now() / 1000);
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt - 30 > now) return { ok: true, accessToken: cached.accessToken };

  try {
    const header = { alg: "RS256", typ: "JWT" };
    const claims = {
      iss: email,
      scope: scopes.join(" "),
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now
    };
    const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
    const signature = createSign("RSA-SHA256").update(signingInput).end().sign(privateKey);
    const assertion = `${signingInput}.${base64url(signature)}`;

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion
      }).toString()
    });

    const payload = await response.json().catch(() => ({} as Record<string, unknown>));
    if (!response.ok || !payload.access_token) {
      const detail = String(payload.error_description || payload.error || `HTTP ${response.status}`);
      return { ok: false, error: `Google OAuth token isteği başarısız: ${detail}` };
    }

    const accessToken = String(payload.access_token);
    tokenCache.set(cacheKey, { accessToken, expiresAt: now + Number(payload.expires_in || 3600) });
    return { ok: true, accessToken };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Google OAuth token üretimi sırasında beklenmeyen hata." };
  }
}
