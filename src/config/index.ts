/* ==========================================================================
   Config helper — parse pixel IDs and debug flag from any env-like object.
   Works with Vite (import.meta.env), Next.js (process.env), Astro, etc.
   ========================================================================== */

export interface ParsedConfig {
  pixelIds: string[];
  debug: boolean;
}

export interface BuildConfigInput {
  pixelIds?: string;
  debug?: string | boolean;
}

/**
 * Parse pixel IDs from a comma-separated string and a debug flag.
 *
 * Example (Next.js):
 *   buildConfigFromEnv({
 *     pixelIds: process.env.NEXT_PUBLIC_META_PIXEL_IDS,
 *     debug: process.env.NEXT_PUBLIC_META_DEBUG,
 *   });
 *
 * Example (Vite/Astro):
 *   buildConfigFromEnv({
 *     pixelIds: import.meta.env.PUBLIC_META_PIXEL_IDS,
 *     debug: import.meta.env.PUBLIC_META_DEBUG,
 *   });
 */
export function buildConfigFromEnv(input: BuildConfigInput): ParsedConfig {
  const pixelIds = (input.pixelIds || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const debug =
    input.debug === true ||
    input.debug === "true" ||
    input.debug === "1";
  return { pixelIds, debug };
}
