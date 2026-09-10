// Honest stand-in — no text-to-speech backend (ElevenLabs/OpenAI TTS/etc.)
// is wired into this build.
import type { VoiceProvider, ProviderHealth } from "../types";

export const notConfiguredVoiceProvider: VoiceProvider = {
  key: "not-configured-voice",
  label: "Seslendirme (yapılandırılmadı)",
  supportedLanguages: [],
  isConfigured() {
    return false;
  },
  async healthCheck(): Promise<ProviderHealth> {
    return {
      status: "NOT_READY",
      message: "Hiçbir seslendirme (text-to-speech) sağlayıcısı yapılandırılmadı. Reel'lerin gerçek bir seslendirmesi bu derlemede üretilemez."
    };
  },
  async synthesize(): Promise<never> {
    throw new Error("Seslendirme sağlayıcısı yapılandırılmadı — bu sağlayıcı gerçek bir ses dosyası üretemez.");
  }
};
