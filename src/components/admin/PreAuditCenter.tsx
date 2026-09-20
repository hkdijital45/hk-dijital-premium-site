"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount pattern, same accepted precedent as ContentPlanningCenter.tsx */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Copy, Eye, ExternalLink, RefreshCw, Search, X } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";

const REJECTION_REASONS = [
  "Uygun müşteri değil", "Dijital ihtiyacı düşük", "Bütçe potansiyeli düşük",
  "Zaten güçlü dijital altyapısı var", "Yanlış / geçersiz işletme", "Tekrar kayıt",
  "İletişim kurulması uygun değil", "Diğer"
];

/**
 * Ön İnceleme Merkezi — a report management/viewing center for pre-sale
 * digital research reports. Reports are authored entirely by the "HK
 * Dijital — Ön İnceleme" Claude Project via MCP (get_pre_audit_context /
 * save_pre_audit_report / get_latest_pre_audit_report) — this screen never
 * re-does the research itself, only lists and displays what was saved.
 */

type Company = { id: string; name: string };
type ReportType = "INTERNAL_REPORT" | "CLIENT_REPORT";
type ListItem = { id: string; company_id: string | null; lead_id: string | null; analysis_group_id: string; report_type: ReportType; title: string; status: string; report_date: string; recommended_package: unknown; created_at: string };
type Summary = { totalPreAudits: number; thisMonth: number; potentialCompanies: number; convertedCompanies: number };
type FullReport = Record<string, unknown> & { id: string; report_type: ReportType; title: string; status: string; report_date: string; analysis_group_id: string; company_id: string | null; lead_id: string | null };
type QueueLead = {
  id: string; company: string | null; name: string | null; sector: string | null; business_type: string | null;
  city: string | null; district: string | null; website: string | null; phone: string | null; instagram: string | null;
  status: string | null; rejection_reason: string | null; rejected_at: string | null; notes: string | null;
  google_place_id: string | null; source: string | null; created_at: string;
};
type Queue = { pending: QueueLead[]; inReview: QueueLead[]; rejected: QueueLead[] };
type Tab = "tamamlanan" | "bekleyen" | "inceleniyor" | "iptal";

const SECTION_LABELS: Array<[string, string]> = [
  ["executive_summary", "Yönetici Özeti"],
  ["digital_presence", "Dijital Varlıklar"],
  ["google_analysis", "Google"],
  ["maps_analysis", "Google Maps / Local SEO"],
  ["website_analysis", "Web Sitesi"],
  ["seo_analysis", "SEO"],
  ["social_analysis", "Sosyal Medya"],
  ["meta_ads_analysis", "Meta Ads"],
  ["google_ads_analysis", "Google Ads"],
  ["market_analysis", "Pazar Analizi"],
  ["competitor_analysis", "Rakip Analizi"],
  ["digital_gaps", "Dijital Boşluklar"],
  ["opportunities", "Fırsatlar"],
  ["recommended_services", "Önerilen HK Dijital Hizmetleri"],
  ["recommended_package", "Önerilen Paket"],
  ["ad_strategy", "Başlangıç Reklam Stratejisi"],
  ["budget_plan", "Bütçe Planı"],
  ["sources", "Kaynaklar"]
];

const INTERNAL_SECTION_LABELS: Array<[string, string]> = [
  ["sales_notes", "Satış Görüşmesi Notları"],
  ["sales_script", "Konuşma Metni"],
  ["instagram_dm", "Instagram DM"],
  ["whatsapp_initial", "WhatsApp — İlk Temas"],
  ["whatsapp_with_pdf", "WhatsApp — PDF ile Gönderim"],
  ["objections", "İtirazlar / Yanıtlar"]
];

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>{children}</div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-[16px] bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-base font-black">{title}</p>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-[#F3F2EE]"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function leadDisplayName(lead: QueueLead) {
  return lead.company || lead.name || "İsimsiz aday";
}

