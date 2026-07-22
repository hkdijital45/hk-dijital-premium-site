#!/usr/bin/env node
export {}; // force module scope

// Reusable deployment verification. Never prints secret values.
//
// Two independent things it can check, depending on what's available:
//   1. Public production smoke test against the canonical domain — always
//      runs, needs no credentials.
//   2. Commit-level deployment verification via the Vercel API — only runs
//      if VERCEL_TOKEN (and optionally VERCEL_PROJECT_ID) are supplied. This
//      is the only way to prove a specific commit SHA is what's actually
//      serving production; a `git push` alone does not prove this.
//
// Usage:
//   npm run validate:deployment                          (smoke test only)
//   VERCEL_TOKEN=... npm run validate:deployment -- --sha <commit-sha>

const PRODUCTION_DOMAIN = "https://www.hkdijital.com.tr";
const PUBLIC_ROUTES = ["/", "/hakkimda", "/hizmetler", "/paketler", "/blog", "/iletisim", "/giris"];

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

async function smokeTest() {
  console.log(`\nPublic production smoke test — ${PRODUCTION_DOMAIN}\n`);
  for (const path of PUBLIC_ROUTES) {
    try {
      const response = await fetch(`${PRODUCTION_DOMAIN}${path}`, { redirect: "manual" });
      const isRedirect = response.status >= 300 && response.status < 400;
      const isOk = response.status < 400;
      if (isOk) ok(`${path} -> HTTP ${response.status}${isRedirect ? ` (redirect to ${response.headers.get("location") || "?"})` : ""}`);
      else fail(`${path} -> HTTP ${response.status}`);
      const server = response.headers.get("server");
      if (path === "/" && server) info(`Deployment platform header: server=${server}`);
    } catch (error) {
      fail(`${path} -> request failed: ${error instanceof Error ? error.message : "unknown network error"}`);
    }
  }

  try {
    const response = await fetch(PRODUCTION_DOMAIN);
    const html = await response.text();
    if (html.includes("11245911.com")) fail("Homepage HTML references the deprecated domain 11245911.com.");
    else ok("Homepage HTML does not reference 11245911.com.");
    if (/http:\/\/localhost/i.test(html)) fail("Homepage HTML hardcodes a localhost URL.");
    else ok("Homepage HTML does not hardcode a localhost URL.");
  } catch (error) {
    fail(`Could not fetch homepage HTML for content checks: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

async function commitVerification() {
  const token = process.env.VERCEL_TOKEN;
  const shaFlagIndex = process.argv.indexOf("--sha");
  const targetSha = shaFlagIndex >= 0 ? process.argv[shaFlagIndex + 1] : undefined;

  console.log("\nCommit-level deployment verification (Vercel API)\n");
  if (!token) {
    info("VERCEL_TOKEN not supplied — SKIPPED. A git push is not proof of deployment; run this with a Vercel token and --sha <commit> to confirm the live deployment matches a specific commit.");
    return;
  }
  if (!targetSha) {
    info("No --sha <commit-sha> supplied — SKIPPED commit match check (token is present, but nothing to compare against).");
    return;
  }

  try {
    const projectQuery = process.env.VERCEL_PROJECT_ID ? `&projectId=${encodeURIComponent(process.env.VERCEL_PROJECT_ID)}` : "";
    const response = await fetch(`https://api.vercel.com/v6/deployments?limit=5${projectQuery}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      fail(`Vercel API request failed: HTTP ${response.status}`);
      return;
    }
    const data = await response.json();
    const deployments = Array.isArray(data.deployments) ? data.deployments : [];
    const match = deployments.find((deployment: any) => deployment.meta?.githubCommitSha === targetSha || deployment.meta?.gitCommitSha === targetSha);
    if (!match) {
      fail(`No deployment found matching commit ${targetSha} in the last ${deployments.length} deployments.`);
      return;
    }
    if (match.readyState !== "READY") {
      fail(`Deployment for commit ${targetSha} exists but is in state "${match.readyState}", not READY.`);
      return;
    }
    ok(`Deployment for commit ${targetSha} is READY (url: ${match.url}).`);
  } catch (error) {
    fail(`Vercel API check failed: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

async function main() {
  await smokeTest();
  await commitVerification();
  console.log(`\n${failures} failure(s).\n`);
  process.exit(failures > 0 ? 1 : 0);
}

main();
