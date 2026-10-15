"use client";

import { useEffect, useState } from "react";
import { X, Save, Send, Copy, ClipboardPaste, Download } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";
import { MODULE_FIELD_GROUPS, MODULE_LABELS, type ManualEvaluationModule, type ManualEvaluationRecord } from "@/lib/manual-evaluations-shared";

// Shared "+ Manuel Değerlendirme" form — one modal, driven entirely by
// MODULE_FIELD_GROUPS so every Reklam Doktoru Pro tab gets a module-
// specific form without six copy-pasted components (Phase 7/8 of the
// brief). All fields are optional (Phase 3: "Do not force the user to
// fill every field") — empty stays empty rather than being coerced to 0.

type Props = {
  module: ManualEvaluationModule;
  companyId?: string | null;
  leadId?: string | null;
  businessUnitId?: string | null;
  targetLabel?: string;
  existing?: ManualEvaluationRecord | null;
  /** Read-only-source prefill (e.g. a selected CRM lead's known fields) for
   * a brand-new evaluation only — never applied when reopening an
   * `existing` saved one, and never overwrites a field the user already
   * typed (it only seeds the initial state). */
  prefillData?: Record<string, unknown>;
  onClose: () => void;
  onSaved: (evaluation: ManualEvaluationRecord) => void;
};

