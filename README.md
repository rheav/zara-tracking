# zara-tracking

Plug-and-play **Meta Pixel + Cloudflare Zaraz Conversions API** tracking.

Browser pixel and server-side CAPI deduplicated via a shared `event_id`.
Drop into any Next.js / Astro / Vite project on Cloudflare Pages.

---

## Why

Meta dedupes a pair of events when the browser pixel and the server-side CAPI
event share the same `event_id`. This package gives you that — wired up — so
you stop maintaining a parallel copy of `trackEvent` in every project.

```
┌──────────┐  fbq(name, data, {eventID})    ┌─────────────┐
│ browser  │ ─────────────────────────────▶ │             │
└──────────┘                                │ Meta Events │
┌──────────┐  zaraz.track(name, payload)    │             │
│  Zaraz   │ ─────────────────────────────▶ │             │
│  (CAPI)  │     event_id matches → dedup   └─────────────┘
└──────────┘
```

---

## Install

```bash
npm i github:rheav/zara-tracking
```

(Public registry not used yet — install straight from GitHub.)

---

## What you get

| Entry | Use for |
|-------|---------|
| `zara-tracking` | Core `trackEvent` + helpers, framework-free |
| `zara-tracking/react` | `<MetaPixel />` React/Next component |
| `zara-tracking/astro/MetaPixel.astro` | Astro component (path import) |
| `zara-tracking/middleware` | Cloudflare Pages `onRequest` (geo + 1st-party cookie) |
| `zara-tracking/config` | `buildConfigFromEnv()` env parser |

---

## Setup — Next.js (App Router)

**1. `.env`**
```
NEXT_PUBLIC_META_PIXEL_IDS=111111,222222
NEXT_PUBLIC_META_DEBUG=false
```

**2. `src/app/layout.tsx`**
```tsx
import { MetaPixel } from "zara-tracking/react";
import { buildConfigFromEnv } from "zara-tracking/config";

const cfg = buildConfigFromEnv({
  pixelIds: process.env.NEXT_PUBLIC_META_PIXEL_IDS,
  debug: process.env.NEXT_PUBLIC_META_DEBUG,
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <MetaPixel pixelIds={cfg.pixelIds} debug={cfg.debug} />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

**3. Fire events from anywhere**
```tsx
"use client";
import { trackEvent } from "zara-tracking";

<button onClick={() => trackEvent("InitiateCheckout", { value: 47, currency: "BRL" })}>
  Buy
</button>
```

---

## Setup — Astro

**1. `.env`**
```
PUBLIC_META_PIXEL_IDS=111111,222222
PUBLIC_META_DEBUG=false
```

**2. `src/config/tracking.ts`**
```ts
import { buildConfigFromEnv } from "zara-tracking/config";

const env = import.meta.env;
export const META_CONFIG = buildConfigFromEnv({
  pixelIds: env.PUBLIC_META_PIXEL_IDS,
  debug: env.PUBLIC_META_DEBUG,
});
```

**3. `src/layouts/Layout.astro`**
```astro
---
import MetaPixel from "zara-tracking/astro/MetaPixel.astro";
import { META_CONFIG } from "../config/tracking";
---
<head>
  <MetaPixel pixelIds={META_CONFIG.pixelIds} debug={META_CONFIG.debug} />
</head>

<script>
  // Re-fire PageView on view transitions (skips first load).
  import { trackEvent } from "zara-tracking";
  document.addEventListener("astro:page-load", () => {
    const w = window as unknown as { __META_FIRST_PAGEVIEW_DONE__?: boolean };
    if (!w.__META_FIRST_PAGEVIEW_DONE__) {
      w.__META_FIRST_PAGEVIEW_DONE__ = true;
      return;
    }
    trackEvent("PageView");
  });
</script>
```

**4. Fire events from any `.astro` page**
```astro
<button id="cta-buy">Buy</button>

