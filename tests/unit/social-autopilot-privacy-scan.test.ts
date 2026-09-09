import test from "node:test";
import assert from "node:assert/strict";
import { scanForPrivacyLeaks, stripDomain, stripHandle, digitsOnly, type PrivacyWatchlist } from "../../src/lib/social-autopilot/privacy-scan.ts";

const watchlist: PrivacyWatchlist = {
  names: ["Örnek Kuaför Salonu"],
  handles: ["ornekkuafor"],
  domains: ["ornekkuafor.com.tr"],
  phones: ["5551234567"],
  emails: ["info@ornekkuafor.com.tr"]
};

test("scanForPrivacyLeaks: flags a real customer name", () => {
  const hits = scanForPrivacyLeaks("Geçenlerde Örnek Kuaför Salonu için harika sonuçlar aldık.", watchlist);
  assert.ok(hits.some((hit) => hit.type === "name"));
});

test("scanForPrivacyLeaks: flags a real customer Instagram handle", () => {
  const hits = scanForPrivacyLeaks("@ornekkuafor hesabını takip edin.", watchlist);
  assert.ok(hits.some((hit) => hit.type === "handle"));
});

test("scanForPrivacyLeaks: flags a real customer domain and email", () => {
  const hits = scanForPrivacyLeaks("Detaylar için ornekkuafor.com.tr veya info@ornekkuafor.com.tr", watchlist);
  assert.ok(hits.some((hit) => hit.type === "domain"));
  assert.ok(hits.some((hit) => hit.type === "email"));
});

test("scanForPrivacyLeaks: flags a real customer phone number regardless of formatting", () => {
  const hits = scanForPrivacyLeaks("Bizi 0555 123 45 67 numaralı hattan arayabilirsiniz.", watchlist);
  assert.ok(hits.some((hit) => hit.type === "phone"));
});

test("scanForPrivacyLeaks: approved anonymized descriptor produces no hit", () => {
  const hits = scanForPrivacyLeaks("Analiz ettiğimiz bir yerel işletme, üç ay içinde dönüşümlerini ikiye katladı.", watchlist);
  assert.equal(hits.length, 0);
});

test("scanForPrivacyLeaks: flags a generic email/phone even when not a known customer", () => {
  const hits = scanForPrivacyLeaks("Bize destek@baskabirisletme.com adresinden ulaşabilirsiniz.", { names: [], handles: [], domains: [], phones: [], emails: [] });
  assert.ok(hits.some((hit) => hit.type === "email"));
});

test("scanForPrivacyLeaks: empty text returns no hits", () => {
  assert.deepEqual(scanForPrivacyLeaks("", watchlist), []);
});

test("stripHandle: normalizes an Instagram URL/@ handle to a bare username", () => {
  assert.equal(stripHandle("https://www.instagram.com/ornekkuafor/"), "ornekkuafor");
  assert.equal(stripHandle("@ornekkuafor"), "ornekkuafor");
});

test("stripDomain: normalizes a URL to a bare domain", () => {
  assert.equal(stripDomain("https://www.ornekkuafor.com.tr/iletisim"), "ornekkuafor.com.tr");
});

test("digitsOnly: strips non-digit characters", () => {
  assert.equal(digitsOnly("+90 (555) 123-45-67"), "905551234567");
});
