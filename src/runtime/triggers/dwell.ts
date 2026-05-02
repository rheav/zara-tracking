import type { EventDefinition } from "../../core/types";
import { buildContext, dispatch } from "../dispatch";

type DwellDef = Extract<EventDefinition, { on: "dwell" }>;

export function bindDwell(
  defs: Array<{ key: string; def: DwellDef }>,
): () => void {
  if (typeof window === "undefined" || defs.length === 0) return () => {};

  const timers: ReturnType<typeof setTimeout>[] = [];

  for (const { key, def } of defs) {
    const t = setTimeout(() => {
      dispatch({
        key,
        eventName: def.event,
        data: def.data,
        once: def.once,
        trigger: `dwell ${def.seconds}s`,
        ctx: buildContext(),
      });
    }, def.seconds * 1000);
    timers.push(t);
  }

  return () => timers.forEach(clearTimeout);
}
