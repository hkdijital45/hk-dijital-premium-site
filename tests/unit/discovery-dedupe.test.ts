import test from "node:test";
import assert from "node:assert/strict";
import { dedupePlacesById } from "../../src/lib/discovery-dedupe.ts";

test("dedupePlacesById: keeps the first occurrence and drops later duplicates of the same place_id", () => {
  const result = dedupePlacesById([
    { place_id: "a", name: "First" },
    { place_id: "b", name: "Second" },
    { place_id: "a", name: "Duplicate of first" }
  ]);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((item) => item.name), ["First", "Second"]);
});

test("dedupePlacesById: merges multiple pages of results, deduplicating across all of them", () => {
  const page1 = [{ place_id: "a" }, { place_id: "b" }];
  const page2 = [{ place_id: "b" }, { place_id: "c" }];
  const page3 = [{ place_id: "c" }, { place_id: "d" }];
  const merged = dedupePlacesById([...page1, ...page2, ...page3]);
  assert.deepEqual(merged.map((item) => item.place_id), ["a", "b", "c", "d"]);
});

test("dedupePlacesById: never drops a result with no place_id at all", () => {
  const result = dedupePlacesById<{ place_id?: string; name: string }>([{ name: "No id 1" }, { name: "No id 2" }]);
  assert.equal(result.length, 2);
});

test("dedupePlacesById: an empty input returns an empty array", () => {
  assert.deepEqual(dedupePlacesById([]), []);
});
