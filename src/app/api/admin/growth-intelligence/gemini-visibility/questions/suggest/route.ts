import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { callGeminiGenerate } from "@/lib/gemini-client";
import { resolveSuggestQuestionsModel } from "@/lib/gemini-visibility/model";
import { buildSuggestQuestionsPrompt, SUGGEST_QUESTIONS_RESPONSE_SCHEMA } from "@/lib/gemini-visibility/prompts";
import { DEFAULT_QUESTION_COUNT } from "@/lib/gemini-visibility/types";
import type { GeminiVisibilityProfile } from "@/lib/gemini-visibility/types";

export async function POST(request: Request) {
  const session = await requireModuleAccess("growth-intelligence");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    return NextResponse.json({ error: "Gemini API anahtarı yapılandırılmadı." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const profileId = String(body.profileId || "").trim();
  if (!profileId) return NextResponse.json({ error: "profileId zorunludur." }, { status: 400 });

  try {
    const profiles = await supabaseRest<GeminiVisibilityProfile[]>(`gemini_visibility_profiles?id=eq.${encodeURIComponent(profileId)}&select=*&limit=1`);
    const profile = profiles[0];
    if (!profile) return NextResponse.json({ error: "Profil bulunamadı." }, { status: 404 });

    const result = await callGeminiGenerate({
      model: resolveSuggestQuestionsModel(),
      instructions: "Yalnızca istenen JSON şemasıyla yanıt ver.",
      input: buildSuggestQuestionsPrompt(profile, DEFAULT_QUESTION_COUNT),
      reasoning: "low",
      maxOutputTokens: 1200,
      allowWeb: false,
      timeoutMs: 20_000,
      responseSchema: SUGGEST_QUESTIONS_RESPONSE_SCHEMA
    });

    const parsed = JSON.parse(result.text) as { questions?: Array<{ question: string; category: string }> };
    const suggestions = (parsed.questions || [])
      .filter((item) => item.question && ["discovery", "recommendation", "comparison", "trust"].includes(item.category))
      .slice(0, DEFAULT_QUESTION_COUNT);

    return NextResponse.json({ suggestions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Soru önerisi alınamadı.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
