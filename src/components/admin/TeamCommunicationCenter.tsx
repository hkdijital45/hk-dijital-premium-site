"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, ClipboardList, FileText, FileUp, Info, Loader2, Pin, Plus, RefreshCw, Search, Send, Users, X } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminEmptyState, AdminLoadingState } from "@/components/admin/ui/AdminEmptyState";
import { AdminWorkspace } from "@/components/admin/workspace/AdminWorkspace";
import { AdminControlPanel, AdminFilterSection } from "@/components/admin/workspace/AdminControlPanel";
import { AdminDetailInspector } from "@/components/admin/workspace/AdminDetailInspector";
import { AdminActionBar } from "@/components/admin/workspace/AdminActionBar";
import { AdminCompactKpiStrip } from "@/components/admin/workspace/AdminCompactKpiStrip";

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
const statusOptions = [["active", "Aktif"], ["archived", "Arşivlendi"], ["closed", "Kapatıldı"], ["resolved", "Çözüldü"]];

function label(options: string[][], value: string) { return options.find(([key]) => key === value)?.[1] || value || "-"; }
function time(value?: string | null) { return value ? new Date(value).toLocaleString("tr-TR") : "-"; }
function key() { return crypto.randomUUID(); }
function size(value?: number) {
  if (!value) return "Boyut bilinmiyor";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

// Named Tailwind color classes (text-emerald-800 etc.) are paired with a
// matching text-[#hex] class — a global admin rule normally forces every
// <span>/.font-black element to one of two body-text colors with
// !important, discarding a badge's own semantic color entirely; the
// arbitrary-value class is that rule's documented escape hatch (see
// globals.css), and both classes resolve to the exact same shade so which
// one Tailwind's cascade actually applies makes no visual difference.
function TeamStatusBadge({ value }: { value: string }) {
  const tone = value === "resolved" || value === "closed" ? "border-emerald-200 bg-emerald-50 text-emerald-800 text-[#065F46]" : value === "archived" ? "border-[var(--admin-border)] bg-slate-100 text-[var(--admin-text-secondary)]" : "border-cyan-200 bg-cyan-50 text-cyan-800 text-[#155E75]";
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${tone}`}>{label(statusOptions, value)}</span>;
}
function TeamPriorityBadge({ value }: { value: string }) {
  const tone = value === "urgent" ? "border-rose-200 bg-rose-50 text-rose-800 text-[#9F1239]" : value === "important" ? "border-amber-200 bg-amber-50 text-amber-800 text-[#92400E]" : "border-[var(--admin-border)] bg-[var(--admin-surface-soft)] text-[var(--admin-text-secondary)]";
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${tone}`}>{label(priorityOptions, value)}</span>;
}

