import "server-only";

import { createNotificationForRecipients, staffRecipientIds, getPreferences, recordDelivery, type NotificationCategory } from "./store";
import { sendPushToUser } from "./push";

/** Creates the notification row(s) for every recipient, then — for each
 * recipient who has push enabled and this category enabled — attempts a
 * real push delivery. A disabled category never reaches push dispatch
 * (recorded as skipped_preference), matching "a disabled category must
 * not generate push deliveries for that user". Failures here are
 * swallowed (logged via recordDelivery, never thrown) — a notification
 * event must never break the caller's main request (lead creation,
 * proposal transition, etc.).
 */
async function dispatch(recipientProfileIds: string[], category: NotificationCategory, title: string, message: string, opts: { relatedType?: string; relatedId?: string; deepLink?: string; idempotencyKey: string }) {
  try {
    const notifications = await createNotificationForRecipients(recipientProfileIds, {
      category, title, message,
      relatedType: opts.relatedType, relatedId: opts.relatedId, deepLink: opts.deepLink,
      idempotencyKey: opts.idempotencyKey
    });
    await Promise.all(notifications.map(async (notification) => {
      const prefs = await getPreferences(notification.recipient_profile_id);
      if (!prefs.push_enabled || !prefs.categories[category]) {
        await recordDelivery({ notificationId: notification.id, subscriptionId: null, status: "skipped_preference" });
        return;
      }
      await sendPushToUser(notification.recipient_profile_id, {
        title, body: message, deepLink: opts.deepLink, category, notificationId: notification.id
      });
    }));
  } catch {
    // Never let a notification-dispatch failure break the caller's main action.
  }
}

export async function notifyLeadCreated(lead: { id: string; name?: string; company?: string }) {
  const recipients = await staffRecipientIds();
  const label = lead.company || lead.name || "Yeni başvuru";
  await dispatch(recipients, "lead", "Yeni Lead", `${label} sisteme yeni bir lead olarak eklendi.`, {
    relatedType: "lead", relatedId: lead.id, deepLink: `/hk-admin?lead=${lead.id}`,
    idempotencyKey: `lead_created:${lead.id}`
  });
}

export async function notifyProposalReady(proposal: { id: string; target_label: string; created_by: string | null }) {
  const recipients = proposal.created_by ? [proposal.created_by] : await staffRecipientIds();
  await dispatch(recipients, "proposal", "Teklif İncelemeye Hazır", `${proposal.target_label} için teklif analizi içe aktarıldı, inceleme bekliyor.`, {
    relatedType: "proposal", relatedId: proposal.id, deepLink: `/hk-admin/teklif-merkezi?proposal=${proposal.id}`,
    idempotencyKey: `proposal_ready:${proposal.id}`
  });
}

export async function notifyProposalAccepted(proposal: { id: string; target_label: string; created_by: string | null }) {
  const recipients = proposal.created_by ? [proposal.created_by] : await staffRecipientIds();
  await dispatch(recipients, "proposal", "Teklif Kabul Edildi", `${proposal.target_label} teklifi kabul edildi.`, {
    relatedType: "proposal", relatedId: proposal.id, deepLink: `/hk-admin/teklif-merkezi?proposal=${proposal.id}`,
    idempotencyKey: `proposal_accepted:${proposal.id}`
  });
}

export async function notifyProposalRejected(proposal: { id: string; target_label: string; created_by: string | null }) {
  const recipients = proposal.created_by ? [proposal.created_by] : await staffRecipientIds();
  await dispatch(recipients, "proposal", "Teklif Reddedildi", `${proposal.target_label} teklifi reddedildi.`, {
    relatedType: "proposal", relatedId: proposal.id, deepLink: `/hk-admin/teklif-merkezi?proposal=${proposal.id}`,
    idempotencyKey: `proposal_rejected:${proposal.id}`
  });
}

export async function notifyProposalExpiringSoon(proposal: { id: string; target_label: string; created_by: string | null; valid_until: string }) {
  const recipients = proposal.created_by ? [proposal.created_by] : await staffRecipientIds();
  await dispatch(recipients, "proposal", "Teklif Süresi Yaklaşıyor", `${proposal.target_label} teklifinin geçerlilik süresi ${proposal.valid_until} tarihinde doluyor.`, {
    relatedType: "proposal", relatedId: proposal.id, deepLink: `/hk-admin/teklif-merkezi?proposal=${proposal.id}`,
    idempotencyKey: `proposal_expiring:${proposal.id}:${proposal.valid_until}`
  });
}

export async function notifyProposalExpired(proposal: { id: string; target_label: string; created_by: string | null }) {
  const recipients = proposal.created_by ? [proposal.created_by] : await staffRecipientIds();
  await dispatch(recipients, "proposal", "Teklif Süresi Doldu", `${proposal.target_label} teklifinin geçerlilik süresi doldu.`, {
    relatedType: "proposal", relatedId: proposal.id, deepLink: `/hk-admin/teklif-merkezi?proposal=${proposal.id}`,
    idempotencyKey: `proposal_expired:${proposal.id}`
  });
}

export async function notifyCampaignEndingSoon(campaign: { id: string; name?: string; company_id: string; end_date: string }) {
  const recipients = await staffRecipientIds();
  await dispatch(recipients, "campaign", "Kampanya Bitiş Tarihi Yaklaşıyor", `${campaign.name || "Kampanya"} ${campaign.end_date} tarihinde sona eriyor.`, {
    relatedType: "campaign", relatedId: campaign.id, deepLink: `/hk-admin/kampanyalar?campaign=${campaign.id}`,
    idempotencyKey: `campaign_ending:${campaign.id}:${campaign.end_date}`
  });
}

export async function notifyCampaignEnded(campaign: { id: string; name?: string; company_id: string }) {
  const recipients = await staffRecipientIds();
  await dispatch(recipients, "campaign", "Kampanya Sona Erdi", `${campaign.name || "Kampanya"} sona erdi.`, {
    relatedType: "campaign", relatedId: campaign.id, deepLink: `/hk-admin/kampanyalar?campaign=${campaign.id}`,
    idempotencyKey: `campaign_ended:${campaign.id}`
  });
}

export async function notifyTaskReminderDue(task: { id: string; title: string; due_date: string; company_id?: string | null }) {
  const recipients = await staffRecipientIds();
  await dispatch(recipients, "reminder", "Görev Hatırlatması", `${task.title} (${task.due_date}) için hatırlatma zamanı geldi.`, {
    relatedType: "agency_task", relatedId: task.id, deepLink: `/hk-admin/gorevler?task=${task.id}`,
    idempotencyKey: `task_reminder:${task.id}:${task.due_date}`
  });
}

export async function notifyTaskOverdue(task: { id: string; title: string; due_date: string }) {
  const recipients = await staffRecipientIds();
  await dispatch(recipients, "reminder", "Görev Süresi Geçti", `${task.title} görevi ${task.due_date} tarihinde teslim edilmeliydi ve hâlâ tamamlanmadı.`, {
    relatedType: "agency_task", relatedId: task.id, deepLink: `/hk-admin/gorevler?task=${task.id}`,
    idempotencyKey: `task_overdue:${task.id}:${task.due_date}`
  });
}

export async function notifySystemAlert(title: string, message: string, deepLink?: string, idempotencyKey?: string) {
  const recipients = await staffRecipientIds();
  await dispatch(recipients, "system", title, message, {
    deepLink, idempotencyKey: idempotencyKey || `system:${title}:${new Date().toISOString().slice(0, 10)}`
  });
}
