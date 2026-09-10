import type { MediaProvider } from "./types";

/** The always-present fallback: honestly reports "not configured" rather
 * than ever fabricating a capability that doesn't exist. */
export const nullMediaProvider: MediaProvider = {
  key: "none",
  label: "Yapılandırılmadı",
  supportedContentTypes: [],
  isConfigured: () => false,
  async generate() {
    throw new Error("Hiçbir medya üretim sağlayıcısı yapılandırılmadı — MANUAL MEDIA akışına düşülüyor.");
  }
};