function buildClaudePrompt(lead: QueueLead) {
  const location = [lead.district, lead.city].filter(Boolean).join(", ") || "-";
  return `HK Dijital Ön İnceleme görevi.

Aşağıdaki işletmeyi HK Dijital MCP bağlantısı üzerinden (get_pre_audit_context, leadId="${lead.id}") kesin olarak doğrula — aynı isimli başka bir işletmeyle karıştırma.

Firma: ${leadDisplayName(lead)}
Sektör: ${lead.sector || lead.business_type || "-"}
Konum: ${location}
Website: ${lead.website || "-"}
Telefon: ${lead.phone || "-"}
Instagram: ${lead.instagram || "-"}

Doğruladıktan sonra: Google, Google Maps/Local SEO, web sitesi, SEO, sosyal medya (Instagram/Facebook) ve halka açık reklam sinyallerini (Meta/Google Ads) araştır. Yalnızca gerçekten bulduğun/doğrulayabildiğin bilgileri kullan; olmayan metrik uydurma.

Kısa ve profesyonel bir ön inceleme hazırla: yönetici özeti, dijital varlıklar, SWOT (güçlü/zayıf yönler, fırsatlar, tehditler), dijital boşluklar, fırsatlar, önerilen HK Dijital hizmetleri ve paket, başlangıç reklam stratejisi ve bütçe planı.

Kullanıcı açıkça "HK Dijital'e kaydet" derse, save_pre_audit_report aracını leadId="${lead.id}" ve report_type="INTERNAL_REPORT" ile çağırarak sonucu kaydet. Kullanıcı açıkça istemeden asla kaydetme.`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <AdminButton variant="secondary" compact icon={<Copy size={13} />} onClick={async () => {
      try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard denied */ }
    }}>
      {copied ? "Kopyalandı ✓" : "Kopyala"}
    </AdminButton>
  );
}

function GenericValue({ value }: { value: unknown }) {
  if (typeof value === "string") return <p className="whitespace-pre-line text-sm">{value}</p>;
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === "string")) {
      return <ul className="grid list-disc gap-1 pl-5 text-sm">{value.map((v, i) => <li key={i}>{v}</li>)}</ul>;
    }
    const rows = value.filter((v): v is Record<string, unknown> => !!v && typeof v === "object");
    if (rows.length) {
      const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))].slice(0, 8);
      return (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--admin-border)" }}>
                {columns.map((c) => <th key={c} className="px-2 py-1.5 text-left text-xs font-black uppercase" style={{ color: "var(--admin-text-muted)" }}>{c.replaceAll("_", " ")}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--admin-border)" }}>
                  {columns.map((c) => <td key={c} className="px-2 py-1.5 align-top">{typeof r[c] === "object" ? JSON.stringify(r[c]) : String(r[c] ?? "—")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return null;
  }
  if (value && typeof value === "object") {
    return (
      <div className="grid gap-1.5 text-sm">
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k}><strong className="font-black">{k.replaceAll("_", " ")}:</strong> {typeof v === "object" ? <GenericValue value={v} /> : String(v ?? "—")}</div>
        ))}
      </div>
    );
  }
  return <p className="text-sm">{String(value)}</p>;
}

