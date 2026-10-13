"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch/create-on-open pattern, same accepted precedent as ManualEvaluationModal.tsx */

import { useEffect, useMemo, useState } from "react";
import { X, Copy, ClipboardPaste, Download, ChevronLeft, ChevronRight, Plus, Trash2, Send, CircleCheck, CircleX, GitBranch, Copy as CopyIcon } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";
import { calculateProposalFinancials, type AdPlatformBudget } from "@/lib/proposals/financials";
import { buildProposalClaudePrompt, type ProposalQuestionnaire } from "@/lib/proposals/prompt";
import type { ProposalCompetitor, HkProposalV1 } from "@/lib/proposals/schema";

type Proposal = {
  id: string;
  proposal_number: string;
  status: string;
  target_label: string;
  questionnaire: Partial<ProposalQuestionnaire>;
  data: Partial<HkProposalV1>;
  financials: ReturnType<typeof calculateProposalFinancials> | Record<string, never>;
  valid_until: string | null;
  sent_at: string | null;
};

const PLATFORM_OPTIONS = ["Google Ads", "Meta Ads", "Instagram", "Facebook", "Sosyal Medya Yönetimi", "SEO", "Web Sitesi / Landing Page", "Diğer"];
const OBJECTIVE_OPTIONS = ["Telefon Araması", "WhatsApp Konuşması", "Instagram Mesajı", "Lead Toplama", "Web Sitesi Trafiği", "Randevu Talebi", "Mağaza Ziyareti", "Marka Bilinirliği", "Ürün Satışı", "E-ticaret Satışı"];

const STEPS = [
  "İşletme Bilgileri", "İşletme Hedefleri", "Platform Stratejisi", "Hedef Kitle",
  "Reklam Bütçesi", "Rakip Araştırması", "Strateji ve Yol Haritası", "Claude Entegrasyonu", "İnceleme ve Dışa Aktarım"
] as const;

function emptyQuestionnaire(): ProposalQuestionnaire {
  return { business: {}, platforms: [], objectives: [], audience: {}, budget: {}, fees: {}, strategy: {}, roadmap: {}, research: {}, competitors: [] };
}

const ACTION_LABELS: Record<string, string> = {
  send: "Gönder", accept: "Kabul Edildi Olarak İşaretle", reject: "Reddedildi Olarak İşaretle",
  expire: "Süresi Doldu Olarak İşaretle", request_revision: "Revizyon İste"
};

