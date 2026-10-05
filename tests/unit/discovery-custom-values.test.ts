import test from "node:test";
import assert from "node:assert/strict";
import { cleanDiscoveryValue, discoveryEffectiveSearch, discoveryFieldState } from "../../src/lib/discovery-custom-values.ts";
import { businessCategoryLabel } from "../../src/lib/business-category-label.ts";

const DISTRICTS = ["Yunusemre", "Şehzadeler", "Soma"];

test("CASE 1: a known district passes through unchanged", () => {
  assert.equal(discoveryEffectiveSearch({ district: "Yunusemre", businessType: "Nail Studio" }).district, "Yunusemre");
});

test("CASE 2: custom district text becomes the effective district", () => {
  assert.equal(discoveryEffectiveSearch({ district: "  Kula ", businessType: "" }).district, "Kula");
});

test("CASE 3: whitespace or the literal Diğer is never sent as a district", () => {
  assert.equal(cleanDiscoveryValue("   "), "");
  assert.equal(cleanDiscoveryValue("Diğer"), "");
  assert.equal(cleanDiscoveryValue("diğer"), "");
  assert.equal(cleanDiscoveryValue("__other__"), "");
});

test("CASE 4: a normal sector passes through unchanged", () => {
  assert.equal(discoveryEffectiveSearch({ district: "", businessType: "Nail Studio" }).businessType, "Nail Studio");
});

test("CASE 5: a custom sector becomes the effective sector, preserving Turkish characters and multi-word text", () => {
  assert.equal(discoveryEffectiveSearch({ district: "", businessType: " Pet Kuaförü " }).businessType, "Pet Kuaförü");
});

test("CASE 6: an empty custom sector stays empty so validation can block the request", () => {
  assert.equal(discoveryEffectiveSearch({ district: "", businessType: "Diğer" }).businessType, "");
});

test("CASE 7/8: a saved custom value not in the dropdown restores as Diğer with the text kept", () => {
  assert.deepEqual(discoveryFieldState("Kula", DISTRICTS, false), { selectValue: "Diğer", isCustom: true });
  assert.deepEqual(discoveryFieldState("Pet Kuaförü", ["Nail Studio"], false), { selectValue: "Diğer", isCustom: true });
});

test("a saved known value restores as the normal option, even after Diğer was used earlier", () => {
  assert.deepEqual(discoveryFieldState("Soma", DISTRICTS, true), { selectValue: "Soma", isCustom: false });
});

test("Diğer with an empty custom value shows the input without storing a value", () => {
  assert.deepEqual(discoveryFieldState("", DISTRICTS, true), { selectValue: "Diğer", isCustom: true });
  assert.deepEqual(discoveryFieldState("", DISTRICTS, false), { selectValue: "", isCustom: false });
});

test("CASE 9: raw Google categories render as Turkish labels, generic ones are dropped", () => {
  assert.equal(businessCategoryLabel("beauty_salon"), "Güzellik Salonu");
  assert.equal(businessCategoryLabel("establishment, beauty_salon, point_of_interest"), "Güzellik Salonu");
  assert.equal(businessCategoryLabel("dentist"), "Diş Kliniği");
  assert.equal(businessCategoryLabel("establishment, point_of_interest"), "Genel İşletme");
  assert.equal(businessCategoryLabel("Nail Studio"), "Nail Studio");
  assert.equal(businessCategoryLabel(""), "");
  assert.equal(businessCategoryLabel(null), "");
});

test("CASE 10: the internal sentinel never appears in any effective value", () => {
  for (const raw of ["__other__", "other", "custom"]) {
    assert.equal(cleanDiscoveryValue(raw), "");
  }
});
