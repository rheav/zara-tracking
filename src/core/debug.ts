/* ==========================================================================
   Meta Tracking — Debug Logger
   ========================================================================== */

let enabled = false;

const STYLE_META =
  "background:#1877F2;color:#fff;padding:2px 6px;border-radius:3px;font-size:11px";
const STYLE_TXT = "color:#1F2937;font-size:11px";

export function initDebug(on: boolean): void {
  enabled = !!on;
}

export function isDebugEnabled(): boolean {
  return enabled;
}

export function debugEvent(
  name: string,
  source: "browser" | "zaraz",
  eventId: string,
  data?: Record<string, unknown>,
): void {
  if (!enabled) return;
  console.log(
    `%c META %c ${source} ${name} (id: ${eventId})`,
    STYLE_META,
    STYLE_TXT,
    data || {},
  );
}

export function debugPixelInit(pixelIds: string[], externalId: string): void {
  if (!enabled) return;
  console.log(
    `%c META %c init ${pixelIds.length} pixel(s), external_id=${externalId}`,
    STYLE_META,
    STYLE_TXT,
  );
}
