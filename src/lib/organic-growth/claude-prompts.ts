// Organik Büyüme Merkezi — compact Claude prompt builders + structured
// import parsing/validation. Every prompt targets the ALREADY-EXISTING
// Claude Project "HK Dijital — SEO & GEO İçerik Stratejisti" and
// deliberately never repeats that project's permanent instructions
// (brand context, SEO/GEO rules, editorial standards) — only dynamic,
// task-specific fields are included, and empty/non-applicable ones are
// omitted, per the context-efficiency requirement. Zero external imports
// (unit-testable under the plain node test runner without @/ resolution).

export const CLAUDE_PROJECT_NAME = "HK Dijital — SEO & GEO İçerik Stratejisti";

function line(label: string, value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text ? `${label}: ${text}` : "";
}

function block(label: string, value: string | null | undefined) {
  const text = (value || "").trim();
  return text ? `${label}:\n${text}` : "";
}

function listBlock(label: string, items: string[] | undefined) {
  const clean = (items || []).map((i) => i.trim()).filter(Boolean);
  if (!clean.length) return "";
  return `${label}:\n${clean.map((i) => `- ${i}`).join("\n")}`;
}

function joinNonEmpty(parts: string[]) {
  return parts.filter(Boolean).join("\n\n");
}

export type MonthlyStrategyPromptInput = {
  targetMonth: string;
  businessObjective?: string;
  targetServices?: string[];
  targetGeography?: string;
  targetAudience?: string;
  publishingFrequency?: string;
  currentTopicClusters?: string[];
  publishedContent?: string[];
  alreadyPlannedContent?: string[];
  knownContentGaps?: string[];
  availablePerformanceSignals?: string[];
  strategicNotes?: string;
};

export function buildMonthlyStrategyPrompt(input: MonthlyStrategyPromptInput) {
  const header = joinNonEmpty([
    "MODE: STRATEGIST",
    [
      line("TARGET MONTH", input.targetMonth),
      line("BUSINESS OBJECTIVE", input.businessObjective),
      line("TARGET SERVICES", (input.targetServices || []).join(", ")),
      line("TARGET GEOGRAPHY", input.targetGeography),
      line("TARGET AUDIENCE", input.targetAudience),
      line("PUBLISHING FREQUENCY", input.publishingFrequency)
    ].filter(Boolean).join("\n")
  ]);

  const context = joinNonEmpty([
    listBlock("CURRENT TOPIC CLUSTERS", input.currentTopicClusters),
    listBlock("PUBLISHED CONTENT", input.publishedContent),
    listBlock("ALREADY PLANNED CONTENT", input.alreadyPlannedContent),
    listBlock("KNOWN CONTENT GAPS", input.knownContentGaps),
    listBlock("AVAILABLE PERFORMANCE SIGNALS", input.availablePerformanceSignals),
    block("STRATEGIC NOTES", input.strategicNotes)
  ]);

  const task =
    "TASK:\nCreate a structured monthly organic content strategy using the permanent rules of the HK Dijital — SEO & GEO İçerik Stratejisti Claude Project.\n" +
    "Avoid duplicating existing content and search intent.\n" +
    "Return the result in the exact structured import JSON format expected by HK Digital Center (Organik Büyüme Merkezi):\n" +
    '{"items":[{"working_title":"","primary_topic":"","search_intent":"","funnel_stage":"","target_service":"","target_geography":"","target_audience":"","pillar_or_supporting":"pillar|supporting","article_type":"","priority":"low|medium|high","rationale":"","cta_objective":"","planned_publication_date":"YYYY-MM-DD","topic_cluster":"","internal_link_targets":[]}]}\n' +
    "Omit empty/non-applicable sections above.";

  return joinNonEmpty([header, context, task]);
}

export type ArticlePromptInput = {
  articleId?: string;
  planMonth?: string;
  targetPublicationDate?: string;
  articleGoal?: string;
  workingTitle: string;
  primaryTopic?: string;
  searchIntent?: string;
  targetAudience?: string;
  targetService?: string;
  targetLocation?: string;
  topicCluster?: string;
  pillarOrSupporting?: string;
  funnelStage?: string;
  whyThisArticle?: string;
  primaryQuestion?: string;
  secondaryQuestions?: string[];
  contentAngle?: string;
  mustCoverPoints?: string[];
  existingRelatedContent?: string[];
  internalLinkTargets?: string[];
  ctaObjective?: string;
  seoRequirements?: string;
  geoRequirements?: string;
  factsSources?: string;
  editorialNotes?: string;
};

