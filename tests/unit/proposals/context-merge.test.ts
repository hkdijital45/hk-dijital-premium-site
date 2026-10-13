import test from "node:test";
import assert from "node:assert/strict";
import { mergeContextIntoQuestionnaire, type LeadProposalContext } from "../../../src/lib/proposals/context-collector.ts";
import type { ProposalQuestionnaire } from "../../../src/lib/proposals/prompt.ts";

function merge(existing: Partial<ProposalQuestionnaire>, context: LeadProposalContext) {
  return mergeContextIntoQuestionnaire<Partial<ProposalQuestionnaire>>(existing, context);
}

function fixtureContext(overrides: Partial<LeadProposalContext["lead"]> = {}): LeadProposalContext {
  return {
    lead: {
      id: "lead-1", company_id: null, name: "Ali Abdulmalik", company: "Abdulmalik Beyaz Eşya Teknik Servis",
      phone: "5551112233", email: null, instagram: null, website: null,
      business_type: "BEYAZ EŞYA TEKNİK SERVİS", sector: "BEYAZ EŞYA TEKNİK SERVİS", city: "Manisa", district: "Şehzadeler",
      address: null, goal: "Telefon Araması", budget: "10000", message: "Tamir ve satış hizmeti veriyoruz.",
      notes: null, status: "Yeni", google_maps_url: null, requested_platforms: ["Google Ads"],
      competitor_notes: null, created_at: "2026-10-01T00:00:00.000Z",
      ...overrides
    },
    preAudit: null,
    instagram: null,
    adEvaluation: null,
    completeness: { lead: true, preAudit: false, instagram: false, adEvaluation: false, competitors: false, budget: true },
    sources: [],
    notes: []
  };
}

test("TEST 1 — lead exists, no reports: basic fields are prefilled from the lead alone", () => {
  const { questionnaire, filledFields } = merge({}, fixtureContext());
  assert.equal(questionnaire.business?.name, "Abdulmalik Beyaz Eşya Teknik Servis");
  assert.equal(questionnaire.business?.sector, "BEYAZ EŞYA TEKNİK SERVİS");
  assert.equal(questionnaire.business?.city, "Manisa");
  assert.deepEqual(questionnaire.objectives, ["Telefon Araması"]);
  assert.deepEqual(questionnaire.platforms, ["Google Ads"]);
  assert.ok(filledFields.includes("business.name"));
});

test("never overwrites a manually-edited, already-non-empty field (TEST 11 behavior)", () => {
  const existing = { business: { name: "Manuel Olarak Girilen İsim", sector: "" } };
  const { questionnaire, filledFields } = merge(existing, fixtureContext());
  assert.equal(questionnaire.business?.name, "Manuel Olarak Girilen İsim", "a manually-entered name must survive a refresh");
  assert.equal(questionnaire.business?.sector, "BEYAZ EŞYA TEKNİK SERVİS", "an empty field is still filled");
  assert.ok(!filledFields.includes("business.name"));
  assert.ok(filledFields.includes("business.sector"));
});

test("re-running the merge on an already-fully-filled questionnaire changes nothing (idempotent refresh)", () => {
  const first = merge({}, fixtureContext());
  const second = merge(first.questionnaire, fixtureContext());
  assert.deepEqual(second.questionnaire, first.questionnaire);
  assert.deepEqual(second.filledFields, []);
});

test("objectives/platforms arrays are only auto-filled when genuinely empty, never appended to an existing manual selection", () => {
  const existing = { objectives: ["Lead Toplama"], platforms: ["Meta Ads"] };
  const { questionnaire, filledFields } = merge(existing, fixtureContext());
  assert.deepEqual(questionnaire.objectives, ["Lead Toplama"]);
  assert.deepEqual(questionnaire.platforms, ["Meta Ads"]);
  assert.ok(!filledFields.includes("objectives"));
  assert.ok(!filledFields.includes("platforms"));
});
