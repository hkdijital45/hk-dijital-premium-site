import test from "node:test";
import assert from "node:assert/strict";
import { encodeSession, decodeSession } from "../../src/lib/session-token.ts";

const ENV_KEYS = ["NODE_ENV", "ADMIN_SESSION_SECRET", "SUPABASE_SERVICE_ROLE_KEY"] as const;

const env = process.env as Record<string, string | undefined>;

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) delete env[key];
  else env[key] = value;
}

function withEnv(overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>, fn: () => void) {
  const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, env[key]]));
  try {
    for (const key of ENV_KEYS) setEnv(key, overrides[key]);
    fn();
  } finally {
    for (const key of ENV_KEYS) setEnv(key, saved[key]);
  }
}

const sampleSession = { email: "qa@hkdijital.test", role: "admin" as const, fullName: "QA" };

test("production with no real secret: encodeSession refuses to sign with a guessable fallback", () => {
  withEnv({ NODE_ENV: "production", ADMIN_SESSION_SECRET: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined }, () => {
    assert.throws(() => encodeSession(sampleSession));
  });
});

test("production with ADMIN_SESSION_SECRET configured: round-trips correctly", () => {
  withEnv({ NODE_ENV: "production", ADMIN_SESSION_SECRET: "a-real-production-secret", SUPABASE_SERVICE_ROLE_KEY: undefined }, () => {
    const token = encodeSession(sampleSession);
    const decoded = decodeSession(token);
    assert.equal(decoded?.email, sampleSession.email);
    assert.equal(decoded?.role, sampleSession.role);
  });
});

test("development with no secret configured: keeps the local fallback for QA convenience", () => {
  withEnv({ NODE_ENV: "development", ADMIN_SESSION_SECRET: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined }, () => {
    const token = encodeSession(sampleSession);
    const decoded = decodeSession(token);
    assert.equal(decoded?.email, sampleSession.email);
  });
});

test("decodeSession: a token signed under one secret is rejected once the secret changes (fail closed, not a 500)", () => {
  let token = "";
  withEnv({ NODE_ENV: "production", ADMIN_SESSION_SECRET: "secret-one", SUPABASE_SERVICE_ROLE_KEY: undefined }, () => {
    token = encodeSession(sampleSession);
  });
  withEnv({ NODE_ENV: "production", ADMIN_SESSION_SECRET: "secret-two", SUPABASE_SERVICE_ROLE_KEY: undefined }, () => {
    assert.equal(decodeSession(token), null);
  });
});

test("decodeSession: production misconfiguration (no secret at all) fails closed instead of throwing", () => {
  withEnv({ NODE_ENV: "production", ADMIN_SESSION_SECRET: "secret-one", SUPABASE_SERVICE_ROLE_KEY: undefined }, () => {
    const token = encodeSession(sampleSession);
    withEnv({ NODE_ENV: "production", ADMIN_SESSION_SECRET: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined }, () => {
      assert.doesNotThrow(() => decodeSession(token));
      assert.equal(decodeSession(token), null);
    });
  });
});

test("decodeSession: malformed or empty input returns null without throwing", () => {
  assert.equal(decodeSession(undefined), null);
  assert.equal(decodeSession(""), null);
  assert.equal(decodeSession("not-a-valid-token"), null);
  assert.equal(decodeSession("payload-without-signature."), null);
});