export function TeamCommunicationCenter({ initialConversationId = "", modeSwitch }: { initialConversationId?: string; modeSwitch?: ReactNode }) {
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

  const openCount = items.filter((item) => item.status === "active").length;
  const unreadCount = items.reduce((total, item) => total + (item.unread_count || 0), 0);
  const pinnedCount = detail?.pins.length || 0;

  function jumpToMessage(messageId: string) {
    document.getElementById(`team-message-${messageId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return <>
    <AdminWorkspace
      eyebrow="Communication Center"
      title="Ekip İletişimi"
      description="Ajans içi görüşmeler, duyurular ve müşteri operasyon notları."
      headerActions={<>
        {modeSwitch}
        <AdminButton compact variant="ai" icon={<Plus size={13} />} onClick={() => setCreateOpen(true)}>New Conversation (Yeni Konuşma)</AdminButton>
        <AdminButton compact variant="secondary" icon={<RefreshCw size={13} />} onClick={() => loadList()}>Refresh (Yenile)</AdminButton>
      </>}
      leftPanel={
        <AdminControlPanel>
          <AdminFilterSection title="Search (Ara)">
            <label className="relative block"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Conversations (Konuşmalarda Ara)" className="min-h-9 w-full rounded-[8px] border border-slate-300 pl-8 pr-3 text-xs" /></label>
          </AdminFilterSection>
          <AdminFilterSection title="Quick Filters (Hızlı Filtreler)">
            <div className="flex flex-wrap gap-1.5">
              <AdminButton compact variant={view === "mine" ? "info" : "secondary"} onClick={() => setView("mine")}>Mine (Bana Ait)</AdminButton>
              <AdminButton compact variant={view === "all" ? "info" : "secondary"} onClick={() => setView("all")}>All (Tümü)</AdminButton>
              <AdminButton compact variant={unreadOnly ? "info" : "secondary"} onClick={() => setUnreadOnly((current) => !current)}>Unread (Okunmamış)</AdminButton>
              <AdminButton compact variant={view === "archived" ? "info" : "secondary"} onClick={() => setView(view === "archived" ? "mine" : "archived")}>Archived (Arşivlenmiş)</AdminButton>
            </div>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="mt-2 min-h-9 w-full rounded-[8px] border border-slate-300 bg-[var(--admin-surface)] px-2 text-xs"><option value="">Type (Tür): Tümü</option>{typeOptions.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>
          </AdminFilterSection>
          <AdminFilterSection title={`Inbox (Gelen Kutusu) · ${items.length}`}>
            {!items.length && <AdminEmptyState title="Ekip konuşması yok" description="Yeni bir ekip görüşmesi başlatın." />}
            <div className="grid gap-1.5">
              {items.map((item) => (
                <button type="button" key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full rounded-[8px] border p-2 text-left transition ${selectedId === item.id ? "border-cyan-400 bg-cyan-50 ring-1 ring-cyan-200" : item.priority === "urgent" ? "border-rose-200 bg-rose-50" : "border-[var(--admin-border)] bg-[var(--admin-surface)]"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate text-xs font-black text-[var(--admin-text-primary)]">{item.title}</span>
                    {Boolean(item.unread_count) && <span className="shrink-0 rounded-full bg-cyan-600 px-1.5 py-0.5 text-[10px] font-black text-white">{item.unread_count}</span>}
                  </div>
                  <p className="mt-0.5 text-[10px] font-bold text-[var(--admin-text-muted)]">{label(typeOptions, item.conversation_type)} · {item.participant_count || 0} kişi · {time(item.last_message_at).split(" ")[0]}</p>
                  <p className="mt-1 truncate text-[10px] text-[var(--admin-text-muted)]">{item.latest_message || "Henüz mesaj yok."}</p>
                  <div className="mt-1 flex flex-wrap gap-1"><TeamStatusBadge value={item.status} /><TeamPriorityBadge value={item.priority} /></div>
                </button>
              ))}
            </div>
          </AdminFilterSection>
        </AdminControlPanel>
      }
      rightPanel={
        <AdminDetailInspector
          title={detail?.conversation.title}
          subtitle={detail ? `${label(typeOptions, detail.conversation.conversation_type)}${detail.conversation.company_name ? ` · ${detail.conversation.company_name}` : ""}` : undefined}
          emptyTitle="Bir ekip konuşması seçin"
          emptyDescription="Soldaki listeden bir konuşma seçtiğinizde bağlam paneli burada görünür."
        >
          {detail && <div className="grid gap-4">
            <section>
              <h4 className="mb-2 text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Conversation Details (Konuşma Bilgileri)</h4>
              <div className="flex flex-wrap gap-1.5"><TeamStatusBadge value={detail.conversation.status} /><TeamPriorityBadge value={detail.conversation.priority} /></div>
              {detail.conversation.source_customer_conversation_id && <a href={`/hk-admin/iletisim-merkezi?channel=customers&conversation=${detail.conversation.source_customer_conversation_id}`} className="mt-2 inline-flex min-h-9 items-center rounded-[8px] border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-800">Kaynak müşteri konuşması</a>}
            </section>

            <details open>
              <summary className="cursor-pointer text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Participants (Katılımcılar) · {participants.length}</summary>
              <div className="mt-2 grid gap-1.5">{participants.map((item) => <div key={item.user_id} className="admin-detail-inspector-field"><p style={{ fontWeight: 700 }}>{item.user_name}</p><p>{item.role}</p></div>)}</div>
            </details>

            <details open={pinnedCount > 0}>
              <summary className="cursor-pointer text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Pinned Messages (Sabitlenmiş Mesajlar) · {pinnedCount}</summary>
              <div className="mt-2 grid gap-1.5">
                {detail.pins.map((pin) => <button type="button" key={pin.message_id} onClick={() => jumpToMessage(pin.message_id)} className="w-full rounded-[8px] border border-amber-200 bg-amber-50 p-2 text-left text-[11px] font-bold text-amber-900">{pin.pinned_by_name} · {time(pin.pinned_at)}</button>)}
                {!pinnedCount && <p className="text-[11px]" style={{ color: "var(--admin-text-muted)" }}>Henüz sabitlenmiş mesaj yok.</p>}
              </div>
            </details>

            <section>
              <h4 className="mb-2 text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>History (Geçmiş)</h4>
              <AdminButton compact variant="secondary" icon={<Bell size={13} />} onClick={() => setHistoryOpen(true)}>Hareket Geçmişi</AdminButton>
            </section>
          </div>}
        </AdminDetailInspector>
      }
      bottomBar={
        <AdminActionBar statusText={`${openCount} aktif · ${unreadCount} okunmamış`}>
          <AdminButton compact variant="secondary" icon={<RefreshCw size={13} />} onClick={() => loadList()}>Refresh (Yenile)</AdminButton>
        </AdminActionBar>
      }
    >
      <AdminCompactKpiStrip items={[
        { key: "open", label: "Aktif konuşma", value: openCount, icon: <Users size={14} />, tone: "info" },
        { key: "unread", label: "Okunmamış", value: unreadCount, icon: <Bell size={14} />, tone: "danger" },
        { key: "pinned", label: "Sabitlenmiş", value: pinnedCount, icon: <Pin size={14} />, tone: "warning" },
        { key: "participants", label: "Katılımcı", value: participants.length, icon: <ClipboardList size={14} />, tone: "primary" }
      ]} />

      {message && <p className="mb-3 rounded-[8px] border border-cyan-200 bg-cyan-50 p-2.5 text-xs font-bold text-cyan-900">{message}</p>}
      {draftTarget && <section className="mb-3 rounded-[8px] border border-emerald-200 bg-emerald-50 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xs font-black text-emerald-950">Draft Reply (Yanıt Taslağı) hazır</h3>
            <p className="mt-1 whitespace-pre-wrap text-xs text-emerald-900">{draftTarget.draft}</p>
            <a href={`/hk-admin/iletisim-merkezi?channel=customers&conversation=${draftTarget.conversationId}`} className="mt-2 inline-flex min-h-8 items-center rounded-[8px] bg-emerald-600 px-3 text-xs font-black text-white">Müşteri konuşmasına git</a>
          </div>
          <button type="button" onClick={() => setDraftTarget(null)} aria-label="Kapat" className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--admin-surface)] text-emerald-700"><X size={14} /></button>
        </div>
      </section>}

      {busy === "detail" && <div className="grid min-h-72 place-items-center p-6"><AdminLoadingState label="Konuşma yükleniyor..." /></div>}
      {busy !== "detail" && !detail && <div className="grid min-h-72 place-items-center p-6"><AdminEmptyState title="Bir ekip konuşması seçin" description="Soldaki listeden bir konuşma seçtiğinizde mesajlar burada görünür." /></div>}
      {busy !== "detail" && detail && <div className="flex min-h-0 flex-col">
        <header className="border-b pb-3" style={{ borderColor: "var(--admin-border)" }}>
          <p className="text-[11px] font-black uppercase tracking-[.1em] text-cyan-700">{label(typeOptions, detail.conversation.conversation_type)}{detail.conversation.company_name ? ` · ${detail.conversation.company_name}` : ""}</p>
          <h2 className="mt-1 break-words text-base font-black" style={{ color: "var(--admin-text-primary)" }}>{detail.conversation.title}</h2>
          <p className="mt-1 text-xs font-semibold text-[var(--admin-text-secondary)]">{participants.map((item) => item.user_name).join(", ")}</p>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-3">
          {detail.messages.map((item) => {
            const own = item.sender_id === detail.participants.find((participant) => participant.role === "owner")?.user_id;
            const attachments = detail.attachments.filter((attachment) => attachment.message_id === item.id);
            const pinned = detail.pins.some((pin) => pin.message_id === item.id);
            const senderInitial = String(item.sender_name || "E").trim().slice(0, 1).toLocaleUpperCase("tr");
            return <article key={item.id} id={`team-message-${item.id}`} className={`flex items-start gap-2 ${own ? "flex-row-reverse" : ""}`}>
              <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-black text-white ${own ? "bg-gradient-to-br from-blue-500 to-indigo-600" : "bg-gradient-to-br from-violet-500 to-purple-600"}`}>{senderInitial}</span>
              <div className={`max-w-[88%] rounded-[10px] border p-3 sm:max-w-[78%] ${pinned ? "border-amber-300 bg-amber-50" : own ? "border-blue-200 bg-blue-50" : "border-[var(--admin-border)] bg-[var(--admin-surface)]"}`} style={{ color: "var(--admin-text-primary)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-xs font-black">{item.sender_name}{pinned && <Pin size={11} className="ml-1 inline text-amber-700" />}</p>
                    <time className="mt-0.5 block text-[10px] font-bold text-[var(--admin-text-secondary)]">{time(item.created_at)}</time>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => openAudit(item)} aria-label="Mesaj bilgilerini göster" title="Mesaj bilgilerini göster" className="inline-flex items-center gap-1 rounded-full border border-cyan-300 bg-cyan-50 px-2 py-1 text-[10px] font-black text-cyan-800"><Info size={11} /></button>
                    <button type="button" onClick={() => pinMessage(item.id)} aria-label={pinned ? "Sabitlemeyi kaldır" : "Sabitle (Pin)"} title={pinned ? "Sabitlemeyi kaldır" : "Sabitle (Pin)"} className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-800"><Pin size={11} /></button>
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5">{item.body}</p>
                {!!attachments.length && <div className="mt-2 grid gap-1.5">{attachments.map((attachment) => <a key={attachment.id} href={`/api/team-communication/attachments/${attachment.id}`} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1.5 text-[11px] font-bold text-[var(--admin-text-secondary)]"><span className="inline-flex min-w-0 items-center gap-1.5"><FileText size={12} className="shrink-0" /><span className="truncate">{attachment.original_name}</span></span><span className="shrink-0 text-[var(--admin-text-muted)]">{size(attachment.file_size)}</span></a>)}</div>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <AdminButton compact variant="ai" onClick={() => createTaskFromMessage(item)}>Create Task (Görev Oluştur)</AdminButton>
                  {detail.conversation.source_customer_conversation_id && <AdminButton compact variant="success" onClick={() => draftCustomerReply(item)}>Draft Reply (Yanıt Taslağı)</AdminButton>}
                </div>
              </div>
            </article>;
          })}
        </div>

        <footer className="border-t pt-3" style={{ borderColor: "var(--admin-border)" }}>
          {!!mentionCandidates.length && <div className="mb-2 flex flex-wrap gap-2">{mentionCandidates.map((item) => <button type="button" key={item.user_id} onClick={() => setReply((current) => current.replace(/@\S*$/, `@${item.user_name} `))} className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-800">@{item.user_name}</button>)}</div>}
          <textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={3} placeholder="Write a message. Use @ to mention a participant. (Mesaj yazın. Katılımcı etiketlemek için @ kullanın.)" className="w-full rounded-[8px] border border-slate-300 p-2 text-xs" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[8px] border border-slate-300 bg-[var(--admin-surface)] px-2.5 text-[11px] font-black text-[var(--admin-text-secondary)]"><FileUp size={13} />{file ? file.name : "Dosya ekle"}<input type="file" className="sr-only" accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
            <AdminButton compact variant="info" icon={<Send size={13} />} disabled={!reply.trim() || busy === "reply"} onClick={sendMessage}>{busy === "reply" ? "Gönderiliyor..." : "Gönder"}</AdminButton>
          </div>
        </footer>
      </div>}
    </AdminWorkspace>

    {createOpen && <CreateTeamConversationModal staff={staff} onClose={() => setCreateOpen(false)} onCreated={(id) => { setCreateOpen(false); setSelectedId(id); void loadList(); }} />}
    {auditMessage && <TeamAuditModal message={auditMessage} audit={audit} onClose={() => setAuditMessage(null)} />}
    {historyOpen && detail && <TeamHistoryModal detail={detail} onClose={() => setHistoryOpen(false)} />}
  </>;
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
  return <div className="fixed inset-0 z-[140] grid place-items-center bg-slate-950/45 p-3" role="dialog" aria-modal="true" onMouseDown={onClose}><div className="w-full max-w-2xl rounded-[18px] bg-[var(--admin-surface)] p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black text-[var(--admin-text-primary)]">Yeni ekip konuşması</h2><p className="text-sm text-[var(--admin-text-secondary)]">Birebir, grup veya duyuru görüşmesi oluşturun.</p></div><button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-[10px] border border-[var(--admin-border)]"><X size={17} /></button></div>{error && <p className="mt-3 rounded-[10px] bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<div className="mt-4 grid gap-3"><select value={conversationType} onChange={(event) => setConversationType(event.target.value)} className="min-h-11 rounded-[10px] border border-slate-300 bg-[var(--admin-surface)] px-3">{typeOptions.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Başlık" className="min-h-11 rounded-[10px] border border-slate-300 px-3" /><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} placeholder="İlk mesaj" className="rounded-[10px] border border-slate-300 p-3" /><select value={priority} onChange={(event) => setPriority(event.target.value)} className="min-h-11 rounded-[10px] border border-slate-300 bg-[var(--admin-surface)] px-3">{priorityOptions.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select><div className="max-h-48 overflow-y-auto rounded-[10px] border border-[var(--admin-border)] p-2">{staff.map((user) => <label key={user.id} className="flex items-center gap-2 rounded-[8px] p-2 text-sm font-bold text-[var(--admin-text-secondary)] hover:bg-[var(--admin-surface-soft)]"><input type="checkbox" checked={participantIds.includes(user.id)} onChange={(event) => setParticipantIds((current) => event.target.checked ? [...current, user.id] : current.filter((id) => id !== user.id))} />{user.full_name || user.email} · {user.role}</label>)}</div><button type="button" onClick={submit} disabled={busy || !message.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-cyan-600 px-5 text-sm font-black text-white disabled:bg-slate-200 disabled:text-[var(--admin-text-muted)]">{busy && <Loader2 size={16} className="animate-spin" />} Oluştur</button></div></div></div>;
}

function TeamAuditModal({ message, audit, onClose }: { message: Message; audit: Audit | null; onClose: () => void }) {
  return <div className="fixed inset-0 z-[140] grid place-items-center bg-slate-950/45 p-3" role="dialog" aria-modal="true" onMouseDown={onClose}><div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[18px] bg-[var(--admin-surface)] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><header className="flex items-start justify-between border-b border-[var(--admin-border)] p-5"><div><p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">Ekip audit</p><h2 className="text-xl font-black text-[var(--admin-text-primary)]">Mesaj Bilgileri</h2></div><button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-[10px] border border-[var(--admin-border)]"><X size={17} /></button></header><div className="max-h-[calc(90vh-90px)] overflow-y-auto p-5">{!audit && <p className="inline-flex items-center gap-2 text-sm font-bold text-[var(--admin-text-secondary)]"><Loader2 className="animate-spin" size={16} /> Audit yükleniyor...</p>}{audit && <div className="grid gap-4 md:grid-cols-2"><AuditBox title="Mesaj"><Line label="Gönderen" value={audit.message.sender_name || message.sender_name} /><Line label="Gönderim" value={time(audit.message.sent_at)} /><Line label="Dosya" value={String(audit.message.attachment_count)} /></AuditBox><AuditBox title="Kim gördü"><Line label="İlk gören" value={audit.reads.first_reader?.user_name || "Henüz görülmedi"} /><Line label="Toplam" value={String(audit.reads.total_readers)} />{audit.reads.readers.map((reader) => <p key={`${reader.user_name}-${reader.read_at}`} className="rounded-[10px] bg-[var(--admin-surface-soft)] p-2 text-xs font-bold text-[var(--admin-text-secondary)]">{reader.user_name} · {time(reader.read_at)}</p>)}</AuditBox><AuditBox title="Mention"><>{audit.mentions.map((item) => <p key={`${item.user_name}-${item.created_at}`} className="rounded-[10px] bg-cyan-50 p-2 text-xs font-bold text-cyan-900">@{item.user_name} · {time(item.created_at)}</p>)}{!audit.mentions.length && <p className="text-sm text-[var(--admin-text-muted)]">Mention yok.</p>}</></AuditBox><AuditBox title="Kim işlem yaptı"><>{audit.activity.map((item) => <p key={item.id} className="rounded-[10px] bg-[var(--admin-surface-soft)] p-2 text-xs font-bold text-[var(--admin-text-secondary)]">{item.actor_name || "Sistem"} · {item.activity_type} · {time(item.created_at)}</p>)}{!audit.activity.length && <p className="text-sm text-[var(--admin-text-muted)]">İşlem kaydı yok.</p>}</></AuditBox></div>}</div></div></div>;
}

function TeamHistoryModal({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  return <div className="fixed inset-0 z-[135] grid place-items-center bg-slate-950/45 p-3" role="dialog" aria-modal="true" onMouseDown={onClose}><div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[18px] bg-[var(--admin-surface)] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><header className="flex items-start justify-between border-b border-[var(--admin-border)] p-5"><div><h2 className="text-xl font-black text-[var(--admin-text-primary)]">Ekip Konuşması Geçmişi</h2><p className="text-sm text-[var(--admin-text-secondary)]">{detail.conversation.title}</p></div><button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-[10px] border border-[var(--admin-border)]"><X size={17} /></button></header><div className="max-h-[calc(90vh-90px)] overflow-y-auto p-5"><div className="grid gap-2">{detail.activity.map((item) => <p key={item.id} className="rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] p-3 text-sm font-semibold text-[var(--admin-text-secondary)]">{item.actor_name || "Sistem"} · {item.activity_type} · {time(item.created_at)}</p>)}{!detail.activity.length && <p className="rounded-[12px] border border-dashed border-slate-300 p-4 text-sm text-[var(--admin-text-muted)]">Hareket geçmişi yok.</p>}</div></div></div></div>;
}

function AuditBox({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-[16px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-sm"><h3 className="mb-3 font-black text-[var(--admin-text-primary)]">{title}</h3>{children}</section>;
}
function Line({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[90px_1fr] gap-3 border-t border-slate-100 py-2 text-sm first:border-t-0"><span className="font-bold text-[var(--admin-text-muted)]">{label}</span><span className="font-semibold text-[var(--admin-text-primary)]">{value}</span></div>;
}
