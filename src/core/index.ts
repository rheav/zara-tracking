/* ==========================================================================
   zara-tracking — Public Core API
   Framework-free. Import from any runtime.
   ========================================================================== */

export {
  trackEvent,
  trackPageView,
  trackLead,
  trackViewContent,
  trackInitiateCheckout,
  trackAddToCart,
  trackPurchase,
  trackCompleteRegistration,
} from "./tracker";

export {
  generateEventId,
  getCookie,
  setCookie,
  getFbc,
  getFbp,
  getOrCreateExternalId,
} from "./utils";

export { initDebug, isDebugEnabled, debugSkip } from "./debug";

export {
  configureTracking,
  getRuntimeState,
  shouldFire,
  mergeDefaults,
} from "./runtime-state";

export type {
  TrackingConfig,
  EventTriggerConfig,
  EventData,
  ZarazPayload,
  RuntimeConfig,
  EventDefinition,
  DataResolver,
  TriggerContext,
} from "./types";

export { buildPixelInitScript } from "./pixel-script";
export { initPixel } from "./init-pixel";

// Re-exported from `./config` so consumers only need one import path:
//   import { defineTrackingConfig, trackEvent } from "zara-tracking";
// The `zara-tracking/config` subpath remains for back-compat.
export { defineTrackingConfig, buildConfigFromEnv } from "../config/index";
export type {
  ParsedConfig,
  BuildConfigInput,
  DefineTrackingConfigInput,
} from "../config/index";
