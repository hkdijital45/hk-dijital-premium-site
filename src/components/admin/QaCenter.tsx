"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Database, Info, RefreshCw, ShieldAlert, Wrench } from "lucide-react";

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
  const [repairOpen, setRepairOpen] = useState(true);
  const [actionOnly, setActionOnly] = useState(false);
  const [fixedItems, setFixedItems] = useState<Set<string>>(new Set());

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
  const filteredIssues = issues.filter((item: any, index: number) => {
    const key = `${item.module}-${item.title || item.check}-${index}`;
    return (category === "all" || (item.category || item.check) === category)
      && (moduleName === "all" || item.module === moduleName)
      && (severity === "all" || item.priority === severity)
      && (!actionOnly || !fixedItems.has(key));
  });

  function markFixed(key: string) {
    setFixedItems((current) => new Set([...current, key]));
    notify?.("Bu bulgu bu oturumda düzeltildi olarak işaretlendi. Kalıcı doğrulama için tekrar kontrol çalıştırın.", "success");
  }

  function goToIssue(item: any) {
    if (item.actionRoute) window.open(item.actionRoute, "_self");
    else notify?.("Bu bulgu için doğrudan sayfa bağlantısı yok.", "warning");
  }

  async function copyCodeRef(item: any) {
    const ref = item.codeReference || item.file_path || "";
    if (!ref) {
      notify?.("Kod referansı bulunamadı.", "warning");
      return;
    }
    await navigator.clipboard?.writeText(ref).catch(() => null);
    notify?.("Kod referansı kopyalandı.", "success");
  }

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

    <section className="rounded-[22px] border border-cyan-200 bg-cyan-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-[16px] bg-white text-cyan-700"><Info size={20} /></span>
          <div>
            <h3 className="font-black text-slate-950">{result?.help?.title || "Bu ekran ne işe yarar?"}</h3>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-cyan-950">{result?.help?.description || "QA Center, sistemde çalışmayan butonları, eksik migrationları, bozuk API bağlantılarını, güvenlik risklerini, eksik yönlendirmeleri ve teknik borçları kontrol eder. Buradaki uyarılar sistemin hemen çöktüğü anlamına gelmez; hangi alanların güçlendirilmesi gerektiğini gösterir."}</p>
          </div>
        </div>
        <button onClick={() => setRepairOpen((value) => !value)} className="rounded-[14px] bg-cyan-500 px-4 py-3 text-sm font-black text-white">{repairOpen ? "Onarım planını gizle" : "Öncelikli onarım planını göster"}</button>
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

    {result && repairOpen && <section className="rounded-[22px] border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-[14px] bg-amber-50 text-amber-700"><Wrench size={18} /></span>
        <div>
          <h3 className="font-black text-slate-950">Onarım Planı</h3>
          <p className="text-sm text-slate-500">Kategorilere göre öncelik, etkilenen modül ve ilk çözüm adımı.</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(result.repairPlan || []).map((plan: any) => (
          <div key={plan.category} className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-black text-slate-950">{plan.category}</h4>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">{plan.count} sorun</span>
            </div>
            <p className="mt-2 text-xs font-black text-cyan-700">Öncelik: {plan.priority}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{plan.nextStep}</p>
            {!!plan.topIssues?.length && <div className="mt-3 grid gap-1 text-xs text-slate-500">{plan.topIssues.map((issue: string) => <span key={issue}>• {issue}</span>)}</div>}
            {!!plan.modules?.length && <p className="mt-3 text-xs font-bold text-slate-500">Modül: {plan.modules.join(", ")}</p>}
          </div>
        ))}
      </div>
    </section>}

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
            <label className="flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 sm:col-span-3">
              <input type="checkbox" checked={actionOnly} onChange={(event) => setActionOnly(event.target.checked)} />
              Sadece aksiyon gerektirenler
            </label>
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          {filteredIssues.map((item: any, index: number) => {
            const key = `${item.module}-${item.title || item.check}-${index}`;
            const fixed = fixedItems.has(key);
            return (
              <article key={key} className={`rounded-[18px] border p-4 ${fixed ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.12em] text-cyan-700">{item.category || item.check} · {item.module}</p>
                    <h4 className="mt-1 text-lg font-black text-slate-950">{item.title || item.check}</h4>
                    <p className="mt-1 text-sm text-slate-500">Nerede? {item.where || item.file_path || item.module}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${fixed ? "border-emerald-200 bg-white text-emerald-700" : badge(false, item.priority)}`}>{fixed ? "Düzeltildi işaretli" : item.riskLevel || (item.priority === "kritik" ? "Kritik" : item.priority === "orta" ? "Orta" : "Düşük")}</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <InfoBlock title="Ne anlama geliyor?" text={item.meaning || item.description || item.detail} />
                  <InfoBlock title="Kullanıcıya etkisi" text={item.userImpact || "Kullanıcı deneyimi veya operasyon güvenilirliği etkilenebilir."} />
                  <InfoBlock title="Teknik sebep" text={item.technicalReason || item.detail} />
                  <InfoBlock title="Önerilen çözüm" text={item.suggestedSolution || item.recommendation || "Manuel doğrulama yapın."} />
                </div>
                {item.metadata?.context && <code className="mt-3 block rounded bg-white px-3 py-2 text-[11px] text-slate-600 ring-1 ring-slate-200">{item.metadata.context}</code>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => goToIssue(item)} className="rounded-[12px] bg-cyan-500 px-4 py-2 text-xs font-black text-white">İlgili sayfaya git</button>
                  <button onClick={() => copyCodeRef(item)} className="rounded-[12px] border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700">Kodda kontrol et</button>
                  <button onClick={() => markFixed(key)} className="rounded-[12px] border border-emerald-200 bg-white px-4 py-2 text-xs font-black text-emerald-700">Düzeltildi işaretle</button>
                  <button onClick={runScan} className="rounded-[12px] border border-amber-200 bg-white px-4 py-2 text-xs font-black text-amber-700">Tekrar kontrol et</button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
      <aside className="grid gap-4">
        <div className="rounded-[20px] border border-slate-200 bg-white p-5">
          <h3 className="font-black text-slate-950">Eksik Migration Önerileri</h3>
          <div className="mt-4 grid gap-3">{result.migrationSuggestions?.length ? result.migrationSuggestions.map((item: any, index: number) => <p key={index} className="rounded-[12px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><Database size={15} className="mr-1 inline" /> {item.module}: {item.detail}</p>) : <p className="text-sm text-slate-500">Kritik migration önerisi bulunmadı.</p>}</div>
        </div>
        <div className="rounded-[20px] border border-slate-200 bg-white p-5">
          <h3 className="font-black text-slate-950">Kırık Aksiyon Sınıflandırması</h3>
          <div className="mt-4 grid gap-3">{result.issues?.length ? result.issues.slice(0, 12).map((item: any, index: number) => <div key={index} className={`rounded-[12px] border p-3 text-sm ${badge(false, item.priority)}`}><strong>{item.repairCategory || item.riskLevel}:</strong> {item.module} / {item.check}<br /><span className="text-xs">{item.meaning || item.detail}</span><br /><span className="mt-1 block text-xs font-bold">Çözüm: {item.suggestedSolution || item.recommendation}</span></div>) : <p className="text-sm text-slate-500">Statik analizde kırık aksiyon sinyali bulunmadı.</p>}</div>
        </div>
      </aside>
    </section>}
  </div>;
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[14px] border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-black uppercase tracking-[.12em] text-slate-500">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-700">{text}</p>
    </div>
  );
}
