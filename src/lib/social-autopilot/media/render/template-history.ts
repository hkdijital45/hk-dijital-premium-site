// The DB-touching half of template selection — kept separate from
// template-selector.ts so that file can stay pure and directly unit-
// testable. Callers: content-generator.ts (chooses the template before
// writing copy) and the deterministic renderer provider (must select the
// SAME template the copy was written for — passed through as
// preselectedTemplate rather than calling this a second time).
import { supabaseRest } from "@/lib/supabase";
import { SOCIAL_WORKSPACE_ID } from "../../types";
import { BODY_TEMPLATES } from "./template-selector.ts";
import type { TemplateKey } from "./templates.ts";

export async function fetchRecentCarouselTemplates(limit = 4): Promise<TemplateKey[]> {
  const rows = await supabaseRest<Array<{ media_template_used: string | null }>>(
    `social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&media_template_used=not.is.null&content_type=eq.carousel&select=media_template_used&order=content_date.desc&limit=${limit}`
  );
  return rows.map((row) => row.media_template_used).filter((value): value is TemplateKey => Boolean(value) && BODY_TEMPLATES.includes(value as TemplateKey));
}
