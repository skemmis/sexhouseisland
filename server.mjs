// Hosting server (Railway): serves the built promotional site from dist/.
//
// `npm run build` produces dist/ (the React app + public assets); this serves
// it as static files with an SPA fallback so deep links like /cast and /markets
// resolve to index.html. Binds to $PORT (Railway sets it).
import express from "express";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const root = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(root, "dist");

if (!existsSync(join(DIST, "index.html"))) {
  console.error("dist/ not found — run `npm run build` first (Railway runs it via buildCommand).");
  process.exit(1);
}

const app = express();

// Content-hashed build assets are immutable and cached for a year. Everything
// else — crucially index.html and the .jpg assets — must revalidate so a new
// deploy (new bundle hash, changed/removed images) is picked up immediately.
app.use(
  express.static(DIST, {
    setHeaders(res, path) {
      if (path.includes(`${join("dist", "assets")}`) || /\.[0-9a-f]{8,}\./.test(path)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  }),
);

// SPA fallback: any unmatched route returns the (always-revalidated) app shell.
app.use((_req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(join(DIST, "index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Sex House Island → http://localhost:${port}`));
