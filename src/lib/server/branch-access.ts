import { isAdminRole, type AppSession } from "@/lib/auth";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export type CompanyBranch = {
  id: string;
  company_id: string;
  branch_name: string;
  code?: string | null;
  city?: string | null;
  district?: string | null;
  is_active?: boolean | null;
  status?: string | null;
};

export type UserBranchAccess = {
  mode: "selected" | "all";
  companyId: string;
  defaultBranchId: string | null;
  branches: CompanyBranch[];
};

function activeBranchFilter(branch: CompanyBranch) {
  return branch.is_active !== false && !["passive", "pasif", "inactive"].includes(String(branch.status || "active").toLocaleLowerCase("tr"));
}

export async function getCompanyActiveBranches(companyId: string): Promise<CompanyBranch[]> {
  if (!hasSupabaseConfig() || !companyId) return [];
  const rows = await supabaseRest<CompanyBranch[]>(
    `customer_branches?company_id=eq.${encodeURIComponent(companyId)}&select=id,company_id,branch_name,code,city,district,is_active,status&order=branch_name.asc`
  ).catch(() => []);
  return rows.filter(activeBranchFilter);
}

export async function getUserBranchAccess(userId: string, companyId: string): Promise<UserBranchAccess> {
  const fallback: UserBranchAccess = { mode: "selected", companyId, defaultBranchId: null, branches: [] };
  if (!hasSupabaseConfig() || !userId || !companyId) return fallback;

  const [userWithOptionalMode, userFallback, companyBranches, assignments] = await Promise.all([
    supabaseRest<Array<{ id: string; branch_access_mode?: string | null; default_branch_id?: string | null }>>(
      `users?id=eq.${encodeURIComponent(userId)}&company_id=eq.${encodeURIComponent(companyId)}&select=id,branch_access_mode,default_branch_id&limit=1`
    ).catch(() => []),
    supabaseRest<Array<{ id: string }>>(
      `users?id=eq.${encodeURIComponent(userId)}&company_id=eq.${encodeURIComponent(companyId)}&select=id&limit=1`
    ).catch(() => []),
    getCompanyActiveBranches(companyId),
    supabaseRest<Array<{ branch_id: string; is_default?: boolean }>>(
      `customer_user_branches?user_id=eq.${encodeURIComponent(userId)}&company_id=eq.${encodeURIComponent(companyId)}&select=branch_id,is_default`
    ).catch(() => [])
  ]);

  const user = userWithOptionalMode[0];
  if (!user && !userFallback[0]) return fallback;
  const mode = user?.branch_access_mode === "all" ? "all" : "selected";
  const assignmentIds = new Set(assignments.map((item) => item.branch_id));
  const branches = mode === "all" ? companyBranches : companyBranches.filter((branch) => assignmentIds.has(branch.id));
  const assignedDefault = assignments.find((item) => item.is_default)?.branch_id;
  const requestedDefault = user?.default_branch_id || assignedDefault || null;
  const defaultBranchId = branches.some((branch) => branch.id === requestedDefault) ? requestedDefault : branches[0]?.id || null;

  return { mode, companyId, defaultBranchId, branches };
}

export function isAllBranchesAccess(access: UserBranchAccess) {
  return access.mode === "all";
}

export function canAccessBranch(access: UserBranchAccess, branchId?: string | null) {
  if (!branchId) return true;
  if (branchId === "all") return access.mode === "all" || access.branches.length === 0;
  return access.branches.some((branch) => branch.id === branchId);
}

export function getDefaultBranch(access: UserBranchAccess) {
  return access.branches.find((branch) => branch.id === access.defaultBranchId) || access.branches[0] || null;
}

export function normalizeRequestedBranch(access: UserBranchAccess, requestedBranchId?: string | null) {
  if (requestedBranchId === "all" && access.mode === "all") return null;
  if (requestedBranchId && access.branches.some((branch) => branch.id === requestedBranchId)) return requestedBranchId;
  return getDefaultBranch(access)?.id || null;
}

export async function getSessionBranchAccess(session: AppSession, companyId: string) {
  if (isAdminRole(session.role)) {
    const branches = await getCompanyActiveBranches(companyId);
    return { mode: "all" as const, companyId, defaultBranchId: branches[0]?.id || null, branches };
  }
  return getUserBranchAccess(session.profileId || "", companyId);
}

export async function canSessionAccessResourceBranch(session: AppSession, companyId: string, branchId?: string | null) {
  if (isAdminRole(session.role)) return true;
  if (!session.companyId || session.companyId !== companyId) return false;
  if (!branchId) return true;
  const access = await getUserBranchAccess(session.profileId || "", companyId);
  return canAccessBranch(access, branchId);
}
