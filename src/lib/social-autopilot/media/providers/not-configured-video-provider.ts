// Honest stand-in — there is NO deterministic Reel video compositor and no
// AI video-generation backend in this build. This was investigated, not
// skipped: no system ffmpeg binary and no Remotion/canvas-frame-to-video
// pipeline exists in this environment, so a real scene-by-scene Reel
// render (the same "programmatic layout, not an AI image model" approach
// used for carousels) was judged not implementable this phase without
// adding a real video-encoding dependency that isn't actually present.
// Reel content therefore always routes to publication_status
// "needs_media" (see media/pipeline.ts) rather than silently pretending to
// be FULL AUTO capable.
import type { VideoProvider, ProviderHealth } from "../types";

export const notConfiguredVideoProvider: VideoProvider = {
  key: "not-configured-video",
  label: "Reel Video Render (yapılandırılmadı)",
  supportedFormats: [],
  isConfigured() {
    return false;
  },
  async healthCheck(): Promise<ProviderHealth> {
    return {
      status: "NOT_READY",
      message: "Bu ortamda gerçek bir video render/kompozisyon motoru (ffmpeg, Remotion vb.) yoktur ve hiçbir AI video üretim sağlayıcısı yapılandırılmadı. Reel içerikleri her zaman NEEDS_MEDIA olarak işaretlenir — asla FULL AUTO olarak etiketlenmez."
    };
  },
  async renderVideo(): Promise<never> {
    throw new Error("Video render sağlayıcısı yapılandırılmadı — bu sağlayıcı gerçek bir video üretemez.");
  }
};
