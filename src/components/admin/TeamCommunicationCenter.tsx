"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, FileText, FileUp, Info, Loader2, Pin, Plus, RefreshCw, Search, Send, Users, X } from "lucide-react";

type Staff = { id: string; full_name: string | null; email: string; role: string };
type Conversation = {
  id: string;
  title: string;
  conversation_type: string;
  company_id?: string | null;
  company_name?: string | null;
  source_customer_conversation_id?: string | null;
  priority: string;
  status: string;
  participant_names?: string[];
  participant_count?: number;
  latest_message?: string;
  unread_count?: number;
  last_message_at: string;
};
type Message = { id: string; sender_id: string; sender_name: string; body: string; created_at: string; metadata?: { mention_ids?: string[] } };
type Participant = { user_id: string; user_name: string; role: string; left_at?: string | null };
type Attachment = { id: string; message_id: string; original_name: string; file_size?: number };
type PinItem = { message_id: string; pinned_by_name: string; pinned_at: string };
type Activity = { id: string; actor_name?: string; activity_type: string; detail?: Record<string, unknown>; created_at: string };
type Detail = { conversation: Conversation; messages: Message[]; participants: Participant[]; attachments: Attachment[]; pins: PinItem[]; activity: Activity[]; mentions: Array<{ message_id: string; user_name: string }> };
type Audit = {
  message: { sender_name: string; sent_at: string; attachment_count: number };
  reads: { first_reader: null | { user_name: string; read_at: string }; readers: Array<{ user_name: string; read_at: string }>; total_readers: number };
  mentions: Array<{ user_name: string; created_at: string }>;
  pins: Array<{ pinned_by_name: string; pinned_at: string; unpinned_at?: string | null }>;
  activity: Activity[];
};

const typeOptions = [
  ["direct", "Birebir"], ["group", "Grup"], ["customer_operation", "Müşteri Operasyonu"], ["project", "Proje"], ["task", "Görev"],
  ["advertising", "Reklam"], ["content", "İçerik"], ["finance", "Finans"], ["sales", "Satış"], ["technical", "Teknik"], ["announcement", "Duyuru"], ["general", "Genel"]
];
const priorityOptions = [["normal", "Normal"], ["important", "Önemli"], ["urgent", "Acil"]];

