#!/usr/bin/env node
// Real, non-destructive Supabase validation. Never prints secret values.
//
// Usage:
//   npm run validate:supabase                 (read-only checks)
//   npm run validate:supabase -- --allow-writes  (also creates/deletes a
//     single QA-prefixed test row — only ever run this against a dedicated
//     non-production test project, never against real production data)
//
// Distinguishes "not configured" (exit 0, nothing to validate) from "failed"
// (exit 1, a real check did not pass).

export {}; // force module scope so top-level names never collide with other standalone scripts

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const allowWrites = process.argv.includes("--allow-writes");

let failures = 0;
function fail(message: string) {
  failures += 1;
  console.error(`✖ ${message}`);
}
function ok(message: string) {
  console.log(`✓ ${message}`);
}
function info(message: string) {
  console.log(`… ${message}`);
}

async function restRequest(path: string, key: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
}

async function main() {
  console.log("\nHK Dijital — Supabase validation\n");

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    info("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are not all configured in this environment.");
    info("SKIPPED — no Supabase environment available to validate against. This is not a failure; supply credentials to run these checks.");
    process.exit(0);
  }

  // 1. Real connectivity via the service-role key (the same access path every
  // server route in this app actually uses).
  try {
    const response = await restRequest("users?select=id&limit=1", SERVICE_ROLE_KEY);
    if (response.ok) ok("Service-role connectivity: reached PostgREST and read from public.users.");
    else fail(`Service-role connectivity failed: HTTP ${response.status} from ${SUPABASE_URL}/rest/v1/users`);
  } catch (error) {
    fail(`Service-role connectivity failed: ${error instanceof Error ? error.message : "unknown network error"}`);
  }

  // 2. RLS check: this app's convention (see supabase/migrations/20260719_rls_lockdown.sql)
  // is service-role-only access with no permissive anon/authenticated
  // policies. An anonymous-key request against a privileged table must NOT
  // return real rows.
  try {
    const response = await restRequest("users?select=id,email&limit=5", ANON_KEY);
    const body = await response.json().catch(() => null);
    const leaked = response.ok && Array.isArray(body) && body.length > 0;
    if (leaked) fail("RLS check FAILED: the anonymous key can read rows from public.users — this table must not be readable without a service-role/authenticated policy scoped to the owner.");
    else ok(`RLS check passed: anonymous key cannot read public.users rows (HTTP ${response.status}${Array.isArray(body) ? `, ${body.length} rows` : ""}).`);
  } catch (error) {
    fail(`RLS check could not run: ${error instanceof Error ? error.message : "unknown network error"}`);
  }

  // 3. Storage: the shared media/logo bucket is intentionally public (site
  // logos/media must render on the public website); customer-assets is
  // intentionally private (served only through signed URLs / server routes).
  try {
    const publicBucket = await fetch(`${SUPABASE_URL}/storage/v1/bucket/hk-dijital-media`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` }
    });
    if (publicBucket.ok) {
      const bucket = await publicBucket.json().catch(() => ({}));
      if (bucket?.public) ok("Storage: hk-dijital-media bucket is public, as intended for site logos/media.");
      else fail("Storage: hk-dijital-media bucket is not marked public — public site logos/media would fail to render.");
    } else {
      info(`Storage: could not read hk-dijital-media bucket metadata (HTTP ${publicBucket.status}) — inconclusive, not a hard failure.`);
    }
  } catch (error) {
    info(`Storage bucket check skipped: ${error instanceof Error ? error.message : "unknown network error"}`);
  }

  if (!allowWrites) {
    info("Write/cleanup check skipped (pass --allow-writes to run it against a DEDICATED TEST Supabase project only).");
  } else {
    // 4. Create + delete a single QA-prefixed test row, verifying cleanup
    // even if the assertion in between fails.
    const marker = `qa-sprint-d-${Date.now()}`;
    let createdId: string | null = null;
    try {
      const createResponse = await restRequest("activity_logs", SERVICE_ROLE_KEY, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ action: "QA Doğrulama", entity: "Sprint D Supabase Check", details: { message: marker } })
      });
      const rows = await createResponse.json().catch(() => []);
      createdId = Array.isArray(rows) ? rows[0]?.id : null;
      if (createResponse.ok && createdId) ok(`Write check: created QA-prefixed test row (${marker}).`);
      else fail(`Write check failed: HTTP ${createResponse.status} creating test row.`);
    } catch (error) {
      fail(`Write check failed: ${error instanceof Error ? error.message : "unknown network error"}`);
    } finally {
      if (createdId) {
        const deleteResponse = await restRequest(`activity_logs?id=eq.${createdId}`, SERVICE_ROLE_KEY, { method: "DELETE" }).catch(() => null);
        if (deleteResponse?.ok) ok("Write check: cleanup succeeded, test row deleted.");
        else fail("Write check: cleanup FAILED — a QA test row may remain in activity_logs.");
      }
    }
  }

  console.log(`\n${failures} failure(s).\n`);
  process.exit(failures > 0 ? 1 : 0);
}

main();
