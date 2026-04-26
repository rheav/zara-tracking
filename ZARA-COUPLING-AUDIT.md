# zara-tracking — coupling audit across consumer projects

Two real consumer projects today. This doc maps every touchpoint, calls
out the ones that fight against drop-in reuse, and lists what the lib
should expose so a third project can be wired in under 5 minutes.

Audience: whoever is iterating on `github:rheav/zara-tracking`.

Consumer A — `quiz-builder` (Next.js 16 App Router, static export, Cloudflare Pages)
Consumer B — `astro-landing-astrology` (Astro 4, Cloudflare Pages)

---

## 1. What "loose coupling" should mean here

Goal: starting a new project, the entire integration is

1. `npm i github:rheav/zara-tracking`
2. Edit `tracking.config.{ts,js}` (pixel IDs + events).
3. Mount one component in the framework's root layout.
4. (If on Cloudflare Pages) one-line `_middleware.ts` re-export.

That's it. No project-specific resolver layer. No "manual pattern vs.
provider pattern" branching. No subpath import gotchas. No
late-mount workarounds.

Today both projects fall short of that bar in different ways.

---

## 2. Consumer A — `quiz-builder`

### 2a. Direct lib touchpoints

| File | Symbol imported | Subpath |
|---|---|---|
| `src/app/layout.jsx` | `TrackingProvider` | `zara-tracking/react/provider` |
| `tracking.config.js` | `defineTrackingConfig` | `zara-tracking/config` |
| `functions/_middleware.ts` | `onRequest` | `zara-tracking/middleware` |
| `src/lib/tracking/useQuizTracking.ts` | `trackEvent` | `zara-tracking` |
| `src/lib/tracking/types.ts` | `EventData` (type) | `zara-tracking` |
| `src/lib/tracking/resolveEventData.ts` | `EventData` (type) | `zara-tracking` |
| `src/components/quiz/QuizEnd.jsx` | `trackEvent` | `zara-tracking` |
| `src/__tests__/*.test.tsx` | `trackEvent`, `MetaPixel` | `zara-tracking`, `zara-tracking/react` |

8 files, 5 distinct subpaths. That's a lot of surface area for one lib.

### 2b. Project-local layer this project had to build

Because the lib doesn't ship a quiz-lifecycle helper, this project
ships its own:

```
src/lib/tracking/
├── useQuizTracking.ts     // hook: fireStepEvent, fireQuizEvent
├── resolveEventData.ts    // merge: ctx → quiz defaults → spec data
└── types.ts               // EventSpec, EventContext, StepTracking, QuizTracking
```

These wrap `trackEvent` and add per-step dedup, function `when` /
`data` resolvers, and a per-quiz `defaultEventData` merge. Every quiz
project that wants step-level tracking will reinvent this.

**Suggested lib export:**

```ts
import { useQuizTracking } from "zara-tracking/react/quiz";
// or
import { createQuizTracker } from "zara-tracking/quiz";
```

with `EventSpec`, `EventContext`, `StepTracking`, `QuizTracking` as
public types. Then `src/lib/tracking/` deletes entirely.

### 2c. Specific friction points

**i. CTA tracking workaround (see `ZARAZ-UPDATE-PLAN.md` §1).**
`bindDataAttrs` only binds delegated listeners for triggers found at
provider mount. CTA on the last quiz step doesn't exist at mount, so
its `data-track="InitiateCheckout"` never fires. Workaround in
`src/components/quiz/QuizEnd.jsx`:

```jsx
import { trackEvent } from "zara-tracking";
const fireCheckout = () =>
  trackEvent("InitiateCheckout", { value: 47, content_name: "..." });

<a onClick={fireCheckout} ...>{CTA_LABEL}</a>
```

This breaks the "drop a `data-track` attr and forget" promise. Fix
the lib, drop the workaround.

**ii. Two parallel tracking surfaces.**
Project juggles two different mental models:

- *DOM events* — `data-track="..."` markup, declared `events: {}` in
  `tracking.config.js`. Lives in framework markup.
- *Quiz lifecycle events* — declared in `quiz.json`, resolved by
  `useQuizTracking`, dispatched at React state transitions.

Both ultimately call `trackEvent`. Today the user sees two unrelated
mechanisms. Lib could unify by treating "lifecycle events" as a first-
class event source, same as `route` / `submit` / `data-attr`.

**iii. `tracking.config.js` import path drift.**
This project imports `defineTrackingConfig` from `zara-tracking/config`.
The Astro project imports it from `zara-tracking` (root). Pick one.
Recommendation: root, because every consumer needs it and subpaths
are noise.

**iv. Test mocking.**
Tests mock `vi.mock("zara-tracking", () => ({ trackEvent: vi.fn() }))`.
Works, but it would be cleaner if the lib exported a built-in test
helper:

```ts
import { mockTrackEvent } from "zara-tracking/testing";
const { fired, reset } = mockTrackEvent();
```

so consumers stop reaching into module mocks.

---

## 3. Consumer B — `astro-landing-astrology`

### 3a. Direct lib touchpoints

| File | Symbol imported | Subpath |
|---|---|---|
| `src/layouts/Layout.astro` | `MetaPixel` (component) | `zara-tracking/astro/MetaPixel.astro` |
| `src/layouts/Layout.astro` (inline `<script>`) | `runTracking` | `zara-tracking/runtime` |
| `src/pages/thank-you.astro` (inline `<script>`) | `trackEvent` | `zara-tracking` |
| `tracking.config.ts` | `defineTrackingConfig` | `zara-tracking` |
| `functions/_middleware.ts` | `onRequest` | `zara-tracking/middleware` |

5 files, 4 distinct subpaths.

### 3b. The big friction point — Astro provider can't take function resolvers

