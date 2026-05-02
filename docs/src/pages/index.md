---
layout: ../layouts/Docs.astro
title: zara-tracking
description: Plug-and-play Meta Pixel + Cloudflare Zaraz Conversions API tracking with deduplicated events.
---

<span class="docs-eyebrow">zara-tracking</span>

# Drop-in Meta Pixel + Zaraz CAPI

<p class="docs-tagline">
Browser pixel + server-side Conversions API, deduplicated via a shared
<code>event_id</code>. One config file. Works in Astro, Next.js, or any
web framework.
</p>

## What you get

- **Browser pixel** fires `fbq('track', ...)` with `eventID`.
- **Server-side CAPI** fires through Cloudflare Zaraz with the same `event_id`.
- **Edge middleware** injects geo + a 1st-party `external_id` cookie (Safari/ITP-resilient).
- **Declarative event registry** — write events once in `tracking.config.ts`, the auto-binder takes care of clicks, scroll depth, visibility, dwell, and more.
- **Designer-friendly markup** — `data-track-event="EventName"` on any element auto-fires.

## Install

Pull straight from GitHub. The `prepare` script builds `dist/` on install — no npm publish needed.

```bash
npm install github:rheav/zara-tracking
```

## Quick start (Astro)

### 1. Create `tracking.config.ts` at the project root

```ts
import type { RuntimeConfig } from "zara-tracking";

const config: RuntimeConfig = {
  pixelIds: ["YOUR_PIXEL_ID"],
  debug: import.meta.env.DEV,

  defaults: { currency: "USD" },

  events: {
    pricingVisible: {
      on: "visible",
      selector: "#pricing",
      event: "ViewContent",
      threshold: 0.3,
      once: true,
    },
    heroCta: {
      on: "click",
      selector: "a[href='#get-started']",
      event: "Lead",
      data: { content_name: "Hero CTA" },
    },
  },
};

export default config;
```

### 2. Register the integration

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import zaraTracking from "zara-tracking/astro-integration";

export default defineConfig({
  integrations: [zaraTracking()],
});
```

### 3. Add the Cloudflare Pages middleware

```ts
// functions/_middleware.ts
export { onRequest } from "zara-tracking/middleware";
```

That's it. `PageView` fires automatically on every load and SPA navigation.

## Three ways to add events

You don't have to pick one. Mix and match.

### A) HTML markup with `data-track-event`

The designer-friendly path. No JS, no config touch. Drop attributes onto the element:

```html
<button
  data-track-event="InitiateCheckout"
  data-track-value="97"
  data-track-currency="USD"
  data-track-content-name="Premium Plan"
>
  Buy
</button>
```

That fires `InitiateCheckout` with `{ value: 97, currency: "USD", content_name: "Premium Plan" }` on click. See the [attribute reference](#data-track--reference) below.

### B) Declarative `events: {}` block

For triggers that don't fit a single button — route changes, scroll depth, element visibility, form submits:

```ts
events: {
  thankYou: {
    on: "route",
    path: "/thank-you",
    event: "Purchase",
    data: ({ query }) => ({
      value: Number(query.v ?? 0),
      content_ids: [query.sku].filter(Boolean),
    }),
  },

  scroll75: {
    on: "scroll",
    percent: 75,
    event: "ScrollDepth",
  },

  leadForm: {
    on: "submit",
    selector: "form#lead",
    event: "Lead",
    data: ({ form }) => ({ content_name: form.get("plan") }),
  },
}
```

### C) `trackEvent()` from anywhere

The escape hatch for programmatic events:

```ts
import { trackEvent } from "zara-tracking";

trackEvent("InitiateCheckout", { value: 47 });
trackEvent("CustomEvent", { foo: "bar" });
```

Both pixel and Zaraz fire with a shared `event_id`. Always.

## Trigger types

| `on`        | Fires when                                                           |
| ----------- | -------------------------------------------------------------------- |
| `route`     | URL pathname matches `path` (string, prefix ending `/`, or RegExp)   |
| `click`     | Click bubbles up from an element matching `selector`                 |
| `submit`    | A `<form>` matching `selector` is submitted (`form` available in ctx) |
| `visible`   | Element enters the viewport (IntersectionObserver, default 50% threshold) |
| `scroll`    | Page scrolled past `percent`                                         |
| `dwell`     | After `seconds` of time on the page                                  |
| `video`     | `<video>` matching `selector` plays or ends                          |

Every entry takes an optional `data` resolver — either an object or a function `(ctx) => payload`. The `ctx` exposes `query`, `pathname`, `el`, `form`, and `event` depending on the trigger.

## `data-track-*` reference

Any element with `data-track-event="EventName"` is auto-wired.

| Attribute                  | Purpose                                                |
| -------------------------- | ------------------------------------------------------ |
| `data-track-event`         | **Required.** Meta event name.                         |
| `data-track-on`            | Trigger event. Default `"click"`.                      |
| `data-track-once`          | `"true"` to fire only once per session.                |
| `data-track-value`         | Parsed as Number.                                      |
| `data-track-currency`      | Currency code (USD, BRL…).                             |
| `data-track-content-name`  | Mapped to Meta `content_name`.                         |
| `data-track-content-ids`   | CSV → array. Mapped to Meta `content_ids`.             |
| `data-track-num-items`     | Parsed as Number.                                      |
| `data-track-*` (any other) | Becomes a custom payload field (kebab → camel).        |

> Earlier versions used `data-track="EventName"` (no `-event` suffix). Both attributes still work; if both are present, `data-track-event` wins. New markup should prefer `data-track-event` for readability.

Listeners are document-delegated, so this works for elements rendered after mount (SPA route changes, conditional renders, portals).

## Debug logging

Set `debug: true` in `tracking.config.ts` and the console prints one styled line per event:

```
[META] InitiateCheckout (data-attr:click)  [✓ browser]  [✓ zaraz]   id=ab7  {value:97, content_name:'Premium'}
[META] PageView (boot)                     [✓ browser]  [✓ zaraz]   id=k0o
[META] Lead skipped                        once-guard (key=heroCta)
```

Each event line covers both legs at once. Status pills are filled green when fired, red on exception, gray when the path isn't available (no `fbq` loaded, Zaraz not configured). The trigger label in parens (`route`, `click`, `visible`, `scroll N%`, `dwell Ns`, `video:phase`, `data-attr:click`, `boot`) tells you which rule fired without grepping the config.

A one-shot `session` line at boot prints the active pixel IDs + truncated identifiers so they don't repeat on every event.

## Verifying it's working

1. Open your site with `?fbclid=test123` appended (the `fbclid` makes the visit show up in Test Events reliably).
2. Open **Meta Events Manager → Pixels → your pixel → Test Events**.
3. You should see two rows for `PageView` within ~1 second of each other — one **Browser**, one **Server** — each with a **Deduplicated** badge and matching `event_id`.

If only **Browser** appears, the Zaraz tool isn't firing. Check **Cloudflare → Zaraz → Monitoring**.

If both appear without the **Deduplicated** badge, the `event_id` mapping in your Zaraz tool is wrong. Make sure it maps to `{{ client.event_id }}` (not `{{ client.eventID }}` or `{{ system.event.id }}`).

## Why a 1st-party cookie

Safari/ITP caps `localStorage` and 3rd-party cookies aggressively. The bundled middleware sets a `meta_external_id` cookie at the edge on first visit — same value also injected as `window.__EXTERNAL_ID__` so the browser pixel and CAPI pick up the same identifier. Returning visitors keep the same id for up to a year, which materially improves match quality on the CAPI side.

## License

MIT.
