// Smart publishing-time engine (spec sections 24-25). No hardcoded universal
// "best Instagram time" — starts from generic cold-start priors, then
// increasingly trusts real per-weekday/hour/content-type performance once
// social_publishing_time_recommendations (built by learning-engine.ts from
// actual social_metric_snapshots) has enough samples.
//
// Turkey has used a fixed UTC+3 offset with no DST since 2016, so
// Europe/Istanbul local time can be expressed as a constant "+03:00" offset
// safely (verified current as of this build) — avoids pulling in a full
// IANA timezone library for one fixed-offset zone.
import { supabaseRest } from "@/lib/supabase";
import { COLD_START_TIME_WINDOWS, SAMPLE_SIZE_CONFIDENCE, SOCIAL_WORKSPACE_ID } from "./constants";
import type { SocialConfidence, SocialContentType, SocialPublishingTimeRecommendation } from "./types";

const ISTANBUL_OFFSET = "+03:00";

function confidenceForSampleSize(sampleSize: number): SocialConfidence {
  if (sampleSize >= SAMPLE_SIZE_CONFIDENCE.high) return "high";
  if (sampleSize >= SAMPLE_SIZE_CONFIDENCE.medium) return "medium";
  return "low";
}

function buildIstanbulIso(dateIso: string, hour: number) {
  const paddedHour = String(Math.min(23, Math.max(0, hour))).padStart(2, "0");
  return new Date(`${dateIso}T${paddedHour}:00:00${ISTANBUL_OFFSET}`).toISOString();
}

/** Deterministic cold-start slot: rotates through COLD_START_TIME_WINDOWS by
 * day-of-strategy index so early content actively diversifies across
 * windows to gather real data, instead of always testing the same hour. */
function coldStartSlot(dayIndex: number) {
  return COLD_START_TIME_WINDOWS[dayIndex % COLD_START_TIME_WINDOWS.length];
}

export async function recommendPublishTime(params: {
  contentDate: string; // YYYY-MM-DD
  contentType: SocialContentType;
  contentPillar: string;
  dayIndex: number;
}): Promise<{ scheduledAt: string; confidence: SocialConfidence; reasoning: string }> {
  const weekday = new Date(`${params.contentDate}T12:00:00${ISTANBUL_OFFSET}`).getUTCDay();

  const learned = await supabaseRest<SocialPublishingTimeRecommendation[]>(
    `social_publishing_time_recommendations?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&weekday=eq.${weekday}` +
    `&or=(content_type.eq.${params.contentType},content_type.eq.any)&select=*&order=sample_size.desc&limit=5`
  );

  const bestMatch = learned
    .filter((row) => row.content_pillar === params.contentPillar || row.content_pillar === "any")
    .sort((a, b) => b.sample_size - a.sample_size)[0] || learned[0];

  if (bestMatch && bestMatch.sample_size >= SAMPLE_SIZE_CONFIDENCE.medium) {
    const confidence = confidenceForSampleSize(bestMatch.sample_size);
    return {
      scheduledAt: buildIstanbulIso(params.contentDate, bestMatch.hour),
      confidence,
      reasoning: `${["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"][weekday]} ${bestMatch.hour}:00 — ${bestMatch.sample_size} benzer gönderiden hesaplanan ortalama performans skoru ${bestMatch.avg_score.toFixed(0)}/100 (${params.contentType}${bestMatch.content_pillar !== "any" ? `, ${bestMatch.content_pillar}` : ""}).`
    };
  }

  const slot = coldStartSlot(params.dayIndex);
  return {
    scheduledAt: buildIstanbulIso(params.contentDate, slot.hour),
    confidence: "low",
    reasoning: `Henüz yeterli gerçek performans verisi yok (${bestMatch?.sample_size || 0} örnek) — genel başlangıç varsayımı kullanıldı ve veri toplamak için zaman dilimleri kasıtlı olarak çeşitlendiriliyor. Örnek sayısı arttıkça güven seviyesi otomatik yükselecek.`
  };
}
