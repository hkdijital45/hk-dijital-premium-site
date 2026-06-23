/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, CreditCard, DatabaseZap, ListChecks, Save, TestTube2 } from "lucide-react";

type Company = { id: string; name: string; status?: string; website?: string };

export function AdminCustomerSelector({ companies, value, appliedValue, onChange, onApply, onClear }: { companies: Company[]; value: string; appliedValue: string; onChange: (value: string) => void; onApply: () => void; onClear: () => void }) {
  const active = companies.filter((company) => !company.status || company.status === "Aktif");
  const appliedCompany = active.find((company) => company.id === appliedValue);
  return (
    <div className="rounded-[14px] border border-cyan-200 bg-cyan-50 p-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_auto] lg:items-end">
        <label className="grid gap-2 text-xs font-black uppercase tracking-[.12em] text-cyan-800">
          Müşteri filtresi
          <select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-[10px] border border-slate-300 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none focus:border-cyan-500">
            <option value="">Tüm aktif müşteriler</option>
            {active.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onApply} className="min-h-11 rounded-[10px] bg-cyan-500 px-5 text-sm font-black text-white transition hover:bg-cyan-600">Filtrele</button>
          <button type="button" onClick={onClear} className="min-h-11 rounded-[10px] border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50">Temizle</button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-5 text-slate-600">Seçim yalnızca Filtrele düğmesine bastığınızda uygulanır ve bu tarayıcıda hatırlanır.</p>
        {appliedCompany && <span className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-black text-cyan-800">Filtre: {appliedCompany.name}</span>}
      </div>
      {!active.length && <p className="mt-3 rounded-[10px] border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">Filtrelenebilecek aktif müşteri bulunmuyor.</p>}
    </div>
  );
}

const emptyPixel = {
  pixel_id: "", dataset_id: "", conversion_api_token: "", test_event_code: "",
  pixel_enabled: false, capi_enabled: false, pixel_status: "Bekliyor", capi_status: "Bekliyor",
  last_pixel_test_at: null, last_capi_test_at: null, last_event_at: null, sync_message: "", token_saved: false, token_state: "Kayıtlı değil"
};

export function MetaPixelSettingsPanel({ companyId, companyName }: { companyId: string; companyName?: string }) {
  const [form, setForm] = useState<any>(emptyPixel);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    if (!companyId) return setForm(emptyPixel);
    setLoading(true);
    const response = await fetch(`/api/admin/meta-pixel-settings?companyId=${encodeURIComponent(companyId)}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setForm({ ...emptyPixel, ...data.settings, conversion_api_token: "" });
    else setMessage(data.error || "Pixel ayarları yüklenemedi.");
    setLoading(false);
  }

  useEffect(() => { load(); }, [companyId]);

  async function save() {
    if (!companyId) return setMessage("Önce bir müşteri seçin.");
    setLoading(true); setMessage("Kaydediliyor...");
    const response = await fetch("/api/admin/meta-pixel-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, company_id: companyId }) });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setForm({ ...emptyPixel, ...data.settings, conversion_api_token: "" });
    setMessage(response.ok ? "Kaydedildi ✓" : data.error || "Ayarlar kaydedilemedi.");
    setLoading(false);
  }

  async function test(endpoint: string, progress: string) {
    if (!companyId) return setMessage("Önce bir müşteri seçin.");
    setLoading(true); setMessage(progress);
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId }) });
    const data = await response.json().catch(() => ({}));
    if (data.settings) setForm((current: any) => ({ ...current, ...data.settings, conversion_api_token: "" }));
    setMessage(response.ok ? data.message || "Test tamamlandı ✓" : data.error || "Test başarısız.");
    setLoading(false);
  }

  if (!companyId) return <EmptyCustomerState />;
  return (
    <div className="grid gap-5">
      <div className="rounded-[14px] border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-900">
        <strong>{companyName || "Seçili müşteri"}</strong> için Meta Pixel & Conversion API ayarları. Bu alan müşteriye ait web sitesi dönüşüm takibi için kullanılır.
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Meta Pixel ID" value={form.pixel_id} onChange={(value) => setForm({ ...form, pixel_id: value })} help="Meta Events Manager içindeki Pixel ID." />
        <Input label="Dataset ID (veri seti ID)" value={form.dataset_id} onChange={(value) => setForm({ ...form, dataset_id: value })} help="Conversion API olaylarının gönderileceği veri seti." />
        <Input label="Conversion API Token" type="password" value={form.conversion_api_token} onChange={(value) => setForm({ ...form, conversion_api_token: value })} placeholder={form.token_saved ? "Sunucuda kayıtlı / maskeli" : "Token girin"} help="Kaydedildikten sonra tarayıcıya geri gönderilmez." />
        <Input label="Test Event Code" value={form.test_event_code} onChange={(value) => setForm({ ...form, test_event_code: value })} help="Meta Test Events ekranındaki test kodu." />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Toggle label="Pixel Aktif" checked={form.pixel_enabled} onChange={(value) => setForm({ ...form, pixel_enabled: value })} />
        <Toggle label="Conversion API Aktif" checked={form.capi_enabled} onChange={(value) => setForm({ ...form, capi_enabled: value })} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Status title="Pixel Durumu" value={form.pixel_status} date={form.last_pixel_test_at} />
        <Status title="Conversion API Durumu" value={form.capi_status} date={form.last_capi_test_at} />
        <Status title="Son Event (olay)" value={form.token_state} date={form.last_event_at} />
      </div>
      {form.sync_message && <p className="rounded-[8px] border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">{form.sync_message}</p>}
      {message && <p className="rounded-[8px] border border-cyan-200 bg-cyan-50 p-3 text-sm font-bold text-cyan-800">{message}</p>}
      <div className="flex flex-wrap gap-2">
        <Action disabled={loading} onClick={save} tone="cyan"><Save size={15} /> {loading ? "İşleniyor..." : "Kaydet"}</Action>
        <Action disabled={loading} onClick={() => test("/api/admin/meta-pixel-test", "Pixel test ediliyor...")} tone="green"><TestTube2 size={15} /> Pixel Test Et</Action>
        <Action disabled={loading} onClick={() => test("/api/admin/conversion-api-test", "Conversion API test ediliyor...")} tone="orange"><DatabaseZap size={15} /> Conversion API Test Et</Action>
        <Action disabled={loading} onClick={() => test("/api/admin/meta-test-event", "Test event gönderiliyor...")} tone="blue"><CheckCircle2 size={15} /> Test Event Gönder</Action>
      </div>
    </div>
  );
}

export function GlobalMetaPixelSettings() {
  const [form, setForm] = useState({ pixel_id: "", enabled: true });
  const [message, setMessage] = useState("");
  useEffect(() => { fetch("/api/admin/meta-pixel-settings?scope=global").then((response) => response.json()).then((data) => data.settings && setForm(data.settings)).catch(() => undefined); }, []);
  async function save() {
    setMessage("Kaydediliyor...");
    const response = await fetch("/api/admin/meta-pixel-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "global", ...form }) });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Genel Pixel kaydedildi ✓" : data.error || "Kaydedilemedi.");
  }
  return <div className="grid gap-4 rounded-[14px] border border-slate-200 bg-white p-4"><div><h3 className="font-black text-slate-900">Genel Public Site Meta Pixel</h3><p className="mt-1 text-sm text-slate-600">Panelde kayıtlı değer varsa NEXT_PUBLIC_META_PIXEL_ID ortam değişkeninden önce kullanılır.</p></div><Input label="Genel Meta Pixel ID" value={form.pixel_id} onChange={(pixel_id) => setForm({ ...form, pixel_id })} /><Toggle label="Public sitede aktif" checked={form.enabled} onChange={(enabled) => setForm({ ...form, enabled })} />{message && <p className="text-sm font-bold text-cyan-800">{message}</p>}<Action onClick={save} tone="cyan"><Save size={15} /> Kaydet</Action></div>;
}

export function CustomerOperationsCenter({ companies, companyId, reports = [], onReportSaved, initialTab = "Meta Pixel & CAPI" }: { companies: Company[]; companyId: string; reports?: any[]; onReportSaved?: (report: any) => void; initialTab?: string }) {
  const [tab, setTab] = useState(initialTab);
  const company = companies.find((item) => item.id === companyId);
  const tabs = ["Meta Pixel & CAPI", "Google Ads", "Ödemeler", "Görevler"];
  return <div className="grid gap-5"><div className="flex flex-wrap gap-2">{tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-full px-4 py-2 text-xs font-black ${tab === item ? "bg-cyan-500 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{item}</button>)}</div>{tab === "Meta Pixel & CAPI" && <MetaPixelSettingsPanel companyId={companyId} companyName={company?.name} />}{tab === "Google Ads" && <GoogleReportEditor companyId={companyId} reports={reports} onSaved={onReportSaved} />}{tab === "Ödemeler" && <OperationRecords companyId={companyId} resource="payment" />}{tab === "Görevler" && <OperationRecords companyId={companyId} resource="task" />}</div>;
}

function GoogleReportEditor({ companyId, reports, onSaved }: { companyId: string; reports: any[]; onSaved?: (report: any) => void }) {
  const current = useMemo(() => reports.find((report) => report.company_id === companyId && report.report_type === "Google Ads Raporu"), [reports, companyId]);
  const [form, setForm] = useState<any>({ customer_id: "", spent: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, conversions: 0, conversion_rate: 0 });
  const [message, setMessage] = useState("");
  useEffect(() => { setForm({ customer_id: current?.raw_extracted_data?.customer_id || "", spent: current?.metrics?.spent || current?.metrics?.cost || 0, impressions: current?.metrics?.impressions || 0, clicks: current?.metrics?.clicks || 0, ctr: current?.metrics?.ctr || 0, cpc: current?.metrics?.cpc || current?.metrics?.average_cpc || 0, conversions: current?.metrics?.conversions || 0, conversion_rate: current?.metrics?.conversion_rate || 0 }); }, [current?.id, companyId]);
  async function save() {
    if (!companyId) return setMessage("Önce bir müşteri seçin.");
    setMessage("Kaydediliyor...");
    const payload = { id: current?.id, company_id: companyId, report_type: "Google Ads Raporu", platform: "Google", period: new Date().toLocaleDateString("tr-TR", { month: "long", year: "numeric" }), start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10), end_date: new Date().toISOString().slice(0, 10), metrics: { ...form, cost: Number(form.spent), average_cpc: Number(form.cpc) }, raw_extracted_data: { customer_id: form.customer_id, source: "Manuel" }, visible_to_customer: true };
    const response = await fetch("/api/admin/reports", { method: current?.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (response.ok) onSaved?.(data.report);
    setMessage(response.ok ? "Google Ads raporu kaydedildi ✓" : data.error || "Rapor kaydedilemedi.");
  }
  if (!companyId) return <EmptyCustomerState />;
  const fields = [["Google Ads Customer ID", "customer_id"], ["Harcama", "spent"], ["Gösterim", "impressions"], ["Tıklama", "clicks"], ["CTR (tıklama oranı)", "ctr"], ["CPC (tıklama başı maliyet)", "cpc"], ["Dönüşüm", "conversions"], ["Conversion Rate (dönüşüm oranı)", "conversion_rate"]];
  return <div className="grid gap-4"><p className="rounded-[8px] border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-800">Gerçek Google Ads API bağlantısı yoksa bu alanlardan manuel rapor verisi girebilirsiniz.</p><div className="grid gap-4 md:grid-cols-2">{fields.map(([label, key]) => <Input key={key} label={label} type={key === "customer_id" ? "text" : "number"} value={form[key]} onChange={(value) => setForm({ ...form, [key]: key === "customer_id" ? value : Number(value) })} />)}</div>{message && <p className="text-sm font-bold text-cyan-800">{message}</p>}<Action onClick={save} tone="cyan"><Save size={15} /> Google Ads Raporunu Kaydet</Action></div>;
}

function OperationRecords({ companyId, resource }: { companyId: string; resource: "payment" | "task" }) {
  const payment = resource === "payment";
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>(payment ? { amount: 0, status: "Bekliyor", due_date: "", description: "", pdf_url: "", visible_to_customer: true } : { title: "", status: "Yapılacak", priority: "Normal", due_date: "", description: "", visible_to_customer: false });
  const [message, setMessage] = useState("");
  async function load() { if (!companyId) return setItems([]); const response = await fetch(`/api/admin/customer-operations?companyId=${companyId}`); const data = await response.json().catch(() => ({})); setItems(payment ? data.payments || [] : data.tasks || []); }
  useEffect(() => { load(); }, [companyId, resource]);
  async function save() { if (!companyId) return setMessage("Önce bir müşteri seçin."); setMessage("Kaydediliyor..."); const response = await fetch("/api/admin/customer-operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resource, item: { ...form, company_id: companyId } }) }); const data = await response.json().catch(() => ({})); setMessage(response.ok ? data.message : data.error || "Kayıt kaydedilemedi."); if (response.ok) { await load(); setForm(payment ? { amount: 0, status: "Bekliyor", due_date: "", description: "", pdf_url: "", visible_to_customer: true } : { title: "", status: "Yapılacak", priority: "Normal", due_date: "", description: "", visible_to_customer: false }); } }
  if (!companyId) return <EmptyCustomerState />;
  return <div className="grid gap-5"><div className="grid gap-4 md:grid-cols-2">{payment ? <><Input label="Tutar" type="number" value={form.amount} onChange={(amount) => setForm({ ...form, amount: Number(amount) })} /><Select label="Durum" value={form.status} options={["Ödendi", "Bekliyor", "Gecikti"]} onChange={(status) => setForm({ ...form, status })} /><Input label="Son ödeme tarihi" type="date" value={form.due_date} onChange={(due_date) => setForm({ ...form, due_date })} /><Input label="PDF linki (opsiyonel)" value={form.pdf_url} onChange={(pdf_url) => setForm({ ...form, pdf_url })} /></> : <><Input label="Görev başlığı" value={form.title} onChange={(title) => setForm({ ...form, title })} /><Select label="Durum" value={form.status} options={["Yapılacak", "Devam Ediyor", "Beklemede", "Tamamlandı"]} onChange={(status) => setForm({ ...form, status })} /><Select label="Öncelik" value={form.priority} options={["Düşük", "Normal", "Yüksek", "Kritik"]} onChange={(priority) => setForm({ ...form, priority })} /><Input label="Son tarih" type="date" value={form.due_date} onChange={(due_date) => setForm({ ...form, due_date })} /></>}<Input label="Açıklama" value={form.description} onChange={(description) => setForm({ ...form, description })} /><Toggle label="Müşteriye göster" checked={form.visible_to_customer} onChange={(visible_to_customer) => setForm({ ...form, visible_to_customer })} /></div>{message && <p className="text-sm font-bold text-cyan-100">{message}</p>}<Action onClick={save} tone={payment ? "orange" : "cyan"}>{payment ? <CreditCard size={15} /> : <ListChecks size={15} />} {payment ? "Tahsilat Ekle" : "Görev Ekle"}</Action><div className="grid gap-3">{items.map((item) => <div key={item.id} className="rounded-[8px] border border-white/10 p-4"><div className="flex flex-wrap justify-between gap-3"><strong>{payment ? `${Number(item.amount || 0).toLocaleString("tr-TR")} TL` : item.title}</strong><span className="rounded-full bg-cyan-200/10 px-3 py-1 text-xs font-black text-cyan-100">{item.status}</span></div><p className="mt-2 text-sm text-slate-400">{item.description || "Açıklama yok"} · {item.due_date || "Tarih yok"}</p></div>)}{!items.length && <p className="rounded-[8px] border border-dashed border-white/10 p-5 text-sm text-slate-400">Henüz kayıt bulunmuyor.</p>}</div></div>;
}

function EmptyCustomerState() { return <div className="rounded-[8px] border border-dashed border-cyan-300 bg-cyan-50 p-8 text-center text-slate-900"><p className="font-black">Bir müşteri seçin</p><p className="mt-2 text-sm text-slate-600">Müşteri seçildiğinde ilgili kayıtlar ve ayarlar burada görüntülenecek.</p></div>; }
function Input({ label, value, onChange, type = "text", placeholder = "", help = "" }: { label: string; value: string | number | null | undefined; onChange: (value: string) => void; type?: string; placeholder?: string; help?: string }) { return <label className="grid gap-2 text-sm font-bold text-slate-700">{label}<input type={type} value={value ?? ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-[8px] border border-slate-300 bg-white px-3 text-slate-900 outline-none placeholder:text-slate-500 focus:border-cyan-500" />{help && <span className="text-xs font-normal leading-5 text-slate-500">{help}</span>}</label>; }
function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <label className="grid gap-2 text-sm font-bold text-slate-700">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-[8px] border border-slate-300 bg-white px-3 text-slate-900">{options.map((option) => <option key={option}>{option}</option>)}</select></label>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-3 rounded-[8px] border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /> {label}</label>; }
function Status({ title, value, date }: any) { return <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-[.12em] text-slate-500">{title}</p><p className="mt-2 font-black text-slate-900">{value || "Bekliyor"}</p><p className="mt-1 text-xs text-slate-500">{date ? new Date(date).toLocaleString("tr-TR") : "Henüz test edilmedi"}</p></div>; }
function Action({ children, onClick, disabled = false, tone = "cyan" }: { children: ReactNode; onClick: () => void; disabled?: boolean; tone?: "cyan" | "blue" | "green" | "orange" }) { const colors = { cyan: "bg-cyan-400 text-slate-950", blue: "bg-blue-500 text-white", green: "bg-emerald-500 text-white", orange: "bg-orange-500 text-white" }; return <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition hover:-translate-y-0.5 disabled:opacity-50 ${colors[tone]}`}>{children}</button>; }
