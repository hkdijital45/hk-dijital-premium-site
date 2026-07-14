"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, FileUp, Loader2, MessageCircle, Paperclip, Plus, Send, X } from "lucide-react";

type ConversationSummary = {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  latest_message: string;
  unread_count: number;
  last_message_at: string;
  branch_name?: string | null;
};

type ConversationDetail = {
  conversation: ConversationSummary;
  messages: Array<{ id: string; sender_type: "customer" | "staff"; sender_name: string; body: string; created_at: string }>;
  attachments: Array<{ id: string; message_id: string; original_name: string; file_size: number }>;
};

const categories = [
  ["general", "Genel"], ["package_upgrade", "Paket yükseltme"], ["advertising", "Reklam desteği"],
  ["report_question", "Rapor hakkında soru"], ["content_revision", "İçerik revizyonu"],
  ["technical_support", "Teknik destek"], ["finance", "Finans"], ["billing", "Ödeme / fatura"],
  ["new_service", "Yeni hizmet"], ["account_access", "Hesap erişimi"], ["other", "Diğer"]
];

const statusLabels: Record<string, string> = {
  new: "Yeni", admin_reply_required: "Admin yanıtı bekleniyor", customer_reply_required: "Yanıtınız bekleniyor",
  in_review: "İnceleniyor", in_progress: "İşleme alındı", resolved: "Çözüldü", closed: "Kapatıldı", archived: "Arşivlendi"
};

