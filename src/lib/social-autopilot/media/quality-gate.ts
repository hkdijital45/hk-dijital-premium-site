// Media-specific quality validation. Because the carousel/static assets
// are produced by OUR OWN deterministic renderer (not an opaque external
// model), several checks that would otherwise need image analysis are
// actually enforced by construction — dimensions, format, and safe-margin
// geometry can never be wrong because the renderer only knows how to
// produce them correctly. This gate re-verifies that construction-time
// guarantee held (defends against a future renderer bug) and scores the
// dimensions no renderer can guarantee on its own: whether text had to be
// truncated to fit, template repetition, etc.
//
// Honest limitation: content_visual_match and composition are scored via
// structural proxies (did the requested text actually get embedded, is the
// template appropriate for the slide count), not real computer-vision
// semantic judgement — no vision-capable AI provider is configured in this
// build.
import type { RenderedSlide } from "./render/carousel-renderer";
import { CAROUSEL_WIDTH, CAROUSEL_HEIGHT } from "./render/canvas-utils.ts";

export type MediaQualityCheck = { passed: boolean; score: number; detail: string };
export type MediaQualityResult = {
  passed: boolean;
  overallScore: number;
  checks: Record<string, MediaQualityCheck>;
  scores: {
    visual_quality: number; brand_consistency: number; readability: number;
    composition: number; content_visual_match: number; platform_compatibility: number;
  };
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

function checkDimensions(slides: RenderedSlide[]): MediaQualityCheck {
  const bad = slides.filter((slide) => slide.width !== CAROUSEL_WIDTH || slide.height !== CAROUSEL_HEIGHT);
  return bad.length
    ? { passed: false, score: 0, detail: `${bad.length} slayt hedef boyuttan (${CAROUSEL_WIDTH}x${CAROUSEL_HEIGHT}) farklı.` }
    : { passed: true, score: 100, detail: `Tüm slaytlar ${CAROUSEL_WIDTH}x${CAROUSEL_HEIGHT}.` };
}

function checkFormatIntegrity(slides: RenderedSlide[]): MediaQualityCheck {
  const corrupt = slides.filter((slide) => !slide.buffer.subarray(0, 3).equals(JPEG_MAGIC) || slide.buffer.length < 500);
  return corrupt.length
    ? { passed: false, score: 0, detail: `${corrupt.length} slayt geçerli bir JPEG değil veya bozuk.` }
    : { passed: true, score: 100, detail: "Tüm dosyalar geçerli JPEG." };
}

function checkFileSize(slides: RenderedSlide[]): MediaQualityCheck {
  const tooLarge = slides.filter((slide) => slide.buffer.length > MAX_IMAGE_BYTES);
  const sizes = slides.map((slide) => Math.round(slide.buffer.length / 1024));
  return tooLarge.length
    ? { passed: false, score: 0, detail: `${tooLarge.length} slayt 8MB Instagram sınırını aşıyor.` }
    : { passed: true, score: 100, detail: `Dosya boyutları: ${sizes.join(", ")} KB.` };
}

function checkTextOverflow(slides: RenderedSlide[]): MediaQualityCheck {
  const overflowing = slides.filter((slide) => slide.overflow);
  return overflowing.length
    ? { passed: false, score: 0, detail: `${overflowing.length} slaytta metin güvenli alanın dışına taştı (minimum okunabilir punto ile bile sığmadı).` }
    : { passed: true, score: 100, detail: "Hiçbir slaytta metin taşması yok." };
}

function checkReadability(slides: RenderedSlide[]): MediaQualityCheck {
  const shortened = slides.filter((slide) => slide.usedFallbackShortening).length;
  const score = Math.max(60, 100 - shortened * 15);
  return { passed: score >= 70, score, detail: shortened ? `${shortened} slaytta metin otomatik olarak kısaltıldı (yine de güvenli punto ile).` : "Metin kısaltma gerekmedi — orijinal uzunlukla sığdı." };
}

function checkComposition(slides: RenderedSlide[]): MediaQualityCheck {
  const count = slides.length;
  if (count < 2) return { passed: true, score: 90, detail: "Tek slayt (static) — kompozisyon uygulanabilir değil." };
  if (count > 10) return { passed: false, score: 40, detail: `${count} slayt Instagram'ın 10 slayt sınırını aşıyor.` };
  const score = count >= 4 && count <= 8 ? 100 : 85;
  return { passed: true, score, detail: `${count} slaytlık carousel uygun aralıkta.` };
}

function checkBrandConsistency(templateUsed: string, recentTemplatesUsed: string[]): MediaQualityCheck {
  const repeatCount = recentTemplatesUsed.filter((template) => template === templateUsed).length;
  const score = Math.max(60, 100 - repeatCount * 20);
  return {
    passed: score >= 70, score,
    detail: repeatCount ? `Şablon "${templateUsed}" son ${recentTemplatesUsed.length} içerikte ${repeatCount} kez kullanılmış — çeşitliliği azaltıyor.` : "Marka teması tutarlı şekilde uygulandı, şablon tekrarı yok."
  };
}

function checkContentEmbedded(slides: RenderedSlide[], expectedSlideCount: number): MediaQualityCheck {
  const passed = slides.length === expectedSlideCount && slides.every((slide) => slide.buffer.length > 0);
  return passed
    ? { passed: true, score: 90, detail: "Talep edilen tüm slaytların içeriği render edildi. (Not: bu yapısal bir kontroldür — görsel/anlamsal eşleşme bir görüntü modeli ile doğrulanmamıştır.)" }
    : { passed: false, score: 30, detail: "Render edilen slayt sayısı beklenenle uyuşmuyor." };
}

function checkPlatformCompatibility(dimensionsOk: boolean, formatOk: boolean, sizeOk: boolean): MediaQualityCheck {
  const passed = dimensionsOk && formatOk && sizeOk;
  return { passed, score: passed ? 100 : 0, detail: passed ? "Instagram content publishing gereksinimleriyle uyumlu." : "Instagram gereksinimlerinden en az biri karşılanmadı." };
}

export function runMediaQualityGate(params: { slides: RenderedSlide[]; expectedSlideCount: number; templateUsed: string; recentTemplatesUsed: string[] }): MediaQualityResult {
  const dimensions = checkDimensions(params.slides);
  const format = checkFormatIntegrity(params.slides);
  const fileSize = checkFileSize(params.slides);
  const overflow = checkTextOverflow(params.slides);
  const readability = checkReadability(params.slides);
  const composition = checkComposition(params.slides);
  const brandConsistency = checkBrandConsistency(params.templateUsed, params.recentTemplatesUsed);
  const contentEmbedded = checkContentEmbedded(params.slides, params.expectedSlideCount);
  const platformCompatibility = checkPlatformCompatibility(dimensions.passed, format.passed, fileSize.passed);

  const checks: Record<string, MediaQualityCheck> = {
    dimensions, format, file_size: fileSize, text_overflow: overflow, readability, composition,
    brand_consistency: brandConsistency, content_embedded: contentEmbedded, platform_compatibility: platformCompatibility
  };

  const hardGatesPassed = dimensions.passed && format.passed && fileSize.passed && overflow.passed && platformCompatibility.passed;

  const visualQuality = Math.round((format.score + fileSize.score + dimensions.score) / 3);
  const overallScore = hardGatesPassed
    ? Math.round((visualQuality * 1.2 + brandConsistency.score * 1 + readability.score * 1 + composition.score * 0.8 + contentEmbedded.score * 0.8 + platformCompatibility.score * 1.2) / 6)
    : Math.min(20, Math.round((visualQuality + readability.score) / 2 / 4));

  const passed = hardGatesPassed && overallScore >= 0 && Object.values(checks).every((check) => check.passed);

  return {
    passed,
    overallScore,
    checks,
    scores: {
      visual_quality: visualQuality, brand_consistency: brandConsistency.score, readability: readability.score,
      composition: composition.score, content_visual_match: contentEmbedded.score, platform_compatibility: platformCompatibility.score
    }
  };
}
