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
import { isDebugEnabled, debugEvent } from "./debug";
import type { EventData, ZarazPayload } from "./types";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    zaraz?: {
      track: (name: string, payload?: Record<string, unknown>) => void;
      set?: (
        key: string,
        value: unknown,
        opts?: { scope: string },
      ) => void;
    };
    __ZARAZ_TRACK__?: (
      name: string,
      payload: Record<string, unknown>,
    ) => void;
    __GEO__?: {
      ct?: string;
      st?: string;
      zp?: string;
      country?: string;
    };
    __EXTERNAL_ID__?: string;
  }
}

function getGeoData(): Pick<ZarazPayload, "ct" | "st" | "zp" | "country"> {
  const geo =
    typeof window !== "undefined" ? window.__GEO__ : undefined;
  const out: Pick<ZarazPayload, "ct" | "st" | "zp" | "country"> = {};
  if (!geo) return out;
  if (geo.ct) out.ct = geo.ct;
  if (geo.st) out.st = geo.st;
  if (geo.zp) out.zp = geo.zp;
  if (geo.country) out.country = geo.country;
  return out;
}

export function trackEvent(eventName: string, data?: EventData): void {
  const eventId = generateEventId(eventName);

  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", eventName, data || {}, { eventID: eventId });
    if (isDebugEnabled()) debugEvent(eventName, "browser", eventId, data);
  }

  const payload: ZarazPayload = {
    event_id: eventId,
    external_id: getOrCreateExternalId(),
    fbc: getFbc() || "",
    fbp: getFbp() || "",
    ...getGeoData(),
    ...(data || {}),
  };

  if (typeof window === "undefined") return;

  if (typeof window.__ZARAZ_TRACK__ === "function") {
    window.__ZARAZ_TRACK__(eventName, payload as Record<string, unknown>);
    if (isDebugEnabled()) debugEvent(eventName, "zaraz", eventId, payload);
  } else if (window.zaraz && typeof window.zaraz.track === "function") {
    window.zaraz.track(eventName, payload as Record<string, unknown>);
    if (isDebugEnabled()) debugEvent(eventName, "zaraz", eventId, payload);
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
