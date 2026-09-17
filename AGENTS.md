<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## HK Social Autopilot operations

When the user asks to run/update/refresh HK Social Autopilot (e.g. "Social Autopilot'u güncelle", "Önümüzdeki 30 günü hazırla"), use the `social-autopilot-operator` skill at `.claude/skills/social-autopilot-operator/SKILL.md` — it has the real tool inventory, safety rules (no real Instagram publish, no quality-gate bypass, no paid AI calls unless asked), and the operational workflow.

## Instagram Intelligence planning

When the user asks to generate a real Instagram content strategy from actual account data (e.g. "Instagram Intelligence planını oluştur", "30 günlük Instagram planı oluştur"), use the `instagram-intelligence-planner` skill at `.claude/skills/instagram-intelligence-planner/SKILL.md`. This is separate from Social Autopilot: it reads HK Dijital's real, already-connected Instagram history (read-only, never publishes) and writes planning rows into İçerik Takip (`/api/admin/content-plan`) — the user posts manually and checks items off by hand.
