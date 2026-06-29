"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ExternalLink, Info, ShieldAlert } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";

const statusClass: Record<string, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  prepared: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  error: "bg-red-50 text-red-700 ring-red-200"
};

function statusLabel(status?: string) {
  if (status === "error") return "Hata";
  if (status === "warning") return "Dikkat";
  if (status === "prepared") return "Hazırlandı";
  return "Başarılı";
}

export function ActionResultPanel({ result, onNavigate, compact = false }: { result: ActionResult; onNavigate?: (link: string) => void; compact?: boolean }) {
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const createdRecords = result.createdRecords || [];
  const nextActions = result.nextActions || [];
  const checkLinks = result.checkLinks || [];

  return (
    <section className={`rounded-[18px] border border-cyan-200 bg-cyan-50 p-4 text-slate-900 ${compact ? "" : "shadow-sm"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">İşlem Sonucu Rehberi</p>
          <h3 className="mt-1 text-lg font-black text-slate-950">{result.title || "İşlem tamamlandı"}</h3>
          <p className="mt-2 text-sm leading-6 text-cyan-900">{result.summary}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${statusClass[result.status] || statusClass.success}`}>{statusLabel(result.status)}</span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-[14px] border border-cyan-200 bg-white p-3">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900"><Info size={16} /> Ne oldu?</div>
          <div className="mt-2 grid gap-1 text-xs leading-5 text-slate-600">
            {result.entityType && <span>Kayıt türü: <b>{result.entityType}</b></span>}
            {result.companyId && <span>Müşteri bağlantısı hazır.</span>}
            {result.branchId && <span>Şube bağlantısı hazır.</span>}
            <span>{result.customerVisibility?.label || "Bu kayıt şu anda sadece admin tarafında görünüyor."}</span>
          </div>
        </div>
        <div className="rounded-[14px] border border-cyan-200 bg-white p-3">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900"><CheckCircle2 size={16} /> Oluşan kayıtlar</div>
          <div className="mt-2 grid gap-2">
            {createdRecords.length ? createdRecords.map((record) => (
              <div key={`${record.label}-${record.status}`} className="flex items-center justify-between gap-2 rounded-[10px] bg-slate-50 px-3 py-2 text-xs">
                <span className="font-bold text-slate-700">{record.label}</span>
                <span className="rounded-full bg-white px-2 py-1 font-black text-cyan-700 ring-1 ring-cyan-100">{record.count ?? 1} · {record.status || "Hazır"}</span>
              </div>
            )) : <p className="text-xs text-slate-500">Bu işlem yeni kayıt oluşturmadan mevcut kaydı güncelledi.</p>}
          </div>
        </div>
        <div className="rounded-[14px] border border-cyan-200 bg-white p-3">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900"><ShieldAlert size={16} /> Şimdi ne yapmalısın?</div>
          <ol className="mt-2 grid list-decimal gap-1 pl-4 text-xs leading-5 text-slate-600">
            {(nextActions.length ? nextActions : ["İlgili kaydı kontrol et.", "Eksik alan varsa tamamla.", "Müşteriye görünürlük ayarını ayrıca değerlendir."]).map((action) => <li key={action}>{action}</li>)}
          </ol>
        </div>
      </div>

      {checkLinks.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {checkLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => link.href && onNavigate?.(link.href)}
              className="inline-flex items-center gap-2 rounded-[10px] border border-cyan-200 bg-white px-3 py-2 text-xs font-black text-cyan-700"
            >
              {link.label} <ExternalLink size={13} />
            </button>
          ))}
        </div>
      )}

      <button onClick={() => setTechnicalOpen((value) => !value)} className="mt-4 inline-flex items-center gap-2 text-xs font-black text-cyan-800">
        Teknik detayı {technicalOpen ? "gizle" : "göster"} <ChevronDown size={14} />
      </button>
      {technicalOpen && (
        <pre className="mt-2 max-h-52 overflow-auto rounded-[12px] bg-slate-950 p-3 text-xs text-cyan-50">
          {JSON.stringify(result.technicalDetails || {}, null, 2)}
        </pre>
      )}
    </section>
  );
}
