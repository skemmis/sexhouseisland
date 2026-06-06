// Hosting server (Railway): serves the built game (/) and editor (/editor),
// and persists scene edits.
//
//   - If DATABASE_URL is set (Railway Postgres), scenes live in a `scenes`
//     table (JSONB), seeded once from the bundled rooms.json.
//   - Otherwise (local dev), scenes read/write the rooms.json file directly.
//
// The game and editor both use GET/POST /api/rooms, so either backend is
// transparent to them.
import express from "express";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import pg from "pg";

const root = dirname(fileURLToPath(import.meta.url));
const ROOMS_FILE = resolve(root, "src/game/rooms.json");
const DIST = resolve(root, "dist");
const useDb = !!process.env.DATABASE_URL;

let pool;
async function setMeta(hash) {
  await pool.query("INSERT INTO scenes (id, data) VALUES ('_meta', $1) ON CONFLICT (id) DO UPDATE SET data = $1", [{ seedHash: hash }]);
}
async function initStore() {
  if (!useDb) { console.log("scenes: file (rooms.json) — set DATABASE_URL for durable Postgres"); return; }
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
  });
  await pool.query("CREATE TABLE IF NOT EXISTS scenes (id text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz DEFAULT now())");
  // Policy: the EDITOR is the source of truth. We seed the DB once from the
  // bundled rooms.json; after that we never auto-overwrite, so saved edits hold
  // across deploys. To deliberately push committed rooms.json changes (replacing
  // editor edits), deploy once with RESEED=1.
  const bundledStr = await readFile(ROOMS_FILE, "utf8");
  const bundled = JSON.parse(bundledStr);
  const hash = createHash("sha1").update(bundledStr).digest("hex");
  const cur = await pool.query("SELECT 1 FROM scenes WHERE id='rooms'");
  const meta = await pool.query("SELECT data FROM scenes WHERE id='_meta'");
  const seedHash = meta.rows[0]?.data?.seedHash;
  if (cur.rows.length === 0) {
    await pool.query("INSERT INTO scenes (id, data) VALUES ('rooms', $1)", [bundled]);
    await setMeta(hash);
    console.log("scenes: Postgres — seeded from rooms.json");
  } else if (process.env.RESEED) {
    await pool.query("UPDATE scenes SET data = $1, updated_at = now() WHERE id='rooms'", [bundled]);
    await setMeta(hash);
    console.log("scenes: Postgres — RESEED: overwrote DB from committed rooms.json (editor edits replaced)");
  } else if (seedHash !== hash) {
    console.log("scenes: Postgres — editor is source of truth. NOTE: committed rooms.json differs from the live DB; deploy once with RESEED=1 to apply it (overwrites editor edits).");
  } else {
    console.log("scenes: Postgres — editor is source of truth");
  }
}
async function readRooms() {
  if (useDb) { const { rows } = await pool.query("SELECT data FROM scenes WHERE id='rooms'"); return rows[0]?.data; }
  return JSON.parse(await readFile(ROOMS_FILE, "utf8"));
}
async function writeRooms(data) {
  if (useDb) {
    await pool.query(
      "INSERT INTO scenes (id, data, updated_at) VALUES ('rooms', $1, now()) ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = now()",
      [data],
    );
  } else {
    await writeFile(ROOMS_FILE, JSON.stringify(data, null, 2) + "\n");
  }
}

const app = express();
app.use(express.json({ limit: "8mb" }));

app.get("/api/rooms", async (_req, res) => {
  try { res.json(await readRooms()); } catch (e) { res.status(500).send(String(e)); }
});
app.post("/api/rooms", async (req, res) => {
  const data = req.body;
  if (!data?.rooms || !data?.start) return res.status(400).send("invalid rooms file");
  try { await writeRooms(data); res.json({ ok: true }); } catch (e) { res.status(500).send(String(e)); }
});

app.get("/editor", (_req, res) => res.sendFile(join(DIST, "editor.html")));
app.use(express.static(DIST));
app.use((_req, res) => res.sendFile(join(DIST, "index.html"))); // SPA fallback

const port = process.env.PORT || 3000;
await initStore();
app.listen(port, () => console.log(`Sex House Island → http://localhost:${port}  (game /, editor /editor)`));
