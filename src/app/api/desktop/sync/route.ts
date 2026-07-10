import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

type DesktopLocalChange = {
  localId?: string;
  remoteId?: string | null;
  entityType?: string;
  payload?: Record<string, unknown>;
  updatedAt?: string;
};

type DesktopSyncBody = {
  clientId?: string;
  deviceName?: string;
  lastSyncAt?: string | null;
  localChanges?: DesktopLocalChange[];
  appVersion?: string;
};

const allowedEntityTypes = new Set([
  "customer_note",
  "task",
  "proposal_draft",
  "report_draft",
  "ad_comment_draft",
  "package_price_note",
  "admin_note"
]);

function cleanText(value: unknown, max = 180) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const source = payload as Record<string, unknown>;
  return {
    customerName: cleanText(source.customerName, 160),
    title: cleanText(source.title, 220),
    body: cleanText(source.body, 6000)
  };
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return jsonResponse(401, { error: "Oturum bulunamadı." });
  if (!isStaffRole(session.role)) return jsonResponse(403, { error: "Bu işlem için admin yetkisi gerekir." });

  let body: DesktopSyncBody = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "Geçersiz senkronizasyon isteği." });
  }

  const now = new Date().toISOString();
  const clientId = cleanText(body.clientId, 120);
  const deviceName = cleanText(body.deviceName || "HK Dijital Mac", 160);
  const appVersion = cleanText(body.appVersion || "0.1.0", 60);
  const localChanges = Array.isArray(body.localChanges) ? body.localChanges.slice(0, 100) : [];
  const acceptedChanges: Array<Record<string, unknown>> = [];
  const rejectedChanges: Array<Record<string, unknown>> = [];
  const conflicts: Array<Record<string, unknown>> = [];
  const pulledChanges: Array<Record<string, unknown>> = [];

  if (!clientId) return jsonResponse(400, { error: "clientId zorunludur." });

  if (!hasSupabaseConfig()) {
    return NextResponse.json({
      serverTime: now,
      pulledChanges,
      acceptedChanges,
      rejectedChanges: localChanges.map((change) => ({
        localId: change.localId || null,
        entityType: change.entityType || "draft",
        status: "rejected",
        message: "Supabase bağlantısı yapılandırılmadı."
      })),
      conflicts,
      nextSyncToken: now
    });
  }

  try {
    const existingDevices = await supabaseRest<Array<{ id: string }>>(
      `desktop_sync_devices?client_id=eq.${encodeURIComponent(clientId)}&select=id&limit=1`
    );
    const devicePayload = {
      user_id: session.profileId || null,
      client_id: clientId,
      device_name: deviceName,
      app_version: appVersion,
      last_seen_at: now
    };
    const deviceRows = existingDevices[0]
      ? await supabaseRest<Array<{ id: string }>>(
          `desktop_sync_devices?id=eq.${encodeURIComponent(existingDevices[0].id)}`,
          { method: "PATCH", body: JSON.stringify(devicePayload) }
        )
      : await supabaseRest<Array<{ id: string }>>(
          "desktop_sync_devices",
          { method: "POST", body: JSON.stringify({ ...devicePayload, created_at: now }) }
        );
    const deviceId = deviceRows[0]?.id || existingDevices[0]?.id || null;

    {
      const draftFilter = body.lastSyncAt
        ? `user_id=eq.${encodeURIComponent(session.profileId || "")}&updated_at=gt.${encodeURIComponent(body.lastSyncAt)}`
        : `user_id=eq.${encodeURIComponent(session.profileId || "")}`;
      const remoteDrafts = await supabaseRest<Array<{
        id: string;
        draft_type: string;
        title: string | null;
        content: Record<string, unknown> | null;
        sync_status: string | null;
        updated_at: string | null;
      }>>(
        `desktop_local_drafts?${draftFilter}&select=id,draft_type,title,content,sync_status,updated_at&order=updated_at.desc&limit=100`
      );
      remoteDrafts.forEach((draft) => {
        pulledChanges.push({
          remoteId: draft.id,
          entityType: draft.draft_type,
          status: draft.sync_status || "synced",
          message: "Web tarafındaki güncel taslak.",
          updatedAt: draft.updated_at || now,
          payload: {
            title: draft.title || "",
            body: typeof draft.content?.body === "string" ? draft.content.body : "",
            customerName: typeof draft.content?.customerName === "string" ? draft.content.customerName : ""
          }
        });
      });
    }

    for (const change of localChanges) {
      const entityType = cleanText(change.entityType, 80);
      const localId = cleanText(change.localId, 120);
      if (!allowedEntityTypes.has(entityType)) {
        rejectedChanges.push({ localId, entityType, status: "rejected", message: "Bu taslak türü desktop sync için desteklenmiyor." });
        continue;
      }

      const payload = cleanPayload(change.payload);
      const updatedAt = cleanText(change.updatedAt, 80) || now;
      const remoteId = cleanText(change.remoteId, 120);
      if (remoteId) {
        const existing = await supabaseRest<Array<{ id: string; updated_at: string | null }>>(
          `desktop_local_drafts?id=eq.${encodeURIComponent(remoteId)}&select=id,updated_at&limit=1`
        );
        const remoteUpdatedAt = existing[0]?.updated_at ? new Date(existing[0].updated_at).getTime() : 0;
        const localUpdatedAt = new Date(updatedAt).getTime();
        if (remoteUpdatedAt > localUpdatedAt) {
          conflicts.push({ localId, remoteId, entityType, status: "conflict", message: "Aynı taslak web tarafında daha yeni. Manuel çözüm gerekiyor.", updatedAt: existing[0].updated_at });
          continue;
        }
      }

      const draftPayload = {
        user_id: session.profileId || null,
        draft_type: entityType,
        title: cleanText(payload.title, 220) || "Desktop taslak",
        content: payload,
        sync_status: "synced",
        conflict_status: "none",
        source: "macos_desktop",
        updated_at: now
      };
      const rows = remoteId
        ? await supabaseRest<Array<{ id: string; updated_at: string }>>(
            `desktop_local_drafts?id=eq.${encodeURIComponent(remoteId)}`,
            { method: "PATCH", body: JSON.stringify(draftPayload) }
          )
        : await supabaseRest<Array<{ id: string; updated_at: string }>>(
            "desktop_local_drafts",
            { method: "POST", body: JSON.stringify({ ...draftPayload, created_at: now }) }
          );
      const saved = rows[0];
      acceptedChanges.push({ localId, remoteId: saved?.id || remoteId, entityType, status: "accepted", message: "Taslak web tarafına kaydedildi.", updatedAt: saved?.updated_at || now });

      await supabaseRest("desktop_sync_log", {
        method: "POST",
        body: JSON.stringify({
          user_id: session.profileId || null,
          device_id: deviceId,
          direction: "push",
          entity_type: entityType,
          entity_id: saved?.id || remoteId || localId,
          status: "accepted",
          message: "Desktop taslak senkronize edildi.",
          created_at: now
        })
      });
    }

    return NextResponse.json({
      serverTime: now,
      pulledChanges,
      acceptedChanges,
      rejectedChanges,
      conflicts,
      nextSyncToken: now
    });
  } catch {
    return jsonResponse(500, { error: "Senkronizasyon sırasında beklenmeyen bir hata oluştu." });
  }
}
