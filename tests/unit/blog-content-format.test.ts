import test from "node:test";
import assert from "node:assert/strict";
import { slugifyBlogValue, calculateBlogMetrics } from "../../src/lib/blog-seo-shared.ts";
import { extractMarkdownHeadings, markdownToSafeHtml } from "../../src/lib/blog-markdown.ts";

test("slugifyBlogValue: transliterates Turkish characters and normalizes separators", () => {
  assert.equal(slugifyBlogValue("Google Ads Yönetimi Nasıl Çalışır?"), "google-ads-yonetimi-nasil-calisir");
  assert.equal(slugifyBlogValue("  --Çift  Tire--  "), "cift-tire");
  assert.equal(slugifyBlogValue("İstanbul'da Şirket Kuruluşu"), "istanbul-da-sirket-kurulusu");
});

test("markdownToSafeHtml: renders headings, lists, links and emphasis as real HTML", () => {
  const html = markdownToSafeHtml([
    "## Bir Alt Başlık",
    "",
    "### İkinci Seviye Başlık",
    "",
    "**Kalın** ve *italik* metin, [hizmetlerimizi](/hizmetler) inceleyin.",
    "",
    "- Madde bir",
    "- Madde iki",
    "",
    "> Bir alıntı"
  ].join("\n"));
  assert.match(html, /<h2 id="bir-alt-baslik">Bir Alt Başlık<\/h2>/);
  assert.match(html, /<h3 id="ikinci-seviye-baslik">İkinci Seviye Başlık<\/h3>/);
  assert.match(html, /<strong>Kalın<\/strong>/);
  assert.match(html, /<em>italik<\/em>/);
  assert.match(html, /<a href="\/hizmetler">hizmetlerimizi<\/a>/);
  assert.match(html, /<ul>[\s\S]*<li>Madde bir<\/li>/);
  assert.match(html, /<blockquote>/);
  assert.doesNotMatch(html, /##|\*\*|\[hizmetlerimizi\]/);
});

test("markdownToSafeHtml: escapes literal script tags instead of executing them", () => {
  const html = markdownToSafeHtml("Merhaba <script>alert(1)</script> dünya.");
  assert.doesNotMatch(html, /<script/i);
});

test("markdownToSafeHtml: never emits a javascript: href", () => {
  const html = markdownToSafeHtml('[link](javascript:alert(1))');
  assert.doesNotMatch(html, /href="javascript:/i);
});

test("markdownToSafeHtml: strips inline event handler attributes on allowed tags", () => {
  const html = markdownToSafeHtml('[a link](/hizmetler "onmouseover=alert(1)")');
  assert.doesNotMatch(html, /onmouseover/i);
});

test("extractMarkdownHeadings: matches the ids markdownToSafeHtml renders", () => {
  const markdown = "## Reklam Bütçesi Nasıl Belirlenir?\n\nParagraf.\n\n### Alt Bölüm";
  const headings = extractMarkdownHeadings(markdown);
  assert.deepEqual(headings.map((heading) => heading.level), [2, 3]);
  const html = markdownToSafeHtml(markdown);
  for (const heading of headings) {
    assert.match(html, new RegExp(`id="${heading.id}"`));
  }
});

test("calculateBlogMetrics: strips markdown syntax before counting words", () => {
  const metrics = calculateBlogMetrics("## Başlık\n\nBu **kalın** bir [bağlantı](/blog) içeren cümledir.");
  assert.ok(metrics.word_count > 0);
  assert.ok(metrics.reading_time >= 1);
});
