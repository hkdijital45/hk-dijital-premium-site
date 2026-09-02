import { supabaseRest } from "@/lib/supabase";
import { CACHE_TTL_DAYS } from "./types";
import type { GeminiVisibilityAnswer } from "./types";

// 7-day cache per (question, model) — a completed answer from any previous
// scan is reused verbatim (spec section 5) unless the caller forces a
// refresh (admin-only "Yeniden Zorla").
export async function findCachedAnswer(questionId: string, model: string): Promise<GeminiVisibilityAnswer | null> {
  const cutoff = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const rows = await supabaseRest<GeminiVisibilityAnswer[]>(
    `gemini_visibility_answers?question_id=eq.${encodeURIComponent(questionId)}&model=eq.${encodeURIComponent(model)}&status=eq.completed&created_at=gte.${encodeURIComponent(cutoff)}&select=*&order=created_at.desc&limit=1`
  );
  return rows[0] || null;
}
