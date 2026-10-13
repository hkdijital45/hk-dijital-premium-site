// Run via `npm run test:proposals-document` — "server-only" import chain,
// same --conditions=react-server / --import tsx trick as pre-audit-export.
import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { buildProposalDocumentPayload, buildProposalFileName } from "../../../src/lib/proposals/document.ts";
import { generatePdfBuffer, generateDocxBuffer } from "../../../src/lib/server/document-generator.ts";
import { calculateProposalFinancials } from "../../../src/lib/proposals/financials.ts";
import type { ProposalRecord } from "../../../src/lib/proposals/store.ts";

function fixtureProposal(overrides: Partial<ProposalRecord> = {}): ProposalRecord {
  const financials = calculateProposalFinancials({
    adBudgets: [{ platform: "Google Ads", monthlyBudget: 12000 }, { platform: "Meta Ads", monthlyBudget: 8000 }],
    agencyMonthlyFee: 12000,
    setupFee: 5000,
    contractMonths: 3
  });
  return {
    id: "11111111-1111-4111-8111-111111111111",
    company_id: null,
    lead_id: "22222222-2222-4222-8222-222222222222",
    target_label: "Abdulmalik Beyaz Eşya Teknik Servis",
    proposal_number: "TKL-2026-0001",
    title: "Abdulmalik — Teklif",
    status: "Taslak",
    version: 1,
    previous_proposal_id: null,
    questionnaire: {},
    data: {
      business: { name: "Abdulmalik Beyaz Eşya Teknik Servis", description: "Manisa merkezli beyaz eşya tamiri ve satışı." },
      market_analysis: { summary: "Yerel tamir talebi yüksek, rekabet orta düzeyde." },
      competitors: [
        { name: "Manisa'da Beyaz Eşya Servisi", verified: true, sourceUrl: "https://www.google.com/maps/place/example", notes: "Google Ads'te aktif." },
        { name: "Tahmini bir rakip", verified: false, notes: "Doğrulanmamış gözlem." }
      ],
      google_ads_strategy: { focus: "Tamir arama niyeti" },
      meta_ads_strategy: { focus: "Beyaz eşya satışı" },
      audience_strategy: { geographicTargeting: "Manisa merkez" },
      budget_scenarios: [
        { name: "Başlangıç", monthlyBudget: 10000, objective: "Test kampanyası" },
        { name: "Önerilen", monthlyBudget: 20000, objective: "Dengeli büyüme" },
        { name: "Büyüme", monthlyBudget: 35000, objective: "Agresif ölçekleme" }
      ],
      recommended_services: ["Google Ads Yönetimi", "Meta Ads Yönetimi"],
      implementation_plan: [{ day: "1-7", action: "Hesap denetimi ve kurulum" }],
      roadmap_90_days: [{ phase: "Ay 1", action: "Test ve ölçümleme" }],
      risks: ["Rekabetin marka aramasında reklamla üstte olması"],
      assumptions: ["Müşteri gerçek bütçe bilgisini paylaştı"],
      sources: [{ url: "https://www.google.com/maps/place/example", accessDate: "2026-10-13", note: "Google Maps" }],
      customer_proposal: { summary: "Tamir ve satış için ayrı kampanyalar öneriyoruz." },
      internal_recommendations: { note: "Fiyata duyarlı müşteri, Starter paketle başla." }
    },
    financials,
    source: "manual",
    claude_import: null,
    valid_until: "2026-11-13",
    sent_at: null,
    accepted_at: null,
    rejected_at: null,
    created_by: null,
    created_at: "2026-10-13T10:00:00.000Z",
    updated_at: "2026-10-13T10:00:00.000Z",
    ...overrides
  };
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = zip.file("word/document.xml");
  assert.ok(documentXml);
  return documentXml!.async("string");
}

test("buildProposalDocumentPayload (client mode): excludes risks/assumptions/internal_recommendations/raw sources", () => {
  const payload = buildProposalDocumentPayload(fixtureProposal(), "client");
  const titles = payload.sections.map((s) => s.title);
  assert.ok(!titles.includes("Riskler"));
  assert.ok(!titles.includes("Varsayımlar"));
  assert.ok(!titles.includes("Dahili Öneriler"));
  assert.ok(!titles.includes("Kaynaklar"));
  assert.ok(titles.includes("Müşteriye Özel Değerlendirme"));
  assert.ok(titles.includes("Finansal Özet"));
  assert.ok(titles.includes("Reklam Bütçesi Senaryoları"));
});

test("buildProposalDocumentPayload (internal mode): includes risks/assumptions/internal_recommendations/sources with real competitor status column", () => {
  const payload = buildProposalDocumentPayload(fixtureProposal(), "internal");
  const titles = payload.sections.map((s) => s.title);
  assert.ok(titles.includes("Riskler"));
  assert.ok(titles.includes("Varsayımlar"));
  assert.ok(titles.includes("Dahili Öneriler"));
  assert.ok(titles.includes("Kaynaklar"));
  const competitorSection = payload.sections.find((s) => s.title === "Rakip Analizi");
  assert.ok(competitorSection?.table);
  assert.ok(competitorSection!.table!.headers.includes("Durum"));
});

test("buildProposalDocumentPayload: a competitor sourceUrl becomes a real DocumentLink (full URL preserved)", () => {
  const payload = buildProposalDocumentPayload(fixtureProposal(), "internal");
  const competitorSection = payload.sections.find((s) => s.title === "Rakip Analizi");
  const linkCell = competitorSection!.table!.rows[0][3];
  assert.equal(typeof linkCell, "object");
  assert.equal((linkCell as { url: string }).url, "https://www.google.com/maps/place/example");
});

test("buildProposalDocumentPayload: financial summary reflects the deterministic calculation engine, not fabricated text", () => {
  const payload = buildProposalDocumentPayload(fixtureProposal(), "internal");
  const finSection = payload.sections.find((s) => s.title === "Finansal Özet");
  const rows = finSection!.table!.rows;
  const firstMonthRow = rows.find((r) => r[0] === "İlk Ay Toplamı (KDV Dahil)");
  assert.ok(firstMonthRow);
});

test("PDF and DOCX generation both produce real, valid, non-empty files for a proposal", async () => {
  const proposal = fixtureProposal();
  const clientPayload = buildProposalDocumentPayload(proposal, "client");
  const pdf = await generatePdfBuffer(clientPayload);
  assert.equal(pdf.subarray(0, 4).toString("latin1"), "%PDF");
  const loaded = await PDFDocument.load(pdf);
  assert.ok(loaded.getPageCount() >= 1);

  const docx = await generateDocxBuffer(clientPayload);
  assert.equal(docx.subarray(0, 2).toString("latin1"), "PK");
  const xml = await extractDocxText(docx);
  assert.match(xml, /Abdulmalik/);
  assert.doesNotMatch(xml, /Fiyata duyarlı/i, "internal-only negotiation notes must never leak into a client document");
});

test("buildProposalFileName: ASCII-safe, includes the real proposal number", () => {
  const name = buildProposalFileName(fixtureProposal(), "client", "pdf");
  assert.match(name, /^HK-Dijital-.*-Teklif-TKL-2026-0001\.pdf$/);
});
