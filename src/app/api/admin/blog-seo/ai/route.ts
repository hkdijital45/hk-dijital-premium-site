import { NextResponse } from "next/server";
import { normalizeContentPlanItem } from "@/lib/blog-content-ops";
import { blogCategories, slugifyBlogValue } from "@/lib/blog-seo-shared";
import { requireModuleAccess } from "@/lib/permissions";
import { servicePages } from "@/lib/public-seo-content";
import { executeAiTask } from "@/lib/server/ai-router";

const actions = new Set(["topic_suggestions", "generate_draft", "improve_draft", "weekly_plan", "social_package", "update_plan"]);
const intents = new Set(["Bilgilendirici", "Ticari araştırma", "Hizmet arama", "Yerel arama", "Karşılaştırma", "Sorun çözme"]);
const contentTypes = new Set(["Rehber", "Hizmet açıklaması", "Kontrol listesi", "Karşılaştırma", "Sık sorulan sorular", "Yerel SEO yazısı", "Vaka odaklı içerik"]);
const tones = new Set(["Profesyonel", "Açıklayıcı", "Güven veren", "Sade", "Satış odaklı fakat abartısız"]);
const lengths = new Set(["Kısa: 700–900 kelime", "Standart: 1000–1400 kelime", "Derin rehber: 1600–2200 kelime"]);

