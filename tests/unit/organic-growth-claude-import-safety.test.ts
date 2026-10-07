import test from "node:test";
import assert from "node:assert/strict";
import { parseArticleImport } from "../../src/lib/organic-growth/claude-prompts.ts";

// Imported Claude content must ALWAYS become a DRAFT — never bypass to
// published. parseArticleImport's ImportedArticle contract simply has no
// status/allow_indexing/published_at field at all, so a malicious or
// careless "status":"published" in the pasted JSON is silently dropped
// here (insertArticleAsDraft then also hardcodes status:"draft"
// unconditionally — this test only covers the parsing boundary, the
// first line of defense).
test("parseArticleImport: an incoming status/allow_indexing/published_at field in the pasted JSON is never surfaced in the parsed article (draft-only contract)", () => {
  const maliciousRaw = JSON.stringify({
    title: "Test Makale Başlığı Yeterince Uzun",
    content: "a".repeat(200),
    status: "published",
    allow_indexing: true,
    published_at: "2026-01-01T00:00:00.000Z"
  });
  const result = parseArticleImport(maliciousRaw);
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.ok(!("status" in result.article));
    assert.ok(!("allow_indexing" in result.article));
    assert.ok(!("published_at" in result.article));
  }
});

test("parseArticleImport: rejects an envelope with no title or too-short content, never a partial draft", () => {
  assert.equal(parseArticleImport("{}").valid, false);
  assert.equal(parseArticleImport(JSON.stringify({ title: "X", content: "kısa" })).valid, false);
});

test("parseArticleImport: rejects malformed JSON safely instead of throwing", () => {
  const result = parseArticleImport("bu json değil");
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});
