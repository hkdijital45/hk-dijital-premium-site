"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-filter-change pattern, same accepted precedent as ProposalModal.tsx/ManualEvaluationModal.tsx */

import { useEffect, useMemo, useState } from "react";
import { Search, Download, Copy as CopyIcon, GitBranch, Sparkles, Plus } from "lucide-react";
import { AdminDataGrid, type AdminDataGridColumn } from "@/components/admin/workspace/AdminDataGrid";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { ProposalModal } from "@/components/admin/proposals/ProposalModal";

type ProposalRow = {
  id: string;
  proposal_number: string;
  title: string;
  target_label: string;
  status: string;
  version: number;
  created_at: string;
  valid_until: string | null;
  sent_at: string | null;
  lead_id: string | null;
  company_id: string | null;
};

type LeadOption = {
  id: string; name?: string; company?: string; sector?: string; business_type?: string;
  city?: string; status?: string; created_at?: string;
};

const STATUS_OPTIONS = [
  "Taslak", "Analiz Bekleniyor", "Analiz İçe Aktarıldı", "Düzenleniyor",
  "Gönderime Hazır", "Gönderildi", "Revize Ediliyor", "Kabul Edildi", "Reddedildi", "Süresi Doldu"
];

const PAGE_SIZE = 25;

/** Teklif Merkezi — the Proposal Center dashboard: search/filter/sort/
 * paginate over the real `proposals` table via /api/admin/proposals/v2,
 * with row actions (open in the wizard, duplicate, export). This is
 * additive to, and separate from, the older stateless "Teklif Motoru"
 * (ProposalEngine) panel — it reads/writes only the new persisted
 * `proposals` table. */
