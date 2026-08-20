/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, CreditCard, DatabaseZap, FileBarChart, Info, ListChecks, LoaderCircle, PlugZap, RotateCcw, Save, TestTube2, UserRound } from "lucide-react";
import { filterSelectableCustomers } from "@/lib/customer-visibility";

type Company = { id: string; name: string; status?: string; website?: string; archived_at?: string | null; deleted_at?: string | null };
type Notice = { text: string; tone: "success" | "error" | "info" };

const emptyPixel = {
  pixel_id: "", dataset_id: "", conversion_api_token: "", test_event_code: "",
  pixel_enabled: false, capi_enabled: false, pixel_status: "Bekliyor", capi_status: "Bekliyor",
  last_pixel_test_at: null, last_capi_test_at: null, last_event_at: null, sync_message: "", token_saved: false, token_state: "Kayıtlı değil"
};
const emptyPayment = { amount: 0, status: "Bekliyor", due_date: "", description: "", pdf_url: "", visible_to_customer: true };
const emptyTask = { title: "", status: "Yapılacak", priority: "Normal", due_date: "", description: "", visible_to_customer: false };

export function AdminCustomerSelector({ companies, value, appliedValue, onChange, onApply, onClear }: { companies: Company[]; value: string; appliedValue: string; onChange: (value: string) => void; onApply: () => void; onClear: () => void }) {
  const active = filterSelectableCustomers(companies);
  const appliedCompany = active.find((company) => company.id === appliedValue);
  return (
    <div className="rounded-[14px] border border-cyan-200 bg-cyan-50 p-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_auto] lg:items-end">
        <label className="grid gap-2 text-xs font-black uppercase tracking-[.12em] text-cyan-800">
          Müşteri filtresi
          <select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-[10px] border border-slate-300 bg-[var(--admin-surface)] px-3 text-sm font-bold normal-case tracking-normal text-[var(--admin-text-primary)] outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100">
            <option value="">Tüm aktif müşteriler</option>
            {active.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onApply} className="min-h-11 rounded-[10px] bg-cyan-600 px-5 text-sm font-black text-white transition hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2">Filtrele</button>
          <button type="button" onClick={onClear} className="min-h-11 rounded-[10px] border border-slate-300 bg-[var(--admin-surface)] px-5 text-sm font-black text-[var(--admin-text-secondary)] transition hover:bg-[var(--admin-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">Temizle</button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-5 text-[var(--admin-text-secondary)]">Seçim, Filtrele düğmesine basıldığında uygulanır ve bu tarayıcıda hatırlanır.</p>
        {appliedCompany && <span className="rounded-full border border-cyan-200 bg-[var(--admin-surface)] px-3 py-1 text-xs font-black text-cyan-800">Filtre: {appliedCompany.name}</span>}
      </div>
      {!active.length && <NoticeMessage notice={{ text: "Filtrelenebilecek aktif müşteri bulunmuyor.", tone: "info" }} />}
    </div>
  );
}

