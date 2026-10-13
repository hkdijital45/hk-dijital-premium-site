"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch/create-on-open pattern, same accepted precedent as ManualEvaluationModal.tsx */

import { useEffect, useState } from "react";
import { X, Copy, ClipboardPaste, Download, Save } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";
import { calculateProposalFinancials, type AdPlatformBudget } from "@/lib/proposals/financials";
import { buildProposalClaudePrompt, type ProposalQuestionnaire } from "@/lib/proposals/prompt";

type Proposal = {
  id: string;
  proposal_number: string;
  status: string;
  target_label: string;
  questionnaire: Partial<ProposalQuestionnaire>;
  financials: ReturnType<typeof calculateProposalFinancials> | Record<string, never>;
};

const PLATFORM_OPTIONS = ["Google Ads", "Meta Ads", "SEO", "Web Sitesi / Landing Page", "Diğer"];
const OBJECTIVE_OPTIONS = ["Telefon Araması", "WhatsApp Konuşması", "Instagram Mesajı", "Lead Toplama", "Web Sitesi Trafiği", "Randevu Talebi", "Mağaza Ziyareti", "Marka Bilinirliği", "Ürün Satışı", "E-ticaret Satışı"];

// Teklif Motoru (Premium Proposal Engine) — the Lead Merkezi entry point.
// Creates/opens the lead's proposal, lets the user fill business +
// platform + objective + budget/fee answers (deterministic financial
// totals computed client-side via the same calculateProposalFinancials
// the server uses), generate/copy the Claude Project prompt, paste the
// validated HK_PROPOSAL_V1 JSON result back in, and download the
// resulting PDF/DOCX — the full API-free workflow in one screen.
export function ProposalModal({ leadId, companyId, targetLabel, onClose }: { leadId?: string | null; companyId?: string | null; targetLabel: string; onClose: () => void }) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [adBudgets, setAdBudgets] = useState<AdPlatformBudget[]>([{ platform: "Google Ads", monthlyBudget: 0 }, { platform: "Meta Ads", monthlyBudget: 0 }]);
  const [agencyFee, setAgencyFee] = useState(0);
  const [setupFee, setSetupFee] = useState(0);
  const [contractMonths, setContractMonths] = useState(1);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [objectives, setObjectives] = useState<string[]>([]);

  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function openOrCreate() {
      setLoading(true);
      setError(null);
      try {
        const listRes = await fetch(`/api/admin/proposals/v2?${leadId ? `leadId=${leadId}` : `companyId=${companyId}`}`);
        const listBody = await listRes.json();
        if (!listRes.ok) throw new Error(listBody.error || "Teklifler alınamadı.");
        let current: Proposal | undefined = listBody.proposals?.[0];
        if (!current) {
          const createRes = await fetch("/api/admin/proposals/v2", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leadId: leadId || null, companyId: companyId || null, targetLabel })
          });
          const createBody = await createRes.json();
          if (!createRes.ok) throw new Error(createBody.error || "Teklif oluşturulamadı.");
          current = createBody.proposal;
        }
        if (!active) return;
        setProposal(current || null);
        if (current?.questionnaire) {
          setPlatforms(current.questionnaire.platforms || []);
          setObjectives(current.questionnaire.objectives || []);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Beklenmeyen hata.");
      } finally {
        if (active) setLoading(false);
      }
    }
    openOrCreate();
    return () => { active = false; };
  }, [leadId, companyId, targetLabel]);

  const financials = calculateProposalFinancials({ adBudgets, agencyMonthlyFee: agencyFee, setupFee, contractMonths });

  async function saveQuestionnaire() {
    if (!proposal) return;
    const questionnaire: Partial<ProposalQuestionnaire> = {
      platforms, objectives,
      budget: { monthlyTotal: financials.totalMonthlyAdBudget, googleAllocation: adBudgets.find((b) => b.platform === "Google Ads")?.monthlyBudget, metaAllocation: adBudgets.find((b) => b.platform === "Meta Ads")?.monthlyBudget },
      fees: { monthlyManagementFee: agencyFee, setupFee, contractDurationMonths: contractMonths }
    };
    const res = await fetch(`/api/admin/proposals/v2/${proposal.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionnaire, data: {}, financials })
    });
    const body = await res.json();
    if (res.ok) setProposal(body.proposal); else setError(body.error || "Kaydedilemedi.");
  }

  async function copyPrompt() {
    await saveQuestionnaire();
    const prompt = buildProposalClaudePrompt({ business: { name: targetLabel }, platforms, objectives, audience: {}, budget: {}, fees: { monthlyManagementFee: agencyFee, setupFee, contractDurationMonths: contractMonths }, strategy: {}, research: {} }, targetLabel);
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard denied */ }
  }

  async function importAnalysis() {
    if (!proposal || !importText.trim()) return;
    setImporting(true);
    setError(null);
    setWarnings([]);
    try {
      const res = await fetch(`/api/admin/proposals/v2/${proposal.id}/import`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: importText })
      });
      const body = await res.json();
      if (!res.ok) { setError(body.details ? `${body.error}\n${body.details.join("\n")}` : body.error || "İçe aktarılamadı."); return; }
      setProposal(body.proposal);
      setWarnings(body.warnings || []);
      setImportText("");
    } finally {
      setImporting(false);
    }
  }

  async function downloadDocument(mode: "internal" | "client", format: "pdf" | "docx") {
    if (!proposal) return;
    setDownloading(`${mode}-${format}`);
    try {
      const res = await fetch(`/api/admin/proposals/v2/${proposal.id}/export`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, format })
      });
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error || "Belge oluşturulamadı."); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${mode}-${format}.${format}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Belge indirilemedi.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/55 p-0 sm:p-4" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="flex h-full w-full flex-col overflow-hidden bg-[var(--admin-surface)] shadow-2xl sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-[1100px] sm:rounded-[20px]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Teklif Motoru</p>
            <h2 className="mt-1 text-xl font-black" style={{ color: "var(--admin-text-primary)" }}>{targetLabel}</h2>
            {proposal && <div className="mt-1 flex items-center gap-2"><AdminStatusBadge tone="info">{proposal.status}</AdminStatusBadge><span className="text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>{proposal.proposal_number}</span></div>}
          </div>
          <button onClick={onClose} aria-label="Kapat" className="grid size-10 shrink-0 place-items-center rounded-full border" style={{ borderColor: "var(--admin-border)" }}><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && <p className="text-sm font-bold" style={{ color: "var(--admin-text-muted)" }}>Yükleniyor...</p>}
          {error && <pre className="mb-4 whitespace-pre-wrap rounded-[10px] border p-3 text-xs font-bold text-[#dc2626]" style={{ borderColor: "#fecaca", background: "#fef2f2" }}>{error}</pre>}
          {warnings.map((w) => <p key={w} className="mb-4 rounded-[10px] border p-3 text-sm font-bold" style={{ borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" }}>{w}</p>)}

          {!loading && proposal && (
            <div className="grid gap-5">
              <fieldset className="rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
                <legend className="px-1 text-sm font-black">Reklam Platformları</legend>
                <div className="flex flex-wrap gap-2">
                  {PLATFORM_OPTIONS.map((p) => (
                    <button key={p} type="button" onClick={() => setPlatforms((cur) => cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p])} className="rounded-full border px-3 py-1.5 text-xs font-black" style={platforms.includes(p) ? { background: "#0891b2", color: "#fff", borderColor: "#0891b2" } : { borderColor: "var(--admin-border)" }}>{p}</button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
                <legend className="px-1 text-sm font-black">Kampanya Hedefleri</legend>
                <div className="flex flex-wrap gap-2">
                  {OBJECTIVE_OPTIONS.map((o) => (
                    <button key={o} type="button" onClick={() => setObjectives((cur) => cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o])} className="rounded-full border px-3 py-1.5 text-xs font-black" style={objectives.includes(o) ? { background: "#0891b2", color: "#fff", borderColor: "#0891b2" } : { borderColor: "var(--admin-border)" }}>{o}</button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
                <legend className="px-1 text-sm font-black">Reklam Bütçesi ve Ajans Ücretleri</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {adBudgets.map((b, i) => (
                    <label key={b.platform}>
                      <span className="mb-1 block text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>{b.platform} Aylık Bütçe (TL)</span>
                      <input type="number" value={b.monthlyBudget || ""} onChange={(e) => setAdBudgets((cur) => cur.map((x, idx) => idx === i ? { ...x, monthlyBudget: Number(e.target.value) || 0 } : x))} className="w-full rounded-[10px] border p-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
                    </label>
                  ))}
                  <label>
                    <span className="mb-1 block text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>Aylık Ajans Yönetim Ücreti (TL)</span>
                    <input type="number" value={agencyFee || ""} onChange={(e) => setAgencyFee(Number(e.target.value) || 0)} className="w-full rounded-[10px] border p-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>Kurulum Ücreti (TL)</span>
                    <input type="number" value={setupFee || ""} onChange={(e) => setSetupFee(Number(e.target.value) || 0)} className="w-full rounded-[10px] border p-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>Sözleşme Süresi (Ay)</span>
                    <input type="number" min={1} value={contractMonths} onChange={(e) => setContractMonths(Number(e.target.value) || 1)} className="w-full rounded-[10px] border p-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
                  </label>
                </div>
                <div className="mt-4 grid gap-2 rounded-[10px] border p-3 text-sm sm:grid-cols-2" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }}>
                  <p>Toplam Aylık Reklam Bütçesi: <strong>{financials.formatted.totalMonthlyAdBudget}</strong></p>
                  <p>İlk Ay Toplamı (KDV Dahil): <strong>{financials.formatted.firstMonthTotalInclVat}</strong></p>
                  <p>Sonraki Aylar (KDV Dahil): <strong>{financials.formatted.subsequentMonthTotalInclVat}</strong></p>
                  {financials.formatted.contractTotalInclVat && <p>Sözleşme Toplamı (KDV Dahil): <strong>{financials.formatted.contractTotalInclVat}</strong></p>}
                </div>
                <div className="mt-3"><AdminButton variant="secondary" compact icon={<Save size={14} />} onClick={saveQuestionnaire}>Taslağı Kaydet</AdminButton></div>
              </fieldset>

              <fieldset className="rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
                <legend className="px-1 text-sm font-black">Claude İş Akışı</legend>
                <div className="flex flex-wrap gap-2">
                  <AdminButton variant="secondary" compact icon={<Copy size={14} />} onClick={copyPrompt}>{copied ? "Kopyalandı ✓" : "Claude İçin Prompt Oluştur"}</AdminButton>
                </div>
                <div className="mt-3">
                  <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={5} placeholder="Claude'un ürettiği HK_PROPOSAL_V1 JSON çıktısını buraya yapıştırın..." className="w-full rounded-[10px] border p-2.5 text-sm" style={{ borderColor: "var(--admin-border)" }} />
                  <div className="mt-2"><AdminButton variant="primary" compact loading={importing} icon={<ClipboardPaste size={14} />} onClick={importAnalysis} disabled={!importText.trim()}>Claude Analizini İçe Aktar</AdminButton></div>
                </div>
              </fieldset>

              {proposal.status !== "Taslak" && (
                <fieldset className="rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
                  <legend className="px-1 text-sm font-black">Rapor</legend>
                  <div className="flex flex-wrap gap-2">
                    <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={downloading === "client-pdf"} onClick={() => downloadDocument("client", "pdf")}>Müşteri PDF</AdminButton>
                    <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={downloading === "client-docx"} onClick={() => downloadDocument("client", "docx")}>Müşteri Word</AdminButton>
                    <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={downloading === "internal-pdf"} onClick={() => downloadDocument("internal", "pdf")}>Dahili PDF</AdminButton>
                    <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={downloading === "internal-docx"} onClick={() => downloadDocument("internal", "docx")}>Dahili Word</AdminButton>
                  </div>
                </fieldset>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
