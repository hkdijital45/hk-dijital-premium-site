import { supabaseRest } from "@/lib/supabase";
import { getCompanyActiveBranches } from "@/lib/server/branch-access";

export type CustomerBranchAccessInput = {
  mode: "selected" | "all";
  branchIds: string[];
  defaultBranchId: string | null;
};

export async function validateCustomerBranchAccessPayload(payload: Record<string, unknown>, companyId: string) {
  const mode = payload.branchAccessMode === "all" || payload.branch_access_mode === "all" ? "all" : "selected";
  const rawIds = Array.isArray(payload.branchIds) ? payload.branchIds : Array.isArray(payload.branch_ids) ? payload.branch_ids : [];
  const branchIds = [...new Set(rawIds.map((value) => String(value || "").trim()).filter(Boolean))];
  const defaultBranchId = String(payload.defaultBranchId || payload.default_branch_id || "").trim() || null;
  const activeBranches = await getCompanyActiveBranches(companyId);
  const activeIds = new Set(activeBranches.map((branch) => branch.id));

  if (mode === "selected" && branchIds.length === 0) {
    throw new Error(activeBranches.length
      ? "Seçili şube erişiminde en az bir aktif şube seçilmelidir."
      : "Bu firmaya ait aktif şube bulunamadı. Önce firma profiline şube ekleyin.");
  }
  if (branchIds.some((branchId) => !activeIds.has(branchId))) {
    throw new Error("Başka firmaya ait, pasif veya geçersiz bir şube seçildi.");
  }
  if (defaultBranchId && !activeIds.has(defaultBranchId)) {
    throw new Error("Varsayılan şube seçilen firmaya ait ve aktif olmalıdır.");
  }
  if (mode === "selected" && defaultBranchId && !branchIds.includes(defaultBranchId)) {
    throw new Error("Varsayılan şube yetkili şubeler arasında olmalıdır.");
  }

  return { mode, branchIds: mode === "selected" ? branchIds : [], defaultBranchId } satisfies CustomerBranchAccessInput;
}

export async function persistCustomerBranchAccess(userId: string, companyId: string, access: CustomerBranchAccessInput) {
  await supabaseRest("rpc/set_customer_user_branch_access", {
    method: "POST",
    body: JSON.stringify({
      p_user_id: userId,
      p_company_id: companyId,
      p_mode: access.mode,
      p_branch_ids: access.branchIds,
      p_default_branch_id: access.defaultBranchId
    })
  });
}

export function hasBranchAccessPayload(payload: Record<string, unknown>) {
  return payload.branchAccessMode !== undefined
    || payload.branch_access_mode !== undefined
    || payload.branchIds !== undefined
    || payload.branch_ids !== undefined
    || payload.defaultBranchId !== undefined
    || payload.default_branch_id !== undefined;
}
