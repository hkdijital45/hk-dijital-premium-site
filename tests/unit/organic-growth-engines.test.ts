import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSeo, analyzeGeo, countWords, extractHeadings, hasInternalLink } from "../../src/lib/organic-growth/seo-geo-engine.ts";
import { detectCannibalization } from "../../src/lib/organic-growth/cannibalization.ts";
import { suggestInternalLinks, findOrphanArticles } from "../../src/lib/organic-growth/internal-links.ts";
import { buildMonthlyStrategyPrompt, buildArticlePrompt, parseMonthlyPlanImport, parseArticleImport, CLAUDE_PROJECT_NAME } from "../../src/lib/organic-growth/claude-prompts.ts";
import { CONTENT_PLAN_STATUSES, isOrganicRecommendationType } from "../../src/lib/organic-growth/types.ts";

const GOOD_ARTICLE = {
  title: "Instagram Reklamı Nasıl Verilir? İşletmeler İçin Rehber",
  slug: "instagram-reklami-nasil-verilir",
  excerpt: "Instagram reklamı vermek isteyen işletme sahipleri için hedef, bütçe ve ölçümü anlatan uygulamalı bir rehber niteliğindedir.",
  content: `Instagram reklamı, doğru hedef kitle ve bütçe planlamasıyla işletmenize ölçülebilir müşteri talebi getirebilir. Bu rehber, kuruluma başlamadan önce netleştirmeniz gereken temel kararları özetler.

## Instagram reklamı nasıl verilir?

Hedef kitle, bütçe ve kreatif birlikte planlanmalıdır.

## Bütçe nasıl belirlenir?

Sektör rekabeti ve dönüşüm hedefi bütçeyi belirler.

Detaylı kurulum için [hizmetlerimizi](/hizmetler) inceleyebilirsiniz. Bu konuda güncel istatistikler için [Meta'nın resmi kaynaklarına](https://business.instagram.com) bakabilirsiniz.`,
  metaTitle: "Instagram Reklamı Nasıl Verilir? | HK Dijital",
  metaDescription: "Instagram reklamı vermek isteyen işletmeler için hedef kitle, bütçe planlaması ve dönüşüm takibini adım adım anlatan uygulamalı rehber.",
  primaryTopic: "Instagram reklamı",
  updatedAt: "2026-09-01T00:00:00.000Z",
  authorName: "Hayri Kamalı"
};

test("analyzeSeo: a well-formed article scores highly and lists no warnings for passed checks", () => {
  const result = analyzeSeo(GOOD_ARTICLE);
  assert.ok(result.score >= 80, `expected high score, got ${result.score}`);
  assert.ok(result.factors.every((f) => typeof f.why === "string" && f.why.length > 0));
});

test("analyzeSeo: missing meta description and short content lowers the score and produces explanatory warnings", () => {
  const bad = { ...GOOD_ARTICLE, metaDescription: "", content: "Kısa içerik." };
  const result = analyzeSeo(bad);
  assert.ok(result.score < 80);
  assert.ok(result.warnings.some((w) => w.includes("Meta açıklama")));
  assert.ok(result.warnings.some((w) => w.includes("650")));
});

test("analyzeSeo: never implies a ranking guarantee in its warning text", () => {
  const result = analyzeSeo(GOOD_ARTICLE);
  for (const f of result.factors) {
    assert.ok(!/garanti|sıralama garantisi/i.test(f.why));
  }
});

test("analyzeGeo: a direct-answer opening with question headings scores reasonably", () => {
  const result = analyzeGeo(GOOD_ARTICLE);
  assert.ok(result.score > 0);
  assert.ok(result.factors.find((f) => f.key === "question_coverage")?.passed);
});

test("analyzeGeo: content with no question headings and no author fails those specific factors with a why", () => {
  const bad = { ...GOOD_ARTICLE, content: "Genel bir metin. Herhangi bir başlık yok.", authorName: "" };
  const result = analyzeGeo(bad);
  assert.equal(result.factors.find((f) => f.key === "question_coverage")?.passed, false);
  assert.equal(result.factors.find((f) => f.key === "publisher_author_clarity")?.passed, false);
});

test("countWords/extractHeadings/hasInternalLink: basic structural parsing", () => {
  assert.ok(countWords(GOOD_ARTICLE.content) > 20);
  assert.equal(extractHeadings(GOOD_ARTICLE.content).length, 2);
  assert.ok(hasInternalLink(GOOD_ARTICLE.content));
});

test("detectCannibalization: two items with the same primary topic are flagged high severity", () => {
  const items = [
    { id: "a", title: "Instagram Reklamı Nasıl Verilir?", slug: "a", primaryTopic: "Instagram reklamı", searchIntent: "bilgi", targetService: "Meta Reklam Yönetimi", topicClusterId: "c1" },
    { id: "b", title: "Instagram Reklamı Vermek İçin Rehber", slug: "b", primaryTopic: "Instagram reklamı", searchIntent: "bilgi", targetService: "Meta Reklam Yönetimi", topicClusterId: "c1" }
  ];
  const conflicts = detectCannibalization(items);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].severity, "high");
});

