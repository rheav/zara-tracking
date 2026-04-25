/* ==========================================================================
   Runtime state — module-level store for defaults, enabled flag, and
   consent gate. Set by `runTracking()` (or `configureTracking()`); read by
   `trackEvent` and the auto-binder dispatcher.

   Manual `trackEvent("X", {...})` callers who never invoke `runTracking`
   see no behavior change — defaults stay empty, gates stay open.
   ========================================================================== */

import type { EventData } from "./types";

export interface RuntimeState {
  defaults: EventData;
  enabled: boolean;
  consent: () => boolean;
}

const state: RuntimeState = {
  defaults: {},
  enabled: true,
  consent: () => true,
};

export function configureTracking(patch: Partial<RuntimeState>): void {
  if (patch.defaults) state.defaults = { ...state.defaults, ...patch.defaults };
  if (typeof patch.enabled === "boolean") state.enabled = patch.enabled;
  if (typeof patch.consent === "function") state.consent = patch.consent;
}

export function getRuntimeState(): RuntimeState {
  return state;
}

export function shouldFire(): boolean {
  if (!state.enabled) return false;
  try {
    return state.consent() !== false;
  } catch {
    return false;
  }
}

export function mergeDefaults(data?: EventData): EventData {
  if (!data) return { ...state.defaults };
  return { ...state.defaults, ...data };
}
