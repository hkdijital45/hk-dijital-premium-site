import { NextResponse } from "next/server";
import { checkOperationalCustomer } from "@/lib/server/customer-visibility";
import { canSessionAccessResourceBranch, getSessionBranchAccess, normalizeRequestedBranch } from "@/lib/server/branch-access";
import {
  conversationCategories,
  conversationPriorities,
  createConversationNotification,
  getCommunicationContext,
  isUuid,
  recordConversationActivity,
  sanitizeCommunicationText,
  type ConversationRow
} from "@/lib/server/customer-communication";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  sender_type: "customer" | "staff";
  body: string;
  created_at: string;
};

export async function GET(request: Request) {
  const context = await getCommunicationContext();
  if (!context) return NextResponse.json({ error: "Oturum veya erişim yetkisi bulunamadı." }, { status: 401 });
  const query = new URL(request.url).searchParams;
  const companyId = query.get("companyId") || "";
  const status = query.get("status") || "";
  const category = query.get("category") || "";
  const priority = query.get("priority") || "";
  const view = query.get("view") || "";
  const search = sanitizeCommunicationText(query.get("search"), 80).toLocaleLowerCase("tr");

  if (context.isCustomer && !context.session.companyId) {
    return NextResponse.json({ conversations: [], unreadCount: 0 });
  }
  if (companyId && !isUuid(companyId)) return NextResponse.json({ error: "Geçersiz müşteri filtresi." }, { status: 400 });

  try {
    const includeArchived = status === "archived";
    const filters = includeArchived ? [] : ["archived_at=is.null"];
    if (context.isCustomer) filters.push(`company_id=eq.${context.session.companyId}`, "customer_archived_at=is.null");
    else if (companyId) filters.push(`company_id=eq.${companyId}`);
    if (status) filters.push(`status=eq.${encodeURIComponent(status)}`);
    if (priority && conversationPriorities.includes(priority as (typeof conversationPriorities)[number])) filters.push(`priority=eq.${encodeURIComponent(priority)}`);
    if (category) filters.push(`category=eq.${encodeURIComponent(category)}`);
    if (context.isStaff && view === "assigned_to_me") filters.push(`assigned_to=eq.${context.profileId}`);
    if (context.isStaff && view === "reply_required") filters.push("or=(status.eq.new,status.eq.admin_reply_required)");
    const conversations = await supabaseRest<ConversationRow[]>(
      `customer_conversations?${filters.join("&")}&select=*&order=last_message_at.desc&limit=200`
    );
    const accessible: ConversationRow[] = [];
    for (const conversation of conversations) {
      if (context.isStaff || await canSessionAccessResourceBranch(context.session, conversation.company_id, conversation.branch_id)) {
        if (!search || conversation.subject.toLocaleLowerCase("tr").includes(search)) accessible.push(conversation);
      }
    }
    const ids = accessible.map((item) => item.id);
    const [messages, reads, companies, branches, users] = ids.length
      ? await Promise.all([
        supabaseRest<MessageRow[]>(`customer_messages?conversation_id=in.(${ids.join(",")})&deleted_at=is.null&select=id,conversation_id,sender_id,sender_type,body,created_at&order=created_at.asc`),
        supabaseRest<Array<{ message_id: string }>>(`conversation_reads?conversation_id=in.(${ids.join(",")})&user_id=eq.${context.profileId}&select=message_id`),
        supabaseRest<Array<{ id: string; name: string }>>(`companies?id=in.(${[...new Set(accessible.map((item) => item.company_id))].join(",")})&select=id,name`),
        supabaseRest<Array<{ id: string; branch_name: string }>>(`customer_branches?id=in.(${[...new Set(accessible.map((item) => item.branch_id).filter(Boolean))].join(",") || "00000000-0000-0000-0000-000000000000"})&select=id,branch_name`),
        supabaseRest<Array<{ id: string; full_name: string | null; role: string }>>("users?is_active=eq.true&deleted_at=is.null&select=id,full_name,role&order=full_name.asc")
      ])
      : [[], [], [], [], []];
    const readIds = new Set(reads.map((item) => item.message_id));
    const companyNames = new Map(companies.map((item) => [item.id, item.name]));
    const branchNames = new Map(branches.map((item) => [item.id, item.branch_name]));
    const userNames = new Map(users.map((item) => [item.id, item.full_name || "Kullanıcı"]));
    const priorityRank: Record<string, number> = { urgent: 0, important: 1, normal: 2 };
    const result = accessible.map((conversation) => {
      const ownMessages = messages.filter((item) => item.conversation_id === conversation.id);
      const latestMessage = ownMessages.at(-1) || null;
      const unreadCount = ownMessages.filter((message) => message.sender_id !== context.profileId && !readIds.has(message.id)).length;
      return {
        ...conversation,
        company_name: companyNames.get(conversation.company_id) || "Müşteri",
        branch_name: conversation.branch_id ? branchNames.get(conversation.branch_id) || "Şube" : null,
        assigned_name: conversation.assigned_to ? userNames.get(conversation.assigned_to) || "Ekip üyesi" : null,
        latest_message: latestMessage?.body || "",
        message_count: ownMessages.length,
        unread_count: unreadCount
      };
    }).sort((a, b) => {
      const priorityDelta = (priorityRank[a.priority] ?? 3) - (priorityRank[b.priority] ?? 3);
      if (priorityDelta) return priorityDelta;
      return new Date(b.last_message_at || b.created_at).getTime() - new Date(a.last_message_at || a.created_at).getTime();
    });
    return NextResponse.json({
      conversations: result,
      unreadCount: result.reduce((total, item) => total + item.unread_count, 0),
      staff: context.isStaff ? users.filter((user) => ["admin", "yonetici", "editor", "sales"].includes(user.role)) : []
    });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getCommunicationContext();
  if (!context) return NextResponse.json({ error: "Oturum veya erişim yetkisi bulunamadı." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const subject = sanitizeCommunicationText(body.subject, 160);
  const messageBody = sanitizeCommunicationText(body.message);
  const category = conversationCategories.includes(body.category) ? body.category : "general";
  const priority = conversationPriorities.includes(body.priority) ? body.priority : "normal";
  const companyId = context.isCustomer ? context.session.companyId || "" : String(body.companyId || "");
  let branchId = isUuid(body.branchId) ? body.branchId : null;
  const idempotencyKey = sanitizeCommunicationText(body.idempotencyKey, 120) || null;

  if (!isUuid(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçilmelidir." }, { status: 400 });
  if (subject.length < 3) return NextResponse.json({ error: "Konu en az 3 karakter olmalıdır." }, { status: 400 });
  if (!messageBody) return NextResponse.json({ error: "Mesaj alanı boş bırakılamaz." }, { status: 400 });
  if (context.isCustomer) {
    const access = await getSessionBranchAccess(context.session, companyId);
    if (access.mode === "selected") branchId = normalizeRequestedBranch(access, branchId);
  }
  if (!await canSessionAccessResourceBranch(context.session, companyId, branchId)) {
    return NextResponse.json({ error: "Bu şube için iletişim yetkiniz bulunmuyor." }, { status: 403 });
  }

  try {
    const customerCheck = await checkOperationalCustomer(companyId);
    if (!customerCheck.ok) return NextResponse.json({ error: customerCheck.error }, { status: customerCheck.status });
    if (idempotencyKey) {
      const existing = await supabaseRest<Array<{ conversation_id: string }>>(
        `customer_messages?sender_id=eq.${context.profileId}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=conversation_id&limit=1`
      );
      if (existing[0]) return NextResponse.json({ ok: true, conversationId: existing[0].conversation_id, duplicate: true });
    }
    const now = new Date().toISOString();
    const conversationRows = await supabaseRest<ConversationRow[]>("customer_conversations", {
      method: "POST",
      body: JSON.stringify({
        company_id: companyId,
        branch_id: branchId,
        subject,
        category,
        priority,
        status: context.isCustomer ? "admin_reply_required" : "customer_reply_required",
        created_by: context.profileId,
        source: sanitizeCommunicationText(body.source, 80) || (context.isCustomer ? "customer_portal" : "admin"),
        related_entity_type: sanitizeCommunicationText(body.relatedEntityType, 80) || null,
        related_entity_id: sanitizeCommunicationText(body.relatedEntityId, 160) || null,
        last_message_at: now
      })
    });
    const conversation = conversationRows[0];
    if (!conversation) throw new Error("Konuşma kaydı oluşturulamadı.");
    try {
      const messageRows = await supabaseRest<MessageRow[]>("customer_messages", {
        method: "POST",
        body: JSON.stringify({
          conversation_id: conversation.id,
          sender_id: context.profileId,
          sender_type: context.isCustomer ? "customer" : "staff",
          body: messageBody,
          idempotency_key: idempotencyKey
        })
      });
      const message = messageRows[0];
      if (!message) throw new Error("İlk mesaj kaydedilemedi.");
      await supabaseRest("conversation_reads?on_conflict=message_id,user_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ conversation_id: conversation.id, message_id: message.id, user_id: context.profileId, read_at: now })
      });
      await recordConversationActivity(conversation.id, context.profileId, "conversation_created", { category, priority });
      await createConversationNotification({
        conversation,
        messageId: message.id,
        title: context.isCustomer ? `Yeni müşteri mesajı: ${subject}` : `HK Dijital yanıtı: ${subject}`,
        message: messageBody,
        showToCustomer: context.isStaff
      });
      return NextResponse.json({ ok: true, conversationId: conversation.id, messageId: message.id }, { status: 201 });
    } catch (error) {
      await supabaseRest(`customer_conversations?id=eq.${conversation.id}`, { method: "DELETE" }).catch(() => null);
      throw error;
    }
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title }, { status: 500 });
  }
}
