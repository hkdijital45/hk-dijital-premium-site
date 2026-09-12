// Deterministic template selection — implemented as deterministic code
// choosing BEFORE generation, then telling the AI what shape to write for.
// Slide 1 always renders as "bold_hook" and the final slide always renders
// as "cta_closing" (universal hook-then-CTA bookend) regardless of which of
// the 10 remaining "body" templates governs the slides in between — that
// choice is what this function selects and tracks for anti-repetition.
//
// Deliberately pure and DB-free (the "recent templates" history is fetched
// by template-history.ts and passed in) so this selection logic — including
// the anti-repetition rule — is directly unit-testable without a database.
import { TEMPLATE_KEYS, type TemplateKey } from "./templates.ts";
import type { FunnelStage } from "../../types";

export const BODY_TEMPLATES: TemplateKey[] = TEMPLATE_KEYS.filter((key) => key !== "bold_hook" && key !== "cta_closing");

const FUNNEL_TEMPLATE_WEIGHTS: Record<FunnelStage, Partial<Record<TemplateKey, number>>> = {
  problem_awareness: { mistakes: 3, myth_vs_reality: 2, problem_solution: 2, question_prompt: 2 },
  awareness: { educational_breakdown: 3, data_insight: 2, checklist: 1, question_prompt: 1 },
  consideration: { comparison: 3, framework: 2, tactical_guide: 1 },
  authority: { framework: 2, data_insight: 3, tactical_guide: 2 },
  trust: { myth_vs_reality: 2, educational_breakdown: 2, data_insight: 1 },
  conversion: { problem_solution: 3, step_by_step: 2, tactical_guide: 1 },
  retention: { checklist: 2, tactical_guide: 2, step_by_step: 1 }
};

function weightedPick(weights: Partial<Record<TemplateKey, number>>, exclude: Set<TemplateKey>, random: () => number): TemplateKey {
  const entries = (Object.entries(weights) as Array<[TemplateKey, number]>).filter(([key]) => !exclude.has(key));
  const pool = entries.length ? entries : BODY_TEMPLATES.filter((key) => !exclude.has(key)).map((key) => [key, 1] as [TemplateKey, number]);
  const finalPool = pool.length ? pool : BODY_TEMPLATES.map((key) => [key, 1] as [TemplateKey, number]);
  const total = finalPool.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [key, weight] of finalPool) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return finalPool[0][0];
}

/** `recentTemplates` should be the most-recently-used body templates, most
 * recent first (see template-history.ts). Only the single most recent one
 * is hard-excluded — the ones before that stay eligible, just no longer
 * favored once used. */
export function selectCarouselTemplate(funnelStage: FunnelStage, recentTemplates: TemplateKey[] = [], random: () => number = Math.random): TemplateKey {
  const excludeMostRecent = new Set<TemplateKey>(recentTemplates.slice(0, 1));
  return weightedPick(FUNNEL_TEMPLATE_WEIGHTS[funnelStage] || {}, excludeMostRecent, random);
}

export function templateSlideStructureHint(template: TemplateKey): string {
  const listTemplates: TemplateKey[] = ["mistakes", "checklist", "step_by_step", "tactical_guide", "framework"];
  const twoColumnTemplates: TemplateKey[] = ["comparison", "myth_vs_reality", "problem_solution"];
  if (listTemplates.includes(template)) {
    return "Bu tip slaytlarda 'body' alanını HER SATIRA bir madde gelecek şekilde \\n ile ayrılmış 3-5 kısa madde olarak yaz (her madde en fazla 60 karakter).";
  }
  if (twoColumnTemplates.includes(template)) {
    return "Bu tip slaytlarda 'body' alanını iki kısa paragraf olarak, aralarında BOŞ SATIR (\\n\\n) bırakarak yaz — birincisi problem/yanlış/eski durum, ikincisi çözüm/doğru/yeni durum.";
  }
  if (template === "data_insight") {
    return "Bu slaytın 'headline' alanına yalnızca gerçek, doğrulanabilir tek bir rakam/istatistik ve kısa etiketini yaz (uydurma sayı YASAK — somut bir veri yoksa genel bir ilke/oran cümlesi kullan), 'body' alanına kısa açıklama yaz.";
  }
  return "Bu slaytın 'body' alanını tek, akıcı bir paragraf olarak yaz.";
}
