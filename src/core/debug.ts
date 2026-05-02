/* ==========================================================================
   Meta Tracking — Debug Logger

   One compact line per event covering both the browser pixel and the Zaraz
   server-side leg, plus the trigger that fired it. Identity fields
   (event_id, external_id, fbp/fbc, geo) are stripped from the per-event
   payload display — they don't change between events and would just clutter
   the log. Print them once at boot via `debugSession()`.

   Format:
     META  <event> (<trigger>)  ✓ browser  ✓ zaraz   id=<short>  {data}

   Status glyphs:
     ✓ ok     — fired successfully
     ✗ fail   — code path threw
     —        — path not available (no fbq, no zaraz client/queue)
   ========================================================================== */

let enabled = false;

/* ----------------------------------------------------------------- styling --
   Pill-styled segments so events stand out from regular console noise.
   Each segment renders as a small filled badge separated by spaces — the
   META badge anchors the line, the event name is bold, and the browser /
   zaraz status pills are colored by outcome (green ok, red fail, gray n/a).
*/
const STYLE_BADGE =
  "background:#1877F2;color:#fff;padding:3px 8px;border-radius:4px;" +
  "font-weight:700;font-size:11px;letter-spacing:0.05em";
const STYLE_NAME =
  "color:#0F172A;font-weight:700;font-size:13px;padding:0 4px";
const STYLE_TRIGGER =
  "color:#6B7280;font-size:11px;font-style:italic";
const STYLE_PILL_OK =
  "background:#10B981;color:#fff;padding:2px 7px;border-radius:4px;" +
  "font-weight:600;font-size:10px";
const STYLE_PILL_FAIL =
  "background:#EF4444;color:#fff;padding:2px 7px;border-radius:4px;" +
  "font-weight:600;font-size:10px";
const STYLE_PILL_NA =
  "background:#9CA3AF;color:#fff;padding:2px 7px;border-radius:4px;" +
  "font-weight:600;font-size:10px";
const STYLE_DIM = "color:#9CA3AF;font-size:11px";
/** Reset sequence — empty string reverts the next text run to default. */
const STYLE_RESET = "";

/** Identity / session fields hidden from the per-event payload display. */
const HIDDEN_KEYS = new Set([
  "event_id",
  "external_id",
  "fbc",
  "fbp",
  "ct",
  "st",
  "zp",
  "country",
]);

export type FireStatus = "ok" | "fail" | "skipped";

export function initDebug(on: boolean): void {
  enabled = !!on;
}

export function isDebugEnabled(): boolean {
  return enabled;
}

function statusGlyph(s: FireStatus): string {
  return s === "ok" ? "✓" : s === "fail" ? "✗" : "—";
}

function pillStyle(s: FireStatus): string {
  return s === "ok"
    ? STYLE_PILL_OK
    : s === "fail"
      ? STYLE_PILL_FAIL
      : STYLE_PILL_NA;
}

/**
 * Trim "PageView_1777735795592_g9x6nivbw" to "g9x6nivbw" — the random tail
 * is enough to pair browser + zaraz lines visually on the rare occasion two
 * events of the same type fire close together.
 */
function shortId(id: string): string {
  const parts = id.split("_");
  return parts[parts.length - 1] || id;
}

function compactData(
  data?: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!data) return null;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(data)) {
    if (!HIDDEN_KEYS.has(k)) out[k] = data[k];
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Emit one log line summarising both legs of an event fire. Replaces the
 * pre-v0.4 pattern of two separate browser/zaraz lines.
 */
export function debugFire(
  name: string,
  eventId: string,
  browser: FireStatus,
  zaraz: FireStatus,
  data?: Record<string, unknown>,
  trigger?: string,
): void {
  if (!enabled) return;
  const compact = compactData(data);
  // 11 %c segments → 11 styles. Spaces between segments stay unstyled
  // (STYLE_RESET) so the pills don't bleed into each other visually.
  const fmt =
    `%cMETA%c ` +
    `%c${name}%c` +
    `${trigger ? ` %c(${trigger})%c` : `%c%c`} ` +
    ` %c${statusGlyph(browser)} browser%c ` +
    ` %c${statusGlyph(zaraz)} zaraz%c ` +
    ` %cid=${shortId(eventId)}`;
  const styles = [
    STYLE_BADGE,
    STYLE_RESET,
    STYLE_NAME,
    STYLE_RESET,
    STYLE_TRIGGER,
    STYLE_RESET,
    pillStyle(browser),
    STYLE_RESET,
    pillStyle(zaraz),
    STYLE_RESET,
    STYLE_DIM,
  ];
  if (compact) {
    console.log(fmt, ...styles, compact);
  } else {
    console.log(fmt, ...styles);
  }
}

/**
 * One-shot boot summary. Prints session identity once so it doesn't clutter
 * every event line.
 */
export function debugSession(
  pixelIds: string[],
  externalId: string,
  fbp: string,
): void {
  if (!enabled) return;
  const ids = pixelIds
    .map((p) => (p.length > 8 ? p.slice(0, 4) + "…" + p.slice(-4) : p))
    .join(",");
  const ext =
    externalId.length > 12
      ? externalId.slice(0, 4) + "…" + externalId.slice(-4)
      : externalId;
  const fbpTail = fbp ? fbp.slice(-12) : "(none)";
  console.log(
    `%cMETA%c %csession%c pixels=[${ids}]  external_id=${ext}  fbp=${fbpTail}`,
    STYLE_BADGE,
    STYLE_RESET,
    STYLE_TRIGGER,
    STYLE_DIM,
  );
}

/**
 * Log when an event was NOT fired and why. Visible for consent / kill-switch /
 * once-guard / resolver-opt-out failures without stepping through dist source.
 */
export function debugSkip(name: string, reason: string): void {
  if (!enabled) return;
  console.log(
    `%cMETA%c %c${name}%c %cskipped%c ${reason}`,
    STYLE_BADGE,
    STYLE_RESET,
    STYLE_NAME,
    STYLE_RESET,
    STYLE_PILL_NA,
    STYLE_DIM,
  );
}
