import { NextResponse } from "next/server";
import { getProfileByAuthUserId, updatePasswordWithAccessToken } from "@/lib/auth";
import { validateNewPassword } from "@/lib/password-policy";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { HIDDEN_ACCESS_COOKIE, HIDDEN_ACCESS_SESSION_TTL_SECONDS, extractClientIp, grantCourtesyHiddenAccessSession } from "@/lib/hidden-access";

export async function POST(request: Request) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  }

  const { accessToken, password, passwordConfirm } = await request.json().catch(() => ({}));
  const token = String(accessToken || "").trim();
  const nextPassword = String(password || "").slice(0, 129);
  const confirmation = String(passwordConfirm || "").slice(0, 129);

  if (!token) {
    return NextResponse.json({ error: "Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş." }, { status: 400 });
  }

  const validationError = validateNewPassword(nextPassword, confirmation);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  try {
    const authUser = await updatePasswordWithAccessToken(token, nextPassword);
    const profile = await getProfileByAuthUserId(authUser.id);
    if (profile?.id) {
      await supabaseRest(`users?id=eq.${encodeURIComponent(profile.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ must_change_password: false, updated_at: new Date().toISOString() })
      });
    }
    const response = NextResponse.json({
      ok: true,
      message: "Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz."
    });
    // Without this, the ResetPasswordForm's hardcoded redirect to
    // /digital-center immediately hits the Secret Access Control Center
    // gate (proxy.ts) and bounces this just-verified user to the homepage
    // with no way to know the hidden keyboard trigger — see
    // grantCourtesyHiddenAccessSession's own comment for the full rationale.
    const hiddenAccessToken = await grantCourtesyHiddenAccessSession({
      triggerMethod: "password_reset",
      authenticatedUserId: profile?.id || null,
      ipAddress: extractClientIp(request.headers),
      userAgent: request.headers.get("user-agent") || ""
    });
    if (hiddenAccessToken) {
      response.cookies.set(HIDDEN_ACCESS_COOKIE, hiddenAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: HIDDEN_ACCESS_SESSION_TTL_SECONDS
      });
    }
    return response;
  } catch {
    return NextResponse.json(
      { error: "Şifre güncellenemedi. Bağlantının süresini kontrol edip tekrar deneyin." },
      { status: 500 }
    );
  }
}