// Teklif Motoru (Premium Proposal Engine) — nine-step wizard matching the
// brief's own step structure, with per-field autosave (debounced PATCH,
// never a full page refresh) and the real lifecycle actions (send/
// accept/reject/revise/duplicate) wired to the validated state machine
// in src/lib/proposals/store.ts (never a raw status overwrite).
export function ProposalModal({ leadId, companyId, targetLabel, onClose }: { leadId?: string | null; companyId?: string | null; targetLabel: string; onClose: () => void }) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [step, setStep] = useState(0);

  const [questionnaire, setQuestionnaire] = useState<ProposalQuestionnaire>(emptyQuestionnaire());
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState<string | null>(null);

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
        if (current?.questionnaire) setQuestionnaire({ ...emptyQuestionnaire(), ...current.questionnaire });
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Beklenmeyen hata.");
      } finally {
        if (active) setLoading(false);
      }
    }
    openOrCreate();
    return () => { active = false; };
  }, [leadId, companyId, targetLabel]);

  const adBudgets: AdPlatformBudget[] = useMemo(() => {
    const platforms = questionnaire.platforms?.filter((p) => p === "Google Ads" || p === "Meta Ads") || [];
    return platforms.map((platform) => ({
      platform,
      monthlyBudget: platform === "Google Ads" ? Number(questionnaire.budget?.googleAllocation) || 0 : Number(questionnaire.budget?.metaAllocation) || 0
    }));
  }, [questionnaire.platforms, questionnaire.budget?.googleAllocation, questionnaire.budget?.metaAllocation]);

  const financials = calculateProposalFinancials({
    adBudgets,
    agencyMonthlyFee: Number(questionnaire.fees?.monthlyManagementFee) || 0,
    setupFee: Number(questionnaire.fees?.setupFee) || 0,
    contractMonths: Number(questionnaire.fees?.contractDurationMonths) || 1
  });

  const locked = Boolean(proposal?.sent_at);

  async function persist(nextQuestionnaire: ProposalQuestionnaire) {
    if (!proposal || locked) return;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/admin/proposals/v2/${proposal.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionnaire: nextQuestionnaire, financials })
      });
      const body = await res.json();
      if (!res.ok) { setSaveState("error"); setError(body.error || "Kaydedilemedi."); return; }
      setProposal(body.proposal);
      setSaveState("saved");
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 2000);
    } catch {
      setSaveState("error");
    }
  }

  // Debounced autosave — fires ~900ms after the last field change, never
  // on every keystroke, and never a full page reload.
  useEffect(() => {
    if (!proposal || loading || locked) return;
    const timer = setTimeout(() => { persist(questionnaire); }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionnaire]);

  function updateBusiness(patch: Partial<ProposalQuestionnaire["business"]>) {
    setQuestionnaire((q) => ({ ...q, business: { ...q.business, ...patch } }));
  }
  function updateAudience(patch: Partial<ProposalQuestionnaire["audience"]>) {
    setQuestionnaire((q) => ({ ...q, audience: { ...q.audience, ...patch } }));
  }
  function updateBudget(patch: Partial<ProposalQuestionnaire["budget"]>) {
    setQuestionnaire((q) => ({ ...q, budget: { ...q.budget, ...patch } }));
  }
  function updateFees(patch: Partial<ProposalQuestionnaire["fees"]>) {
    setQuestionnaire((q) => ({ ...q, fees: { ...q.fees, ...patch } }));
  }
  function updateStrategy(patch: Partial<ProposalQuestionnaire["strategy"]>) {
    setQuestionnaire((q) => ({ ...q, strategy: { ...q.strategy, ...patch } }));
  }
  function updateRoadmap(patch: Partial<ProposalQuestionnaire["roadmap"]>) {
    setQuestionnaire((q) => ({ ...q, roadmap: { ...q.roadmap, ...patch } }));
  }
  function togglePlatform(p: string) {
    setQuestionnaire((q) => ({ ...q, platforms: q.platforms?.includes(p) ? q.platforms.filter((x) => x !== p) : [...(q.platforms || []), p] }));
  }
  function toggleObjective(o: string) {
    setQuestionnaire((q) => ({ ...q, objectives: q.objectives?.includes(o) ? q.objectives.filter((x) => x !== o) : [...(q.objectives || []), o] }));
  }
  function addCompetitor() {
    setQuestionnaire((q) => ({ ...q, competitors: [...(q.competitors || []), { name: "", verified: false }] }));
  }
  function updateCompetitor(index: number, patch: Partial<ProposalCompetitor>) {
    setQuestionnaire((q) => ({ ...q, competitors: (q.competitors || []).map((c, i) => (i === index ? { ...c, ...patch } : c)) }));
  }
  function removeCompetitor(index: number) {
    setQuestionnaire((q) => ({ ...q, competitors: (q.competitors || []).filter((_, i) => i !== index) }));
  }

  async function copyPrompt() {
    await persist(questionnaire);
    const prompt = buildProposalClaudePrompt({ ...questionnaire, business: { ...questionnaire.business, name: questionnaire.business?.name || targetLabel } }, targetLabel);
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

  async function runTransition(action: string) {
    if (!proposal) return;
    setTransitioning(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/proposals/v2/${proposal.id}/transition`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action })
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error || "Durum değiştirilemedi."); return; }
      setProposal(body.proposal);
    } finally {
      setTransitioning(null);
    }
  }

  async function duplicateAsNew() {
    if (!proposal) return;
    setTransitioning("duplicate");
    try {
      const res = await fetch(`/api/admin/proposals/v2/${proposal.id}/duplicate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const body = await res.json();
      if (res.ok) { setProposal(body.proposal); setQuestionnaire({ ...emptyQuestionnaire(), ...body.proposal.questionnaire }); setStep(0); }
      else setError(body.error || "Kopyalanamadı.");
    } finally {
      setTransitioning(null);
    }
  }

  async function requestRevision() {
    if (!proposal) return;
    setTransitioning("revise");
    try {
      const res = await fetch(`/api/admin/proposals/v2/${proposal.id}/revise`, { method: "POST" });
      const body = await res.json();
      if (res.ok) { setProposal(body.proposal); setQuestionnaire({ ...emptyQuestionnaire(), ...body.proposal.questionnaire }); }
      else setError(body.error || "Revizyon oluşturulamadı.");
    } finally {
      setTransitioning(null);
    }
  }

  const inputClass = "w-full rounded-[10px] border p-2 text-sm";
  const labelClass = "mb-1 block text-xs font-bold";
  const fieldStyle = { borderColor: "var(--admin-border)" };
  const mutedStyle = { color: "var(--admin-text-secondary)" };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/55 p-0 sm:p-4" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="flex h-full w-full flex-col overflow-hidden bg-[var(--admin-surface)] shadow-2xl sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-[1100px] sm:rounded-[20px]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Teklif Motoru</p>
            <h2 className="mt-1 truncate text-xl font-black" style={{ color: "var(--admin-text-primary)" }}>{targetLabel}</h2>
            {proposal && (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <AdminStatusBadge tone="info">{proposal.status}</AdminStatusBadge>
                <span className="text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>{proposal.proposal_number}</span>
                {saveState === "saving" && <span className="text-xs font-bold text-amber-600">Kaydediliyor...</span>}
                {saveState === "saved" && <span className="text-xs font-bold text-emerald-600">Kaydedildi ✓</span>}
                {saveState === "error" && <span className="text-xs font-bold text-red-600">Kaydetme hatası</span>}
                {locked && <span className="text-xs font-bold text-slate-500">Gönderildi — salt okunur (revizyon oluşturun)</span>}
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="Kapat" className="grid size-10 shrink-0 place-items-center rounded-full border" style={{ borderColor: "var(--admin-border)" }}><X size={16} /></button>
        </div>

        <div className="flex shrink-0 gap-1 overflow-x-auto border-b px-5 py-2.5" style={{ borderColor: "var(--admin-border)" }}>
          {STEPS.map((label, i) => (
            <button key={label} onClick={() => setStep(i)} className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-black" style={step === i ? { background: "#0891b2", color: "#fff", borderColor: "#0891b2" } : fieldStyle}>
              {i + 1}. {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && <p className="text-sm font-bold" style={{ color: "var(--admin-text-muted)" }}>Yükleniyor...</p>}
          {error && <pre className="mb-4 whitespace-pre-wrap rounded-[10px] border p-3 text-xs font-bold text-[#dc2626]" style={{ borderColor: "#fecaca", background: "#fef2f2" }}>{error}</pre>}
          {warnings.map((w) => <p key={w} className="mb-4 rounded-[10px] border p-3 text-sm font-bold" style={{ borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" }}>{w}</p>)}

          {!loading && proposal && (
            <div className="grid gap-4">
              {step === 0 && (
                <fieldset className="grid gap-3 sm:grid-cols-2">
                  <legend className="mb-1 text-sm font-black">1. İşletme Bilgileri</legend>
                  <label><span className={labelClass} style={mutedStyle}>İşletme Adı</span><input className={inputClass} style={fieldStyle} value={questionnaire.business?.name || ""} onChange={(e) => updateBusiness({ name: e.target.value })} placeholder={targetLabel} /></label>
                  <label><span className={labelClass} style={mutedStyle}>Sektör</span><input className={inputClass} style={fieldStyle} value={questionnaire.business?.sector || ""} onChange={(e) => updateBusiness({ sector: e.target.value })} /></label>
                  <label><span className={labelClass} style={mutedStyle}>Şehir</span><input className={inputClass} style={fieldStyle} value={questionnaire.business?.city || ""} onChange={(e) => updateBusiness({ city: e.target.value })} /></label>
                  <label><span className={labelClass} style={mutedStyle}>İlçe</span><input className={inputClass} style={fieldStyle} value={questionnaire.business?.district || ""} onChange={(e) => updateBusiness({ district: e.target.value })} /></label>
                  <label><span className={labelClass} style={mutedStyle}>Web Sitesi</span><input className={inputClass} style={fieldStyle} value={questionnaire.business?.website || ""} onChange={(e) => updateBusiness({ website: e.target.value })} /></label>
                  <label><span className={labelClass} style={mutedStyle}>Instagram</span><input className={inputClass} style={fieldStyle} value={questionnaire.business?.instagram || ""} onChange={(e) => updateBusiness({ instagram: e.target.value })} /></label>
                  <label><span className={labelClass} style={mutedStyle}>Facebook</span><input className={inputClass} style={fieldStyle} value={questionnaire.business?.facebook || ""} onChange={(e) => updateBusiness({ facebook: e.target.value })} /></label>
                  <label><span className={labelClass} style={mutedStyle}>Google İşletme Profili</span><input className={inputClass} style={fieldStyle} value={questionnaire.business?.googleBusinessProfile || ""} onChange={(e) => updateBusiness({ googleBusinessProfile: e.target.value })} /></label>
                  <label className="sm:col-span-2"><span className={labelClass} style={mutedStyle}>Ana Ürün/Hizmetler</span><textarea rows={2} className={inputClass} style={fieldStyle} value={questionnaire.business?.mainServices || ""} onChange={(e) => updateBusiness({ mainServices: e.target.value })} /></label>
                  <label className="sm:col-span-2"><span className={labelClass} style={mutedStyle}>Hedef Müşteri Profili</span><textarea rows={2} className={inputClass} style={fieldStyle} value={questionnaire.business?.targetCustomers || ""} onChange={(e) => updateBusiness({ targetCustomers: e.target.value })} /></label>
                </fieldset>
              )}

              {step === 1 && (
                <fieldset>
                  <legend className="mb-2 text-sm font-black">2. İşletme Hedefleri</legend>
                  <div className="flex flex-wrap gap-2">
                    {OBJECTIVE_OPTIONS.map((o) => (
                      <button key={o} type="button" onClick={() => toggleObjective(o)} className="rounded-full border px-3 py-1.5 text-xs font-black" style={questionnaire.objectives?.includes(o) ? { background: "#0891b2", color: "#fff", borderColor: "#0891b2" } : fieldStyle}>{o}</button>
                    ))}
                  </div>
                </fieldset>
              )}

              {step === 2 && (
                <fieldset>
                  <legend className="mb-2 text-sm font-black">3. Platform Stratejisi</legend>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORM_OPTIONS.map((p) => (
                      <button key={p} type="button" onClick={() => togglePlatform(p)} className="rounded-full border px-3 py-1.5 text-xs font-black" style={questionnaire.platforms?.includes(p) ? { background: "#0891b2", color: "#fff", borderColor: "#0891b2" } : fieldStyle}>{p}</button>
                    ))}
                  </div>
                </fieldset>
              )}

              {step === 3 && (
                <fieldset className="grid gap-3 sm:grid-cols-2">
                  <legend className="mb-1 text-sm font-black">4. Hedef Kitle</legend>
                  <label><span className={labelClass} style={mutedStyle}>Coğrafi Hedefleme</span><input className={inputClass} style={fieldStyle} value={questionnaire.audience?.city || ""} onChange={(e) => updateAudience({ city: e.target.value })} /></label>
                  <label><span className={labelClass} style={mutedStyle}>Hizmet Yarıçapı</span><input className={inputClass} style={fieldStyle} value={questionnaire.audience?.serviceRadius || ""} onChange={(e) => updateAudience({ serviceRadius: e.target.value })} /></label>
                  <label><span className={labelClass} style={mutedStyle}>Yaş Aralığı</span><input className={inputClass} style={fieldStyle} value={questionnaire.audience?.ageRange || ""} onChange={(e) => updateAudience({ ageRange: e.target.value })} /></label>
                  <label><span className={labelClass} style={mutedStyle}>Cinsiyet İlişkisi (gerekçeliyse)</span><input className={inputClass} style={fieldStyle} value={questionnaire.audience?.genderRelevance || ""} onChange={(e) => updateAudience({ genderRelevance: e.target.value })} /></label>
                  <label className="sm:col-span-2"><span className={labelClass} style={mutedStyle}>İlgi Alanları / İhtiyaçlar</span><textarea rows={2} className={inputClass} style={fieldStyle} value={questionnaire.audience?.needs || ""} onChange={(e) => updateAudience({ needs: e.target.value })} /></label>
                  <label><span className={labelClass} style={mutedStyle}>Satın Alma Niyeti</span><input className={inputClass} style={fieldStyle} value={questionnaire.audience?.buyingIntent || ""} onChange={(e) => updateAudience({ buyingIntent: e.target.value })} /></label>
                  <label><span className={labelClass} style={mutedStyle}>Hariç Tutulacaklar</span><input className={inputClass} style={fieldStyle} value={questionnaire.audience?.geographicRestrictions || ""} onChange={(e) => updateAudience({ geographicRestrictions: e.target.value })} /></label>
                  <label><span className={labelClass} style={mutedStyle}>Remarketing Uygunluğu</span><input className={inputClass} style={fieldStyle} value={questionnaire.audience?.remarketingEligible || ""} onChange={(e) => updateAudience({ remarketingEligible: e.target.value })} /></label>
                  <label><span className={labelClass} style={mutedStyle}>Mevcut Kitle Verisi Var mı?</span><input className={inputClass} style={fieldStyle} value={questionnaire.audience?.existingAudienceAvailable || ""} onChange={(e) => updateAudience({ existingAudienceAvailable: e.target.value })} /></label>
                  <p className="sm:col-span-2 text-xs" style={mutedStyle}>Not: Google Arama ağında Meta tarzı ilgi alanı hedeflemesi yoktur — platform stratejisi bölümünde bu ayrım korunur.</p>
                </fieldset>
              )}

              {step === 4 && (
                <fieldset>
                  <legend className="mb-1 text-sm font-black">5. Reklam Bütçesi ve Ajans Ücretleri</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {questionnaire.platforms?.includes("Google Ads") && (
                      <label><span className={labelClass} style={mutedStyle}>Google Ads Aylık Bütçe (TL)</span><input type="number" className={inputClass} style={fieldStyle} value={questionnaire.budget?.googleAllocation || ""} onChange={(e) => updateBudget({ googleAllocation: Number(e.target.value) || 0 })} /></label>
                    )}
                    {questionnaire.platforms?.includes("Meta Ads") && (
                      <label><span className={labelClass} style={mutedStyle}>Meta Ads Aylık Bütçe (TL)</span><input type="number" className={inputClass} style={fieldStyle} value={questionnaire.budget?.metaAllocation || ""} onChange={(e) => updateBudget({ metaAllocation: Number(e.target.value) || 0 })} /></label>
                    )}
                    <label><span className={labelClass} style={mutedStyle}>Aylık Ajans Yönetim Ücreti (TL)</span><input type="number" className={inputClass} style={fieldStyle} value={questionnaire.fees?.monthlyManagementFee || ""} onChange={(e) => updateFees({ monthlyManagementFee: Number(e.target.value) || 0 })} /></label>
                    <label><span className={labelClass} style={mutedStyle}>Kurulum Ücreti (TL)</span><input type="number" className={inputClass} style={fieldStyle} value={questionnaire.fees?.setupFee || ""} onChange={(e) => updateFees({ setupFee: Number(e.target.value) || 0 })} /></label>
                    <label><span className={labelClass} style={mutedStyle}>Sözleşme Süresi (Ay)</span><input type="number" min={1} className={inputClass} style={fieldStyle} value={questionnaire.fees?.contractDurationMonths || 1} onChange={(e) => updateFees({ contractDurationMonths: Number(e.target.value) || 1 })} /></label>
                    <label><span className={labelClass} style={mutedStyle}>Ek Hizmet Ücretleri (açıklama)</span><input className={inputClass} style={fieldStyle} value={questionnaire.fees?.additionalServiceFees || ""} onChange={(e) => updateFees({ additionalServiceFees: e.target.value })} /></label>
                    <label><span className={labelClass} style={mutedStyle}>Vergi Notu</span><input className={inputClass} style={fieldStyle} value={questionnaire.fees?.taxes || ""} onChange={(e) => updateFees({ taxes: e.target.value })} placeholder="KDV hariç fiyatlandırma" /></label>
                  </div>
                  <div className="mt-4 grid gap-2 rounded-[10px] border p-3 text-sm sm:grid-cols-2" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }}>
                    <p>Toplam Aylık Reklam Bütçesi: <strong>{financials.formatted.totalMonthlyAdBudget}</strong></p>
                    <p>İlk Ay Toplamı (KDV Dahil): <strong>{financials.formatted.firstMonthTotalInclVat}</strong></p>
                    <p>Sonraki Aylar (KDV Dahil): <strong>{financials.formatted.subsequentMonthTotalInclVat}</strong></p>
                    {financials.formatted.contractTotalInclVat && <p>Sözleşme Toplamı (KDV Dahil): <strong>{financials.formatted.contractTotalInclVat}</strong></p>}
                  </div>
                </fieldset>
              )}

              {step === 5 && (
                <fieldset>
                  <legend className="mb-2 text-sm font-black">6. Rakip Araştırması (bilinen rakipler — Claude bunlara ek araştırma yapacak)</legend>
                  <div className="grid gap-3">
                    {(questionnaire.competitors || []).map((c, i) => (
                      <div key={i} className="grid gap-2 rounded-[10px] border p-3 sm:grid-cols-2" style={fieldStyle}>
                        <label><span className={labelClass} style={mutedStyle}>Rakip Adı</span><input className={inputClass} style={fieldStyle} value={c.name} onChange={(e) => updateCompetitor(i, { name: e.target.value })} /></label>
                        <label><span className={labelClass} style={mutedStyle}>Web Sitesi</span><input className={inputClass} style={fieldStyle} value={c.website || ""} onChange={(e) => updateCompetitor(i, { website: e.target.value })} /></label>
                        <label className="sm:col-span-2"><span className={labelClass} style={mutedStyle}>Notlar (güçlü/zayıf yönler, fırsatlar)</span><textarea rows={2} className={inputClass} style={fieldStyle} value={c.notes || ""} onChange={(e) => updateCompetitor(i, { notes: e.target.value })} /></label>
                        <label><span className={labelClass} style={mutedStyle}>Kaynak URL</span><input className={inputClass} style={fieldStyle} value={c.sourceUrl || ""} onChange={(e) => updateCompetitor(i, { sourceUrl: e.target.value })} /></label>
                        <label className="flex items-center gap-2 self-end pb-2"><input type="checkbox" checked={c.verified} onChange={(e) => updateCompetitor(i, { verified: e.target.checked })} /><span className="text-xs font-bold" style={mutedStyle}>Doğrulanmış gerçek bilgi</span></label>
                        <div className="sm:col-span-2"><button onClick={() => removeCompetitor(i)} className="inline-flex items-center gap-1 text-xs font-black text-red-600"><Trash2 size={13} /> Kaldır</button></div>
                      </div>
                    ))}
                    <button onClick={addCompetitor} className="inline-flex w-fit items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-xs font-black" style={fieldStyle}><Plus size={13} /> Rakip Ekle</button>
                  </div>
                </fieldset>
              )}

              {step === 6 && (
                <fieldset className="grid gap-3 sm:grid-cols-2">
                  <legend className="mb-1 text-sm font-black">7. Strateji ve Yol Haritası</legend>
                  <label><span className={labelClass} style={mutedStyle}>İlk 30 Gün</span><textarea rows={3} className={inputClass} style={fieldStyle} value={questionnaire.roadmap?.first30Days || ""} onChange={(e) => updateRoadmap({ first30Days: e.target.value })} /></label>
                  <label><span className={labelClass} style={mutedStyle}>31-60. Günler</span><textarea rows={3} className={inputClass} style={fieldStyle} value={questionnaire.roadmap?.days31to60 || ""} onChange={(e) => updateRoadmap({ days31to60: e.target.value })} /></label>
                  <label><span className={labelClass} style={mutedStyle}>61-90. Günler</span><textarea rows={3} className={inputClass} style={fieldStyle} value={questionnaire.roadmap?.days61to90 || ""} onChange={(e) => updateRoadmap({ days61to90: e.target.value })} /></label>
                  <label><span className={labelClass} style={mutedStyle}>Kampanya Mimarisi</span><textarea rows={3} className={inputClass} style={fieldStyle} value={questionnaire.roadmap?.campaignStructure || ""} onChange={(e) => updateRoadmap({ campaignStructure: e.target.value })} /></label>
                  <label><span className={labelClass} style={mutedStyle}>Optimizasyon Stratejisi</span><textarea rows={3} className={inputClass} style={fieldStyle} value={questionnaire.roadmap?.optimizationStrategy || ""} onChange={(e) => updateRoadmap({ optimizationStrategy: e.target.value })} /></label>
                  <label><span className={labelClass} style={mutedStyle}>Ölçümleme Planı</span><textarea rows={3} className={inputClass} style={fieldStyle} value={questionnaire.roadmap?.measurementPlan || ""} onChange={(e) => updateRoadmap({ measurementPlan: e.target.value })} /></label>
                  <label className="sm:col-span-2"><span className={labelClass} style={mutedStyle}>Bilinen Mevcut Sorunlar</span><textarea rows={2} className={inputClass} style={fieldStyle} value={questionnaire.strategy?.currentProblems || ""} onChange={(e) => updateStrategy({ currentProblems: e.target.value })} /></label>
                </fieldset>
              )}

              {step === 7 && (
                <fieldset>
                  <legend className="mb-2 text-sm font-black">8. Claude Project Entegrasyonu</legend>
                  <div className="flex flex-wrap gap-2">
                    <AdminButton variant="secondary" compact icon={<Copy size={14} />} onClick={copyPrompt}>{copied ? "Kopyalandı ✓" : "Claude İçin Prompt Oluştur"}</AdminButton>
                  </div>
                  <div className="mt-3">
                    <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={6} placeholder="Claude'un ürettiği HK_PROPOSAL_V1 JSON çıktısını buraya yapıştırın..." className={inputClass} style={fieldStyle} />
                    <div className="mt-2"><AdminButton variant="primary" compact loading={importing} icon={<ClipboardPaste size={14} />} onClick={importAnalysis} disabled={!importText.trim()}>Claude Analizini İçe Aktar</AdminButton></div>
                  </div>
                  {proposal.data?.market_analysis && <p className="mt-3 text-xs font-bold text-emerald-600">Bu teklif için bir analiz zaten içe aktarıldı — 9. adımda inceleyebilirsiniz.</p>}
                </fieldset>
              )}

              {step === 8 && (
                <fieldset className="grid gap-4">
                  <legend className="mb-1 text-sm font-black">9. İnceleme ve Dışa Aktarım</legend>
                  <div className="grid gap-2 rounded-[10px] border p-3 text-sm sm:grid-cols-2" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }}>
                    <p>Platformlar: <strong>{questionnaire.platforms?.join(", ") || "—"}</strong></p>
                    <p>Hedefler: <strong>{questionnaire.objectives?.join(", ") || "—"}</strong></p>
                    <p>İlk Ay Toplamı (KDV Dahil): <strong>{financials.formatted.firstMonthTotalInclVat}</strong></p>
                    <p>Sonraki Aylar (KDV Dahil): <strong>{financials.formatted.subsequentMonthTotalInclVat}</strong></p>
                    <p>Rakip Sayısı (kullanıcı girdisi): <strong>{questionnaire.competitors?.length || 0}</strong></p>
                    <p>Claude Analizi: <strong>{proposal.data?.market_analysis ? "İçe aktarıldı" : "Henüz yok"}</strong></p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={downloading === "client-pdf"} onClick={() => downloadDocument("client", "pdf")}>Müşteri PDF</AdminButton>
                    <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={downloading === "client-docx"} onClick={() => downloadDocument("client", "docx")}>Müşteri Word</AdminButton>
                    <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={downloading === "internal-pdf"} onClick={() => downloadDocument("internal", "pdf")}>Dahili PDF</AdminButton>
                    <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={downloading === "internal-docx"} onClick={() => downloadDocument("internal", "docx")}>Dahili Word</AdminButton>
                  </div>

                  <div className="flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: "var(--admin-border)" }}>
                    {proposal.status === "Gönderime Hazır" && <AdminButton variant="primary" compact icon={<Send size={14} />} loading={transitioning === "send"} onClick={() => runTransition("send")}>{ACTION_LABELS.send}</AdminButton>}
                    {!["Gönderime Hazır", "Taslak"].includes(proposal.status) && !locked && (
                      <AdminButton variant="secondary" compact onClick={() => persist({ ...questionnaire }).then(() => runTransition("send"))}>Gönderime Hazırla ve Gönder</AdminButton>
                    )}
                    {proposal.status === "Gönderildi" && (
                      <>
                        <AdminButton variant="primary" compact icon={<CircleCheck size={14} />} loading={transitioning === "accept"} onClick={() => runTransition("accept")}>{ACTION_LABELS.accept}</AdminButton>
                        <AdminButton variant="secondary" compact icon={<CircleX size={14} />} loading={transitioning === "reject"} onClick={() => runTransition("reject")}>{ACTION_LABELS.reject}</AdminButton>
                        <AdminButton variant="secondary" compact icon={<GitBranch size={14} />} loading={transitioning === "revise"} onClick={requestRevision}>Revizyon Oluştur</AdminButton>
                      </>
                    )}
                    <AdminButton variant="secondary" compact icon={<CopyIcon size={14} />} loading={transitioning === "duplicate"} onClick={duplicateAsNew}>Farklı Teklif Olarak Kopyala</AdminButton>
                  </div>
                </fieldset>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t bg-[var(--admin-surface)] p-4" style={{ borderColor: "var(--admin-border)" }}>
          <AdminButton variant="secondary" compact icon={<ChevronLeft size={14} />} disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>Geri</AdminButton>
          <span className="text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>{step + 1} / {STEPS.length}</span>
          <AdminButton variant="primary" compact icon={<ChevronRight size={14} />} disabled={step === STEPS.length - 1} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>İleri</AdminButton>
        </div>
      </div>
    </div>
  );
}
