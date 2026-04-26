/* ==========================================================================
   zara-tracking/react/quiz — public types

   Declarative tracking for quiz/funnel apps. An "event spec" describes a
   Meta event to fire, optionally gated by a predicate and resolved from
   per-step context. Used by `useQuizTracking()` below.
   ========================================================================== */

import type { EventData } from "../../core/types";

export interface EventContext {
  /** Stable slug identifying the quiz (optional, useful in multi-quiz setups). */
  quizSlug?: string;
  /** 0-based index of the current step. -1 for quiz-level events. */
  stepIndex: number;
  /** Stable id of the current step (question.id). `"__quiz__"` for quiz-level. */
  stepId: string;
  /** Step type tag (matches your quiz JSON's question.type). */
  stepType: string;
  /** Total number of steps in the quiz. */
  totalSteps: number;
  /** The answer the user just picked (undefined for onView / onBack / quiz-level). */
  answerValue?: unknown;
  /** Every answer collected so far, keyed by step id. */
  allAnswers: Record<string, unknown>;
}

export interface EventSpec {
  /** Meta event name (e.g. "Lead", "InitiateCheckout"). */
  event: string;
  /** Static object OR a resolver function `(ctx) => EventData`. */
  data?: EventData | ((ctx: EventContext) => EventData);
  /** Gate: predicate that must return true for the event to fire. */
  when?: (ctx: EventContext) => boolean;
  /** Default true — fire-once per quiz session (dedup via internal cache). */
  once?: boolean;
}

/** Lifecycle phase for per-step events. */
export type TrackingPhase = "onView" | "onAnswer" | "onSubmit" | "onBack";

/** Lifecycle phase for quiz-level events. */
export type QuizPhase = "onQuizStart" | "onQuizComplete";

export interface StepTracking {
  onView?: EventSpec[];
  onAnswer?: EventSpec[];
  onSubmit?: EventSpec[];
  onBack?: EventSpec[];
}

export interface QuizTracking {
  /** Payload merged into every spec's resolved `data` (after context fields, before spec.data). */
  defaultEventData?: EventData;
  events?: Partial<Record<QuizPhase, EventSpec[]>>;
}