export function MetaPixelSettingsPanel({ companyId, companyName }: { companyId: string; companyName?: string }) {
  const [form, setForm] = useState<any>(emptyPixel);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function load() {
    if (!companyId) return setForm(emptyPixel);
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/meta-pixel-settings?companyId=${encodeURIComponent(companyId)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Pixel ayarları yüklenemedi.");
      setForm({ ...emptyPixel, ...data.settings, conversion_api_token: "" });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Pixel ayarları yüklenemedi.", tone: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [companyId]);

  async function runAction(endpoint: string, body: Record<string, unknown>, progress: string, success: string) {
    if (!companyId || loading) return;
    setLoading(true);
    setNotice({ text: progress, tone: "info" });
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
      if (data.settings) setForm((current: any) => ({ ...current, ...data.settings, conversion_api_token: "" }));
      setNotice({ text: data.message || success, tone: "success" });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "İşlem tamamlanamadı.", tone: "error" });
    } finally {
      setLoading(false);
    }
  }

  if (!companyId) return <EmptyCustomerState />;
  return (
    <div className="grid gap-5">
      <div className="rounded-[14px] border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-900">
        <strong>{companyName || "Seçili müşteri"}</strong> için Meta Pixel ve Dönüşüm API ayarları. Bu alan müşteriye ait web sitesi dönüşüm takibi için kullanılır.
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Meta Pixel Kimliği" value={form.pixel_id} onChange={(value) => setForm({ ...form, pixel_id: value })} help="Meta Events Manager içindeki Pixel kimliği." />
        <Input label="Veri Seti Kimliği" value={form.dataset_id} onChange={(value) => setForm({ ...form, dataset_id: value })} help="Dönüşüm API olaylarının gönderileceği veri seti." />
        <Input label="Dönüşüm API Tokenı" type="password" value={form.conversion_api_token} onChange={(value) => setForm({ ...form, conversion_api_token: value })} placeholder={form.token_saved ? "Sunucuda kayıtlı ve maskeli" : "Token girin"} help="Kaydedildikten sonra tarayıcıya geri gönderilmez." />
        <Input label="Test Olay Kodu" value={form.test_event_code} onChange={(value) => setForm({ ...form, test_event_code: value })} help="Meta Test Events ekranındaki test kodu." />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Toggle label="Pixel aktif" checked={form.pixel_enabled} onChange={(value) => setForm({ ...form, pixel_enabled: value })} />
        <Toggle label="Dönüşüm API aktif" checked={form.capi_enabled} onChange={(value) => setForm({ ...form, capi_enabled: value })} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Status title="Pixel durumu" value={form.pixel_status} date={form.last_pixel_test_at} />
        <Status title="Dönüşüm API durumu" value={form.capi_status} date={form.last_capi_test_at} />
        <Status title="Son olay" value={form.token_state} date={form.last_event_at} />
      </div>
      {form.sync_message && <NoticeMessage notice={{ text: form.sync_message, tone: "info" }} />}
      {notice && <NoticeMessage notice={notice} />}
      <div className="flex flex-wrap gap-2 border-t border-[var(--admin-border)] pt-4">
        <Action disabled={loading} onClick={() => runAction("/api/admin/meta-pixel-settings", { ...form, company_id: companyId }, "Ayarlar kaydediliyor...", "Pixel ayarları kaydedildi.")} tone="green"><Save size={16} /> {loading ? "İşleniyor..." : "Ayarları Kaydet"}</Action>
        <Action disabled={loading} onClick={() => runAction("/api/admin/meta-pixel-test", { companyId }, "Pixel test ediliyor...", "Pixel testi tamamlandı.")} tone="cyan"><TestTube2 size={16} /> Pixel Testi</Action>
        <Action disabled={loading} onClick={() => runAction("/api/admin/conversion-api-test", { companyId }, "Dönüşüm API test ediliyor...", "Dönüşüm API testi tamamlandı.")} tone="orange"><DatabaseZap size={16} /> API Testi</Action>
        <Action disabled={loading} onClick={() => runAction("/api/admin/meta-test-event", { companyId }, "Test olayı gönderiliyor...", "Test olayı gönderildi.")} tone="blue"><CheckCircle2 size={16} /> Test Olayı Gönder</Action>
      </div>
    </div>
  );
}

export function GlobalMetaPixelSettings() {
  const [form, setForm] = useState({ pixel_id: "", enabled: true });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => { fetch("/api/admin/meta-pixel-settings?scope=global").then((response) => response.json()).then((data) => data.settings && setForm(data.settings)).catch(() => setNotice({ text: "Genel Pixel ayarları yüklenemedi.", tone: "error" })); }, []);
  async function save() {
    if (saving) return;
    setSaving(true);
    setNotice({ text: "Genel Pixel ayarları kaydediliyor...", tone: "info" });
    try {
      const response = await fetch("/api/admin/meta-pixel-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "global", ...form }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Genel Pixel ayarları kaydedilemedi.");
      setNotice({ text: "Genel Pixel ayarları kaydedildi.", tone: "success" });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Genel Pixel ayarları kaydedilemedi.", tone: "error" });
    } finally {
      setSaving(false);
    }
  }
  return <div className="grid gap-4 rounded-[14px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"><div><h3 className="font-black text-[var(--admin-text-primary)]">Genel Web Sitesi Meta Pixel</h3><p className="mt-1 text-sm text-[var(--admin-text-secondary)]">Panelde kayıtlı değer varsa ortam değişkenindeki genel Pixel kimliğinden önce kullanılır.</p></div><Input label="Genel Meta Pixel Kimliği" value={form.pixel_id} onChange={(pixel_id) => setForm({ ...form, pixel_id })} /><Toggle label="Web sitesinde aktif" checked={form.enabled} onChange={(enabled) => setForm({ ...form, enabled })} />{notice && <NoticeMessage notice={notice} />}<Action disabled={saving} onClick={save} tone="green"><Save size={16} /> {saving ? "Kaydediliyor..." : "Ayarları Kaydet"}</Action></div>;
}

