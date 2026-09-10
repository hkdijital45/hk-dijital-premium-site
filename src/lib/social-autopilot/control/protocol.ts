// Tool catalogue, argument validation, output sanitization and the
// permission model shared by every Social Autopilot control surface (today:
// Claude MCP — see ../mcp/). This is the single source of truth for what a
// tool is called, what it accepts and what it's allowed to do; the real
// catalogue is preserved as-is (37 tools) rather than padded or trimmed.
import { safeCompare } from "@/lib/secure-compare";

export type Permission = "READ_ONLY" | "WRITE_SAFE" | "WRITE_PUBLISH";
export type Mode = "READ_ONLY" | "ASSISTED" | "FULL_CONTROL";

export class ControlError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function authenticate(header: string | undefined, secret: string) {
  if (!safeCompare(header, `Bearer ${secret}`)) throw new ControlError("UNAUTHORIZED", "Authentication required.", 401);
}

export const success = (data: unknown) => ({ success: true, data, error: null });
export function failure(error: unknown) {
  return {
    success: false,
    data: null,
    error: {
      code: error instanceof ControlError ? error.code : "SERVICE_UNAVAILABLE",
      message: error instanceof ControlError ? error.message : "Service request failed; check configuration and readiness.",
      retryable: false
    }
  };
}

// Defence in depth: never expose database/provider exception text, credential
// fields, provider pagination URLs (which can contain tokens), or known secrets.
export function sanitize(value: unknown, env: Record<string, string | undefined> = process.env): unknown {
  if (Array.isArray(value)) return value.map((v) => sanitize(v, env));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => !/secret|password|access.?token|refresh.?token|encrypted|authorization|api.?key|service.?role|cookie|paging|last.?error|failure_reason|notify_webhook/i.test(k))
        .map(([k, v]) => [k, sanitize(v, env)])
    );
  }
  if (typeof value !== "string") return value;
  let result = value;
  for (const [key, secret] of Object.entries(env)) {
    if (/SECRET|TOKEN|KEY|PASSWORD|DATABASE_URL|SUPABASE_URL/.test(key) && secret && secret.length >= 4) {
      result = result.split(secret).join("[REDACTED]").split(encodeURIComponent(secret)).join("[REDACTED]");
    }
  }
  return result.replace(/Bearer\s+[^\s"<>]+/gi, "Bearer [REDACTED]").replace(/([?&](?:access_token|key|token|secret)=)[^&\s]+/gi, "$1[REDACTED]");
}

type Field = { type: "string" | "integer" | "object"; format?: string; minimum?: number; maximum?: number; enum?: string[] };
const id: Field = { type: "string", format: "uuid" };
const date: Field = { type: "string", format: "date" };
const at: Field = { type: "string", format: "date-time" };
const limit: Field = { type: "integer", minimum: 1, maximum: 100 };
export type Tool = { name: string; description: string; permission: Permission; inputSchema: { type: "object"; properties: Record<string, Field>; required: string[]; additionalProperties: false } };
const entries: Tool[] = [];
function add(names: string, permission: Permission, properties: Record<string, Field> = {}, required: string[] = [], description = "") {
  for (const name of names.split(" ")) entries.push({ name, permission, description: description || name.replaceAll("_", " "), inputSchema: { type: "object", properties, required, additionalProperties: false } });
}
add("instagram_get_profile instagram_get_connection_status autopilot_get_status autopilot_get_readiness instagram_get_growth_summary", "READ_ONLY");
add("instagram_get_recent_posts instagram_get_account_insights instagram_get_best_content instagram_get_weak_content instagram_get_learnings", "READ_ONLY", { limit });
add("instagram_get_post_insights content_preview", "READ_ONLY", { id }, ["id"]);
add("instagram_analyze_last_7_days instagram_analyze_last_30_days instagram_analyze_last_90_days instagram_synthesize_performance", "READ_ONLY");
add("instagram_get_best_posting_times", "READ_ONLY", { id, date }, ["id", "date"]);
add("content_get_strategy content_get_today instagram_get_publish_queue", "READ_ONLY");
add("content_get_calendar", "READ_ONLY", { start: date, end: date }, ["start", "end"]);
add("content_generate_carousel content_generate_static content_prepare_reel", "WRITE_SAFE", { content: { type: "object" } }, ["content"], "Store complete Claude-authored content using the strategy package item contract; no runtime AI.");
add("strategy_import", "WRITE_SAFE", { package: { type: "object" } }, ["package"], "Validate and import schema_version 1.0 strategy package.");
add("content_validate content_render instagram_cancel_scheduled_post", "WRITE_SAFE", { id }, ["id"]);
add("instagram_schedule_post instagram_reschedule_post", "WRITE_SAFE", { id, scheduled_at: at }, ["id", "scheduled_at"]);
add("instagram_publish_now", "WRITE_PUBLISH", { id }, ["id"]);
add("instagram_refresh_scores instagram_refresh_posting_time_model instagram_refresh_analytics autopilot_pause", "WRITE_SAFE");
add("autopilot_resume autopilot_run_daily_cycle", "WRITE_PUBLISH");
export const tools = entries;

export function validateArguments(tool: Tool, raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ControlError("INVALID_ARGUMENTS", "Arguments must be an object.");
  const args = raw as Record<string, unknown>;
  for (const key of Object.keys(args)) if (!(key in tool.inputSchema.properties)) throw new ControlError("INVALID_ARGUMENTS", "Unknown argument.");
  for (const key of tool.inputSchema.required) if (!(key in args)) throw new ControlError("INVALID_ARGUMENTS", `Required argument: ${key}.`);
  for (const [key, value] of Object.entries(args)) {
    const field = tool.inputSchema.properties[key];
    let valid = field.type === "integer" ? Number.isInteger(value) && Number(value) >= field.minimum! && Number(value) <= field.maximum! : field.type === "object" ? !!value && typeof value === "object" && !Array.isArray(value) : typeof value === "string" && value.length <= 100;
    if (field.format === "uuid") valid &&= typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
    if (field.format === "date") valid &&= typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    if (field.format === "date-time") valid &&= typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
    if (!valid) throw new ControlError("INVALID_ARGUMENTS", `Invalid argument: ${key}.`);
  }
  return args;
}
