import test from "node:test";
import assert from "node:assert/strict";
import { scanForPrivacyLeaks, stripHandle, stripDomain, digitsOnly, type PrivacyWatchlist } from "../../src/lib/social-autopilot/privacy-scan.ts";

const emptyWatchlist: PrivacyWatchlist = { names: [], handles: [], domains: [], phones: [], emails: [] };

test("scanForPrivacyLeaks: flags a watchlisted client name", () => {
  const watchlist: PrivacyWatchlist = { ...emptyWatchlist, names: ["Acme Kurumsal"] };
  const hits = scanForPrivacyLeaks("Acme Kurumsal ile yürüttüğümüz kampanya harika sonuçlar verdi.", watchlist);
  assert.ok(hits.some((hit) => hit.type === "name" && hit.value === "Acme Kurumsal"));
});

test("scanForPrivacyLeaks: flags a watchlisted Instagram handle", () => {
  const watchlist: PrivacyWatchlist = { ...emptyWatchlist, handles: ["acmekurumsal"] };
  const hits = scanForPrivacyLeaks("Takip için @acmekurumsal hesabına göz atın.", watchlist);
  assert.ok(hits.some((hit) => hit.type === "handle"));
});

test("scanForPrivacyLeaks: flags a watchlisted domain and phone number", () => {
  const watchlist: PrivacyWatchlist = { ...emptyWatchlist, domains: ["acme.com.tr"], phones: ["5551234567"] };
  const hits = scanForPrivacyLeaks("Detaylar acme.com.tr adresinde, iletişim: 0555 123 45 67.", watchlist);
  assert.ok(hits.some((hit) => hit.type === "domain"));
  assert.ok(hits.some((hit) => hit.type === "phone"));
});

test("scanForPrivacyLeaks: generic e-mail/phone patterns are flagged even with an empty watchlist", () => {
  const hits = scanForPrivacyLeaks("Bize info@ornekfirma.com adresinden ulaşın.", emptyWatchlist);
  assert.ok(hits.some((hit) => hit.type === "email"));
});

test("scanForPrivacyLeaks: generic Turkish mobile number pattern is flagged", () => {
  const hits = scanForPrivacyLeaks("Hemen arayın: 0532 111 22 33", emptyWatchlist);
  assert.ok(hits.some((hit) => hit.type === "phone"));
});

test("scanForPrivacyLeaks: clean public-facing marketing copy produces no hits", () => {
  const hits = scanForPrivacyLeaks("Dijital pazarlamada performans, tutarlı ölçümle başlar.", emptyWatchlist);
  assert.deepEqual(hits, []);
});

test("stripHandle: normalizes @handle and full profile URL forms", () => {
  assert.equal(stripHandle("@hkdijital"), "hkdijital");
  assert.equal(stripHandle("https://www.instagram.com/hkdijital/"), "hkdijital");
});

test("stripDomain: strips protocol, www and path", () => {
  assert.equal(stripDomain("https://www.hkdijital.com.tr/hizmetler"), "hkdijital.com.tr");
});

test("digitsOnly: strips all non-digit characters", () => {
  assert.equal(digitsOnly("+90 (532) 111-22-33"), "905321112233");
});
