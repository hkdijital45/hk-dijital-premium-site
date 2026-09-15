import type { Page } from "@playwright/test";

// A minified production React build never prints "hydration" — it prints
// "Minified React error #418" (or a small family of related numeric codes)
// and points at react.dev/errors/<code> for the real message. The
// human-readable checks this suite used before ("hydrat", "server rendered
// HTML", ...) only ever match React's *development* wording, so they were a
// blind spot against exactly what actually ships to real users: production
// React error codes. React's hydration-mismatch family (checked against the
// current React error codes list): 418 (text/attribute mismatch), 419
// (Suspense boundary mismatch during streaming), 421 (hydrating an app that
// isn't a valid child), 422 (element type mismatch), 423 (property/text
// content mismatch), 425 (text-only hydration mismatch on the client).
const HYDRATION_MINIFIED_CODES = ["418", "419", "421", "422", "423", "425"];

const HYDRATION_PATTERN = new RegExp(
  [
    "hydrat", // "hydration failed", "while hydrating", dev-mode wording
    "server rendered html",
    "server html", // "server HTML didn't match the client"
    "did not match", // "Text content did not match server-rendered HTML"
    ...HYDRATION_MINIFIED_CODES.map((code) => `#${code}\\b`)
  ].join("|"),
  "i"
);

export type HydrationWatcher = {
  /** All hydration-shaped console errors / uncaught page errors seen so far on this page. */
  getHydrationErrors: () => string[];
  /** Every captured console error / page error, hydration-shaped or not — for debugging a failure. */
  getAllErrors: () => string[];
  /** Detach the listeners (call between cold loads on a reused page, so each load's errors are attributable). */
  reset: () => void;
};

// Attach once per `page`; call reset() between navigations on a reused page
// if you want per-navigation attribution instead of a cumulative total.
export function watchForHydrationErrors(page: Page): HydrationWatcher {
  let all: string[] = [];

  const onConsole = (msg: import("@playwright/test").ConsoleMessage) => {
    if (msg.type() === "error") all.push(msg.text());
  };
  const onPageError = (err: Error) => {
    all.push(String(err.message || err));
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  return {
    getHydrationErrors: () => all.filter((text) => HYDRATION_PATTERN.test(text)),
    getAllErrors: () => [...all],
    reset: () => {
      all = [];
    }
  };
}
