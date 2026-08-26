import { servicePages } from "@/lib/public-seo-content";
import type { GrowthOpportunityType } from "./types";

// A rough, widely-cited organic CTR-by-position benchmark curve. Used only
// as a directional "how far below expected is this query underperforming"
// signal — never presented as ground truth.
function expectedCtrForPosition(position: number) {
  if (position <= 1) return 0.28;
  if (position <= 2) return 0.15;
  if (position <= 3) return 0.10;
  if (position <= 5) return 0.06;
  if (position <= 10) return 0.03;
  if (position <= 20) return 0.015;
  return 0.005;
}

export function computeOpportunityScore(row: { clicks: number; impressions: number; ctr: number; avg_position: number }) {
  const breakdown: Record<string, number> = {};

  // Visibility: more impressions means more upside if we improve the page.
  const visibility = Math.min(35, Math.round(Math.log10(row.impressions + 1) * 12));
  breakdown.visibility = visibility;

  // Position sweet spot: page 1-2 (positions ~4-20) is "almost there" —
  // realistic to push higher with on-page work, unlike position 60+.
  let position = 0;
  if (row.avg_position >= 4 && row.avg_position <= 20) {
    position = Math.max(0, 30 - Math.round(Math.abs(row.avg_position - 9) * 2));
  } else if (row.avg_position > 20 && row.avg_position <= 40) {
    position = 10;
  }
  breakdown.position = position;

  // CTR gap: actual CTR well below the position's expected CTR suggests a
  // weak title/meta description rather than a ranking problem.
  const ctrGap = Math.max(0, expectedCtrForPosition(row.avg_position) - row.ctr);
  const ctr = Math.min(25, Math.round(ctrGap * 100 * 2.5));
  breakdown.ctr_gap = ctr;

  // Some real clicks already validate that the query/page match user intent.
  const trafficValidation = row.clicks > 0 ? 10 : 0;
  breakdown.traffic_validation = trafficValidation;

  const score = Math.min(100, visibility + position + ctr + trafficValidation);
  return { score, breakdown };
}

export function classifyOpportunity(row: { query: string; page: string; avg_position: number }): {
  type: GrowthOpportunityType;
  action: string;
} {
  const queryLower = row.query.toLocaleLowerCase("tr");
  const matchedService = servicePages.find((service) =>
    queryLower.includes(service.eyebrow.toLocaleLowerCase("tr").split(" ")[0]) ||
    service.eyebrow.toLocaleLowerCase("tr").includes(queryLower)
  );

  if (matchedService && (!row.page || row.page.includes(matchedService.slug))) {
    return {
      type: "service_page",
      action: `"${matchedService.eyebrow}" hizmet sayfasını bu sorguya göre güçlendir (başlık, içerik derinliği, iç link).`
    };
  }

  if (row.page && row.avg_position <= 20) {
    return {
      type: "refresh_content",
      action: "Mevcut sayfayı güncelle: başlık/meta açıklamayı iyileştir, ek bölüm ve iç bağlantı ekle."
    };
  }

  if (row.page && row.avg_position > 20) {
    return {
      type: "internal_link",
      action: "Sayfa indexli ama düşük sırada; ilgili yayınlanmış yazılardan bu sayfaya iç bağlantı ekle."
    };
  }

  return {
    type: "new_content",
    action: "Bu sorgu için yeni bir blog yazısı/içerik planı oluştur."
  };
}