function label(options: string[][], value: string) { return options.find(([key]) => key === value)?.[1] || value || "-"; }
function time(value?: string | null) { return value ? new Date(value).toLocaleString("tr-TR") : "-"; }
function key() { return crypto.randomUUID(); }
function size(value?: number) {
  if (!value) return "Boyut bilinmiyor";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function TeamCommunicationCenter({ initialConversationId = "" }: { initialConversationId?: string }) {
  const [items, setItems] = useState<Conversation[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedId, setSelectedId] = useState(initialConversationId);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("mine");
  const [typeFilter, setTypeFilter] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [auditMessage, setAuditMessage] = useState<Message | null>(null);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [draftTarget, setDraftTarget] = useState<{ conversationId: string; draft: string } | null>(null);
  const submitting = useRef(false);
  const participants = useMemo(() => detail?.participants.filter((item) => !item.left_at) || [], [detail?.participants]);
  const mentionCandidates = useMemo(() => participants.filter((item) => reply.includes("@") && item.user_id !== detail?.messages.at(-1)?.sender_id), [participants, reply, detail?.messages]);

  const loadList = useCallback(async () => {
    const query = new URLSearchParams();
    query.set("view", view);
    if (typeFilter) query.set("type", typeFilter);
    if (search) query.set("search", search);
    if (unreadOnly) query.set("unread", "true");
    const response = await fetch(`/api/team-communication?${query}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setItems(payload.conversations || []);
      setStaff(payload.staff || []);
      if (!selectedId) setSelectedId(payload.conversations?.[0]?.id || "");
    } else setMessage(payload.error || "Ekip konuşmaları yüklenemedi.");
  }, [search, selectedId, typeFilter, unreadOnly, view]);

  const loadDetail = useCallback(async (id: string) => {
    if (!id) { setDetail(null); return; }
    setBusy("detail");
    const response = await fetch(`/api/team-communication/${id}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setDetail(payload);
      await fetch(`/api/team-communication/${id}/read`, { method: "POST" });
      setItems((current) => current.map((item) => item.id === id ? { ...item, unread_count: 0 } : item));
    } else {
      setDetail(null);
      setMessage(payload.error || "Ekip konuşması yüklenemedi.");
    }
    setBusy("");
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadList(); }, [loadList]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (selectedId) void loadDetail(selectedId); }, [selectedId, loadDetail]);

  async function sendMessage() {
    if (!detail || !reply.trim() || submitting.current) return;
    submitting.current = true;
    setBusy("reply");
    const mentionIds = participants.filter((participant) => reply.includes(`@${participant.user_name}`)).map((participant) => participant.user_id);
    const response = await fetch(`/api/team-communication/${detail.conversation.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: reply, mentionIds, idempotencyKey: key() })
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      if (file) {
        const form = new FormData();
        form.append("file", file);
        form.append("messageId", payload.messageId);
        const upload = await fetch(`/api/team-communication/${detail.conversation.id}/attachments`, { method: "POST", body: form });
        const uploadPayload = await upload.json().catch(() => ({}));
        if (!upload.ok) setMessage(`Mesaj kaydedildi ancak dosya yüklenemedi: ${uploadPayload.error || "Dosya hatası"}`);
      }
      setReply("");
      setFile(null);
      await Promise.all([loadList(), loadDetail(detail.conversation.id)]);
    } else setMessage(payload.error || "Mesaj gönderilemedi.");
    setBusy("");
    submitting.current = false;
  }

  async function openAudit(item: Message) {
    setAuditMessage(item);
    setAudit(null);
    const response = await fetch(`/api/team-communication/messages/${item.id}/audit`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) setAudit(payload);
    else setAudit({ message: { sender_name: item.sender_name, sent_at: item.created_at, attachment_count: 0 }, reads: { first_reader: null, readers: [], total_readers: 0 }, mentions: [], pins: [], activity: [{ id: "error", activity_type: payload.error || "Audit bilgisi yüklenemedi.", created_at: new Date().toISOString() }] });
  }

  async function pinMessage(messageId: string) {
    if (!detail) return;
    const response = await fetch(`/api/team-communication/${detail.conversation.id}/pins`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setMessage(payload.error || "Mesaj sabitlenemedi.");
    await loadDetail(detail.conversation.id);
  }

  async function createTaskFromMessage(item: Message) {
    const response = await fetch(`/api/team-communication/messages/${item.id}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create_task" }) });
    const payload = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Ekip mesajından görev oluşturuldu." : payload.error || "Görev oluşturulamadı.");
  }

  async function draftCustomerReply(item: Message) {
    const response = await fetch(`/api/team-communication/messages/${item.id}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "customer_reply_draft" }) });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) setDraftTarget({ conversationId: payload.customerConversationId, draft: payload.draft });
    else setMessage(payload.error || "Müşteri yanıt taslağı oluşturulamadı.");
  }

  return <div className="min-w-0 space-y-4">
    <section className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-black text-slate-950">Ekip İletişimi</h2><p className="text-sm font-semibold text-slate-600">Ajans içi görüşmeler, duyurular ve müşteri operasyon notları.</p></div>
        <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-[12px] bg-slate-900 px-4 text-sm font-black text-white"><Plus size={17} /> Yeni ekip konuşması</button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_170px_150px_130px_auto]">
        <label className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ekip konuşması ara" className="min-h-11 w-full rounded-[10px] border border-slate-300 pl-10 pr-3 text-sm" /></label>
        <select value={view} onChange={(event) => setView(event.target.value)} className="min-h-11 rounded-[10px] border border-slate-300 bg-white px-3 text-sm"><option value="mine">Bana ait</option><option value="all">Tümü</option><option value="archived">Arşiv</option></select>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="min-h-11 rounded-[10px] border border-slate-300 bg-white px-3 text-sm"><option value="">Tüm türler</option>{typeOptions.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>
        <button type="button" onClick={() => setUnreadOnly((current) => !current)} className={`min-h-11 rounded-[10px] px-3 text-xs font-black ${unreadOnly ? "bg-cyan-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>Okunmamış</button>
        <button type="button" onClick={() => loadList()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-cyan-600 px-4 text-sm font-black text-white"><RefreshCw size={17} /> Yenile</button>
      </div>
    </section>
    {message && <p className="rounded-[12px] border border-cyan-200 bg-cyan-50 p-3 text-sm font-bold text-cyan-900">{message}</p>}
    {draftTarget && <section className="rounded-[16px] border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-emerald-950">Müşteri yanıt taslağı hazır</h3><p className="mt-2 whitespace-pre-wrap text-sm text-emerald-900">{draftTarget.draft}</p><a href={`/hk-admin/iletisim-merkezi?channel=customers&conversation=${draftTarget.conversationId}`} className="mt-3 inline-flex min-h-10 items-center rounded-[10px] bg-emerald-600 px-4 text-sm font-black text-white">Müşteri konuşmasına git</a></div><button type="button" onClick={() => setDraftTarget(null)} className="grid size-9 place-items-center rounded-full bg-white text-emerald-700"><X size={16} /></button></div></section>}
    <section className="grid min-h-[680px] overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm xl:grid-cols-[340px_minmax(0,1fr)_340px]">
      <aside className="min-h-0 border-b border-slate-200 bg-slate-50/80 p-3 xl:border-b-0 xl:border-r">
        <div className="max-h-[720px] space-y-2 overflow-y-auto pr-1">{items.map((item) => <button type="button" key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full rounded-[14px] border p-3 text-left transition ${selectedId === item.id ? "border-cyan-300 bg-cyan-50" : item.priority === "urgent" ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white hover:border-cyan-200"}`}>
          <div className="flex items-start justify-between gap-2"><span className="min-w-0 truncate font-black text-slate-950">{item.title}</span>{Boolean(item.unread_count) && <span className="rounded-full bg-cyan-600 px-2 py-0.5 text-xs font-black text-white">{item.unread_count}</span>}</div>
          <p className="mt-1 text-xs font-bold text-slate-500">{label(typeOptions, item.conversation_type)} · {item.participant_count || 0} kişi</p>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{item.latest_message || "Henüz mesaj yok."}</p>
          <div className="mt-3 flex flex-wrap gap-1.5"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-700">{item.status}</span><span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-800">{label(priorityOptions, item.priority)}</span></div>
        </button>)}{!items.length && <div className="rounded-[14px] border border-dashed border-slate-300 bg-white p-5 text-center"><Users className="mx-auto text-cyan-500" /><p className="mt-3 font-black text-slate-950">Ekip konuşması yok</p><p className="mt-2 text-sm text-slate-600">Yeni bir ekip görüşmesi başlatın.</p></div>}</div>
      </aside>
      <main className="flex min-h-0 min-w-0 flex-col">
        {busy === "detail" && <div className="grid min-h-72 place-items-center"><Loader2 className="animate-spin text-cyan-600" /></div>}
        {busy !== "detail" && !detail && <div className="grid min-h-72 place-items-center text-slate-500">Bir ekip konuşması seçin.</div>}
        {busy !== "detail" && detail && <>
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-4 backdrop-blur"><p className="text-xs font-black uppercase tracking-[.12em] text-cyan-700">{label(typeOptions, detail.conversation.conversation_type)}{detail.conversation.company_name ? ` · ${detail.conversation.company_name}` : ""}</p><h2 className="mt-1 break-words text-xl font-black text-slate-950">{detail.conversation.title}</h2><p className="mt-2 text-xs font-semibold text-slate-600">{participants.map((item) => item.user_name).join(", ")}</p></header>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">{detail.messages.map((item) => {
            const own = item.sender_id === detail.participants.find((participant) => participant.role === "owner")?.user_id;
            const attachments = detail.attachments.filter((attachment) => attachment.message_id === item.id);
            const pinned = detail.pins.some((pin) => pin.message_id === item.id);
            return <article key={item.id} className={`rounded-[16px] border p-4 shadow-sm ${own ? "border-cyan-200 bg-cyan-50" : "border-slate-200 bg-white"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black text-slate-950">{item.sender_name}</p><p className="text-xs font-bold text-slate-600">{time(item.created_at)}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => openAudit(item)} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-cyan-300 bg-cyan-50 px-3 text-xs font-black text-cyan-800"><Info size={14} /> Bilgi</button><button type="button" onClick={() => pinMessage(item.id)} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 text-xs font-black text-amber-800"><Pin size={14} /> {pinned ? "Sabit" : "Sabitle"}</button></div></div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{item.body}</p>
              {!!attachments.length && <div className="mt-3 grid gap-2">{attachments.map((attachment) => <a key={attachment.id} href={`/api/team-communication/attachments/${attachment.id}`} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-[10px] border border-slate-200 bg-white p-2 text-xs font-bold text-slate-700"><span className="inline-flex min-w-0 items-center gap-2"><FileText size={14} /><span className="truncate">{attachment.original_name}</span></span><span>{size(attachment.file_size)}</span></a>)}</div>}
              <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => createTaskFromMessage(item)} className="min-h-9 rounded-[10px] bg-violet-700 px-3 text-xs font-black text-white">Görev oluştur</button>{detail.conversation.source_customer_conversation_id && <button type="button" onClick={() => draftCustomerReply(item)} className="min-h-9 rounded-[10px] bg-emerald-600 px-3 text-xs font-black text-white">Müşteriye yanıt taslağı</button>}</div>
            </article>;
          })}</div>
          <footer className="border-t border-slate-200 bg-white p-4">
            {!!mentionCandidates.length && <div className="mb-2 flex flex-wrap gap-2">{mentionCandidates.map((item) => <button type="button" key={item.user_id} onClick={() => setReply((current) => current.replace(/@\S*$/, `@${item.user_name} `))} className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-800">@{item.user_name}</button>)}</div>}
            <textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={4} placeholder="Ekip mesajı yazın. @ ile katılımcı etiketleyin." className="w-full rounded-[12px] border border-slate-300 p-3 text-sm" />
            <div className="mt-3 flex flex-wrap items-center gap-3"><label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border border-slate-300 bg-white px-3 text-xs font-black text-slate-700"><FileUp size={15} />{file ? file.name : "Dosya ekle"}<input type="file" className="sr-only" accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label><button type="button" onClick={sendMessage} disabled={!reply.trim() || busy === "reply"} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-cyan-600 px-5 text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-500">{busy === "reply" ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />} Gönder</button></div>
          </footer>
        </>}
      </main>
      <aside className="min-h-0 border-t border-slate-200 bg-slate-50/80 p-4 xl:border-l xl:border-t-0">
        {detail && <div className="sticky top-24 max-h-[calc(100vh-140px)] space-y-4 overflow-y-auto pr-1">
          <section className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm"><h3 className="font-black text-slate-950">Konuşma Bilgileri</h3><p className="mt-2 text-sm text-slate-700">Durum: <strong>{detail.conversation.status}</strong></p><p className="text-sm text-slate-700">Öncelik: <strong>{label(priorityOptions, detail.conversation.priority)}</strong></p>{detail.conversation.source_customer_conversation_id && <a href={`/hk-admin/iletisim-merkezi?channel=customers&conversation=${detail.conversation.source_customer_conversation_id}`} className="mt-3 inline-flex min-h-10 items-center rounded-[10px] bg-emerald-600 px-4 text-sm font-black text-white">Kaynak müşteri konuşması</a>}</section>
          <section className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm"><h3 className="font-black text-slate-950">Katılımcılar</h3><div className="mt-3 grid gap-2">{participants.map((item) => <p key={item.user_id} className="rounded-[10px] bg-slate-50 p-2 text-sm font-bold text-slate-700">{item.user_name} · {item.role}</p>)}</div></section>
          <section className="rounded-[18px] border border-amber-200 bg-amber-50 p-4 shadow-sm"><h3 className="font-black text-amber-950">Sabitlenmiş Mesajlar</h3><div className="mt-3 grid gap-2">{detail.pins.map((pin) => <p key={pin.message_id} className="rounded-[10px] bg-white p-2 text-xs font-bold text-amber-900">{pin.pinned_by_name} · {time(pin.pinned_at)}</p>)}{!detail.pins.length && <p className="text-sm text-amber-800">Henüz sabitlenmiş mesaj yok.</p>}</div></section>
          <section className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm"><h3 className="font-black text-slate-950">Geçmiş</h3><button type="button" onClick={() => setHistoryOpen(true)} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-slate-900 px-4 text-sm font-black text-white"><Bell size={16} /> Hareket geçmişi</button></section>
        </div>}
      </aside>
    </section>
    {createOpen && <CreateTeamConversationModal staff={staff} onClose={() => setCreateOpen(false)} onCreated={(id) => { setCreateOpen(false); setSelectedId(id); void loadList(); }} />}
    {auditMessage && <TeamAuditModal message={auditMessage} audit={audit} onClose={() => setAuditMessage(null)} />}
    {historyOpen && detail && <TeamHistoryModal detail={detail} onClose={() => setHistoryOpen(false)} />}
  </div>;
}

function CreateTeamConversationModal({ staff, onClose, onCreated }: { staff: Staff[]; onClose: () => void; onCreated: (id: string) => void }) {
  const [conversationType, setConversationType] = useState("group");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("normal");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/team-communication", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationType, title, message, priority, participantIds }) });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) onCreated(payload.conversationId);
    else setError(payload.error || "Ekip konuşması oluşturulamadı.");
    setBusy(false);
  }
  return <div className="fixed inset-0 z-[140] grid place-items-center bg-slate-950/45 p-3" role="dialog" aria-modal="true" onMouseDown={onClose}><div className="w-full max-w-2xl rounded-[18px] bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black text-slate-950">Yeni ekip konuşması</h2><p className="text-sm text-slate-600">Birebir, grup veya duyuru görüşmesi oluşturun.</p></div><button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-[10px] border border-slate-200"><X size={17} /></button></div>{error && <p className="mt-3 rounded-[10px] bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<div className="mt-4 grid gap-3"><select value={conversationType} onChange={(event) => setConversationType(event.target.value)} className="min-h-11 rounded-[10px] border border-slate-300 bg-white px-3">{typeOptions.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Başlık" className="min-h-11 rounded-[10px] border border-slate-300 px-3" /><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} placeholder="İlk mesaj" className="rounded-[10px] border border-slate-300 p-3" /><select value={priority} onChange={(event) => setPriority(event.target.value)} className="min-h-11 rounded-[10px] border border-slate-300 bg-white px-3">{priorityOptions.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select><div className="max-h-48 overflow-y-auto rounded-[10px] border border-slate-200 p-2">{staff.map((user) => <label key={user.id} className="flex items-center gap-2 rounded-[8px] p-2 text-sm font-bold text-slate-700 hover:bg-slate-50"><input type="checkbox" checked={participantIds.includes(user.id)} onChange={(event) => setParticipantIds((current) => event.target.checked ? [...current, user.id] : current.filter((id) => id !== user.id))} />{user.full_name || user.email} · {user.role}</label>)}</div><button type="button" onClick={submit} disabled={busy || !message.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-cyan-600 px-5 text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-500">{busy && <Loader2 size={16} className="animate-spin" />} Oluştur</button></div></div></div>;
}

function TeamAuditModal({ message, audit, onClose }: { message: Message; audit: Audit | null; onClose: () => void }) {
  return <div className="fixed inset-0 z-[140] grid place-items-center bg-slate-950/45 p-3" role="dialog" aria-modal="true" onMouseDown={onClose}><div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[18px] bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><header className="flex items-start justify-between border-b border-slate-200 p-5"><div><p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">Ekip audit</p><h2 className="text-xl font-black text-slate-950">Mesaj Bilgileri</h2></div><button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-[10px] border border-slate-200"><X size={17} /></button></header><div className="max-h-[calc(90vh-90px)] overflow-y-auto p-5">{!audit && <p className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"><Loader2 className="animate-spin" size={16} /> Audit yükleniyor...</p>}{audit && <div className="grid gap-4 md:grid-cols-2"><AuditBox title="Mesaj"><Line label="Gönderen" value={audit.message.sender_name || message.sender_name} /><Line label="Gönderim" value={time(audit.message.sent_at)} /><Line label="Dosya" value={String(audit.message.attachment_count)} /></AuditBox><AuditBox title="Kim gördü"><Line label="İlk gören" value={audit.reads.first_reader?.user_name || "Henüz görülmedi"} /><Line label="Toplam" value={String(audit.reads.total_readers)} />{audit.reads.readers.map((reader) => <p key={`${reader.user_name}-${reader.read_at}`} className="rounded-[10px] bg-slate-50 p-2 text-xs font-bold text-slate-700">{reader.user_name} · {time(reader.read_at)}</p>)}</AuditBox><AuditBox title="Mention"><>{audit.mentions.map((item) => <p key={`${item.user_name}-${item.created_at}`} className="rounded-[10px] bg-cyan-50 p-2 text-xs font-bold text-cyan-900">@{item.user_name} · {time(item.created_at)}</p>)}{!audit.mentions.length && <p className="text-sm text-slate-500">Mention yok.</p>}</></AuditBox><AuditBox title="Kim işlem yaptı"><>{audit.activity.map((item) => <p key={item.id} className="rounded-[10px] bg-slate-50 p-2 text-xs font-bold text-slate-700">{item.actor_name || "Sistem"} · {item.activity_type} · {time(item.created_at)}</p>)}{!audit.activity.length && <p className="text-sm text-slate-500">İşlem kaydı yok.</p>}</></AuditBox></div>}</div></div></div>;
}

function TeamHistoryModal({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  return <div className="fixed inset-0 z-[135] grid place-items-center bg-slate-950/45 p-3" role="dialog" aria-modal="true" onMouseDown={onClose}><div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[18px] bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><header className="flex items-start justify-between border-b border-slate-200 p-5"><div><h2 className="text-xl font-black text-slate-950">Ekip Konuşması Geçmişi</h2><p className="text-sm text-slate-600">{detail.conversation.title}</p></div><button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-[10px] border border-slate-200"><X size={17} /></button></header><div className="max-h-[calc(90vh-90px)] overflow-y-auto p-5"><div className="grid gap-2">{detail.activity.map((item) => <p key={item.id} className="rounded-[12px] border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">{item.actor_name || "Sistem"} · {item.activity_type} · {time(item.created_at)}</p>)}{!detail.activity.length && <p className="rounded-[12px] border border-dashed border-slate-300 p-4 text-sm text-slate-500">Hareket geçmişi yok.</p>}</div></div></div></div>;
}

function AuditBox({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-sm"><h3 className="mb-3 font-black text-slate-950">{title}</h3>{children}</section>;
}
function Line({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[90px_1fr] gap-3 border-t border-slate-100 py-2 text-sm first:border-t-0"><span className="font-bold text-slate-500">{label}</span><span className="font-semibold text-slate-900">{value}</span></div>;
}
