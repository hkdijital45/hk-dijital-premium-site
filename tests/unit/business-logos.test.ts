import test from "node:test";
import assert from "node:assert/strict";
import { decideLogoStatus, extractLogoCandidates, isPrivateAddress, namesMatch, registrableDomain, robotsAllows } from "../../src/lib/business-logos-shared.ts";

// Fictional fixtures only.
const PAGE = "https://www.ornekkafe.com.tr/";
const HTML = `<!doctype html><html><head>
<meta property="og:image" content="/img/kapak-banner.jpg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"x"},{"@type":["Organization","LocalBusiness"],"name":"Örnek Kafe","url":"https://ornekkafe.com.tr","logo":{"@type":"ImageObject","url":"https://ornekkafe.com.tr/wp-content/logo.png"}}]}</script>
<script type="application/ld+json">{ broken json </script>
</head><body><header><a href="/"><img class="site-logo" src="/assets/header-logo.webp" alt="Örnek Kafe"></a></header>
<img src="/foto.jpg" alt="Tatlılar"></body></html>`;

test("candidates are extracted in trust order and resolved to absolute URLs", () => {
  const candidates = extractLogoCandidates(HTML, PAGE);
  assert.deepEqual(candidates.map((c) => c.sourceType), ["website_structured_data", "website_header", "website_icon", "open_graph"]);
  assert.equal(candidates[0].url, "https://ornekkafe.com.tr/wp-content/logo.png");
  assert.equal(candidates[0].declaredName, "Örnek Kafe");
  assert.equal(candidates[1].url, "https://www.ornekkafe.com.tr/assets/header-logo.webp");
  assert.ok(!candidates.some((c) => c.url.includes("foto.jpg")), "ordinary images are never logo candidates");
});

const base = { businessName: "Örnek Kafe & Pastane", recordedHost: "ornekkafe.com.tr", finalHost: "www.ornekkafe.com.tr", imageHost: "ornekkafe.com.tr", width: 600, height: 200 };

test("VERIFIED only for matching Organization structured data on the recorded site", () => {
  const [org] = extractLogoCandidates(HTML, PAGE);
  assert.equal(decideLogoStatus({ ...base, candidate: org }).status, "VERIFIED");
});

test("everything else needs a human: header image, other domain, mismatched name, banner", () => {
  const [org, header, icon, og] = extractLogoCandidates(HTML, PAGE);
  assert.equal(decideLogoStatus({ ...base, candidate: header }).status, "PENDING_REVIEW");
  assert.equal(decideLogoStatus({ ...base, candidate: icon }).status, "PENDING_REVIEW");
  assert.equal(decideLogoStatus({ ...base, candidate: og }).status, "PENDING_REVIEW");
  assert.equal(decideLogoStatus({ ...base, candidate: org, imageHost: "cdn.baskasite.com" }).status, "PENDING_REVIEW", "logo served from another domain");
  assert.equal(decideLogoStatus({ ...base, candidate: org, finalHost: "baskafirma.com" }).status, "PENDING_REVIEW", "site redirected elsewhere");
  assert.equal(decideLogoStatus({ ...base, businessName: "Tamamen Farklı Mobilya", candidate: { ...org, declaredUrl: undefined } }).status, "PENDING_REVIEW", "similarly named / different business");
  assert.equal(decideLogoStatus({ ...base, candidate: org, width: 2000, height: 200 }).status, "PENDING_REVIEW", "banner-shaped image");
});

test("domain helpers handle Turkish second-level domains", () => {
  assert.equal(registrableDomain("www.shop.ornekkafe.com.tr"), "ornekkafe.com.tr");
  assert.equal(registrableDomain("cdn.example.com"), "example.com");
  assert.ok(namesMatch("Örnek Kafe", "ÖRNEK KAFE VE PASTANE LTD. ŞTİ."));
  assert.ok(!namesMatch("Zirve Akademi", "Robotik45"));
});

test("SSRF guard blocks private, loopback, link-local and metadata addresses", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.5", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fd00::1", "::ffff:10.0.0.1"]) assert.ok(isPrivateAddress(ip), ip);
  for (const ip of ["8.8.8.8", "185.199.108.153", "2606:4700::1111"]) assert.ok(!isPrivateAddress(ip), ip);
});

test("robots.txt is respected", () => {
  const robots = "User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\n\nUser-agent: HKDijitalLogoBot\nDisallow: /";
  assert.equal(robotsAllows(robots, "/"), false, "our own agent is disallowed entirely");
  assert.equal(robotsAllows("User-agent: *\nDisallow: /private", "/"), true);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /", "/logo.png"), false);
  assert.equal(robotsAllows("User-agent: *\nDisallow:", "/"), true);
});
