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
