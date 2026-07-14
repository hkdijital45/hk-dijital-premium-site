"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ClipboardList, FileText, FileUp, Inbox, Loader2, MessageSquareText, RefreshCw, Search, Send, StickyNote, Trash2 } from "lucide-react";

type Summary = {
  id: string; subject: string; company_id: string; company_name: string; branch_name?: string | null;
  category: string; priority: string; status: string; assigned_to?: string | null; assigned_name?: string | null;
  latest_message: string; unread_count: number; last_message_at: string;
};

type Detail = {
  conversation: Summary;
  messages: Array<{ id: string; sender_type: "customer" | "staff"; sender_name: string; body: string; created_at: string }>;
  attachments: Array<{ id: string; message_id: string; original_name: string }>;
  internalNotes: Array<{ id: string; author_name: string; body: string; created_at: string }>;
};

type Staff = { id: string; full_name: string | null };
type Canned = { id: string; title: string; category: string; body: string };

const statusOptions = [["new", "Yeni"], ["admin_reply_required", "Admin yanıtı bekliyor"], ["customer_reply_required", "Müşteri yanıtı bekleniyor"], ["in_review", "İnceleniyor"], ["in_progress", "İşleme alındı"], ["resolved", "Çözüldü"], ["closed", "Kapatıldı"], ["archived", "Arşivlendi"]];
const priorityOptions = [["normal", "Normal"], ["important", "Önemli"], ["urgent", "Acil"]];
const categoryOptions = [["", "Tüm kategoriler"], ["general", "Genel"], ["package_upgrade", "Paket yükseltme"], ["advertising", "Reklam"], ["report_question", "Rapor sorusu"], ["content_revision", "İçerik revizyonu"], ["technical_support", "Teknik destek"], ["finance", "Finans"], ["billing", "Ödeme / fatura"], ["new_service", "Yeni hizmet"], ["account_access", "Hesap erişimi"], ["other", "Diğer"]];

function key() { return crypto.randomUUID(); }

