/* ==========================================================================
   Config helpers — define tracking config inline (preferred), or parse from
   env vars (legacy). Pixel IDs and the debug flag are public values (they
   ship to the browser via fbq), so committing them to a config file is safe.
   ========================================================================== */

import type { EventData, EventDefinition, RuntimeConfig } from "../core/types";

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
  /**
   * ISO currency code merged into every event payload. Shortcut for
   * `defaults: { currency: "BRL" }` — by far the most common default.
   * Ignored when `defaults.currency` is set explicitly.
   */
  currency?: string;
  /** Defaults merged into every event payload. */
  defaults?: EventData;
  /** Re-fire PageView on SPA route changes. Default `true`. */
  spaPageViews?: boolean;
  /** Auto-bind elements with `data-track="EventName"`. Default `true`. */
  autoBindDataAttrs?: boolean;
  /**
   * Triggers the `data-track` binder listens to. Default `["click", "submit"]`.
   * Add `"change"`, `"focus"`, etc. to opt those triggers in.
   */
  dataAttrTriggers?: string[];
  /** Declarative event registry. */
  events?: Record<string, EventDefinition>;
  /** Free-form extras (e.g. defaultCurrency). */
  [key: string]: unknown;
}

/**
 * Define a tracking config inline. Drop into `tracking.config.{js,ts}` at the
 * project root, then mount `<TrackingProvider config={config} />` in your
 * layout (or call `runTracking(config)` manually).
 *
 * Defaults: `autoBindDataAttrs: true`, `spaPageViews: true`. Set them to
 * `false` explicitly to opt out.
 *
 * @example
 *   // tracking.config.ts — minimum viable
 *   import { defineTrackingConfig } from "zara-tracking";
 *
 *   export default defineTrackingConfig({
 *     pixelIds: ["1234567890"],
 *     currency: "BRL",
 *   });
 */
export function defineTrackingConfig<T extends DefineTrackingConfigInput>(
  input: T,
): RuntimeConfig & Omit<T, "pixelIds" | "debug" | "currency"> {
  const pixelIds = normalizePixelIds(input.pixelIds);
  const debug = input.debug === true;
  const { pixelIds: _ids, debug: _dbg, currency, defaults, ...rest } = input;

  // Lift `currency` shortcut into defaults.currency unless caller set it.
  let mergedDefaults: EventData | undefined = defaults;
  if (currency && (!defaults || defaults.currency === undefined)) {
    mergedDefaults = { ...(defaults ?? {}), currency };
  }

  return {
    pixelIds,
    debug,
    ...(mergedDefaults ? { defaults: mergedDefaults } : {}),
    ...rest,
  } as RuntimeConfig & Omit<T, "pixelIds" | "debug" | "currency">;
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
    input.debug === true || input.debug === "true" || input.debug === "1";
  return { pixelIds, debug };
}