export function CustomerOperationsCenter({ companies, companyId, reports = [], onReportSaved, initialTab = "Meta Pixel & CAPI" }: { companies: Company[]; companyId: string; reports?: any[]; onReportSaved?: (report: any) => void; initialTab?: string }) {
  const tabDefinitions = [
    { key: "pixel", label: "Meta Pixel ve Dönüşüm API" },
    { key: "google", label: "Google Ads Raporu" },
    { key: "payments", label: "Tahsilatlar" },
    { key: "tasks", label: "Görevler" }
  ];
  const initialKey = initialTab.includes("Google") ? "google" : initialTab === "Ödemeler" || initialTab === "Tahsilatlar" ? "payments" : initialTab === "Görevler" ? "tasks" : "pixel";
  const [tab, setTab] = useState(initialKey);
  const company = companies.find((item) => item.id === companyId);
  return <div className="grid gap-5">
    {companyId && <CustomerWorkflowLinks companyId={companyId} />}
    <div className="premium-scrollbar flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Müşteri operasyon bölümleri">
      {tabDefinitions.map((item) => <button type="button" role="tab" aria-selected={tab === item.key} key={item.key} onClick={() => setTab(item.key)} className={`min-h-11 shrink-0 rounded-[10px] px-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 ${tab === item.key ? "bg-cyan-600 text-white" : "border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-secondary)] hover:border-cyan-300 hover:bg-cyan-50"}`}>{item.label}</button>)}
    </div>
    {tab === "pixel" && <MetaPixelSettingsPanel companyId={companyId} companyName={company?.name} />}
    {tab === "google" && <GoogleReportEditor companyId={companyId} reports={reports} onSaved={onReportSaved} />}
    {tab === "payments" && <OperationRecords companyId={companyId} resource="payment" />}
    {tab === "tasks" && <OperationRecords companyId={companyId} resource="task" />}
  </div>;
}