<script>
  import { trackEvent } from "zara-tracking";
  document.querySelector("#cta-buy")?.addEventListener("click", () => {
    trackEvent("InitiateCheckout", { value: 47, currency: "BRL" });
  });
</script>
```

---

## Setup — Cloudflare Pages middleware (recommended)

The middleware injects `window.__GEO__` and `window.__EXTERNAL_ID__` into every
HTML response and sets a 1st-party `meta_external_id` cookie that survives
Safari ITP's 7-day localStorage cap.

**`functions/_middleware.ts`**
```ts
import { createOnRequest } from "zara-tracking/middleware";

export const onRequest = createOnRequest();
// or with options:
// export const onRequest = createOnRequest({ skipPaths: ["/api"] });
```

Without the middleware everything still works — `external_id` falls back to
localStorage + a JS-set cookie. Match quality drops slightly (no `ct/st/zp/country`
geo).

---

## Setup — Zaraz CAPI tool (Cloudflare dashboard)

Cloudflare Dash → Zaraz → **Add tool** → Facebook Conversions API.

Field mapping (Zaraz mustache):

| Meta field | Zaraz expression |
|------------|------------------|
| `event_name` | `{{ client.__zarazTrack }}` |
| `event_id` | `{{ client.event_id }}` |
| `user_data.external_id` | `{{ client.external_id }}` |
| `user_data.fbc` | `{{ client.fbc }}` |
| `user_data.fbp` | `{{ client.fbp }}` |
| `user_data.ct` | `{{ client.ct }}` |
| `user_data.st` | `{{ client.st }}` |
| `user_data.zp` | `{{ client.zp }}` |
| `user_data.country` | `{{ client.country }}` |
| `user_data.client_ip_address` | `{{ system.device.ip }}` |
| `user_data.client_user_agent` | `{{ system.device.userAgent }}` |
| `custom_data.value` | `{{ client.value }}` |
| `custom_data.currency` | `{{ client.currency }}` |

Triggers: `Event Name equals` one of `PageView | Purchase | InitiateCheckout |
Lead | ViewContent | AddToCart | CompleteRegistration`.

Verify in Meta Events Manager → Test Events. Browser + Server rows must show
the **Deduplicated** badge.

---

## API

### Standard helpers
```ts
import {
  trackEvent,                  // generic — any event name
  trackPageView,
  trackLead,
  trackViewContent,
  trackInitiateCheckout,
  trackAddToCart,
  trackPurchase,
  trackCompleteRegistration,
  initDebug,
} from "zara-tracking";
```

### Custom event
```ts
trackEvent("WatchedPromoVideo", { content_name: "spring_2026", value: 0 });
```

### Debug
```
NEXT_PUBLIC_META_DEBUG=true   # Next.js
PUBLIC_META_DEBUG=true        # Astro / Vite
```
Logs each fire on both sides:
```
META  browser PageView (id: PageView_1734...)
META  zaraz   PageView (id: PageView_1734...)
```

---

## How dedup works

`trackEvent(name, data)` does:

1. Generate one `event_id = name_<ts>_<random>`.
2. `fbq("track", name, data, { eventID: event_id })` — browser pixel.
3. `__ZARAZ_TRACK__(name, { event_id, external_id, fbc, fbp, ...geo, ...data })`
   — Zaraz forwards to Meta CAPI server-side.
4. Meta sees both with the same `event_id` → counts once.

If Zaraz hasn't loaded yet, events queue and flush when `window.zaraz.track`
becomes available (5s cap).

---

## SPA / view transitions

The boot script sets `window.__META_FIRST_PAGEVIEW_DONE__ = true` after the
initial PageView so SPA route-change listeners can guard against double fires
on first load.

For Astro `<ClientRouter />` see the snippet in **Setup — Astro**.

For Next.js App Router, the layout re-mount handles route changes for
`<head>` — but you can still attach a `usePathname` effect that fires
`trackEvent("PageView")` on transitions if you want explicit control.

---

## License

MIT © rheav
