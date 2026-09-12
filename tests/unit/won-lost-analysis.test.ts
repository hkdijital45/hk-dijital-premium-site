import test from "node:test";
import assert from "node:assert/strict";
import { mergeWonLostDeals, summarizeWonLost } from "../../src/lib/won-lost-analysis.ts";

test("mergeWonLostDeals: a lead won only through the main CRM pipeline is counted once", () => {
  const entries = mergeWonLostDeals({
    leads: [{ id: "lead-1", outcome: "Kazanıldı", sector: "Diş Kliniği", city: "Manisa" }],
    opportunities: [],
    signals: []
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].source, "CRM");
  assert.equal(entries[0].outcome, "Kazanıldı");
});

test("mergeWonLostDeals: an opportunity linked to an already-counted CRM lead is not double-counted", () => {
  const entries = mergeWonLostDeals({
    leads: [{ id: "lead-1", outcome: "Kazanıldı" }],
    opportunities: [{ id: "opp-1", lead_id: "lead-1", won_lost_status: "Kazanıldı" }],
    signals: []
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].source, "CRM");
});

test("mergeWonLostDeals: an opportunity with no linked lead is counted as its own deal", () => {
  const entries = mergeWonLostDeals({
    leads: [],
    opportunities: [{ id: "opp-1", won_lost_status: "Kaybedildi", sector: "Restoran" }],
    signals: []
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].source, "Fırsat Haritası");
  assert.equal(entries[0].outcome, "Kaybedildi");
});

test("mergeWonLostDeals: a learning signal whose opportunity links to an already-counted lead is skipped", () => {
  const entries = mergeWonLostDeals({
    leads: [{ id: "lead-1", outcome: "Kazanıldı" }],
    opportunities: [{ id: "opp-1", lead_id: "lead-1" }],
    signals: [{ id: "sig-1", opportunity_id: "opp-1", outcome: "Kazanıldı" }]
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].source, "CRM");
});

test("mergeWonLostDeals: a learning signal whose opportunity was already counted directly is not duplicated", () => {
  const entries = mergeWonLostDeals({
    leads: [],
    opportunities: [{ id: "opp-1", won_lost_status: "Kazanıldı" }],
    signals: [{ id: "sig-1", opportunity_id: "opp-1", outcome: "Kazanıldı" }]
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].source, "Fırsat Haritası");
});

test("mergeWonLostDeals: a standalone historical signal with no resolvable opportunity is included", () => {
  const entries = mergeWonLostDeals({
    leads: [],
    opportunities: [],
    signals: [{ id: "sig-1", outcome: "Kaybedildi", sector: "Kuaför", loss_reason: "Bütçe yetersiz" }]
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].source, "Fırsat Haritası (geçmiş)");
  assert.equal(entries[0].loss_reason, "Bütçe yetersiz");
});

test("mergeWonLostDeals: open (non-terminal) leads and opportunities are excluded entirely", () => {
  const entries = mergeWonLostDeals({
    leads: [{ id: "lead-1", outcome: null }],
    opportunities: [{ id: "opp-1", pipeline_status: "Araştırılıyor" }],
    signals: [{ id: "sig-1", outcome: null }]
  });
  assert.equal(entries.length, 0);
});

test("summarizeWonLost: computes win rate as won / (won + lost), rounded", () => {
  const entries = mergeWonLostDeals({
    leads: [
      { id: "lead-1", outcome: "Kazanıldı" },
      { id: "lead-2", outcome: "Kazanıldı" },
      { id: "lead-3", outcome: "Kaybedildi" }
    ],
    opportunities: [],
    signals: []
  });
  const { won, lost, winRate } = summarizeWonLost(entries);
  assert.equal(won.length, 2);
  assert.equal(lost.length, 1);
  assert.equal(winRate, 67);
});

test("summarizeWonLost: win rate is null (not NaN or 0) when there are no closed deals at all", () => {
  const { winRate } = summarizeWonLost([]);
  assert.equal(winRate, null);
});
