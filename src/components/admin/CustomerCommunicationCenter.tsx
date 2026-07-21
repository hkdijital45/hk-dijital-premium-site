"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ClipboardList,
  Clock3,
  FileText,
  FileUp,
  Inbox,
  Info,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
  Trash2,
  UserCheck,
  X
} from "lucide-react";
import { TeamCommunicationCenter } from "@/components/admin/TeamCommunicationCenter";
import { AdminEmptyState, AdminLoadingState } from "@/components/admin/ui/AdminEmptyState";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminWorkspace } from "@/components/admin/workspace/AdminWorkspace";
import { AdminControlPanel, AdminFilterSection } from "@/components/admin/workspace/AdminControlPanel";
import { AdminDetailInspector } from "@/components/admin/workspace/AdminDetailInspector";
import { AdminActionBar } from "@/components/admin/workspace/AdminActionBar";
import { AdminCompactKpiStrip } from "@/components/admin/workspace/AdminCompactKpiStrip";

type Summary = {
  id: string;
  subject: string;
  company_id: string;
  company_name: string;
  branch_name?: string | null;
  category: string;
  priority: string;
  status: string;
  assigned_to?: string | null;
  assigned_name?: string | null;
  latest_message: string;
  unread_count: number;
  message_count?: number;
  last_message_at: string;
  created_at?: string;
  updated_at?: string;
};

type MessageItem = {
  id: string;
  sender_id?: string | null;
  sender_type: "customer" | "staff";
  sender_name: string;
  body: string;
  created_at: string;
};

type AttachmentItem = {
  id: string;
  message_id: string;
  original_name: string;
  mime_type?: string;
  file_size?: number;
};

type ActivityItem = {
  id: string;
  actor_id?: string | null;
  actor_name?: string;
  activity_type: string;
  detail?: Record<string, unknown>;
  created_at: string;
};

type Detail = {
  conversation: Summary;
  messages: MessageItem[];
  attachments: AttachmentItem[];
  internalNotes: Array<{ id: string; author_name: string; body: string; created_at: string }>;
  activity: ActivityItem[];
  assignments?: Array<{ assigned_to_name: string; assigned_by_name: string; created_at: string }>;
};

type Staff = { id: string; full_name: string | null };
type Canned = { id: string; title: string; category: string; body: string };
type ManagementDraft = { status: string; priority: string; assigned_to: string };
type AuditPayload = {
  message: { sender_name: string; sender_type: string; sent_at: string; attachment_count: number };
  reads: { first_reader: null | { user_name: string; read_at: string }; readers: Array<{ user_name: string; read_at: string }>; total_staff_readers: number };
  replies: {
    first_reply: null | { user_name: string; sent_at: string; response_minutes: number | null };
    last_reply: null | { user_name: string; sent_at: string; response_minutes: number | null };
  };
  activity: ActivityItem[];
  assignments: Array<{ assigned_to_name: string; assigned_by_name: string; created_at: string }>;
};

const statusOptions = [["new", "Yeni"], ["admin_reply_required", "Admin Yanıtı Bekleniyor"], ["customer_reply_required", "Müşteri Yanıtı Bekleniyor"], ["in_review", "İnceleniyor"], ["in_progress", "İşleme Alındı"], ["resolved", "Çözüldü"], ["closed", "Kapatıldı"], ["archived", "Arşivlendi"]];
const priorityOptions = [["normal", "Normal"], ["important", "Önemli"], ["urgent", "Acil"]];
const categoryOptions = [["", "Tüm kategoriler"], ["general", "Genel"], ["package_upgrade", "Paket yükseltme"], ["advertising", "Reklam"], ["report_question", "Rapor sorusu"], ["content_revision", "İçerik revizyonu"], ["technical_support", "Teknik destek"], ["finance", "Finans"], ["billing", "Ödeme / fatura"], ["new_service", "Yeni hizmet"], ["account_access", "Hesap erişimi"], ["other", "Diğer"]];
const inboxViewOptions = [["all", "Tümü"], ["reply_required", "Yeni / Yanıt Bekleyen"], ["assigned_to_me", "Bana Atananlar"]];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function key() { return crypto.randomUUID(); }
function labelFor(options: string[][], value: string) { return options.find(([keyValue]) => keyValue === value)?.[1] || value || "-"; }
function formatDateTime(value?: string | null) { return value ? new Date(value).toLocaleString("tr-TR") : "-"; }
function formatFileSize(value?: number) {
  if (!value) return "Boyut bilinmiyor";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
function managementFrom(conversation?: Summary | null): ManagementDraft {
  return {
    status: conversation?.status || "new",
    priority: conversation?.priority || "normal",
    assigned_to: conversation?.assigned_to || ""
  };
}
function hasManagementChanges(detail: Detail | null, draft: ManagementDraft) {
  if (!detail) return false;
  const current = managementFrom(detail.conversation);
  return current.status !== draft.status || current.priority !== draft.priority || current.assigned_to !== draft.assigned_to;
}

function StatusBadge({ value }: { value: string }) {
  const tone = value === "admin_reply_required" || value === "new" ? "border-amber-200 bg-amber-50 text-amber-800" : value === "resolved" || value === "closed" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : value === "archived" ? "border-slate-200 bg-slate-100 text-slate-600" : "border-cyan-200 bg-cyan-50 text-cyan-800";
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${tone}`}>{labelFor(statusOptions, value)}</span>;
}

function PriorityBadge({ value }: { value: string }) {
  const tone = value === "urgent" ? "border-rose-200 bg-rose-50 text-rose-800" : value === "important" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600";
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${tone}`}>{labelFor(priorityOptions, value)}</span>;
}