Verbatim comment from `src/layouts/Layout.astro:6-10`:

```astro
<!-- Why <MetaPixel> + manual <script> instead of <TrackingProvider config={...}>:
  tracking.config.ts uses a function `data` resolver (events.thankYou.data),
  which can't survive Astro's JSON-serialized <script> boundary used by
  <TrackingProvider>. The manual pattern bundles the full config (functions
  included) at the user-side call site through Vite. -->
```

So in Astro the integration is **not one component**. It is:

```astro
<MetaPixel config={trackingConfig} />     <!-- mounts fbq() -->
<script>
  import { runTracking } from "zara-tracking/runtime";
  import config from "../../tracking.config";
  runTracking(config);                    <!-- boots event runtime -->
</script>
```

Two boots, two import sites, two reasons to forget one. The reason
`<TrackingProvider>` doesn't work is that Astro serializes its props
to JSON for client hydration — functions get dropped.

**Suggested lib direction:**
Ship an Astro-native `<TrackingProvider config={config} />` that does
NOT round-trip the config through JSON. Re-import the config module
inside the generated client script (Vite resolves it at build time and
keeps function references intact). Same DX as React provider.

After fix, `Layout.astro` becomes:

```astro
import TrackingProvider from "zara-tracking/astro/TrackingProvider.astro";
import trackingConfig from "../../tracking.config";

<TrackingProvider config={trackingConfig} />
```

One line. No `<script>` block. No `runTracking` call site.

### 3c. `Purchase` event fires from inline `<script>`

`src/pages/thank-you.astro:97-106`:

```astro
<script>
  import { trackEvent } from "zara-tracking";
  document.addEventListener("astro:page-load", () => {
    if (window.location.pathname.replace(/\/$/, "") !== "/thank-you") return;
    trackEvent("Purchase", { value: 47, currency: "BRL" });
  });
</script>
```

This is exactly what the `events: { thankYou: { on: "route", path: "/thank-you", event: "Purchase", data: ... } }` block in `tracking.config.ts` was supposed to handle. The duplication exists because:

- The config-side `Purchase` uses a function `data` resolver pulling
  from `query` — relies on the runtime that was already booted.
- The inline-script `Purchase` is a hardcoded fallback.

If the runtime fires reliably from config (and the Astro provider fix
in §3b ships), this entire `<script>` block deletes.

---

## 4. Cross-project pattern: cleanest current path

For both projects, the cleanest single shape is:

```
project/
├── tracking.config.{ts,js}      // pixel IDs + events + defaults
├── functions/_middleware.ts     // export { onRequest } from "zara-tracking/middleware"
└── (root layout)                // <TrackingProvider config={trackingConfig} />
```

Everything else is project domain code. The lib should make sure that
shape always works — including in Astro, including with function
resolvers, including with React components mounted after the provider.

---

## 5. Concrete asks for the lib (priority ordered)

| # | Ask | Why | Where it bites today |
|---|---|---|---|
| 1 | Fix `bindDataAttrs` late-mount (always bind common triggers). | Markup-only DOM tracking is unreliable. | quiz-builder QuizEnd CTA workaround |
| 2 | Astro `<TrackingProvider>` that preserves function resolvers (Vite-bundled inline script, not JSON). | Astro project needs two boot sites. | astro-landing Layout.astro lines 5-10, 140-144 |
| 3 | Public quiz-lifecycle helper: `zara-tracking/react/quiz` (or `/quiz`) exposing `useQuizTracking`, `EventSpec`, `EventContext`, `StepTracking`, `QuizTracking`. | Every quiz project will rebuild it. | quiz-builder `src/lib/tracking/` (3 files, ~150 LOC) |
| 4 | Settle a single canonical import path per symbol. Prefer root `zara-tracking` for `defineTrackingConfig`, `trackEvent`, types. Subpaths only for framework adapters (`/react`, `/astro`, `/middleware`, `/runtime`). | Drift across projects (`/config` vs root). | tracking.config.js vs tracking.config.ts |
| 5 | `zara-tracking/testing` export with `mockTrackEvent()` helper. | Every consumer test file mocks the same way. | quiz-builder `__tests__/*.test.tsx` |
| 6 | `KEY_RENAMES` covers full Meta standard-event vocabulary, not just 4 keys. (See `ZARAZ-UPDATE-PLAN.md` §2a.) | Silent payload drops for `predicted_ltv` etc. | n/a yet — latent bug |
| 7 | Debug log on *skipped* dispatches (consent gate false, `enabled: false`, no listener bound). | Diagnosing skipped events today requires reading dist source. | the entire investigation that produced this audit |

Items 1, 2, 3 are the load-bearing ones. After those land, integration
in a fresh project drops to ~3 files of consumer code total.

---

## 6. Quick map of files to revisit on the consumer side once lib ships fixes

After lib v-next:

**`quiz-builder`**
- `src/lib/tracking/` — delete entire folder; import from `zara-tracking/react/quiz`.
- `src/components/quiz/QuizEnd.jsx` — drop `onClick={fireCheckout}`, restore `data-track="InitiateCheckout"` markup.
- `tracking.config.js` — change `from "zara-tracking/config"` to `from "zara-tracking"` (consistency with Astro project).
- `src/__tests__/*` — switch to `mockTrackEvent()` helper.

**`astro-landing-astrology`**
- `src/layouts/Layout.astro` — replace `<MetaPixel>` + inline `<script>` boot with single `<TrackingProvider config={trackingConfig} />`.
- `src/pages/thank-you.astro` — delete the inline `<script>` block; rely on `events.thankYou` in `tracking.config.ts`.

Net: about 6 files lighter across both projects, zero project-local
tracking infrastructure remaining.
