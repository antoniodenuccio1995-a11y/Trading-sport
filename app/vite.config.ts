/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// base relativa: funziona su GitHub Pages (/Trading-sport/) e in locale.
export default defineConfig({
  base: "./",
  plugins: [preact()],
  build: { target: "es2022", sourcemap: false, assetsInlineLimit: 0 },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
