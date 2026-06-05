import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const root = dirname(fileURLToPath(import.meta.url));

// SINGLE=1 builds one self-contained dist-single/index.html (everything inlined)
// that plays by opening it in a browser — no server. Otherwise: the normal
// multi-page build (game + sprite lab).
const single = process.env.SINGLE === "1";

export default defineConfig(
  single
    ? {
        plugins: [viteSingleFile()],
        build: {
          outDir: "dist-single",
          rollupOptions: { input: resolve(root, "index.html") },
        },
      }
    : {
        build: {
          rollupOptions: {
            input: {
              main: resolve(root, "index.html"),
              lab: resolve(root, "sprite-lab.html"),
            },
          },
        },
      },
);
