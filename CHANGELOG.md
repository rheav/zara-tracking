# Changelog

All notable changes to **zara-tracking** are tracked here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning is [SemVer](https://semver.org/spec/v2.0.0.html).

## [0.4.0] — 2026-04-26

Closes the load-bearing items of `ZARA-COUPLING-AUDIT.md`. The library
is now self-contained: consumer projects own the **what** (config + markup)
but no longer the **how**.

### Added

- **`zara-tracking/astro-integration`** — one-line Astro setup. Drop into
  `astro.config.mjs`:

  ```js
  import zaraTracking from "zara-tracking/astro-integration";
  export default defineConfig({ integrations: [zaraTracking()] });
  ```

  The integration reads `./tracking.config.{ts,js}` and uses Astro's
  `injectScript("page", ...)` API to inject a client entry that boots the
  pixel (`initPixel`) and the runtime (`runTracking`) on every page. The
  injected script imports the user's config module by path through Vite,
  so **function resolvers** (`consent`, `events.*.data`) are preserved
  with their closures intact — fixes the JSON-serialization limitation
  of `<TrackingProvider config={...} />`. Layout.astro stays tracking-free.

- **`zara-tracking/react/quiz`** — declarative quiz/funnel tracking helper,
  lifted out of `quiz-builder/src/lib/tracking/`:

  ```ts
  import {
    useQuizTracking,
    type EventSpec,
    type StepTracking,
    type QuizTracking,
  } from "zara-tracking/react/quiz";
  ```

  Exposes `useQuizTracking()` (hook), `resolveEventData()` (data merge
  utility), and the public types `EventContext`, `EventSpec`, `StepTracking`,
  `QuizTracking`, `TrackingPhase`, `QuizPhase`. Tree-shakeable subpath —
  zero runtime cost for non-quiz consumers.

- **`zara-tracking/testing`** — drop-in mock for unit tests. Use as the
  factory for `vi.mock` / `jest.mock`:

  ```ts
  vi.mock("zara-tracking", () => import("zara-tracking/testing"));
  import { fired, reset } from "zara-tracking/testing";
  ```

  Every `trackEvent()` call lands in the `fired[]` array; `reset()` clears
  it. No fbq, no network, no framework-specific spy APIs. Also exports
  `createTrackEventMock()` for scoped, non-singleton mock state.

- **`initPixel(pixelIds, debug)`** — callable form of the pixel boot.
  Identical behavior to the inlined `buildPixelInitScript` IIFE, but as a
  bundled module function — required for the Astro integration to inject
  the boot from a Vite-bundled script. Idempotent.

### Migration notes

Existing consumers that don't adopt the new subpaths keep working unchanged.
Optional cleanup in consumers (see `ZARA-COUPLING-AUDIT.md` §6):

**Astro projects** — replace the `<MetaPixel> + <script>runTracking()</script>`
pattern in `Layout.astro` with one line in `astro.config.mjs`:

```js
integrations: [zaraTracking()],
```

Layout.astro then has zero tracking code. Function resolvers in
tracking.config preserved.

**Quiz/funnel projects** — switch any local `useQuizTracking` /
`resolveEventData` / `EventSpec` imports to `zara-tracking/react/quiz`.
Delete the local `src/lib/tracking/` folder.

**Test files** — replace `vi.mock("zara-tracking", () => ({ trackEvent: vi.fn() }))`
hand-rolls with `vi.mock("zara-tracking", () => import("zara-tracking/testing"))`.
Assert against `fired[]` instead of `mock.calls`.

## [0.3.0] — 2026-04-26

Plug-and-play polish — fewer flags, fewer subpaths, fewer footguns.

### Changed (defaults flipped)

- **`autoBindDataAttrs` now defaults to `true`.** The declarative
  `data-track="EventName"` markup is the lib's headline pattern; users
  shouldn't have to opt into the headline. Disable with explicit
  `autoBindDataAttrs: false`.
- **`spaPageViews` now defaults to `true`.** Every modern app is an SPA
  (Next App Router, Astro view-transitions, React Router, etc.) and the
  re-fire is correctly first-load-guarded. Disable with explicit
  `spaPageViews: false` for static MPAs.

> **Migration:** if you had either flag explicitly set, no change needed.
> If you relied on the previous `false` default, set it explicitly now.

### Added

- **`<TrackingProvider config={config} />` for Astro** at
  `zara-tracking/astro/TrackingProvider.astro`. Renders the pixel boot
  script AND boots the runtime in a single component — mirrors the React
  API. Astro setup goes from 5 lines to 1 for serializable configs.
  - Caveat: configs containing function values (`consent: () => true`,
    function `events.*.data` resolvers) cannot be JSON-serialized into
    Astro `<script>` blocks. The component throws at SSR time with a
    clear message pointing to the manual `<MetaPixel> + <script>` pattern.
- **`<MetaPixel config={config} />` (Astro) accepts the full config object**
  as an alternative to manual `pixelIds={...} debug={...}` prop-plucking.
  Old prop API still works.
- **`currency` shortcut** in `defineTrackingConfig`. Writes to
  `defaults.currency` automatically. `defineTrackingConfig({ pixelIds, currency: "BRL" })`
  replaces `defineTrackingConfig({ pixelIds, defaults: { currency: "BRL" } })`.
- **`defineTrackingConfig` re-exported from the root entry** so consumers
  can import everything from one path:
  `import { defineTrackingConfig, trackEvent } from "zara-tracking"`. The
  `zara-tracking/config` subpath remains for backward compatibility.
- **Public types re-exported from root**: `RuntimeConfig`,
  `EventDefinition`, `DataResolver`, `TriggerContext`,
  `DefineTrackingConfigInput`.
- **Empty-`pixelIds` warning.** `<MetaPixel>` (React + Astro) and
  `runTracking()` now `console.warn` once at boot if `pixelIds` is empty.
  Previously failed silently — the most-reported onboarding pitfall.

### Notes

No breaking API changes. Existing configs continue to work. Default-flag
flips are observable behavior changes only for consumers that didn't
explicitly set them — which is the exact group meant to benefit.

## [0.2.0] — 2026-04-26

### Fixed

- **`bindDataAttrs` now binds delegated `click` + `submit` listeners
  unconditionally** so `[data-track]` elements added after `TrackingProvider`
  / `runTracking()` mounts (SPA route changes, conditional renders, portals)
  fire correctly. Previously the binder did a one-shot DOM scan at boot — if
  zero `[data-track]` elements existed at that moment, no listener was ever
  registered and all later clicks/submits were silently dropped. The new
  handler uses `target.closest("[data-track]")` to locate the element on
  each event, so late-mounted elements just work.

### Added

- **`dataAttrTriggers` runtime config option.** Opt extra DOM events into
  the `data-track` binder. Default `["click", "submit"]`. Add
  `"change"`, `"focus"`, `"mouseenter"`, etc. to enable
  `<input data-track-on="change" …>`, hover tracking, etc.
- **Expanded `KEY_RENAMES` to cover Meta's standard event vocabulary.**
  `data-track-content-category`, `data-track-predicted-ltv`,
  `data-track-delivery-category`, `data-track-order-id`,
  `data-track-search-string` now land in the payload as the snake_case
  keys Meta's Pixel debugger recognizes.
- **Numeric coercion allow-list.** `value`, `num_items`, `predicted_ltv`
  are coerced to `Number` (was: only `value` + `num_items`).
- **Skip-reason debug logs.** When `debug: true`, the runtime now logs
  `META skipped <event> — <reason>` for every suppressed fire
  (`enabled=false`, consent gate returned false, once-guard hit, data
  resolver returned null). Makes debugging missing events a
  console-glance instead of a dist-source spelunk.
- New `debugSkip(name, reason)` helper exported from
  `zara-tracking` core for advanced consumers.

### Changed

- **`bindDataAttrs` signature** is now
  `bindDataAttrs(triggers?: readonly string[])` (was: no parameters).
  Existing call sites without arguments keep working — defaults to
  `["click", "submit"]`. No public-API break for users of
  `defineTrackingConfig` / `runTracking`.

### Migration

No code changes required. Bump and reinstall:

```bash
npm install zara-tracking@github:rheav/zara-tracking
```

If your app previously worked around the bug with explicit
`onClick={() => trackEvent(…)}` handlers, you can now revert to plain
declarative markup:

```jsx
<a
  href={CHECKOUT_URL}
  data-track="InitiateCheckout"
  data-track-value="47"
  data-track-content-name="my-product"
>
  Buy
</a>
```

## [0.1.0]

Initial release.
