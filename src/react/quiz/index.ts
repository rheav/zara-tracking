/* ==========================================================================
   zara-tracking/react/quiz — declarative quiz/funnel tracking

   Built on top of the core `trackEvent()`. Consume via a single import:

     import {
       useQuizTracking,
       type EventSpec,
       type StepTracking,
       type QuizTracking,
     } from "zara-tracking/react/quiz";

   See individual module files for full docs.
   ========================================================================== */

export {
  useQuizTracking,
  type UseQuizTrackingOptions,
  type FireStepEventArgs,
  type FireQuizEventArgs,
  type QuizTrackingQuestion,
} from "./useQuizTracking";

export { resolveEventData } from "./resolveEventData";

export type {
  EventContext,
  EventSpec,
  QuizPhase,
  QuizTracking,
  StepTracking,
  TrackingPhase,
} from "./types";
