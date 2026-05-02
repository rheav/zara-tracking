/* ==========================================================================
   Trigger dispatch — resolves data, builds context, calls trackEvent.
   Centralizes the once-guard and "skip if data resolver returned null".
   ========================================================================== */

import { trackEvent } from "../core/tracker";
import { debugSkip, isDebugEnabled } from "../core/debug";
import type { DataResolver, EventData, TriggerContext } from "../core/types";

const fired = new Set<string>();

export interface DispatchInput {
  /** Unique id used by the once-guard. Defaults to event name. */
  key?: string;
  eventName: string;
  data?: DataResolver;
  ctx: TriggerContext;
  once?: boolean;
  /**
   * Source trigger label for debug logs ("route", "click", "visible", etc).
   * Each binder sets this so logs can show what fired the event.
   */
  trigger?: string;
}

export function dispatch(input: DispatchInput): void {
  const key = input.key || input.eventName;
  if (input.once && fired.has(key)) {
    if (isDebugEnabled()) debugSkip(input.eventName, `once-guard (key=${key})`);
    return;
  }

  let payload: EventData | undefined;
  if (typeof input.data === "function") {
    const out = input.data(input.ctx);
    if (out === null || out === undefined) {
      if (isDebugEnabled())
        debugSkip(input.eventName, "data resolver returned null");
      return;
    }
    payload = out;
  } else {
    payload = input.data;
  }

  trackEvent(input.eventName, payload, { trigger: input.trigger });
  if (input.once) fired.add(key);
}

export function buildContext(
  extra: Partial<TriggerContext> = {},
): TriggerContext {
  const query: Record<string, string> = {};
  if (typeof window !== "undefined") {
    new URLSearchParams(window.location.search).forEach((v, k) => {
      query[k] = v;
    });
  }
  return {
    query,
    pathname: typeof window !== "undefined" ? window.location.pathname : "",
    ...extra,
  };
}

/** Reset once-guard. Useful in tests or on hard nav. */
export function resetDispatchGuard(): void {
  fired.clear();
}
