import test from "node:test";
import assert from "node:assert/strict";
import { PROPOSAL_TRANSITIONS, PROPOSAL_STATUSES } from "../../../src/lib/proposals/store.ts";

test("PROPOSAL_TRANSITIONS: every status in the graph is a real PROPOSAL_STATUSES value", () => {
  for (const [from, targets] of Object.entries(PROPOSAL_TRANSITIONS)) {
    assert.ok((PROPOSAL_STATUSES as readonly string[]).includes(from), `${from} is not a real status`);
    for (const target of targets) assert.ok((PROPOSAL_STATUSES as readonly string[]).includes(target), `${target} is not a real status`);
  }
});

test("a proposal can never jump straight from Taslak to Kabul Edildi/Reddedildi (must go through Gönderildi)", () => {
  assert.equal(PROPOSAL_TRANSITIONS["Taslak"].includes("Kabul Edildi"), false);
  assert.equal(PROPOSAL_TRANSITIONS["Taslak"].includes("Reddedildi"), false);
});

test("Kabul Edildi and Reddedildi are terminal (no further transitions)", () => {
  assert.deepEqual(PROPOSAL_TRANSITIONS["Kabul Edildi"], []);
  assert.deepEqual(PROPOSAL_TRANSITIONS["Reddedildi"], []);
});

test("Gönderildi is the only state that can move to Kabul Edildi or Reddedildi", () => {
  for (const [status, targets] of Object.entries(PROPOSAL_TRANSITIONS)) {
    if (status === "Gönderildi") continue;
    assert.equal(targets.includes("Kabul Edildi"), false, `${status} should not be able to reach Kabul Edildi directly`);
    assert.equal(targets.includes("Reddedildi"), false, `${status} should not be able to reach Reddedildi directly`);
  }
});

test("a sent proposal (Süresi Doldu/terminal states) can still start a revision", () => {
  assert.ok(PROPOSAL_TRANSITIONS["Süresi Doldu"].includes("Revize Ediliyor"));
});
