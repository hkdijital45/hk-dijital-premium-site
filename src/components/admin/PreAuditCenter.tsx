"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount pattern, same accepted precedent as ContentPlanningCenter.tsx */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Copy, Eye, RefreshCw, Search } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";

/**
 * Ön İnceleme Merkezi — a report management/viewing center for pre-sale
 * digital research reports. Reports are authored entirely by the "HK
 * Dijital — Ön İnceleme" Claude Project via MCP (get_pre_audit_context /
 * save_pre_audit_report / get_latest_pre_audit_report) — this screen never
 * re-does the research itself, only lists and displays what was saved.
 */

type Company = { id: string; name: string };
type ReportType = "INTERNAL_REPORT" | "CLIENT_REPORT";
type ListItem = { id: string; company_id: string; analysis_group_id: string; report_type: ReportType; title: string; status: string; report_date: string; recommended_package: unknown; created_at: string };
type Summary = { totalPreAudits: number; thisMonth: number; potentialCompanies: number; convertedCompanies: number };
type FullReport = Record<string, unknown> & { id: string; report_type: ReportType; title: string; status: string; report_date: string; analysis_group_id: string };

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

function ReportDetail({ report }: { report: FullReport }) {
  const isInternal = report.report_type === "INTERNAL_REPORT";
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <AdminStatusBadge tone={isInternal ? "warning" : "success"}>{isInternal ? "🔒 Dahili Rapor — HK Dijital İç Kullanım" : "📄 Müşteri Raporu — Müşteriye Sunulabilir"}</AdminStatusBadge>
        <AdminStatusBadge tone="neutral">{formatDate(report.report_date as string)}</AdminStatusBadge>
        <AdminStatusBadge tone="info">{String(report.status || "draft")}</AdminStatusBadge>
      </div>

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

      {loadError && <p className="text-sm font-bold text-[#dc2626]">{loadError}</p>}
      {reports === null && <p className="text-sm font-bold" style={{ color: "var(--admin-text-muted)" }}>Yükleniyor…</p>}
      {reports && reports.length === 0 && tablesReady !== false && (
        <Card><p className="text-sm font-bold" style={{ color: "var(--admin-text-secondary)" }}>{companyName ? `${companyName} için henüz Ön İnceleme bulunmuyor.` : "Henüz Ön İnceleme bulunmuyor."}</p></Card>
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
                    <p className="text-sm font-black">{company?.name || "Firma"} · {formatDate(first.report_date)}</p>
                    <p className="text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>{first.title || "Başlıksız"}</p>
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
          {detail && <ReportDetail report={detail} />}
        </div>
      )}
    </div>
  );
}
