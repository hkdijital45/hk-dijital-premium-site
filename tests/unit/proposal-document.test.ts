import test from "node:test";
import assert from "node:assert/strict";
import { buildProposalFilename, buildProposalNumber, sanitizeForFilename } from "../../src/lib/proposal-document.ts";

test("sanitizeForFilename: transliterates every Turkish character to a safe ASCII equivalent", () => {
  assert.equal(sanitizeForFilename("ğüşıöçĞÜŞİÖÇ"), "gusiocGUSIOC");
});

test("sanitizeForFilename: a real Turkish company name becomes a clean, readable slug", () => {
  assert.equal(sanitizeForFilename("Öztürk Diş Kliniği"), "Ozturk-Dis-Klinigi");
});

test("sanitizeForFilename: collapses punctuation/whitespace runs and trims leading/trailing dashes", () => {
  assert.equal(sanitizeForFilename("  A.Ş. / Ltd.,  Şti.  "), "A-S-Ltd-Sti");
});

test("sanitizeForFilename: never returns an empty string, even for input with no safe characters", () => {
  assert.equal(sanitizeForFilename("???"), "Teklif");
  assert.equal(sanitizeForFilename(""), "Teklif");
});

test("buildProposalNumber: matches the HK-YYYYMMDD-XXXXXXXX reference format", () => {
  const number = buildProposalNumber(new Date("2026-09-15T10:00:00.000Z"), "a1b2c3d4-e5f6-7890-abcd-ef1234567890");
  assert.equal(number, "HK-20260915-A1B2C3D4");
  assert.match(number, /^HK-\d{8}-[A-F0-9]{8}$/);
});

test("buildProposalFilename: combines a safe company slug and the proposal number into a professional filename", () => {
  const filename = buildProposalFilename("Öztürk Diş Kliniği", "HK-20260915-A1B2C3D4");
  assert.equal(filename, "HK-Dijital-Teklif-Ozturk-Dis-Klinigi-HK-20260915-A1B2C3D4.pdf");
  assert.match(filename, /^[\x20-\x7E]+$/, "filename must be pure ASCII, safe for a Content-Disposition header");
});
