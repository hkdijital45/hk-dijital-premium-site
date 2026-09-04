import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { executeAiTask } from "@/lib/server/ai-router";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { requireModuleAccess } from "@/lib/permissions";
import { getSiteContent } from "@/lib/content";
import { checkOperationalCustomer } from "@/lib/server/customer-visibility";
import { normalizeDigitalVisibilityReport } from "@/lib/digital-visibility-report";

const reportTypes = ["Meta Reklam Raporu", "Google Ads Raporu", "Sosyal Medya Yönetimi Raporu", "Genel Dijital Performans Raporu"];
const discoveryReportTypes = {
  swot_report: { label: "AI SWOT Raporu", taskType: "market_research" },
  digital_audit: { label: "AI Dijital Analiz Raporu", taskType: "seo_analysis" },
  presentation: { label: "AI Sunum Taslağı", taskType: "proposal" },
  competitor_analysis: { label: "Rakip Analizi", taskType: "competitor_research" },
  discovery_report: { label: "Müşteri Keşif Raporu", taskType: "market_research" }
} as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DiscoveryReportKind = keyof typeof discoveryReportTypes;

function cleanText(value: unknown, maxLength = 500) {
  return String(value || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeBusiness(raw: Record<string, unknown>) {
  return {
    name: cleanText(raw.name || raw.company, 180),
    category: cleanText(raw.category || raw.business_type, 120),
    city: cleanText(raw.city, 100),
    district: cleanText(raw.district, 100),
    address: cleanText(raw.address, 300),
    phone: cleanText(raw.phone, 60),
    website: cleanText(raw.website, 300),
    instagram: cleanText(raw.instagram || raw.instagram_url, 200),
    googleRating: numberOrNull(raw.googleRating ?? raw.google_rating),
    reviewCount: numberOrNull(raw.reviewCount ?? raw.google_review_count),
    opportunityScore: numberOrNull(raw.opportunityScore ?? raw.leadHeatScore ?? raw.lead_heat_score),
    digitalMaturityScore: numberOrNull(raw.digitalMaturityScore ?? raw.digital_maturity_score),
    digitalGapScore: numberOrNull(raw.digitalGapScore),
    adPotentialScore: numberOrNull(raw.adPotentialScore),
    crmStatus: cleanText(raw.crmStatus || raw.status, 80),
    tags: Array.isArray(raw.tags) ? raw.tags.map((item) => cleanText(item, 60)).filter(Boolean).slice(0, 12) : [],
    searchKeyword: cleanText(raw.searchKeyword || raw.keyword, 120),
    placeId: cleanText(raw.placeId || raw.google_place_id || raw.id, 180)
  };
}

function sectionTitles(kind: DiscoveryReportKind) {
  if (kind === "swot_report") return ["Güçlü Yönler", "Zayıf Yönler", "Fırsatlar", "Tehditler", "Önerilen İlk 3 Aksiyon"];
  if (kind === "digital_audit") return ["Güçlü Yönler", "Geliştirilmesi Gerekenler", "Fırsatlar", "Önerilen Aksiyonlar"];
  if (kind === "competitor_analysis") return ["Rekabet Özeti", "Görünürlük Karşılaştırması", "Rakip Avantajları", "Fırsat Alanları", "Önerilen Rekabet Aksiyonları"];
  if (kind === "discovery_report") return ["İşletme Profili", "Keşif Verileri", "Dijital Hazırlık", "Satış Fırsatı", "Önerilen İlk Temas", "Sonraki Adımlar"];
  return ["İşletme Özeti", "Mevcut Durum", "Fırsat Alanları", "Önerilen Hizmetler", "Beklenen Kazanımlar", "İlk 30 Gün Planı", "Sonraki Adım"];
}

function scoreLabel(score: number | null) {
  if (score === null) return null;
  if (score >= 80) return "Güçlü";
  if (score >= 60) return "Gelişime Açık";
  if (score >= 40) return "Temel İyileştirme Gerekli";
  return "Öncelikli Müdahale Gerekli";
}

function localFallback(kind: DiscoveryReportKind, business: ReturnType<typeof normalizeBusiness>) {
  const unavailable = "Bu alan için yeterli veri yok.";
  const facts = {
    "Güçlü Yönler": [business.googleRating ? `Google puanı ${business.googleRating}.` : unavailable, business.reviewCount ? `${business.reviewCount} Google yorumu bulunuyor.` : unavailable],
    "Zayıf Yönler": [business.website ? "Web sitesi dönüşüm ve ölçümleme açısından ayrıca incelenmeli." : "Web sitesi bulunamadı.", business.instagram ? "Sosyal medya içerik düzeni ayrıca incelenmeli." : "Instagram bağlantısı bulunamadı."],
    "Geliştirilmesi Gerekenler": [business.website ? "Web sitesinde dönüşüm takibi ve reklam iniş sayfası yapısı doğrulanmalı." : "Web sitesi mevcut veride görünmüyor.", business.instagram ? "Sosyal medya içerik düzeni ve reklam uyumu ayrıca incelenmeli." : "Instagram bağlantısı mevcut veride görünmüyor."],
    "Fırsatlar": ["Yerel görünürlük ve yorum yönetimi değerlendirilebilir.", "Ölçülebilir reklam ve iletişim akışı planlanabilir."],
    "Tehditler": ["Bölgedeki daha yüksek yorum hacmine sahip rakipler görünürlük avantajı sağlayabilir."],
    "Önerilen İlk 3 Aksiyon": ["İşletme bilgilerini doğrula.", "Dijital varlıkları ayrıntılı incele.", "Ölçülebilir bir ilk temas planı hazırla."],
    "Önerilen Aksiyonlar": ["İşletme bilgilerini doğrula.", "Web sitesi, Google Maps ve sosyal medya varlığını ayrı ayrı kontrol et.", "Ölçülebilir ilk temas ve takip planı hazırla."],
    "Dijital Görünürlük Özeti": [`Fırsat skoru: ${business.opportunityScore ?? "veri yok"}/100.`],
    "Web Sitesi Durumu": [business.website ? `Web sitesi mevcut: ${business.website}` : "Web sitesi bulunamadı."],
    "Google Maps Durumu": [business.googleRating ? `Google puanı ${business.googleRating}; yorum sayısı ${business.reviewCount ?? "veri yok"}.` : unavailable],
    "Yorum ve İtibar": [business.reviewCount !== null ? `${business.reviewCount} yorum üzerinden itibar çalışması değerlendirilebilir.` : unavailable],
    "Sosyal Medya Varlığı": [business.instagram ? `Instagram bağlantısı mevcut: ${business.instagram}` : "Instagram bağlantısı bulunamadı."],
    "Reklam Potansiyeli": [`Reklam potansiyeli: ${business.adPotentialScore ?? "veri yok"}/100.`],
    "Öncelikli Eksikler": [business.website ? "Dönüşüm takibi doğrulanmalı." : "Web sitesi veya açılış sayfası ihtiyacı değerlendirilmeli."],
    "30 Günlük Öneri": ["İlk hafta doğrulama, ikinci hafta teklif/test planı, üçüncü hafta optimizasyon, dördüncü hafta raporlama yapılmalı."],
    "İşletme Özeti": [`${business.name}, ${business.category || "sektör bilgisi bulunmayan"} bir işletme olarak değerlendirildi.`],
    "Mevcut Durum": [`Google puanı ${business.googleRating ?? "veri yok"}; yorum sayısı ${business.reviewCount ?? "veri yok"}.`],
    "Fırsat Alanları": ["Google görünürlüğü, yorum yönetimi ve ölçülebilir reklam akışı."],
    "Önerilen Hizmetler": ["Dijital durum doğrulaması sonrasında uygun hizmet kapsamı belirlenmeli."],
    "Beklenen Kazanımlar": ["Daha ölçülebilir görünürlük ve düzenli optimizasyon altyapısı."],
    "İlk 30 Gün Planı": ["Kurulum ve doğrulama", "İlk test", "Veri okuma ve optimizasyon", "Raporlama ve sonraki karar"],
    "Sonraki Adım": ["İşletme yetkilisiyle kısa ihtiyaç görüşmesi planla."],
    "Rekabet Özeti": ["Rakip listesi ve karşılaştırmalı görünürlük verisi ayrıca doğrulanmalıdır."],
    "Görünürlük Karşılaştırması": [`İşletmenin Google puanı ${business.googleRating ?? "veri yok"}; yorum sayısı ${business.reviewCount ?? "veri yok"}.`],
    "Rakip Avantajları": ["Bu alan için doğrulanmış rakip verisi bulunamadı."],
    "Önerilen Rekabet Aksiyonları": ["Aynı bölge ve kategorideki rakipleri doğrula.", "Yorum hacmi ve dijital varlıkları karşılaştır.", "Ölçülebilir bir farklılaşma teklifi hazırla."],
    "İşletme Profili": [`${business.name}; ${business.category || "kategori bilgisi bulunamadı"}, ${[business.district, business.city].filter(Boolean).join(" / ") || "konum bilgisi bulunamadı"}.`],
    "Keşif Verileri": [`Google puanı ${business.googleRating ?? "veri yok"}; yorum sayısı ${business.reviewCount ?? "veri yok"}; fırsat skoru ${business.opportunityScore ?? "veri yok"}.`],
    "Dijital Hazırlık": [business.website ? "Web sitesi mevcut; dönüşüm ve ölçümleme ayrıca doğrulanmalı." : "Web sitesi bulunamadı."],
    "Satış Fırsatı": ["İlk temas öncesinde ihtiyaç, bütçe ve mevcut reklam yapısı doğrulanmalıdır."],
    "Önerilen İlk Temas": ["Kısa bir dijital fırsat özetiyle iletişim kur ve ihtiyaç görüşmesi öner."],
    "Sonraki Adımlar": ["İletişim bilgisini doğrula.", "CRM kaydını tamamla.", "Uygun hizmet kapsamını ve takip görevini belirle."]
  } as Record<string, string[]>;
  return {
    summary: `${business.name} için yalnız mevcut Google Maps ve dijital varlık verileriyle hazırlanmış değerlendirme.`,
    sections: sectionTitles(kind).map((title) => ({ title, items: facts[title] || [unavailable] })),
    ...(kind === "digital_audit" && business.opportunityScore !== null ? { score: business.opportunityScore, scoreLabel: scoreLabel(business.opportunityScore) } : {})
  };
}

function parseAiReport(text: string, kind: DiscoveryReportKind, fallback: ReturnType<typeof localFallback>) {
  if (kind === "digital_audit") {
    const normalized = normalizeDigitalVisibilityReport(text);
    const sections = normalized.sections.length ? normalized.sections : fallback.sections;
    return {
      summary: normalized.summary || fallback.summary,
      sections,
      score: normalized.score ?? fallback.score ?? null,
      scoreLabel: normalized.scoreLabel || fallback.scoreLabel || null
    };
  }

  const candidate = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(candidate) as { summary?: unknown; sections?: Array<{ title?: unknown; items?: unknown }> };
    const sections = Array.isArray(parsed.sections)
      ? parsed.sections.map((section) => ({
        title: cleanText(section.title, 120),
        items: Array.isArray(section.items) ? section.items.map((item) => cleanText(item, 800)).filter(Boolean).slice(0, 12) : []
      })).filter((section) => section.title && section.items.length)
      : [];
    if (sections.length) return { summary: cleanText(parsed.summary, 1_500) || fallback.summary, sections };
  } catch {}
  const content = cleanText(text, 12_000);
  if (!content) throw new Error("AI sağlayıcısı boş rapor döndürdü.");
  return { summary: fallback.summary, sections: [{ title: sectionTitles(kind)[0], items: [content] }] };
}

async function generateDiscoveryReport(body: Record<string, unknown>) {
  const kind = cleanText(body.reportKind, 40) as DiscoveryReportKind;
  const config = discoveryReportTypes[kind];
  if (!config) return NextResponse.json({ error: "Geçerli bir rapor türü seçin." }, { status: 400 });
  const session = await requireModuleAccess("musteri-bulucu");
  if (!session) return NextResponse.json({ error: "Bu işlem için müşteri keşfi yetkisi gerekir." }, { status: 403 });

  const business = normalizeBusiness((body.business || {}) as Record<string, unknown>);
  if (!business.name) return NextResponse.json({ error: "Seçili işletme bilgisi bulunamadı." }, { status: 400 });
  if (body.companyId) {
    const customerCheck = await checkOperationalCustomer(body.companyId);
    if (!customerCheck.ok) return NextResponse.json({ error: customerCheck.error }, { status: customerCheck.status });
  }
  const sourceIdentifier = business.placeId || cleanText(`${business.name}-${business.city}-${business.district}`.toLocaleLowerCase("tr-TR"), 180);
  const fallback = localFallback(kind, business);
  const analysisContext = cleanText(JSON.stringify(body.analysisContext || {}), 4_000);
  const prompt = [
    `Rapor türü: ${config.label}`,
    `İşletme verisi: ${JSON.stringify(business)}`,
    analysisContext && `Doğrulanmış ek analiz bağlamı: ${analysisContext}`,
    kind === "digital_audit"
      ? "Zorunlu bölüm başlıkları: Güçlü Yönler | Geliştirilmesi Gerekenler | Fırsatlar | Önerilen Aksiyonlar"
      : `Zorunlu bölüm başlıkları: ${sectionTitles(kind).join(" | ")}`,
    "Yalnız verilen verileri kullan. Eksik bilgiyi uydurma; 'Bu alan için yeterli veri yok' de.",
    "Kesin satış veya performans garantisi verme.",
    kind === "digital_audit"
      ? [
        "Yalnızca geçerli JSON döndür. Markdown code fence kullanma. JSON'u string içine gömme. Ek açıklama yazma.",
        "sections ve items alanlarını string olarak değil array/object olarak döndür.",
        "Doğal ve profesyonel Türkçe kullan. İşletme adını her cümlede tekrar etme. Robotik ve gereksiz uzun cümle kurma.",
        "Bir paragraf en fazla 3 cümle olsun. Her madde tek fikir içersin. Aynı bilgiyi farklı başlıklarda tekrar etme.",
        "Veride olmayan sosyal medya hesabı, reklam hesabı veya teknik altyapı hakkında kesin iddia kurma.",
        "Bilinmeyen konularda 'tespit edilemedi' veya 'mevcut veride görünmüyor' gibi temkinli ifade kullan.",
        "Google Maps puanı, yorum sayısı, telefon, web sitesi ve sosyal medya bilgilerini yalnız gerçekten input verisinde varsa kullan.",
        business.opportunityScore !== null
          ? `Skor alanını mevcut fırsat skoruyla aynı döndür: ${business.opportunityScore}. scoreLabel kısa ve doğal Türkçe olsun.`
          : "score alanını null döndür; rastgele skor üretme.",
        "JSON kontratı: {\"summary\":\"İşletmenin dijital görünürlüğünü en fazla 3 kısa ve doğal Türkçe cümleyle değerlendir.\",\"score\":67,\"scoreLabel\":\"Gelişime Açık\",\"sections\":[{\"title\":\"Güçlü Yönler\",\"summary\":\"En fazla 2 kısa cümle.\",\"items\":[\"Tek fikir içeren kısa ve anlaşılır madde\"]},{\"title\":\"Geliştirilmesi Gerekenler\",\"summary\":\"En fazla 2 kısa cümle.\",\"items\":[\"Tek fikir içeren kısa ve anlaşılır madde\"]},{\"title\":\"Fırsatlar\",\"summary\":\"En fazla 2 kısa cümle.\",\"items\":[\"Tek fikir içeren kısa ve anlaşılır madde\"]},{\"title\":\"Önerilen Aksiyonlar\",\"summary\":\"En fazla 2 kısa cümle.\",\"items\":[\"Öncelik sırasına göre uygulanabilir kısa madde\"]}]}"
      ].join("\n")
      : "Yalnız şu JSON biçiminde Türkçe yanıt ver: {\"summary\":\"...\",\"sections\":[{\"title\":\"...\",\"items\":[\"...\"]}]}"
  ].filter(Boolean).join("\n");
  const ai = await executeAiTask({
    taskType: config.taskType,
    module: "google_maps_discovery",
    endpoint: "/api/admin/reports",
    prompt,
    expectedOutput: "Yapılandırılmış keşif raporu JSON çıktısı",
    fallbackText: JSON.stringify(fallback),
    customerId: uuidPattern.test(String(body.companyId || "")) ? String(body.companyId) : null,
    createdBy: session.profileId || null
  }, { cacheTtlMs: 10 * 60_000 });

  if (ai.provider === "demo") {
    const content = await getSiteContent();
    const demoMode = String(content.settings.api?.ai_mode || "").toLocaleLowerCase("tr-TR") === "demo";
    if (!demoMode) {
      return NextResponse.json({ error: "AI sağlayıcısı yapılandırılmamış veya yanıt vermedi. AI ayarlarını kontrol edip tekrar deneyin." }, { status: 503 });
    }
  }

  const normalized = parseAiReport(ai.text, kind, fallback);
  const now = new Date().toISOString();
  const companyId = uuidPattern.test(String(body.companyId || "")) ? String(body.companyId) : null;
  const leadId = uuidPattern.test(String(body.leadId || "")) ? String(body.leadId) : null;
  const payload = {
    company_id: companyId,
    lead_id: leadId,
    title: `${business.name} – ${config.label.replace(/^AI /, "")}`,
    report_type: config.label,
    platform: "Google Maps",
    period: new Date().toLocaleDateString("tr-TR"),
    content: normalized,
    raw_extracted_data: business,
    customer_note: normalized.summary,
    ai_interpretation: ai.text,
    visible_to_customer: false,
    archived: false,
    status: "Hazır",
    source_identifier: sourceIdentifier,
    business_name: business.name,
    source_module: "google_maps_discovery",
    created_by: session.profileId || null,
    metadata: {
      report_kind: kind,
      provider: ai.provider,
      provider_label: ai.providerLabel,
      model: ai.model,
      fallback_used: ai.fallbackUsed,
      provider_notice: ai.notice,
      search_context: body.searchContext || {}
    },
    updated_at: now
  };

  const existing = await supabaseRest<Array<{ id: string }>>(
    `reports?source_module=eq.google_maps_discovery&source_identifier=eq.${encodeURIComponent(sourceIdentifier)}&report_type=eq.${encodeURIComponent(config.label)}&deleted_at=is.null&select=id&limit=1`
  ).catch(() => []);
  const rows = existing[0]?.id
    ? await supabaseRest<any[]>(`reports?id=eq.${encodeURIComponent(existing[0].id)}`, { method: "PATCH", body: JSON.stringify(payload) })
    : await supabaseRest<any[]>("reports", { method: "POST", body: JSON.stringify({ ...payload, created_at: now }) });
  const report = rows[0];
  if (!report?.id) throw new Error("Rapor oluşturuldu ancak veritabanına kaydedilemedi.");

  await recordActivity({
    session,
    action: existing[0]?.id ? "Güncelleme" : "Oluşturma",
    entity: "Keşif Raporu",
    entityId: report.id,
    companyId,
    details: { message: `${payload.title} kaydedildi`, report_type: config.label, source_module: "google_maps_discovery" }
  });
  return NextResponse.json({
    ok: true,
    report,
    content: normalized,
    ai: { provider: ai.providerLabel, model: ai.model, fallbackUsed: ai.fallbackUsed, notice: ai.notice },
    message: existing[0]?.id ? "Rapor yeniden oluşturuldu ve Rapor Merkezi’nde güncellendi." : "Rapor oluşturuldu ve Rapor Merkezi’ne kaydedildi."
  });
}

async function linkDiscoveryReports(body: Record<string, unknown>) {
  const session = await requireModuleAccess("musteri-bulucu");
  if (!session) return NextResponse.json({ error: "Bu işlem için müşteri keşfi yetkisi gerekir." }, { status: 403 });
  const sourceIdentifier = cleanText(body.sourceIdentifier, 180);
  const leadId = String(body.leadId || "");
  const companyId = String(body.companyId || "");
  if (!sourceIdentifier || !uuidPattern.test(leadId)) return NextResponse.json({ error: "Raporları bağlamak için geçerli işletme ve lead bilgisi gerekir." }, { status: 400 });
  const patch = {
    lead_id: leadId,
    ...(uuidPattern.test(companyId) ? { company_id: companyId } : {}),
    updated_at: new Date().toISOString()
  };
  const rows = await supabaseRest<any[]>(
    `reports?source_module=eq.google_maps_discovery&source_identifier=eq.${encodeURIComponent(sourceIdentifier)}&deleted_at=is.null`,
    { method: "PATCH", body: JSON.stringify(patch) }
  );
  return NextResponse.json({ ok: true, linkedCount: rows.length, reports: rows });
}

function normalize(body: any) {
  if (!body.company_id) throw new Error("Zorunlu alan eksik: Firma seçin.");
  if (!reportTypes.includes(body.report_type)) throw new Error("Zorunlu alan eksik: Rapor türü seçin.");
  return {
    company_id: body.company_id,
    campaign_id: body.campaign_id || null,
    report_type: body.report_type,
    platform: body.platform || null,
    period: body.period || null,
    start_date: body.start_date || null,
    end_date: body.end_date || null,
    metrics: body.metrics || {},
    time_series: body.time_series || [],
    raw_extracted_data: body.raw_extracted_data || {},
    internal_note: body.internal_note || null,
    customer_note: body.customer_note || null,
    visible_to_customer: body.visible_to_customer ?? true,
    archived: body.archived ?? false,
    updated_at: new Date().toISOString()
  };
}

async function staffSession() {
  return requireModuleAccess("raporlar");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Geçerli rapor verisi gönderin." }, { status: 400 });
  if (body.action === "generate_discovery_report") {
    try {
      return await generateDiscoveryReport(body);
    } catch (error) {
      const safe = getSafeSupabaseError(error);
      console.error("Keşif raporu oluşturma hatası:", safe.detail);
      const message = safe.detail.includes("kaydedilemedi")
        ? "Rapor oluşturuldu ancak kaydedilemedi. Migration ve Supabase bağlantısını kontrol edin."
        : "Rapor üretilemedi. AI sağlayıcısı yanıt vermedi veya kayıt işlemi tamamlanamadı.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
  if (body.action === "link_discovery_reports") {
    try {
      return await linkDiscoveryReports(body);
    } catch (error) {
      const safe = getSafeSupabaseError(error);
      console.error("Keşif raporu CRM bağlantı hatası:", safe.detail);
      return NextResponse.json({ error: "CRM kaydı oluşturuldu ancak mevcut keşif raporları lead kaydına bağlanamadı." }, { status: 500 });
    }
  }
  const session = await staffSession();
  if (!session) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  try {
    const payload = normalize(body);
    const customerCheck = await checkOperationalCustomer(payload.company_id);
    if (!customerCheck.ok) return NextResponse.json({ error: customerCheck.error }, { status: customerCheck.status });
    const periodFilter = payload.period ? `period=eq.${encodeURIComponent(payload.period)}` : `start_date=eq.${encodeURIComponent(payload.start_date || "")}&end_date=eq.${encodeURIComponent(payload.end_date || "")}`;
    const existing = await supabaseRest<any[]>(`reports?company_id=eq.${encodeURIComponent(payload.company_id)}&report_type=eq.${encodeURIComponent(payload.report_type)}&${periodFilter}&or=(archived.eq.false,archived.is.null)&select=*&limit=1`).catch(() => []);
    if (existing[0]) return NextResponse.json({ ok: true, report: existing[0], duplicatePrevented: true, message: "Aynı dönem ve türde rapor zaten kayıtlı." });
    const rows = await supabaseRest<any[]>("reports", { method: "POST", body: JSON.stringify(payload) });
    await recordActivity({ session, action: "Oluşturma", entity: "Rapor", entityId: rows[0]?.id, companyId: rows[0]?.company_id, details: { message: "Yeni rapor oluşturuldu", report_type: rows[0]?.report_type } });
    return NextResponse.json({ ok: true, report: rows[0], message: "Rapor başarıyla kaydedildi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    console.error("Rapor oluşturma hatası:", safe.detail);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}

// Discovery/SWOT/competitor-analysis reports (see generateDiscoveryReport
// below) are deliberately created with company_id = null so a lead without
// a customer record yet can still get a report. normalize() above requires
// company_id (correct for real ad-performance reports), so a company-less
// report needs its own narrow, whitelisted partial-update path instead —
// otherwise archiving/editing one would always fail with "Firma seçin."
const discoveryPatchFields = ["title", "content", "status", "archived", "archived_at", "visible_to_customer", "customer_note"] as const;

function normalizeDiscoveryPatch(body: any) {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of discoveryPatchFields) {
    if (field in body) patch[field] = body[field];
  }
  return patch;
}

export async function PATCH(request: Request) {
  const session = await staffSession();
  if (!session) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: "Rapor bulunamadı." }, { status: 404 });
    const existing = await supabaseRest<any[]>(`reports?id=eq.${encodeURIComponent(body.id)}&select=id,company_id,report_type&limit=1`);
    if (!existing[0]) return NextResponse.json({ error: "Rapor bulunamadı." }, { status: 404 });
    const patch = existing[0].company_id ? normalize({ ...existing[0], ...body }) : normalizeDiscoveryPatch(body);
    const rows = await supabaseRest<any[]>(`reports?id=eq.${encodeURIComponent(body.id)}`, { method: "PATCH", body: JSON.stringify(patch) });
    await recordActivity({ session, action: "Güncelleme", entity: "Rapor", entityId: rows[0]?.id, companyId: rows[0]?.company_id, details: { message: "Rapor güncellendi", report_type: rows[0]?.report_type } });
    return NextResponse.json({ ok: true, report: rows[0], message: "Rapor başarıyla güncellendi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    console.error("Rapor güncelleme hatası:", safe.detail);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await staffSession();
  if (!session) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  try {
    const { id } = await request.json();
    const rows = await supabaseRest<any[]>(`reports?id=eq.${encodeURIComponent(id)}&select=*`);
    if (!rows[0]) return NextResponse.json({ error: "Rapor bulunamadı." }, { status: 404 });
    await supabaseRest(`reports?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    await recordActivity({ session, action: "Silme", entity: "Rapor", entityId: id, companyId: rows[0].company_id, details: { message: "Rapor silindi", report_type: rows[0].report_type } });
    return NextResponse.json({ ok: true, message: "Rapor silindi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    console.error("Rapor silme hatası:", safe.detail);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}
