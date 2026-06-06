import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const root = dirname(fileURLToPath(import.meta.url));

// SINGLE=1 builds one self-contained dist-single/index.html (the game).
// SINGLE=editor builds a self-contained dist-editor/editor.html (the editor,
// usable standalone for trying the UI — Save needs the server). Otherwise: the
// normal multi-page build (game + sprite lab + editor) served by server.mjs.
const single = process.env.SINGLE;

export default defineConfig(
  single
    ? {
        plugins: [viteSingleFile()],
        build: {
          outDir: single === "editor" ? "dist-editor" : "dist-single",
          rollupOptions: { input: resolve(root, single === "editor" ? "editor.html" : "index.html") },
        },
      }
    : {
        build: {
          rollupOptions: {
            input: {
              main: resolve(root, "index.html"),
              lab: resolve(root, "sprite-lab.html"),
              editor: resolve(root, "editor.html"),
            },
          },
        },
      },
);
