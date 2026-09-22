import test from "node:test";
import assert from "node:assert/strict";
import {
  DISCOVERY_WORKFLOW_STATUS, DISCOVERY_WORKFLOW_STATUSES, DISCOVERY_REJECTION_REASONS,
  isValidDiscoveryWorkflowTransition
} from "../../src/lib/discovery-workflow.ts";

test("DISCOVERY_WORKFLOW_STATUS: three distinct evaluation-gate statuses, all included in DISCOVERY_WORKFLOW_STATUSES", () => {
  assert.equal(DISCOVERY_WORKFLOW_STATUS.SAVED_FOR_REVIEW, "Değerlendirmede");
  assert.equal(DISCOVERY_WORKFLOW_STATUS.POTENTIAL, "Potansiyel Müşteri");
  assert.equal(DISCOVERY_WORKFLOW_STATUS.REJECTED, "Reddedildi");
  assert.equal(new Set(Object.values(DISCOVERY_WORKFLOW_STATUS)).size, 3, "no duplicate status strings");
  for (const value of Object.values(DISCOVERY_WORKFLOW_STATUS)) {
    assert.ok(DISCOVERY_WORKFLOW_STATUSES.includes(value));
  }
});

test("isValidDiscoveryWorkflowTransition: Kaydet's initial SAVED_FOR_REVIEW -> POTENTIAL (Onayla) is allowed", () => {
  assert.equal(isValidDiscoveryWorkflowTransition(DISCOVERY_WORKFLOW_STATUS.POTENTIAL, DISCOVERY_WORKFLOW_STATUS.SAVED_FOR_REVIEW), true);
});

test("isValidDiscoveryWorkflowTransition: SAVED_FOR_REVIEW -> REJECTED (Reddet) is allowed", () => {
  assert.equal(isValidDiscoveryWorkflowTransition(DISCOVERY_WORKFLOW_STATUS.REJECTED, DISCOVERY_WORKFLOW_STATUS.SAVED_FOR_REVIEW), true);
});

test("isValidDiscoveryWorkflowTransition: POTENTIAL -> REJECTED (rejecting a potential customer) is allowed", () => {
  assert.equal(isValidDiscoveryWorkflowTransition(DISCOVERY_WORKFLOW_STATUS.REJECTED, DISCOVERY_WORKFLOW_STATUS.POTENTIAL), true);
});

test("isValidDiscoveryWorkflowTransition REGRESSION — REJECTED cannot jump straight to POTENTIAL (must go through a fresh save/evaluation)", () => {
  assert.equal(isValidDiscoveryWorkflowTransition(DISCOVERY_WORKFLOW_STATUS.POTENTIAL, DISCOVERY_WORKFLOW_STATUS.REJECTED), false);
});

test("isValidDiscoveryWorkflowTransition REGRESSION — a brand-new lead (no prior status) cannot be created directly as POTENTIAL, skipping evaluation", () => {
  assert.equal(isValidDiscoveryWorkflowTransition(DISCOVERY_WORKFLOW_STATUS.POTENTIAL, null), false);
  assert.equal(isValidDiscoveryWorkflowTransition(DISCOVERY_WORKFLOW_STATUS.POTENTIAL, undefined), false);
  assert.equal(isValidDiscoveryWorkflowTransition(DISCOVERY_WORKFLOW_STATUS.POTENTIAL, "Yeni Lead"), false);
});

test("isValidDiscoveryWorkflowTransition: re-applying the same status is always idempotent, never rejected", () => {
  assert.equal(isValidDiscoveryWorkflowTransition(DISCOVERY_WORKFLOW_STATUS.POTENTIAL, DISCOVERY_WORKFLOW_STATUS.POTENTIAL), true);
  assert.equal(isValidDiscoveryWorkflowTransition(DISCOVERY_WORKFLOW_STATUS.REJECTED, DISCOVERY_WORKFLOW_STATUS.REJECTED), true);
});

test("isValidDiscoveryWorkflowTransition: a status this module doesn't gate (a normal sales-pipeline stage) is never restricted", () => {
  assert.equal(isValidDiscoveryWorkflowTransition("Teklif Gönderildi", "Yeni Lead"), true);
  assert.equal(isValidDiscoveryWorkflowTransition("Kazanıldı", null), true);
});

test("DISCOVERY_REJECTION_REASONS: includes the required optional reasons and an 'Other' escape hatch", () => {
  assert.ok(DISCOVERY_REJECTION_REASONS.includes("Dijital ihtiyacı düşük"));
  assert.ok(DISCOVERY_REJECTION_REASONS.includes("Diğer"));
  assert.equal(new Set(DISCOVERY_REJECTION_REASONS).size, DISCOVERY_REJECTION_REASONS.length, "no duplicate reasons");
});
