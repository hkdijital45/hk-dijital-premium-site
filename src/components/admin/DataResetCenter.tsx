"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { AlertTriangle, Download, ShieldAlert, Trash2 } from "lucide-react";
import { AdminWorkspace } from "@/components/admin/workspace/AdminWorkspace";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";

const REQUIRED_PHRASE = "HK DIGITAL RESET";

const TABLE_LABELS: Record<string, string> = {
  agency_tasks: "Görevler",
  agency_notifications: "Bildirimler",
  customer_integrations: "Müşteri Entegrasyonları",
  ad_integrations: "Reklam Entegrasyonları",
  integration_sync_logs: "Senkronizasyon Logları",
  customer_visibility_settings: "Panel Görünürlük Ayarları",
  customer_branding: "Marka Varlıkları",
  customer_branches: "Şubeler",
  customer_conversations: "Müşteri Görüşmeleri",
  payment_records: "Tahsilatlar (korunur)",
  reports: "Raporlar (korunur)",
  monthly_reports: "Aylık Raporlar (korunur)",
  customer_documents: "Belgeler (korunur)",
  customer_files: "Müşteri Dosyaları (korunur)",
  activity_logs: "İşlem Logları (korunur)"
};

type PreviewData = {
  companies: number;
  willDelete: Record<string, number>;
  willPreserve: Record<string, number>;
};

type ResetResult = {
  ok: boolean;
  mode: "demo" | "full";
  total: number;
  succeeded: number;
  results: Array<{ id: string; name: string; ok: boolean; error?: string }>;
  message?: string;
};

function TableCountRow({ table, count }: { table: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] px-3 py-2 text-sm">
      <span className="font-bold text-[var(--admin-text-secondary)]">{TABLE_LABELS[table] || table}</span>
      <strong className="text-[var(--admin-text-primary)]">{count < 0 ? "Sayılamadı" : count.toLocaleString("tr-TR")}</strong>
    </div>
  );
}