function clean(value: unknown, max = 800) {
  return String(value || "").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/[\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanList(value: unknown, maxItems = 20, maxLength = 120) {
  return Array.isArray(value) ? value.map((item) => clean(item, maxLength)).filter(Boolean).slice(0, maxItems) : [];
}

function safeEnum(value: unknown, allowed: Set<string>, fallback: string) {
  const text = clean(value, 80);
  return allowed.has(text) ? text : fallback;
}

function parseJsonObject(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const source = fenced || text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (!source || !source.trim().startsWith("{")) throw new Error("AI yanıtı yapılandırılmış JSON formatında değil.");
  return JSON.parse(source) as Record<string, unknown>;
}

function uniqueSlug(base: string, existingSlugs: string[]) {
  const root = slugifyBlogValue(base) || "blog-yazisi";
  const existing = new Set(existingSlugs.map((item) => slugifyBlogValue(item)));
  if (!existing.has(root)) return root;
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${root}-${index}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

function normalizeDraft(raw: Record<string, unknown>, existingSlugs: string[]) {
  const title = clean(raw.title, 140);
  const content = String(raw.content || "").trim().slice(0, 40_000);
  if (title.length < 8 || content.length < 500) throw new Error("AI taslağı eksik döndü. Başlık veya içerik yeterli değil.");
  return {
    title,
    slug: uniqueSlug(clean(raw.slug, 120) || title, existingSlugs),
    excerpt: clean(raw.summary || raw.excerpt, 500),
    content,
    status: "draft",
    category: clean(raw.category, 100),
    primaryKeyword: clean(raw.primaryKeyword || raw.primary_keyword, 120),
    secondaryKeywords: cleanList(raw.secondaryKeywords || raw.secondary_keywords, 8, 80),
    metaTitle: clean(raw.metaTitle || raw.meta_title || title, 80),
    metaDescription: clean(raw.metaDescription || raw.meta_description || raw.summary, 220),
    searchIntent: clean(raw.searchIntent || raw.search_intent, 120),
    readingTime: Number(raw.readingTime || raw.reading_time || 0) || null,
    suggestedInternalLinks: Array.isArray(raw.suggestedInternalLinks) ? raw.suggestedInternalLinks : [],
    suggestedFaq: Array.isArray(raw.suggestedFaq) ? raw.suggestedFaq : [],
    qualityNotes: cleanList(raw.qualityNotes || raw.quality_notes, 8, 180)
  };
}

function contextFromBody(body: Record<string, unknown>) {
  return {
    service: clean(body.service, 120),
    keyword: clean(body.keyword, 140),
    location: clean(body.location, 80) || "Manisa",
    audience: clean(body.audience, 160),
    intent: safeEnum(body.intent, intents, "Yerel arama"),
    contentType: safeEnum(body.contentType, contentTypes, "Rehber"),
    tone: safeEnum(body.tone, tones, "Profesyonel"),
    length: safeEnum(body.length, lengths, "Standart: 1000–1400 kelime"),
    notes: clean(body.notes, 800),
    existingTitles: cleanList(body.existingTitles, 80, 160),
    existingSlugs: cleanList(body.existingSlugs, 80, 120),
    currentDraft: typeof body.currentDraft === "object" && body.currentDraft ? body.currentDraft as Record<string, unknown> : {}
  };
}

function buildPrompt(action: string, body: Record<string, unknown>) {
  const ctx = contextFromBody(body);
  const services = servicePages.map((service) => ({
    label: service.eyebrow,
    href: `/hizmetler/${service.slug}`,
    description: service.description
  }));
  const categories = blogCategories.map((category) => category.name);
  const sharedRules = [
    "Türkçe yaz.",
    "Sahte istatistik, sahte kaynak, sıralama garantisi veya satış garantisi verme.",
    "Anahtar kelime doldurma yapma.",
    "Yalnız verilen doğrulanmış iç bağlantı URL'lerini öner.",
    "Admin onayı olmadan yayınlanacak içerik üretme; status her zaman draft olsun.",
    "Cevabı yalnız geçerli JSON object olarak döndür."
  ];

  if (action === "topic_suggestions") {
    return JSON.stringify({
      task: "Blog konu önerisi üret",
      rules: sharedRules,
      context: ctx,
      availableServices: services,
      categories,
      outputShape: {
        suggestions: [{
          title: "string",
          primaryKeyword: "string",
          secondaryKeywords: ["string"],
          searchIntent: "string",
          targetAudience: "string",
          category: "string",
          angle: "string",
          suggestedServiceLink: "/hizmetler/...",
          estimatedValue: "string",
          duplicateRisk: "Düşük | Orta | Yüksek"
        }]
      },
      limit: 8
    }, null, 2);
  }

  if (action === "weekly_plan") {
    return JSON.stringify({
      task: "Haftalık blog içerik planı üret",
      rules: [
        ...sharedRules,
        "Tek AI çağrısıyla plan öğeleri üret.",
        "Benzer başlık, slug veya anahtar kelime kümeleri üretme.",
        "Otomatik yayın önerme; tüm öğeler planlandı veya taslak hazırlığı durumunda kalsın.",
        "Google Trends, Search Console veya rakip verisi yoksa kaynak etiketi olarak kullanma.",
        "Cevabı yalnız geçerli JSON object olarak döndür; markdown kullanma."
      ],
      context: {
        ...ctx,
        planName: clean(body.planName, 160),
        objective: clean(body.objective, 200),
        weeklyCount: Number(body.weeklyCount || 2),
        startDate: clean(body.startDate, 40),
        endDate: clean(body.endDate, 40),
        preferredDays: cleanList(body.preferredDays, 7, 20),
        preferredTime: clean(body.preferredTime, 20),
        excludedKeywords: cleanList(body.excludedKeywords, 20, 80),
        competitorNotes: clean(body.competitorNotes, 1000),
        searchConsoleSignals: Array.isArray(body.searchConsoleSignals) ? body.searchConsoleSignals : [],
        trendSignals: Array.isArray(body.trendSignals) ? body.trendSignals : []
      },
      existingTitles: ctx.existingTitles,
      existingSlugs: ctx.existingSlugs,
      outputShape: {
        items: [{
          title: "string",
          slug: "string",
          primaryKeyword: "string",
          secondaryKeywords: ["string"],
          searchIntent: "string",
          targetAudience: "string",
          contentType: "string",
          scheduledAt: "ISO datetime or null",
          priority: "Yüksek | Orta | Düşük",
          rationale: "string",
          sourceSignals: ["Manual brief", "Mevcut içerik boşluğu", "Rakip", "Mevsimsel"]
        }]
      }
    }, null, 2);
  }

  if (action === "social_package") {
    return JSON.stringify({
      task: "Blog yazısını sosyal medya içerik paketine dönüştür",
      rules: [
        ...sharedRules,
        "Tek çağrıda Instagram, LinkedIn, Facebook ve X taslaklarını üret.",
        "Paylaşılmış gibi davranma; yalnız düzenlenebilir taslak üret.",
        "Sahte sonuç, garanti, müşteri verisi veya abartılı başarı iddiası yazma.",
        "Hashtag doldurma yapma; yalnız ilgili ve sınırlı öner.",
        "Cevabı yalnız geçerli JSON object olarak döndür."
      ],
      blog: {
        title: clean(body.title, 180),
        excerpt: clean(body.excerpt, 600),
        content: clean(body.content, 6000),
        url: clean(body.url, 240)
      },
      outputShape: {
        instagram: { shortCaption: "string", longCaption: "string", carouselSlides: ["string"], reelsCaption: "string", cta: "string", hashtags: ["string"] },
        linkedin: { professionalPost: "string", shortPost: "string", expertOpinion: "string", cta: "string" },
        facebook: { informativePost: "string", shortPromo: "string", cta: "string" },
        x: { singlePost: "string", thread: ["string"], headlineOptions: ["string"] }
      }
    }, null, 2);
  }

  if (action === "update_plan") {
    return JSON.stringify({
      task: "Mevcut blog yazısı için güncelleme planı üret",
      rules: [
        ...sharedRules,
        "Kayıtlı içeriği değiştirme; yalnız öneri ve uygulanabilir plan üret.",
        "Trafik veya gelir garantisi verme.",
        "Verilmeyen Search Console veya Analytics metriğini uydurma.",
        "Cevabı yalnız geçerli JSON object olarak döndür."
      ],
      blog: {
        title: clean(body.title, 180),
        metaTitle: clean(body.metaTitle, 120),
        metaDescription: clean(body.metaDescription, 240),
        primaryKeyword: clean(body.primaryKeyword, 120),
        content: clean(body.content, 7000)
      },
      deterministicFindings: Array.isArray(body.findings) ? body.findings : [],
      outputShape: {
        summary: "string",
        priority: "Yüksek | Orta | Düşük",
        recommendedChanges: ["string"],
        newSections: ["string"],
        titleOptions: ["string"],
        metaDescriptionOptions: ["string"],
        internalLinkIdeas: ["string"],
        risks: ["string"]
      }
    }, null, 2);
  }

  if (action === "improve_draft") {
    return JSON.stringify({
      task: "Mevcut blog taslağı için uygulanabilir geliştirme önerisi üret",
      rules: sharedRules,
      context: ctx,
      availableServices: services,
      outputShape: {
        improvedTitle: "string",
        improvedMetaTitle: "string",
        improvedMetaDescription: "string",
        improvedExcerpt: "string",
        improvedContent: "markdown string",
        changeSummary: ["string"],
        qualityNotes: ["string"]
      }
    }, null, 2);
  }

  return JSON.stringify({
    task: "SEO destekli blog taslağı üret",
    rules: [
      ...sharedRules,
      "İçerikte tek H1 başlığı kullanma; H1 form title alanıdır. Markdown içerikte H2/H3 kullan.",
      "Giriş bölümü arama niyetine doğrudan cevap versin.",
      "Kısa paragraflar ve gerektiğinde listeler kullan.",
      "Son bölümde abartısız CTA ver."
    ],
    context: ctx,
    availableServices: services,
    categories,
    outputShape: {
      title: "string",
      slug: "string",
      summary: "string",
      content: "markdown string",
      status: "draft",
      category: "string",
      primaryKeyword: "string",
      secondaryKeywords: ["string"],
      metaTitle: "string",
      metaDescription: "string",
      searchIntent: "string",
      readingTime: 0,
      suggestedInternalLinks: [{ label: "string", href: "/hizmetler/..." }],
      suggestedFaq: [{ question: "string", answer: "string" }],
      qualityNotes: ["string"]
    }
  }, null, 2);
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("blog-seo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = clean(body.action, 40);
  if (!actions.has(action)) return NextResponse.json({ error: "Geçersiz AI işlemi" }, { status: 400 });

  const ctx = contextFromBody(body);
    if (!["improve_draft", "social_package", "update_plan"].includes(action) && !ctx.keyword && !ctx.service) {
    return NextResponse.json({ error: "Hedef hizmet veya ana konu girin." }, { status: 400 });
  }
  if (action === "improve_draft" && !clean(ctx.currentDraft.content, 20_000)) {
    return NextResponse.json({ error: "Geliştirilecek taslak içeriği bulunamadı." }, { status: 400 });
  }

  try {
    const generated = await executeAiTask({
      taskType: "seo_analysis",
      module: "Blog & SEO Merkezi",
      endpoint: "/api/admin/blog-seo/ai",
      prompt: buildPrompt(action, body),
      expectedOutput: "Geçerli JSON object",
      fallbackText: "",
      createdBy: session.profileId || null
    }, {
      requestedProvider: "auto",
      cacheTtlMs: 3 * 60_000
    });

    if (generated.provider === "demo" || !generated.text.trim()) {
      return NextResponse.json({ error: "Canlı AI sağlayıcısı yapılandırılmamış veya yanıt vermedi." }, { status: 503 });
    }

    const parsed = parseJsonObject(generated.text);
    if (action === "topic_suggestions") {
      const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 8) : [];
      if (!suggestions.length) throw new Error("AI konu önerisi döndürmedi.");
      return NextResponse.json({ ok: true, action, suggestions, ai: generated });
    }
    if (action === "weekly_plan") {
      const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
      const existingSlugs = ctx.existingSlugs;
      const items = rawItems.slice(0, 24).map((item, index) => normalizeContentPlanItem(item as Record<string, unknown>, existingSlugs, index));
      if (!items.length) throw new Error("AI içerik planı öğesi döndürmedi.");
      return NextResponse.json({ ok: true, action, items, ai: generated });
    }
    if (action === "improve_draft") {
      return NextResponse.json({ ok: true, action, improvement: parsed, ai: generated });
    }
    if (action === "social_package") {
      return NextResponse.json({ ok: true, action, socialPackage: parsed, ai: generated });
    }
    if (action === "update_plan") {
      return NextResponse.json({ ok: true, action, updatePlan: parsed, ai: generated });
    }
    return NextResponse.json({ ok: true, action, draft: normalizeDraft(parsed, ctx.existingSlugs), ai: generated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI içerik işlemi tamamlanamadı." }, { status: 502 });
  }
}
