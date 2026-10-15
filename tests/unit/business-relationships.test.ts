import test from "node:test";
import assert from "node:assert/strict";
import {
  BusinessRelationshipValidationError,
  buildRelationshipRow,
  isDuplicatePair,
  normalizeInstagram,
  otherSideOf,
  parseEntityRef,
  relationshipChild,
  relationshipParent,
  sanitizeUnitInput,
  type BusinessRelationshipRecord
} from "../../src/lib/business-relationships-shared.ts";

// Isolated fixtures only — never real lead/customer ids.
const LEAD = "11111111-1111-4111-8111-111111111111";
const COMPANY = "22222222-2222-4222-8222-222222222222";
const UNIT = "33333333-3333-4333-8333-333333333333";
const OTHER_LEAD = "44444444-4444-4444-8444-444444444444";

function row(partial: Partial<BusinessRelationshipRecord>): BusinessRelationshipRecord {
  return { id: "r", relationship_type: "related_brand", parent_lead_id: null, parent_company_id: null, parent_unit_id: null, child_lead_id: null, child_company_id: null, child_unit_id: null, notes: "", created_at: "", ...partial };
}

test("branch form: name required, unknown keys dropped, instagram normalized", () => {
  const unit = sanitizeUnitInput({ name: "  Robotik45  ", instagram: "https://instagram.com/robotik45/", phone: "0555", hack: "x" }, true);
  assert.deepEqual(unit, { name: "Robotik45", instagram: "@robotik45", phone: "0555" });
  assert.throws(() => sanitizeUnitInput({ instagram: "@x" }, true), BusinessRelationshipValidationError);
  assert.throws(() => sanitizeUnitInput({ name: "   " }, false), BusinessRelationshipValidationError);
  assert.throws(() => sanitizeUnitInput({ name: "a", description: "x".repeat(2001) }, true), BusinessRelationshipValidationError);
  assert.throws(() => sanitizeUnitInput({ name: { $ne: 1 } as unknown as string }, true), BusinessRelationshipValidationError);
});

test("instagram normalization", () => {
  assert.equal(normalizeInstagram("@@zirveakademi45"), "@zirveakademi45");
  assert.equal(normalizeInstagram("zirveakademi45"), "@zirveakademi45");
  assert.equal(normalizeInstagram("   "), "");
});

test("entity refs reject invalid types and ids", () => {
  assert.deepEqual(parseEntityRef("lead", LEAD), { type: "lead", id: LEAD });
  assert.throws(() => parseEntityRef("users", LEAD), BusinessRelationshipValidationError);
  assert.throws(() => parseEntityRef("lead", "not-a-uuid"), BusinessRelationshipValidationError);
});

test("related brand row keeps an explicit type and exactly one parent/child column", () => {
  const built = buildRelationshipRow({ type: "lead", id: LEAD }, { type: "unit", id: UNIT }, "related_brand");
  assert.equal(built.relationship_type, "related_brand");
  assert.equal(built.parent_lead_id, LEAD);
  assert.equal(built.child_unit_id, UNIT);
  assert.equal([built.parent_company_id, built.parent_unit_id, built.child_lead_id, built.child_company_id].every((value) => value === null), true);
});

test("self-links and invalid relationship types are rejected", () => {
  assert.throws(() => buildRelationshipRow({ type: "lead", id: LEAD }, { type: "lead", id: LEAD }, "branch"), BusinessRelationshipValidationError);
  assert.throws(() => buildRelationshipRow({ type: "lead", id: LEAD }, { type: "unit", id: UNIT }, "merge" as never), BusinessRelationshipValidationError);
});

test("duplicate prevention works in both directions", () => {
  const existing = [row({ parent_lead_id: LEAD, child_unit_id: UNIT })];
  assert.equal(isDuplicatePair(existing, { type: "lead", id: LEAD }, { type: "unit", id: UNIT }), true);
  assert.equal(isDuplicatePair(existing, { type: "unit", id: UNIT }, { type: "lead", id: LEAD }), true);
  assert.equal(isDuplicatePair(existing, { type: "lead", id: LEAD }, { type: "lead", id: OTHER_LEAD }), false);
});

test("lead-to-customer consistency: relationships added on the lead are visible from the converted company", () => {
  const relation = row({ parent_lead_id: LEAD, child_unit_id: UNIT });
  // Customer view resolves self ids as [companyId, ...leads converted into it].
  const side = otherSideOf(relation, [COMPANY, LEAD]);
  assert.deepEqual(side, { entity: { type: "unit", id: UNIT }, direction: "child" });
  // The linked unit sees its parent the other way round.
  assert.deepEqual(otherSideOf(relation, [UNIT]), { entity: { type: "lead", id: LEAD }, direction: "parent" });
  assert.equal(otherSideOf(relation, [OTHER_LEAD]), null);
});

test("parent/child resolution for every entity type", () => {
  assert.deepEqual(relationshipParent(row({ parent_company_id: COMPANY, child_lead_id: LEAD })), { type: "company", id: COMPANY });
  assert.deepEqual(relationshipChild(row({ parent_company_id: COMPANY, child_lead_id: LEAD })), { type: "lead", id: LEAD });
  assert.deepEqual(relationshipParent(row({ parent_unit_id: UNIT, child_lead_id: LEAD })), { type: "unit", id: UNIT });
});
