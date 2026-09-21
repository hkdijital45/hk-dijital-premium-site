import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import type { ContentPlanItem, MonthlyStrategy, TopicCluster } from "@/lib/organic-growth/types";

export { getSafeSupabaseError };

const STRATEGY_FIELDS = "id,month,business_objective,target_services,target_geography,target_audience,publishing_frequency,strategic_notes,status,created_by,created_at,updated_at";
const ITEM_FIELDS = "id,strategy_id,topic_cluster_id,blog_post_id,planned_publication_date,working_title,primary_topic,search_intent,funnel_stage,target_service,target_geography,target_audience,pillar_or_supporting,article_type,priority,rationale,cta_objective,internal_link_targets,status,why_this_article,primary_question,secondary_questions,related_concepts,must_cover_points,existing_related_content,content_angle,seo_requirements,geo_requirements,facts_sources,editorial_notes,claude_prompt_cache,created_by,created_at,updated_at";
const CLUSTER_FIELDS = "id,name,slug,description,target_service,search_intents,geography,pillar_article_id,created_at,updated_at";

export async function listMonthlyStrategies(limit = 24) {
  return supabaseRest<MonthlyStrategy[]>(`organic_monthly_strategies?select=${STRATEGY_FIELDS}&order=month.desc&limit=${limit}`);
}

export async function getMonthlyStrategy(id: string) {
  const rows = await supabaseRest<MonthlyStrategy[]>(`organic_monthly_strategies?select=${STRATEGY_FIELDS}&id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows[0] || null;
}

export async function getMonthlyStrategyByMonth(month: string) {
  const rows = await supabaseRest<MonthlyStrategy[]>(`organic_monthly_strategies?select=${STRATEGY_FIELDS}&month=eq.${encodeURIComponent(month)}&limit=1`);
  return rows[0] || null;
}

export async function createMonthlyStrategy(payload: Partial<MonthlyStrategy>) {
  const rows = await supabaseRest<MonthlyStrategy[]>(`organic_monthly_strategies?select=${STRATEGY_FIELDS}`, { method: "POST", body: JSON.stringify(payload) });
  return rows[0];
}

export async function updateMonthlyStrategy(id: string, payload: Partial<MonthlyStrategy>) {
  const rows = await supabaseRest<MonthlyStrategy[]>(`organic_monthly_strategies?id=eq.${encodeURIComponent(id)}&select=${STRATEGY_FIELDS}`, { method: "PATCH", body: JSON.stringify(payload) });
  return rows[0] || null;
}

export async function deleteMonthlyStrategy(id: string) {
  await supabaseRest(`organic_monthly_strategies?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function listContentPlanItems(filters: { strategyId?: string; status?: string; topicClusterId?: string } = {}, limit = 500) {
  const parts = [`select=${ITEM_FIELDS}`, "order=planned_publication_date.asc.nullslast", `limit=${limit}`];
  if (filters.strategyId) parts.push(`strategy_id=eq.${encodeURIComponent(filters.strategyId)}`);
  if (filters.status) parts.push(`status=eq.${encodeURIComponent(filters.status)}`);
  if (filters.topicClusterId) parts.push(`topic_cluster_id=eq.${encodeURIComponent(filters.topicClusterId)}`);
  return supabaseRest<ContentPlanItem[]>(`organic_content_plan_items?${parts.join("&")}`);
}

export async function getContentPlanItem(id: string) {
  const rows = await supabaseRest<ContentPlanItem[]>(`organic_content_plan_items?select=${ITEM_FIELDS}&id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows[0] || null;
}

export async function createContentPlanItem(payload: Partial<ContentPlanItem>) {
  const rows = await supabaseRest<ContentPlanItem[]>(`organic_content_plan_items?select=${ITEM_FIELDS}`, { method: "POST", body: JSON.stringify(payload) });
  return rows[0];
}

export async function updateContentPlanItem(id: string, payload: Partial<ContentPlanItem>) {
  const rows = await supabaseRest<ContentPlanItem[]>(`organic_content_plan_items?id=eq.${encodeURIComponent(id)}&select=${ITEM_FIELDS}`, { method: "PATCH", body: JSON.stringify(payload) });
  return rows[0] || null;
}

export async function deleteContentPlanItem(id: string) {
  await supabaseRest(`organic_content_plan_items?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function listTopicClusters(limit = 100) {
  return supabaseRest<TopicCluster[]>(`topic_clusters?select=${CLUSTER_FIELDS}&order=name.asc&limit=${limit}`);
}

export async function getTopicCluster(id: string) {
  const rows = await supabaseRest<TopicCluster[]>(`topic_clusters?select=${CLUSTER_FIELDS}&id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows[0] || null;
}

export async function createTopicCluster(payload: Partial<TopicCluster>) {
  const rows = await supabaseRest<TopicCluster[]>(`topic_clusters?select=${CLUSTER_FIELDS}`, { method: "POST", body: JSON.stringify(payload) });
  return rows[0];
}

export async function updateTopicCluster(id: string, payload: Partial<TopicCluster>) {
  const rows = await supabaseRest<TopicCluster[]>(`topic_clusters?id=eq.${encodeURIComponent(id)}&select=${CLUSTER_FIELDS}`, { method: "PATCH", body: JSON.stringify(payload) });
  return rows[0] || null;
}

export async function deleteTopicCluster(id: string) {
  await supabaseRest(`topic_clusters?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}
