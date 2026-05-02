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

const STYLE_BADGE =
  "background:#1877F2;color:#fff;padding:2px 6px;border-radius:3px;font-weight:600";
const STYLE_NAME = "color:#1F2937;font-weight:600";
const STYLE_DIM = "color:#6B7280";
const STYLE_OK = "color:#059669;font-weight:600";
const STYLE_FAIL = "color:#DC2626;font-weight:600";
const STYLE_NA = "color:#9CA3AF";

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

function statusStyle(s: FireStatus): string {
  return s === "ok" ? STYLE_OK : s === "fail" ? STYLE_FAIL : STYLE_NA;
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
  const triggerStr = trigger ? ` (${trigger})` : "";
  const compact = compactData(data);
  const fmt =
    `%c META %c ${name}${triggerStr} ` +
    `%c${statusGlyph(browser)} browser%c  ` +
    `%c${statusGlyph(zaraz)} zaraz%c  id=${shortId(eventId)}`;
  const styles = [
    STYLE_BADGE,
    STYLE_NAME,
    statusStyle(browser),
    STYLE_DIM,
    statusStyle(zaraz),
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
    `%c META %c session  pixels=[${ids}]  external_id=${ext}  fbp=${fbpTail}`,
    STYLE_BADGE,
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
    `%c META %c skipped ${name} — ${reason}`,
    STYLE_BADGE,
    STYLE_DIM,
  );
}
