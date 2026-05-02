/* ==========================================================================
   Meta Tracking — Core Tracker
   Fires each event to:
     1. Browser pixel (fbq) with eventID
     2. Zaraz (window.__ZARAZ_TRACK__ queue, falls back to window.zaraz.track)
   Same id on both → Meta dedupes on (event_name, event_id).
   ========================================================================== */

import {
  generateEventId,
  getFbc,
  getFbp,
  getOrCreateExternalId,
} from "./utils";
import { isDebugEnabled, debugFire, debugSkip } from "./debug";
import type { FireStatus } from "./debug";
import { shouldFire, getRuntimeState, mergeDefaults } from "./runtime-state";
import type { EventData, ZarazPayload } from "./types";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    zaraz?: {
      track: (name: string, payload?: Record<string, unknown>) => void;
      set?: (key: string, value: unknown, opts?: { scope: string }) => void;
    };
    __ZARAZ_TRACK__?: (name: string, payload: Record<string, unknown>) => void;
    __GEO__?: {
      ct?: string;
      st?: string;
      zp?: string;
      country?: string;
    };
    __EXTERNAL_ID__?: string;
    /** Internal one-shot guard: true once we've warned about empty pixelIds. */
    __ZARA_EMPTY_WARNED__?: boolean;
  }
}

function getGeoData(): Pick<ZarazPayload, "ct" | "st" | "zp" | "country"> {
  const geo = typeof window !== "undefined" ? window.__GEO__ : undefined;
  const out: Pick<ZarazPayload, "ct" | "st" | "zp" | "country"> = {};
  if (!geo) return out;
  if (geo.ct) out.ct = geo.ct;
  if (geo.st) out.st = geo.st;
  if (geo.zp) out.zp = geo.zp;
  if (geo.country) out.country = geo.country;
  return out;
}

export interface TrackEventOptions {
  /**
   * Source trigger label for debug logs (e.g. "route", "click", "visible").
   * Set automatically by the auto-binder; pass manually for imperative
   * `trackEvent()` calls if you want them attributed in the console.
   */
  trigger?: string;
}

export function trackEvent(
  eventName: string,
  data?: EventData,
  opts?: TrackEventOptions,
): void {
  if (!shouldFire()) {
    if (isDebugEnabled()) {
      const state = getRuntimeState();
      const reason = !state.enabled
        ? "enabled=false"
        : "consent gate returned false";
      debugSkip(eventName, reason);
    }
    return;
  }
  const merged = mergeDefaults(data);
  const eventId = generateEventId(eventName);

  let browser: FireStatus = "skipped";
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    try {
      window.fbq("track", eventName, merged, { eventID: eventId });
      browser = "ok";
    } catch {
      browser = "fail";
    }
  }

  const payload: ZarazPayload = {
    event_id: eventId,
    external_id: getOrCreateExternalId(),
    fbc: getFbc() || "",
    fbp: getFbp() || "",
    ...getGeoData(),
    ...merged,
  };

  let zaraz: FireStatus = "skipped";
  if (typeof window !== "undefined") {
    if (typeof window.__ZARAZ_TRACK__ === "function") {
      try {
        window.__ZARAZ_TRACK__(eventName, payload as Record<string, unknown>);
        zaraz = "ok";
      } catch {
        zaraz = "fail";
      }
    } else if (window.zaraz && typeof window.zaraz.track === "function") {
      try {
        window.zaraz.track(eventName, payload as Record<string, unknown>);
        zaraz = "ok";
      } catch {
        zaraz = "fail";
      }
    }
  }

  if (isDebugEnabled()) {
    debugFire(eventName, eventId, browser, zaraz, merged, opts?.trigger);
  }
}

export function trackPageView(): void {
  trackEvent("PageView");
}
export function trackLead(data?: EventData): void {
  trackEvent("Lead", data);
}
export function trackViewContent(data?: EventData): void {
  trackEvent("ViewContent", data);
}
export function trackInitiateCheckout(data?: EventData): void {
  trackEvent("InitiateCheckout", data);
}
export function trackAddToCart(data?: EventData): void {
  trackEvent("AddToCart", data);
}
export function trackPurchase(data?: EventData): void {
  trackEvent("Purchase", data);
}
export function trackCompleteRegistration(data?: EventData): void {
  trackEvent("CompleteRegistration", data);
}
