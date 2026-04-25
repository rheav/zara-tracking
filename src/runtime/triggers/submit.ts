import type { EventDefinition } from "../../core/types";
import { buildContext, dispatch } from "../dispatch";

type SubmitDef = Extract<EventDefinition, { on: "submit" }>;

export function bindSubmit(
  defs: Array<{ key: string; def: SubmitDef }>,
): () => void {
  if (typeof document === "undefined" || defs.length === 0) return () => {};

  const handler = (e: Event) => {
    const target = e.target as Element | null;
    if (!target) return;
    for (const { key, def } of defs) {
      const el = target.closest(def.selector);
      if (!el || !(el instanceof HTMLFormElement)) continue;
      const form = new FormData(el);
      dispatch({
        key,
        eventName: def.event,
        data: def.data,
        once: def.once,
        ctx: buildContext({ el, form, event: e }),
      });
    }
  };

  document.addEventListener("submit", handler, { capture: true });
  return () =>
    document.removeEventListener("submit", handler, { capture: true });
}
