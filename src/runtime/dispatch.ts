/* ==========================================================================
   Trigger dispatch — resolves data, builds context, calls trackEvent.
   Centralizes the once-guard and "skip if data resolver returned null".
   ========================================================================== */

import { trackEvent } from "../core/tracker";
import type { DataResolver, EventData, TriggerContext } from "../core/types";

const fired = new Set<string>();

export interface DispatchInput {
  /** Unique id used by the once-guard. Defaults to event name. */
  key?: string;
  eventName: string;
  data?: DataResolver;
  ctx: TriggerContext;
  once?: boolean;
}

export function dispatch(input: DispatchInput): void {
  const key = input.key || input.eventName;
  if (input.once && fired.has(key)) return;

  let payload: EventData | undefined;
  if (typeof input.data === "function") {
    const out = input.data(input.ctx);
    if (out === null || out === undefined) return; // resolver opted out
    payload = out;
  } else {
    payload = input.data;
  }

  trackEvent(input.eventName, payload);
  if (input.once) fired.add(key);
}

export function buildContext(extra: Partial<TriggerContext> = {}): TriggerContext {
  const query: Record<string, string> = {};
  if (typeof window !== "undefined") {
    new URLSearchParams(window.location.search).forEach((v, k) => {
      query[k] = v;
    });
  }
  return {
    query,
    pathname:
      typeof window !== "undefined" ? window.location.pathname : "",
    ...extra,
  };
}

/** Reset once-guard. Useful in tests or on hard nav. */
export function resetDispatchGuard(): void {
  fired.clear();
}
