import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";

const blockedWarning = "Profil bilgileri otomatik alınamadı. Ekran görüntüsü yükleyerek analiz yapabilirsiniz.";

function clean(value: unknown) {
  return String(value || "").trim();
}

function stripAt(value: string) {
  return clean(value).replace(/^@+/, "");
}

function normalizePlatform(value: unknown) {
  const platform = clean(value);
  if (platform.toLowerCase().includes("twitter") || platform.toLowerCase() === "x") return "X";
  return platform;
}

function normalizeProfileUrl(platform: string, username: string, profileUrl: string) {
  const explicitUrl = clean(profileUrl);
  if (/^https?:\/\//i.test(explicitUrl)) return { url: explicitUrl, warning: "" };
  const rawUsername = clean(username || explicitUrl);
  const name = stripAt(rawUsername);
  if (!name) return { url: "", warning: blockedWarning };

  if (platform === "Instagram") return { url: `https://www.instagram.com/${encodeURIComponent(name)}`, warning: "" };
  if (platform === "TikTok") return { url: `https://www.tiktok.com/@${encodeURIComponent(name)}`, warning: "" };
  if (platform === "X") return { url: `https://x.com/${encodeURIComponent(name)}`, warning: "" };
  if (platform === "Facebook") return { url: `https://www.facebook.com/${encodeURIComponent(name)}`, warning: "Facebook URL tahmini oluşturuldu. Doğrulamak için profili açın." };
  if (platform === "YouTube" && clean(rawUsername).startsWith("@")) return { url: `https://www.youtube.com/${encodeURIComponent(rawUsername)}`, warning: "" };
  if (platform === "YouTube") return { url: "", warning: "YouTube için kanal URL'si veya @kullanıcı adı girin." };
  if (platform === "LinkedIn") return { url: "", warning: "LinkedIn için tam şirket/profil URL'si girin." };
  return { url: "", warning: blockedWarning };
}

function decodeHtml(value: string) {
  return clean(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function absoluteUrl(value: string, base: string) {
  if (!value) return "";
  try {
    return new URL(value, base).toString();
  } catch {
    return "";
  }
}

function metaContent(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i")
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return "";
}

function linkHref(html: string, rel: string) {
  const escaped = rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<link[^>]+rel=["'][^"']*${escaped}[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*${escaped}[^"']*["'][^>]*>`, "i")
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return "";
}

function pageTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? decodeHtml(match[1].replace(/\s+/g, " ")) : "";
}

function trimPlatformSuffix(value: string) {
  return clean(value)
    .replace(/\s*[-|•]\s*Instagram.*$/i, "")
    .replace(/\s*[-|•]\s*Facebook.*$/i, "")
    .replace(/\s*[-|•]\s*TikTok.*$/i, "")
    .replace(/\s*[-|•]\s*YouTube.*$/i, "")
    .replace(/\s*[-|•]\s*LinkedIn.*$/i, "")
    .replace(/\s*[-|•]\s*X.*$/i, "");
}

export async function POST(request: Request) {
  if (
    !(await requireModuleAccess("sosyal-medya-denetimi")) &&
    !(await requireModuleAccess("ai-studio")) &&
    !(await requireModuleAccess("crm"))
  ) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const platform = normalizePlatform(body.platform);
  const username = clean(body.username);
  const normalized = normalizeProfileUrl(platform, username, clean(body.profileUrl));

  if (!normalized.url) {
    return NextResponse.json({
      success: false,
      platform,
      username,
      profileUrl: "",
      displayName: "",
      bio: "",
      profileImageUrl: "",
      website: "",
      publicTitle: "",
      publicDescription: "",
      fetchMode: "manual-url-required",
      warning: normalized.warning || blockedWarning
    });
  }

  try {
    const response = await fetch(normalized.url, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.7,en;q=0.6",
        "User-Agent": "Mozilla/5.0 (compatible; HKDijitalSocialAudit/1.0; +https://hkdijital.com)"
      }
    });

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.toLowerCase().includes("text/html")) {
      return NextResponse.json({
        success: false,
        platform,
        username,
        profileUrl: normalized.url,
        displayName: "",
        bio: "",
        profileImageUrl: "",
        website: "",
        publicTitle: "",
        publicDescription: "",
        fetchMode: "blocked-or-unavailable",
        warning: normalized.warning || blockedWarning
      });
    }

    const html = await response.text();
    const ogTitle = metaContent(html, "og:title");
    const twitterTitle = metaContent(html, "twitter:title");
    const ogDescription = metaContent(html, "og:description");
    const twitterDescription = metaContent(html, "twitter:description");
    const description = metaContent(html, "description");
    const ogImage = metaContent(html, "og:image");
    const twitterImage = metaContent(html, "twitter:image");
    const canonical = absoluteUrl(linkHref(html, "canonical"), response.url || normalized.url);
    const title = pageTitle(html);
    const publicTitle = ogTitle || twitterTitle || title;
    const publicDescription = ogDescription || twitterDescription || description;
    const profileImageUrl = absoluteUrl(ogImage || twitterImage, response.url || normalized.url);
    const success = Boolean(publicTitle || publicDescription || profileImageUrl);

    return NextResponse.json({
      success,
      platform,
      username: username || stripAt(normalized.url.split("/").filter(Boolean).pop() || ""),
      profileUrl: canonical || response.url || normalized.url,
      displayName: trimPlatformSuffix(publicTitle),
      bio: publicDescription,
      profileImageUrl,
      website: canonical || "",
      publicTitle,
      publicDescription,
      fetchMode: success ? "public-metadata" : "limited-public-metadata",
      warning: success ? normalized.warning : normalized.warning || blockedWarning
    });
  } catch {
    return NextResponse.json({
      success: false,
      platform,
      username,
      profileUrl: normalized.url,
      displayName: "",
      bio: "",
      profileImageUrl: "",
      website: "",
      publicTitle: "",
      publicDescription: "",
      fetchMode: "blocked-or-unavailable",
      warning: normalized.warning || blockedWarning
    });
  }
}
