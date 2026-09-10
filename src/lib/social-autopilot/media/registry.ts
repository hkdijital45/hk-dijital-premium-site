// Media-provider registry — the ONE place a media-generation backend gets
// plugged in. The deterministic carousel/static renderer is registered
// first and is genuinely operational (zero external dependency — it's this
// app's own code). Video/voice/image AI backends are NOT registered here
// because none is configured (see providers/ for the honest not-configured
// stand-ins used by the readiness engine instead).
//
// To add a real AI-backed provider later:
//   1. Create providers/<name>.ts implementing MediaProvider (see types.ts)
//      — isConfigured() must check a real env var, supportedContentTypes
//      must list only formats it can actually finish, generate() must make
//      a real API call and return real hosted URLs.
//   2. Add it to PROVIDERS below, before nullMediaProvider.
// Nothing else changes — content-generator.ts, publish-queue.ts, and every
// API route only ever call resolveMediaProviderFor()/isAutoMediaAvailableFor().
import { nullMediaProvider } from "./null-provider.ts";
import { deterministicRendererProvider } from "./providers/deterministic-renderer-provider.ts";
import type { MediaProvider } from "./types";
import type { ContentType } from "../types";

const PROVIDERS: MediaProvider[] = [
  deterministicRendererProvider,
  // Real AI-backed providers (image/voice/video) get pushed here as they're implemented.
  nullMediaProvider
];

function realProviders() {
  return PROVIDERS.filter((provider) => provider.key !== "none");
}

/** Content-type-aware: a provider only counts if it both reports configured
 * AND lists this exact content type as something it can finish end-to-end.
 * This is what keeps a Reel from being silently handed to the carousel
 * renderer (or any future provider that doesn't actually support video). */
export function isAutoMediaAvailableFor(contentType: ContentType): boolean {
  return realProviders().some((provider) => provider.isConfigured() && provider.supportedContentTypes.includes(contentType));
}

export function resolveMediaProviderFor(contentType: ContentType): MediaProvider {
  return realProviders().find((provider) => provider.isConfigured() && provider.supportedContentTypes.includes(contentType)) || nullMediaProvider;
}

/** Content-type-agnostic "is ANY auto media capability available at all" —
 * used only where the caller doesn't yet know which content type it's
 * asking about. Prefer the *For() variants above wherever the content type
 * is known. */
export function isAutoMediaAvailable(): boolean {
  return realProviders().some((provider) => provider.isConfigured());
}

export function resolveMediaProvider(): MediaProvider {
  return realProviders().find((provider) => provider.isConfigured()) || nullMediaProvider;
}

export function listMediaProviders() {
  return PROVIDERS.map((provider) => ({
    key: provider.key, label: provider.label, configured: provider.key !== "none" && provider.isConfigured(),
    supportedContentTypes: provider.supportedContentTypes
  }));
}