export function buildArticlePrompt(input: ArticlePromptInput) {
  const header = joinNonEmpty([
    "MODE: WRITER",
    [
      line("ARTICLE ID", input.articleId),
      line("PLAN / MONTH", input.planMonth),
      line("TARGET PUBLICATION DATE", input.targetPublicationDate)
    ].filter(Boolean).join("\n")
  ]);

  const meta = [
    line("ARTICLE GOAL", input.articleGoal),
    line("WORKING TITLE", input.workingTitle),
    line("PRIMARY TOPIC / KEYWORD", input.primaryTopic),
    line("SEARCH INTENT", input.searchIntent),
    line("TARGET AUDIENCE", input.targetAudience),
    line("TARGET SERVICE", input.targetService),
    line("TARGET LOCATION", input.targetLocation),
    line("TOPIC CLUSTER", input.topicCluster),
    line("PILLAR / SUPPORTING ROLE", input.pillarOrSupporting),
    line("FUNNEL STAGE", input.funnelStage)
  ].filter(Boolean).join("\n");

  const brief = joinNonEmpty([
    block("WHY THIS ARTICLE EXISTS", input.whyThisArticle),
    block("PRIMARY QUESTION", input.primaryQuestion),
    listBlock("SECONDARY QUESTIONS", input.secondaryQuestions),
    block("CONTENT ANGLE", input.contentAngle),
    listBlock("MUST-COVER POINTS", input.mustCoverPoints),
    listBlock("EXISTING RELATED HK CONTENT", input.existingRelatedContent),
    listBlock("INTERNAL LINK TARGETS", input.internalLinkTargets),
    block("CTA OBJECTIVE", input.ctaObjective),
    block("ARTICLE-SPECIFIC SEO REQUIREMENTS", input.seoRequirements),
    block("ARTICLE-SPECIFIC GEO REQUIREMENTS", input.geoRequirements),
    block("FACTS / SOURCES / EVIDENCE", input.factsSources),
    block("EDITORIAL NOTES", input.editorialNotes)
  ]);

  const task =
    'TASK:\nUsing the permanent rules of the "HK Dijital — SEO & GEO İçerik Stratejisti" Claude Project and the brief above, write the article at near-publishable quality.\n' +
    "Do not repeat or summarize Project Instructions before writing.\n" +
    "Do not invent statistics, URLs, prices, packages, customer results, research, case studies, performance data, or evidence.\n" +
    "If a non-critical detail is missing, make the safest editorial decision and continue.\n" +
    "If a factual claim genuinely requires verification, clearly flag only that claim.\n" +
    "Return the article in the exact structured import JSON format expected by HK Organic Growth Center:\n" +
    '{"title":"","slug":"","excerpt":"","content":"","meta_title":"","meta_description":"","primary_keyword":"","secondary_keywords":[],"search_intent":"","target_location":"","flagged_claims":[]}\n' +
    "Omit empty/non-applicable sections above.";

  return joinNonEmpty([header, meta, brief, task]);
}

// --- Structured import parsing/validation -----------------------------

export type ImportedPlanItem = {
  working_title: string;
  primary_topic?: string;
  search_intent?: string;
  funnel_stage?: string;
  target_service?: string;
  target_geography?: string;
  target_audience?: string;
  pillar_or_supporting?: "pillar" | "supporting";
  article_type?: string;
  priority?: "low" | "medium" | "high";
  rationale?: string;
  cta_objective?: string;
  planned_publication_date?: string;
  topic_cluster?: string;
  internal_link_targets?: string[];
};

export type ParsedMonthlyPlanImport =
  | { valid: true; items: ImportedPlanItem[]; errors: [] }
  | { valid: false; items: []; errors: string[] };

