import { NextResponse } from "next/server";
import { aiSettingsForProviderChoice, generateAiText } from "@/lib/ai-provider";
import { requireModuleAccess } from "@/lib/permissions";

const actionLabels = [
  "Düzeltilmesi Gerekenler",
  "30 Günlük Sosyal Medya Planı",
  "Meta Reklam Stratejisi",
  "Google Reklam Stratejisi",
  "İçerik Fikirleri",
  "Teklif Hazırlama",
  "PDF Audit Oluştur",
  "WhatsApp Teklifi Hazırla"
];

function clean(value: unknown) {
  return String(value || "").trim();
}

function calculateLeadScore(profile: any, actions: string[]) {
  const platforms = Array.isArray(profile.platforms) ? profile.platforms : [];
  const activePlatforms = platforms.filter((item: any) => clean(item.username) || clean(item.profileUrl) || clean(item.profileImageUrl));
  const screenshotCount = Array.isArray(profile.screenshots) ? profile.screenshots.length : 0;
  let score = 18;
  score += Math.min(activePlatforms.length * 10, 35);
  score += activePlatforms.filter((item: any) => clean(item.profileUrl)).length * 6;
  score += activePlatforms.filter((item: any) => clean(item.profileImageUrl)).length * 4;
  score += screenshotCount ? Math.min(screenshotCount * 4, 12) : 0;
  score += clean(profile.businessName) ? 8 : 0;
  score += clean(profile.sector) ? 6 : 0;
  score += actions.includes("Teklif Hazırlama") ? 8 : 0;
  score += actions.includes("Meta Reklam Stratejisi") || actions.includes("Google Reklam Stratejisi") ? 7 : 0;
  const normalized = Math.max(0, Math.min(100, score));
  return {
    score: normalized,
    temperature: normalized >= 80 ? "Sıcak" : normalized >= 50 ? "Ilık" : "Soğuk"
  };
}

function fallback(action: string, profile: any, leadScore: { score: number; temperature: string }) {
  const name = clean(profile.businessName) || clean(profile.platforms?.[0]?.profileUrl) || "İşletme";
  const platformList = (profile.platforms || []).map((item: any) => item.platform).join(", ") || "sosyal medya";
  const packages = "Starter 10.000 TL, Pro 15.000 TL, Premium 25.000 TL";
  return [
    `${name} için ${action} çıktısı`,
    `Lead Score: ${leadScore.score}/100 (${leadScore.temperature})`,
    `Platformlar: ${platformList}`,
    "- Profil fotoğrafı, bio, kullanıcı adı, sabit hikayeler ve CTA dönüşüm odaklı yeniden düzenlenmeli.",
    "- Güven sinyalleri, yerel görünürlük, teklif dili ve içerik tutarlılığı birlikte güçlendirilmeli.",
    "- İlk 30 günde farkındalık, güven, sosyal kanıt, teklif ve dönüşüm içerikleri dengeli planlanmalı.",
    `- Paket önerisi: ${packages}. Satış garantisi verilmez; beklenti yönetimi açık tutulmalıdır.`
  ].join("\n");
}

export async function POST(request: Request) {
  if (!(await requireModuleAccess("sosyal-medya-denetimi")) && !(await requireModuleAccess("ai-studio"))) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const platforms = Array.isArray(body.platforms) ? body.platforms.map((item: any) => ({
    platform: clean(item.platform),
    username: clean(item.username),
    profileUrl: clean(item.profileUrl),
    profileImageUrl: clean(item.profileImageUrl),
    displayName: clean(item.displayName),
    bio: clean(item.bio),
    website: clean(item.website),
    publicTitle: clean(item.publicTitle),
    publicDescription: clean(item.publicDescription),
    fetchMode: clean(item.fetchMode),
    fetchStatus: clean(item.fetchStatus),
    warning: clean(item.fetchWarning || item.warning)
  })).filter((item: any) => item.platform && (item.username || item.profileUrl || item.profileImageUrl || item.displayName || item.bio || item.publicTitle)) : [];
  const screenshots = Array.isArray(body.screenshots) ? body.screenshots.map((item: any, index: number) => ({
    name: clean(item.name) || `ekran-goruntusu-${index + 1}`,
    type: clean(item.type),
    order: Number(item.order ?? index)
  })).sort((a: any, b: any) => a.order - b.order) : [];
  const profile = {
    businessName: clean(body.businessName),
    city: clean(body.city),
    district: clean(body.district),
    sector: clean(body.sector),
    notes: clean(body.notes),
    platforms,
    screenshots
  };
  const actions = Array.isArray(body.actions) ? body.actions.filter((action: string) => actionLabels.includes(action)) : [];
  if (!profile.businessName && !profile.notes && !platforms.length && !screenshots.length) return NextResponse.json({ error: "Analiz için en az bir profil bilgisi, ekran görüntüsü veya işletme bilgisi girin." }, { status: 400 });
  if (!actions.length) return NextResponse.json({ error: "En az bir analiz aksiyonu seçin." }, { status: 400 });

  const providerChoice = clean(body.aiProvider);
  const settings = aiSettingsForProviderChoice(providerChoice);
  const leadScore = calculateLeadScore(profile, actions);
  const outputs = [];

  try {
    for (const action of actions) {
      const prompt = `HK Dijital Sosyal İstihbarat Merkezi için çıktı üret.
Türkçe yaz. İletişim bilgisi uydurma. Sadece seçili aksiyon için üretim yap.

Aksiyon: ${action}
Lead Score: ${leadScore.score}/100 (${leadScore.temperature})
Paket çıpası: Starter 10.000 TL, Pro 15.000 TL, Premium 25.000 TL

Analiz alanları:
- Profil fotoğrafı
- Bio ve kullanıcı adı kalitesi
- Markalaşma ve konumlandırma
- Highlight kapakları
- İçerik tutarlılığı
- Reels / kısa video fırsatları
- CTA ve dönüşüm hazırlığı
- Güven sinyalleri
- Yerel görünürlük
- Funnel hazırlığı
- Güçlü yönler, zayıf yönler, fırsatlar ve riskler

Profil ve ekran görüntüsü verileri:
${JSON.stringify(profile, null, 2)}

Profil metadata kullanımı:
- Public title, bio/aciklama, website, profil gorseli varligi, platform URL, yuklenen ekran goruntuleri ve isletme notlarini birlikte degerlendir.
- Metadata sinirli veya fetchStatus "Sinirli veri"/"Alinamadi" ise ciktida su cumleyi acikca kullan: "Bu analiz sınırlı herkese açık profil verileri ve girilen bilgilerle oluşturuldu."
- Profil fotoğrafı yoksa fotoğraf varmış gibi davranma; iletişim bilgisi, takipçi sayısı, telefon veya e-posta uydurma.

Çıktıyı profesyonel ajans dilinde, uygulanabilir maddelerle, beklenti yönetimini koruyarak yaz.`;
      const generated = await generateAiText(prompt, fallback(action, profile, leadScore), settings);
      outputs.push({ action, text: generated.text, ai: generated });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: message.includes("Seçilen AI sağlayıcısı") ? message : "AI sağlayıcısı kullanılamadı. API ayarlarını kontrol edin." }, { status: 503 });
  }

  return NextResponse.json({ ok: true, profile, outputs, leadScore });
}
