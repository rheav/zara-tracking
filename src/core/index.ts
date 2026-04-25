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

export { initDebug, isDebugEnabled } from "./debug";

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
} from "./types";

export { buildPixelInitScript } from "./pixel-script";
