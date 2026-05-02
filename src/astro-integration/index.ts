/* ==========================================================================
   zara-tracking/astro-integration — zero-Layout.astro plug-and-play

   Usage (astro.config.mjs):

     import { defineConfig } from "astro/config";
     import zaraTracking from "zara-tracking/astro-integration";

     export default defineConfig({
       integrations: [zaraTracking()],
     });

   With the default options, this:

   1. Reads pixelIds/debug from `./tracking.config` at project root at
      build time (via a dynamic import — functions in config are NOT
      evaluated server-side, only scalar fields are read).
   2. Injects a client script (via Astro's `injectScript("page", ...)`)
      that calls `initPixel(pixelIds, debug)` + `runTracking(config)`.
   3. The injected script re-imports the user's config module through
      Vite at build time, so function resolvers (`consent: () => true`,
      function `events.*.data`) are preserved with their closures intact.

   Options:
     config:    module specifier for the user's tracking.config file.
                Default: "./tracking.config". Resolved by Vite from the
                project root when bundling the client script.

   Why this exists:
     Before v0.4, Astro consumers had to mount <MetaPixel> + write a
     manual <script> block that re-imported the config and called
     runTracking(). Two boots, two import sites, easy to forget one.
     This integration makes the entire integration one line in
     astro.config.mjs and zero touches in Layout.astro.
   ========================================================================== */

/**
 * Minimal structural type compatible with Astro's `AstroIntegration`.
 * We don't `import type { AstroIntegration } from "astro"` because astro
 * isn't a dependency here — this subpath is only loaded by consumers who
 * already have astro installed.
 */
interface AstroIntegrationShape {
  name: string;
  hooks: {
    "astro:config:setup"?: (ctx: AstroConfigSetupCtx) => void | Promise<void>;
  };
}

interface AstroConfigSetupCtx {
  injectScript: (
    stage: "page" | "page-ssr" | "before-hydration",
    content: string,
  ) => void;
  logger: { info: (msg: string) => void; warn: (msg: string) => void };
  /** Astro passes `config.root` as a URL pointing to the project root. */
  config: { root: URL };
}

export interface ZaraTrackingIntegrationOptions {
  /**
   * Module specifier for the user's tracking config. Must be resolvable
   * by Vite from the project root (where astro.config.mjs lives).
   * Default: "./tracking.config"
   */
  config?: string;
}

/**
 * Produce the injected client script body. Uses imports instead of JSON
 * serialization, so function resolvers in the user's config survive.
 */
function buildInjectedScript(configSpec: string): string {
  const spec = JSON.stringify(configSpec);
  return [
    `import { initPixel } from "zara-tracking";`,
    `import { runTracking } from "zara-tracking/runtime";`,
    `import __zaraTrackingConfig from ${spec};`,
    `const __cfg = __zaraTrackingConfig && typeof __zaraTrackingConfig === "object" && "default" in __zaraTrackingConfig`,
    `  ? /** @type {any} */ (__zaraTrackingConfig).default`,
    `  : __zaraTrackingConfig;`,
    `if (typeof window !== "undefined" && __cfg && Array.isArray(__cfg.pixelIds)) {`,
    `  try { initPixel(__cfg.pixelIds, !!__cfg.debug); } catch (e) { /* no-op */ }`,
    `  try { runTracking(__cfg); } catch (e) { /* no-op */ }`,
    `}`,
  ].join("\n");
}

/**
 * Resolve the user's config spec to a stable specifier the injected script
 * can import.
 *
 * Why this exists: Astro injects our script into a virtual module
 * (`astro:scripts/page.js`). Relative paths like `./tracking.config` resolve
 * against that virtual module's location, which doesn't exist on disk — Vite
 * fails the build with "Could not resolve". For relative specs we rewrite
 * to an absolute file path under the project root so resolution is unambiguous
 * regardless of which module Astro inlines our script into.
 *
 * Bare specifiers (e.g. `@/tracking-config`) and absolute paths are passed
 * through unchanged, so Vite aliases continue to work.
 */
function resolveConfigSpec(spec: string, projectRoot: URL): string {
  if (spec.startsWith("./") || spec.startsWith("../")) {
    return new URL(spec, projectRoot).pathname;
  }
  return spec;
}

export default function zaraTrackingIntegration(
  options: ZaraTrackingIntegrationOptions = {},
): AstroIntegrationShape {
  const userSpec = options.config ?? "./tracking.config";

  return {
    name: "zara-tracking",
    hooks: {
      "astro:config:setup": ({ injectScript, logger, config }) => {
        const resolved = resolveConfigSpec(userSpec, config.root);
        logger.info(
          `Injecting tracking boot from "${userSpec}" (resolved: ${resolved}). ` +
            `For manual mounts, remove this integration from astro.config.mjs.`,
        );
        injectScript("page", buildInjectedScript(resolved));
      },
    },
  };
}
