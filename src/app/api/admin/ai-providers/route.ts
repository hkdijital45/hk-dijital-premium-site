import { NextResponse } from "next/server";
import { unifiedAiProviderOptions } from "@/lib/ai-provider-options";
import { requireModuleAccess } from "@/lib/permissions";

function statusFor(option: (typeof unifiedAiProviderOptions)[number]) {
  if (option.key === "auto") return { status: "Aktif", missingEnv: [], maskedKey: "Otomatik" };
  if (option.key === "demo") return { status: "Demo", missingEnv: [], maskedKey: "Gerektirmez" };
  const missingEnv = option.env.filter((key) => !process.env[key]);
  if (option.key === "manus" && missingEnv.includes("MANUS_API_ENDPOINT")) return { status: "Eksik endpoint", missingEnv, maskedKey: missingEnv.length ? "Eksik" : "Tanımlı" };
  if (option.key === "ollama") return { status: missingEnv.length ? "Yerel yapılandırılmadı" : "Yerel", missingEnv, maskedKey: missingEnv.length ? "Eksik" : "Tanımlı" };
  return { status: missingEnv.length ? "Yapılandırılmadı" : "Aktif", missingEnv, maskedKey: missingEnv.length ? "Eksik" : "Tanımlı" };
}

export async function GET() {
  const session = await requireModuleAccess("ai-studio")
    || await requireModuleAccess("agent-hub")
    || await requireModuleAccess("google-analiz")
    || await requireModuleAccess("meta-analiz")
    || await requireModuleAccess("sosyal-medya-denetimi")
    || await requireModuleAccess("raporlar");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  return NextResponse.json({
    providers: unifiedAiProviderOptions.map((option) => ({
      key: option.key,
      label: option.label,
      description: option.description,
      recommendedFor: option.recommendedFor,
      isRecommended: option.key === "auto",
      ...statusFor(option)
    }))
  });
}
