/* ==========================================================================
   runTracking(config) — main entry for the auto-binder.

   Two layers:
     1. Persistent (bound once at boot, survives SPA route changes via
        document-level event delegation):
          - click, submit, data-attr
     2. Per-route (re-bound on every route change because they target
        specific elements / per-page state):
          - visible (IntersectionObserver), scroll, dwell, video, route

   SPA hook: patches history.pushState + replaceState + listens to popstate.
   Also listens to `astro:page-load` if Astro view-transitions emit it.

   First-load PageView: skipped here — the inline pixel boot script in
   <MetaPixel /> already fires it. spaPageViews:true only re-fires on
   subsequent route changes.
   ========================================================================== */

import { configureTracking } from "../core/runtime-state";
import { initDebug } from "../core/debug";
import { trackEvent } from "../core/tracker";
import type { EventDefinition, RuntimeConfig } from "../core/types";

import { bindClick } from "./triggers/click";
import { bindSubmit } from "./triggers/submit";
import { bindDataAttrs } from "./triggers/data-attr";
import { bindVisible } from "./triggers/visible";
import { bindScroll } from "./triggers/scroll";
import { bindDwell } from "./triggers/dwell";
import { bindVideo } from "./triggers/video";
import { fireRoute } from "./triggers/route";

declare global {
  interface Window {
    __META_FIRST_PAGEVIEW_DONE__?: boolean;
    __ZARA_RUNTIME_ACTIVE__?: boolean;
  }
}

interface KeyedDef<T extends EventDefinition["on"]> {
  key: string;
  def: Extract<EventDefinition, { on: T }>;
}

function partition(events: Record<string, EventDefinition>) {
  const out = {
    click: [] as KeyedDef<"click">[],
    submit: [] as KeyedDef<"submit">[],
    route: [] as KeyedDef<"route">[],
    visible: [] as KeyedDef<"visible">[],
    scroll: [] as KeyedDef<"scroll">[],
    dwell: [] as KeyedDef<"dwell">[],
    video: [] as KeyedDef<"video">[],
  };
  for (const [key, def] of Object.entries(events)) {
    // narrowing via discriminant
    (out[def.on] as { key: string; def: EventDefinition }[]).push({ key, def });
  }
  return out;
}

export interface RuntimeHandle {
  /** Re-run per-route bindings + fire route events for current pathname. */
  rebind: () => void;
  /** Tear everything down. */
  destroy: () => void;
}

export function runTracking(config: RuntimeConfig): RuntimeHandle {
  if (typeof window === "undefined") {
    return { rebind: () => {}, destroy: () => {} };
  }
  if (window.__ZARA_RUNTIME_ACTIVE__) {
    // double-mount guard (e.g. React StrictMode dev double-render)
    return { rebind: () => {}, destroy: () => {} };
  }
  window.__ZARA_RUNTIME_ACTIVE__ = true;

  if (
    (!config.pixelIds || config.pixelIds.length === 0) &&
    !window.__ZARA_EMPTY_WARNED__
  ) {
    window.__ZARA_EMPTY_WARNED__ = true;
    console.warn(
      "[zara-tracking] runTracking() called with no pixelIds — events will " +
        "still fire to Zaraz but the browser pixel side will be silent. " +
        "Check tracking.config.{js,ts}.",
    );
  }

  // 1. Push runtime state (defaults / enabled / consent) into module store
  configureTracking({
    defaults: config.defaults || {},
    enabled: config.enabled !== false,
    consent: config.consent || (() => true),
  });
  if (config.debug) initDebug(true);

  const events = config.events || {};
  const grouped = partition(events);

  // 2. Persistent bindings — bind once, survive SPA route changes
  const persistentCleanups: Array<() => void> = [
    bindClick(grouped.click),
    bindSubmit(grouped.submit),
  ];
  // Default true — disable by setting `autoBindDataAttrs: false`. The
  // declarative `data-track="EventName"` markup is the lib's headline pattern;
  // forcing every consumer to opt in was unnecessary friction.
  if (config.autoBindDataAttrs !== false) {
    persistentCleanups.push(bindDataAttrs(config.dataAttrTriggers));
  }

  // 3. Per-route bindings — rebound on every route change
  let perRouteCleanups: Array<() => void> = [];
  const bindPerRoute = () => {
    perRouteCleanups.forEach((fn) => fn());
    perRouteCleanups = [
      bindVisible(grouped.visible),
      bindScroll(grouped.scroll),
      bindDwell(grouped.dwell),
      bindVideo(grouped.video),
    ];
    fireRoute(grouped.route);
  };

  // Initial bind. Wait for DOM ready (selectors need elements present).
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindPerRoute, { once: true });
  } else {
    bindPerRoute();
  }

  // 4. SPA route-change detection
  // `spaPageViews` defaults true — every modern app is an SPA at this point.
  // Disable with explicit `spaPageViews: false` for static MPAs.
  const spaPageViews = config.spaPageViews !== false;

  // Track the pathname at which we last fired a PageView. The boot script
  // already fired one for the initial pathname, so we seed the cache with
  // it. Any "route change" event (astro:page-load, pushState, popstate) only
  // results in a fire if the pathname *actually changed* — this is the only
  // duplicate-PageView guard that survives every quirk:
  //   - Astro view-transitions firing astro:page-load on initial render
  //   - Astro firing it again after dev-server vite HMR reconnect
  //   - Hash-only navigations (#anchor links) → no fire (pathname unchanged)
  //   - Same-path replaceState calls → no fire
  let lastFiredPath =
    typeof location !== "undefined" ? location.pathname : "";

  const onRouteChange = () => {
    // Per-route bindings (visible / scroll / dwell / video / route triggers)
    // re-bind even when pathname is unchanged so SPA-internal DOM swaps still
    // get fresh observers. The once-guard inside dispatch handles dedup of
    // the events themselves.
    bindPerRoute();
    if (!spaPageViews) return;
    if (!window.__META_FIRST_PAGEVIEW_DONE__) return;
    if (location.pathname === lastFiredPath) return;
    lastFiredPath = location.pathname;
    trackEvent("PageView", undefined, { trigger: "route" });
  };

  // Astro view-transitions
  document.addEventListener("astro:page-load", onRouteChange);

  // History API patch (works for Next App Router, React Router, etc)
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function (...args) {
    const r = origPush.apply(this, args);
    setTimeout(onRouteChange, 0);
    return r;
  };
  history.replaceState = function (...args) {
    const r = origReplace.apply(this, args);
    setTimeout(onRouteChange, 0);
    return r;
  };
  window.addEventListener("popstate", () => setTimeout(onRouteChange, 0));

  return {
    rebind: bindPerRoute,
    destroy: () => {
      persistentCleanups.forEach((fn) => fn());
      perRouteCleanups.forEach((fn) => fn());
      document.removeEventListener("astro:page-load", onRouteChange);
      history.pushState = origPush;
      history.replaceState = origReplace;
      window.__ZARA_RUNTIME_ACTIVE__ = false;
    },
  };
}