export function DataResetCenter() {
  const [mode, setMode] = useState<"demo" | "full">("demo");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [targetCount, setTargetCount] = useState(0);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [fullAck, setFullAck] = useState(false);
  const [secondConfirmOpen, setSecondConfirmOpen] = useState(false);
  const [result, setResult] = useState<ResetResult | null>(null);

  function switchMode(next: "demo" | "full") {
    setMode(next);
    setPreview(null);
    setTargetCount(0);
    setConfirmationText("");
    setFullAck(false);
    setSecondConfirmOpen(false);
    setResult(null);
    setError("");
  }

  async function runPreview() {
    setLoading("preview");
    setError("");
    setResult(null);
    try {
      const response = await fetch(`/api/admin/data-reset/preview?mode=${mode}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Önizleme alınamadı.");
      setPreview(payload.preview);
      setTargetCount(payload.targets?.length || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Önizleme alınamadı.");
    } finally {
      setLoading("");
    }
  }

  async function downloadBackup() {
    setLoading("export");
    setError("");
    try {
      const response = await fetch(`/api/admin/data-reset/export?mode=${mode}`, { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Yedek indirilemedi.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `hk-dijital-reset-backup-${mode}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yedek indirilemedi.");
    } finally {
      setLoading("");
    }
  }

  async function executeReset() {
    setLoading("execute");
    setError("");
    try {
      const response = await fetch("/api/admin/data-reset/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, confirmationPhrase: confirmationText, confirmSecond: true })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Sıfırlama işlemi başarısız oldu.");
      setResult(payload);
      setPreview(null);
      setConfirmationText("");
      setFullAck(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sıfırlama işlemi başarısız oldu.");
    } finally {
      setLoading("");
      setSecondConfirmOpen(false);
    }
  }

  const canRequestReset = Boolean(preview) && confirmationText === REQUIRED_PHRASE && (mode === "demo" || fullAck) && targetCount > 0;

  return (
    <div className="w-full min-w-0 max-w-none">
      <AdminWorkspace
        eyebrow="Sistem · Veri Yönetimi"
        title="Veri Sıfırlama Merkezi"
        description="Demo/test verilerini veya tüm müşteri operasyon verilerini önizleme, yedekleme ve çift onayla güvenli şekilde sıfırlayın. Admin kullanıcılar, roller, Secret Access ve sistem ayarları bu işlemden hiçbir zaman etkilenmez."
      >
        <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
          <div className="grid gap-5">
            <section className="rounded-[18px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => switchMode("demo")}
                  className={`rounded-[12px] px-4 py-3 text-left text-sm font-black transition ${mode === "demo" ? "border-2 border-cyan-400 bg-cyan-50 text-cyan-900" : "border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] text-[var(--admin-text-secondary)]"}`}
                  style={{ minWidth: 220 }}
                >
                  Demo / Test Verilerini Temizle
                  <span className="mt-1 block text-xs font-semibold" style={{ color: mode === "demo" ? "#0e7490" : "var(--admin-text-muted)" }}>Yalnızca is_test = true müşteriler</span>
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("full")}
                  className={`rounded-[12px] px-4 py-3 text-left text-sm font-black transition ${mode === "full" ? "border-2 border-red-400 bg-red-50 text-red-900" : "border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] text-[var(--admin-text-secondary)]"}`}
                  style={{ minWidth: 220 }}
                >
                  <span className="inline-flex items-center gap-1.5"><ShieldAlert size={15} /> Tüm Müşteri Operasyon Verilerini Sıfırla</span>
                  <span className="mt-1 block text-xs font-semibold" style={{ color: mode === "full" ? "#B42318" : "var(--admin-text-muted)" }}>Gerçek müşteri verileri dahil — geri alınamaz</span>
                </button>
              </div>

              {mode === "full" && (
                <div className="mt-3 flex items-start gap-2 rounded-[12px] border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-900">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>Bu mod TÜM müşterileri hedefler (test olsun olmasın). Tahsilat, rapor, belge ve işlem logları korunur (firma bağlantısı kaldırılarak); görevler, entegrasyonlar, şubeler ve görüşmeler kalıcı olarak silinir. Devam etmeden önce yedek indirin.</span>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <AdminButton variant="secondary" icon={<Trash2 size={15} />} loading={loading === "preview"} onClick={runPreview}>Önizle (Dry Run)</AdminButton>
                <AdminButton variant="outline" icon={<Download size={15} />} loading={loading === "export"} onClick={downloadBackup}>Yedek İndir (JSON)</AdminButton>
              </div>
            </section>

            {error && <p className="rounded-[12px] border p-3 text-sm font-bold" style={{ borderColor: "var(--hk-danger-border)", background: "var(--hk-danger-bg)", color: "var(--hk-danger-text)" }}>{error}</p>}

            {preview && (
              <section className="rounded-[18px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-black text-[var(--admin-text-primary)]">Önizleme sonucu</h3>
                  <AdminStatusBadge tone={preview.companies > 0 ? "warning" : "neutral"}>{preview.companies} müşteri hedefleniyor</AdminStatusBadge>
                </div>
                {preview.companies === 0 ? (
                  <AdminEmptyState title="Silinecek kayıt bulunamadı" description={mode === "demo" ? "is_test = true olarak işaretli müşteri yok." : "Sistemde müşteri kaydı yok."} />
                ) : (
                  <>
                    <p className="mt-3 text-xs font-black uppercase tracking-wide text-[var(--admin-text-muted)]">Kalıcı olarak silinecek</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {Object.entries(preview.willDelete).map(([table, count]) => <TableCountRow key={table} table={table} count={count} />)}
                    </div>
                    <p className="mt-4 text-xs font-black uppercase tracking-wide text-[var(--admin-text-muted)]">Korunacak (firma bağlantısı kaldırılır)</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {Object.entries(preview.willPreserve).map(([table, count]) => <TableCountRow key={table} table={table} count={count} />)}
                    </div>
                  </>
                )}
              </section>
            )}

            {preview && preview.companies > 0 && (
              <section className="rounded-[18px] border border-red-200 bg-red-50 p-4">
                <h3 className="font-black text-red-900">Sıfırlamayı onayla</h3>
                <p className="mt-1 text-sm leading-6 text-red-900">
                  Devam etmek için aşağıya tam olarak <strong>{REQUIRED_PHRASE}</strong> yazın.
                </p>
                <input
                  value={confirmationText}
                  onChange={(event) => setConfirmationText(event.target.value)}
                  placeholder={REQUIRED_PHRASE}
                  className="mt-3 min-h-11 w-full rounded-[10px] border border-red-300 bg-white px-3 font-mono text-sm text-red-950 outline-none focus:ring-2 focus:ring-red-300"
                />
                {mode === "full" && (
                  <label className="mt-3 flex items-start gap-2 text-sm font-bold text-red-900">
                    <input type="checkbox" checked={fullAck} onChange={(event) => setFullAck(event.target.checked)} className="mt-0.5" />
                    Tüm müşteri verilerinin kalıcı olarak silineceğini ve bu işlemin geri alınamayacağını anlıyorum.
                  </label>
                )}
                <div className="mt-4">
                  <AdminButton variant="danger" icon={<Trash2 size={15} />} disabled={!canRequestReset} onClick={() => setSecondConfirmOpen(true)}>
                    {mode === "demo" ? "Demo/Test Verilerini Sıfırla" : "Tüm Müşteri Verilerini Sıfırla"}
                  </AdminButton>
                </div>
              </section>
            )}

            {result && (
              <section className="rounded-[18px] border border-emerald-200 bg-emerald-50 p-4">
                <h3 className="font-black text-emerald-900">Sıfırlama tamamlandı</h3>
                <p className="mt-1 text-sm text-emerald-900">{result.succeeded}/{result.total} müşteri başarıyla sıfırlandı.</p>
                <div className="mt-3 grid gap-1.5">
                  {result.results.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 rounded-[10px] bg-white px-3 py-2 text-sm">
                      <span className="font-bold text-[var(--admin-text-primary)]">{item.name}</span>
                      <AdminStatusBadge tone={item.ok ? "success" : "danger"}>{item.ok ? "Sıfırlandı" : item.error || "Hata"}</AdminStatusBadge>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="grid gap-3 self-start rounded-[18px] border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] p-4 text-sm leading-6 text-[var(--admin-text-secondary)]">
            <h4 className="font-black text-[var(--admin-text-primary)]">Bu ekran ne yapar</h4>
            <p>Önce her zaman <strong>Önizle</strong> ile gerçek kayıt sayılarını görün, sonra <strong>Yedek İndir</strong> ile JSON dışa aktarım alın. Sıfırlama yalnızca yazılı ve ikinci onaydan sonra çalışır.</p>
            <h4 className="mt-2 font-black text-[var(--admin-text-primary)]">Asla etkilenmez</h4>
            <p>Admin/ekip kullanıcıları, roller ve yetkiler, Secret Access anahtarları, API ayarları, global prompt ve paket tanımları, sistem ayarları ve bu işlemin kendi denetim kaydı.</p>
            <h4 className="mt-2 font-black text-[var(--admin-text-primary)]">Denetim</h4>
            <p>Her sıfırlama işlemi, hangi admin tarafından, hangi müşteriler için çalıştırıldığı bilgisiyle Log Merkezi&apos;ne kaydedilir.</p>
          </aside>
        </div>
      </AdminWorkspace>

      {secondConfirmOpen && (
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-[var(--admin-surface)]/80 p-4" onMouseDown={() => !loading && setSecondConfirmOpen(false)}>
          <div onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-md rounded-[20px] border p-6 text-center shadow-2xl" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-red-100 text-red-600"><AlertTriangle size={20} /></span>
            <h3 className="mt-4 text-xl font-black" style={{ color: "var(--admin-text-primary)" }}>Son onay</h3>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--admin-text-secondary)" }}>
              {mode === "demo"
                ? `${targetCount} demo/test müşterisinin operasyon verileri kalıcı olarak silinecek. Bu işlem geri alınamaz.`
                : `${targetCount} müşterinin operasyon verileri kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <AdminButton variant="secondary" disabled={loading === "execute"} onClick={() => setSecondConfirmOpen(false)}>Vazgeç</AdminButton>
              <AdminButton variant="danger" loading={loading === "execute"} onClick={executeReset}>Evet, Kalıcı Olarak Sil</AdminButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
