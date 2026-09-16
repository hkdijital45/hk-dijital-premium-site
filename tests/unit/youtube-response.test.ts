import test from "node:test";
import assert from "node:assert/strict";
import { youtubeApiError, youtubeMetricValue, youtubeGet } from "../../src/lib/analytics-center/youtube-response.ts";
const url = "https://youtubeanalytics.googleapis.com/v2/reports";
test("disabled API is not reported as missing consent", () => {
  const message = youtubeApiError(403, {error: {message: "API has not been used in project 8339440497 before or it is disabled"}}, url);
  assert.match(message, /kapalı veya etkinleştirme henüz yayılmadı/);
  assert.doesNotMatch(message, /Yeniden Bağla/);
});
test("missing scopes, quota and channel access have distinct recovery", () => {
  assert.match(youtubeApiError(403, {error: {message: "insufficient authentication scopes"}}, url), /Yeniden Bağla/);
  assert.match(youtubeApiError(403, {error: {errors: [{reason: "quotaExceeded"}]}}, url), /kota/);
  assert.match(youtubeApiError(403, {error: {message: "Forbidden"}}, url), /kanalın sahibi/);
});
test("missing and invalid values never become fabricated zero", () => {
  for (const value of [null, undefined, "", " ", "bad", NaN, Infinity, false, {}]) assert.equal(youtubeMetricValue(value), null);
  assert.equal(youtubeMetricValue(0), 0);
  assert.equal(youtubeMetricValue("0"), 0);
  assert.equal(youtubeMetricValue("12.5"), 12.5);
});
test("API propagation retries with backoff and returns real successful payload", async () => {
  let calls = 0;
  const delays: number[] = [];
  const request = (async () => ++calls < 3
    ? Response.json({ error: { message: "SERVICE_DISABLED" } }, { status: 403 })
    : Response.json({ rows: [["2026-09-01", 12]] })) as typeof fetch;
  assert.deepEqual(await youtubeGet(url, "test", request, async ms => { delays.push(ms); }), { rows: [["2026-09-01", 12]] });
  assert.equal(calls, 3);
  assert.deepEqual(delays, [1000, 2000]);
});
test("persistent disabled API stops after three attempts with propagation guidance", async () => {
  let calls = 0;
  const request = (async () => { calls++; return Response.json({ error: { message: "SERVICE_DISABLED" } }, { status: 403 }); }) as typeof fetch;
  await assert.rejects(youtubeGet(url, "test", request, async () => {}), /birkaç dakika/);
  assert.equal(calls, 3);
});
test("missing consent and daily quota fail immediately without retry", async () => {
  for (const reason of ["insufficientPermissions", "quotaExceeded"]) {
    let calls = 0;
    const request = (async () => { calls++; return Response.json({ error: { errors: [{ reason }] } }, { status: 403 }); }) as typeof fetch;
    await assert.rejects(youtubeGet(url, "test", request, async () => { assert.fail("must not retry"); }));
    assert.equal(calls, 1);
  }
});
