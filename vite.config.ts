import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The Sex House Island promotional site (React + Vite). Builds the marketing
// site from the root index.html. The original point-and-click game still lives
// in src/ but is no longer part of the default build.
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", chunkSizeWarningLimit: 1200 },
});
