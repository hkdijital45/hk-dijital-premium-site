#!/usr/bin/env node
// Release-check for required/optional environment variables. Never prints
// secret values — only names, presence, and safety classification.
//
// Usage:
//   npm run validate:env                 (development-friendly: warns only)
//   npm run validate:env -- --production (strict: exits non-zero on any
//                                          release-blocking failure)

export {}; // force module scope so top-level names never collide with other standalone scripts

const strictMode = process.argv.includes("--production") || process.env.NODE_ENV === "production";

type Requirement = {
  keys: string[];
  reason: string;
  requiredInStrict: boolean;
};

// Groups of "at least one of these must be set" — matches how the app's own
// code actually falls back across multiple env vars (see src/lib/session-token.ts,
// src/lib/customer-integration-oauth.ts, src/lib/business-flow.ts).
const REQUIREMENTS: Requirement[] = [
  { keys: ["NEXT_PUBLIC_SUPABASE_URL"], reason: "Supabase REST/Auth/Storage base URL — required for any real data flow.", requiredInStrict: true },
  { keys: ["NEXT_PUBLIC_SUPABASE_ANON_KEY"], reason: "Supabase anonymous key — required for the browser-safe Supabase surface.", requiredInStrict: true },
  { keys: ["SUPABASE_SERVICE_ROLE_KEY"], reason: "Server-only Supabase key — required for every server-side data operation in this app.", requiredInStrict: true },
  {
    keys: ["ADMIN_SESSION_SECRET", "SUPABASE_SERVICE_ROLE_KEY"],
    reason: "Session-cookie signing secret — without one of these, session-token.ts refuses to sign/verify sessions in production (by design, see Sprint C).",
    requiredInStrict: true
  },
  {
    keys: ["OAUTH_STATE_SECRET", "NEXTAUTH_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "META_APP_SECRET", "META_CLIENT_SECRET"],
    reason: "OAuth state/session signing secret — without one of these, customer-integration-oauth.ts refuses to sign/verify OAuth state in production.",
    requiredInStrict: false // already covered by SUPABASE_SERVICE_ROLE_KEY above in virtually every real deployment; not independently release-blocking.
  }
];

// Optional integrations: only relevant if the feature is actually configured
// (i.e. some other var in the same group is present). Never required globally.
const OPTIONAL_INTEGRATIONS: Array<{ name: string; keys: string[] }> = [
  { name: "Cron/scheduled routes", keys: ["CRON_SECRET", "AGENT_HUB_CRON_SECRET", "BLOG_SEO_CRON_SECRET"] },
  { name: "Bootstrap admin repair route", keys: ["BOOTSTRAP_ADMIN_SECRET"] },
  { name: "AI providers", keys: ["OPENAI_API_KEY", "GROQ_API_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY", "MANUS_API_KEY", "OLLAMA_BASE_URL"] },
  { name: "Meta integration", keys: ["META_APP_ID", "META_APP_SECRET", "META_ACCESS_TOKEN"] },
  { name: "Google Ads/Analytics integration", keys: ["GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_SERVICE_ACCOUNT_EMAIL"] },
  { name: "Email delivery", keys: ["RESEND_API_KEY", "SMTP_HOST"] },
  { name: "Integration token encryption", keys: ["INTEGRATION_TOKEN_SECRET", "INTEGRATION_ENCRYPTION_KEY"] }
];

// Values that must never be used as a real secret in production — matches the
// exact hardcoded fallback strings the app's own code refuses to use once a
// real secret is configured (session-token.ts, customer-integration-oauth.ts,
// business-flow.ts, secret-storage.ts).
const KNOWN_UNSAFE_VALUES = new Set([
  "local-development-session-secret",
  "hk-dijital-local-oauth-state",
  "local-integration-secret",
  "replace-with-a-long-random-secret",
  "changeme",
  "change-me",
  "secret",
  "password",
  "test"
]);

// Known-legitimate public variables (client bundle exposure is intentional).
const SAFE_PUBLIC_PREFIXES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_META_PIXEL_ID",
  "NEXT_PUBLIC_GA_MEASUREMENT_ID",
  "NEXT_PUBLIC_GTM_ID"
];
const SENSITIVE_NAME_PATTERN = /secret|service_role|private_key|token|password|api_key|client_secret/i;

let failures = 0;
let warnings = 0;

function fail(message: string) {
  failures += 1;
  console.error(`✖ ${message}`);
}

function warn(message: string) {
  warnings += 1;
  console.warn(`⚠ ${message}`);
}

function ok(message: string) {
  console.log(`✓ ${message}`);
}

console.log(`\nHK Dijital — environment validation (${strictMode ? "production/strict mode" : "development mode"})\n`);

for (const requirement of REQUIREMENTS) {
  const configuredKey = requirement.keys.find((key) => Boolean(process.env[key]));
  if (configuredKey) {
    const value = process.env[configuredKey] || "";
    if (KNOWN_UNSAFE_VALUES.has(value.trim().toLowerCase())) {
      fail(`${configuredKey} is set to a known-unsafe/placeholder value. ${requirement.reason}`);
    } else {
      ok(`${requirement.keys.join(" / ")} — satisfied via ${configuredKey}`);
    }
  } else if (requirement.requiredInStrict) {
    const message = `None of [${requirement.keys.join(", ")}] are set. ${requirement.reason}`;
    if (strictMode) fail(message);
    else warn(message);
  } else {
    warn(`None of [${requirement.keys.join(", ")}] are set (not independently release-blocking). ${requirement.reason}`);
  }
}

console.log("");
for (const integration of OPTIONAL_INTEGRATIONS) {
  const configured = integration.keys.filter((key) => Boolean(process.env[key]));
  if (configured.length) {
    ok(`${integration.name}: configured (${configured.length}/${integration.keys.length} related vars set)`);
  } else {
    console.log(`… ${integration.name}: not configured — optional, skipping (feature will be inactive, not an error).`);
  }
}

console.log("");
for (const [key, value] of Object.entries(process.env)) {
  if (!key.startsWith("NEXT_PUBLIC_") || !value) continue;
  if (SAFE_PUBLIC_PREFIXES.includes(key)) continue;
  if (SENSITIVE_NAME_PATTERN.test(key)) {
    fail(`${key} looks like a secret but is prefixed NEXT_PUBLIC_, which exposes it to the browser bundle. Rename it to a server-only variable.`);
  }
}

console.log(`\n${failures} release-blocking failure(s), ${warnings} warning(s).\n`);

if (strictMode && failures > 0) {
  process.exit(1);
}
process.exit(0);
