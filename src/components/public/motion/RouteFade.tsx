"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Short, cheap route-enter transition — simplified adaptation of
 * docs/animation-reference/18-route-transition-rack-focus.md. The full
 * GSAP rack-focus technique would require wrapping every `Link` in the
 * app to intercept navigation, risking back/forward and hydration
 * regressions across a large surface. Instead this just keys the content
 * subtree by pathname: Next.js App Router already swaps this subtree on
 * navigation, so re-keying only guarantees a fresh mount (and therefore a
 * fresh run of the CSS `marketing-route-fade` keyframe in globals.css) —
 * no JS transition logic, no navigation delay, no interception of Link
 * clicks or the browser's own back/forward handling.
 */
export function RouteFade({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="marketing-route-fade">
      {children}
    </div>
  );
}
