import { ControlError } from "./protocol";
// Reject unsupported keys/types before the existing package validator and DB
// writer are invoked. No arbitrary JSON is silently persisted in the audit row.
const strings = ["content_date", "content_type", "funnel_stage", "content_pillar", "objective", "target_persona", "topic", "title", "hook", "hook_archetype", "secondary_hook", "script", "on_screen_text", "caption", "cta", "cta_goal", "visual_direction", "target_kpi", "preferred_template"];
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ControlError("INVALID_PACKAGE", "Expected a structured object.");
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some((k) => !allowed.includes(k))) throw new ControlError("INVALID_PACKAGE", "Unsupported package field.");
}
export function validateContentShape(value: unknown) {
  const item = object(value);
  keys(item, [...strings, "day_offset", "estimated_duration_seconds", "carousel_slides", "scenes", "hashtags", "keywords"]);
  for (const key of strings) if (item[key] !== undefined && (typeof item[key] !== "string" || String(item[key]).length > 12000)) throw new ControlError("INVALID_PACKAGE", "Invalid text field.");
  for (const key of ["day_offset", "estimated_duration_seconds"]) if (item[key] !== undefined && (!Number.isInteger(item[key]) || Number(item[key]) < 0 || Number(item[key]) > 366)) throw new ControlError("INVALID_PACKAGE", "Invalid numeric field.");
  for (const key of ["hashtags", "keywords"]) if (item[key] !== undefined && (!Array.isArray(item[key]) || (item[key] as unknown[]).length > 50 || !(item[key] as unknown[]).every((v) => typeof v === "string" && v.length <= 200))) throw new ControlError("INVALID_PACKAGE", "Invalid list field.");
  if (item.carousel_slides !== undefined) {
    if (!Array.isArray(item.carousel_slides)) throw new ControlError("INVALID_PACKAGE", "Invalid slides.");
    for (const [i, raw] of item.carousel_slides.entries()) {
      const s = object(raw);
      keys(s, ["index", "headline", "body"]);
      if (!Number.isInteger(s.index) || Number(s.index) !== i + 1 || typeof s.headline !== "string" || !s.headline.trim() || s.headline.length > 300 || typeof s.body !== "string" || s.body.length > 1500) throw new ControlError("INVALID_PACKAGE", "Slides require sequential one-based index, headline and body.");
    }
  }
  if (item.scenes !== undefined) {
    if (!Array.isArray(item.scenes) || item.scenes.length > 30) throw new ControlError("INVALID_PACKAGE", "Invalid scenes.");
    for (const raw of item.scenes) {
      const s = object(raw);
      keys(s, ["scene", "start", "end", "type", "voiceover", "text", "visual_direction", "transition"]);
      for (const [k, v] of Object.entries(s)) if (["scene", "start", "end"].includes(k) ? typeof v !== "number" || !Number.isFinite(v) || v < 0 : typeof v !== "string") throw new ControlError("INVALID_PACKAGE", "Invalid scene field.");
    }
  }
  return item;
}
export function validatePackageShape(value: unknown) {
  const pkg = object(value);
  keys(pkg, ["schema_version", "generated_at", "strategy", "content_items"]);
  const s = object(pkg.strategy);
  const text = ["period_start", "period_end", "monthly_objective", "target_audience", "story_strategy", "follower_strategy", "authority_strategy", "lead_strategy", "conversion_strategy", "community_strategy"];
  const numeric = ["posting_frequency", "reel_ratio", "carousel_ratio", "static_ratio"];
  keys(s, [...text, ...numeric, "content_pillars", "creative_themes", "funnel_distribution", "testing_hypotheses", "kpi_targets", "personas"]);
  for (const key of text) if (s[key] !== undefined && typeof s[key] !== "string") throw new ControlError("INVALID_PACKAGE", "Invalid strategy text.");
  for (const key of numeric) if (s[key] !== undefined && (typeof s[key] !== "number" || !Number.isFinite(s[key]))) throw new ControlError("INVALID_PACKAGE", "Invalid strategy number.");
  for (const key of ["funnel_distribution", "kpi_targets"]) {
    if (s[key] !== undefined) {
      for (const v of Object.values(object(s[key]))) if (!(key === "kpi_targets" && typeof v === "string") && (typeof v !== "number" || !Number.isFinite(v) || v < 0)) throw new ControlError("INVALID_PACKAGE", "Invalid strategy metric.");
    }
  }
  for (const [key, fields] of Object.entries({ testing_hypotheses: ["hypothesis", "metric"], personas: ["name", "description"] })) {
    if (s[key] !== undefined) {
      if (!Array.isArray(s[key]) || (s[key] as unknown[]).length > 50) throw new ControlError("INVALID_PACKAGE", "Invalid strategy list.");
      for (const raw of s[key] as unknown[]) {
        const entry = object(raw);
        keys(entry, fields);
        if (fields.some((k) => typeof entry[k] !== "string")) throw new ControlError("INVALID_PACKAGE", "Invalid strategy entry.");
      }
    }
  }
  if (Array.isArray(s.content_pillars)) {
    for (const raw of s.content_pillars) {
      const pillar = object(raw);
      keys(pillar, ["name", "weight", "description"]);
      if (typeof pillar.weight !== "number" || !Number.isFinite(pillar.weight) || pillar.weight < 0 || (pillar.description !== undefined && typeof pillar.description !== "string")) throw new ControlError("INVALID_PACKAGE", "Invalid pillar.");
    }
  }
  if (s.posting_frequency !== undefined && (!Number.isInteger(s.posting_frequency) || Number(s.posting_frequency) < 1 || Number(s.posting_frequency) > 14)) throw new ControlError("INVALID_PACKAGE", "Posting frequency must be 1–14.");
  if (!Array.isArray(pkg.content_items) || pkg.content_items.length > 62) throw new ControlError("INVALID_PACKAGE", "Invalid content items.");
  pkg.content_items.forEach(validateContentShape);
}