function requestKey() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export function CustomerCommunicationCenter({
  branchId,
  initialConversationId,
  initialCategory = "general",
  initialSubject = "",
  source = "customer_portal",
  relatedEntityType,
  relatedEntityId
}: {
  branchId?: string | null;
  initialConversationId?: string;
  initialCategory?: string;
  initialSubject?: string;
  source?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState(initialConversationId || "");
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [composerOpen, setComposerOpen] = useState(Boolean(initialSubject));
  const [subject, setSubject] = useState(initialSubject);
  const [category, setCategory] = useState(categories.some(([value]) => value === initialCategory) ? initialCategory : "general");
  const [priority, setPriority] = useState("normal");
  const [view, setView] = useState("open");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const requestInFlight = useRef(false);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/communication", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Konuşmalar yüklenemedi.");
      setConversations(payload.conversations || []);
      if (!selectedId && payload.conversations?.[0]?.id) setSelectedId(payload.conversations[0].id);
    } catch (error) {
      setFeedback({ tone: "error", text: error instanceof Error ? error.message : "Konuşmalar yüklenemedi." });
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadDetail = useCallback(async (id: string) => {
    if (!id) return setDetail(null);
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/communication/${id}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Konuşma yüklenemedi.");
      setDetail(payload);
      await fetch(`/api/communication/${id}/read`, { method: "POST" });
      setConversations((items) => items.map((item) => item.id === id ? { ...item, unread_count: 0 } : item));
    } catch (error) {
      setFeedback({ tone: "error", text: error instanceof Error ? error.message : "Konuşma yüklenemedi." });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Data loading is intentionally tied to the active portal session and selected thread.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadConversations(); }, [loadConversations]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (selectedId) void loadDetail(selectedId); }, [selectedId, loadDetail]);

  async function uploadAttachment(conversationId: string, messageId: string, selectedFile: File | null) {
    if (!selectedFile) return;
    const form = new FormData();
    form.append("file", selectedFile);
    form.append("messageId", messageId);
    const response = await fetch(`/api/communication/${conversationId}/attachments`, { method: "POST", body: form });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Dosya yüklenemedi.");
  }

  async function createConversation() {
    if (requestInFlight.current) return;
    if (subject.trim().length < 3 || !message.trim()) {
      return setFeedback({ tone: "error", text: "Konu ve mesaj alanlarını doldurun." });
    }
    requestInFlight.current = true;
    setBusy("create");
    setFeedback(null);
    try {
      const response = await fetch("/api/communication", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, category, priority, branchId, source, relatedEntityType, relatedEntityId, idempotencyKey: requestKey() })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Talep oluşturulamadı.");
      await uploadAttachment(payload.conversationId, payload.messageId, file);
      setComposerOpen(false);
      setSubject("");
      setMessage("");
      setFile(null);
      setSelectedId(payload.conversationId);
      setFeedback({ tone: "success", text: "Talebiniz kaydedildi. Yanıtlar bu konuşmada görünecek." });
      await loadConversations();
      await loadDetail(payload.conversationId);
    } catch (error) {
      setFeedback({ tone: "error", text: error instanceof Error ? error.message : "Talep oluşturulamadı." });
    } finally {
      requestInFlight.current = false;
      setBusy("");
    }
  }

  async function sendReply() {
    if (requestInFlight.current || !selectedId || !reply.trim()) return;
    requestInFlight.current = true;
    setBusy("reply");
    setFeedback(null);
    try {
      const response = await fetch(`/api/communication/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply, idempotencyKey: requestKey() })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Yanıt gönderilemedi.");
      await uploadAttachment(selectedId, payload.messageId, file);
      setReply("");
      setFile(null);
      await Promise.all([loadConversations(), loadDetail(selectedId)]);
    } catch (error) {
      setFeedback({ tone: "error", text: error instanceof Error ? error.message : "Yanıt gönderilemedi." });
    } finally {
      requestInFlight.current = false;
      setBusy("");
    }
  }

  async function archiveConversation() {
    if (!selectedId) return;
    setBusy("archive");
    const response = await fetch(`/api/communication/${selectedId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "customer_archive" }) });
    if (response.ok) {
      setSelectedId("");
      setDetail(null);
      await loadConversations();
    } else setFeedback({ tone: "error", text: "Konuşma arşivlenemedi." });
    setBusy("");
  }

  const selectedAttachments = useMemo(() => detail?.attachments || [], [detail]);
  const visibleConversations = conversations.filter((item) => view === "all" ? true : view === "resolved" ? ["resolved", "closed"].includes(item.status) : view === "waiting" ? item.status === "customer_reply_required" : !["resolved", "closed", "archived"].includes(item.status));

  return (
    <section className="overflow-hidden rounded-[20px] border border-cyan-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,.06)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-cyan-50 to-white p-5">
        <div><h2 className="flex items-center gap-2 text-xl font-black text-slate-950"><MessageCircle className="text-cyan-600" /> Destek ve İletişim</h2><p className="mt-1 text-sm text-slate-600">Taleplerinizi oluşturun, yanıtları ve ekleri tek konuşmada takip edin.</p></div>
        <button type="button" onClick={() => setComposerOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-[12px] bg-cyan-600 px-4 text-sm font-black text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"><Plus size={17} /> Yeni talep</button>
      </div>
      {feedback && <p className={`m-4 rounded-[12px] border p-3 text-sm font-bold ${feedback.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{feedback.text}</p>}
      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 px-4 py-3">{[["open", "Açık Talepler"], ["waiting", "Yanıt Bekleyenler"], ["resolved", "Çözülen Talepler"], ["all", "Tüm Konuşmalar"]].map(([value, label]) => <button type="button" key={value} onClick={() => setView(value)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black ${view === value ? "bg-cyan-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{label}</button>)}</div>
      <div className="grid min-h-[480px] lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-slate-50/70 p-3 lg:border-b-0 lg:border-r">
          {loading && <div className="grid place-items-center py-16 text-sm text-slate-500"><Loader2 className="mb-2 animate-spin" /> Konuşmalar yükleniyor...</div>}
          {!loading && !visibleConversations.length && <div className="rounded-[14px] border border-dashed border-slate-300 bg-white p-5 text-center"><MessageCircle className="mx-auto text-cyan-500" /><p className="mt-3 font-black text-slate-900">Bu görünümde talep yok</p><p className="mt-2 text-sm leading-6 text-slate-600">Yeni bir konu için talep oluşturabilir veya diğer görünümleri kontrol edebilirsiniz.</p></div>}
          <div className="grid gap-2">{visibleConversations.map((item) => <button type="button" key={item.id} onClick={() => setSelectedId(item.id)} className={`rounded-[12px] border p-3 text-left transition ${selectedId === item.id ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-white hover:border-cyan-200"}`}><div className="flex items-start justify-between gap-2"><span className="font-black text-slate-950">{item.subject}</span>{item.unread_count > 0 && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-black text-white">{item.unread_count}</span>}</div><p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{item.latest_message}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500"><span>{statusLabels[item.status] || item.status}</span><span>·</span><time>{new Date(item.last_message_at).toLocaleDateString("tr-TR")}</time></div></button>)}</div>
        </aside>
        <div className="min-w-0 p-4 sm:p-5">
          {detailLoading && <div className="grid min-h-72 place-items-center text-sm text-slate-500"><Loader2 className="mb-2 animate-spin" /> Konuşma yükleniyor...</div>}
          {!detailLoading && !detail && <div className="grid min-h-72 place-items-center text-center text-slate-500"><div><MessageCircle className="mx-auto mb-3" /><p className="font-bold">Görüntülemek için bir konuşma seçin.</p></div></div>}
          {!detailLoading && detail && <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4"><div><h3 className="text-lg font-black text-slate-950">{detail.conversation.subject}</h3><p className="mt-1 text-xs font-bold text-slate-500">{statusLabels[detail.conversation.status] || detail.conversation.status}</p></div><button type="button" onClick={archiveConversation} disabled={busy === "archive"} className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-slate-200 px-3 text-xs font-black text-slate-600 disabled:opacity-50"><Archive size={15} /> Arşivle</button></div>
            <div className="max-h-[460px] space-y-3 overflow-y-auto py-5 pr-1">{detail.messages.map((item) => <article key={item.id} className={`max-w-[88%] rounded-[16px] p-4 ${item.sender_type === "customer" ? "ml-auto bg-cyan-600 text-white" : "bg-slate-100 text-slate-900"}`}><div className="flex flex-wrap items-center justify-between gap-3 text-xs font-black"><span>{item.sender_type === "staff" ? "HK Dijital" : item.sender_name}</span><time className={item.sender_type === "customer" ? "text-cyan-100" : "text-slate-500"}>{new Date(item.created_at).toLocaleString("tr-TR")}</time></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.body}</p>{selectedAttachments.filter((attachment) => attachment.message_id === item.id).map((attachment) => <a key={attachment.id} href={`/api/communication/attachments/${attachment.id}`} target="_blank" rel="noreferrer" className={`mt-3 flex items-center gap-2 rounded-[10px] border p-2 text-xs font-bold ${item.sender_type === "customer" ? "border-white/30 bg-white/10" : "border-slate-200 bg-white"}`}><Paperclip size={14} /> {attachment.original_name}</a>)}</article>)}</div>
            {detail.conversation.status !== "closed" ? <div className="border-t border-slate-200 pt-4"><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={3} maxLength={12000} placeholder="Yanıtınızı yazın" className="w-full rounded-[12px] border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" /><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><FilePicker file={file} setFile={setFile} /><button type="button" onClick={sendReply} disabled={busy === "reply" || !reply.trim()} className="inline-flex min-h-11 items-center gap-2 rounded-[12px] bg-cyan-600 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{busy === "reply" ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />} {busy === "reply" ? "Gönderiliyor..." : "Yanıtla"}</button></div></div> : <p className="rounded-[12px] bg-slate-100 p-3 text-sm font-bold text-slate-600">Bu konuşma kapatıldı. Yeni bir konu için yeni talep oluşturun.</p>}
          </>}
        </div>
      </div>
      {composerOpen && <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="new-request-title"><div className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-[20px] bg-white p-5 shadow-2xl"><div className="flex items-center justify-between gap-3"><h3 id="new-request-title" className="text-xl font-black text-slate-950">Yeni destek talebi</h3><button type="button" onClick={() => setComposerOpen(false)} aria-label="Kapat" className="grid size-11 place-items-center rounded-full border border-slate-200"><X /></button></div><div className="mt-5 grid gap-4"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-black text-slate-700">Kategori<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 min-h-11 w-full rounded-[12px] border border-slate-300 bg-white px-3 font-medium">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-black text-slate-700">Öncelik<select value={priority} onChange={(event) => setPriority(event.target.value)} className="mt-2 min-h-11 w-full rounded-[12px] border border-slate-300 bg-white px-3 font-medium"><option value="normal">Normal</option><option value="important">Önemli</option><option value="urgent">Acil</option></select></label></div><label className="text-sm font-black text-slate-700">Konu<input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={160} className="mt-2 min-h-11 w-full rounded-[12px] border border-slate-300 px-3 font-medium" placeholder="Talebinizin kısa başlığı" /></label><label className="text-sm font-black text-slate-700">Mesaj<textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={12000} rows={6} className="mt-2 w-full rounded-[12px] border border-slate-300 p-3 font-medium" placeholder="İncelememiz gereken ayrıntıları yazın" /></label><FilePicker file={file} setFile={setFile} /><button type="button" onClick={createConversation} disabled={busy === "create" || subject.trim().length < 3 || !message.trim()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[12px] bg-cyan-600 px-5 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{busy === "create" ? <Loader2 className="animate-spin" /> : <Send />} {busy === "create" ? "Talep kaydediliyor..." : "Talebi Gönder"}</button></div></div></div>}
    </section>
  );
}

function FilePicker({ file, setFile }: { file: File | null; setFile: (file: File | null) => void }) {
  return <div className="flex min-w-0 flex-wrap items-center gap-2"><label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[10px] border border-slate-300 bg-white px-3 text-xs font-black text-slate-700"><FileUp size={15} /> Dosya ekle<input type="file" className="sr-only" accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>{file && <span className="flex min-w-0 items-center gap-1 text-xs font-bold text-slate-600"><span className="max-w-[220px] truncate">{file.name}</span><button type="button" onClick={() => setFile(null)} aria-label="Dosyayı kaldır" className="grid size-8 place-items-center rounded-full hover:bg-slate-100"><X size={14} /></button></span>}</div>;
}
