// Organik Büyüme Merkezi — internal-linking suggestions computed purely
// from real HK Dijital data (published articles + the canonical service
// list) — never invents URLs. Suggestions are proposals only; nothing is
// auto-inserted. Zero external imports (unit-testable, pure).

export type LinkableArticle = { id: string; title: string; slug: string; primaryTopic: string; topicClusterId: string | null };
export type LinkableService = { slug: string; label: string };

export type LinkSuggestion = {
  sourceId: string;
  sourceTitle: string;
  targetUrl: string;
  targetLabel: string;
  why: string;
  anchorContext: string;
};

function normalize(value: string) {
  return value.toLocaleLowerCase("tr").trim();
}

export function suggestInternalLinks(articles: LinkableArticle[], services: LinkableService[]): LinkSuggestion[] {
  const suggestions: LinkSuggestion[] = [];

  for (const article of articles) {
    for (const other of articles) {
      if (other.id === article.id) continue;
      const sameCluster = Boolean(article.topicClusterId) && article.topicClusterId === other.topicClusterId;
      const sharedTopicWord = Boolean(article.primaryTopic) && Boolean(other.primaryTopic) &&
        normalize(article.primaryTopic).split(/\s+/).some((w) => w.length > 3 && normalize(other.primaryTopic).includes(w));
      if (!sameCluster && !sharedTopicWord) continue;
      suggestions.push({
        sourceId: article.id,
        sourceTitle: article.title,
        targetUrl: `/blog/${other.slug}`,
        targetLabel: other.title,
        why: sameCluster ? "Aynı konu kümesinde yer alıyor." : "Birincil konu ifadesi örtüşüyor.",
        anchorContext: other.primaryTopic || other.title
      });
    }

    for (const service of services) {
      const relevant = Boolean(article.primaryTopic) && (
        normalize(article.primaryTopic).includes(normalize(service.label).split(" ")[0]) ||
        normalize(service.label).includes(normalize(article.primaryTopic).split(" ")[0] || "\u0000")
      );
      if (!relevant) continue;
      suggestions.push({
        sourceId: article.id,
        sourceTitle: article.title,
        targetUrl: `/hizmetler/${service.slug}`,
        targetLabel: service.label,
        why: "Makalenin konusu bu hizmetle doğrudan ilişkili.",
        anchorContext: service.label
      });
    }
  }

  return suggestions;
}

export type OrphanResult = { id: string; title: string; slug: string };

/** An article that no OTHER published article's suggested-target list
 * currently points at. Structural/topical heuristic, not a crawl-based
 * inbound-link count. */
export function findOrphanArticles(articles: LinkableArticle[], suggestions: LinkSuggestion[]): OrphanResult[] {
  const linkedSlugs = new Set(suggestions.map((s) => s.targetUrl.replace("/blog/", "")).filter((slug) => articles.some((a) => a.slug === slug)));
  return articles.filter((a) => !linkedSlugs.has(a.slug)).map((a) => ({ id: a.id, title: a.title, slug: a.slug }));
}
