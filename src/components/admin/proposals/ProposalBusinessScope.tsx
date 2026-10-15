"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount pattern, same accepted precedent as ManualEvaluationSection.tsx */

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { RELATIONSHIP_LABELS, type LinkedBusiness } from "@/lib/business-relationships-shared";
import type { ProposalBusinessScopeItem, ProposalBusinessServiceLine } from "@/lib/proposals/business-scope";

// Teklif Kapsamı — pick which of the target's real linked businesses (from
// İşletme ve Şube Yönetimi) this proposal covers, plus optional explicit
// per-business service lines. Nothing here changes a price by itself: a
// business only costs money through a service line the user types in.

type Option = ProposalBusinessScopeItem;

function useScopeOptions(leadId: string | null | undefined, companyId: string | null | undefined, targetLabel: string) {
  const [options, setOptions] = useState<Option[]>([]);
  const [error, setError] = useState("");
  const ownerType = leadId ? "lead" : "company";
  const ownerId = leadId || companyId || "";
  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    fetch(`/api/admin/business-relationships?type=${ownerType}&id=${ownerId}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) { setError(body.error || "Bağlı işletmeler okunamadı."); return; }
        const linked: Option[] = (body.businesses || []).map((item: LinkedBusiness) => ({
          key: `${item.entity.type}:${item.entity.id}`,
          name: item.name,
          role: item.relationshipType,
          instagram: item.instagram
        }));
        setOptions([{ key: `${ownerType}:${ownerId}`, name: targetLabel, role: "main" }, ...linked]);
      })
      .catch(() => { if (!cancelled) setError("Bağlı işletmeler okunamadı."); });
    return () => { cancelled = true; };
  }, [ownerType, ownerId, targetLabel]);
  return { options, error };
}

const roleLabel = (role: Option["role"]) => (role === "main" ? "Ana işletme" : RELATIONSHIP_LABELS[role]);

export function ProposalScopeSelector({ leadId, companyId, targetLabel, scope, locked, onChange }: { leadId?: string | null; companyId?: string | null; targetLabel: string; scope: ProposalBusinessScopeItem[] | undefined; locked: boolean; onChange: (scope: ProposalBusinessScopeItem[]) => void }) {
  const { options, error } = useScopeOptions(leadId, companyId, targetLabel);
  if (error) return <p className="text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>Teklif kapsamı: {error}</p>;
  if (options.length <= 1) return null; // no linked businesses → single-business proposal, unchanged UI

  // No saved scope = legacy/single-business proposal = main business only.
  const selected = new Set((scope && scope.length ? scope : options.slice(0, 1)).map((item) => item.key));
  function toggle(option: Option) {
    const next = new Set(selected);
    if (next.has(option.key)) next.delete(option.key); else next.add(option.key);
    if (!next.size) return; // at least one business must stay in scope
    onChange(options.filter((item) => next.has(item.key)));
  }

  return (
    <div className="rounded-[10px] border p-3 sm:col-span-2" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }}>
      <p className="text-sm font-black">Teklif Kapsamı</p>
      <p className="mt-0.5 text-xs" style={{ color: "var(--admin-text-muted)" }}>Teklifin hangi işletmeleri kapsadığını seçin. Seçim fiyatı otomatik değiştirmez; ek ücret yalnızca Reklam Bütçesi adımındaki işletme bazlı hizmet kalemlerinden gelir.</p>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {options.map((option) => (
          <label key={option.key} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[8px] border px-3 py-2 text-sm font-bold" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-text-primary)" }}>
            <input type="checkbox" className="size-4" checked={selected.has(option.key)} disabled={locked} onChange={() => toggle(option)} />
            <span className="min-w-0"><span className="block truncate">{option.name}</span><span className="block text-xs" style={{ color: "var(--admin-text-muted)" }}>{roleLabel(option.role)}{option.instagram ? ` · ${option.instagram}` : ""}</span></span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function ProposalServiceLinesEditor({ scope, lines, duplicatesIgnored, locked, onChange }: { scope: ProposalBusinessScopeItem[]; lines: ProposalBusinessServiceLine[]; duplicatesIgnored: number; locked: boolean; onChange: (lines: ProposalBusinessServiceLine[]) => void }) {
  if (scope.length <= 1) return null;
  const inputClass = "min-h-10 w-full rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm font-bold text-[var(--admin-text-primary)]";
  const update = (index: number, patch: Partial<ProposalBusinessServiceLine>) => onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  return (
    <div className="mt-4 rounded-[10px] border p-3" style={{ borderColor: "var(--admin-border)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-black">İşletme Bazlı Hizmet Kalemleri (KDV hariç)</p>
        <button type="button" disabled={locked} onClick={() => onChange([...lines, { businessKey: scope[0].key, description: "", monthlyFee: 0, setupFee: 0 }])} className="hk-button hk-button-neutral hk-button-compact"><Plus size={14} /> Kalem Ekle</button>
      </div>
      <p className="mt-0.5 text-xs" style={{ color: "var(--admin-text-muted)" }}>Yalnızca ek işletmeye özel hizmetleri ekleyin. Yukarıdaki ajans ücreti zaten ana kapsamı karşılar; aynı hizmet aynı işletme için iki kez faturalandırılmaz.</p>
      {duplicatesIgnored > 0 && <p className="mt-2 rounded-[8px] border p-2 text-xs font-bold" style={{ borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" }}>{duplicatesIgnored} tekrar eden kalem hesaplamaya dahil edilmedi.</p>}
      <div className="mt-2 grid gap-2">
        {lines.map((line, index) => (
          <div key={index} className="grid gap-2 rounded-[8px] border p-2 sm:grid-cols-[1fr_1.4fr_0.8fr_0.8fr_auto]" style={{ borderColor: "var(--admin-border)" }}>
            <select className={inputClass} value={line.businessKey} disabled={locked} onChange={(e) => update(index, { businessKey: e.target.value })} aria-label="İşletme">
              {scope.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
            </select>
            <input className={inputClass} value={line.description} disabled={locked} onChange={(e) => update(index, { description: e.target.value })} placeholder="Hizmet (örn. Instagram yönetimi)" aria-label="Hizmet" maxLength={300} />
            <input type="number" min={0} inputMode="decimal" className={inputClass} value={line.monthlyFee || ""} disabled={locked} onChange={(e) => update(index, { monthlyFee: Number(e.target.value) || 0 })} placeholder="Aylık TL" aria-label="Aylık ücret" />
            <input type="number" min={0} inputMode="decimal" className={inputClass} value={line.setupFee || ""} disabled={locked} onChange={(e) => update(index, { setupFee: Number(e.target.value) || 0 })} placeholder="Kurulum TL" aria-label="Kurulum ücreti" />
            <button type="button" disabled={locked} onClick={() => onChange(lines.filter((_, i) => i !== index))} className="hk-button hk-button-neutral hk-button-compact" aria-label="Kalemi sil"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
