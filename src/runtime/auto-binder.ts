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
  if (config.autoBindDataAttrs) {
    persistentCleanups.push(bindDataAttrs());
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
  const onRouteChange = () => {
    bindPerRoute();
    if (config.spaPageViews) {
      // first-load PageView fired by inline pixel script; only re-fire after
      if (window.__META_FIRST_PAGEVIEW_DONE__) trackEvent("PageView");
    }
  };

  // Astro view-transitions
  document.addEventListener("astro:page-load", onRouteChange);

  // History API patch (works for Next App Router, React Router, etc)
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  let lastPath = location.pathname;
  const maybeFire = () => {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    onRouteChange();
  };
  history.pushState = function (...args) {
    const r = origPush.apply(this, args);
    setTimeout(maybeFire, 0);
    return r;
  };
  history.replaceState = function (...args) {
    const r = origReplace.apply(this, args);
    setTimeout(maybeFire, 0);
    return r;
  };
  window.addEventListener("popstate", () => setTimeout(maybeFire, 0));

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