export function CustomerWorkflowLinks({ companyId }: { companyId: string }) {
  const links = [
    { label: "Müşteri kaydı", href: `/hk-admin/musteriler?companyId=${companyId}`, icon: UserRound },
    { label: "Görevler", href: `/hk-admin/gorevler?companyId=${companyId}`, icon: ListChecks },
    { label: "Tahsilatlar", href: `/hk-admin/muhasebe?tab=tahsilatlar&companyId=${companyId}`, icon: CreditCard },
    { label: "Raporlar", href: `/hk-admin/musteri-raporlari?companyId=${companyId}`, icon: FileBarChart },
    { label: "Entegrasyonlar", href: `/hk-admin/musteri-entegrasyonlari?companyId=${companyId}`, icon: PlugZap }
  ];
  return <nav aria-label="İlgili müşteri işlemleri" className="rounded-[14px] border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-black text-[var(--admin-text-primary)]">İlgili İşlemler</h3><p className="mt-1 text-xs text-[var(--admin-text-secondary)]">Seçili müşteri bağlamını kaybetmeden iş akışına devam edin.</p></div><Link href={`/musteri-paneli?company=${companyId}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-cyan-200 bg-[var(--admin-surface)] px-3 text-xs font-black text-cyan-800 hover:bg-cyan-50">Müşteri panelini aç <ArrowRight size={14} /></Link></div>
    <div className="mt-3 flex flex-wrap gap-2">{links.map(({ label, href, icon: Icon }) => <Link key={label} href={href} className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs font-black text-[var(--admin-text-secondary)] transition hover:border-cyan-300 hover:text-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"><Icon size={15} />{label}</Link>)}</div>
  </nav>;
}

function GoogleReportEditor({ companyId, reports, onSaved }: { companyId: string; reports: any[]; onSaved?: (report: any) => void }) {
  const current = useMemo(() => reports.find((report) => report.company_id === companyId && report.report_type === "Google Ads Raporu"), [reports, companyId]);
  const [form, setForm] = useState<any>({ customer_id: "", spent: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, conversions: 0, conversion_rate: 0 });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => { setForm({ customer_id: current?.raw_extracted_data?.customer_id || "", spent: current?.metrics?.spent || current?.metrics?.cost || 0, impressions: current?.metrics?.impressions || 0, clicks: current?.metrics?.clicks || 0, ctr: current?.metrics?.ctr || 0, cpc: current?.metrics?.cpc || current?.metrics?.average_cpc || 0, conversions: current?.metrics?.conversions || 0, conversion_rate: current?.metrics?.conversion_rate || 0 }); setNotice(null); }, [current?.id, companyId]);
  async function save() {
    if (!companyId || saving) return;
    setSaving(true);
    setNotice({ text: "Google Ads raporu kaydediliyor...", tone: "info" });
    try {
      const payload = { id: current?.id, company_id: companyId, report_type: "Google Ads Raporu", platform: "Google", period: new Date().toLocaleDateString("tr-TR", { month: "long", year: "numeric" }), start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10), end_date: new Date().toISOString().slice(0, 10), metrics: { ...form, cost: Number(form.spent), average_cpc: Number(form.cpc) }, raw_extracted_data: { customer_id: form.customer_id, source: "Manuel" }, visible_to_customer: true };
      const response = await fetch("/api/admin/reports", { method: current?.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Google Ads raporu kaydedilemedi.");
      onSaved?.(data.report);
      setNotice({ text: data.duplicatePrevented ? "Bu dönem için mevcut Google Ads raporu korundu." : "Google Ads raporu kaydedildi.", tone: "success" });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Google Ads raporu kaydedilemedi.", tone: "error" });
    } finally {
      setSaving(false);
    }
  }
  if (!companyId) return <EmptyCustomerState />;
  const fields = [["Google Ads Müşteri Kimliği", "customer_id"], ["Harcama", "spent"], ["Gösterim", "impressions"], ["Tıklama", "clicks"], ["CTR (tıklama oranı)", "ctr"], ["CPC (tıklama başına maliyet)", "cpc"], ["Dönüşüm", "conversions"], ["Dönüşüm oranı", "conversion_rate"]];
  return <div className="grid gap-4"><NoticeMessage notice={{ text: "Google Ads API bağlantısı yoksa doğrulanmış manuel rapor verisini bu alandan girebilirsiniz.", tone: "info" }} /><div className="grid gap-4 md:grid-cols-2">{fields.map(([label, key]) => <Input key={key} label={label} type={key === "customer_id" ? "text" : "number"} value={form[key]} onChange={(value) => setForm({ ...form, [key]: key === "customer_id" ? value : Number(value) })} />)}</div>{notice && <NoticeMessage notice={notice} />}<div className="flex justify-end border-t border-[var(--admin-border)] pt-4"><Action disabled={saving} onClick={save} tone="green"><Save size={16} /> {saving ? "Kaydediliyor..." : "Google Ads Raporunu Kaydet"}</Action></div></div>;
}

function OperationRecords({ companyId, resource }: { companyId: string; resource: "payment" | "task" }) {
  const payment = resource === "payment";
  const initialForm = payment ? emptyPayment : emptyTask;
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function load() {
    if (!companyId) return setItems([]);
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/customer-operations?companyId=${encodeURIComponent(companyId)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Kayıtlar yüklenemedi.");
      setItems(payment ? data.payments || [] : data.tasks || []);
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Kayıtlar yüklenemedi.", tone: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { setForm(initialForm); setNotice(null); load(); }, [companyId, resource]);

  async function save() {
    if (!companyId || saving) return;
    if (payment && Number(form.amount) <= 0) return setNotice({ text: "Tahsilat tutarı sıfırdan büyük olmalıdır.", tone: "error" });
    if (!payment && !String(form.title || "").trim()) return setNotice({ text: "Görev başlığı zorunludur.", tone: "error" });
    setSaving(true);
    setNotice({ text: payment ? "Tahsilat kaydediliyor..." : "Görev kaydediliyor...", tone: "info" });
    try {
      const response = await fetch("/api/admin/customer-operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resource, item: { ...form, company_id: companyId } }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Kayıt kaydedilemedi.");
      setForm(payment ? emptyPayment : emptyTask);
      setNotice({ text: data.message || (payment ? "Tahsilat kaydedildi." : "Görev kaydedildi."), tone: "success" });
      await load();
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Kayıt kaydedilemedi.", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (!companyId) return <EmptyCustomerState />;
  const primaryInputId = payment ? "quick-payment-amount" : "quick-task-title";
  return <div className="grid gap-5">
    <div className="grid gap-4 md:grid-cols-2">{payment ? <><Input id={primaryInputId} label="Tahsilat tutarı" type="number" value={form.amount} onChange={(amount) => setForm({ ...form, amount: Number(amount) })} /><Select label="Durum" value={form.status} options={["Ödendi", "Bekliyor", "Gecikti"]} onChange={(status) => setForm({ ...form, status })} /><Input label="Son ödeme tarihi" type="date" value={form.due_date} onChange={(due_date) => setForm({ ...form, due_date })} /><Input label="PDF bağlantısı (isteğe bağlı)" value={form.pdf_url} onChange={(pdf_url) => setForm({ ...form, pdf_url })} /></> : <><Input id={primaryInputId} label="Görev başlığı" value={form.title} onChange={(title) => setForm({ ...form, title })} /><Select label="Durum" value={form.status} options={["Yapılacak", "Devam Ediyor", "Beklemede", "Tamamlandı"]} onChange={(status) => setForm({ ...form, status })} /><Select label="Öncelik" value={form.priority} options={["Düşük", "Normal", "Yüksek", "Kritik"]} onChange={(priority) => setForm({ ...form, priority })} /><Input label="Son tarih" type="date" value={form.due_date} onChange={(due_date) => setForm({ ...form, due_date })} /></>}<Input label="Açıklama" value={form.description} onChange={(description) => setForm({ ...form, description })} /><Toggle label="Müşteri panelinde göster" checked={form.visible_to_customer} onChange={(visible_to_customer) => setForm({ ...form, visible_to_customer })} /></div>
    {notice && <NoticeMessage notice={notice} />}
    <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--admin-border)] pt-4"><Action disabled={saving} onClick={() => { setForm(payment ? emptyPayment : emptyTask); setNotice(null); }} tone="neutral"><RotateCcw size={16} /> Formu Temizle</Action><Action disabled={saving} onClick={save} tone="green">{saving ? <LoaderCircle className="animate-spin" size={16} /> : payment ? <CreditCard size={16} /> : <ListChecks size={16} />} {saving ? "Kaydediliyor..." : payment ? "Tahsilat Ekle" : "Görev Ekle"}</Action></div>
    <section aria-busy={loading} aria-live="polite" className="grid gap-3">
      {loading ? <LoadingRows /> : items.map((item) => <article key={item.id} className="rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><strong className="text-[var(--admin-text-primary)]">{payment ? `${Number(item.amount || 0).toLocaleString("tr-TR")} TL` : item.title}</strong><StatusBadge status={item.status} /></div><p className="mt-2 text-sm leading-6 text-[var(--admin-text-secondary)]">{item.description || item.payment_note || "Açıklama eklenmemiş."}</p><p className="mt-1 text-xs font-semibold text-[var(--admin-text-muted)]">{item.due_date ? `Tarih: ${new Date(`${item.due_date}T00:00:00`).toLocaleDateString("tr-TR")}` : "Tarih tanımlanmamış."}</p></article>)}
      {!loading && !items.length && <EmptyState title={payment ? "Henüz tahsilat kaydı yok" : "Henüz görev kaydı yok"} description={payment ? "İlk tahsilatı ekleyerek finans akışını bu müşteriyle ilişkilendirin." : "İlk görevi ekleyerek müşteri operasyonunun sonraki adımını netleştirin."} actionLabel={payment ? "İlk tahsilatı ekle" : "İlk görevi oluştur"} onAction={() => document.getElementById(primaryInputId)?.focus()} icon={payment ? <CreditCard size={22} /> : <ListChecks size={22} />} />}
    </section>
  </div>;
}

function EmptyCustomerState() { return <EmptyState title="Önce bir müşteri seçin" description="Müşteri seçildiğinde ilgili kayıtlar, bağlantılar ve hızlı işlemler burada görüntülenir." icon={<UserRound size={22} />} />; }
function EmptyState({ title, description, actionLabel, onAction, icon }: { title: string; description: string; actionLabel?: string; onAction?: () => void; icon: ReactNode }) { return <div className="rounded-[14px] border border-dashed border-cyan-300 bg-cyan-50 p-7 text-center text-[var(--admin-text-primary)]"><span className="mx-auto grid size-11 place-items-center rounded-[12px] bg-[var(--admin-surface)] text-cyan-700 shadow-sm">{icon}</span><p className="mt-3 font-black">{title}</p><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--admin-text-secondary)]">{description}</p>{actionLabel && onAction && <button type="button" onClick={onAction} className="mt-4 min-h-11 rounded-[10px] bg-cyan-600 px-4 text-sm font-black text-white hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2">{actionLabel}</button>}</div>; }
function LoadingRows() { return <>{[1, 2].map((item) => <div key={item} className="animate-pulse rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"><div className="h-4 w-1/3 rounded bg-slate-200" /><div className="mt-3 h-3 w-3/4 rounded bg-slate-100" /></div>)}</>; }
function NoticeMessage({ notice }: { notice: Notice }) { const tones = { success: "border-emerald-200 bg-emerald-50 text-emerald-800", error: "border-red-200 bg-red-50 text-red-800", info: "border-cyan-200 bg-cyan-50 text-cyan-800" }; const Icon = notice.tone === "success" ? CheckCircle2 : notice.tone === "error" ? AlertCircle : Info; return <p role={notice.tone === "error" ? "alert" : "status"} className={`mt-3 flex items-start gap-2 rounded-[10px] border p-3 text-sm font-bold ${tones[notice.tone]}`}><Icon className="mt-0.5 shrink-0" size={16} />{notice.text}</p>; }
function StatusBadge({ status }: { status?: string }) { const danger = status === "Gecikti" || status === "Kritik"; const success = status === "Ödendi" || status === "Tamamlandı"; return <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${danger ? "bg-red-50 text-red-700 ring-red-200" : success ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}>{status || "Bekliyor"}</span>; }
function Input({ id, label, value, onChange, type = "text", placeholder = "", help = "" }: { id?: string; label: string; value: string | number | null | undefined; onChange: (value: string) => void; type?: string; placeholder?: string; help?: string }) { return <label className="grid gap-2 text-sm font-bold text-[var(--admin-text-secondary)]">{label}<input id={id} type={type} value={value ?? ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-[8px] border border-slate-300 bg-[var(--admin-surface)] px-3 text-[var(--admin-text-primary)] outline-none placeholder:text-[var(--admin-text-muted)] focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" />{help && <span className="text-xs font-normal leading-5 text-[var(--admin-text-muted)]">{help}</span>}</label>; }
function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <label className="grid gap-2 text-sm font-bold text-[var(--admin-text-secondary)]">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-[8px] border border-slate-300 bg-[var(--admin-surface)] px-3 text-[var(--admin-text-primary)] outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100">{options.map((option) => <option key={option}>{option}</option>)}</select></label>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex min-h-11 items-center gap-3 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 text-sm font-bold text-[var(--admin-text-secondary)] focus-within:ring-2 focus-within:ring-cyan-100"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-cyan-600" /> {label}</label>; }
function Status({ title, value, date }: any) { return <div className="rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] p-4"><p className="text-xs font-black uppercase tracking-[.12em] text-[var(--admin-text-muted)]">{title}</p><p className="mt-2 font-black text-[var(--admin-text-primary)]">{value || "Bekliyor"}</p><p className="mt-1 text-xs text-[var(--admin-text-muted)]">{date ? new Date(date).toLocaleString("tr-TR") : "Henüz test edilmedi"}</p></div>; }
function Action({ children, onClick, disabled = false, tone = "cyan" }: { children: ReactNode; onClick: () => void; disabled?: boolean; tone?: "cyan" | "blue" | "green" | "orange" | "neutral" }) { const colors = { cyan: "bg-cyan-600 text-white hover:bg-cyan-700", blue: "bg-blue-600 text-white hover:bg-blue-700", green: "bg-emerald-600 text-white hover:bg-emerald-700", orange: "bg-orange-600 text-white hover:bg-orange-700", neutral: "border border-slate-300 bg-[var(--admin-surface)] text-[var(--admin-text-secondary)] hover:bg-[var(--admin-surface-soft)]" }; return <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${colors[tone]}`}>{children}</button>; }
