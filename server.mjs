// Hosting server (Railway): serves the built game (/) and editor (/editor),
// and persists scene edits to src/game/rooms.json via /api/rooms.
import express from "express";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const ROOMS = resolve(root, "src/game/rooms.json");
const DIST = resolve(root, "dist");

const app = express();
app.use(express.json({ limit: "8mb" }));

// --- scene data API (the editor reads/writes this) ---
app.get("/api/rooms", async (_req, res) => {
  try { res.type("application/json").send(await readFile(ROOMS, "utf8")); }
  catch (e) { res.status(500).send(String(e)); }
});
app.post("/api/rooms", async (req, res) => {
  const data = req.body;
  if (!data?.rooms || !data?.start) return res.status(400).send("invalid rooms file");
  try { await writeFile(ROOMS, JSON.stringify(data, null, 2) + "\n"); res.json({ ok: true }); }
  catch (e) { res.status(500).send(String(e)); }
});

// --- static game + editor ---
app.get("/editor", (_req, res) => res.sendFile(join(DIST, "editor.html")));
app.use(express.static(DIST));
app.use((_req, res) => res.sendFile(join(DIST, "index.html"))); // SPA fallback

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Sex House Island → http://localhost:${port}  (game /, editor /editor)`));
