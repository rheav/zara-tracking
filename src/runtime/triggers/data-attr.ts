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

   Default trigger is `click`. Override with `data-track-on="submit"` (or
   anything else handled by HTMLElement's native event names).

   `data-track-*` keys (camelCased from kebab) become payload fields.
   `value` is parsed as Number, `content_ids` is split on commas.
   ========================================================================== */

import type { EventData } from "../../core/types";
import { buildContext, dispatch } from "../dispatch";

const KEY_RENAMES: Record<string, string> = {
  contentName: "content_name",
  contentType: "content_type",
  contentIds: "content_ids",
  numItems: "num_items",
};
const RESERVED = new Set(["track", "trackOn", "trackOnce"]);

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

    if (finalKey === "value" || finalKey === "num_items") {
      const n = Number(raw);
      if (!Number.isNaN(n)) data[finalKey] = n;
    } else if (finalKey === "content_ids") {
      data[finalKey] = raw.split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      data[finalKey] = raw;
    }
  }

  return { eventName, trigger, once, data };
}

export function bindDataAttrs(): () => void {
  if (typeof document === "undefined") return () => {};

  // group elements by trigger so we register one delegated listener per type
  const triggers = new Set<string>();
  const scan = () => {
    document.querySelectorAll<HTMLElement>("[data-track]").forEach((el) => {
      triggers.add(el.dataset.trackOn || "click");
    });
  };
  scan();

  const cleanups: Array<() => void> = [];
  for (const trigger of triggers) {
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