export function parseMonthlyPlanImport(raw: string): ParsedMonthlyPlanImport {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { valid: false, items: [], errors: ["Geçerli bir JSON değil. Claude çıktısını doğrudan (açıklama eklemeden) yapıştırın."] };
  }
  const items = (data as { items?: unknown })?.items;
  if (!Array.isArray(items) || !items.length) {
    return { valid: false, items: [], errors: ['JSON içinde en az bir öğe içeren bir "items" dizisi olmalı.'] };
  }
  const errors: string[] = [];
  const clean: ImportedPlanItem[] = [];
  items.forEach((raw, index) => {
    const item = raw as Record<string, unknown>;
    const workingTitle = typeof item.working_title === "string" ? item.working_title.trim() : "";
    if (!workingTitle) {
      errors.push(`#${index + 1}: working_title zorunlu.`);
      return;
    }
    clean.push({
      working_title: workingTitle,
      primary_topic: typeof item.primary_topic === "string" ? item.primary_topic : "",
      search_intent: typeof item.search_intent === "string" ? item.search_intent : "",
      funnel_stage: typeof item.funnel_stage === "string" ? item.funnel_stage : "",
      target_service: typeof item.target_service === "string" ? item.target_service : "",
      target_geography: typeof item.target_geography === "string" ? item.target_geography : "",
      target_audience: typeof item.target_audience === "string" ? item.target_audience : "",
      pillar_or_supporting: item.pillar_or_supporting === "pillar" || item.pillar_or_supporting === "supporting" ? item.pillar_or_supporting : undefined,
      article_type: typeof item.article_type === "string" ? item.article_type : "",
      priority: item.priority === "low" || item.priority === "high" ? item.priority : "medium",
      rationale: typeof item.rationale === "string" ? item.rationale : "",
      cta_objective: typeof item.cta_objective === "string" ? item.cta_objective : "",
      planned_publication_date: typeof item.planned_publication_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.planned_publication_date) ? item.planned_publication_date : undefined,
      topic_cluster: typeof item.topic_cluster === "string" ? item.topic_cluster : "",
      internal_link_targets: Array.isArray(item.internal_link_targets) ? item.internal_link_targets.map(String) : []
    });
  });
  if (!clean.length) return { valid: false, items: [], errors };
  return { valid: true, items: clean, errors: [] };
}

export type ImportedArticle = {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  meta_title?: string;
  meta_description?: string;
  primary_keyword?: string;
  secondary_keywords?: string[];
  search_intent?: string;
  target_location?: string;
  flagged_claims?: string[];
};

export type ParsedArticleImport =
  | { valid: true; article: ImportedArticle; errors: [] }
  | { valid: false; article: null; errors: string[] };

export function parseArticleImport(raw: string): ParsedArticleImport {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { valid: false, article: null, errors: ["Geçerli bir JSON değil. Claude çıktısını doğrudan (açıklama eklemeden) yapıştırın."] };
  }
  const item = data as Record<string, unknown>;
  const title = typeof item.title === "string" ? item.title.trim() : "";
  const content = typeof item.content === "string" ? item.content.trim() : "";
  const errors: string[] = [];
  if (!title) errors.push("title zorunlu.");
  if (content.length < 120) errors.push("content en az 120 karakter olmalı.");
  if (errors.length) return { valid: false, article: null, errors };
  return {
    valid: true,
    errors: [],
    article: {
      title,
      content,
      slug: typeof item.slug === "string" ? item.slug : "",
      excerpt: typeof item.excerpt === "string" ? item.excerpt : "",
      meta_title: typeof item.meta_title === "string" ? item.meta_title : "",
      meta_description: typeof item.meta_description === "string" ? item.meta_description : "",
      primary_keyword: typeof item.primary_keyword === "string" ? item.primary_keyword : "",
      secondary_keywords: Array.isArray(item.secondary_keywords) ? item.secondary_keywords.map(String) : [],
      search_intent: typeof item.search_intent === "string" ? item.search_intent : "",
      target_location: typeof item.target_location === "string" ? item.target_location : "",
      flagged_claims: Array.isArray(item.flagged_claims) ? item.flagged_claims.map(String) : []
    }
  };
}
