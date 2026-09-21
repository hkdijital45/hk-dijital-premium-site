# Claude Project: "HK Dijital — SEO & GEO İçerik Stratejisti"

This document is a repository reference/backup only. The real Claude
Project already exists (exact name above) and its permanent instructions
are the source of truth — this file is not synced automatically and should
not be treated as a substitute for reading the Project itself.

## Purpose

Powers two of the Organik Büyüme Merkezi's copy/paste workflows:

- **MODE: STRATEGIST** — turns a compact monthly-context prompt (built by
  `buildMonthlyStrategyPrompt` in `src/lib/organic-growth/claude-prompts.ts`)
  into a structured JSON monthly content plan, imported via
  `POST /api/admin/organic-growth/content-plan/import`.
- **MODE: WRITER** — turns a compact per-article brief prompt (built by
  `buildArticlePrompt`) into a structured JSON article, imported via
  `POST /api/admin/organic-growth/import-article`.

Anthropic API access is never required for this workflow — the operator
copies the generated prompt, pastes it into the Claude Project in claude.ai,
and pastes the JSON result back into HK Digital Center.

## What the Project's permanent instructions should cover

(Already configured in the live Project — listed here only so this file
stays useful if the Project ever needs to be recreated.)

- HK Dijital brand context, services, target audience
- SEO and GEO (Generative Engine Optimization) principles
- Editorial standards: natural Turkish, no generic AI filler
  ("Günümüzün dijital dünyasında...", formulaic "Sonuç olarak..." endings,
  fake statistics/research/case studies/customer quotes)
- Topical authority and content-cluster thinking
- Internal linking discipline (never invent a URL)
- STRATEGIST and WRITER mode behavior, and the exact structured JSON
  response shapes below (so generated content imports cleanly)

## Why generated prompts stay compact

Every prompt built by `claude-prompts.ts` includes only dynamic,
task-specific fields (month, targets, brief content, etc.) and explicitly
tells Claude not to repeat or summarize the Project's permanent
instructions before writing. This keeps Claude Pro context usage low —
the brand context, SEO/GEO rules, and editorial standards live once, in
the Project, not on every request.

## Structured import formats

**Monthly plan** (`content-plan/import`):

```json
{"items":[{"working_title":"","primary_topic":"","search_intent":"","funnel_stage":"","target_service":"","target_geography":"","target_audience":"","pillar_or_supporting":"pillar|supporting","article_type":"","priority":"low|medium|high","rationale":"","cta_objective":"","planned_publication_date":"YYYY-MM-DD","topic_cluster":"","internal_link_targets":[]}]}
```

**Article** (`import-article`):

```json
{"title":"","slug":"","excerpt":"","content":"","meta_title":"","meta_description":"","primary_keyword":"","secondary_keywords":[],"search_intent":"","target_location":"","flagged_claims":[]}
```

Both imports validate structurally (required fields, JSON shape) before
writing anything, preview before confirming (monthly plan), and never
silently overwrite or duplicate existing content — duplicate
`working_title`s are skipped, not merged or replaced.
