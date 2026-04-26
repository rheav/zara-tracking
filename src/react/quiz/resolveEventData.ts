import type { EventData } from "../../core/types";
import type { EventContext, EventSpec } from "./types";

/**
 * Merge precedence (last wins):
 *   context-derived fields → quiz defaults → spec static data.
 *
 * When `spec.data` is a function, it receives ctx and its return takes
 * precedence over both quiz defaults and context fields.
 */
export function resolveEventData(
  spec: EventSpec,
  quizDefaults: EventData | undefined,
  ctx: EventContext,
): EventData {
  const contextFields: EventData = {
    step_id: ctx.stepId,
    step_index: ctx.stepIndex,
    step_type: ctx.stepType,
    total_steps: ctx.totalSteps,
  };
  const staticData =
    typeof spec.data === "function" ? spec.data(ctx) : spec.data || {};

  return {
    ...contextFields,
    ...(quizDefaults || {}),
    ...staticData,
  };
}
