"use client";

import { Building2, MapPin } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

type Branch = {
  id: string;
  branch_name: string;
  city?: string | null;
  district?: string | null;
};

export function CustomerBranchSelector({
  branches,
  selectedBranchId,
  allowAll
}: {
  branches: Branch[];
  selectedBranchId: string | null;
  allowAll: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedValue = selectedBranchId || (allowAll ? "all" : branches[0]?.id || "");

  const selectBranch = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("branch", value);
    window.localStorage.setItem("hk-customer-branch", value);
    router.push(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (searchParams.has("branch") || !branches.length) return;
    const stored = window.localStorage.getItem("hk-customer-branch");
    const valid = stored === "all" ? allowAll : branches.some((branch) => branch.id === stored);
    if (stored && valid && stored !== selectedValue) selectBranch(stored);
  }, [allowAll, branches, searchParams, selectBranch, selectedValue]);

  if (!branches.length) return null;

  const selected = branches.find((branch) => branch.id === selectedBranchId);
  if (branches.length === 1 && !allowAll) {
    return (
      <div className="flex min-w-0 items-center gap-3 rounded-[14px] border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
        <MapPin size={18} className="shrink-0 text-cyan-700" />
        <span className="min-w-0"><strong className="block truncate">Görüntülenen şube: {selected?.branch_name || branches[0].branch_name}</strong><span className="block truncate text-xs text-cyan-700">{[selected?.district || branches[0].district, selected?.city || branches[0].city].filter(Boolean).join(" / ") || "Aktif şube"}</span></span>
      </div>
    );
  }

  return (
    <label className="grid min-w-0 gap-1.5 rounded-[14px] border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-950">
      <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-cyan-700"><Building2 size={15} /> Şube seçimi</span>
      <select value={selectedValue} onChange={(event) => selectBranch(event.target.value)} className="min-h-11 w-full min-w-0 rounded-[10px] border border-cyan-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-cyan-200">
        {allowAll && <option value="all">Tüm Şubeler</option>}
        {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branch_name}{branch.district || branch.city ? ` · ${[branch.district, branch.city].filter(Boolean).join(" / ")}` : ""}</option>)}
      </select>
    </label>
  );
}
