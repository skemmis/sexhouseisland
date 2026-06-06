// ============================================================================
//  ROOM EDITOR. A visual authoring tool for scene geometry: drag/resize
//  hotspots, move walk-to points, drag the depth band, and PAINT the walkable
//  area. Saves to src/game/rooms.json via the server's /api/rooms. This is a
//  second consumer of the engine's data model (rooms.json + assets + walk).
// ============================================================================
import roomsJson from "./game/rooms.json";
import { BACKDROPS } from "./game/assets";
import { drawSprite } from "./pixels/render";
import { PLAYER_WALK } from "./game/playerWalk";
import { CELL, GW, GH, decodeMask, encodeMask, type WalkMask } from "./walk";
import type { Hotspot, RoomsFile } from "./types";

const SX = 320, SY = 136, S = 3;
const canvas = document.getElementById("ed") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const bar = document.getElementById("bar")!;
const statusEl = () => document.getElementById("status")!;

let file: RoomsFile = structuredClone(roomsJson) as RoomsFile;
let roomId = file.start.room;
let tool: "select" | "paint" | "erase" = "select";
let brush = 3; // cells
let dirty = false;
let mouse = { x: 0, y: 0, in: false };
const masks: Record<string, WalkMask> = {};
const images: Record<string, HTMLImageElement> = {};

type Sel = { kind: "hotspot" | "walkTo" | "floorMin" | "floorMax"; i?: number } | null;
let sel: Sel = null;
type Drag = { mode: "move" | "resize" | "walkTo" | "floor" | "paint"; handle?: string; ox: number; oy: number; orig?: any } | null;
let drag: Drag = null;

const room = () => file.rooms[roomId];
const mask = () => (masks[roomId] ??= decodeMask(room().walk ?? ""));
const setDirty = (d = true) => { dirty = d; statusEl().className = d ? "dirty" : ""; statusEl().textContent = d ? "● unsaved" : "saved"; };

function img(key: string) {
  if (!images[key]) { const im = new Image(); im.src = BACKDROPS[key]; images[key] = im; }
  return images[key];
}

// ---- load from server (falls back to the bundled rooms.json read-only) ----
async function load() {
  try {
    const r = await fetch("/api/rooms");
    if (r.ok) file = await r.json();
  } catch { /* no server: edit the bundled copy, Save will warn */ }
  roomId = file.start.room;
  buildBar();
  setDirty(false);
}

// ---------------------------------------------------------------------------
//  Toolbar
// ---------------------------------------------------------------------------
function buildBar() {
  bar.innerHTML = "";
  const group = () => { const g = document.createElement("span"); g.className = "group"; bar.appendChild(g); return g; };
  const btn = (label: string, on: boolean, fn: () => void, parent: HTMLElement) => {
    const b = document.createElement("button"); b.textContent = label; if (on) b.className = "on"; b.onclick = fn; parent.appendChild(b); return b;
  };
  const rooms = group();
  for (const id of Object.keys(file.rooms)) btn(id, id === roomId, () => { roomId = id; sel = null; buildBar(); }, rooms);
  const tools = group();
  btn("Select", tool === "select", () => { tool = "select"; buildBar(); }, tools);
  btn("Paint walk", tool === "paint", () => { tool = "paint"; buildBar(); }, tools);
  btn("Erase walk", tool === "erase", () => { tool = "erase"; buildBar(); }, tools);
  const br = group();
  btn("brush −", false, () => { brush = Math.max(1, brush - 1); }, br);
  const bl = document.createElement("span"); bl.textContent = `brush ${brush}`; bl.style.opacity = "0.7"; br.appendChild(bl);
  btn("brush +", false, () => { brush = Math.min(12, brush + 1); buildBar(); }, br);
  const hs = group();
  btn("+ Hotspot", false, addHotspot, hs);
  btn("Delete", false, deleteHotspot, hs);
  btn("Edit id/name/exit", false, editHotspot, hs);
  btn("Clear walk", false, () => { masks[roomId] = new Uint8Array(GW * GH); setDirty(); }, hs);
  const save = group();
  btn("💾 Save", false, doSave, save);
  const st = document.createElement("span"); st.id = "status"; bar.appendChild(st); setDirty(dirty);
}

