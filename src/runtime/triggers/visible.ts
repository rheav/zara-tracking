import type { EventDefinition } from "../../core/types";
import { buildContext, dispatch } from "../dispatch";

type VisibleDef = Extract<EventDefinition, { on: "visible" }>;

/** Per-route binder. Returns cleanup. */
export function bindVisible(
  defs: Array<{ key: string; def: VisibleDef }>,
): () => void {
  if (typeof window === "undefined" || defs.length === 0) return () => {};
  if (typeof IntersectionObserver === "undefined") return () => {};

  const observers: IntersectionObserver[] = [];

  for (const { key, def } of defs) {
    const targets = document.querySelectorAll(def.selector);
    if (targets.length === 0) continue;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          dispatch({
            key,
            eventName: def.event,
            data: def.data,
            once: def.once,
            ctx: buildContext({ el: entry.target }),
          });
          // visible defaults to once-per-route
          io.unobserve(entry.target);
        }
      },
      { threshold: def.threshold ?? 0.5 },
    );
    targets.forEach((t) => io.observe(t));
    observers.push(io);
  }

  return () => observers.forEach((io) => io.disconnect());
}
