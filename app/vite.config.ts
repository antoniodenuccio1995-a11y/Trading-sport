/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// base relativa: funziona su GitHub Pages (/Trading-sport/) e in locale.
// Modalità "file": un unico bundle (niente import dinamici) da incorporare in un solo HTML.
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [preact()],
  build: {
    target: "es2022", sourcemap: false,
    // sito: caratteri come file a parte (in cache); file unico: tutto incorporato
    assetsInlineLimit: mode === "file" ? 1_000_000 : 0,
    outDir: mode === "file" ? "dist-file" : "dist",
    rollupOptions: mode === "file" ? { output: { inlineDynamicImports: true } } : undefined,
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
}));
