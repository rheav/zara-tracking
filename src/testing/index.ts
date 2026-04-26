/* ==========================================================================
   zara-tracking/testing — mockable surface for unit tests.

   This module is a drop-in replacement for `"zara-tracking"` in tests.
   Everything is a no-op, but `trackEvent()` records its calls into
   `fired[]` so tests can assert on them.

   Usage (Vitest):
     vi.mock("zara-tracking", () => import("zara-tracking/testing"));

     import { trackEvent } from "zara-tracking";
     import { fired, reset } from "zara-tracking/testing";

     beforeEach(() => reset());

     it("fires InitiateCheckout", () => {
       trackEvent("InitiateCheckout", { value: 47 });
       expect(fired).toEqual([{ name: "InitiateCheckout", data: { value: 47 } }]);
     });

   Usage (Jest):
     jest.mock("zara-tracking", () => require("zara-tracking/testing"));

   Why a dedicated subpath:
     Every consumer project was hand-rolling the same `vi.mock` factory.
     Centralizing it here means one import instead of a per-project spy
     helper. Works with both Vitest and Jest because it avoids
     framework-specific APIs.
   ========================================================================== */

import type { EventData } from "../core/types";

export interface FiredEvent {
  name: string;
  data?: EventData;
}

/** Append-only log of every `trackEvent()` call made since the last reset. */
export const fired: FiredEvent[] = [];

/** Clear the `fired[]` log. Call in your `beforeEach`. */
export function reset(): void {
  fired.length = 0;
}

/** Stand-in for the real `trackEvent` — records to `fired[]`, fires nothing. */
export function trackEvent(name: string, data?: EventData): void {
  fired.push({ name, data });
}

/** Stand-in for `configureTracking` — no-op. */
export function configureTracking(): void {
  /* no-op */
}

/** Stand-in for `initPixel` — no-op. */
export function initPixel(): void {
  /* no-op */
}

/** Stand-in for `buildPixelInitScript` — returns an empty string. */
export function buildPixelInitScript(): string {
  return "";
}

/** Stand-in for the `MetaPixel` React component — renders nothing. */
export function MetaPixel(): null {
  return null;
}

/**
 * Stand-in for `defineTrackingConfig` — returns its input unchanged.
 * Useful when a test file imports a config module that uses it.
 */
export function defineTrackingConfig<T>(input: T): T {
  return input;
}

/**
 * Ad-hoc factory for tests that want scoped mock state without relying
 * on the module-level `fired[]` singleton. Returns a fresh `trackEvent`
 * + assertion helpers.
 */
export function createTrackEventMock() {
  const local: FiredEvent[] = [];
  return {
    trackEvent: (name: string, data?: EventData) => {
      local.push({ name, data });
    },
    fired: local,
    reset: () => {
      local.length = 0;
    },
    /** Assert that an event with `name` was fired at least once. */
    wasFired: (name: string) => local.some((e) => e.name === name),
    /** Count of times `name` was fired. */
    count: (name: string) => local.filter((e) => e.name === name).length,
  };
}
