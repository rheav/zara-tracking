# zara-tracking

Plug-and-play **Meta Pixel + Cloudflare Zaraz Conversions API** tracking.

The browser pixel and the server-side CAPI event share one `event_id`, so
Meta deduplicates the pair and counts each conversion once. Drop-in for
Next.js, Astro, or any web framework deployed to Cloudflare Pages.

```
┌──────────┐  fbq(name, data, {eventID})    ┌─────────────┐
│ browser  │ ─────────────────────────────▶ │             │
└──────────┘                                │ Meta Events │
┌──────────┐  zaraz.track(name, payload)    │             │
│  Zaraz   │ ─────────────────────────────▶ │             │
│  (CAPI)  │     event_id matches → dedup   └─────────────┘
└──────────┘
```

> Why both sides? The browser pixel gets blocked by ad blockers, ITP, and
> brave-mode users. Server-side CAPI bypasses all of that. Running both
> with a shared `event_id` gives you the best of both worlds, no
> double-counting.

---

## Table of contents

1. [What you need](#1-what-you-need)
2. [Setup (5 steps)](#2-setup-5-steps)
3. [Adding events](#3-adding-events)
4. [Config reference](#4-config-reference)
5. [`data-track` attribute reference](#5-data-track-attribute-reference)
6. [Verify it's working](#6-verify-its-working)
7. [Add-ons (quiz, testing)](#7-add-ons-quiz-testing)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. What you need

Before you install:

- A **Meta Business / Events Manager** account with at least one **Pixel**
  created. Copy the numeric ID (e.g. `1234567890`).
- A **Meta Conversions API access token** for that pixel
  (Events Manager → Settings → Generate access token).
- A **Cloudflare** account with **Pages** + **Zaraz** enabled on your
  domain. (Zaraz is free up to 100k events/month.)
- Node.js ≥ 18.

If any of those are missing, set them up first — this package only does
the wiring, it can't create the accounts.

---

## 2. Setup (5 steps)

### Step 1 — Install

```bash
npm i github:rheav/zara-tracking
```

### Step 2 — Create `tracking.config.ts` at the project root

This single file holds your pixel IDs and any custom events. Minimum
viable:

```ts
// tracking.config.ts
import { defineTrackingConfig } from "zara-tracking";

export default defineTrackingConfig({
  pixelIds: ["1234567890"],
  currency: "BRL",
});
```

That's it. With this config:

- `PageView` fires automatically on first load and on SPA route changes.
- Any element with `data-track="EventName"` in your HTML auto-fires.
- Every event payload includes `currency: "BRL"`.

For all available options see [§4](#4-config-reference).

### Step 3 — Wire it into your framework (one line)

**Next.js (App Router)** — mount in your root layout's `<head>`:

```tsx
// src/app/layout.tsx
import { TrackingProvider } from "zara-tracking/react/provider";
import config from "../../tracking.config";

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <TrackingProvider config={config} />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

**Astro** — register the integration in `astro.config.mjs`:

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import zaraTracking from "zara-tracking/astro-integration";

export default defineConfig({
  integrations: [zaraTracking()],
});
```

The integration does everything for you — pixel boot, runtime, SPA
PageView, declarative events. **No tracking code in `Layout.astro`.**

### Step 4 — Add the Cloudflare Pages middleware (one line)

```ts
// functions/_middleware.ts
export { onRequest } from "zara-tracking/middleware";
```

This injects geo data (`city`, `state`, `country`) into every page and
sets a 1st-party `meta_external_id` cookie that survives Safari ITP.
Skip this step and tracking still works, just with ~3–8% lower match
quality.

### Step 5 — Configure Zaraz in Cloudflare (one-time, dashboard)

This wires browser → Zaraz → Meta CAPI. Do it once per Cloudflare zone.

1. **Cloudflare Dashboard** → your domain → **Zaraz** → **Tools** →
   **Add new tool** → **Facebook Conversions API**.
2. **Tool name:** `Meta CAPI` (anything you want).
3. **Pixel ID:** the same numeric ID from `tracking.config.ts`.
4. **API access token:** paste from Events Manager → Settings.
5. **Field mapping** — add these (Mustache-style expressions):

   | Meta field                    | Zaraz expression                |
   | ----------------------------- | ------------------------------- |
   | `event_name`                  | `{{ client.__zarazTrack }}`     |
   | `event_id`                    | `{{ client.event_id }}`         |
   | `action_source`               | `website` (static value)        |
   | `event_source_url`            | `{{ system.page.url }}`         |
   | `user_data.external_id`       | `{{ client.external_id }}`      |
   | `user_data.fbc`               | `{{ client.fbc }}`              |
   | `user_data.fbp`               | `{{ client.fbp }}`              |
   | `user_data.ct`                | `{{ client.ct }}`               |
   | `user_data.st`                | `{{ client.st }}`               |
   | `user_data.zp`                | `{{ client.zp }}`               |
   | `user_data.country`           | `{{ client.country }}`          |
   | `user_data.client_ip_address` | `{{ system.device.ip }}`        |
   | `user_data.client_user_agent` | `{{ system.device.userAgent }}` |
   | `custom_data.value`           | `{{ client.value }}`            |
   | `custom_data.currency`        | `{{ client.currency }}`         |
   | `custom_data.content_ids`     | `{{ client.content_ids }}`      |
   | `custom_data.content_name`    | `{{ client.content_name }}`     |

6. **Triggers** → **Add trigger** → name it `Meta funnel` → match on
   `Event Name equals` for each event you fire (`PageView`, `Purchase`,
   `InitiateCheckout`, `Lead`, etc.).
7. **Save** → top-right **Publish**. Without **Publish**, nothing fires
   server-side.

You only repeat this when you add a new event name not yet in the trigger
list, or when you rotate the access token.

---

## 3. Adding events

You have **three ways** to fire events. Pick whichever fits the moment.

### A) HTML markup with `data-track` (designer-friendly)

No JS, no config row. Drop attributes into the element:

```html
<button
  data-track="InitiateCheckout"
  data-track-value="47"
  data-track-currency="BRL"
  data-track-content-name="Premium Plan"
>
  Buy
</button>
```

That fires `InitiateCheckout` with the payload `{ value: 47, currency: "BRL", content_name: "Premium Plan" }` on click. Full attribute list in
[§5](#5-data-track-attribute-reference).

### B) Declarative `events: {}` block in `tracking.config.ts`

For events you want fired on richer triggers (route change, scroll
depth, element visible, etc.) without touching markup:

```ts
import { defineTrackingConfig } from "zara-tracking";

export default defineTrackingConfig({
  pixelIds: ["1234567890"],
  currency: "BRL",
  events: {
    // Fire when a URL pattern matches
    thankYou: {
      on: "route",
      path: "/thank-you",
      event: "Purchase",
      data: ({ query }) => ({
        value: Number(query.v ?? 47),
        content_ids: [query.sku].filter(Boolean),
      }),
    },

    // Fire on element visibility (50% in viewport)
    pricingViewed: {
      on: "visible",
      selector: "#pricing",
      event: "ViewContent",
      data: { content_name: "pricing-section" },
    },

    // Fire on scroll depth
    scroll75: {
      on: "scroll",
      percent: 75,
      event: "ScrollDepth",
      data: { content_name: "75pct" },
    },

    // Fire on form submit
    leadForm: {
      on: "submit",
      selector: "form#lead",
      event: "Lead",
      data: ({ form }) => ({ content_name: form.get("plan") }),
    },
  },
});
```

Every entry is keyed by a label of your choice (used for the `once`
dedup guard). All available trigger shapes are in [§4](#4-config-reference).

### C) `trackEvent()` from anywhere in code (escape hatch)

For programmatic events with logic that doesn't fit a config block:

```ts
import { trackEvent } from "zara-tracking";

// React onClick handler
<button onClick={() => trackEvent("InitiateCheckout", { value: 47 })}>Buy</button>;

// Astro page <script>
<script>
  import { trackEvent } from "zara-tracking";
  if (someCondition) trackEvent("CustomEvent", { foo: "bar" });
</script>;

// Anywhere — vanilla JS, vue, svelte, etc.
trackEvent("Lead", { value: 0 });
```

`trackEvent(name, data?)` always fires both the browser pixel and Zaraz
CAPI with a shared `event_id`.

---

## 4. Config reference

`defineTrackingConfig({ ... })` accepts:

| Option              | Type                       | Default              | What it does |
|---------------------|----------------------------|----------------------|--------------|
| `pixelIds`          | `string[]` \| `string`     | **required**         | Meta Pixel IDs. Comma-separated string also OK. |
| `currency`          | `string`                   | —                    | Shortcut for `defaults.currency`. Merged into every payload. |
| `defaults`          | `EventData`                | `{}`                 | Object merged into every event payload. |
| `enabled`           | `boolean`                  | `true`               | Master kill-switch. Set `false` in staging branches. |
| `debug`             | `boolean`                  | `false`              | Log every event + skip-reasons to the console. |
| `consent`           | `() => boolean`            | `() => true`         | Polled before every fire. GDPR / consent gate. |
| `spaPageViews`      | `boolean`                  | `true`               | Re-fire `PageView` on SPA route change. |
| `autoBindDataAttrs` | `boolean`                  | `true`               | Auto-bind `data-track="..."` markup. |
| `dataAttrTriggers`  | `string[]`                 | `["click","submit"]` | Trigger types the data-track binder listens to. |
| `events`            | `Record<string, EventDef>` | `{}`                 | Declarative event registry (see below). |

### `EventDef` — every entry under `events: {}`

| `on` value  | Required keys                                          | Optional keys                       | Fires when |
|-------------|--------------------------------------------------------|-------------------------------------|------------|
| `"route"`   | `path` (string \| RegExp), `event`, `data?`            | `once?`                             | URL matches `path`, on first load + SPA route change. |
| `"click"`   | `selector`, `event`, `data?`                           | `once?`                             | Click bubbles up from an element matching `selector`. |
| `"submit"`  | `selector`, `event`, `data?`                           | `once?`                             | A `<form>` matching `selector` is submitted (`form` available in ctx). |
| `"visible"` | `selector`, `event`, `data?`                           | `threshold?` (0–1, default `0.5`), `once?` | Element enters viewport (IntersectionObserver). |
| `"scroll"`  | `percent` (0–100), `event`, `data?`                    | `once?`                             | Page scrolled past `percent`. |
| `"dwell"`   | `seconds`, `event`, `data?`                            | `once?`                             | After `seconds` of time on the page. |
| `"video"`   | `selector`, `phase` (`"play"` \| `"ended"`), `event`, `data?` | `once?`                      | `<video>` matching `selector` plays / ends. |

**`path` matching:**

- `"/produto"` — exact (also matches `/produto/`)
- `"/blog/"` — prefix
- `/^\/p\/\d+$/` — RegExp

**`data` accepts:**

- An object `{ value: 47, currency: "BRL" }`, OR
- A function `(ctx) => ({ ... })` for runtime values.

**`ctx` fields available in `data` resolvers:**
`query` (URL search params), `pathname`, `el` (the element that fired),
`form` (FormData on submit), `event` (the DOM event).

**`once`** defaults to `true` — each event spec fires at most once per
session. Set `once: false` to allow repeat fires.

---

## 5. `data-track` attribute reference

Any element with `data-track="EventName"` is auto-wired (no JS needed).

| Attribute | Purpose |
|-----------|---------|
| `data-track`         | **Required.** Meta event name. |
| `data-track-on`      | Trigger event. Default `"click"`. (`"submit"`, `"change"`, etc.) |
| `data-track-once`    | `"true"` to fire only once per session. |
| `data-track-value`   | Parsed as Number. |
| `data-track-num-items`     | Parsed as Number. |
| `data-track-predicted-ltv` | Parsed as Number. |
| `data-track-content-ids`   | Split on commas → array. |
| `data-track-content-name`, `-content-type`, `-content-category`, `-delivery-category`, `-order-id`, `-search-string` | Renamed to Meta-standard snake_case keys. |
| `data-track-*` (any other) | Becomes a custom payload field (kebab → camel). |

Listeners are document-delegated and bound once at boot, so this works
for elements rendered **after** the provider mounts (SPA route changes,
conditional renders, portals).

By default `click` and `submit` are bound. To opt extra triggers in:

```ts
defineTrackingConfig({
  pixelIds: ["..."],
  dataAttrTriggers: ["click", "submit", "change"],
});
```

Then `<input data-track="..." data-track-on="change">` will fire on
change.

---

## 6. Verify it's working

1. Open `https://yoursite.com/?fbclid=test123` in a fresh window.
   The `fbclid` makes the visit show up in Test Events reliably.
2. Open **Meta Events Manager → Pixels → your pixel → Test Events tab**.
3. You should see two rows for `PageView` within ~1s of each other:
   one labelled **Browser**, one labelled **Server** — each with a
   **Deduplicated** badge and matching `event_id`.

If only **Browser** appears → Zaraz tool isn't firing. Check Cloudflare
→ Zaraz → Monitoring.
If only **Server** appears → ad blocker is eating `fbevents.js`. Test in
a clean profile.
If both appear with no Deduplicated badge → `event_id` mapping in the
Zaraz tool is wrong. Re-check Step 5 row 2.

---

## 7. Add-ons (quiz, testing)

Optional subpaths for specific use cases. Both are tree-shaken — non-users
pay zero runtime cost.

### `zara-tracking/react/quiz` — declarative quiz/funnel tracking

If your project is a quiz or multi-step form, you describe events per
step in JSON and let the hook fire them with proper dedup:

```ts
import { useQuizTracking } from "zara-tracking/react/quiz";

const { fireStepEvent, fireQuizEvent } = useQuizTracking({
  questions,
  quizConfig: {
    defaultEventData: { currency: "BRL" },
    events: {
      onQuizStart: [{ event: "QuizStarted" }],
      onQuizComplete: [{ event: "CompleteRegistration" }],
    },
  },
  quizSlug: "my-quiz",
});

// In your step components:
fireStepEvent("onView", { stepIndex, allAnswers });
fireStepEvent("onAnswer", { stepIndex, answerValue, allAnswers });
fireQuizEvent("onQuizComplete", { allAnswers });
```

Public types: `EventSpec`, `EventContext`, `StepTracking`,
`QuizTracking`, `TrackingPhase`, `QuizPhase`.

### `zara-tracking/testing` — drop-in mock for unit tests

Replaces the hand-rolled `vi.mock("zara-tracking", () => ({ trackEvent: vi.fn() }))` ceremony:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fired, reset } from "zara-tracking/testing";

vi.mock("zara-tracking", () => import("zara-tracking/testing"));

beforeEach(() => reset());

it("fires Lead", () => {
  // ...drive your component...
  expect(fired.some((e) => e.name === "Lead")).toBe(true);
});
```

Works with both Vitest and Jest. No fbq, no network. Also exports
`createTrackEventMock()` for scoped, non-singleton mock state.

---

## 8. Troubleshooting

### My event isn't firing

In `tracking.config.ts`, set `debug: true` and reload. Console will log:

- ✅ every fire (`[zara] Lead {...}`)
- ⚠️ every skip with the reason (`consent gate denied`, `enabled=false`,
  `once-guard`, `resolver returned undefined`)

If you see no log at all, the runtime didn't boot. Check that
`<TrackingProvider>` is mounted (Next) or `zaraTracking()` is in
`astro.config.mjs` (Astro).

### `data-track` attributes don't fire

Default triggers are `click` + `submit`. For `change`, `focus`, etc., add
them:

```ts
dataAttrTriggers: ["click", "submit", "change"],
```

### Events fire on browser but not on server (CAPI)

Zaraz tool isn't published. **Cloudflare → Zaraz → Publish** (top-right).

### Browser fires but no Deduplicated badge in Meta

`event_id` mapping in your Zaraz tool is wrong. Re-check:
`event_id` → `{{ client.event_id }}` (NOT `{{ client.eventID }}` or
`{{ system.event.id }}`).

### `[zara-tracking] <MetaPixel> mounted with no pixelIds`

Your `tracking.config.ts` doesn't export pixel IDs. Make sure you have
`export default defineTrackingConfig({ pixelIds: ["..."] })` and that
the framework wiring imports it correctly.

---

## License

MIT.
