"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount pattern, same accepted precedent as InstagramIntelligencePanel.tsx */

import { useCallback, useEffect, useState } from "react";
import { PlusCircle, FileEdit } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";
import { ManualEvaluationModal } from "./ManualEvaluationModal";
import { MODULE_LABELS, type ManualEvaluationModule, type ManualEvaluationRecord } from "@/lib/manual-evaluations-shared";

// Drop-in "+ Manuel Değerlendirme" button + history list for a single
// Reklam Doktoru Pro tab. Self-contained (fetches its own history), so
// wiring a new module into a tab is a one-line addition.
export function ManualEvaluationSection({ module, companyId, leadId, targetLabel, prefillData }: { module: ManualEvaluationModule; companyId?: string | null; leadId?: string | null; targetLabel?: string; prefillData?: Record<string, unknown> }) {
  const [history, setHistory] = useState<ManualEvaluationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<ManualEvaluationRecord | "new" | null>(null);

  const load = useCallback(async () => {
    if (!companyId && !leadId) { setHistory([]); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ module });
      if (companyId) params.set("companyId", companyId);
      if (leadId) params.set("leadId", leadId);
      const res = await fetch(`/api/admin/manual-evaluations?${params.toString()}`);
      const body = await res.json();
      if (res.ok) setHistory(body.evaluations || []);
    } finally {
      setLoading(false);
    }
  }, [module, companyId, leadId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-black">Manuel Değerlendirmeler — {MODULE_LABELS[module]}</p>
        <AdminButton variant="secondary" compact icon={<PlusCircle size={14} />} onClick={() => setOpen("new")}>+ Manuel Değerlendirme</AdminButton>
      </div>
      {loading && <p className="mt-2 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>Yükleniyor...</p>}
      {!loading && history.length === 0 && (companyId || leadId) && <p className="mt-2 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>Henüz manuel değerlendirme yok.</p>}
      {!loading && !companyId && !leadId && <p className="mt-2 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>Geçmişi görmek için bir müşteri/aday seçin — yine de bağımsız (müşteri olmayan) bir manuel değerlendirme oluşturabilirsiniz.</p>}
      {history.length > 0 && (
        <div className="mt-3 grid gap-1.5">
          {history.map((item) => (
            <button key={item.id} type="button" onClick={() => setOpen(item)} className="flex items-center justify-between gap-2 rounded-[10px] border p-2.5 text-left text-sm font-bold" style={{ borderColor: "var(--admin-border)" }}>
              <span className="flex min-w-0 items-center gap-2">
                <FileEdit size={14} className="shrink-0" />
                <span className="truncate">{item.title || "(başlıksız)"}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <AdminStatusBadge tone={item.status === "submitted" ? "success" : "warning"}>{item.status === "submitted" ? "Tamamlandı" : "Taslak"}</AdminStatusBadge>
                <span style={{ color: "var(--admin-text-muted)" }}>{new Date(item.created_at).toLocaleDateString("tr-TR")}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {open && (
        <ManualEvaluationModal
          module={module}
          companyId={companyId}
          leadId={leadId}
          targetLabel={targetLabel}
          existing={open === "new" ? null : open}
          prefillData={open === "new" ? prefillData : undefined}
          onClose={() => setOpen(null)}
          onSaved={() => { load(); }}
        />
      )}
    </div>
  );
}
