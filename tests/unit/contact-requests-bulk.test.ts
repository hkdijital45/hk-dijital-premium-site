import test from "node:test";
import assert from "node:assert/strict";
import { buildBulkPlan, contactRequestNotifications, formatApplicationDateTime, parseBulkRequest, unreadContactRequestCount } from "../../src/lib/contact-requests.ts";
import { classifyNotification, isLeadKind } from "../../src/lib/admin-notification-priority.ts";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";
const NOW = "2026-10-06T10:00:00.000Z";

test("bulk payload rejects malformed ids, unknown actions and empty selections", () => {
  assert.equal(parseBulkRequest({ action: "drop_table", ids: [ID_A] }).ok, false);
  assert.equal(parseBulkRequest({ action: "archive", ids: [] }).ok, false);
  assert.equal(parseBulkRequest({ action: "archive" }).ok, false);
  assert.equal(parseBulkRequest({ action: "archive", ids: ["1; DROP TABLE leads"] }).ok, false);
  assert.equal(parseBulkRequest({ action: "archive", ids: Array.from({ length: 201 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`) }).ok, false);
  assert.equal(parseBulkRequest(null).ok, false);
});

test("bulk payload dedupes ids and allows mark_all_read without a selection", () => {
  const parsed = parseBulkRequest({ action: "mark_read", ids: [ID_A, ID_A, ID_B] });
  assert.deepEqual(parsed.ok && parsed.ids, [ID_A, ID_B]);
  const all = parseBulkRequest({ action: "mark_all_read" });
  assert.deepEqual(all.ok && all.ids, []);
});

test("read operations change only read_at, never workflow status", () => {
  const read = buildBulkPlan("mark_read", [ID_A], NOW);
  assert.equal(read.method, "PATCH");
  assert.match(read.path, /read_at=is\.null/);
  assert.deepEqual(read.body, { read_at: NOW });

  const unread = buildBulkPlan("mark_unread", [ID_A], NOW);
  assert.match(unread.path, /read_at=not\.is\.null/);
  assert.deepEqual(unread.body, { read_at: null });

  const all = buildBulkPlan("mark_all_read", [], NOW);
  assert.match(all.path, /^contact_forms\?read_at=is\.null/);
  assert.equal(all.path.includes("id=in"), false);
  assert.deepEqual(all.body, { read_at: NOW });
});

test("status operations never touch converted requests or read state", () => {
  for (const action of ["review", "archive", "spam"] as const) {
    const plan = buildBulkPlan(action, [ID_A, ID_B], NOW);
    assert.match(plan.path, /converted_lead_id=is\.null/);
    assert.ok(plan.path.includes(`status=neq.${encodeURIComponent("Lead'e Dönüştürüldü")}`));
    assert.equal(Object.keys(plan.body ?? {}).includes("read_at"), false);
    assert.ok(plan.body && "status" in plan.body);
  }
});

test("delete targets only the selected contact_forms rows and never leads", () => {
  const plan = buildBulkPlan("delete", [ID_A], NOW);
  assert.equal(plan.method, "DELETE");
  assert.ok(plan.path.startsWith("contact_forms?id=in.("));
  assert.equal(plan.path.includes("leads"), false);
  assert.equal(plan.body, undefined);
});

test("website contact requests produce a notification stamped with created_at", () => {
  const rows = [
    { id: ID_A, company: "MD Deneme", name: "Menekşe Demirci", status: "Yeni", read_at: null, converted_lead_id: null, converted_at: null, created_at: "2026-10-05T06:57:00.000Z", updated_at: "2026-10-06T08:00:00.000Z" },
    { id: ID_B, company: "Okunmuş", name: "Ali", status: "Yeni", read_at: "2026-10-05T07:00:00.000Z", converted_lead_id: null, created_at: "2026-10-04T06:57:00.000Z" }
  ];
  const items = contactRequestNotifications(rows as never);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, `contact-request-${ID_A}`);
  assert.equal(items[0].target, "Gelen Talepler");
  assert.equal(items[0].href, `/hk-admin/gelen-talepler?request=${ID_A}`);
  assert.equal(items[0].appliedAt, "05 Ekim 2026 • 09:57");
  assert.match(items[0].text, /MD Deneme web sitesi üzerinden iletişim formu gönderdi/);
});

test("notifications skip converted, archived and spam requests and summarise overflow", () => {
  const base = { name: "X", company: "Y", read_at: null, converted_lead_id: null, created_at: "2026-10-05T06:57:00.000Z" };
  const rows = [
    { ...base, id: ID_A, status: "Lead'e Dönüştürüldü" },
    { ...base, id: ID_B, status: "Arşivlendi" },
    { ...base, id: "33333333-3333-4333-8333-333333333333", status: "Spam" },
    ...Array.from({ length: 7 }, (_, i) => ({ ...base, id: `00000000-0000-4000-8000-${String(i + 10).padStart(12, "0")}`, status: "Yeni" }))
  ];
  const items = contactRequestNotifications(rows as never, 5);
  assert.equal(items.filter((item) => item.id.startsWith("contact-request-")).length, 5);
  assert.equal(items.at(-1)?.id, "contact-requests-more-2");
});

test("unread count follows read_at only, independent of workflow status", () => {
  const rows = [
    { status: "Yeni", read_at: null },
    { status: "Yeni", read_at: "2026-10-06T08:00:00.000Z" },
    { status: "İnceleniyor", read_at: null },
    { status: "Arşivlendi", read_at: null }
  ];
  assert.equal(unreadContactRequestCount(rows), 3);
});

test("application timestamp is rendered in Europe/Istanbul and stays canonical", () => {
  assert.equal(formatApplicationDateTime("2026-10-05T06:57:00.000Z"), "05 Ekim 2026 • 09:57");
  assert.equal(formatApplicationDateTime(null), "Tarih bilgisi yok");
});

test("contact notifications are classified as high-priority lead-family items", () => {
  const classified = classifyNotification(`contact-request-${ID_A}`);
  assert.equal(classified.kind, "contact_request");
  assert.equal(classified.priority, "high");
  assert.equal(isLeadKind(classified.kind), true);
  assert.equal(classifyNotification("contact-requests-more-3").priority, "normal");
});
