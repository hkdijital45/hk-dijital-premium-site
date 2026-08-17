import "server-only";

// This module can never end up in a client bundle (enforced at build time
// by the import above). All actual logic lives in gemini-client-core.ts so
// it stays unit-testable from a plain Node test run — see that file's
// module docblock for why the split exists.
export * from "@/lib/gemini-client-core";
