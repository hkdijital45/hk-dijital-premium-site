import test from "node:test";
import assert from "node:assert/strict";
import { TASK_TEMPLATE_CATEGORIES, findTemplate, TASK_TEMPLATE_COUNT } from "../../../src/lib/tasks/templates.ts";

test("8 required categories exist, each with real, non-empty predefined tasks", () => {
  assert.equal(TASK_TEMPLATE_CATEGORIES.length, 8);
  for (const cat of TASK_TEMPLATE_CATEGORIES) {
    assert.ok(cat.templates.length > 0, `${cat.label} must have templates`);
    for (const t of cat.templates) assert.ok(t.title.trim().length > 0);
  }
});

test("every template has a stable, unique id", () => {
  const ids = TASK_TEMPLATE_CATEGORIES.flatMap((c) => c.templates.map((t) => t.id));
  assert.equal(new Set(ids).size, ids.length, "all template ids must be unique");
  assert.equal(ids.length, TASK_TEMPLATE_COUNT);
});

test("findTemplate resolves a real id to its title, and a bad id to undefined (never throws)", () => {
  const first = TASK_TEMPLATE_CATEGORIES[0].templates[0];
  assert.equal(findTemplate(first.id)?.title, first.title);
  assert.equal(findTemplate("not-a-real-id"), undefined);
});
