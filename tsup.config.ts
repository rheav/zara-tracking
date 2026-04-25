import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      "core/index": "src/core/index.ts",
      "react/index": "src/react/index.ts",
      "middleware/index": "src/middleware/index.ts",
      "config/index": "src/config/index.ts",
      "runtime/index": "src/runtime/index.ts",
    },
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: false,
    splitting: false,
    external: ["react"],
    target: "es2022",
  },
  {
    // Separate bundle so the "use client" directive survives at the very top
    // — required for Next.js App Router to recognize it as a Client Component.
    entry: { "react/provider": "src/react/provider.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: false,
    splitting: false,
    external: ["react"],
    target: "es2022",
    banner: { js: '"use client";' },
  },
]);
