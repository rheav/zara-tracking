import type { EventDefinition } from "../../core/types";
import { buildContext, dispatch } from "../dispatch";

type ClickDef = Extract<EventDefinition, { on: "click" }>;

/** Bind delegated click listener for all click event defs. Idempotent. */
export function bindClick(
  defs: Array<{ key: string; def: ClickDef }>,
): () => void {
  if (typeof document === "undefined" || defs.length === 0) return () => {};

  const handler = (e: Event) => {
    const target = e.target as Element | null;
    if (!target) return;
    for (const { key, def } of defs) {
      const el = target.closest(def.selector);
      if (!el) continue;
      dispatch({
        key,
        eventName: def.event,
        data: def.data,
        once: def.once,
        trigger: "click",
        ctx: buildContext({ el, event: e }),
      });
    }
  };

  document.addEventListener("click", handler, { capture: true });
  return () => document.removeEventListener("click", handler, { capture: true });
}
