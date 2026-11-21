/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// base relativa: funziona su GitHub Pages (/Trading-sport/) e in locale.
// Modalità "file": un unico bundle (niente import dinamici) da incorporare in un solo HTML.
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [preact()],
  build: {
    target: "es2022", sourcemap: false, assetsInlineLimit: 0,
    outDir: mode === "file" ? "dist-file" : "dist",
    rollupOptions: mode === "file" ? { output: { inlineDynamicImports: true } } : undefined,
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
}));
