/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// base relativa: funziona su GitHub Pages (/Trading-sport/finanza/), in locale e come file unico.
// Modalità "file": un solo bundle incorporato in FinanzaPersonale.html (doppio clic, offline).
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [preact()],
  define: { __FILE_MODE__: JSON.stringify(mode === "file") },
  build: {
    target: "es2022", sourcemap: false, cssCodeSplit: false,
    assetsInlineLimit: mode === "file" ? 1_000_000 : 4096,
    outDir: mode === "file" ? "dist-file" : "dist",
    rollupOptions: mode === "file" ? { output: { inlineDynamicImports: true } } : undefined,
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
}));
