import test from "node:test";
import assert from "node:assert/strict";
import { safeCompare } from "../../src/lib/secure-compare.ts";

test("safeCompare: matching secrets return true", () => {
  assert.equal(safeCompare("super-secret-token", "super-secret-token"), true);
});

test("safeCompare: non-matching equal-length secrets return false", () => {
  assert.equal(safeCompare("aaaaaaaaaa", "bbbbbbbbbb"), false);
});

test("safeCompare: non-matching different-length secrets return false", () => {
  assert.equal(safeCompare("short", "a-much-longer-value"), false);
});

test("safeCompare: empty values return false", () => {
  assert.equal(safeCompare("", ""), false);
  assert.equal(safeCompare("", "something"), false);
  assert.equal(safeCompare("something", ""), false);
});

test("safeCompare: undefined/null values return false without throwing", () => {
  assert.equal(safeCompare(undefined, "value"), false);
  assert.equal(safeCompare("value", undefined), false);
  assert.equal(safeCompare(null, null), false);
  assert.equal(safeCompare(undefined, undefined), false);
});

test("safeCompare: malformed authorization-header-derived values do not throw", () => {
  assert.doesNotThrow(() => safeCompare("Bearer", "Bearer extra-token"));
  assert.equal(safeCompare("Bearer", "Bearer extra-token"), false);
});