export function CustomerCommunicationAdminCenter({ initialCompanyId = "", canManageTemplates = false }: { initialCompanyId?: string; canManageTemplates?: boolean }) {
  const [items, setItems] = useState<Summary[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [canned, setCanned] = useState<Canned[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const submitting = useRef(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (initialCompanyId) query.set("companyId", initialCompanyId);
    if (statusFilter) query.set("status", statusFilter);
    if (categoryFilter) query.set("category", categoryFilter);
    if (search) query.set("search", search);
    const response = await fetch(`/api/communication?${query}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setItems(payload.conversations || []);
      setStaff(payload.staff || []);
      if (!selectedId && payload.conversations?.[0]?.id) setSelectedId(payload.conversations[0].id);
    } else setMessage(payload.error || "Gelen kutusu yüklenemedi.");
    setLoading(false);
  }, [categoryFilter, initialCompanyId, search, selectedId, statusFilter]);

  const loadDetail = useCallback(async (id: string) => {
    if (!id) return setDetail(null);
    setBusy("detail");
    const response = await fetch(`/api/communication/${id}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setDetail(payload);
      await fetch(`/api/communication/${id}/read`, { method: "POST" });
      setItems((current) => current.map((item) => item.id === id ? { ...item, unread_count: 0 } : item));
    } else setMessage(payload.error || "Konuşma yüklenemedi.");
    setBusy("");
  }, []);

  // Fetches are synchronized with inbox filters and the selected conversation.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadList(); }, [loadList]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (selectedId) void loadDetail(selectedId); }, [selectedId, loadDetail]);
  useEffect(() => { fetch("/api/admin/communication/canned-responses", { cache: "no-store" }).then((response) => response.json()).then((payload) => setCanned(payload.responses || [])).catch(() => setCanned([])); }, []);

  async function sendReply() {
    if (!selectedId || !reply.trim() || submitting.current) return;
    submitting.current = true;
    setBusy("reply"); setMessage("");
    const response = await fetch(`/api/communication/${selectedId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: reply, idempotencyKey: key() }) });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      if (file) {
        const form = new FormData(); form.append("file", file); form.append("messageId", payload.messageId);
        const upload = await fetch(`/api/communication/${selectedId}/attachments`, { method: "POST", body: form });
        const uploadPayload = await upload.json().catch(() => ({}));
        if (!upload.ok) { setMessage(`Yanıt kaydedildi ancak dosya yüklenemedi: ${uploadPayload.error || "Dosya hatası"}`); setBusy(""); submitting.current = false; return; }
      }
      setReply(""); setFile(null); setMessage("Yanıt kaydedildi ve müşteriye bildirim oluşturuldu."); await Promise.all([loadDetail(selectedId), loadList()]);
    }
    else setMessage(payload.error || "Yanıt gönderilemedi.");
    setBusy(""); submitting.current = false;
  }

  async function updateConversation(patch: Record<string, unknown>, operation: string) {
    if (!selectedId || submitting.current) return;
    submitting.current = true; setBusy(operation); setMessage("");
    const response = await fetch(`/api/communication/${selectedId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) { setMessage("Konuşma güncellendi."); await Promise.all([loadDetail(selectedId), loadList()]); }
    else setMessage(payload.error || "Konuşma güncellenemedi.");
    setBusy(""); submitting.current = false;
  }

  async function addInternalNote() {
    if (!note.trim()) return;
    await updateConversation({ action: "internal_note", note }, "note");
    setNote("");
  }

  async function createTask() {
    if (!detail || submitting.current) return;
    submitting.current = true; setBusy("task");
    const response = await fetch("/api/admin/customer-operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resource: "task", item: { company_id: detail.conversation.company_id, title: `İletişim: ${detail.conversation.subject}`, description: `Müşteri İletişim Merkezi konuşması: ${detail.conversation.id}`, status: "Yapılacak", priority: detail.conversation.priority === "urgent" ? "Yüksek" : "Normal", visible_to_customer: false, metadata: { conversation_id: detail.conversation.id, source: "customer_communication" } } }) });
    const payload = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Konuşmadan görev oluşturuldu." : payload.error || "Görev oluşturulamadı.");
    setBusy(""); submitting.current = false;
  }

  async function refreshTemplates() {
    const response = await fetch("/api/admin/communication/canned-responses", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) setCanned(payload.responses || []);
  }

  async function createTemplate() {
    if (!templateTitle.trim() || !templateBody.trim()) return;
    setBusy("template");
    const response = await fetch("/api/admin/communication/canned-responses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: templateTitle, body: templateBody, category: detail?.conversation.category || "general" }) });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) { setTemplateTitle(""); setTemplateBody(""); setMessage("Hazır yanıt kaydedildi."); await refreshTemplates(); }
    else setMessage(payload.error || "Hazır yanıt kaydedilemedi.");
    setBusy("");
  }

  async function removeTemplate(id: string) {
    setBusy(`template-${id}`);
    const response = await fetch("/api/admin/communication/canned-responses", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) { setMessage("Hazır yanıt pasife alındı."); await refreshTemplates(); }
    else setMessage(payload.error || "Hazır yanıt pasife alınamadı.");
    setBusy("");
  }

  const openCount = items.filter((item) => !["resolved", "closed", "archived"].includes(item.status)).length;
  const unreadCount = items.reduce((total, item) => total + item.unread_count, 0);

  return <div className="min-w-0 space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi icon={<Inbox />} label="Açık konuşma" value={openCount} tone="cyan" />
      <Kpi icon={<MessageSquareText />} label="Okunmamış mesaj" value={unreadCount} tone="rose" />
      <Kpi icon={<CheckCircle2 />} label="Çözülen" value={items.filter((item) => item.status === "resolved").length} tone="emerald" />
      <Kpi icon={<ClipboardList />} label="Atanmamış" value={items.filter((item) => !item.assigned_to).length} tone="amber" />
    </div>
    <section className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
        <label className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Konu veya müşteri ara" className="min-h-11 w-full rounded-[10px] border border-slate-300 pl-10 pr-3 text-sm" /></label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-11 rounded-[10px] border border-slate-300 bg-white px-3 text-sm"><option value="">Tüm durumlar</option>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="min-h-11 rounded-[10px] border border-slate-300 bg-white px-3 text-sm">{categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <button type="button" onClick={() => loadList()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-cyan-600 px-4 text-sm font-black text-white"><RefreshCw size={17} /> Yenile</button>
      </div>
    </section>
    {message && <p className="rounded-[12px] border border-cyan-200 bg-cyan-50 p-3 text-sm font-bold text-cyan-900">{message}</p>}
    <section className="grid min-h-[640px] overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm xl:grid-cols-[340px_minmax(0,1fr)_300px]">
      <aside className="border-b border-slate-200 bg-slate-50 p-3 xl:border-b-0 xl:border-r">
        {loading && <p className="flex items-center gap-2 p-5 text-sm text-slate-500"><Loader2 className="animate-spin" /> Gelen kutusu yükleniyor...</p>}
        {!loading && !items.length && <div className="rounded-[14px] border border-dashed border-slate-300 bg-white p-5 text-center"><Inbox className="mx-auto text-cyan-500" /><p className="mt-3 font-black text-slate-950">Bu filtrelerde konuşma yok</p><p className="mt-2 text-sm text-slate-600">Yeni müşteri mesajları burada listelenecek.</p></div>}
        <div className="max-h-[720px] space-y-2 overflow-y-auto">{items.map((item) => <button type="button" key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full rounded-[12px] border p-3 text-left ${selectedId === item.id ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-white hover:border-cyan-200"}`}><div className="flex items-start justify-between gap-2"><span className="font-black text-slate-950">{item.company_name}</span>{item.unread_count > 0 && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-black text-white">{item.unread_count}</span>}</div><p className="mt-1 text-sm font-bold text-slate-800">{item.subject}</p><p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{item.latest_message}</p><div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500"><span>{statusOptions.find(([value]) => value === item.status)?.[1] || item.status}</span><span>·</span><time>{new Date(item.last_message_at).toLocaleDateString("tr-TR")}</time></div></button>)}</div>
      </aside>
      <main className="min-w-0 p-4 sm:p-5">
        {busy === "detail" && <div className="grid min-h-72 place-items-center text-sm text-slate-500"><Loader2 className="animate-spin" /> Konuşma yükleniyor...</div>}
        {busy !== "detail" && !detail && <div className="grid min-h-72 place-items-center text-slate-500">Bir konuşma seçin.</div>}
        {busy !== "detail" && detail && <><div className="border-b border-slate-200 pb-4"><p className="text-xs font-black uppercase tracking-[.12em] text-cyan-700">{detail.conversation.company_name}{detail.conversation.branch_name ? ` · ${detail.conversation.branch_name}` : ""}</p><h2 className="mt-2 text-xl font-black text-slate-950">{detail.conversation.subject}</h2></div><div className="max-h-[470px] space-y-3 overflow-y-auto py-5 pr-1">{detail.messages.map((item) => <article key={item.id} className={`max-w-[88%] rounded-[16px] p-4 ${item.sender_type === "staff" ? "ml-auto bg-cyan-600 text-white" : "bg-slate-100 text-slate-900"}`}><div className="flex justify-between gap-3 text-xs font-black"><span>{item.sender_type === "staff" ? "HK Dijital" : item.sender_name}</span><time className={item.sender_type === "staff" ? "text-cyan-100" : "text-slate-500"}>{new Date(item.created_at).toLocaleString("tr-TR")}</time></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.body}</p>{detail.attachments.filter((attachment) => attachment.message_id === item.id).map((attachment) => <a key={attachment.id} href={`/api/communication/attachments/${attachment.id}`} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-2 rounded-[8px] border border-current/20 p-2 text-xs font-bold"><FileText size={14} />{attachment.original_name}</a>)}</article>)}</div><div className="border-t border-slate-200 pt-4"><select onChange={(event) => { const selected = canned.find((item) => item.id === event.target.value); if (selected) setReply(selected.body); event.target.value = ""; }} defaultValue="" className="mb-3 min-h-10 w-full rounded-[10px] border border-slate-300 bg-white px-3 text-sm"><option value="">Hazır yanıt seçin</option>{canned.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={4} maxLength={12000} placeholder="Müşteriye yanıt yazın" className="w-full rounded-[12px] border border-slate-300 p-3 text-sm" /><div className="mt-3 flex flex-wrap items-center gap-3"><label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[9px] border border-slate-300 bg-white px-3 text-xs font-black text-slate-700"><FileUp size={15} />{file ? file.name : "Dosya ekle"}<input type="file" className="sr-only" accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label><button type="button" onClick={sendReply} disabled={!reply.trim() || busy === "reply"} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-cyan-600 px-5 text-sm font-black text-white disabled:opacity-50">{busy === "reply" ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />} {busy === "reply" ? "Gönderiliyor..." : "Yanıtla"}</button></div></div></>}
      </main>
      <aside className="border-t border-slate-200 bg-slate-50 p-4 xl:border-l xl:border-t-0">
        {detail && <div className="space-y-4"><div><label className="text-xs font-black uppercase text-slate-500">Durum</label><select value={detail.conversation.status} onChange={(event) => updateConversation({ status: event.target.value }, "status")} className="mt-2 min-h-10 w-full rounded-[10px] border border-slate-300 bg-white px-3 text-sm">{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div><label className="text-xs font-black uppercase text-slate-500">Öncelik</label><select value={detail.conversation.priority} onChange={(event) => updateConversation({ priority: event.target.value }, "priority")} className="mt-2 min-h-10 w-full rounded-[10px] border border-slate-300 bg-white px-3 text-sm">{priorityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div><label className="text-xs font-black uppercase text-slate-500">Atanan ekip üyesi</label><select disabled={!canManageTemplates} title={canManageTemplates ? "Konuşmayı ekip üyesine ata" : "Atama yetkisi admin veya yönetici rolü gerektirir"} value={detail.conversation.assigned_to || ""} onChange={(event) => updateConversation({ action: "assign", assignedTo: event.target.value || null }, "assign")} className="mt-2 min-h-10 w-full rounded-[10px] border border-slate-300 bg-white px-3 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"><option value="">Atanmamış</option>{staff.map((user) => <option key={user.id} value={user.id}>{user.full_name || "Ekip üyesi"}</option>)}</select></div><div className="rounded-[12px] border border-amber-200 bg-amber-50 p-3"><p className="flex items-center gap-2 text-sm font-black text-amber-900"><StickyNote size={16} /> İç not</p><p className="mt-1 text-xs text-amber-800">Müşteri bu alanı göremez.</p><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={8000} className="mt-3 w-full rounded-[10px] border border-amber-200 bg-white p-2 text-sm" placeholder="Ekip notu" /><button type="button" onClick={addInternalNote} disabled={!note.trim() || busy === "note"} className="mt-2 min-h-10 rounded-[9px] bg-amber-500 px-3 text-xs font-black text-white disabled:opacity-50">Notu kaydet</button><div className="mt-3 space-y-2">{detail.internalNotes.slice(0, 4).map((item) => <div key={item.id} className="rounded-[9px] bg-white p-2 text-xs text-slate-700"><strong>{item.author_name}</strong><p className="mt-1 whitespace-pre-wrap leading-5">{item.body}</p></div>)}</div></div><div className="grid gap-2"><button type="button" onClick={createTask} disabled={busy === "task"} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] bg-purple-600 px-3 text-xs font-black text-white disabled:opacity-50"><ClipboardList size={15} /> Görev oluştur</button><Link href={`/hk-admin/teklif-hazirlama?companyId=${detail.conversation.company_id}&conversation=${detail.conversation.id}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] border border-cyan-200 bg-white px-3 text-xs font-black text-cyan-700"><FileText size={15} /> Teklife bağla</Link><Link href={`/hk-admin/musteriler?companyId=${detail.conversation.company_id}&tab=communication`} className="inline-flex min-h-10 items-center justify-center rounded-[9px] border border-slate-200 bg-white px-3 text-xs font-black text-slate-700">Müşteri profilini aç</Link></div>{canManageTemplates && <details className="rounded-[12px] border border-violet-200 bg-violet-50 p-3"><summary className="cursor-pointer text-sm font-black text-violet-900">Hazır yanıtları yönet</summary><div className="mt-3 grid gap-2"><input value={templateTitle} onChange={(event) => setTemplateTitle(event.target.value)} placeholder="Şablon başlığı" className="min-h-10 rounded-[9px] border border-violet-200 bg-white px-3 text-sm" /><textarea value={templateBody} onChange={(event) => setTemplateBody(event.target.value)} rows={3} placeholder="Yanıt metni" className="rounded-[9px] border border-violet-200 bg-white p-2 text-sm" /><button type="button" onClick={createTemplate} disabled={busy === "template" || !templateTitle.trim() || !templateBody.trim()} className="min-h-10 rounded-[9px] bg-violet-600 px-3 text-xs font-black text-white disabled:opacity-50">Hazır yanıtı kaydet</button>{canned.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded-[9px] bg-white p-2 text-xs font-bold text-slate-700"><span>{item.title}</span><button type="button" onClick={() => removeTemplate(item.id)} aria-label={`${item.title} hazır yanıtını pasife al`} className="grid size-8 place-items-center rounded-full text-red-600 hover:bg-red-50"><Trash2 size={14} /></button></div>)}</div></details>}</div>}
      </aside>
    </section>
  </div>;
}

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  const classes = tone === "rose" ? "border-rose-200 bg-rose-50 text-rose-800" : tone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-cyan-200 bg-cyan-50 text-cyan-800";
  return <div className={`rounded-[16px] border p-4 ${classes}`}><div className="flex items-center justify-between gap-3"><span className="text-sm font-black">{label}</span>{icon}</div><p className="mt-3 text-3xl font-black">{value}</p></div>;
}