// ---------------------------------------------------------------------------
//  Coordinate helpers
// ---------------------------------------------------------------------------
function toScene(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / S, y: (e.clientY - r.top) / S };
}
const near = (a: number, b: number, t: number) => Math.abs(a - b) <= t;
const inRect = (p: { x: number; y: number }, h: Hotspot) => p.x >= h.rect.x && p.x <= h.rect.x + h.rect.w && p.y >= h.rect.y && p.y <= h.rect.y + h.rect.h;

function handleAt(p: { x: number; y: number }, h: Hotspot): string | null {
  const c = [["nw", h.rect.x, h.rect.y], ["ne", h.rect.x + h.rect.w, h.rect.y], ["sw", h.rect.x, h.rect.y + h.rect.h], ["se", h.rect.x + h.rect.w, h.rect.y + h.rect.h]] as const;
  for (const [name, hx, hy] of c) if (near(p.x, hx, 3) && near(p.y, hy, 3)) return name;
  return null;
}

// ---------------------------------------------------------------------------
//  Hotspot ops
// ---------------------------------------------------------------------------
function addHotspot() {
  const id = prompt("hotspot id (matches a `case` in game.ts):", "newspot");
  if (!id) return;
  const name = prompt("display name:", id) ?? id;
  room().hotspots.push({ id, name, rect: { x: 140, y: 60, w: 30, h: 30 }, walkTo: { x: 155, y: 124 }, face: 0 });
  sel = { kind: "hotspot", i: room().hotspots.length - 1 };
  setDirty();
}
function deleteHotspot() {
  if (sel?.kind === "hotspot" && sel.i != null) { room().hotspots.splice(sel.i, 1); sel = null; setDirty(); }
}
function editHotspot() {
  if (sel?.kind !== "hotspot" || sel.i == null) return alert("Select a hotspot first.");
  const h = room().hotspots[sel.i];
  h.id = prompt("id:", h.id) ?? h.id;
  h.name = prompt("name:", h.name) ?? h.name;
  const ex = prompt("exit target room (blank = none):", h.exit?.to ?? "");
  if (ex) h.exit = { to: ex, entry: h.exit?.entry ?? { x: 160, y: 124 }, face: h.exit?.face ?? 0 };
  else delete h.exit;
  setDirty();
}

async function doSave() {
  masks[roomId] && (room().walk = encodeMask(mask()));
  try {
    const r = await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(file, null, 2) });
    if (!r.ok) throw new Error(await r.text());
    setDirty(false);
    statusEl().textContent = "saved ✓";
  } catch (e) {
    statusEl().className = "dirty";
    statusEl().textContent = "save failed (run the server: npm start) — " + (e as Error).message;
  }
}

// ---------------------------------------------------------------------------
//  Painting the walk mask
// ---------------------------------------------------------------------------
function paintAt(p: { x: number; y: number }, on: boolean) {
  const m = mask();
  const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL), r = brush - 1;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = cx + dx, y = cy + dy;
    if (x >= 0 && y >= 0 && x < GW && y < GH) m[y * GW + x] = on ? 1 : 0;
  }
  setDirty();
}

// ---------------------------------------------------------------------------
//  Input
// ---------------------------------------------------------------------------
canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  const p = toScene(e);
  if (tool === "paint" || tool === "erase") { drag = { mode: "paint", ox: 0, oy: 0 }; paintAt(p, tool === "paint"); return; }
  // select tool
  const r = room();
  if (sel?.kind === "hotspot" && sel.i != null) {
    const h = r.hotspots[sel.i];
    const handle = handleAt(p, h);
    if (handle) { drag = { mode: "resize", handle, ox: p.x, oy: p.y, orig: { ...h.rect } }; return; }
    if (near(p.x, h.walkTo.x, 3) && near(p.y, h.walkTo.y, 3)) { drag = { mode: "walkTo", ox: p.x, oy: p.y }; return; }
  }
  if (near(p.y, r.floor.minY, 2)) { sel = { kind: "floorMin" }; drag = { mode: "floor", ox: 0, oy: 0 }; return; }
  if (near(p.y, r.floor.maxY, 2)) { sel = { kind: "floorMax" }; drag = { mode: "floor", ox: 0, oy: 0 }; return; }
  for (let i = r.hotspots.length - 1; i >= 0; i--) {
    if (inRect(p, r.hotspots[i])) { sel = { kind: "hotspot", i }; drag = { mode: "move", ox: p.x - r.hotspots[i].rect.x, oy: p.y - r.hotspots[i].rect.y }; return; }
  }
  sel = null;
});

