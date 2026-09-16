import test from "node:test";
import assert from "node:assert/strict";
import { googleTokenNeedsReconnect } from "../../src/lib/analytics-center/google-connection-state.ts";
const now = Date.parse("2026-09-16T12:00:00Z");
test("expired Google access token with refresh token stays usable", () => {
  assert.equal(googleTokenNeedsReconnect({access_token_encrypted:"encrypted", refresh_token_encrypted:"encrypted-refresh", token_expires_at:"2026-09-16T10:00:00Z"}, now), false);
});
test("expired Google access token without refresh requires reconnect", () => {
  assert.equal(googleTokenNeedsReconnect({access_token_encrypted:"encrypted", token_expires_at:"2026-09-16T10:00:00Z"}, now), true);
});
test("valid Google access token does not require reconnect", () => {
  assert.equal(googleTokenNeedsReconnect({access_token_encrypted:"encrypted", token_expires_at:"2026-09-16T13:00:00Z"}, now), false);
});
test("missing credentials require reconnect; unknown expiry is refreshable", () => {
  assert.equal(googleTokenNeedsReconnect(null, now), true);
  assert.equal(googleTokenNeedsReconnect({access_token_encrypted:"encrypted", refresh_token_encrypted:"encrypted-refresh"}, now), false);
});
