import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Default build: the real landing page, into ../public-landing. server.js serves that folder
// before ../public, so "/" shows this page and the other pages stay in ../public.
// `--mode pages`: the public demo site for GitHub Pages, into ./dist-pages, under /contest-here/.
export default defineConfig(({ mode }) => {
  const pages = mode === "pages";
  return {
    base: pages ? "/contest-here/" : "/",
    // Screenshots are only needed on the demo site.
    publicDir: pages ? "pages-public" : false,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
    build: {
      outDir: pages ? "dist-pages" : "../public-landing",
      emptyOutDir: true,
    },
  };
});
