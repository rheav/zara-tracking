# zara-tracking — Update Plan

Adjustments needed in the `zara-tracking` package
(github:rheav/zara-tracking, consumed here via `package.json`)
to remove workarounds currently living in this repo.

Repo: <https://github.com/rheav/zara-tracking>
Local install: `node_modules/zara-tracking/dist/`

---

## 1. Bug — `bindDataAttrs` only binds at provider mount

### Symptom

`<a data-track="InitiateCheckout" data-track-value="47" ...>` rendered
**after** the `TrackingProvider` mounts never fires. In this repo: the
quiz CTA on the final step does not emit `InitiateCheckout` because the
CTA element does not exist when the provider mounts at step 1.

### Root cause

File: `node_modules/zara-tracking/dist/react/provider.js:353-386`
(source equivalent: `src/runtime/triggers/data-attr.ts`)

```js
function bindDataAttrs() {
  if (typeof document === "undefined") return () => {};
  const triggers = new Set();
  const scan = () => {
    document.querySelectorAll("[data-track]").forEach((el) => {
      triggers.add(el.dataset.trackOn || "click");
    });
  };
  scan();                                  // <-- one-shot scan
  const cleanups = [];
  for (const trigger of triggers) {        // <-- empty if no [data-track] at mount
    const handler = (e) => { ... };
    document.addEventListener(trigger, handler, { capture: true });
    cleanups.push(...);
  }
  return () => cleanups.forEach((fn) => fn());
}
```

The function builds the `triggers` set from whatever `[data-track]`
elements exist at scan time, then registers one delegated listener per
unique trigger. SPA / per-step rendering means most `[data-track]`
elements arrive later — the set is empty, no listener is registered,
all later clicks are ignored.

### Fix — recommended

**Always register the common delegated listeners**, regardless of what
the initial DOM contains. The listener already uses `target.closest("[data-track]")`,
so it works for elements added after mount.

```js
function bindDataAttrs(triggers = ["click", "submit"]) {
  if (typeof document === "undefined") return () => {};
  const cleanups = [];
  for (const trigger of triggers) {
    const handler = (e) => {
      const target = e.target;
      if (!target) return;
      const el = target.closest("[data-track]");
      if (!el) return;
      const { eventName, trigger: t, once, data } = parseDataset(el);
      if (!eventName || t !== trigger) return;
      dispatch({
        key: `data-attr:${eventName}:${(el.id || "") + (el.dataset.trackKey || "")}`,
        eventName,
        data,
        once,
        ctx: buildContext({ el, event: e }),
      });
    };
    document.addEventListener(trigger, handler, { capture: true });
    cleanups.push(() =>
      document.removeEventListener(trigger, handler, { capture: true }),
    );
  }
  return () => cleanups.forEach((fn) => fn());
}
```

Trigger set defaults to `["click", "submit"]` — the only two values
ever passed via `data-track-on` today. Custom triggers (`change`,
`focus`, etc.) can be opted in via config:

```js
defineTrackingConfig({
  autoBindDataAttrs: true,
  dataAttrTriggers: ["click", "submit", "change"],   // optional
});
```

### Fix — alternative approaches (rejected, kept for reference)

- **MutationObserver re-scan.** Watch DOM mutations and add a listener
  per newly-seen trigger. Heavier, races with React reconciliation,
  redundant since delegated listeners already handle late mounts.
- **Expose `rebind()` and call from the React layer on every render or
  route change.** Pushes lifecycle complexity to consumers; defeats
  the point of "drop a `data-track` attr and forget."

The "always bind common triggers" fix is the smallest change and
removes the bug class entirely.

### Tests to add (in zara-tracking)

1. Mount provider with no `[data-track]` in DOM. Render a `<button data-track="X">`
   afterwards. Click → `X` fires.
2. Mount provider with no `[data-track]`. Render `<form data-track="Y" data-track-on="submit">`
   afterwards. Submit → `Y` fires.
3. Custom trigger (`change`) only binds when listed in `dataAttrTriggers`.
4. Cleanup on unmount removes all listeners (no leaks across StrictMode double-mount).

---

## 2. Optional secondary improvements

These are not blockers — mentioned only because they were noticed while
debugging issue 1.

### 2a. `KEY_RENAMES` coverage

`provider.js:321-326` only renames four keys:

```js
var KEY_RENAMES = {
  contentName: "content_name",
  contentType: "content_type",
  contentIds: "content_ids",
  numItems: "num_items",
};
```

Meta's standard event spec uses snake_case for several more
(`predicted_ltv`, `delivery_category`, `order_id`, `search_string`,
`status`). Today, writing `data-track-predicted-ltv="42"` lands as
`predictedLtv` in the payload — Meta drops it.

Either expand the map to cover the full Meta standard-event vocabulary,
or document that anything outside the four renames must be written in
snake_case directly: `data-track-predicted_ltv="42"` (which `dataset`
will not parse — so the renaming map is in fact mandatory).

### 2b. Numeric attr handling

Only `value` and `num_items` are coerced to `Number`
(`provider.js:342-344`). `predicted_ltv` and other numeric Meta fields
ship as strings, which Meta tolerates but Pixel's debugger flags.
Consider a small allow-list of numeric keys, or accept a
`data-track-num-*` namespace.

### 2c. Provider `debug` log location

When `debug: true`, lib logs after dispatch. Useful, but does not log
**why** an event was skipped (e.g. consent gate returned false, or
`enabled: false`). One-line "skipped: <reason>" log per skip would have
made issue 1 obvious without reading dist source.

---

## 3. Revert path in this repo (after lib fix ships)

Once the lib fix is published and bumped in `package.json`:

### 3a. CTA — switch back to declarative markup

File: `src/components/quiz/QuizEnd.jsx`

Remove:

```js
import { trackEvent } from "zara-tracking";

const CHECKOUT_PAYLOAD = {
  value: 47,
  content_name: "mapa-amoroso-de-venus",
};
const fireCheckout = () => trackEvent("InitiateCheckout", CHECKOUT_PAYLOAD);
```

Change CTA from:

```jsx
<a id={id} href={CHECKOUT_URL} onClick={fireCheckout}
   className="mystic-cta w-full mystic-bloom text-center">
  ✦ {CTA_LABEL}
</a>
```

Back to:

```jsx
<a id={id} href={CHECKOUT_URL}
   data-track="InitiateCheckout"
   data-track-value="47"
   data-track-content-name="mapa-amoroso-de-venus"
   className="mystic-cta w-full mystic-bloom text-center">
  ✦ {CTA_LABEL}
</a>
```

Drop the inline comment about the lib limitation.

### 3b. Verification

- Visit `/quiz/q-01`, walk to last step, click CTA.
- Pixel Helper / Network tab: `InitiateCheckout` with
  `value=47, currency=BRL, content_name=mapa-amoroso-de-venus`.
- Same expected at `/preview/q-01` (CTA on the last preview card).

---

## 4. Version targeting

- Affected dist: current pinned commit of `github:rheav/zara-tracking`.
- Suggested release: minor bump (behavior change, but no public API
  surface change for the recommended fix).
- Add to lib CHANGELOG: "fix(react): bindDataAttrs now binds delegated
  click/submit listeners unconditionally so `[data-track]` elements
  added after provider mount fire correctly."
