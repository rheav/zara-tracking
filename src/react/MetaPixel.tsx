/* ==========================================================================
   <MetaPixel /> — React/Next component
   Mount in <head>. Renders the inline boot script + <noscript> fallback img.
   ========================================================================== */

import { buildPixelInitScript } from "../core/pixel-script";

declare global {
  interface Window {
    __ZARA_EMPTY_WARNED__?: boolean;
  }
}

export interface MetaPixelProps {
  pixelIds: string[];
  debug?: boolean;
}

export function MetaPixel({ pixelIds, debug = false }: MetaPixelProps) {
  if (!pixelIds || pixelIds.length === 0) {
    if (typeof window !== "undefined" && !window.__ZARA_EMPTY_WARNED__) {
      window.__ZARA_EMPTY_WARNED__ = true;
      console.warn(
        "[zara-tracking] <MetaPixel> mounted with no pixelIds — nothing will fire. " +
          "Check tracking.config.{js,ts}.",
      );
    }
    return null;
  }
  const html = buildPixelInitScript(pixelIds, debug);
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: html }} />
      <noscript>
        {pixelIds.map((id) => (
          <img
            key={id}
            height="1"
            width="1"
            style={{ display: "none" }}
            src={`https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1`}
            alt=""
          />
        ))}
      </noscript>
    </>
  );
}

export default MetaPixel;
