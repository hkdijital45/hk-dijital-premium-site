import { NextResponse } from "next/server";
import { getSession, isCustomerPasswordChangeRequired, isCustomerRole } from "@/lib/auth";
import { getCustomerAiSettings } from "@/lib/customer-ai-settings";

export async function GET() {
  const session = await getSession();
  if (isCustomerPasswordChangeRequired(session)) return NextResponse.json({ error: "Önce geçici şifrenizi değiştirmeniz gerekiyor.", redirectTo: "/sifre-degistir" }, { status: 403 });
  if (!session || !isCustomerRole(session.role) || !session.companyId) {
    return NextResponse.json({ error: "Müşteri oturumu gerekir." }, { status: 403 });
  }

  const settings = await getCustomerAiSettings(session.companyId);
  return NextResponse.json({
    settings: {
      assistant_enabled: settings.assistant_enabled,
      real_ai_enabled: settings.real_ai_enabled,
      provider: settings.provider,
      allowed_contexts: settings.allowed_contexts,
      daily_message_limit: settings.daily_message_limit,
      welcome_message: settings.welcome_message
    }
  });
}
