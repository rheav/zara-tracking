import type { EventDefinition } from "../../core/types";
import { buildContext, dispatch } from "../dispatch";

type VideoDef = Extract<EventDefinition, { on: "video" }>;

export function bindVideo(
  defs: Array<{ key: string; def: VideoDef }>,
): () => void {
  if (typeof document === "undefined" || defs.length === 0) return () => {};

  const cleanups: Array<() => void> = [];

  for (const { key, def } of defs) {
    const els = document.querySelectorAll(def.selector);
    els.forEach((el) => {
      if (!(el instanceof HTMLVideoElement)) return;
      let done = false;
      const handler = (e: Event) => {
        if (done) return;
        done = true;
        dispatch({
          key,
          eventName: def.event,
          data: def.data,
          once: def.once,
          trigger: `video:${def.phase}`,
          ctx: buildContext({ el, event: e }),
        });
      };
      el.addEventListener(def.phase, handler);
      cleanups.push(() => el.removeEventListener(def.phase, handler));
    });
  }

  return () => cleanups.forEach((fn) => fn());
}
