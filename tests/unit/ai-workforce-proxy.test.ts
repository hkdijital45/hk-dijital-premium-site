import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import type { NextRequest } from "next/server";
import * as schema from "../../src/lib/ai-workforce-schema.ts";
import * as tokens from "../../src/lib/session-token.ts";

const require = createRequire(import.meta.url);
const { NextRequest: RequestClass } = require("next/server");
const ts = require("typescript");

// Execute the actual proxy with real Next request/response and signed-cookie
// handling. Only the secret-session database lookup is replaced; no live writes.
function loadProxy(secretValid: boolean, privatePath = "private-entry") {
  const loadedModule = { exports: {} as { proxy: (request: NextRequest) => Promise<Response> } };
  const code = ts.transpileModule(readFileSync(new URL("../../src/proxy.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  runInNewContext(code, {
    module: loadedModule, exports: loadedModule.exports, URL,
    process: { env: { PRIVATE_ADMIN_LOGIN_PATH: privatePath } },
    require: (id: string) => {
      if (id === "@/lib/ai-workforce-schema") return schema;
      if (id === "@/lib/session-token") return tokens;
      if (id === "@/lib/hidden-access") return {
        HIDDEN_ACCESS_COOKIE: "hk_secret_access",
        findValidHiddenAccessSession: async () => secretValid ? { id: "test-session" } : null
      };
      return require(id);
    }
  });
  return loadedModule.exports.proxy;
}

async function request(path: string, options: { role?: "admin" | "customer"; secret?: boolean; valid?: boolean; host?: string; privatePath?: string } = {}) {
  const cookies = [];
  if (options.secret) cookies.push("hk_secret_access=test-only");
  if (options.role) cookies.push(`${tokens.authCookieName}=${tokens.encodeSession({ email: "test@example.test", role: options.role, fullName: "Test" })}`);
  const host = options.host || "ai.hkdijital.com.tr";
  return loadProxy(options.valid ?? true, options.privatePath)(new RequestClass(`https://${host}${path}`, {
    headers: { host, cookie: cookies.join("; ") }
  }));
}

for (const path of ["/hk-admin", "/ai-workforce", "/agents", "/digital-center", "/private-entry"]) {
  test(`anonymous ${path} stays secret-gated and terminates at the homepage`, async () => {
    const response = await request(path);
    assert.equal(response.status, 307);
    const target = new URL(response.headers.get("location")!);
    assert.equal(target.pathname, "/");
    assert.equal((await request(target.pathname + target.search)).headers.get("location"), null);
  });
}

test("secret access alone reaches the gated login screen instead of bouncing home", async () => {
  const response = await request("/ai-workforce", { secret: true });
  assert.equal(response.headers.get("location"), "https://ai.hkdijital.com.tr/digital-center");
  assert.equal((await request("/digital-center", { secret: true })).headers.get("x-middleware-next"), "1");
});

test("authenticated admin fallback renders /hk-admin without a product rewrite", async () => {
  const response = await request("/hk-admin", { role: "admin", secret: true });
  assert.equal(response.headers.get("x-middleware-next"), "1");
  assert.equal(response.headers.get("x-middleware-rewrite"), null);
});

test("authorized clean product URL retains query parameters", async () => {
  const response = await request("/agents?company=example", { role: "admin", secret: true });
  assert.equal(response.headers.get("x-middleware-rewrite"), "https://ai.hkdijital.com.tr/ai-workforce/agents?company=example");
});

test("admin cookie alone, revoked/expired secret sessions and customer roles cannot open AI", async () => {
  for (const options of [{ role: "admin" as const }, { role: "admin" as const, secret: true, valid: false }, { role: "customer" as const, secret: true }]) {
    const response = await request("/agents", options);
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("x-middleware-rewrite"), null);
  }
});

test("root only rewrites with both admin and secret sessions", async () => {
  for (const options of [{}, { role: "admin" as const }, { role: "customer" as const, secret: true }, { role: "admin" as const, secret: true, valid: false }]) {
    assert.equal((await request("/", options)).headers.get("x-middleware-next"), "1");
  }
  assert.equal((await request("/", { role: "admin", secret: true })).headers.get("x-middleware-rewrite"), "https://ai.hkdijital.com.tr/ai-workforce");
});

test("private login alias stays gated even when its name matches a product section", async () => {
  const blocked = await request("/agents", { privatePath: "agents" });
  assert.equal(blocked.status, 307);
  const allowed = await request("/agents", { privatePath: "agents", secret: true });
  assert.equal(allowed.headers.get("x-middleware-rewrite"), "https://ai.hkdijital.com.tr/digital-center");
});

test("main host routing remains unchanged", async () => {
  assert.equal((await request("/agents", { host: "www.hkdijital.com.tr" })).headers.get("x-middleware-next"), "1");
  assert.equal((await request("/hk-admin", { host: "www.hkdijital.com.tr", secret: true })).headers.get("location"), "https://www.hkdijital.com.tr/giris");
});

for (const [host, role, mustChange, destination] of [
  ["ai.hkdijital.com.tr", "admin", false, "/ai-workforce"],
  ["www.hkdijital.com.tr", "admin", false, "/hk-admin"],
  ["ai.hkdijital.com.tr", "customer", false, "/musteri-paneli"],
  ["ai.hkdijital.com.tr", "customer", true, "/sifre-degistir"]
] as const) {
  test(`successful login on ${host} as ${role} (password change ${mustChange}) goes to ${destination}`, async () => {
    const loadedModule = { exports: {} as { POST: (request: Request) => Promise<Response> } };
    let sessionCreated = false;
    const code = ts.transpileModule(readFileSync(new URL("../../src/app/api/auth/login/route.ts", import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    runInNewContext(code, {
      module: loadedModule, exports: loadedModule.exports, URL,
      require: (id: string) => {
        if (id === "@/lib/ai-workforce-schema") return schema;
        if (id === "@/lib/auth") return {
          authenticateUser: async () => ({ session: { role } }),
          createSession: async () => { sessionCreated = true; },
          isCustomerPasswordChangeRequired: () => mustChange,
          isCustomerRole: (value: string) => value === "customer"
        };
        if (id === "@/lib/activity-log") return { recordCustomerLogin: async () => {} };
        if (id === "@/lib/server/usernames") return { resolveLoginEmail: async () => "test@example.test" };
        if (id === "@/lib/hidden-access" || id === "@/lib/supabase") return {};
        return require(id);
      }
    });
    const response = await loadedModule.exports.POST(new Request(`https://${host}/api/auth/login`, {
      method: "POST", body: JSON.stringify({ identity: "test", password: "test-only" })
    }));
    assert.equal(response.status, 200);
    assert.equal(sessionCreated, true);
    assert.equal((await response.json()).redirectTo, destination);
  });
}
