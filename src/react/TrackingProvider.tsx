/* ==========================================================================
   <TrackingProvider config={trackingConfig} />

   Drop-in mount point for the whole tracking system. Renders the Meta Pixel
   boot script in <head> AND boots the runtime auto-binder (events, defaults,
   consent, SPA pageviews, data-attr binding) on the client.

   Usage:
     // app/layout.tsx
     import { TrackingProvider } from "zara-tracking/react/provider";
     import config from "../../tracking.config";

     export default function RootLayout({ children }) {
       return (
         <html><head><TrackingProvider config={config} /></head>
           <body>{children}</body>
         </html>
       );
     }
   ========================================================================== */

"use client";

import { useEffect } from "react";
import { MetaPixel } from "./MetaPixel";
import { runTracking } from "../runtime/auto-binder";
import type { RuntimeConfig } from "../core/types";

export interface TrackingProviderProps {
  config: RuntimeConfig;
}

export function TrackingProvider({ config }: TrackingProviderProps) {
  useEffect(() => {
    const handle = runTracking(config);
    return () => handle.destroy();
  }, [config]);

  return <MetaPixel pixelIds={config.pixelIds} debug={config.debug} />;
}

export default TrackingProvider;
