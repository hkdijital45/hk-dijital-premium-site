import { NextResponse } from "next/server";
import { generateAiText } from "@/lib/ai-provider";
import { requireModuleAccess } from "@/lib/permissions";

const actionLabels = [
  "Düzeltilmesi Gerekenler",
  "30 Günlük Sosyal Medya Planı",
  "Meta Reklam Stratejisi",
  "Google Reklam Stratejisi",
  "İçerik Fikirleri",
  "Teklif Hazırlama"
];

function clean(value: unknown) {
  return String(value || "").trim();
}

function fallback(action: string, profile: any) {
  const name = clean(profile.businessName) || clean(profile.profileUrl) || "İşletme";
  return [
    `${name} için ${action} çıktısı`,
    "- Profil açıklaması, teklif dili ve iletişim çağrısı netleştirilmeli.",
    "- İlk 30 gün içinde güven, sosyal kanıt, teklif ve dönüşüm odaklı içerikler dengeli planlanmalı.",
    "- Reklam tarafında satış garantisi verilmeden mesaj, trafik, yeniden pazarlama ve dönüşüm akışları ayrı düşünülmeli.",
    "- Ölçümleme haftalık kontrol edilmeli; iyi çalışan içerikler reklam kreatifine dönüştürülmeli."
  ].join("\n");
}

export async function POST(request: Request) {
  if (!(await requireModuleAccess("sosyal-medya-denetimi")) && !(await requireModuleAccess("ai-studio"))) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const profile = {
    platform: clean(body.platform || "Instagram"),
    profileUrl: clean(body.profileUrl),
    businessName: clean(body.businessName),
    city: clean(body.city),
    district: clean(body.district),
    sector: clean(body.sector),
    notes: clean(body.notes)
  };
  const actions = Array.isArray(body.actions) ? body.actions.filter((action: string) => actionLabels.includes(action)) : [];
  if (!profile.profileUrl && !profile.businessName) return NextResponse.json({ error: "Profil linki veya işletme adı girin." }, { status: 400 });
  if (!actions.length) return NextResponse.json({ error: "En az bir analiz aksiyonu seçin." }, { status: 400 });

  const outputs = [];
  for (const action of actions) {
    const prompt = `HK Dijital admin paneli için sosyal medya denetimi üret.
Türkçe yaz. Profil bilgileri gerçek veri kabul edilerek değerlendirilir, iletişim bilgisi uydurma.
Aksiyon: ${action}

Profil:
${JSON.stringify(profile)}

Çıktıyı net başlıklar, kısa maddeler ve uygulanabilir adımlar halinde yaz.`;
    const generated = await generateAiText(prompt, fallback(action, profile));
    outputs.push({ action, text: generated.text, ai: generated });
  }

  return NextResponse.json({ ok: true, profile, outputs });
}
