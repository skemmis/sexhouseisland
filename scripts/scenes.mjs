// Sync scene data with the LIVE deployment, so code edits build on the current
// (editor-authored) version instead of reverting it.
//
//   DEPLOY_URL=https://your-app.up.railway.app npm run scenes:pull
//     -> overwrites src/game/rooms.json with the live DB's scenes
//
//   DEPLOY_URL=... ADMIN_TOKEN=... npm run scenes:push
//     -> pushes src/game/rooms.json back to the live DB
//
// Typical agent workflow: pull -> edit rooms.json (or the game) -> push.
import { readFile, writeFile } from "node:fs/promises";

const url = (process.env.DEPLOY_URL || "").replace(/\/$/, "");
const cmd = process.argv[2];
const FILE = "src/game/rooms.json";
if (!url) { console.error("Set DEPLOY_URL (e.g. https://your-app.up.railway.app)"); process.exit(1); }

if (cmd === "pull") {
  const r = await fetch(`${url}/api/rooms`);
  if (!r.ok) { console.error(`pull failed: ${r.status} ${await r.text()}`); process.exit(1); }
  const data = await r.json();
  await writeFile(FILE, JSON.stringify(data, null, 2) + "\n");
  console.log(`pulled live scenes -> ${FILE} (rooms: ${Object.keys(data.rooms).join(", ")})`);
} else if (cmd === "push") {
  const body = await readFile(FILE, "utf8");
  const r = await fetch(`${url}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": process.env.ADMIN_TOKEN || "" },
    body,
  });
  if (!r.ok) { console.error(`push failed: ${r.status} ${await r.text()}`); process.exit(1); }
  console.log(`pushed ${FILE} -> live DB ✓`);
} else {
  console.error("usage: node scripts/scenes.mjs <pull|push>");
  process.exit(1);
}
