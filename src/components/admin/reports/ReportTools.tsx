"use client";

import { useState } from "react";

function Input({ label, value, onChange, type = "text" }: any) {
  return <label className="grid gap-2 text-sm font-semibold text-slate-200">{label}<input type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-[8px] border border-white/10 bg-black/30 px-3 text-white" /></label>;
}

function Textarea({ label, value, onChange }: any) {
  return <label className="grid gap-2 text-sm font-semibold text-slate-200">{label}<textarea rows={3} value={value || ""} onChange={(event) => onChange(event.target.value)} className="rounded-[8px] border border-white/10 bg-black/30 px-3 py-3 text-white" /></label>;
}

export function ReportTools({ report, updates = [], onApplyExtracted, onUpdatesChange }: { report: any; updates?: any[]; onApplyExtracted: (patch: any) => void; onUpdatesChange?: (updates: any[]) => void }) {
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [note, setNote] = useState({ update_date: new Date().toISOString().slice(0, 10), title: "", category: "Raporlama", status: "Yapıldı", customer_note: "", next_action: "", is_visible_to_customer: true, is_pinned: false });
  const [email, setEmail] = useState({ subject: "HK Dijital performans raporunuz", message: "Güncel performans raporunuzu müşteri panelinizden inceleyebilirsiniz.", formats: ["pdf"] });
  const persisted = !String(report.id || "").startsWith("report-");
  const metrics = report.metrics || {};

  function updatePremiumMetric(key: string, value: string) {
    onApplyExtracted({ metrics: { ...metrics, [key]: value } });
  }

  async function parse(file: File) {
    const form = new FormData();
    form.append("file", file);
    setMessage("Dosya ayrıştırılıyor...");
    const response = await fetch("/api/admin/reports/import", { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));
    if (response.ok) { setPreview(data); setMessage(data.message); }
    else setMessage(data.error || "Dosya ayrıştırılamadı.");
  }

  async function addNote() {
    const response = await fetch(`/api/admin/reports/${report.id}/updates`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(note) });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.update) onUpdatesChange?.([data.update, ...updates]);
    setMessage(response.ok ? data.message : data.error || "Ajans notu kaydedilemedi.");
  }

  async function updateNote(item: any, patch: any) {
    const next = { ...item, ...patch };
    onUpdatesChange?.(updates.map((update) => update.id === item.id ? next : update));
    const response = await fetch(`/api/admin/reports/${report.id}/updates`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? data.message : data.error || "Ajans notu güncellenemedi.");
  }

  async function deleteNote(item: any) {
    if (!confirm("Bu ajans notunu silmek istediğinize emin misiniz?")) return;
    const response = await fetch(`/api/admin/reports/${report.id}/updates`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }) });
    const data = await response.json().catch(() => ({}));
    if (response.ok) onUpdatesChange?.(updates.filter((update) => update.id !== item.id));
    setMessage(response.ok ? data.message : data.error || "Ajans notu silinemedi.");
  }

  async function sendEmail() {
    const response = await fetch(`/api/admin/reports/${report.id}/send-email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(email) });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? data.message : data.error || "E-posta gönderilemedi.");
  }

  return <div className="grid gap-3">
    {message && <p className="rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm text-cyan-50">{message}</p>}
    <details className="rounded-[8px] border border-white/10 p-3"><summary className="cursor-pointer text-sm font-black">Dosyadan aktar</summary><div className="mt-3 grid gap-3"><label className="cursor-pointer rounded-[8px] border border-dashed border-cyan-200/30 p-4 text-sm text-cyan-100">CSV, XLSX veya XLS yükle<input className="hidden" type="file" accept=".csv,.xlsx,.xls,.pdf" onChange={(event) => event.target.files?.[0] && parse(event.target.files[0])} /></label>{preview && <><p className="text-sm text-slate-300">Yüklenen dosyadan çıkarılan veriler: {preview.rowCount} satır. Eksik görünen alanları rapor formunda elle tamamlayabilirsiniz.</p><pre className="max-h-48 overflow-auto rounded-[8px] bg-black/30 p-3 text-xs text-slate-300">{JSON.stringify(preview.metrics, null, 2)}</pre><button onClick={() => onApplyExtracted({ metrics: preview.metrics, time_series: preview.timeSeries, start_date: preview.startDate || report.start_date, end_date: preview.endDate || report.end_date, raw_extracted_data: preview.raw })} className="w-fit rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">Çıkarılan verileri rapora uygula</button></>}</div></details>
    <details className="rounded-[8px] border border-white/10 p-3"><summary className="cursor-pointer text-sm font-black">Ajans notu ekle</summary><div className="mt-3 grid gap-3 md:grid-cols-2"><Input label="Tarih" type="date" value={note.update_date} onChange={(value: string) => setNote({ ...note, update_date: value })} /><Input label="Başlık" value={note.title} onChange={(value: string) => setNote({ ...note, title: value })} /><label className="grid gap-2 text-sm font-semibold text-slate-200">Kategori<select value={note.category} onChange={(event) => setNote({ ...note, category: event.target.value })} className="min-h-11 rounded-[8px] border border-white/10 bg-black/30 px-3 text-white">{["Kampanya", "Kreatif", "Pixel / Ölçüm", "Raporlama", "Optimizasyon", "Toplantı / Not"].map((item) => <option key={item}>{item}</option>)}</select></label><label className="grid gap-2 text-sm font-semibold text-slate-200">Durum<select value={note.status} onChange={(event) => setNote({ ...note, status: event.target.value })} className="min-h-11 rounded-[8px] border border-white/10 bg-black/30 px-3 text-white">{["Planlandı", "Yapıldı", "Devam Ediyor"].map((item) => <option key={item}>{item}</option>)}</select></label><Textarea label="Müşteriye gösterilecek not" value={note.customer_note} onChange={(value: string) => setNote({ ...note, customer_note: value })} /><Textarea label="Sıradaki adım" value={note.next_action} onChange={(value: string) => setNote({ ...note, next_action: value })} /><label className="text-sm"><input type="checkbox" checked={note.is_visible_to_customer} onChange={(event) => setNote({ ...note, is_visible_to_customer: event.target.checked })} /> Müşteriye göster</label><label className="text-sm"><input type="checkbox" checked={note.is_pinned} onChange={(event) => setNote({ ...note, is_pinned: event.target.checked })} /> Üste sabitle</label><button disabled={!persisted} onClick={addNote} className="w-fit rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-50">Güncelle</button></div></details>
    {updates.length > 0 && <details className="rounded-[8px] border border-white/10 p-3"><summary className="cursor-pointer text-sm font-black">Mevcut çalışma günlüğü</summary><div className="mt-3 grid gap-3">{updates.map((item) => <div key={item.id} className="grid gap-3 rounded-[8px] border border-white/10 bg-black/20 p-3 md:grid-cols-2"><Input label="Tarih" type="date" value={item.update_date} onChange={(value: string) => updateNote(item, { update_date: value })} /><Input label="Başlık" value={item.title} onChange={(value: string) => updateNote(item, { title: value })} /><label className="grid gap-2 text-sm font-semibold text-slate-200">Kategori<select value={item.category || "Raporlama"} onChange={(event) => updateNote(item, { category: event.target.value })} className="min-h-11 rounded-[8px] border border-white/10 bg-black/30 px-3 text-white">{["Kampanya", "Kreatif", "Pixel / Ölçüm", "Raporlama", "Optimizasyon", "Toplantı / Not"].map((option) => <option key={option}>{option}</option>)}</select></label><label className="grid gap-2 text-sm font-semibold text-slate-200">Durum<select value={item.status || "Yapıldı"} onChange={(event) => updateNote(item, { status: event.target.value })} className="min-h-11 rounded-[8px] border border-white/10 bg-black/30 px-3 text-white">{["Planlandı", "Yapıldı", "Devam Ediyor"].map((option) => <option key={option}>{option}</option>)}</select></label><Textarea label="Müşteri notu" value={item.customer_note} onChange={(value: string) => updateNote(item, { customer_note: value })} /><Textarea label="Sıradaki adım" value={item.next_action} onChange={(value: string) => updateNote(item, { next_action: value })} /><button onClick={() => deleteNote(item)} className="w-fit rounded-full border border-red-300/30 px-3 py-2 text-xs text-red-200">Sil</button></div>)}</div></details>}
    <details className="rounded-[8px] border border-white/10 p-3"><summary className="cursor-pointer text-sm font-black">Premium rapor modülleri</summary><div className="mt-3 grid gap-3">
      <Textarea label="Önümüzdeki 7 Gün Planı (her satır bir aksiyon)" value={metrics.action_plan} onChange={(value: string) => updatePremiumMetric("action_plan", value)} />
      <Textarea label="Rakip Analizi (her satır bir rakip notu)" value={metrics.competitors} onChange={(value: string) => updatePremiumMetric("competitors", value)} />
      <Textarea label="Kreatif Merkezi (her satır bir kreatif notu veya URL)" value={metrics.creatives} onChange={(value: string) => updatePremiumMetric("creatives", value)} />
      <div className="grid gap-3 md:grid-cols-5">
        <Input label="Toplam lead" value={metrics.lead_total} onChange={(value: string) => updatePremiumMetric("lead_total", value)} />
        <Input label="Arandı" value={metrics.lead_called} onChange={(value: string) => updatePremiumMetric("lead_called", value)} />
        <Input label="Teklif verildi" value={metrics.lead_proposed} onChange={(value: string) => updatePremiumMetric("lead_proposed", value)} />
        <Input label="Satış oldu" value={metrics.lead_sold} onChange={(value: string) => updatePremiumMetric("lead_sold", value)} />
        <Input label="Takip bekliyor" value={metrics.lead_pending} onChange={(value: string) => updatePremiumMetric("lead_pending", value)} />
      </div>
      <p className="text-xs leading-5 text-slate-400">Çalışma günlüğü ve ajans notları için mevcut "Ajans notu ekle" alanını kullanın. Kategori olarak Kampanya, Kreatif, Pixel / Ölçüm, Raporlama, Optimizasyon veya Toplantı / Not yazabilirsiniz.</p>
    </div></details>
    <details className="rounded-[8px] border border-white/10 p-3"><summary className="cursor-pointer text-sm font-black">Dışa aktarma</summary><div className="mt-3 flex flex-wrap gap-2">{[["excel", "Excel indir"], ["word", "Word indir"], ["pdf", "PDF indir"]].map(([format, label]) => <a key={format} href={persisted ? `/api/admin/reports/${report.id}/export?format=${format}` : "#"} className={`rounded-full border border-white/10 px-3 py-2 text-xs ${persisted ? "" : "pointer-events-none opacity-50"}`}>{label}</a>)}</div></details>
    <details className="rounded-[8px] border border-white/10 p-3"><summary className="cursor-pointer text-sm font-black">Müşteriye e-posta gönder</summary><div className="mt-3 grid gap-3"><Input label="Konu" value={email.subject} onChange={(value: string) => setEmail({ ...email, subject: value })} /><Textarea label="Mesaj" value={email.message} onChange={(value: string) => setEmail({ ...email, message: value })} /><div className="flex flex-wrap gap-3">{[["pdf", "PDF ekle"], ["excel", "Excel ekle"], ["word", "Word ekle"]].map(([format, label]) => <label key={format} className="text-sm"><input type="checkbox" checked={email.formats.includes(format)} onChange={(event) => setEmail({ ...email, formats: event.target.checked ? [...email.formats, format] : email.formats.filter((item) => item !== format) })} /> {label}</label>)}</div><button disabled={!persisted} onClick={sendEmail} className="w-fit rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-50">Müşteriye e-posta gönder</button></div></details>
  </div>;
}
