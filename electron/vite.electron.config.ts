import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Eigenständiger Renderer-Build für die Desktop-App (kein SSR, file:// tauglich).
export default defineConfig({
  root: path.resolve(__dirname, "renderer"),
  base: "./",
  publicDir: path.resolve(__dirname, "..", "public"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "..", "src") },
  },
  build: {
    outDir: path.resolve(__dirname, "..", "dist"),
    emptyOutDir: true,
    target: "es2022",
  },
});
