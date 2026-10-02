// classifyMetaError's default fallback message is shared across callers
// with genuinely different real behavior on failure — see meta-api.ts's
// own comment. Regression coverage for the "Meta Ad Library bağlantısı
// başarısız oldu. Demo sonuçlar gösteriliyor." bug: this text leaked
// into meta-ads/route.ts's real Marketing API ads-lifecycle/creative
// sync, which neither calls the Ad Library API nor ever shows demo/mock
// data on failure (confirmed: no demo generator exists in that file).
import test from "node:test";
import assert from "node:assert/strict";
import { classifyMetaError, noMetaTokenError, cacheFallbackError } from "../../src/lib/meta-api.ts";

test("classifyMetaError: default fallback message is honest and generic — never claims 'Meta Ad Library' or 'Demo sonuçlar gösteriliyor' unless the caller explicitly opts into that text", () => {
  const result = classifyMetaError({ error: { code: "999", message: "Some unclassified Graph error" } });
  assert.equal(result.errorMessage, "Meta verisi alınamadı.");
  assert.doesNotMatch(result.errorMessage, /Ad Library/);
  assert.doesNotMatch(result.errorMessage, /Demo/);
});

test("classifyMetaError: a caller can still opt into its own specific fallback message (e.g. the genuine Meta Ad Library competitor-intelligence route, which really does fall back to demo results)", () => {
  const result = classifyMetaError({ error: { code: "999", message: "unclassified" } }, "META_API_ERROR", "Meta Ad Library bağlantısı başarısız oldu. Demo sonuçlar gösteriliyor.");
  assert.equal(result.errorMessage, "Meta Ad Library bağlantısı başarısız oldu. Demo sonuçlar gösteriliyor.");
});

test("classifyMetaError: preserves Meta's own raw error.message for staff diagnostics, never discards it", () => {
  const result = classifyMetaError({ error: { code: "100", message: "(#100) Tried accessing nonexisting field (creative) on node type (Ad)" } });
  assert.equal(result.rawMessage, "(#100) Tried accessing nonexisting field (creative) on node type (Ad)");
});

test("classifyMetaError: rate limit / token-expired / permission classifications still take priority over the generic fallback, regardless of which fallback message was supplied", () => {
  const rateLimited = classifyMetaError({ error: { code: "4", message: "rate limit" } }, "META_API_ERROR", "Meta Ad Library bağlantısı başarısız oldu. Demo sonuçlar gösteriliyor.");
  assert.equal(rateLimited.isRateLimit, true);
  assert.match(rateLimited.errorMessage, /istek sınırına takıldı/);

  const expired = classifyMetaError({ error: { code: "190", message: "token expired" } });
  assert.equal(expired.isTokenExpired, true);
  assert.match(expired.errorMessage, /token geçersiz veya süresi dolmuş/);

  const noPermission = classifyMetaError({ error: { code: "200", message: "permission denied" } });
  assert.equal(noPermission.isPermissionError, true);
  assert.match(noPermission.errorMessage, /yetkileri bu işlem için yeterli değil/);
});

test("classifyMetaError: a request with no error object at all still returns a well-formed structured error, never throws", () => {
  const result = classifyMetaError({});
  assert.equal(result.rawMessage, null);
  assert.equal(result.errorMessage, "Meta verisi alınamadı.");
});

test("noMetaTokenError / cacheFallbackError: unaffected by the default-fallback-message fix — both are genuine, caller-specific messages (no token configured at all / stale cache being shown) and keep their own accurate text", () => {
  assert.match(noMetaTokenError().errorMessage, /Demo sonuçlar gösteriliyor/);
  assert.equal(noMetaTokenError().rawMessage, null);
  assert.match(cacheFallbackError().errorMessage, /Son başarılı sonuçlar gösteriliyor/);
  assert.equal(cacheFallbackError().isCacheFallback, true);
});
