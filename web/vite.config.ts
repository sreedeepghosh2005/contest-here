import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Builds the landing page into ../public-landing. server.js serves that folder
// before ../public, so "/" shows this page and the other pages stay in ../public.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    outDir: "../public-landing",
    emptyOutDir: true,
  },
});
