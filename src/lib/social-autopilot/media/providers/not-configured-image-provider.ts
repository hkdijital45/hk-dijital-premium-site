// Honest stand-in — NOT a real image-generation backend. No AI image API
// (DALL-E/Stability/Midjourney/etc.) is wired into this build. This exists
// so the readiness engine and Autopilot Ayarları have a real object to
// introspect instead of silently having no entry at all, and so a future
// real implementation has an obvious place to slot in: implement
// ImageProvider for real, register it here, and isConfigured() naturally
// starts returning true once the relevant env var is set.
import type { ImageProvider, ProviderHealth } from "../types";

export const notConfiguredImageProvider: ImageProvider = {
  key: "not-configured-image",
  label: "AI Görsel Üretimi (yapılandırılmadı)",
  supportedFormats: [],
  isConfigured() {
    return false;
  },
  async healthCheck(): Promise<ProviderHealth> {
    return {
      status: "NOT_READY",
      message: "Hiçbir AI görsel üretim sağlayıcısı yapılandırılmadı. Deterministik carousel/static renderer kendi grafiklerini programatik olarak çizer, AI'dan görsel istemez."
    };
  },
  async generateImage(): Promise<never> {
    throw new Error("AI görsel üretimi yapılandırılmadı — bu sağlayıcı gerçek bir görsel üretemez.");
  }
};
