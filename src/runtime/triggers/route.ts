import type { EventDefinition } from "../../core/types";
import { buildContext, dispatch } from "../dispatch";

type RouteDef = Extract<EventDefinition, { on: "route" }>;

function matches(path: string | RegExp, pathname: string): boolean {
  if (path instanceof RegExp) return path.test(pathname);
  if (path.endsWith("/")) return pathname.startsWith(path);
  return pathname === path || pathname === path + "/";
}

/** Fire all route-bound defs whose path matches current location. */
export function fireRoute(
  defs: Array<{ key: string; def: RouteDef }>,
): void {
  if (typeof window === "undefined") return;
  const pathname = window.location.pathname;
  for (const { key, def } of defs) {
    if (!matches(def.path, pathname)) continue;
    dispatch({
      key,
      eventName: def.event,
      data: def.data,
      once: def.once,
      ctx: buildContext(),
    });
  }
}
