// Font registration for the deterministic renderer. Uses the OFFICIAL,
// unsubsetted Inter static TTFs (bundled under assets/fonts/, SIL Open Font
// License — see assets/fonts/INTER-LICENSE.txt), not a Google-Fonts-style
// subset build. This was a deliberate, verified choice: the subset .woff2
// files distributed by @fontsource/inter split "latin" and "latin-ext" per
// Google's unicode-range groupings, and testing found the Turkish letters
// Ş/ş, Ğ/ğ and İ specifically missing from that particular subset split.
// The full upstream TTF has complete coverage. Registered once per process
// via a module-level singleton guard.
import { GlobalFonts } from "@napi-rs/canvas";
import path from "node:path";

export const FONT_FAMILY_REGULAR = "HKSocialAutopilotInterRegular";
export const FONT_FAMILY_MEDIUM = "HKSocialAutopilotInterMedium";
export const FONT_FAMILY_SEMIBOLD = "HKSocialAutopilotInterSemiBold";
export const FONT_FAMILY_BOLD = "HKSocialAutopilotInterBold";
export const FONT_FAMILY_EXTRABOLD = "HKSocialAutopilotInterExtraBold";
export const FONT_FAMILY_BLACK = "HKSocialAutopilotInterBlack";

const FONT_FILES: Array<{ file: string; family: string }> = [
  { file: "Inter-Regular.ttf", family: FONT_FAMILY_REGULAR },
  { file: "Inter-Medium.ttf", family: FONT_FAMILY_MEDIUM },
  { file: "Inter-SemiBold.ttf", family: FONT_FAMILY_SEMIBOLD },
  { file: "Inter-Bold.ttf", family: FONT_FAMILY_BOLD },
  { file: "Inter-ExtraBold.ttf", family: FONT_FAMILY_EXTRABOLD },
  { file: "Inter-Black.ttf", family: FONT_FAMILY_BLACK }
];

let registered = false;
let registrationError: string | null = null;

/** Idempotent — safe to call before every render. Returns false (with the
 * reason recorded) if a font file is missing, so callers/readiness checks
 * can report NOT_READY honestly instead of rendering with a wrong fallback
 * font. */
export function ensureFontsRegistered(): { ok: boolean; error: string | null } {
  if (registered) return { ok: true, error: null };
  try {
    const fontsDir = path.join(process.cwd(), "assets", "fonts");
    for (const { file, family } of FONT_FILES) {
      const fullPath = path.join(fontsDir, file);
      const ok = GlobalFonts.registerFromPath(fullPath, family);
      if (!ok) throw new Error(`Font dosyası kaydedilemedi: ${file}`);
    }
    registered = true;
    return { ok: true, error: null };
  } catch (error) {
    registrationError = error instanceof Error ? error.message : "Font kaydı başarısız oldu.";
    return { ok: false, error: registrationError };
  }
}

export function fontRegistrationStatus() {
  return { registered, error: registrationError };
}
