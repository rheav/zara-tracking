/* ==========================================================================
   initPixel — callable form of the pixel boot.

   The classic `buildPixelInitScript()` returns an IIFE source string for
   server-side inlining into <head> (Next.js <script dangerouslySetInnerHTML>,
   Astro <script set:html>). Great for first-PageView latency, but requires
   SSR access.

   `initPixel()` does the same work from a bundled module, so framework
   integrations that inject a client-bundled script (like Astro's
   `injectScript` API) don't need to round-trip through a string.

   Behavior is identical to buildPixelInitScript:
     1. Load fbevents.js
     2. Resolve external_id (server-injected → localStorage → cookie → UUID)
     3. Capture fbclid → _fbc cookie
     4. Initialize each pixel
     5. Install window.__ZARAZ_TRACK__ readiness queue (5s cap)
     6. Fire deduplicated PageView (fbq + Zaraz)
     7. Set window.__META_FIRST_PAGEVIEW_DONE__ = true

   Idempotent: safe to call multiple times (early-exits if fbq is already set).
   ========================================================================== */

// The primary Window augment (fbq, zaraz, __ZARAZ_TRACK__, __EXTERNAL_ID__,
// __GEO__, etc.) lives in tracker.ts. Only declare the extras unique to the
// pixel boot sequence here to avoid conflicting declarations.
declare global {
  interface Window {
    __META_DEBUG__?: boolean;
    __META_PIXEL_IDS__?: string[];
    __META_FIRST_PAGEVIEW_DONE__?: boolean;
  }
}

// Internal shape used while assembling fbq. We cast through `unknown` when
// writing to `window.fbq` so tracker.ts's looser `(...args) => void` signature
// doesn't conflict with the richer fields the standard loader attaches.
type FbqFunction = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  push?: unknown;
  loaded?: boolean;
  version?: string;
};

function getCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

function setCookie(name: string, value: string, days: number): void {
  const e = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie =
    name +
    "=" +
    encodeURIComponent(value) +
    ";expires=" +
    e +
    ";path=/;SameSite=Lax";
}

function genId(name: string): string {
  return (
    name + "_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11)
  );
}

function resolveExternalId(): string {
  let id = window.__EXTERNAL_ID__ || null;
  if (!id) {
    try {
      id = localStorage.getItem("meta_external_id");
    } catch {
      /* ignore */
    }
  }
  if (!id) id = getCookie("meta_external_id");
  if (!id) {
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "v_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11);
  }
  try {
    localStorage.setItem("meta_external_id", id);
  } catch {
    /* ignore */
  }
  setCookie("meta_external_id", id, 365);
  return id;
}

function loadFbevents(): void {
  // Standard Meta Pixel loader — verbatim semantics from buildPixelInitScript,
  // but written as typed JS instead of a stringified IIFE.
  if (window.fbq) return;
  const v = "https://connect.facebook.net/en_US/fbevents.js";
  const n: FbqFunction = function (this: unknown, ...args: unknown[]) {
    if (n.callMethod) n.callMethod.apply(n, args);
    else (n.queue as unknown[]).push(args);
  } as FbqFunction;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];
  // Cast through unknown to reconcile with the narrower Window["fbq"] sig
  // declared in tracker.ts.
  window.fbq = n as unknown as Window["fbq"];
  const t = document.createElement("script");
  t.async = true;
  t.src = v;
  const s = document.getElementsByTagName("script")[0];
  if (s && s.parentNode) s.parentNode.insertBefore(t, s);
}

function installZarazQueue(): void {
  const q: Array<{ name: string; payload: Record<string, unknown> }> = [];
  let ready = false;
  let waited = 0;
  const flush = () => {
    for (const item of q) {
      try {
        window.zaraz?.track?.(item.name, item.payload);
      } catch {
        /* ignore */
      }
    }
    q.length = 0;
  };
  const zarazTrack = (name: string, payload: Record<string, unknown>) => {
    if (ready) {
      try {
        window.zaraz?.track?.(name, payload);
      } catch {
        /* ignore */
      }
      return;
    }
    q.push({ name, payload });
  };
  const poll = () => {
    if (
      typeof window.zaraz !== "undefined" &&
      typeof window.zaraz.track === "function"
    ) {
      ready = true;
      flush();
      return;
    }
    if (waited >= 5000) return;
    waited += 50;
    setTimeout(poll, 50);
  };
  poll();
  window.__ZARAZ_TRACK__ = zarazTrack;
}

/**
 * Boot the Meta Pixel and the Zaraz readiness queue. Fires the first
 * deduplicated PageView. Idempotent — subsequent calls are a no-op once
 * `window.fbq` is installed.
 */
export function initPixel(pixelIds: string[], debug = false): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__META_FIRST_PAGEVIEW_DONE__) return;
  if (!pixelIds || pixelIds.length === 0) return;

  window.__META_DEBUG__ = !!debug;
  window.__META_PIXEL_IDS__ = pixelIds;

  // fbclid → _fbc
  const fbclid = new URLSearchParams(window.location.search).get("fbclid");
  if (fbclid && !getCookie("_fbc")) setCookie("_fbc", "fb.1.0." + fbclid, 90);

  loadFbevents();

  const externalId = resolveExternalId();
  const fbq = window.fbq as (...args: unknown[]) => void;
  for (const id of pixelIds) {
    fbq("init", id, { external_id: externalId });
  }

  installZarazQueue();

  // First deduplicated PageView
  const pvId = genId("PageView");
  fbq("track", "PageView", {}, { eventID: pvId });
  window.__ZARAZ_TRACK__!("PageView", {
    event_id: pvId,
    external_id: externalId,
    fbc: getCookie("_fbc") || "",
    fbp: getCookie("_fbp") || "",
  });

  window.__META_FIRST_PAGEVIEW_DONE__ = true;
}
