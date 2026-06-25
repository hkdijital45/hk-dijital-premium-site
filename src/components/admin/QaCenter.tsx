"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Database, RefreshCw, ShieldAlert } from "lucide-react";

function badge(ok: boolean, severity?: string) {
  if (ok) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (severity === "kritik") return "border-red-200 bg-red-50 text-red-800";
  if (severity === "orta") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function QaCenter({ notify }: { notify?: (message: string, type?: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [category, setCategory] = useState("all");
  const [moduleName, setModuleName] = useState("all");
  const [severity, setSeverity] = useState("all");

  async function runScan() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/qa-center");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "QA taraması çalıştırılamadı.");
      setResult(data);
      notify?.("QA taraması tamamlandı.", data.summary?.critical ? "warning" : "success");
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "QA taraması başarısız oldu.", "error");
    } finally {
      setLoading(false);
    }
  }

  const summary = result?.summary || { total: 0, success: 0, failed: 0, critical: 0, lastRunAt: "" };
  const issues = useMemo(() => result?.issues || [], [result]);
  const categories = useMemo(() => ["all", ...Array.from(new Set(issues.map((item: any) => item.category || item.check).filter(Boolean)))], [issues]);
  const modules = useMemo(() => ["all", ...Array.from(new Set(issues.map((item: any) => item.module).filter(Boolean)))], [issues]);
  const filteredIssues = issues.filter((item: any) => (category === "all" || (item.category || item.check) === category) && (moduleName === "all" || item.module === moduleName) && (severity === "all" || item.priority === severity));

  function exportReport() {
    if (!result) {
      notify?.("Önce QA taraması çalıştırın.", "warning");
      return;
    }
    const rows = filteredIssues.map((item: any) => ({
      onem: item.priority,
      kategori: item.category || item.check,
      modul: item.module,
      dosya: item.file_path || "",
      baslik: item.title || item.check,
      aciklama: item.description || item.detail,
      onerilen_duzeltme: item.recommendation || ""
    }));
    const blob = new Blob([JSON.stringify({ summary, rows }, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hk-qa-raporu-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    notify?.("QA raporu dışa aktarıldı.", "success");
  }

  return <div className="grid gap-6">
    <section className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,.06)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Kalite Kontrol</p>
          <h2 className="mt-2 text-3xl font-black text-slate-950">HK Dijital QA Merkezi</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Admin modüllerindeki sayfa, API, Supabase migration ve aksiyon bağlantılarını güvenli statik analizle kontrol eder. Gerçek veri silme veya güncelleme işlemi yapmaz.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={runScan} disabled={loading} className="rounded-[14px] bg-cyan-500 px-5 py-3 text-sm font-black text-white disabled:opacity-60"><RefreshCw size={16} className="mr-2 inline" />{loading ? "Taranıyor..." : "Tara / Yenile"}</button>
          <button onClick={exportReport} className="rounded-[14px] border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700">Raporu Dışa Aktar</button>
        </div>
      </div>
    </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {[
        ["Genel QA Skoru", summary.score ?? 0, ClipboardCheck, "text-cyan-700"],
        ["Toplam Kontrol", summary.total, ClipboardCheck, "text-cyan-700"],
        ["Başarılı", summary.success, CheckCircle2, "text-emerald-700"],
        ["Hatalı/Uyarı", summary.failed, AlertTriangle, "text-amber-700"],
        ["Kritik", summary.critical, ShieldAlert, "text-red-700"]
      ].map(([label, value, Icon, color]: any) => <div key={label} className="rounded-[18px] border border-slate-200 bg-white p-5">
        <Icon className={color} />
        <strong className="mt-3 block text-3xl font-black text-slate-950">{value}</strong>
        <p className="mt-1 text-sm font-bold text-slate-600">{label}</p>
      </div>)}
    </section>

    {!result && <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">Henüz QA taraması yapılmadı. Başlat düğmesine basarak statik kontrol çalıştırın.</div>}

    {result && <section className="grid gap-4 lg:grid-cols-[1fr_.45fr]">
      <div className="rounded-[20px] border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-black text-slate-950">Modül Kontrol Sonuçları</h3>
            <p className="mt-1 text-sm text-slate-500">Tarama modu: {result.mode || "Statik analiz"}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">{categories.map((item: any) => <option key={item} value={item}>{item === "all" ? "Tüm kategoriler" : item}</option>)}</select>
            <select value={moduleName} onChange={(event) => setModuleName(event.target.value)} className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">{modules.map((item: any) => <option key={item} value={item}>{item === "all" ? "Tüm modüller" : item}</option>)}</select>
            <select value={severity} onChange={(event) => setSeverity(event.target.value)} className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">
              <option value="all">Tüm durumlar</option>
              <option value="kritik">Kritik</option>
              <option value="orta">Orta</option>
              <option value="dusuk">Düşük</option>
            </select>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[.12em] text-slate-500"><tr><th className="border-b border-slate-200 py-3">Modül</th><th className="border-b border-slate-200 py-3">Kategori</th><th className="border-b border-slate-200 py-3">Durum</th><th className="border-b border-slate-200 py-3">Açıklama</th><th className="border-b border-slate-200 py-3">Öneri</th></tr></thead>
            <tbody>{filteredIssues.map((item: any, index: number) => <tr key={`${item.module}-${item.check}-${index}`} className="align-top hover:bg-slate-50">
              <td className="border-b border-slate-100 py-3 font-black text-slate-900">{item.module}</td>
              <td className="border-b border-slate-100 py-3 text-slate-700">{item.category || item.check}</td>
              <td className="border-b border-slate-100 py-3"><span className={`rounded-full border px-3 py-1 text-xs font-black ${badge(false, item.priority)}`}>{item.priority === "kritik" ? "Kritik" : item.priority === "orta" ? "Orta" : "Düşük"}</span></td>
              <td className="border-b border-slate-100 py-3 text-slate-600"><strong className="text-slate-900">{item.title || item.check}</strong><br />{item.description || item.detail}<br /><span className="text-xs text-slate-400">{item.file_path || ""}{item.metadata?.line ? `:${item.metadata.line}` : ""}</span>{item.metadata?.context && <code className="mt-2 block rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-600">{item.metadata.context}</code>}</td>
              <td className="border-b border-slate-100 py-3 text-slate-600">{item.recommendation || "Manuel doğrulama yapın."}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>
      <aside className="grid gap-4">
        <div className="rounded-[20px] border border-slate-200 bg-white p-5">
          <h3 className="font-black text-slate-950">Eksik Migration Önerileri</h3>
          <div className="mt-4 grid gap-3">{result.migrationSuggestions?.length ? result.migrationSuggestions.map((item: any, index: number) => <p key={index} className="rounded-[12px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><Database size={15} className="mr-1 inline" /> {item.module}: {item.detail}</p>) : <p className="text-sm text-slate-500">Kritik migration önerisi bulunmadı.</p>}</div>
        </div>
        <div className="rounded-[20px] border border-slate-200 bg-white p-5">
          <h3 className="font-black text-slate-950">Kırık Aksiyon Sınıflandırması</h3>
          <div className="mt-4 grid gap-3">{result.issues?.length ? result.issues.map((item: any, index: number) => <p key={index} className={`rounded-[12px] border p-3 text-sm ${badge(false, item.priority)}`}><strong>{item.priority === "kritik" ? "Kritik" : item.priority === "orta" ? "Orta" : "Düşük"}:</strong> {item.module} / {item.check}<br /><span className="text-xs">{item.detail}</span></p>) : <p className="text-sm text-slate-500">Statik analizde kırık aksiyon sinyali bulunmadı.</p>}</div>
        </div>
      </aside>
    </section>}
  </div>;
}
