// Account-specific timing evidence. No generic "best Instagram time" —
// every recommendation is computed from this workspace's own real published
// posts, matched on weekday/content_type/content_pillar(/objective), in the
// workspace's actual configured IANA timezone (DST-aware via Intl).
import { supabaseRest } from "@/lib/supabase";
import { computeContentScore } from "./scoring-engine";
import { SAMPLE_SIZE_CONFIDENCE } from "./constants";
import { SOCIAL_WORKSPACE_ID } from "./types";
import type { ContentType, MetricSnapshot, SocialContentItem } from "./types";

export async function recommendPublishTime(params: { contentDate: string; contentType: ContentType; contentPillar: string; objective?: string; dayIndex: number }) {
  const settings = (await supabaseRest<Array<{ timezone: string }>>(`social_autopilot_settings?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=timezone&limit=1`))[0];
  const timezone = settings?.timezone || "Europe/Istanbul";
  const since = new Date(Date.now() - 90 * 86400000).toISOString();
  const rows = await supabaseRest<Array<SocialContentItem & { metric_snapshots: MetricSnapshot[] }>>(
    `social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&publication_status=eq.published&content_type=eq.${params.contentType}&content_pillar=eq.${encodeURIComponent(params.contentPillar)}${params.objective ? `&objective=eq.${encodeURIComponent(params.objective)}` : ""}&published_at=gte.${encodeURIComponent(since)}&select=*,metric_snapshots:social_metric_snapshots(*)&limit=1000`
  );
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", hour: "2-digit", hourCycle: "h23" });
  const targetDay = formatter.formatToParts(new Date(`${params.contentDate}T12:00:00Z`)).find((p) => p.type === "weekday")?.value;
  const cells = new Map<number, number[]>();
  for (const row of rows) {
    if (!row.published_at) continue;
    const parts = formatter.formatToParts(new Date(row.published_at));
    if (parts.find((p) => p.type === "weekday")?.value !== targetDay) continue;
    const metric = [...(row.metric_snapshots || [])].sort((a, b) => b.captured_at.localeCompare(a.captured_at))[0];
    if (!metric) continue;
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    cells.set(hour, [...(cells.get(hour) || []), computeContentScore(metric, row.cta_goal)]);
  }
  const ranked = [...cells].map(([hour, scores]) => ({ hour, sample_size: scores.length, score: scores.reduce((a, b) => a + b, 0) / scores.length })).sort((a, b) => b.score - a.score || b.sample_size - a.sample_size);
  const best = ranked[0];
  if (!best) return { scheduledAt: null, recommended_at: null, confidence: "low" as const, confidence_level: "LOW", sample_size: 0, reason: "Eşleşen hesap kanıtı yok. Açık bir gelecek zaman damgası belirtin.", reasoning: "Eşleşen hesap kanıtı yok. Açık bir gelecek zaman damgası belirtin." };
  // Search UTC candidates for the requested local wall time, including DST.
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  let scheduledAt: string | null = null;
  const base = Date.parse(`${params.contentDate}T00:00:00Z`);
  for (let minutes = -14 * 60; minutes <= 38 * 60; minutes += 15) {
    const candidate = new Date(base + minutes * 60000);
    const parts = formatter.formatToParts(candidate);
    if (localDate.format(candidate) === params.contentDate && Number(parts.find((p) => p.type === "hour")?.value) === best.hour && candidate.getUTCMinutes() % 15 === 0) {
      const localMinute = new Intl.DateTimeFormat("en-US", { timeZone: timezone, minute: "2-digit" }).format(candidate);
      if (Number(localMinute) === 0 && candidate.getTime() > Date.now()) { scheduledAt = candidate.toISOString(); break; }
    }
  }
  const confidence = best.sample_size >= SAMPLE_SIZE_CONFIDENCE.high ? "high" : best.sample_size >= SAMPLE_SIZE_CONFIDENCE.medium ? "medium" : "low";
  const reason = scheduledAt ? `${best.sample_size} eşleşen gönderi; ortalama performans ${best.score.toFixed(1)}/100; ${timezone}. Gözlemsel kanıt, nedensel kesinlik değil.` : "Öğrenilen saat geçmişte veya bu tarihte kullanılamıyor. Başka bir tarih seçin.";
  return { scheduledAt, recommended_at: scheduledAt, confidence, confidence_level: confidence.toUpperCase(), sample_size: best.sample_size, reason, reasoning: reason };
}
