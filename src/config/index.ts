/* ==========================================================================
   Config helpers — define tracking config inline (preferred), or parse from
   env vars (legacy). Pixel IDs and the debug flag are public values (they
   ship to the browser via fbq), so committing them to a config file is safe.
   ========================================================================== */

import type {
  EventData,
  EventDefinition,
  RuntimeConfig,
} from "../core/types";

export interface ParsedConfig {
  pixelIds: string[];
  debug: boolean;
}

export interface BuildConfigInput {
  pixelIds?: string;
  debug?: string | boolean;
}

export interface DefineTrackingConfigInput {
  /** One pixel ID, an array, or a comma-separated string. */
  pixelIds: string | string[];
  /** Log every event to the console. Default false. */
  debug?: boolean;
  /** Master kill-switch. Default true. */
  enabled?: boolean;
  /** Consent gate. Polled before every fire. Default `() => true`. */
  consent?: () => boolean;
  /** Defaults merged into every event payload. */
  defaults?: EventData;
  /** Re-fire PageView on SPA route changes. Default false. */
  spaPageViews?: boolean;
  /** Auto-bind elements with `data-track="EventName"`. Default false. */
  autoBindDataAttrs?: boolean;
  /** Declarative event registry. */
  events?: Record<string, EventDefinition>;
  /** Free-form extras (e.g. defaultCurrency). */
  [key: string]: unknown;
}

/**
 * Define a tracking config inline. Drop into `tracking.config.{js,ts}` at the
 * project root, then mount `<TrackingBootstrap config={config} />` in your
 * layout (or call `runTracking(config)` manually).
 *
 * @example
 *   // tracking.config.js
 *   import { defineTrackingConfig } from "zara-tracking/config";
 *
 *   export default defineTrackingConfig({
 *     pixelIds: ["1234567890"],
 *     defaults: { currency: "BRL" },
 *     spaPageViews: true,
 *     autoBindDataAttrs: true,
 *     events: {
 *       buyCta: { on: "click", selector: "#cta-buy", event: "InitiateCheckout", data: { value: 47 } },
 *     },
 *   });
 */
export function defineTrackingConfig<T extends DefineTrackingConfigInput>(
  input: T,
): RuntimeConfig & Omit<T, "pixelIds" | "debug"> {
  const pixelIds = normalizePixelIds(input.pixelIds);
  const debug = input.debug === true;
  const { pixelIds: _ids, debug: _dbg, ...rest } = input;
  return { pixelIds, debug, ...rest } as RuntimeConfig &
    Omit<T, "pixelIds" | "debug">;
}

function normalizePixelIds(value: string | string[]): string[] {
  const arr = Array.isArray(value) ? value : String(value || "").split(",");
  return arr.map((s) => String(s).trim()).filter(Boolean);
}

/**
 * Legacy — parse pixel IDs from env vars. Prefer `defineTrackingConfig`.
 */
export function buildConfigFromEnv(input: BuildConfigInput): ParsedConfig {
  const pixelIds = normalizePixelIds(input.pixelIds || "");
  const debug =
    input.debug === true ||
    input.debug === "true" ||
    input.debug === "1";
  return { pixelIds, debug };
}
