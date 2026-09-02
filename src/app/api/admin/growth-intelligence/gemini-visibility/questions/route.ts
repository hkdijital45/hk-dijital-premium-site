import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { MAX_QUESTION_COUNT } from "@/lib/gemini-visibility/types";
import type { GeminiVisibilityProfile, GeminiVisibilityQuestion, GeminiVisibilityQuestionCategory } from "@/lib/gemini-visibility/types";
import { QUESTION_CATEGORIES, validateQuestionText } from "@/lib/gemini-visibility/validation";

async function loadProfile(profileId: string): Promise<GeminiVisibilityProfile | null> {
  const rows = await supabaseRest<GeminiVisibilityProfile[]>(`gemini_visibility_profiles?id=eq.${encodeURIComponent(profileId)}&select=*&limit=1`);
  return rows[0] || null;
}

export async function GET(request: Request) {
  const session = await requireModuleAccess("growth-intelligence");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ questions: [] });

  const profileId = new URL(request.url).searchParams.get("profileId");
  if (!profileId) return NextResponse.json({ error: "profileId zorunludur." }, { status: 400 });

  try {
    const questions = await supabaseRest<GeminiVisibilityQuestion[]>(
      `gemini_visibility_questions?profile_id=eq.${encodeURIComponent(profileId)}&deleted_at=is.null&select=*&order=created_at.asc`
    );
    return NextResponse.json({ questions });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("growth-intelligence");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const profileId = String(body.profileId || "").trim();
  const questionText = String(body.questionText || "").trim();
  const category = String(body.category || "") as GeminiVisibilityQuestionCategory;
  const source = body.source === "ai_suggested" ? "ai_suggested" : "manual";
  if (!profileId) return NextResponse.json({ error: "profileId zorunludur." }, { status: 400 });
  if (!QUESTION_CATEGORIES.includes(category)) return NextResponse.json({ error: "Geçersiz soru kategorisi." }, { status: 400 });

  try {
    const profile = await loadProfile(profileId);
    if (!profile) return NextResponse.json({ error: "Profil bulunamadı." }, { status: 404 });

    const validationError = validateQuestionText(questionText, category, profile);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const existing = await supabaseRest<Array<{ id: string }>>(
      `gemini_visibility_questions?profile_id=eq.${encodeURIComponent(profileId)}&deleted_at=is.null&select=id`
    );
    if (existing.length >= MAX_QUESTION_COUNT) {
      return NextResponse.json({ error: `En fazla ${MAX_QUESTION_COUNT} soru eklenebilir.` }, { status: 400 });
    }

    const inserted = await supabaseRest<GeminiVisibilityQuestion[]>("gemini_visibility_questions", {
      method: "POST",
      body: JSON.stringify({
        profile_id: profileId, question_text: questionText, category, source,
        created_by: session.profileId || null
      })
    });
    return NextResponse.json({ question: inserted[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await requireModuleAccess("growth-intelligence");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id || "").trim();
  if (!id) return NextResponse.json({ error: "id zorunludur." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.isActive === "boolean") patch.is_active = body.isActive;

  if (typeof body.questionText === "string" || typeof body.category === "string") {
    const questions = await supabaseRest<GeminiVisibilityQuestion[]>(`gemini_visibility_questions?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    const question = questions[0];
    if (!question) return NextResponse.json({ error: "Soru bulunamadı." }, { status: 404 });
    const profile = await loadProfile(question.profile_id);
    if (!profile) return NextResponse.json({ error: "Profil bulunamadı." }, { status: 404 });

    const nextText = typeof body.questionText === "string" ? body.questionText.trim() : question.question_text;
    const nextCategory = (typeof body.category === "string" ? body.category : question.category) as GeminiVisibilityQuestionCategory;
    if (!QUESTION_CATEGORIES.includes(nextCategory)) return NextResponse.json({ error: "Geçersiz soru kategorisi." }, { status: 400 });
    const validationError = validateQuestionText(nextText, nextCategory, profile);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    patch.question_text = nextText;
    patch.category = nextCategory;
  }

  if (!Object.keys(patch).length) return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });

  try {
    const updated = await supabaseRest<GeminiVisibilityQuestion[]>(`gemini_visibility_questions?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH", body: JSON.stringify(patch)
    });
    return NextResponse.json({ question: updated[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await requireModuleAccess("growth-intelligence");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id zorunludur." }, { status: 400 });

  try {
    await supabaseRest(`gemini_visibility_questions?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH", body: JSON.stringify({ is_active: false, deleted_at: new Date().toISOString() })
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