function SwotSection({ swot }: { swot: unknown }) {
  const s = (swot && typeof swot === "object" ? swot : {}) as Record<string, unknown>;
  const quadrants: Array<[string, string, string]> = [
    ["strengths", "Güçlü Yönler", "#E8F8EC"],
    ["weaknesses", "Zayıf Yönler", "#FDECEC"],
    ["opportunities", "Fırsatlar", "#EAF6FD"],
    ["threats", "Tehditler / Rekabet Riskleri", "#FFF7E2"]
  ];
  const present = quadrants.filter(([key]) => !isEmpty(s[key]));
  if (!present.length) return null;
  return (
    <Card>
      <p className="mb-3 text-sm font-black">SWOT</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {present.map(([key, label, bg]) => (
          <div key={key} className="rounded-[10px] p-3" style={{ background: bg }}>
            <p className="mb-1.5 text-xs font-black uppercase tracking-wide">{label}</p>
            <GenericValue value={s[key]} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function ReportDetail({ report, onSendOffer, onReject }: { report: FullReport; onSendOffer?: (report: FullReport) => void; onReject?: (report: FullReport) => void }) {
  const isInternal = report.report_type === "INTERNAL_REPORT";
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <AdminStatusBadge tone={isInternal ? "warning" : "success"}>{isInternal ? "🔒 Dahili Rapor — HK Dijital İç Kullanım" : "📄 Müşteri Raporu — Müşteriye Sunulabilir"}</AdminStatusBadge>
        <AdminStatusBadge tone="neutral">{formatDate(report.report_date as string)}</AdminStatusBadge>
        <AdminStatusBadge tone="info">{String(report.status || "draft")}</AdminStatusBadge>
      </div>

      {report.lead_id && (onSendOffer || onReject) && (
        <div className="flex flex-wrap gap-2">
          {onSendOffer && <AdminButton variant="success" icon={<span>🟢</span>} onClick={() => onSendOffer(report)}>Teklif Gönder</AdminButton>}
          {onReject && <AdminButton variant="danger" icon={<span>🔴</span>} onClick={() => onReject(report)}>İptal</AdminButton>}
        </div>
      )}

      {SECTION_LABELS.filter(([key]) => !isEmpty(report[key])).map(([key, label]) => (
        key === "swot" ? null : (
          <Card key={key}>
            <p className="mb-2 text-sm font-black">{label}</p>
            <GenericValue value={report[key]} />
          </Card>
        )
      ))}

      {!isEmpty(report.swot) && <SwotSection swot={report.swot} />}

      {isInternal && INTERNAL_SECTION_LABELS.some(([key]) => !isEmpty(report[key])) && (
        <>
          <p className="mt-2 text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>HK Dijital İç Kullanım — Satış İletişimi</p>
          {INTERNAL_SECTION_LABELS.filter(([key]) => !isEmpty(report[key])).map(([key, label]) => (
            <Card key={key}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-black">{label}</p>
                {typeof report[key] === "string" && <CopyButton text={report[key] as string} />}
              </div>
              <GenericValue value={report[key]} />
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

function QueueLeadRow({ lead, isRejected, onCopyPrompt, onReject }: { lead: QueueLead; isRejected?: boolean; onCopyPrompt?: (lead: QueueLead) => void; onReject?: (lead: QueueLead) => void }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black">{leadDisplayName(lead)}</p>
          <p className="text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>
            {[lead.sector || lead.business_type, [lead.district, lead.city].filter(Boolean).join(", "), lead.website].filter(Boolean).join(" · ") || "Detay yok"}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--admin-text-muted)" }}>Kaynak: {lead.source || "Bilinmiyor"} · {formatDate(lead.created_at)}</p>
          {isRejected && (
            <div className="mt-2 rounded-[10px] p-2 text-xs" style={{ background: "#FDECEC" }}>
              <p><strong>Sebep:</strong> {lead.rejection_reason || "-"}</p>
              {lead.notes && <p className="mt-1 whitespace-pre-line opacity-80">{lead.notes.split("\n").filter((l) => l.includes("Ön İnceleme İptal")).pop() || lead.notes}</p>}
              <p className="mt-1 opacity-70">{formatDate(lead.rejected_at)}</p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {!isRejected && onCopyPrompt && (
            <AdminButton variant="ai" compact icon={<Copy size={13} />} onClick={() => onCopyPrompt(lead)}>Claude Promptunu Kopyala</AdminButton>
          )}
          {!isRejected && onReject && (
            <AdminButton variant="danger" compact onClick={() => onReject(lead)}>İptal</AdminButton>
          )}
        </div>
      </div>
    </Card>
  );
}

export function PreAuditCenter() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [reports, setReports] = useState<ListItem[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tablesReady, setTablesReady] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FullReport | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [verifyCompanyName, setVerifyCompanyName] = useState("");
  const [verifyCopied, setVerifyCopied] = useState(false);
  const [tab, setTab] = useState<Tab>("tamamlanan");
  const [queue, setQueue] = useState<Queue>({ pending: [], inReview: [], rejected: [] });
  const [promptLead, setPromptLead] = useState<QueueLead | null>(null);
  const [rejectTarget, setRejectTarget] = useState<QueueLead | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [rejectSaving, setRejectSaving] = useState(false);
  const [offerTarget, setOfferTarget] = useState<FullReport | null>(null);
  const [offerSaving, setOfferSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/companies").then((r) => r.json()).then((body) => setCompanies(body.companies || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    setReports(null);
    try {
      const params = new URLSearchParams();
      if (companyId) params.set("companyId", companyId);
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(`/api/admin/pre-audit?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Yüklenemedi.");
      setTablesReady(body.tablesReady !== false);
      setReports(body.reports || []);
      setSummary(body.summary || null);
      setQueue(body.queue || { pending: [], inReview: [], rejected: [] });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Beklenmeyen hata.");
      setReports([]);
    }
  }, [companyId, search]);

  useEffect(() => { load(); }, [load]);

  async function openReport(id: string) {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/pre-audit/${id}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Rapor yüklenemedi.");
      setDetail(body.report);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    } finally {
      setDetailLoading(false);
    }
  }

  const companyName = companies.find((c) => c.id === companyId)?.name || "";

  async function copyVerificationPrompt() {
    const name = verifyCompanyName.trim();
    if (!name) return;
    const prompt = `${name} firmasını bul ve doğrula. Henüz ön inceleme yapma ve hiçbir şeyi HK Dijital'e kaydetme. Önce HK Dijital bağlantısından firma kaydını kontrol et ve bana hangi firmayı bulduğunu söyle.`;
    try {
      await navigator.clipboard.writeText(prompt);
      setVerifyCopied(true);
      setTimeout(() => setVerifyCopied(false), 2000);
    } catch { /* clipboard denied — nothing to fall back to here */ }
  }

  async function copyClaudePromptForLead(lead: QueueLead) {
    try {
      await navigator.clipboard.writeText(buildClaudePrompt(lead));
      setPromptLead(lead);
      fetch(`/api/admin/pre-audit/lead/${lead.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mark_in_progress" }) }).then(load).catch(() => {});
    } catch {
      setActionMessage("Panoya kopyalanamadı.");
    }
  }

  const CLAUDE_URL = "https://claude.ai/new";

  /** Top-level navigation (not window.open) — the one real, non-fabricated
   * mechanism that lets the OS/browser hand this off to an installed app
   * registered as the default handler for claude.ai links, if any is. No
   * custom URI scheme is assumed or invented; if no app is registered this
   * behaves exactly like a normal link and opens the browser. */
  function openClaudeApp() {
    window.location.href = CLAUDE_URL;
    setPromptLead(null);
  }

  function openClaudeBrowser() {
    window.open(CLAUDE_URL, "_blank", "noopener,noreferrer");
    setPromptLead(null);
  }

  async function submitReject() {
    if (!rejectTarget || !rejectReason) return;
    if (rejectReason === "Diğer" && !rejectNote.trim()) { setActionMessage("'Diğer' için açıklama zorunludur."); return; }
    setRejectSaving(true);
    try {
      const res = await fetch(`/api/admin/pre-audit/lead/${rejectTarget.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: rejectReason, note: rejectNote })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "İptal kaydedilemedi.");
      setRejectTarget(null); setRejectReason(""); setRejectNote("");
      setActionMessage(`${leadDisplayName(rejectTarget)} iptal edildi.`);
      load();
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "İptal kaydedilemedi.");
    } finally {
      setRejectSaving(false);
    }
  }

  async function sendOfferToLeadPipeline() {
    if (!offerTarget?.lead_id) return;
    setOfferSaving(true);
    try {
      const res = await fetch(`/api/admin/pre-audit/lead/${offerTarget.lead_id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send_offer_lead" })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "İşlem başarısız oldu.");
      setActionMessage("Lead Merkezi'ne aktarıldı — aktif satış hunisinde devam ediyor.");
      setOfferTarget(null);
      load();
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "İşlem başarısız oldu.");
    } finally {
      setOfferSaving(false);
    }
  }

  async function sendOfferToCustomer() {
    if (!offerTarget?.lead_id) return;
    setOfferSaving(true);
    try {
      const res = await fetch(`/api/admin/leads/${offerTarget.lead_id}/convert`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Müşteriye dönüştürme başarısız oldu.");
      setActionMessage(`${body.company?.name || "Müşteri"} olarak kaydedildi.`);
      setOfferTarget(null);
      load();
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Müşteriye dönüştürme başarısız oldu.");
    } finally {
      setOfferSaving(false);
    }
  }

  const grouped = useMemo(() => {
    const groups = new Map<string, ListItem[]>();
    for (const r of reports || []) {
      const list = groups.get(r.analysis_group_id) || [];
      list.push(r);
      groups.set(r.analysis_group_id, list);
    }
    return [...groups.entries()].sort((a, b) => (b[1][0]?.report_date || "").localeCompare(a[1][0]?.report_date || ""));
  }, [reports]);

  return (
    <div className="grid gap-5">
      <div>
        <h2 className="text-xl font-black">Ön İnceleme Merkezi</h2>
        <p className="text-sm font-bold" style={{ color: "var(--admin-text-secondary)" }}>Potansiyel ve mevcut müşterilerin satış öncesi dijital analizleri.</p>
      </div>

      {tablesReady === false && (
        <Card><p className="text-sm font-bold text-[#b45309]">Ön İnceleme veri yapısı henüz etkin değil. Migration uygulanmadan bu ekran boş görünür.</p></Card>
      )}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card><p className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Toplam Ön İnceleme</p><p className="mt-1 text-2xl font-black">{summary.totalPreAudits}</p></Card>
          <Card><p className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Bu Ay</p><p className="mt-1 text-2xl font-black">{summary.thisMonth}</p></Card>
          <Card><p className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Potansiyel Müşteriler</p><p className="mt-1 text-2xl font-black">{summary.potentialCompanies}</p></Card>
          <Card><p className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Müşteriye Dönüşenler</p><p className="mt-1 text-2xl font-black">{summary.convertedCompanies}</p></Card>
        </div>
      )}

      <Card>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="text-sm font-black">Claude Firma Doğrulama</p>
          <AdminStatusBadge tone="ai">Hazır Claude Promptu</AdminStatusBadge>
        </div>
        <p className="mb-3 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>Claude Ön İnceleme projesinde firmayı HK Dijital bağlantısı üzerinden doğrulamak için hazır prompt.</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={verifyCompanyName}
            onChange={(e) => setVerifyCompanyName(e.target.value)}
            placeholder="Firma adı (örn. ABC Klima)"
            className="min-w-[200px] flex-1 rounded-full border py-2 px-3.5 text-sm font-bold"
            style={{ borderColor: "var(--admin-border)" }}
          />
          <AdminButton variant="secondary" compact icon={<Copy size={14} />} disabled={!verifyCompanyName.trim()} onClick={copyVerificationPrompt}>
            {verifyCopied ? "Kopyalandı ✓" : "Promptu Kopyala"}
          </AdminButton>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <button type="button" onClick={() => setPickerOpen((v) => !v)} className="flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-black" style={{ borderColor: "var(--admin-border)" }}>
            {companyName || "Tüm firmalar"} <ChevronDown size={14} />
          </button>
          {pickerOpen && (
            <div className="absolute z-10 mt-1 max-h-72 w-64 overflow-y-auto rounded-[12px] border bg-white p-1 shadow-lg" style={{ borderColor: "var(--admin-border)" }}>
              <button type="button" onClick={() => { setCompanyId(""); setPickerOpen(false); }} className="block w-full rounded-[8px] px-3 py-2 text-left text-sm font-bold hover:bg-[#F3F2EE]">Tüm firmalar</button>
              {companies.map((c) => (
                <button key={c.id} type="button" onClick={() => { setCompanyId(c.id); setPickerOpen(false); }} className="block w-full rounded-[8px] px-3 py-2 text-left text-sm font-bold hover:bg-[#F3F2EE]">{c.name}</button>
              ))}
            </div>
          )}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--admin-text-muted)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rapor başlığında ara…" className="w-full rounded-full border py-2 pl-8 pr-3 text-sm font-bold" style={{ borderColor: "var(--admin-border)" }} />
        </div>
        <AdminButton variant="secondary" compact icon={<RefreshCw size={14} />} onClick={load}>Yenile</AdminButton>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {([
          ["bekleyen", `Bekleyen (${queue.pending.length})`],
          ["inceleniyor", `İnceleniyor (${queue.inReview.length})`],
          ["tamamlanan", `Tamamlanan (${grouped.length})`],
          ["iptal", `İptal Edilenler (${queue.rejected.length})`]
        ] as Array<[Tab, string]>).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className="rounded-full px-3.5 py-2 text-xs font-black transition" style={tab === key ? { background: "#0891b2", color: "white" } : { background: "var(--admin-surface-soft, #F3F2EE)", color: "var(--admin-text-secondary)" }}>
            {label}
          </button>
        ))}
      </div>

      {actionMessage && <p className="text-sm font-bold" style={{ color: "var(--admin-text-secondary)" }}>{actionMessage}</p>}
      {loadError && <p className="text-sm font-bold text-[#dc2626]">{loadError}</p>}
      {reports === null && <p className="text-sm font-bold" style={{ color: "var(--admin-text-muted)" }}>Yükleniyor…</p>}

      {tab === "bekleyen" && (
        queue.pending.length
          ? <div className="grid gap-2">{queue.pending.map((lead) => <QueueLeadRow key={lead.id} lead={lead} onCopyPrompt={copyClaudePromptForLead} onReject={setRejectTarget} />)}</div>
          : <Card><p className="text-sm font-bold" style={{ color: "var(--admin-text-secondary)" }}>Bekleyen aday yok. Müşteri Keşfi&apos;nde &quot;Ön İncele&quot; ile aday ekleyin.</p></Card>
      )}

      {tab === "inceleniyor" && (
        queue.inReview.length
          ? <div className="grid gap-2">{queue.inReview.map((lead) => <QueueLeadRow key={lead.id} lead={lead} onCopyPrompt={copyClaudePromptForLead} onReject={setRejectTarget} />)}</div>
          : <Card><p className="text-sm font-bold" style={{ color: "var(--admin-text-secondary)" }}>İncelemede aday yok.</p></Card>
      )}

      {tab === "iptal" && (
        queue.rejected.length
          ? <div className="grid gap-2">{queue.rejected.map((lead) => <QueueLeadRow key={lead.id} lead={lead} isRejected />)}</div>
          : <Card><p className="text-sm font-bold" style={{ color: "var(--admin-text-secondary)" }}>İptal edilen aday yok.</p></Card>
      )}

      {tab === "tamamlanan" && (
        <>
          {reports && reports.length === 0 && tablesReady !== false && (
            <Card><p className="text-sm font-bold" style={{ color: "var(--admin-text-secondary)" }}>{companyName ? `${companyName} için henüz Ön İnceleme bulunmuyor.` : "Henüz tamamlanmış Ön İnceleme bulunmuyor."}</p></Card>
          )}

          {grouped.length > 0 && (
            <div className="grid gap-2">
              {grouped.map(([groupId, items]) => {
                const first = items[0];
                const company = companies.find((c) => c.id === first.company_id);
                return (
                  <Card key={groupId}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-black">{company?.name || first.title || "Aday"} · {formatDate(first.report_date)}</p>
                        <p className="text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>{first.title || "Başlıksız"}{!company && " · Lead"}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((r) => (
                          <AdminButton key={r.id} variant={selectedId === r.id ? "primary" : "secondary"} compact icon={<Eye size={13} />} onClick={() => openReport(r.id)}>
                            {r.report_type === "INTERNAL_REPORT" ? "🔒 Dahili" : "📄 Müşteri"}
                          </AdminButton>
                        ))}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {selectedId && (
            <div className="grid gap-3">
              <p className="text-sm font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Rapor Detayı</p>
              {detailLoading && <p className="text-sm font-bold" style={{ color: "var(--admin-text-muted)" }}>Yükleniyor…</p>}
              {detail && <ReportDetail report={detail} onSendOffer={setOfferTarget} onReject={(r) => setRejectTarget({ id: r.lead_id!, company: r.title, name: null, sector: null, business_type: null, city: null, district: null, website: null, phone: null, instagram: null, status: null, rejection_reason: null, rejected_at: null, notes: null, google_place_id: null, source: null, created_at: "" })} />}
            </div>
          )}
        </>
      )}

      {promptLead && (
        <Modal title="Prompt kopyalandı" onClose={() => setPromptLead(null)}>
          <p className="text-sm">Claude&apos;u nasıl açmak istersiniz?</p>
          <div className="mt-4 grid gap-2">
            <AdminButton variant="ai" icon={<ExternalLink size={14} />} onClick={openClaudeApp}>Claude App&apos;te Aç</AdminButton>
            <p className="text-[11px]" style={{ color: "var(--admin-text-muted)" }}>Bilgisayarınızda Claude masaüstü uygulaması varsayılan olarak ayarlıysa açılır; değilse tarayıcıda açılır.</p>
            <AdminButton variant="secondary" icon={<ExternalLink size={14} />} onClick={openClaudeBrowser}>Tarayıcıda Aç</AdminButton>
            <AdminButton variant="ghost" onClick={() => setPromptLead(null)}>Vazgeç</AdminButton>
          </div>
        </Modal>
      )}

      {offerTarget && (
        <Modal title="Bu işletme nereye kaydedilsin?" onClose={() => !offerSaving && setOfferTarget(null)}>
          <div className="grid gap-2">
            <AdminButton variant="success" loading={offerSaving} onClick={sendOfferToLeadPipeline}>Lead Merkezi</AdminButton>
            <AdminButton variant="warning" loading={offerSaving} onClick={sendOfferToCustomer}>Müşteriler</AdminButton>
            <p className="text-xs font-bold" style={{ color: "#b45309" }}>Müşteriler seçeneği yalnızca sözleşme/teklif kabul edilmiş gerçek müşteriler için kullanılmalıdır — doğrudan aktif müşteri kaydı oluşturur.</p>
            <AdminButton variant="ghost" disabled={offerSaving} onClick={() => setOfferTarget(null)}>Vazgeç</AdminButton>
          </div>
        </Modal>
      )}

      {rejectTarget && (
        <Modal title="İptal sebebi" onClose={() => !rejectSaving && setRejectTarget(null)}>
          <div className="grid gap-2">
            <select value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="rounded-[10px] border p-2.5 text-sm font-bold" style={{ borderColor: "var(--admin-border)" }}>
              <option value="">Seçin…</option>
              {REJECTION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder={rejectReason === "Diğer" ? "Açıklama (zorunlu)" : "Not / açıklama (opsiyonel)"} rows={3} className="rounded-[10px] border p-2.5 text-sm" style={{ borderColor: "var(--admin-border)" }} />
            <div className="flex justify-end gap-2">
              <AdminButton variant="secondary" disabled={rejectSaving} onClick={() => setRejectTarget(null)}>Vazgeç</AdminButton>
              <AdminButton variant="danger" loading={rejectSaving} disabled={!rejectReason} onClick={submitReject}>İptal Et</AdminButton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
