/* ==========================================================================
   Cloudflare Pages / Workers — edge middleware
   Injects window.__GEO__ + window.__EXTERNAL_ID__ into HTML responses, and
   sets a 1st-party `meta_external_id` cookie (Safari/ITP resilience —
   survives the 7-day localStorage cap).
   ========================================================================== */

interface CfProperties {
  city?: string;
  regionCode?: string;
  postalCode?: string;
  country?: string;
}

export interface MiddlewareEventContext {
  request: Request;
  next: () => Promise<Response>;
}

export interface MiddlewareOptions {
  /** Paths to bypass the rewriter entirely. Default skips common static + legal routes. */
  skipPaths?: string[];
  /** Cookie name for the persistent visitor id. Default `meta_external_id`. */
  cookieName?: string;
  /** Cookie max-age in seconds. Default 1 year. */
  cookieMaxAge?: number;
}

const DEFAULT_SKIP_PATHS = [
  "/privacy",
  "/terms",
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.svg",
  "/favicon.ico",
  "/404",
];

const DEFAULT_COOKIE_NAME = "meta_external_id";
const DEFAULT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function readCookie(
  header: string | null,
  name: string,
): string | null {
  if (!header) return null;
  const parts = header.split(";");
  for (const p of parts) {
    const [k, ...rest] = p.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function generateExternalId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
  return `v_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export function buildInitScript(
  geo: { ct: string; st: string; zp: string; country: string },
  externalId: string,
): string {
  return `<script>window.__GEO__=${JSON.stringify(geo)};window.__EXTERNAL_ID__=${JSON.stringify(externalId)};</script>`;
}

export function buildCookieHeader(
  cookieName: string,
  externalId: string,
  maxAge: number,
  secure: boolean,
): string {
  const parts = [
    `${cookieName}=${encodeURIComponent(externalId)}`,
    `Max-Age=${maxAge}`,
    "Path=/",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = any;

/**
 * Build a Cloudflare Pages `onRequest` handler.
 *
 * Usage (functions/_middleware.ts):
 *   import { createOnRequest } from "zara-tracking/middleware";
 *   export const onRequest = createOnRequest();
 *
 * Or with options:
 *   export const onRequest = createOnRequest({ skipPaths: ["/api"] });
 */
export function createOnRequest(options: MiddlewareOptions = {}) {
  const skipPaths = new Set(options.skipPaths ?? DEFAULT_SKIP_PATHS);
  const cookieName = options.cookieName ?? DEFAULT_COOKIE_NAME;
  const cookieMaxAge = options.cookieMaxAge ?? DEFAULT_COOKIE_MAX_AGE;

  return async function onRequest(
    context: MiddlewareEventContext,
  ): Promise<Response> {
    const url = new URL(context.request.url);
    if (skipPaths.has(url.pathname)) return context.next();

    const response = await context.next();
    const ct = response.headers.get("content-type") || "";
    if (!ct.includes("text/html")) return response;

    const cf = ((context.request as AnyObj).cf as CfProperties) || {};
    const geo = {
      ct: cf.city ? String(cf.city).toLowerCase().replace(/\s+/g, "") : "",
      st: cf.regionCode ? String(cf.regionCode).toLowerCase() : "",
      zp: cf.postalCode ? String(cf.postalCode) : "",
      country: cf.country ? String(cf.country).toLowerCase() : "",
    };

    const cookieHeader = context.request.headers.get("Cookie");
    let externalId = readCookie(cookieHeader, cookieName);
    let isNew = false;
    if (!externalId) {
      externalId = generateExternalId();
      isNew = true;
    }

    const initScript = buildInitScript(geo, externalId);
    const rewriter = new (globalThis as AnyObj).HTMLRewriter().on("head", {
      element(el: AnyObj) {
        el.prepend(initScript, { html: true });
      },
    });
    let transformed: Response = rewriter.transform(response);

    if (isNew) {
      const headers = new Headers(transformed.headers);
      headers.append(
        "Set-Cookie",
        buildCookieHeader(
          cookieName,
          externalId,
          cookieMaxAge,
          url.protocol === "https:",
        ),
      );
      transformed = new Response(transformed.body, {
        status: transformed.status,
        statusText: transformed.statusText,
        headers,
      });
    }

    return transformed;
  };
}

/** Default `onRequest` handler — equivalent to `createOnRequest()`. */
export const onRequest = createOnRequest();
