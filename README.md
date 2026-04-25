# zara-tracking

Plug-and-play **Meta Pixel + Cloudflare Zaraz Conversions API** tracking.

The browser pixel and the server-side CAPI event share one `event_id`, so
Meta deduplicates the pair and counts each conversion once. Drop into any
Next.js / Astro / Vite project deployed to Cloudflare Pages.

> **Why two sides?** The browser pixel gets blocked by ad blockers, ITP,
> and brave-mode users. The server-side CAPI bypasses all of that. Running
> both with a shared `event_id` gives you the best of both worlds without
> double-counting.

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

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Install](#2-install)
3. [Environment variables](#3-environment-variables)
4. [Framework integration](#4-framework-integration)
   - [Next.js (App Router)](#nextjs-app-router)
   - [Astro](#astro)
5. [Cloudflare Pages middleware (recommended)](#5-cloudflare-pages-middleware-recommended)
6. [Cloudflare Zaraz — CAPI tool setup (one-time, dashboard)](#6-cloudflare-zaraz--capi-tool-setup-one-time-dashboard)
7. [Verify the pair is deduplicating](#7-verify-the-pair-is-deduplicating)
8. [Firing events](#8-firing-events)
9. [API reference](#9-api-reference)
10. [Debugging](#10-debugging)
11. [How dedup works internally](#11-how-dedup-works-internally)
12. [SPA / view-transition handling](#12-spa--view-transition-handling)
13. [Troubleshooting](#13-troubleshooting)
14. [License](#14-license)

---

## 1. Prerequisites

Before installing, have all of these ready:

- A **Meta Business / Events Manager** account with at least one **Pixel**
  created. Copy the numeric ID (e.g. `1234567890`) — you can use multiple.
- A **Meta Conversions API access token** for the same pixel
  (Events Manager → Settings → Generate access token).
- A **Cloudflare account** with **Pages** + **Zaraz** enabled on the zone
  hosting the site. Zaraz is free up to 100k events/month.
- A site already deployed to **Cloudflare Pages** (or about to be). The
  Pages domain must be the same one Zaraz is enabled on.
- Local Node.js ≥ 18.

If any of those are missing, sort that first — the package only does the
wiring; it can’t create the accounts.

---

## 2. Install

```bash
npm i github:rheav/zara-tracking
# or pnpm add github:rheav/zara-tracking
# or yarn add github:rheav/zara-tracking
```

The package builds itself on install (`prepare` script runs `tsup`), so the
`dist/` folder appears in `node_modules/zara-tracking/dist/` automatically.
No publish to the public npm registry yet.

---

## 3. Environment variables

Two values, used by both sides.

| Var (Next.js) | Var (Astro / Vite) | Meaning |
|---|---|---|
| `NEXT_PUBLIC_META_PIXEL_IDS` | `PUBLIC_META_PIXEL_IDS` | Comma-separated Meta pixel IDs. Empty disables tracking entirely. |
| `NEXT_PUBLIC_META_DEBUG` | `PUBLIC_META_DEBUG` | `true` to log every event to the console. Default `false`. |

Add to `.env` locally and to **Pages → Settings → Environment variables**
in production. `_PUBLIC_`-prefixed vars are the only ones bundled to the
browser by the respective frameworks.

`.env` (example):

```
NEXT_PUBLIC_META_PIXEL_IDS=1234567890
NEXT_PUBLIC_META_DEBUG=false
```

Multi-pixel:

```
NEXT_PUBLIC_META_PIXEL_IDS=1234567890,9876543210
```

---

## 4. Framework integration

### Next.js (App Router)

**a. Mount `<MetaPixel />` in the root `<head>`** so the boot script runs
before React hydrates.

`src/app/layout.tsx` (or `.jsx`):

```tsx
import { MetaPixel } from "zara-tracking/react";
import { buildConfigFromEnv } from "zara-tracking/config";

const meta = buildConfigFromEnv({
  pixelIds: process.env.NEXT_PUBLIC_META_PIXEL_IDS,
  debug: process.env.NEXT_PUBLIC_META_DEBUG,
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <MetaPixel pixelIds={meta.pixelIds} debug={meta.debug} />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

The component:

- Renders nothing visible.
- Returns `null` when `pixelIds` is empty.
- Loads `fbevents.js` asynchronously.
- Resolves `external_id` (server cookie → localStorage → cookie → fresh UUID).
- Captures `?fbclid=` URL param into `_fbc` cookie (90-day lifetime).
- Installs the `__ZARAZ_TRACK__` queue.
- Fires the deduplicated `PageView` automatically.
- Renders a `<noscript>` `<img>` fallback per pixel id.

Done. Initial PageView is now firing on both sides.

---

### Astro

**a. Wrap env parsing once.**

`src/config/tracking.ts`:

```ts
import { buildConfigFromEnv } from "zara-tracking/config";

const env = import.meta.env;

export const META_CONFIG = {
  ...buildConfigFromEnv({
    pixelIds: env.PUBLIC_META_PIXEL_IDS,
    debug: env.PUBLIC_META_DEBUG,
  }),
  defaultCurrency: "BRL" as const,
};
```

**b. Mount `<MetaPixel />` in the layout `<head>`** + add the SPA
PageView re-fire if you use `<ClientRouter />` view transitions.

`src/layouts/Layout.astro`:

```astro
---
import { ClientRouter } from "astro:transitions";
import MetaPixel from "zara-tracking/astro/MetaPixel.astro";
import { META_CONFIG } from "../config/tracking";
---
<html lang="en">
  <head>
    <MetaPixel pixelIds={META_CONFIG.pixelIds} debug={META_CONFIG.debug} />
    <ClientRouter />
  </head>
  <body><slot /></body>
</html>

<script>
  // Re-fire PageView on every Astro view transition (skip first load).
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

Static/MPA Astro (no `<ClientRouter />`)? Drop the bottom `<script>` block.
The boot script fires PageView once per full page load, which is exactly
what you want for MPA navigation.

---

## 5. Cloudflare Pages middleware (recommended)

The middleware does two things on every HTML response:

1. **Injects `window.__GEO__`** with `{ ct, st, zp, country }` from
   `request.cf` so Zaraz can include city/state/postal/country in the CAPI
   payload (improves Meta match quality 3–8% in tests).
2. **Sets a 1st-party `meta_external_id` cookie** with `Max-Age=1y`. This
   beats Safari ITP, which caps localStorage to 7 days but leaves
   server-set cookies alone.

`functions/_middleware.ts`:

```ts
export { onRequest } from "zara-tracking/middleware";
```

That’s it. Default skip list: `/privacy`, `/terms`, `/robots.txt`,
`/sitemap.xml`, `/favicon.svg`, `/favicon.ico`, `/404`. Customize:

```ts
import { createOnRequest } from "zara-tracking/middleware";

export const onRequest = createOnRequest({
  skipPaths: ["/privacy", "/terms", "/api"],
  cookieName: "meta_external_id",
  cookieMaxAge: 60 * 60 * 24 * 365,
});
```

**Without the middleware** the package still works — `external_id` falls
back to localStorage + a JS-set cookie, and geo fields stay empty. You’ll
lose ~3–8% match quality but no events break.

---

## 6. Cloudflare Zaraz — CAPI tool setup (one-time, dashboard)

This is the manual step that wires the browser → Zaraz → Meta CAPI bridge.
Do it once per Cloudflare zone.

**Step 1 — open the Zaraz config**

> Cloudflare Dashboard → Pick the zone (your domain) → **Zaraz** →
> **Tools** tab → **Add new tool** → search **Facebook Conversions API**
> → **Add tool**.

**Step 2 — name + auth**

- **Tool name:** `Meta CAPI` (anything, just for you).
- **Pixel ID:** the same numeric ID as `NEXT_PUBLIC_META_PIXEL_IDS`. If
  you have multiple, create one tool per pixel.
- **API access token:** paste from Events Manager → Settings.
- **Test event code** (optional during dev): paste your test code so
  events show up under Test Events instead of production.

**Step 3 — field mapping**

This is where each event payload key gets mapped to a Meta CAPI field.
Use the dashboard’s **Add field** dropdowns. Mustache expressions:

| Meta field | Source | Zaraz expression |
|---|---|---|
| `event_name` | client | `{{ client.__zarazTrack }}` |
| `event_id` | client | `{{ client.event_id }}` |
| `event_time` | system | leave default |
| `action_source` | static | `website` |
| `event_source_url` | system | `{{ system.page.url }}` |
| `user_data.external_id` | client | `{{ client.external_id }}` |
| `user_data.fbc` | client | `{{ client.fbc }}` |
| `user_data.fbp` | client | `{{ client.fbp }}` |
| `user_data.ct` | client | `{{ client.ct }}` |
| `user_data.st` | client | `{{ client.st }}` |
| `user_data.zp` | client | `{{ client.zp }}` |
| `user_data.country` | client | `{{ client.country }}` |
| `user_data.client_ip_address` | system | `{{ system.device.ip }}` |
| `user_data.client_user_agent` | system | `{{ system.device.userAgent }}` |
| `custom_data.value` | client | `{{ client.value }}` |
| `custom_data.currency` | client | `{{ client.currency }}` |
| `custom_data.content_ids` | client | `{{ client.content_ids }}` |
| `custom_data.content_name` | client | `{{ client.content_name }}` |
| `custom_data.content_type` | client | `{{ client.content_type }}` |
| `custom_data.num_items` | client | `{{ client.num_items }}` |

**Step 4 — triggers**

By default Zaraz fires the tool on every event. Restrict to your funnel
events:

> **Triggers** → **Add trigger** → name it `Meta funnel` →
> **Match all of the following** → `Event Name equals` →
> add one rule per event you fire:
> `PageView`, `Purchase`, `InitiateCheckout`, `Lead`, `ViewContent`,
> `AddToCart`, `CompleteRegistration`, plus any custom event names.

**Step 5 — save + publish**

> Click **Save** on the tool → top-right **Publish** to push the Zaraz
> config to the edge. Without **Publish**, the tool stays in draft and
> nothing fires.

You only repeat this step when you add a new event name not yet in the
trigger list, or rotate the access token.

---

## 7. Verify the pair is deduplicating

1. Open `https://yoursite.com/?fbclid=test123` in a fresh window.
   The `fbclid` makes the visit attributable so it shows up in Test Events
   reliably.
2. Open **Meta Events Manager → Pixels → your pixel → Test Events tab**.
3. You should see two rows for `PageView` within ~1 second of each other:
   - one labelled **Browser**
   - one labelled **Server**
4. Each row should carry a **Deduplicated** badge with the matching
   `event_id`.
5. Trigger any other event (click a Buy button, etc.) — same expectation:
   two rows, one badge.

If only **Browser** appears: Zaraz tool isn’t firing. Check **Cloudflare →
Zaraz → Monitoring** for tool fires.
If only **Server** appears: ad blocker is eating `fbevents.js`. Test in a
clean profile.
If both appear with **no Deduplicated badge**: `event_id` mapping is wrong
in the Zaraz tool — re-check Step 6 row 2.

---

## 8. Firing events

Always use `addEventListener` — never inline `onClick=` / `onSubmit=`. This
keeps the tracking layer detached from the JSX/Astro markup, makes it
trivial to remove later, and works the same in every framework.

### A) Click on a button (any framework)

```html
<button id="cta-buy">Buy</button>

<script>
  import { trackEvent } from "zara-tracking";

  document.addEventListener("DOMContentLoaded", () => {
    document
      .getElementById("cta-buy")
      ?.addEventListener("click", () => {
        trackEvent("InitiateCheckout", { value: 47, currency: "BRL" });
      });
  });
</script>
```

### B) Page-bound event (form submit, scroll, etc.)

```html
<form id="lead-form">…</form>

<script>
  import { trackEvent } from "zara-tracking";

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("lead-form")?.addEventListener("submit", (e) => {
      const data = new FormData(e.currentTarget as HTMLFormElement);
      trackEvent("Lead", { content_name: String(data.get("plan") ?? "") });
    });
  });
</script>
```

### C) Astro `.astro` page

`src/pages/upsell.astro`:

```astro
<button id="cta-upsell">Add upgrade</button>

<script>
  import { trackEvent } from "zara-tracking";

  document.addEventListener("astro:page-load", () => {
    document
      .getElementById("cta-upsell")
      ?.addEventListener("click", () => {
        trackEvent("AddToCart", { value: 27, currency: "BRL" });
      });
  });
</script>
```

> Use `astro:page-load` instead of `DOMContentLoaded` so the listener
> rebinds after every view transition. Inline `<script>` blocks in
> `.astro` are bundled by Vite, so ESM `import` works.

### D) Next.js client component

```tsx
"use client";
import { useEffect, useRef } from "react";
import { trackEvent } from "zara-tracking";

export function BuyButton() {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => trackEvent("InitiateCheckout", { value: 47, currency: "BRL" });
    el.addEventListener("click", handler);
    return () => el.removeEventListener("click", handler);
  }, []);

  return <button ref={ref}>Buy</button>;
}
```

### E) Thank-you / confirmation page (Purchase)

```html
<script>
  import { trackEvent } from "zara-tracking";

  document.addEventListener("DOMContentLoaded", () => {
    // Pull real values from query params or a server-handed-off blob.
    const sp = new URLSearchParams(location.search);
    trackEvent("Purchase", {
      value: Number(sp.get("v") ?? 47),
      currency: sp.get("c") ?? "BRL",
      content_ids: [sp.get("sku") ?? ""].filter(Boolean),
    });
  });
</script>
```

---

## 9. API reference

```ts
import {
  // Generic — any event name. Use this for custom events.
  trackEvent,

  // Standard Meta events — thin wrappers around trackEvent.
  trackPageView,
  trackLead,
  trackViewContent,
  trackInitiateCheckout,
  trackAddToCart,
  trackPurchase,
  trackCompleteRegistration,

  // Toggle console logging at runtime (overrides env var).
  initDebug,
  isDebugEnabled,

  // Low-level utilities (rarely needed in app code).
  generateEventId,
  getCookie,
  setCookie,
  getFbc,
  getFbp,
  getOrCreateExternalId,
  buildPixelInitScript,
} from "zara-tracking";

import type {
  EventData,
  TrackingConfig,
  EventTriggerConfig,
  ZarazPayload,
} from "zara-tracking";
```

`trackEvent` signature:

```ts
function trackEvent(eventName: string, data?: EventData): void;

interface EventData {
  value?: number;
  currency?: string;
  content_ids?: string[];
  content_type?: string;
  content_name?: string;
  num_items?: number;
  [key: string]: unknown; // any custom field passes through
}
```

---

## 10. Debugging

Set debug on:

```
NEXT_PUBLIC_META_DEBUG=true     # Next.js
PUBLIC_META_DEBUG=true          # Astro / Vite
```

Or at runtime:

```ts
import { initDebug } from "zara-tracking";
initDebug(true);
```

Console output for each event:

```
META  browser PageView (id: PageView_1737380012345_ab12cd34e)
META  zaraz   PageView (id: PageView_1737380012345_ab12cd34e) {…payload}
```

Both lines should print with **identical** `event_id`. If only one prints,
see Troubleshooting below.

---

## 11. How dedup works internally

`trackEvent(name, data)` does the following, in order:

1. Generates one `event_id = "${name}_${Date.now()}_${random9}"`.
2. If `window.fbq` is loaded → `fbq("track", name, data, { eventID })`.
3. Builds a Zaraz payload:
   ```js
   { event_id, external_id, fbc, fbp, ct, st, zp, country, ...data }
   ```
4. If `window.__ZARAZ_TRACK__` exists (queue installed by boot script) →
   queue or fire immediately.
5. Otherwise falls back to `window.zaraz.track` if Zaraz already loaded.
6. The Zaraz tool (configured in step 6) maps fields to Meta CAPI and POSTs
   to `graph.facebook.com/v.../events`.
7. Meta sees both events with the same `event_id` and `event_name` →
   collapses the pair and counts it as one conversion.

The 5-second poll inside the boot script handles the case where Zaraz’s
own loader hasn’t finished yet — events fired before Zaraz is ready get
queued and flushed automatically.

---

## 12. SPA / view-transition handling

The boot script sets `window.__META_FIRST_PAGEVIEW_DONE__ = true` after
firing the initial PageView. SPA route-change listeners use that flag to
avoid double-firing on first load.

- **Astro `<ClientRouter />`** → use the `astro:page-load` listener shown
  in the Astro setup.
- **Next.js App Router** → the root layout persists across routes, so the
  boot script runs once. Add a client component that listens to
  `usePathname()` changes and calls `trackEvent("PageView")` only if you
  actually want a PageView per virtual route.
- **Plain MPA / SSR** → nothing extra. Each full page load runs the boot
  script, which fires PageView once.

---

## 13. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| **Only Browser row in Test Events** | Zaraz tool not configured or trigger doesn’t match | Check Cloudflare → Zaraz → Tools → trigger has `Event Name equals <name>`. Hit **Publish** after edits. |
| **Only Server row in Test Events** | Ad blocker, ITP, or fbevents.js blocked | Test in a clean profile / incognito. Check Network tab for `fbevents.js`. |
| **Both rows but no Deduplicated badge** | `event_id` field mapping wrong in Zaraz tool | Re-check Step 6 row 2 — must be `{{ client.event_id }}`, not anything else. |
| **`window.fbq is not defined`** | Boot script not in `<head>` or `<MetaPixel />` returned null | Check the rendered HTML — pixel IDs env var must be non-empty; component is mounted in `<head>`, not `<body>`. |
| **Events fire in dev but not prod** | Env vars not set on Cloudflare Pages | Pages → Settings → Environment variables → add both `*_META_PIXEL_IDS` and `*_META_DEBUG`. Redeploy. |
| **`external_id` empty on first visit** | Middleware not deployed | Add `functions/_middleware.ts` with `export { onRequest } from "zara-tracking/middleware"`. Redeploy. (Optional but recommended.) |
| **Match quality stuck around 4–5/10** | Geo fields missing | Confirm middleware is deployed (`window.__GEO__` should be set in DOM source). Confirm Zaraz tool maps `user_data.ct/st/zp/country` to `client.ct/st/zp/country`. |
| **Cookie not set in Safari** | Middleware skipping path | Check skipPaths — entry HTML routes shouldn’t be in the skip list. |
| **TypeScript can’t find `zara-tracking/astro/MetaPixel.astro`** | Astro project missing `astro` types or moduleResolution | tsconfig.json `compilerOptions.moduleResolution` should be `"Bundler"` or `"NodeNext"`. |

---

## 14. License

MIT © rheav