test("detectCannibalization: unrelated topics produce no conflicts", () => {
  const items = [
    { id: "a", title: "Instagram Reklamı Nasıl Verilir?", slug: "a", primaryTopic: "Instagram reklamı", searchIntent: "bilgi", targetService: "Meta Reklam Yönetimi", topicClusterId: "c1" },
    { id: "b", title: "Google Ads Bütçesi Nasıl Hesaplanır?", slug: "b", primaryTopic: "Google Ads bütçesi", searchIntent: "fiyat", targetService: "Google Ads Yönetimi", topicClusterId: "c2" }
  ];
  assert.equal(detectCannibalization(items).length, 0);
});

test("suggestInternalLinks: articles in the same cluster suggest each other, never inventing a URL", () => {
  const articles = [
    { id: "1", title: "Instagram Reklamı Rehberi", slug: "instagram-reklami-rehberi", primaryTopic: "Instagram reklamı", topicClusterId: "c1" },
    { id: "2", title: "Instagram Reklam Fiyatları", slug: "instagram-reklam-fiyatlari", primaryTopic: "Instagram reklam fiyatı", topicClusterId: "c1" }
  ];
  const suggestions = suggestInternalLinks(articles, []);
  assert.ok(suggestions.some((s) => s.sourceId === "1" && s.targetUrl === "/blog/instagram-reklam-fiyatlari"));
  for (const s of suggestions) assert.ok(s.targetUrl.startsWith("/blog/") || s.targetUrl.startsWith("/hizmetler/"));
});

test("findOrphanArticles: an article with no inbound suggestion is reported as orphan", () => {
  const articles = [
    { id: "1", title: "Instagram Reklamı Rehberi", slug: "instagram-reklami-rehberi", primaryTopic: "Instagram reklamı", topicClusterId: "c1" },
    { id: "2", title: "Tamamen Alakasız Bir Konu", slug: "alakasiz-konu", primaryTopic: "Bambaşka bir şey", topicClusterId: "c9" }
  ];
  const suggestions = suggestInternalLinks(articles, []);
  const orphans = findOrphanArticles(articles, suggestions);
  assert.ok(orphans.some((o) => o.slug === "alakasiz-konu"));
});

test("buildMonthlyStrategyPrompt: omits empty sections and never repeats permanent project instructions", () => {
  const prompt = buildMonthlyStrategyPrompt({ targetMonth: "2026-10", businessObjective: "Yeni lead artışı" });
  assert.ok(prompt.includes("MODE: STRATEGIST"));
  assert.ok(prompt.includes("TARGET MONTH: 2026-10"));
  assert.ok(!prompt.includes("TARGET GEOGRAPHY:"));
  assert.ok(!/HK Dijital.{0,20}kuruldu|misyon|değerlerimiz/i.test(prompt));
  assert.ok(prompt.includes(CLAUDE_PROJECT_NAME));
});

test("buildArticlePrompt: includes only populated brief fields and the anti-fabrication rule", () => {
  const prompt = buildArticlePrompt({ workingTitle: "Google Ads Bütçesi Nasıl Belirlenir?", primaryTopic: "Google Ads bütçesi" });
  assert.ok(prompt.includes("MODE: WRITER"));
  assert.ok(prompt.includes("WORKING TITLE: Google Ads Bütçesi Nasıl Belirlenir?"));
  assert.ok(!prompt.includes("WHY THIS ARTICLE EXISTS:"));
  assert.ok(prompt.includes("Do not invent statistics"));
});

test("parseMonthlyPlanImport: rejects malformed JSON and JSON missing items[]", () => {
  assert.equal(parseMonthlyPlanImport("not json").valid, false);
  assert.equal(parseMonthlyPlanImport('{"foo":1}').valid, false);
  assert.equal(parseMonthlyPlanImport('{"items":[]}').valid, false);
});

test("parseMonthlyPlanImport: rejects an item missing working_title but keeps valid ones", () => {
  const result = parseMonthlyPlanImport('{"items":[{"primary_topic":"x"},{"working_title":"Gerçek Başlık"}]}');
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].working_title, "Gerçek Başlık");
  }
});

test("parseArticleImport: requires title and a minimum content length", () => {
  assert.equal(parseArticleImport('{"title":"x","content":"kısa"}').valid, false);
  const good = parseArticleImport(JSON.stringify({ title: "Yeterince Uzun Bir Başlık", content: "a".repeat(150) }));
  assert.equal(good.valid, true);
});

test("isOrganicRecommendationType: matches SEO/content/GEO recommendation types without a new recommendation_type value", () => {
  assert.ok(isOrganicRecommendationType("seo_improvement"));
  assert.ok(isOrganicRecommendationType("content_gap"));
  assert.ok(isOrganicRecommendationType("İçerik Stratejisi"));
  assert.ok(isOrganicRecommendationType("geo_visibility"));
  assert.ok(!isOrganicRecommendationType("meta_ads_budget"));
  assert.ok(!isOrganicRecommendationType("customer_churn_risk"));
});

test("CONTENT_PLAN_STATUSES matches the spec's exact status set and order-independent membership", () => {
  const expected = ["PLANNED", "BRIEF_READY", "WAITING_FOR_CLAUDE", "DRAFT", "REVIEW", "APPROVED", "SCHEDULED", "PUBLISHED", "UPDATE_REQUIRED"];
  assert.deepEqual([...CONTENT_PLAN_STATUSES].sort(), [...expected].sort());
});