export function CustomerCommunicationAdminCenter({ initialCompanyId = "", canManageTemplates = false }: { initialCompanyId?: string; canManageTemplates?: boolean }) {
  const [queryParams] = useState(() => {
    if (typeof window === "undefined") return { companyId: "", conversation: "", channel: "customers" };
    const params = new URLSearchParams(window.location.search);
    return {
      companyId: params.get("companyId") || "",
      conversation: params.get("conversation") || "",
      channel: params.get("channel") || "customers"
    };
  });
  const [activeChannel, setActiveChannel] = useState(queryParams.channel === "team" ? "team" : "customers");
  const queryCompanyId = queryParams.companyId;
  const rawConversationId = queryParams.conversation;
  const requestedConversationId = uuidPattern.test(rawConversationId) ? rawConversationId : "";
  const effectiveCompanyId = requestedConversationId ? "" : initialCompanyId || (uuidPattern.test(queryCompanyId) ? queryCompanyId : "");
  const initialMessage = rawConversationId && !requestedConversationId ? "Geçersiz konuşma bağlantısı. Gelen kutusu listesi gösteriliyor." : "";

  const [items, setItems] = useState<Summary[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [canned, setCanned] = useState<Canned[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [pendingSelection, setPendingSelection] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [managementDraft, setManagementDraft] = useState<ManagementDraft>(managementFrom(null));
  const [viewFilter, setViewFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [reply, setReply] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(initialMessage);
  const [auditMessage, setAuditMessage] = useState<MessageItem | null>(null);
  const [auditPayload, setAuditPayload] = useState<AuditPayload | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditCache, setAuditCache] = useState<Record<string, AuditPayload>>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [teamConversationId, setTeamConversationId] = useState(activeChannel === "team" ? requestedConversationId : "");
  const submitting = useRef(false);
  const hasChanges = hasManagementChanges(detail, managementDraft);
  const visibleItems = useMemo(() => unreadOnly ? items.filter((item) => item.unread_count > 0) : items, [items, unreadOnly]);

  const loadList = useCallback(async () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (effectiveCompanyId) query.set("companyId", effectiveCompanyId);
    if (viewFilter !== "all") query.set("view", viewFilter);
    if (statusFilter) query.set("status", statusFilter);
    if (priorityFilter) query.set("priority", priorityFilter);
    if (categoryFilter) query.set("category", categoryFilter);
    if (search) query.set("search", search);
    const response = await fetch(`/api/communication?${query}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      const conversations = payload.conversations || [];
      setItems(conversations);
      setStaff(payload.staff || []);
      if (requestedConversationId) setSelectedId(requestedConversationId);
      else if (!selectedId || !conversations.some((item: Summary) => item.id === selectedId)) setSelectedId(conversations[0]?.id || "");
    } else setMessage(payload.error || "Gelen kutusu yüklenemedi.");
    setLoading(false);
  }, [categoryFilter, effectiveCompanyId, priorityFilter, requestedConversationId, search, selectedId, statusFilter, viewFilter]);

  const loadDetail = useCallback(async (id: string) => {
    if (!id) {
      setDetail(null);
      setManagementDraft(managementFrom(null));
      return;
    }
    if (!uuidPattern.test(id)) {
      setDetail(null);
      setManagementDraft(managementFrom(null));
      setMessage("Geçersiz konuşma bağlantısı. Gelen kutusu listesi gösteriliyor.");
      return;
    }
    setBusy("detail");
    const response = await fetch(`/api/communication/${id}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setDetail(payload);
      setManagementDraft(managementFrom(payload.conversation));
      await fetch(`/api/communication/${id}/read`, { method: "POST" });
      setItems((current) => current.map((item) => item.id === id ? { ...item, unread_count: 0 } : item));
    } else {
      setDetail(null);
      setManagementDraft(managementFrom(null));
      setMessage(payload.error || "Konuşma yüklenemedi.");
    }
    setBusy("");
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadList(); }, [loadList]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (selectedId) void loadDetail(selectedId); }, [selectedId, loadDetail]);
  useEffect(() => { fetch("/api/admin/communication/canned-responses", { cache: "no-store" }).then((response) => response.json()).then((payload) => setCanned(payload.responses || [])).catch(() => setCanned([])); }, []);
  useEffect(() => {
    if (!hasChanges) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasChanges]);
  useEffect(() => {
    if (!auditMessage) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setAuditMessage(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [auditMessage]);

  async function saveManagement() {
    if (!detail || !hasChanges || submitting.current) return true;
    submitting.current = true;
    setBusy("management");
    setMessage("");
    const response = await fetch(`/api/communication/${detail.conversation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "manage_fields", status: managementDraft.status, priority: managementDraft.priority, assignedTo: managementDraft.assigned_to || null })
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setMessage(payload.unchanged ? "Değişiklik bulunmadı." : "Değişiklikler kaydedildi.");
      await Promise.all([loadDetail(detail.conversation.id), loadList()]);
      setBusy("");
      submitting.current = false;
      return true;
    }
    setMessage(payload.error || "Değişiklikler kaydedilemedi.");
    setBusy("");
    submitting.current = false;
    return false;
  }

  async function selectConversation(nextId: string) {
    if (nextId === selectedId) return;
    if (!hasChanges) {
      setSelectedId(nextId);
      return;
    }
    setPendingSelection(nextId);
  }

  async function saveAndContinue() {
    const nextId = pendingSelection;
    const ok = await saveManagement();
    if (ok) {
      setPendingSelection("");
      setSelectedId(nextId);
    }
  }

  async function sendReply() {
    if (!selectedId || !reply.trim() || submitting.current) return;
    submitting.current = true;
    setBusy("reply");
    setMessage("");
    const response = await fetch(`/api/communication/${selectedId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: reply, idempotencyKey: key() }) });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      if (file) {
        const form = new FormData(); form.append("file", file); form.append("messageId", payload.messageId);
        const upload = await fetch(`/api/communication/${selectedId}/attachments`, { method: "POST", body: form });
        const uploadPayload = await upload.json().catch(() => ({}));
        if (!upload.ok) {
          setMessage(`Yanıt kaydedildi ancak dosya yüklenemedi: ${uploadPayload.error || "Dosya hatası"}`);
          setBusy("");
          submitting.current = false;
          return;
        }
      }
      setReply("");
      setFile(null);
      setMessage("Yanıt kaydedildi ve müşteriye bildirim oluşturuldu.");
      await Promise.all([loadDetail(selectedId), loadList()]);
    } else setMessage(payload.error || "Yanıt gönderilemedi.");
    setBusy("");
    submitting.current = false;
  }

  async function updateConversation(patch: Record<string, unknown>, operation: string) {
    if (!selectedId || submitting.current) return false;
    submitting.current = true;
    setBusy(operation);
    setMessage("");
    const response = await fetch(`/api/communication/${selectedId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setMessage(operation === "note" ? "İç not kaydedildi." : "İşlem kaydedildi.");
      await Promise.all([loadDetail(selectedId), loadList()]);
      setBusy("");
      submitting.current = false;
      return true;
    }
    setMessage(payload.error || "İşlem kaydedilemedi.");
    setBusy("");
    submitting.current = false;
    return false;
  }

  async function addInternalNote() {
    if (!note.trim()) return;
    const ok = await updateConversation({ action: "internal_note", note }, "note");
    if (ok) setNote("");
  }

  async function createTask() {
    if (!detail || submitting.current) return;
    submitting.current = true;
    setBusy("task");
    setMessage("");
    const response = await fetch("/api/admin/customer-operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resource: "task", item: { company_id: detail.conversation.company_id, title: `İletişim: ${detail.conversation.subject}`, description: `Müşteri İletişim Merkezi konuşması: ${detail.conversation.id}`, status: "Yapılacak", priority: detail.conversation.priority === "urgent" ? "Yüksek" : "Normal", visible_to_customer: false, metadata: { conversation_id: detail.conversation.id, source: "customer_communication" } } }) });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setMessage("Konuşmadan görev oluşturuldu.");
      await fetch(`/api/communication/${detail.conversation.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "linked_action", actionType: "task_created", target: "agency_tasks", targetId: payload.item?.id || null }) }).catch(() => null);
      await loadDetail(detail.conversation.id);
    } else setMessage(payload.error || "Görev oluşturulamadı.");
    setBusy("");
    submitting.current = false;
  }

  async function openProposalFlow() {
    if (!detail) return;
    setBusy("proposal");
    await fetch(`/api/communication/${detail.conversation.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "linked_action", actionType: "proposal_flow_opened", target: "teklif-hazirlama" }) }).catch(() => null);
    window.location.assign(`/hk-admin/teklif-hazirlama?companyId=${detail.conversation.company_id}&conversation=${detail.conversation.id}`);
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

  async function openAudit(item: MessageItem, forceRefresh = false) {
    setAuditMessage(item);
    if (!forceRefresh && auditCache[item.id]) {
      setAuditPayload(auditCache[item.id]);
      return;
    }
    setAuditLoading(true);
    setAuditPayload(null);
    const response = await fetch(`/api/admin/communication/messages/${item.id}/audit`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setAuditPayload(payload);
      setAuditCache((current) => ({ ...current, [item.id]: payload }));
    } else setAuditPayload({
      message: { sender_name: item.sender_name, sender_type: item.sender_type, sent_at: item.created_at, attachment_count: 0 },
      reads: { first_reader: null, readers: [], total_staff_readers: 0 },
      replies: { first_reply: null, last_reply: null },
      activity: [{ id: "error", activity_type: payload.error || "Audit bilgisi yüklenemedi.", created_at: new Date().toISOString() }],
      assignments: []
    });
    setAuditLoading(false);
  }

  async function startTeamDiscussion() {
    if (!detail || submitting.current) return;
    const suggestedParticipants = detail.conversation.assigned_to ? [detail.conversation.assigned_to] : staff.slice(0, 3).map((user) => user.id);
    if (!suggestedParticipants.length) {
      setMessage("Ekip görüşmesi başlatmak için en az bir aktif ekip üyesi bulunmalıdır.");
      return;
    }
    submitting.current = true;
    setBusy("team-discussion");
    const response = await fetch("/api/team-communication", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationType: "customer_operation",
        title: `${detail.conversation.company_name} - ${detail.conversation.subject}`,
        message: `Müşteri konuşması için ekip değerlendirmesi başlatıldı.\n\nKonu: ${detail.conversation.subject}`,
        priority: detail.conversation.priority,
        participantIds: suggestedParticipants,
        companyId: detail.conversation.company_id,
        sourceCustomerConversationId: detail.conversation.id
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setTeamConversationId(payload.conversationId);
      setActiveChannel("team");
    } else setMessage(payload.error || "Ekip görüşmesi başlatılamadı.");
    setBusy("");
    submitting.current = false;
  }

  const openCount = items.filter((item) => !["resolved", "closed", "archived"].includes(item.status)).length;
  const unreadCount = items.reduce((total, item) => total + item.unread_count, 0);
  const selectedAttachments = detail?.attachments || [];

  if (activeChannel === "team") {
    return <div className="communication-center min-w-0 space-y-4">
      <CommunicationTabs active={activeChannel} onChange={setActiveChannel} customerUnread={unreadCount} />
      <TeamCommunicationCenter initialConversationId={teamConversationId || requestedConversationId} />
    </div>;
  }

  const urgentCount = items.filter((item) => item.priority === "urgent").length;
  const unassignedCount = items.filter((item) => !item.assigned_to).length;

  return (
    <>
    <AdminWorkspace
      eyebrow="Operasyon · İletişim"
      title="İletişim Merkezi"
      description="Müşteri talepleri, ekip yanıtları, atamalar ve iletişim geçmişi."
      headerActions={<>
        <AdminButton compact variant="info">Müşteri İletişimi{unreadCount > 0 ? ` (${unreadCount})` : ""}</AdminButton>
        <AdminButton compact variant="secondary" onClick={() => setActiveChannel("team")}>Ekip İletişimi</AdminButton>
        <AdminButton compact variant="secondary" onClick={() => loadList()}>Yenile</AdminButton>
      </>}
      leftPanel={
        <AdminControlPanel>
          <AdminFilterSection title="Görünüm">
            <div className="flex flex-wrap gap-1.5">
              {inboxViewOptions.map(([value, label]) => <AdminButton key={value} compact variant={viewFilter === value ? "info" : "secondary"} onClick={() => setViewFilter(value)}>{label}</AdminButton>)}
            </div>
          </AdminFilterSection>
          <AdminFilterSection title="Filtreler">
            <div className="grid gap-2">
              <label className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Konu veya müşteri ara" className="min-h-9 w-full rounded-[8px] border border-slate-300 pl-8 pr-3 text-xs" /></label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-9 rounded-[8px] border border-slate-300 bg-white px-2 text-xs"><option value="">Tüm durumlar</option>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <select value={priorityFilter === "urgent" ? "" : priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="min-h-9 rounded-[8px] border border-slate-300 bg-white px-2 text-xs"><option value="">Tüm öncelikler</option>{priorityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="min-h-9 rounded-[8px] border border-slate-300 bg-white px-2 text-xs">{categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <AdminButton compact variant={priorityFilter === "urgent" ? "danger" : "secondary"} onClick={() => setPriorityFilter(priorityFilter === "urgent" ? "" : "urgent")}>Sadece Acil</AdminButton>
              <AdminButton compact variant={unreadOnly ? "info" : "secondary"} onClick={() => setUnreadOnly((current) => !current)}>Sadece Okunmamış</AdminButton>
            </div>
          </AdminFilterSection>
          <AdminFilterSection title={`Gelen Kutusu · ${visibleItems.length}`}>
            {loading && <div className="py-3"><AdminLoadingState label="Yükleniyor..." /></div>}
            {!loading && !visibleItems.length && <AdminEmptyState title="Bu filtrelerde konuşma yok" description="Yeni müşteri mesajları burada listelenecek." />}
            <div className="grid gap-1.5">
              {visibleItems.map((item) => (
                <button type="button" key={item.id} onClick={() => selectConversation(item.id)} className={`w-full rounded-[8px] border p-2 text-left transition ${selectedId === item.id ? "border-cyan-400 bg-cyan-50 ring-1 ring-cyan-200" : item.priority === "urgent" ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate text-xs font-black text-slate-950">{item.company_name}</span>
                    {item.unread_count > 0 && <span className="shrink-0 rounded-full bg-cyan-600 px-1.5 py-0.5 text-[10px] font-black text-white">{item.unread_count}</span>}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] font-bold text-slate-700">{item.subject}</p>
                  <div className="mt-1 flex flex-wrap gap-1"><StatusBadge value={item.status} /><PriorityBadge value={item.priority} /></div>
                </button>
              ))}
            </div>
          </AdminFilterSection>
        </AdminControlPanel>
      }
      rightPanel={
        <AdminDetailInspector
          title={detail ? detail.conversation.company_name : undefined}
          subtitle={detail ? `${detail.conversation.subject} · Atanan: ${detail.conversation.assigned_name || "Atanmamış"}` : undefined}
          emptyTitle="Bir konuşma seçin"
          emptyDescription="Soldaki listeden bir konuşma seçtiğinizde yönetim paneli burada görünür."
        >
          {detail && <div className="grid gap-4">
            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Konuşma Yönetimi</h4>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${hasChanges ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{hasChanges ? "Kaydedilmemiş" : "Güncel"}</span>
              </div>
              <div className="grid gap-2">
                <label className="grid gap-1 text-[10px] font-black uppercase text-slate-500">Durum<select value={managementDraft.status} onChange={(event) => setManagementDraft((current) => ({ ...current, status: event.target.value }))} className="min-h-9 rounded-[8px] border border-slate-300 bg-white px-2 text-xs font-semibold normal-case text-slate-900">{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="grid gap-1 text-[10px] font-black uppercase text-slate-500">Öncelik<select value={managementDraft.priority} onChange={(event) => setManagementDraft((current) => ({ ...current, priority: event.target.value }))} className="min-h-9 rounded-[8px] border border-slate-300 bg-white px-2 text-xs font-semibold normal-case text-slate-900">{priorityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="grid gap-1 text-[10px] font-black uppercase text-slate-500">Atanan<select disabled={!canManageTemplates} value={managementDraft.assigned_to} onChange={(event) => setManagementDraft((current) => ({ ...current, assigned_to: event.target.value }))} className="min-h-9 rounded-[8px] border border-slate-300 bg-white px-2 text-xs font-semibold normal-case text-slate-900 disabled:bg-slate-100"><option value="">Atanmamış</option>{staff.map((user) => <option key={user.id} value={user.id}>{user.full_name || "Ekip üyesi"}</option>)}</select></label>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <AdminButton compact variant="success" disabled={!hasChanges || busy === "management"} onClick={saveManagement}>{busy === "management" ? "Kaydediliyor..." : "Kaydet"}</AdminButton>
                <AdminButton compact variant="secondary" disabled={!hasChanges || busy === "management"} onClick={() => detail && setManagementDraft(managementFrom(detail.conversation))}>Vazgeç</AdminButton>
              </div>
            </section>

            <section>
              <h4 className="mb-2 text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>İç Notlar</h4>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={8000} className="w-full rounded-[8px] border border-amber-200 bg-white p-2 text-xs" placeholder="Ekip notu" />
              <AdminButton compact variant="warning" disabled={!note.trim() || busy === "note"} onClick={addInternalNote}>Notu Kaydet</AdminButton>
              <div className="mt-2 grid gap-1.5">{detail.internalNotes.slice(0, 5).map((item) => <div key={item.id} className="admin-detail-inspector-field"><p>{item.author_name} · {formatDateTime(item.created_at)}</p><p style={{ fontWeight: 500 }}>{item.body}</p></div>)}{!detail.internalNotes.length && <p className="text-[11px]" style={{ color: "var(--admin-text-muted)" }}>Henüz iç not yok.</p>}</div>
            </section>

            <section>
              <h4 className="mb-2 text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Bağlantılı İşlemler</h4>
              <div className="grid gap-1.5">
                <AdminButton compact variant="ai" disabled={busy === "task"} onClick={createTask}>{busy === "task" ? "Oluşturuluyor..." : "Görev Oluştur"}</AdminButton>
                <AdminButton compact variant="info" disabled={busy === "proposal"} onClick={openProposalFlow}>Teklife Bağla</AdminButton>
                <AdminButton compact variant="secondary" disabled={busy === "team-discussion"} onClick={startTeamDiscussion}>Ekipte Görüş</AdminButton>
                <Link href={`/hk-admin/musteriler?companyId=${detail.conversation.company_id}&tab=communication`} className="hk-button hk-button-neutral hk-button-compact justify-center">Müşteri Profilini Aç</Link>
                <AdminButton compact variant="secondary" onClick={() => setHistoryOpen(true)}>İşlem Geçmişini Göster</AdminButton>
              </div>
            </section>

            {canManageTemplates && <details>
              <summary className="cursor-pointer text-xs font-black text-violet-900">Hazır yanıtları yönet</summary>
              <div className="mt-2 grid gap-1.5">
                <input value={templateTitle} onChange={(event) => setTemplateTitle(event.target.value)} placeholder="Şablon başlığı" className="min-h-9 rounded-[8px] border border-violet-200 bg-white px-2 text-xs" />
                <textarea value={templateBody} onChange={(event) => setTemplateBody(event.target.value)} rows={2} placeholder="Yanıt metni" className="rounded-[8px] border border-violet-200 bg-white p-2 text-xs" />
                <AdminButton compact variant="ai" disabled={busy === "template" || !templateTitle.trim() || !templateBody.trim()} onClick={createTemplate}>Hazır Yanıtı Kaydet</AdminButton>
                {canned.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded-[8px] bg-white p-2 text-[11px] font-bold text-slate-700"><span>{item.title}</span><button type="button" onClick={() => removeTemplate(item.id)} aria-label={`${item.title} hazır yanıtını pasife al`} className="grid size-7 place-items-center rounded-full text-red-600"><Trash2 size={12} /></button></div>)}
              </div>
            </details>}
          </div>}
        </AdminDetailInspector>
      }
      bottomBar={
        <AdminActionBar statusText={`${openCount} açık · ${unreadCount} okunmamış${urgentCount ? ` · ${urgentCount} acil` : ""} · ${unassignedCount} atanmamış`}>
          <AdminButton compact variant="secondary" onClick={() => loadList()}>Yenile</AdminButton>
        </AdminActionBar>
      }
    >
      <AdminCompactKpiStrip items={[
        { key: "open", label: "Açık konuşma", value: openCount, icon: <Inbox size={14} />, tone: "info" },
        { key: "unread", label: "Okunmamış", value: unreadCount, icon: <MessageSquareText size={14} />, tone: "danger" },
        { key: "urgent", label: "Acil", value: urgentCount, icon: <AlertCircle size={14} />, tone: "danger" },
        { key: "unassigned", label: "Atanmamış", value: unassignedCount, icon: <ClipboardList size={14} />, tone: "warning" }
      ]} />

      {message && <p className="mb-3 rounded-[8px] border border-cyan-200 bg-cyan-50 p-2.5 text-xs font-bold text-cyan-900">{message}</p>}

      {busy === "detail" && <div className="grid min-h-72 place-items-center p-6"><AdminLoadingState label="Konuşma yükleniyor..." /></div>}
      {busy !== "detail" && !detail && <div className="grid min-h-72 place-items-center p-6"><AdminEmptyState title="Bir konuşma seçin" description="Soldaki listeden bir konuşma seçtiğinizde mesajlar burada görünür." /></div>}
      {busy !== "detail" && detail && <div className="flex min-h-0 flex-col">
        <header className="border-b pb-3" style={{ borderColor: "var(--admin-border)" }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[.1em] text-cyan-700">{detail.conversation.company_name}{detail.conversation.branch_name ? ` · ${detail.conversation.branch_name}` : ""}</p>
              <h2 className="mt-1 break-words text-base font-black" style={{ color: "var(--admin-text-primary)" }}>{detail.conversation.subject}</h2>
              <div className="mt-2 flex flex-wrap gap-1.5"><StatusBadge value={detail.conversation.status} /><PriorityBadge value={detail.conversation.priority} /><span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black text-slate-600">{labelFor(categoryOptions, detail.conversation.category)}</span></div>
            </div>
            <AdminButton compact variant="secondary" onClick={() => loadDetail(detail.conversation.id)}>Yenile</AdminButton>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-3">
          {!detail.messages.length && <AdminEmptyState title="Henüz mesaj yok" description="Bu konuşmada henüz mesaj gönderilmemiş." />}
          {detail.messages.map((item) => {
            const isStaff = item.sender_type === "staff";
            const attachments = selectedAttachments.filter((attachment) => attachment.message_id === item.id);
            const senderInitial = String((isStaff ? item.sender_name || "HK" : item.sender_name || "M")).trim().slice(0, 1).toLocaleUpperCase("tr");
            return <article key={item.id} className={`flex items-start gap-2 ${isStaff ? "flex-row-reverse" : ""}`}>
              <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-black text-white ${isStaff ? "bg-gradient-to-br from-blue-500 to-indigo-600" : "bg-gradient-to-br from-cyan-400 to-teal-600"}`}>{senderInitial}</span>
              <div className={`max-w-[88%] rounded-[10px] border p-3 sm:max-w-[78%] ${isStaff ? "border-blue-200 bg-blue-50 text-slate-900" : "border-cyan-200 bg-cyan-50/60 text-slate-900"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-xs font-black">{isStaff ? item.sender_name || "HK Dijital" : item.sender_name || "Müşteri"}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-600">
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${isStaff ? "bg-blue-100 text-blue-800" : "bg-cyan-100 text-cyan-800"}`}>{isStaff ? "Ekip" : "Müşteri"}</span>
                      <time>{formatDateTime(item.created_at)}</time>
                    </p>
                  </div>
                  <button type="button" onClick={() => openAudit(item)} aria-label="Mesaj bilgilerini göster" title="Mesaj bilgilerini göster" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-cyan-300 bg-cyan-50 px-2 py-1 text-[10px] font-black text-cyan-800">
                    <Info size={12} />
                  </button>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5">{item.body}</p>
                {!!attachments.length && <div className="mt-2 grid gap-1.5">{attachments.map((attachment) => <a key={attachment.id} href={`/api/communication/attachments/${attachment.id}`} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-[8px] border border-slate-200 bg-white p-1.5 text-[11px] font-bold text-slate-700"><span className="inline-flex min-w-0 items-center gap-1.5"><FileText size={12} className="shrink-0" /><span className="truncate">{attachment.original_name}</span></span><span className="shrink-0 text-slate-500">{formatFileSize(attachment.file_size)}</span></a>)}</div>}
              </div>
            </article>;
          })}
        </div>

        <footer className="border-t pt-3" style={{ borderColor: "var(--admin-border)" }}>
          <select onChange={(event) => { const selected = canned.find((item) => item.id === event.target.value); if (selected) setReply(selected.body); event.target.value = ""; }} defaultValue="" className="mb-2 min-h-9 w-full rounded-[8px] border border-slate-300 bg-white px-2 text-xs"><option value="">Hazır yanıt seçin</option>{canned.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
          <textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={3} maxLength={12000} placeholder="Müşteriye yanıt yazın" className="w-full rounded-[8px] border border-slate-300 p-2 text-xs" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[8px] border border-slate-300 bg-white px-2.5 text-[11px] font-black text-slate-700"><FileUp size={13} />{file ? file.name : "Dosya ekle"}<input type="file" className="sr-only" accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
            <AdminButton compact variant="info" disabled={!reply.trim() || busy === "reply"} onClick={sendReply}>{busy === "reply" ? "Gönderiliyor..." : "Yanıtla"}</AdminButton>
          </div>
        </footer>
      </div>}
    </AdminWorkspace>

    {pendingSelection && <UnsavedChangesDialog onCancel={() => setPendingSelection("")} onDiscard={() => { setPendingSelection(""); setManagementDraft(managementFrom(detail?.conversation)); setSelectedId(pendingSelection); }} onSave={saveAndContinue} saving={busy === "management"} />}
    {auditMessage && <AuditModal message={auditMessage} audit={auditPayload} loading={auditLoading} onClose={() => setAuditMessage(null)} onRefresh={() => { setAuditCache((current) => { const next = { ...current }; delete next[auditMessage.id]; return next; }); void openAudit(auditMessage, true); }} />}
    {historyOpen && detail && <ConversationHistoryModal detail={detail} onClose={() => setHistoryOpen(false)} />}
    </>
  );
}

function CommunicationTabs({ active, onChange, customerUnread = 0 }: { active: string; onChange: (value: string) => void; customerUnread?: number }) {
  const cards = [
    {
      key: "customers",
      title: "Müşteri İletişimi",
      description: "Müşteri taleplerini, destek kayıtlarını ve operasyon konuşmalarını yönetin.",
      icon: <Inbox size={28} />,
      badge: customerUnread,
      activeClass: "border-cyan-300 bg-gradient-to-br from-cyan-100 via-sky-100 to-white text-slate-950 shadow-[0_20px_48px_rgba(8,145,178,.18)] ring-2 ring-cyan-200",
      idleClass: "border-slate-200 bg-white text-slate-900 hover:border-cyan-200 hover:bg-cyan-50"
    },
    {
      key: "team",
      title: "Ekip İletişimi",
      description: "Ajans içi koordinasyonu sağlayın, ekip operasyonlarını tek merkezden yürütün.",
      icon: <MessageSquareText size={28} />,
      badge: 0,
      activeClass: "border-violet-300 bg-gradient-to-br from-slate-900 via-violet-900 to-slate-800 text-white shadow-[0_20px_48px_rgba(76,29,149,.24)]",
      idleClass: "border-slate-200 bg-white text-slate-900 hover:border-violet-200 hover:bg-violet-50"
    }
  ];
  return <section aria-label="İletişim kanalı seçimi" className="grid gap-3 md:grid-cols-2">
    {cards.map((card) => {
      const selected = active === card.key;
      return <button
        key={card.key}
        type="button"
        onClick={() => onChange(card.key)}
        aria-pressed={selected}
        className={`group relative min-h-[128px] overflow-hidden rounded-[22px] border p-5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 ${selected ? card.activeClass : card.idleClass}`}
      >
        <span className={`grid size-14 place-items-center rounded-[16px] ${selected && card.key === "team" ? "bg-white/20 text-white" : selected ? "bg-cyan-200 text-cyan-900" : "bg-slate-100 text-slate-700 group-hover:bg-white"}`}>{card.icon}</span>
        <span className="mt-4 flex items-center gap-2 text-xl font-black">{card.title}{card.badge > 0 ? <span className="rounded-full bg-amber-300 px-2.5 py-1 text-xs font-black text-slate-950">{card.badge}</span> : null}</span>
        <span className={`mt-2 block max-w-xl text-sm font-semibold leading-6 ${selected && card.key === "team" ? "text-white/85" : selected ? "text-slate-700" : "text-slate-600"}`}>{card.description}</span>
        <span className={`absolute right-4 top-4 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em] ${selected && card.key === "team" ? "bg-white/20 text-white" : selected ? "bg-cyan-200 text-cyan-950" : "bg-slate-100 text-slate-500"}`}>{selected ? "Aktif" : "Seç"}</span>
      </button>;
    })}
  </section>;
}

function UnsavedChangesDialog({ onCancel, onDiscard, onSave, saving }: { onCancel: () => void; onDiscard: () => void; onSave: () => void; saving: boolean }) {
  return <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="unsaved-title"><div className="w-full max-w-lg rounded-[18px] border border-amber-200 bg-white p-5 shadow-2xl"><h2 id="unsaved-title" className="text-xl font-black text-slate-950">Kaydedilmemiş değişiklikler var</h2><p className="mt-2 text-sm leading-6 text-slate-600">Değişiklikleri kaydetmeden devam etmek istiyor musunuz?</p><div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={onCancel} className="min-h-11 rounded-[10px] border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">İptal</button><button type="button" onClick={onDiscard} className="min-h-11 rounded-[10px] border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-800">Kaydetmeden Devam Et</button><button type="button" onClick={onSave} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-emerald-600 px-4 text-sm font-black text-white disabled:opacity-50">{saving && <Loader2 size={16} className="animate-spin" />} Kaydet ve Devam Et</button></div></div></div>;
}

function AuditModal({ message, audit, loading, onClose, onRefresh }: { message: MessageItem; audit: AuditPayload | null; loading: boolean; onClose: () => void; onRefresh: () => void }) {
  return <div className="fixed inset-0 z-[130] grid place-items-center bg-slate-950/45 p-3" role="dialog" aria-modal="true" aria-labelledby="message-audit-title" onMouseDown={onClose}>
    <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5">
        <div><p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">Admin denetim görünümü</p><h2 id="message-audit-title" className="mt-1 text-xl font-black text-slate-950">Mesaj Bilgileri</h2></div>
        <div className="flex gap-2"><button type="button" onClick={onRefresh} className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 text-xs font-black text-slate-700"><RefreshCw size={15} /> Yenile</button><button type="button" onClick={onClose} aria-label="Mesaj bilgilerini kapat" className="grid size-10 place-items-center rounded-[10px] border border-slate-200 text-slate-600"><X size={17} /></button></div>
      </header>
      <div className="max-h-[calc(90vh-92px)] overflow-y-auto p-5">
        {loading && <p className="inline-flex items-center gap-2 rounded-[12px] border border-cyan-200 bg-cyan-50 p-3 text-sm font-bold text-cyan-900"><Loader2 size={16} className="animate-spin" /> Mesaj bilgileri yükleniyor...</p>}
        {!loading && audit && <div className="grid gap-4 lg:grid-cols-2">
          <AuditSection title="Mesaj özeti" icon={<MessageSquareText size={17} />}>
            <AuditLine label="Gönderen" value={audit.message.sender_name || message.sender_name} />
            <AuditLine label="Gönderen rolü" value={audit.message.sender_type === "staff" ? "Personel" : "Müşteri"} />
            <AuditLine label="Gönderim tarihi" value={formatDateTime(audit.message.sent_at)} />
            <AuditLine label="Dosya sayısı" value={String(audit.message.attachment_count || 0)} />
          </AuditSection>
          <AuditSection title="Kim gördü" icon={<UserCheck size={17} />}>
            <AuditLine label="İlk gören admin" value={audit.reads.first_reader?.user_name || "Henüz görüntülenmedi"} />
            <AuditLine label="İlk görülme zamanı" value={audit.reads.first_reader?.read_at ? formatDateTime(audit.reads.first_reader.read_at) : "Henüz görüntülenmedi"} />
            <AuditLine label="Toplam gören personel" value={String(audit.reads.total_staff_readers || 0)} />
            <div className="mt-2 grid gap-2">{audit.reads.readers.map((reader) => <p key={`${reader.user_name}-${reader.read_at}`} className="rounded-[10px] bg-slate-50 p-2 text-xs text-slate-700"><strong>{reader.user_name}</strong> · {formatDateTime(reader.read_at)}</p>)}{!audit.reads.readers.length && <EmptyAudit text="Henüz hiçbir ekip üyesi görmedi." />}</div>
          </AuditSection>
          <AuditSection title="Kim yanıtladı" icon={<Send size={17} />}>
            <AuditLine label="İlk yanıtlayan admin" value={audit.replies.first_reply?.user_name || "Bu mesaj için yanıt bulunmuyor"} />
            <AuditLine label="İlk yanıt zamanı" value={audit.replies.first_reply?.sent_at ? formatDateTime(audit.replies.first_reply.sent_at) : "Yanıt yok"} />
            <AuditLine label="Son yanıtlayan admin" value={audit.replies.last_reply?.user_name || "Bu mesaj için yanıt bulunmuyor"} />
            <AuditLine label="Yanıt süresi" value={audit.replies.first_reply?.response_minutes != null ? `${audit.replies.first_reply.response_minutes} dakika` : "Hesaplanamadı"} />
          </AuditSection>
          <AuditSection title="Kim işlem yaptı" icon={<Clock3 size={17} />}>
            <div className="grid gap-2">{audit.activity.map((item) => <p key={item.id} className="rounded-[10px] bg-slate-50 p-2 text-xs leading-5 text-slate-700"><strong>{item.actor_name || "Sistem"}</strong> · {activityLabel(item.activity_type)} · {formatDateTime(item.created_at)}{formatActivityDetail(item.detail)}</p>)}{!audit.activity.length && <EmptyAudit text="İşlem kaydı bulunmuyor." />}</div>
          </AuditSection>
          <AuditSection title="Atama geçmişi" icon={<ClipboardList size={17} />}>
            <div className="grid gap-2">{audit.assignments.map((item) => <p key={`${item.assigned_by_name}-${item.created_at}`} className="rounded-[10px] bg-slate-50 p-2 text-xs text-slate-700"><strong>{item.assigned_by_name}</strong> → {item.assigned_to_name} · {formatDateTime(item.created_at)}</p>)}{!audit.assignments.length && <EmptyAudit text="Atama geçmişi bulunmuyor." />}</div>
          </AuditSection>
        </div>}
      </div>
    </div>
  </div>;
}

function ConversationHistoryModal({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  const activity = [...(detail.activity || [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const assignments = detail.assignments || [];
  return <div className="fixed inset-0 z-[125] grid place-items-center bg-slate-950/45 p-3" role="dialog" aria-modal="true" aria-labelledby="conversation-history-title" onMouseDown={onClose}>
    <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Admin işlem geçmişi</p>
          <h2 id="conversation-history-title" className="mt-1 text-xl font-black text-slate-950">Konuşma İşlem Geçmişi</h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">{detail.conversation.company_name} · {detail.conversation.subject}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="İşlem geçmişini kapat" className="grid size-10 place-items-center rounded-[10px] border border-slate-200 text-slate-600"><X size={17} /></button>
      </header>
      <div className="max-h-[calc(90vh-96px)] overflow-y-auto p-5">
        <div className="grid gap-4">
          <section className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 font-black text-slate-950"><Clock3 size={17} /> İşlemler</h3>
            <div className="grid gap-2">
              {activity.map((item) => <div key={item.id} className="rounded-[12px] border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-slate-950">{item.actor_name || "Sistem"}</strong>
                  <time className="text-xs font-bold text-slate-500">{formatDateTime(item.created_at)}</time>
                </div>
                <p className="mt-1 font-semibold">{activityLabel(item.activity_type)}{formatActivityDetail(item.detail)}</p>
              </div>)}
              {!activity.length && <EmptyAudit text="Bu konuşma için işlem kaydı bulunmuyor." />}
            </div>
          </section>
          <section className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 font-black text-slate-950"><ClipboardList size={17} /> Atama geçmişi</h3>
            <div className="grid gap-2">
              {assignments.map((item) => <div key={`${item.assigned_by_name}-${item.created_at}`} className="rounded-[12px] border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <strong className="text-slate-950">{item.assigned_by_name}</strong>
                <span> → {item.assigned_to_name}</span>
                <time className="mt-1 block text-xs font-bold text-slate-500">{formatDateTime(item.created_at)}</time>
              </div>)}
              {!assignments.length && <EmptyAudit text="Atama geçmişi bulunmuyor." />}
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>;
}

function AuditSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-sm"><h3 className="mb-3 flex items-center gap-2 font-black text-slate-950">{icon}{title}</h3>{children}</section>;
}
function AuditLine({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[130px_1fr] gap-3 border-t border-slate-100 py-2 text-sm first:border-t-0"><span className="font-bold text-slate-500">{label}</span><span className="font-semibold text-slate-900">{value}</span></div>;
}
function EmptyAudit({ text }: { text: string }) { return <p className="rounded-[10px] border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">{text}</p>; }
function activityLabel(value: string) {
  return ({
    conversation_created: "Konuşma oluşturdu",
    message_sent: "Mesaj gönderdi",
    internal_note_added: "İç not ekledi",
    assignment_changed: "Atama değiştirdi",
    conversation_updated: "Konuşmayı güncelledi",
    conversation_fields_updated: "Yönetim alanlarını kaydetti",
    task_created: "Görev oluşturdu",
    proposal_flow_opened: "Teklif akışını açtı"
  } as Record<string, string>)[value] || value;
}
function formatActivityDetail(detail?: Record<string, unknown>) {
  const changes = Array.isArray(detail?.changes) ? detail.changes as Array<Record<string, unknown>> : [];
  if (!changes.length) return "";
  return ` · ${changes.map((change) => `${fieldLabel(String(change.field || ""))}: ${String(change.old_value ?? "-")} → ${String(change.new_value ?? "-")}`).join(", ")}`;
}
function fieldLabel(value: string) {
  return ({ status: "Durum", priority: "Öncelik", assigned_to: "Atanan" } as Record<string, string>)[value] || value;
}
