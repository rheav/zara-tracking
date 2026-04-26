/* ==========================================================================
   data-track auto-binder.

   <button data-track="InitiateCheckout"
           data-track-value="47"
           data-track-currency="BRL"
           data-track-content-name="Buy CTA"
           data-track-content-ids="sku-1,sku-2"
           data-track-once="true">
     Buy
   </button>

   Default triggers are `click` + `submit` — bound unconditionally at boot via
   document-level event delegation. Elements added AFTER mount (SPA route
   changes, conditional renders) work without re-scanning, because the handler
   uses `target.closest("[data-track]")` to locate the element on each event.

   Custom triggers (`change`, `focus`, `mouseenter`, etc.) are opt-in via
   `dataAttrTriggers` in the runtime config:

     defineTrackingConfig({
       autoBindDataAttrs: true,
       dataAttrTriggers: ["click", "submit", "change"],
     });

   `data-track-*` keys (camelCased from kebab) become payload fields.
   ========================================================================== */

import type { EventData } from "../../core/types";
import { buildContext, dispatch } from "../dispatch";

/**
 * Map of dataset camelCase keys → Meta-standard snake_case payload keys.
 *
 * `dataset` strips dashes and lowercases the next char, so
 * `data-track-predicted-ltv` arrives here as `predictedLtv`. Meta drops
 * unknown keys silently, so anything in Meta's standard event vocabulary
 * with more than one word MUST be in this map for the Pixel debugger to
 * see it as a recognized field.
 */
const KEY_RENAMES: Record<string, string> = {
  contentName: "content_name",
  contentType: "content_type",
  contentIds: "content_ids",
  contentCategory: "content_category",
  numItems: "num_items",
  predictedLtv: "predicted_ltv",
  deliveryCategory: "delivery_category",
  orderId: "order_id",
  searchString: "search_string",
};

/** Keys whose raw string value should be coerced to Number before dispatch. */
const NUMERIC_KEYS = new Set(["value", "num_items", "predicted_ltv"]);

const RESERVED = new Set(["track", "trackOn", "trackOnce"]);
const DEFAULT_TRIGGERS = ["click", "submit"] as const;

function parseDataset(el: HTMLElement): {
  eventName: string | null;
  trigger: string;
  once: boolean;
  data: EventData;
} {
  const ds = el.dataset;
  const eventName = ds.track || null;
  const trigger = ds.trackOn || "click";
  const once = ds.trackOnce === "true";

  const data: EventData = {};
  for (const k of Object.keys(ds)) {
    if (!k.startsWith("track") || RESERVED.has(k)) continue;
    // strip "track" prefix → camelCase tail
    const tail = k.slice(5);
    if (!tail) continue;
    const camel = tail.charAt(0).toLowerCase() + tail.slice(1);
    const finalKey = KEY_RENAMES[camel] || camel;
    const raw = ds[k];
    if (raw === undefined) continue;

    if (NUMERIC_KEYS.has(finalKey)) {
      const n = Number(raw);
      if (!Number.isNaN(n)) data[finalKey] = n;
    } else if (finalKey === "content_ids") {
      data[finalKey] = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      data[finalKey] = raw;
    }
  }

  return { eventName, trigger, once, data };
}

/**
 * Bind delegated listeners for every trigger in `triggers`. The listener is
 * registered unconditionally — it does NOT scan the DOM at bind time, so
 * `[data-track]` elements that mount later (SPA routing, conditional render,
 * portals) are picked up automatically when their trigger fires.
 *
 * Default triggers are `click` + `submit`. Pass a custom list to opt into
 * `change`, `focus`, `mouseenter`, etc.
 */
export function bindDataAttrs(
  triggers: readonly string[] = DEFAULT_TRIGGERS,
): () => void {
  if (typeof document === "undefined") return () => {};

  // de-duplicate while preserving order
  const unique = Array.from(new Set(triggers));
  const cleanups: Array<() => void> = [];

  for (const trigger of unique) {
    const handler = (e: Event) => {
      const target = e.target as Element | null;
      if (!target) return;
      const el = target.closest<HTMLElement>("[data-track]");
      if (!el) return;
      const { eventName, trigger: t, once, data } = parseDataset(el);
      if (!eventName || t !== trigger) return;
      dispatch({
        key: `data-attr:${eventName}:${(el.id || "") + (el.dataset.trackKey || "")}`,
        eventName,
        data,
        once,
        ctx: buildContext({ el, event: e }),
      });
    };
    document.addEventListener(trigger, handler, { capture: true });
    cleanups.push(() =>
      document.removeEventListener(trigger, handler, { capture: true }),
    );
  }

  return () => cleanups.forEach((fn) => fn());
}
