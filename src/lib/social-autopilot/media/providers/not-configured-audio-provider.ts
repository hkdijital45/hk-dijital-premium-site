// Honest stand-in — no royalty-free/licensed music backend is wired into
// this build.
import type { AudioProvider, ProviderHealth } from "../types";

export const notConfiguredAudioProvider: AudioProvider = {
  key: "not-configured-audio",
  label: "Arka Plan Müziği (yapılandırılmadı)",
  isConfigured() {
    return false;
  },
  async healthCheck(): Promise<ProviderHealth> {
    return {
      status: "NOT_READY",
      message: "Hiçbir lisanslı müzik/ses kütüphanesi entegrasyonu yapılandırılmadı."
    };
  },
  async getRoyaltyFreeTrack(): Promise<never> {
    throw new Error("Müzik sağlayıcısı yapılandırılmadı — bu sağlayıcı gerçek bir ses parçası döndüremez.");
  }
};
