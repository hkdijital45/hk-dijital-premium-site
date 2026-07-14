export type CustomerVisibilityRecord = {
  id?: string | null;
  status?: string | null;
  archived_at?: string | null;
  deleted_at?: string | null;
};

function normalizedStatus(value: unknown) {
  return String(value || "").trim().toLocaleLowerCase("tr-TR");
}

export function isArchivedCustomer(customer: CustomerVisibilityRecord | null | undefined) {
  const status = normalizedStatus(customer?.status);
  return Boolean(customer?.archived_at) || ["arşivli", "arşivlendi", "arsivli", "arsivlendi", "archived"].includes(status);
}

export function isDeletedCustomer(customer: CustomerVisibilityRecord | null | undefined) {
  return Boolean(customer?.deleted_at) || ["silindi", "deleted"].includes(normalizedStatus(customer?.status));
}

// Passive customers remain distinct from archived customers and are intentionally selectable.
export function isSelectableCustomer(customer: CustomerVisibilityRecord | null | undefined) {
  return Boolean(customer?.id) && !isArchivedCustomer(customer) && !isDeletedCustomer(customer);
}

export function filterSelectableCustomers<T extends readonly unknown[]>(customers: T | null | undefined): Array<T[number]> {
  return Array.from(customers || []).filter((customer) => isSelectableCustomer(customer as CustomerVisibilityRecord)) as Array<T[number]>;
}