canvas.addEventListener("pointermove", (e) => {
  const p = toScene(e); mouse = { x: p.x, y: p.y, in: true };
  if (!drag) return;
  const r = room();
  const rx = Math.round(p.x), ry = Math.round(p.y);
  if (drag.mode === "paint") { paintAt(p, tool === "paint"); return; }
  if (sel?.kind === "hotspot" && sel.i != null) {
    const h = r.hotspots[sel.i];
    if (drag.mode === "move") { h.rect.x = clampI(rx - Math.round(drag.ox), 0, SX - h.rect.w); h.rect.y = clampI(ry - Math.round(drag.oy), 0, SY - h.rect.h); setDirty(); }
    else if (drag.mode === "walkTo") { h.walkTo.x = clampI(rx, 0, SX); h.walkTo.y = clampI(ry, 0, SY); setDirty(); }
    else if (drag.mode === "resize") { resize(h, drag.handle!, rx, ry); setDirty(); }
  }
  if (drag.mode === "floor") {
    if (sel?.kind === "floorMin") r.floor.minY = clampI(ry, 0, r.floor.maxY - 2);
    else if (sel?.kind === "floorMax") r.floor.maxY = clampI(ry, r.floor.minY + 2, SY);
    setDirty();
  }
});

canvas.addEventListener("pointerup", () => { drag = null; });
canvas.addEventListener("pointerleave", () => { mouse.in = false; });

window.addEventListener("keydown", (e) => {
  if (sel?.kind !== "hotspot" || sel.i == null) return;
  const h = room().hotspots[sel.i];
  const d = e.shiftKey ? 10 : 1;
  if (e.key === "ArrowLeft") h.rect.x -= d; else if (e.key === "ArrowRight") h.rect.x += d;
  else if (e.key === "ArrowUp") h.rect.y -= d; else if (e.key === "ArrowDown") h.rect.y += d; else return;
  e.preventDefault(); setDirty();
});

function resize(h: Hotspot, handle: string, x: number, y: number) {
  const o = h.rect, x2 = o.x + o.w, y2 = o.y + o.h;
  if (handle.includes("w")) { h.rect.x = Math.min(x, x2 - 4); h.rect.w = x2 - h.rect.x; }
  if (handle.includes("e")) { h.rect.w = Math.max(4, x - o.x); }
  if (handle.includes("n")) { h.rect.y = Math.min(y, y2 - 4); h.rect.h = y2 - h.rect.y; }
  if (handle.includes("s")) { h.rect.h = Math.max(4, y - o.y); }
}
const clampI = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

