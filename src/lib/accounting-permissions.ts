export type AccountingSessionLike = {
  role?: string | null;
  allowedModules?: string[] | null;
} | null | undefined;

export function normalizeAccountingRole(role?: string | null) {
  if (role === "owner" || role === "finance" || role === "admin") return role;
  return role || "admin";
}

export function canViewAccounting(session?: AccountingSessionLike) {
  const role = normalizeAccountingRole(session?.role);
  const allowed = Array.isArray(session?.allowedModules) ? session.allowedModules : [];
  return role === "admin" || role === "owner" || role === "finance" || allowed.includes("muhasebe") || allowed.includes("muhasebe-export");
}
