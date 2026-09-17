// Instagram Intelligence — Claude Custom Connector tool catalogue and
// dispatcher. A small, purpose-built surface (6 tools) separate from
// Social Autopilot's own 37-tool MCP connector (../../social-autopilot/
// control/protocol.ts) — deliberately not the same catalogue, since this
// connector's whole point is a much narrower, read-mostly surface. Reuses
// that file's generic (not Social-Autopilot-specific) primitives directly:
// ControlError, authenticate, success/failure/sanitize envelopes, the Tool
// type and its argument validator.
import {
  ControlError, authenticate, success, failure, sanitize, validateArguments,
  type Tool
} from "@/lib/social-autopilot/control/protocol";
import { getInstagramConnectionStatus, getUsableInstagramToken } from "@/lib/social-autopilot/instagram-oauth";
import { getRecentInstagramMedia } from "@/lib/social-autopilot/instagram-graph-client";
import { analyzeInstagramAccount, InstagramNotConnectedError } from "@/lib/instagram-intelligence/analysis";
import { validatePlanItems, createContentPlanItems, PlanInputError } from "@/lib/instagram-intelligence/plan";
import { supabaseRest } from "@/lib/supabase";
import { CONTENT_PLAN_WORKSPACE_ID, CONTENT_PLAN_TABLE, type ContentPlanItem } from "@/lib/content-plan/types";

export { ControlError, authenticate, success, failure, sanitize };

const limit: Tool["inputSchema"]["properties"][string] = { type: "integer", minimum: 1, maximum: 100 };
const plan: Tool["inputSchema"]["properties"][string] = { type: "array" };

export const tools: Tool[] = [
  { name: "get_instagram_account", description: "HK Dijital'in bağlı Instagram hesabının bağlantı durumunu döner (kullanıcı adı, bağlantı zamanı, token durumu). Read-only.", permission: "READ_ONLY", inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false } },
  { name: "get_instagram_analysis", description: "Gerçek Instagram gönderi geçmişine dayalı deterministik analiz: tema dağılımı, eksik/eskimiş temalar, format performansı, tekrar riski, paylaşım sıklığı. AI kullanmaz, hiçbir metrik uydurulmaz. Read-only.", permission: "READ_ONLY", inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false } },
  { name: "get_instagram_recent_posts", description: "Instagram hesabındaki en son gönderilerin ham listesi (caption, format, tarih, beğeni/yorum sayısı, permalink). Read-only.", permission: "READ_ONLY", inputSchema: { type: "object", properties: { limit }, required: [], additionalProperties: false } },
  { name: "get_content_tracking_history", description: "İçerik Takip'teki geçmiş (yayınlanmış) kayıtlar — tarih, platform, tema, konu, format, durum. Read-only.", permission: "READ_ONLY", inputSchema: { type: "object", properties: { limit }, required: [], additionalProperties: false } },
  { name: "get_upcoming_content_plan", description: "İçerik Takip'teki bugünden itibaren planlanmış (henüz paylaşılmamış) kayıtlar. Read-only.", permission: "READ_ONLY", inputSchema: { type: "object", properties: { limit }, required: [], additionalProperties: false } },
  { name: "create_content_plan", description: "Yazılmış bir içerik planını İçerik Takip'e kaydeder (tarih+konu bazında tekrar korumalı — aynı plan iki kez gönderilse bile kayıt çoğalmaz). Instagram'a HİÇBİR ŞEY YAYINLAMAZ, sadece İçerik Takip'e planlama satırı ekler.", permission: "WRITE_SAFE", inputSchema: { type: "object", properties: { items: plan }, required: ["items"], additionalProperties: false } }
];

function toolByName(name: string): Tool {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new ControlError("UNKNOWN_TOOL", "Unknown tool.", 404);
  return tool;
}

async function fetchPlanRows(filter: "history" | "upcoming", limit: number) {
  const today = new Date().toISOString().slice(0, 10);
  const scope = filter === "upcoming"
    ? `&is_published=eq.false&scheduled_date=gte.${today}`
    : `&is_published=eq.true`;
  return supabaseRest<ContentPlanItem[]>(
    `${CONTENT_PLAN_TABLE}?workspace_id=eq.${CONTENT_PLAN_WORKSPACE_ID}&select=*${scope}&order=scheduled_date.${filter === "upcoming" ? "asc" : "desc"}&limit=${limit}`
  );
}

export async function execute(name: string, args: Record<string, unknown>): Promise<unknown> {
  const toolLimit = Number(args.limit || 20);
  switch (name) {
    case "get_instagram_account":
      return getInstagramConnectionStatus();
    case "get_instagram_analysis":
      try {
        return await analyzeInstagramAccount();
      } catch (error) {
        if (error instanceof InstagramNotConnectedError) throw new ControlError("NOT_CONNECTED", error.message, 409);
        throw error;
      }
    case "get_instagram_recent_posts": {
      try {
        const { accessToken, igUserId } = await getUsableInstagramToken();
        const result = await getRecentInstagramMedia(accessToken, igUserId, toolLimit);
        return { source: "instagram", posts: result.data };
      } catch (error) {
        if (error instanceof InstagramNotConnectedError) throw new ControlError("NOT_CONNECTED", error.message, 409);
        throw error;
      }
    }
    case "get_content_tracking_history":
      return fetchPlanRows("history", toolLimit);
    case "get_upcoming_content_plan":
      return fetchPlanRows("upcoming", toolLimit);
    case "create_content_plan":
      try {
        const items = validatePlanItems(args.items);
        return await createContentPlanItems(items);
      } catch (error) {
        if (error instanceof PlanInputError) throw new ControlError("INVALID_ARGUMENTS", error.message, 400);
        throw error;
      }
    default:
      throw new ControlError("UNKNOWN_TOOL", "Unknown tool.", 404);
  }
}

export { toolByName, validateArguments };
