/* ==========================================================================
   useQuizTracking — declarative quiz/funnel tracking hook.

   Feed it your questions[] (with optional `tracking` specs per question)
   and an optional quiz-level `tracking` config. Receive two fire functions:

     const { fireStepEvent, fireQuizEvent } = useQuizTracking({
       questions,
       quizConfig: { defaultEventData: {...}, events: { onQuizStart, onQuizComplete } },
       quizSlug: "mapa-amoroso",
     });

     fireStepEvent("onView",   { stepIndex, answerValue, allAnswers });
     fireStepEvent("onAnswer", { stepIndex, answerValue, allAnswers });
     fireQuizEvent("onQuizComplete", { allAnswers });

   Dedup: each spec is keyed by (scope, phase, spec.event). `once: false`
   disables dedup for a spec.
   ========================================================================== */

import { useCallback, useRef } from "react";
import { trackEvent } from "../../core/tracker";
import { resolveEventData } from "./resolveEventData";
import type {
  EventContext,
  EventSpec,
  QuizPhase,
  QuizTracking,
  StepTracking,
  TrackingPhase,
} from "./types";

/**
 * Minimal shape of a "question" object. Only `id`, `type`, and the
 * optional `tracking` spec are read. Your real Question can have any
 * additional fields — we accept the structural subset.
 */
export interface QuizTrackingQuestion {
  id: string;
  type: string;
  tracking?: StepTracking;
}

export interface UseQuizTrackingOptions<
  Q extends QuizTrackingQuestion = QuizTrackingQuestion,
> {
  questions: Q[];
  quizConfig?: QuizTracking;
  quizSlug?: string;
}

export interface FireStepEventArgs {
  stepIndex: number;
  answerValue?: unknown;
  allAnswers: Record<string, unknown>;
}

export interface FireQuizEventArgs {
  allAnswers: Record<string, unknown>;
}

function dedupKey(scope: string, phase: string, event: string): string {
  return `${scope}::${phase}::${event}`;
}

export function useQuizTracking<
  Q extends QuizTrackingQuestion = QuizTrackingQuestion,
>({ questions, quizConfig, quizSlug }: UseQuizTrackingOptions<Q>) {
  const firedRef = useRef<Set<string>>(new Set());

  const runSpecs = useCallback(
    (
      specs: EventSpec[] | undefined,
      ctx: EventContext,
      dedupScope: string,
      phase: string,
    ) => {
      if (!specs || specs.length === 0) return;
      for (const spec of specs) {
        if (spec.when && !spec.when(ctx)) continue;
        const once = spec.once !== false;
        const key = dedupKey(dedupScope, phase, spec.event);
        if (once && firedRef.current.has(key)) continue;
        const data = resolveEventData(spec, quizConfig?.defaultEventData, ctx);
        trackEvent(spec.event, data);
        if (once) firedRef.current.add(key);
      }
    },
    [quizConfig?.defaultEventData],
  );

  const fireStepEvent = useCallback(
    (phase: TrackingPhase, opts: FireStepEventArgs) => {
      const q = questions[opts.stepIndex];
      if (!q || !q.tracking) return;
      const specs = q.tracking[phase];
      if (!specs) return;
      const ctx: EventContext = {
        quizSlug,
        stepIndex: opts.stepIndex,
        stepId: q.id,
        stepType: q.type,
        totalSteps: questions.length,
        answerValue: opts.answerValue,
        allAnswers: opts.allAnswers,
      };
      runSpecs(specs, ctx, `step:${q.id}`, phase);
    },
    [questions, quizSlug, runSpecs],
  );

  const fireQuizEvent = useCallback(
    (phase: QuizPhase, opts: FireQuizEventArgs) => {
      const specs = quizConfig?.events?.[phase];
      if (!specs) return;
      const ctx: EventContext = {
        quizSlug,
        stepIndex: -1,
        stepId: "__quiz__",
        stepType: "__quiz__",
        totalSteps: questions.length,
        answerValue: undefined,
        allAnswers: opts.allAnswers,
      };
      runSpecs(specs, ctx, "quiz", phase);
    },
    [quizConfig, questions.length, quizSlug, runSpecs],
  );

  return { fireStepEvent, fireQuizEvent };
}
