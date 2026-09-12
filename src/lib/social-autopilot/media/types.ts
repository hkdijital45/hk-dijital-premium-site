import type { ContentType, CreativeBrief, FunnelStage, ReadinessStatus } from "../types";

export type MediaGenerationRequest = {
  contentItemId: string;
  contentType: ContentType;
  creativeBrief: CreativeBrief;
  title: string;
  hook: string;
  caption: string;
  cta: string;
  funnelStage: FunnelStage;
  contentPillar: string;
  brandName: string;
  // Carousel only — the template already chosen (and already told to the AI
  // when the copy was written, see content-generator.ts) so the renderer
  // never picks a different one than what the copy was actually shaped for.
  preselectedTemplate?: string;
};

export type MediaGenerationResult = {
  provider: string;
  assetUrls: string[];
  templateUsed?: string;
  mediaQualityScore?: number;
  mediaQualityScores?: Record<string, number>;
  assetMetadata?: Array<{ width: number; height: number; sizeBytes: number; slideIndex: number }>;
};

/** Every media-generation backend (image, video, avatar, whatever comes
 * next) implements this one interface. The publishing pipeline only ever
 * talks to this interface — plugging in a real provider later means adding
 * one new file that implements it and registering it in registry.ts, never
 * touching content-generator.ts, publish-queue.ts, or the API routes. */
export interface MediaProvider {
  key: string;
  label: string;
  /** Which content types this provider can actually finish end-to-end.
   * The registry only offers a provider for a given item's content_type if
   * it's listed here — this is what keeps a Reel from being silently
   * handed to a provider that only knows how to render carousels. */
  supportedContentTypes: ContentType[];
  /** Must reflect real configuration (an API key present, a renderer whose
   * fonts loaded, etc) — never hardcode true. This is exactly the check
   * that keeps AUTO MEDIA from being claimed when nothing is actually
   * wired up. */
  isConfigured(): boolean;
  generate(request: MediaGenerationRequest): Promise<MediaGenerationResult>;
}

// External AI backends (a real HTTP API call, a real cost, a real
// dependency to configure) for the pieces the deterministic renderer
// cannot do on its own. None have a real implementation in this build (see
// the honest not-configured-* stand-ins in providers/) — registering a real
// one later means adding a file that implements the relevant interface.
export type ProviderHealth = { status: ReadinessStatus; message: string };

export interface ImageProvider {
  key: string;
  label: string;
  supportedFormats: string[];
  isConfigured(): boolean;
  healthCheck(): Promise<ProviderHealth>;
  generateImage(prompt: string): Promise<{ url: string; width: number; height: number }>;
}

export interface VoiceProvider {
  key: string;
  label: string;
  supportedLanguages: string[];
  isConfigured(): boolean;
  healthCheck(): Promise<ProviderHealth>;
  synthesize(script: string, options?: { voiceId?: string }): Promise<{ url: string; durationSeconds: number; timingMarks?: Array<{ word: string; startMs: number; endMs: number }> }>;
}

export interface AudioProvider {
  key: string;
  label: string;
  isConfigured(): boolean;
  healthCheck(): Promise<ProviderHealth>;
  getRoyaltyFreeTrack(mood: string): Promise<{ url: string; durationSeconds: number; license: string }>;
}

export interface VideoProvider {
  key: string;
  label: string;
  supportedFormats: string[];
  isConfigured(): boolean;
  healthCheck(): Promise<ProviderHealth>;
  renderVideo(request: { scenes: unknown[]; voiceoverUrl?: string; audioUrl?: string }): Promise<{ url: string; durationSeconds: number; width: number; height: number }>;
}

/** The deterministic-rendering side (carousel/static today) — distinct
 * from MediaProvider only in that a MediaRenderer never needs isConfigured()
 * to check an external API key, only that its own assets (fonts, theme)
 * loaded correctly. */
export interface MediaRenderer {
  key: string;
  supportedContentTypes: ContentType[];
  isReady(): { ok: boolean; error: string | null };
}
