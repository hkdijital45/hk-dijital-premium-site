"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

export function getCompanyBranches(branches: any[] = [], companyId?: string) {
  if (!companyId) return [];
  return branches
    .filter((branch) => branch.company_id === companyId && !branch.deleted_at && !branch.archived_at && branch.status !== "archived")
    .sort((a, b) => String(a.branch_name || "").localeCompare(String(b.branch_name || ""), "tr"));
}

export function buildCustomerBranchQuery(companyId?: string, branchId?: string) {
  return {
    companyId: companyId || "",
    branchId: branchId && branchId !== "all" ? branchId : ""
  };
}

export function CustomerBranchFilter({
  companies,
  branches,
  selectedCompanyId,
  selectedBranchId,
  onCompanyChange,
  onBranchChange,
  compact = false
}: {
  companies: any[];
  branches: any[];
  selectedCompanyId: string;
  selectedBranchId: string;
  onCompanyChange: (companyId: string) => void;
  onBranchChange: (branchId: string) => void;
  compact?: boolean;
}) {
  const companyBranches = getCompanyBranches(branches, selectedCompanyId);
  return (
    <div className={`grid gap-3 ${compact ? "" : "md:grid-cols-2"}`}>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Müşteri
        <select
          value={selectedCompanyId}
          onChange={(event) => {
            onCompanyChange(event.target.value);
            onBranchChange("all");
          }}
          className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900"
        >
          {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Şube
        <select
          value={selectedBranchId || "all"}
          disabled={!selectedCompanyId || !companyBranches.length}
          onChange={(event) => onBranchChange(event.target.value)}
          className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="all">Tüm şubeler</option>
          {companyBranches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.branch_name || "Adsız şube"}{branch.city ? ` · ${branch.city}` : ""}
            </option>
          ))}
        </select>
        {!companyBranches.length && selectedCompanyId && <span className="text-xs font-medium text-slate-500">Bu müşteri için kayıtlı şube yok; işlem tüm müşteri hesabına uygulanır.</span>}
      </label>
    </div>
  );
}