export function ManualEvaluationModal({ module, companyId, leadId, businessUnitId, targetLabel, existing, prefillData, onClose, onSaved }: Props) {
  const groups = MODULE_FIELD_GROUPS[module];
  const [title, setTitle] = useState(existing?.title || "");
  const [data, setData] = useState<Record<string, unknown>>(existing?.data || prefillData || {});
  const [notes, setNotes] = useState(existing?.notes || "");
  const [claudeText, setClaudeText] = useState("");
  const [showClaudeImport, setShowClaudeImport] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<ManualEvaluationRecord | null>(existing || null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function setField(key: string, value: unknown) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  async function save(status: "draft" | "submitted") {
    setSaving(true);
    setError(null);
    try {
      const url = saved ? `/api/admin/manual-evaluations/${saved.id}` : "/api/admin/manual-evaluations";
      const method = saved ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          saved
            ? { title, data, notes, status }
            : { module, companyId: companyId || null, leadId: leadId || null, businessUnitId: businessUnitId || null, targetLabel: targetLabel || "", title, data, notes, status }
        )
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Kaydedilemedi.");
      setSaved(body.evaluation);
      onSaved(body.evaluation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    } finally {
      setSaving(false);
    }
  }

  async function importClaudeResult() {
    if (!saved || !claudeText.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/manual-evaluations/${saved.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claudeImportText: claudeText })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "İçe aktarılamadı.");
      setSaved(body.evaluation);
      onSaved(body.evaluation);
      setShowClaudeImport(false);
      setClaudeText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    } finally {
      setSaving(false);
    }
  }

  async function copyPrompt() {
    const allFields = groups.flatMap((g) => g.fields.map((f) => [f.label, data[f.key]] as const));
    const filledFields = allFields.filter(([, v]) => v !== undefined && v !== null && v !== "");
    const missingFields = allFields.filter(([, v]) => v === undefined || v === null || v === "").map(([label]) => label);
    const fieldSummary = filledFields.map(([label, v]) => `${label}: ${v}`).join("\n");
    const sourceLine = companyId
      ? "Hedef türü: Mevcut müşteri (gerçek müşteri kaydı)."
      : leadId
        ? "Hedef türü: Kayıtlı CRM lead (henüz müşteri değil — lead'i otomatik müşteriye dönüştürme)."
        : "Hedef türü: Bağımsız manuel değerlendirme (müşteri veya lead kaydı yok).";
    const text = [
      `${MODULE_LABELS[module]} için aşağıdaki manuel girilen verilere dayanarak profesyonel, Türkçe, doğrudan uygulanabilir bir değerlendirme hazırla.`,
      targetLabel ? `İşletme/Hesap: ${targetLabel}` : "İşletme/Hesap: belirtilmedi",
      sourceLine,
      "Veri kaynağı: Bu ekrana elle girilen veriler (API'den otomatik çekilmedi).",
      "Mevcut veriler:",
      fieldSummary || "(henüz veri girilmedi)",
      missingFields.length ? `Eksik/girilmemiş alanlar (bunları uydurma, 'veri yok' olarak işaretle): ${missingFields.join(", ")}` : "",
      "Yalnızca verilen gerçek verilere dayan, eksik veriyi uydurma. Sonucu JSON veya net başlıklı Türkçe metin olarak döndür; sonucu buraya yapıştıracağım."
    ].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard denied */ }
  }

  async function downloadReport(mode: "internal" | "client", format: "pdf" | "docx") {
    if (!saved) return;
    setDownloading(`${mode}-${format}`);
    try {
      const res = await fetch(`/api/admin/manual-evaluations/${saved.id}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, format })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Rapor oluşturulamadı.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${mode}-${format}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rapor indirilemedi.");
    } finally {
      setDownloading(null);
    }
  }

  const metricEntries = Object.values(saved?.derived_metrics || {});

  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-black/40" onMouseDown={onClose}>
      <aside role="dialog" aria-modal="true" aria-labelledby="manual-eval-title" className="flex h-full w-full max-w-[min(760px,100vw)] flex-col overflow-hidden shadow-2xl" style={{ background: "var(--admin-surface)" }} onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b p-5" style={{ borderColor: "var(--admin-border)" }}>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Manuel Değerlendirme</p>
            <h3 id="manual-eval-title" className="mt-1 truncate text-lg font-black" style={{ color: "var(--admin-text-primary)" }}>{MODULE_LABELS[module]}{targetLabel ? ` — ${targetLabel}` : ""}</h3>
            {saved && <div className="mt-2"><AdminStatusBadge tone={saved.status === "submitted" ? "success" : "warning"}>{saved.status === "submitted" ? "Tamamlandı" : "Taslak"}</AdminStatusBadge></div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" autoFocus className="grid size-10 shrink-0 place-items-center rounded-[10px] border" style={{ borderColor: "var(--admin-border)" }}>
            <X size={16} aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <label className="mb-4 block">
            <span className="mb-1 block text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Başlık</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-[10px] border p-2.5 text-sm font-bold" style={{ borderColor: "var(--admin-border)" }} placeholder="Değerlendirme başlığı (opsiyonel)" />
          </label>

          <div className="grid gap-5">
            {groups.map((group) => (
              <fieldset key={group.title} className="rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
                <legend className="px-1 text-sm font-black">{group.title}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.fields.map((field) => (
                    <label key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
                      <span className="mb-1 block text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>{field.label}{field.unit ? ` (${field.unit})` : ""}</span>
                      {field.type === "textarea" ? (
                        <textarea value={String(data[field.key] ?? "")} onChange={(e) => setField(field.key, e.target.value)} rows={2} className="w-full rounded-[10px] border p-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
                      ) : field.type === "select" ? (
                        <select value={String(data[field.key] ?? "")} onChange={(e) => setField(field.key, e.target.value)} className="w-full rounded-[10px] border p-2 text-sm" style={{ borderColor: "var(--admin-border)" }}>
                          <option value="">Seçilmedi</option>
                          {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input
                          type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                          value={String(data[field.key] ?? "")}
                          onChange={(e) => setField(field.key, field.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
                          className="w-full rounded-[10px] border p-2 text-sm" style={{ borderColor: "var(--admin-border)" }}
                          placeholder={field.placeholder}
                        />
                      )}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>

          <label className="mt-5 block">
            <span className="mb-1 block text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Notlar</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-[10px] border p-2.5 text-sm" style={{ borderColor: "var(--admin-border)" }} />
          </label>

          {metricEntries.length > 0 && (
            <div className="mt-5 rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
              <p className="mb-2 text-sm font-black">Hesaplanan Metrikler</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {metricEntries.map((m) => (
                  <div key={m.label} className="content-plan-stat rounded-[10px] border p-3" style={{ borderColor: "var(--admin-border)" }}>
                    <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>{m.label}</p>
                    <p className="mt-1 text-lg font-black">{m.value.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} {m.unit}</p>
                    <p className="text-[11px]" style={{ color: "var(--admin-text-muted)" }}>{m.formula}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
            <p className="mb-2 text-sm font-black">Claude İş Akışı</p>
            <div className="flex flex-wrap gap-2">
              <AdminButton variant="secondary" compact icon={<Copy size={14} />} onClick={copyPrompt}>{copied ? "Kopyalandı ✓" : "Claude Prompt Oluştur / Kopyala"}</AdminButton>
              <AdminButton variant="secondary" compact icon={<ClipboardPaste size={14} />} onClick={() => setShowClaudeImport((v) => !v)} disabled={!saved}>Claude Sonucunu Yapıştır</AdminButton>
            </div>
            {!saved && <p className="mt-2 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>Claude sonucunu içe aktarmadan önce önce taslağı kaydedin.</p>}
            {showClaudeImport && saved && (
              <div className="mt-3">
                <textarea value={claudeText} onChange={(e) => setClaudeText(e.target.value)} rows={5} className="w-full rounded-[10px] border p-2.5 text-sm" style={{ borderColor: "var(--admin-border)" }} placeholder="Claude'un ürettiği analiz sonucunu buraya yapıştırın..." />
                <div className="mt-2">
                  <AdminButton variant="primary" compact loading={saving} onClick={importClaudeResult} disabled={!claudeText.trim()}>Sonucu İçe Aktar ve Kaydet</AdminButton>
                </div>
                <p className="mt-1 text-[11px]" style={{ color: "var(--admin-text-muted)" }}>Yapıştırılan metin, denetlenebilirlik için orijinal haliyle saklanır; önizleme sonrası düzenleyebilirsiniz.</p>
              </div>
            )}
          </div>

          {saved && (
            <div className="mt-5 rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
              <p className="mb-2 text-sm font-black">Rapor</p>
              <div className="flex flex-wrap gap-2">
                <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={downloading === "internal-pdf"} onClick={() => downloadReport("internal", "pdf")}>Dahili PDF</AdminButton>
                <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={downloading === "internal-docx"} onClick={() => downloadReport("internal", "docx")}>Dahili Word</AdminButton>
                <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={downloading === "client-pdf"} onClick={() => downloadReport("client", "pdf")}>Müşteri PDF</AdminButton>
                <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={downloading === "client-docx"} onClick={() => downloadReport("client", "docx")}>Müşteri Word</AdminButton>
              </div>
            </div>
          )}

          {error && <p className="mt-4 text-sm font-bold text-[#dc2626]">{error}</p>}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t p-4" style={{ borderColor: "var(--admin-border)" }}>
          <AdminButton variant="secondary" icon={<Save size={14} />} loading={saving} onClick={() => save("draft")}>Taslak Olarak Kaydet</AdminButton>
          <AdminButton variant="primary" icon={<Send size={14} />} loading={saving} onClick={() => save("submitted")}>Değerlendirmeyi Kaydet</AdminButton>
        </footer>
      </aside>
    </div>
  );
}
