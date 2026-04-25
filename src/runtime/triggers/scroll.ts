import type { EventDefinition } from "../../core/types";
import { buildContext, dispatch } from "../dispatch";

type ScrollDef = Extract<EventDefinition, { on: "scroll" }>;

export function bindScroll(
  defs: Array<{ key: string; def: ScrollDef }>,
): () => void {
  if (typeof window === "undefined" || defs.length === 0) return () => {};

  const fired = new Set<string>();

  const onScroll = () => {
    const h = document.documentElement;
    const denom = h.scrollHeight - h.clientHeight;
    if (denom <= 0) return;
    const pct = Math.round(((h.scrollTop) / denom) * 100);
    for (const { key, def } of defs) {
      if (fired.has(key)) continue;
      if (pct >= def.percent) {
        fired.add(key);
        dispatch({
          key,
          eventName: def.event,
          data: def.data,
          once: def.once,
          ctx: buildContext(),
        });
      }
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  // fire once on init in case user already past threshold (e.g. SPA nav at scrolled position)
  onScroll();

  return () => window.removeEventListener("scroll", onScroll);
}
