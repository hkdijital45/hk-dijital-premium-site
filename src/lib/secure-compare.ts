import { timingSafeEqual } from "crypto";

// Shared constant-time string comparison for privileged secrets (bootstrap
// tokens, cron/webhook secrets, signed session/OAuth-state signatures).
// Node's timingSafeEqual throws on unequal-length buffers, so callers must
// never compare raw lengths first with a fast-path `!==` — that alone leaks
// timing information proportional to a prefix match. This helper handles
// the length check safely and never throws for absent/malformed input.
export function safeCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
