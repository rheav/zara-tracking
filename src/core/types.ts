/* ==========================================================================
   Meta Tracking — Type Definitions
   Framework-agnostic. Safe to import from any runtime (browser, edge, node).
   ========================================================================== */

export interface EventData {
  value?: number;
  currency?: string;
  content_ids?: string[];
  content_type?: string;
  content_name?: string;
  num_items?: number;
  [key: string]: unknown;
}

export interface ZarazPayload extends EventData {
  event_id: string;
  external_id: string;
  fbc: string;
  fbp: string;
  ct?: string;
  st?: string;
  zp?: string;
  country?: string;
}

/* ==========================================================================
   Auto-binder — declarative event registry
   ========================================================================== */

/**
 * Per-trigger context passed to data resolvers.
 * Members vary by trigger type — see DataResolver below for which ones are
 * present in which trigger.
 */
export interface TriggerContext {
  /** URL search params as plain object. Always present. */
  query: Record<string, string>;
  /** Current `location.pathname`. Always present. */
  pathname: string;
  /** Element that fired the trigger. click/submit/visible/video. */
  el?: Element;
  /** Parsed FormData from a form submit. submit only. */
  form?: FormData;
  /** The DOM event that fired. click/submit/video. */
  event?: Event;
}

export type DataResolver =
  | EventData
  | ((ctx: TriggerContext) => EventData | undefined | null);

interface BaseEventDef {
  /** Standard or custom Meta event name. e.g. "Purchase", "Lead". */
  event: string;
  /** Static payload or function (ctx) => payload. */
  data?: DataResolver;
  /** Fire only once across the session. Default false. */
  once?: boolean;
}

export type EventDefinition =
  | (BaseEventDef & {
      on: "route";
      /** Exact pathname match (string), prefix (string ending /), or RegExp. */
      path: string | RegExp;
    })
  | (BaseEventDef & { on: "click"; selector: string })
  | (BaseEventDef & { on: "submit"; selector: string })
  | (BaseEventDef & {
      on: "visible";
      selector: string;
      /** IntersectionObserver threshold 0–1. Default 0.5. */
      threshold?: number;
    })
  | (BaseEventDef & {
      on: "scroll";
      /** Percent of page scrolled (0–100). */
      percent: number;
    })
  | (BaseEventDef & {
      on: "dwell";
      /** Seconds of time on page before fire. */
      seconds: number;
    })
  | (BaseEventDef & {
      on: "video";
      selector: string;
      /** Which video event to map to the Meta event. */
      phase: "play" | "ended";
    });

/** Full runtime config — what `runTracking()` accepts. */
export interface RuntimeConfig {
  pixelIds: string[];
  debug?: boolean;
  /** Master kill-switch. false → nothing fires. */
  enabled?: boolean;
  /** Consent gate. Polled before every fire. Default `() => true`. */
  consent?: () => boolean;
  /** Defaults merged into every event payload. */
  defaults?: EventData;
  /** Re-fire PageView on SPA route change (with first-load guard). */
  spaPageViews?: boolean;
  /**
   * Auto-bind elements with `data-track="EventName"` attribute.
   * Reads `data-track-value`, `data-track-currency`, `data-track-content-name`,
   * `data-track-content-ids` (CSV), and any `data-track-*` as custom field.
   */
  autoBindDataAttrs?: boolean;
  /** Declarative event registry. Key is a label for your reference. */
  events?: Record<string, EventDefinition>;
  /** Free-form extras (e.g. defaultCurrency). */
  [key: string]: unknown;
}

/* ==========================================================================
   Legacy — kept for back-compat with anyone still using EventTriggerConfig
   ========================================================================== */

export interface EventTriggerConfig {
  type: "click" | "scroll" | "timer";
  selector?: string;
  threshold?: number;
  delay?: number;
  once?: boolean;
  eventData?: EventData;
}

export interface TrackingConfig {
  pixelIds: string[];
  debug?: boolean;
  events?: Record<string, EventTriggerConfig>;
}
