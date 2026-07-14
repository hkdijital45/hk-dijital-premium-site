export type RecordVisibility = "live" | "test" | "all";

export type TestableRecord = {
  is_test?: boolean | null;
};

export function isTestRecord(record: TestableRecord | null | undefined) {
  return record?.is_test === true;
}

export function filterRecordsByVisibility<T extends TestableRecord>(records: T[] | null | undefined, visibility: RecordVisibility = "live") {
  const items = records || [];
  if (visibility === "all") return items;
  return items.filter((record) => isTestRecord(record) === (visibility === "test"));
}

export function excludeTestCompanyRecords<T extends { company_id?: string | null }>(records: T[] | null | undefined, companies: Array<TestableRecord & { id?: string }> | null | undefined) {
  const testCompanyIds = new Set((companies || []).filter(isTestRecord).map((company) => company.id).filter(Boolean));
  return (records || []).filter((record) => !record.company_id || !testCompanyIds.has(record.company_id));
}