// ---------------------------------------------------------------------------
//  Render
// ---------------------------------------------------------------------------
function frame() {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const r = room();
  const bg = img(r.backdrop);
  if (bg.complete && bg.naturalWidth) ctx.drawImage(bg, 0, 0, SX * S, SY * S);
  else { ctx.fillStyle = "#0f151c"; ctx.fillRect(0, 0, SX * S, SY * S); }

  // walk mask
  const m = masks[roomId] ?? (r.walk ? mask() : null);
  if (tool !== "select" || m) {
    for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
      const on = m && m[cy * GW + cx];
      if (on) { ctx.fillStyle = "rgba(80,220,140,0.28)"; ctx.fillRect(cx * CELL * S, cy * CELL * S, CELL * S, CELL * S); }
      else if (tool !== "select") { ctx.fillStyle = "rgba(220,70,70,0.12)"; ctx.fillRect(cx * CELL * S, cy * CELL * S, CELL * S, CELL * S); }
    }
  }

  // depth band
  for (const [yy, kind, label] of [[r.floor.minY, "floorMin", `far ×${r.floor.minScale}`], [r.floor.maxY, "floorMax", `near ×${r.floor.maxScale}`]] as const) {
    ctx.strokeStyle = sel?.kind === kind ? "#6fe3ff" : "rgba(110,200,230,0.7)";
    ctx.setLineDash([6, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, yy * S); ctx.lineTo(SX * S, yy * S); ctx.stroke(); ctx.setLineDash([]);
    label2(label, 4, yy * S - 3, "#9fe6ff");
  }

  // scale preview ghost (select tool)
  if (tool === "select" && mouse.in) {
    const ty = Math.max(r.floor.minY, Math.min(r.floor.maxY, mouse.y));
    const sc = r.floor.minScale + (r.floor.maxScale - r.floor.minScale) * ((ty - r.floor.minY) / (r.floor.maxY - r.floor.minY) || 0);
    const cell = 2.0 * sc * S, fr = PLAYER_WALK[0];
    ctx.globalAlpha = 0.35;
    drawSprite(ctx, fr, mouse.x * S - (fr.w * cell) / 2, mouse.y * S - fr.h * cell, cell);
    ctx.globalAlpha = 1;
  }

  // hotspots
  r.hotspots.forEach((h, i) => {
    const selected = sel?.kind === "hotspot" && sel.i === i;
    const exit = !!h.exit;
    ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeStyle = exit ? "#f0a33a" : selected ? "#ffe27a" : "rgba(255,255,255,0.65)";
    ctx.fillStyle = exit ? "rgba(240,163,58,0.14)" : "rgba(120,160,255,0.12)";
    ctx.fillRect(h.rect.x * S, h.rect.y * S, h.rect.w * S, h.rect.h * S);
    ctx.strokeRect(h.rect.x * S + 0.5, h.rect.y * S + 0.5, h.rect.w * S - 1, h.rect.h * S - 1);
    label2(h.name + (exit ? ` → ${h.exit!.to}` : ""), h.rect.x * S + 1, h.rect.y * S - 2, exit ? "#ffd08a" : "#dfe6ff");
    if (selected) {
      // walk-to dot + tether
      ctx.strokeStyle = "rgba(120,230,150,0.7)"; ctx.beginPath();
      ctx.moveTo((h.rect.x + h.rect.w / 2) * S, (h.rect.y + h.rect.h / 2) * S); ctx.lineTo(h.walkTo.x * S, h.walkTo.y * S); ctx.stroke();
      dot(h.walkTo.x * S, h.walkTo.y * S, "#54e08c");
      // resize handles
      for (const [hx, hy] of [[h.rect.x, h.rect.y], [h.rect.x + h.rect.w, h.rect.y], [h.rect.x, h.rect.y + h.rect.h], [h.rect.x + h.rect.w, h.rect.y + h.rect.h]]) {
        ctx.fillStyle = "#ffe27a"; ctx.fillRect(hx * S - 3, hy * S - 3, 6, 6);
      }
    }
  });

  // HUD
  const selTxt = sel?.kind === "hotspot" && sel.i != null
    ? (() => { const h = room().hotspots[sel.i!]; return `${h.id}  rect ${h.rect.x},${h.rect.y} ${h.rect.w}×${h.rect.h}  walkTo ${h.walkTo.x},${h.walkTo.y}`; })()
    : sel?.kind ? sel.kind : "—";
  label2(`room ${roomId}  ·  ${tool}  ·  x${Math.round(mouse.x)} y${Math.round(mouse.y)}`, 4, SY * S - 16, "#cfe6ff");
  label2(`sel: ${selTxt}`, 4, SY * S - 4, "#ffe7b0");
  requestAnimationFrame(frame);
}

function dot(x: number, y: number, c: string) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#0a0a0a"; ctx.stroke(); }
function label2(s: string, x: number, y: number, color: string) {
  ctx.font = "12px ui-monospace, monospace"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillText(s, x + 1, y + 1);
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}

load();
requestAnimationFrame(frame);