export function ProposalCenterPanel({ notify, leads }: { notify?: (message: string, type?: string) => void; leads?: LeadOption[] }) {
  const [rows, setRows] = useState<ProposalRow[]>([]);
  const [total, setTotal] = useState(0);
  const [leadPickerOpen, setLeadPickerOpen] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [autoLead, setAutoLead] = useState<LeadOption | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualTargetLabel, setManualTargetLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [openProposal, setOpenProposal] = useState<ProposalRow | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (status) params.set("status", status);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(page * PAGE_SIZE));
    fetch(`/api/admin/proposals/v2?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setRows(data.proposals || []);
        setTotal(data.total || 0);
      })
      .catch(() => { if (active) notify?.("Teklifler alınamadı.", "error"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search, status, page, notify]);

  async function duplicate(row: ProposalRow) {
    const res = await fetch(`/api/admin/proposals/v2/${row.id}/duplicate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const body = await res.json();
    if (res.ok) { notify?.("Teklif kopyalandı.", "success"); setPage(0); setRows((cur) => [body.proposal, ...cur]); }
    else notify?.(body.error || "Kopyalanamadı.", "error");
  }

  async function exportDoc(row: ProposalRow, mode: "internal" | "client", format: "pdf" | "docx") {
    setDownloadingId(`${row.id}-${mode}-${format}`);
    try {
      const res = await fetch(`/api/admin/proposals/v2/${row.id}/export`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, format })
      });
      if (!res.ok) throw new Error("Belge oluşturulamadı.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${row.proposal_number}-${mode}.${format}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      notify?.("Belge indirilemedi.", "error");
    } finally {
      setDownloadingId(null);
    }
  }

  const filteredLeads = useMemo(() => {
    const q = leadSearch.trim().toLocaleLowerCase("tr");
    const pool = leads || [];
    const matches = q ? pool.filter((l) => `${l.company || ""} ${l.name || ""}`.toLocaleLowerCase("tr").includes(q)) : pool;
    return matches.slice(0, 30);
  }, [leads, leadSearch]);

  const columns: AdminDataGridColumn<ProposalRow>[] = useMemo(() => [
    { key: "proposal_number", header: "Teklif No", render: (r) => <span className="font-black">{r.proposal_number}{r.version > 1 ? ` (v${r.version})` : ""}</span> },
    { key: "target_label", header: "İşletme / Lead", render: (r) => r.target_label },
    { key: "status", header: "Durum", render: (r) => <AdminStatusBadge tone={r.status === "Kabul Edildi" ? "success" : r.status === "Reddedildi" || r.status === "Süresi Doldu" ? "danger" : "info"}>{r.status}</AdminStatusBadge> },
    { key: "created_at", header: "Oluşturulma", render: (r) => new Date(r.created_at).toLocaleDateString("tr-TR") },
    { key: "valid_until", header: "Geçerlilik", render: (r) => r.valid_until ? new Date(r.valid_until).toLocaleDateString("tr-TR") : "—" },
    {
      key: "actions", header: "İşlemler", align: "right", render: (r) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          <AdminButton variant="secondary" compact onClick={() => setOpenProposal(r)}>Aç</AdminButton>
          <AdminButton variant="secondary" compact icon={<CopyIcon size={13} />} onClick={() => duplicate(r)}>Kopyala</AdminButton>
          {r.status !== "Taslak" && (
            <AdminButton variant="secondary" compact icon={<Download size={13} />} loading={downloadingId === `${r.id}-client-pdf`} onClick={() => exportDoc(r, "client", "pdf")}>PDF</AdminButton>
          )}
          {r.sent_at && <span title="Revizyon geçmişi mevcut"><GitBranch size={14} className="mt-2 text-slate-400" /></span>}
        </div>
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [downloadingId]);

  return (
    <section className="grid gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black" style={{ color: "var(--admin-text-primary)" }}>Teklif Merkezi</h2>
          <p className="text-sm" style={{ color: "var(--admin-text-muted)" }}>Tüm teklifler, durumları ve revizyon geçmişi.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="İşletme, lead veya teklif no ara..." className="rounded-[10px] border py-2 pl-8 pr-3 text-sm" style={{ borderColor: "var(--admin-border)" }} />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} className="rounded-[10px] border p-2 text-sm" style={{ borderColor: "var(--admin-border)" }}>
            <option value="">Tüm Durumlar</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <AdminButton variant="secondary" compact icon={<Plus size={13} />} onClick={() => setManualOpen(true)}>Manuel Teklif Oluştur</AdminButton>
          <AdminButton variant="primary" compact icon={<Sparkles size={13} />} onClick={() => setLeadPickerOpen(true)}>Lead&apos;den Otomatik Teklif Oluştur</AdminButton>
        </div>
      </header>

      {manualOpen && (
        <div className="flex flex-wrap items-center gap-2 rounded-[10px] border p-3" style={{ borderColor: "var(--admin-border)" }}>
          <input autoFocus value={manualTargetLabel} onChange={(e) => setManualTargetLabel(e.target.value)} placeholder="İşletme / teklif adı..." className="flex-1 rounded-[10px] border p-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
          <AdminButton variant="primary" compact disabled={!manualTargetLabel.trim()} onClick={() => { setAutoLead({ id: "", name: manualTargetLabel } as LeadOption); setManualOpen(false); }}>Oluştur</AdminButton>
          <AdminButton variant="secondary" compact onClick={() => setManualOpen(false)}>Vazgeç</AdminButton>
        </div>
      )}

      {leadPickerOpen && (
        <div className="grid gap-2 rounded-[10px] border p-3" style={{ borderColor: "var(--admin-border)" }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-black uppercase tracking-[.06em]" style={{ color: "var(--admin-text-muted)" }}>Lead Seç — HK Admin verileri otomatik toplanacak</p>
            <button onClick={() => setLeadPickerOpen(false)} className="text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>Kapat</button>
          </div>
          <input autoFocus value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} placeholder="İşletme veya kişi adıyla ara..." className="rounded-[10px] border p-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
          <div className="max-h-[260px] overflow-y-auto grid gap-1.5">
            {filteredLeads.map((lead) => (
              <button key={lead.id} onClick={() => { setAutoLead(lead); setLeadPickerOpen(false); }} className="flex items-center justify-between gap-2 rounded-[8px] border px-3 py-2 text-left text-sm hover:bg-[var(--admin-surface-soft)]" style={{ borderColor: "var(--admin-border)" }}>
                <span className="font-bold">{lead.company || lead.name}</span>
                <span className="text-xs" style={{ color: "var(--admin-text-muted)" }}>{lead.sector || lead.business_type || "—"} · {lead.city || "—"} · {lead.status || "Yeni"}</span>
              </button>
            ))}
            {!filteredLeads.length && <p className="p-3 text-center text-sm" style={{ color: "var(--admin-text-muted)" }}>Eşleşen lead bulunamadı.</p>}
          </div>
        </div>
      )}

      <AdminDataGrid
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        emptyTitle={loading ? "Yükleniyor..." : "Teklif bulunamadı"}
        emptyDescription={loading ? undefined : "Lead Center üzerinden yeni bir teklif başlatabilirsiniz."}
      />

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm font-bold" style={{ color: "var(--admin-text-muted)" }}>
          <span>{page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} / {total}</span>
          <div className="flex gap-2">
            <AdminButton variant="secondary" compact disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Önceki</AdminButton>
            <AdminButton variant="secondary" compact disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>Sonraki</AdminButton>
          </div>
        </div>
      )}

      {openProposal && (
        <ProposalModal
          leadId={openProposal.lead_id}
          companyId={openProposal.company_id}
          targetLabel={openProposal.target_label}
          onClose={() => setOpenProposal(null)}
        />
      )}

      {autoLead && (
        <ProposalModal
          leadId={autoLead.id || null}
          targetLabel={autoLead.company || autoLead.name || "Yeni Teklif"}
          autoAggregate={Boolean(autoLead.id)}
          onClose={() => { setAutoLead(null); setManualTargetLabel(""); setPage(0); }}
        />
      )}
    </section>
  );
}
