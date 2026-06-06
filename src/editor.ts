// ============================================================================
//  ROOM EDITOR. A visual authoring tool for scene geometry: drag/resize
//  hotspots, move walk-to points, drag the depth band, and PAINT the walkable
//  area. Saves to src/game/rooms.json via the server's /api/rooms. This is a
//  second consumer of the engine's data model (rooms.json + assets + walk).
// ============================================================================
import roomsJson from "./game/rooms.json";
import { BACKDROPS } from "./game/assets";
import { SPRITES } from "./game/spriteRegistry";
import { drawSprite } from "./pixels/render";
import { PLAYER_WALK } from "./game/playerWalk";
import { CELL, GW, GH, decodeMask, encodeMask, type WalkMask } from "./walk";
import type { Hotspot, Prop, RoomsFile } from "./types";

const SX = 320, SY = 136, S = 3;
const canvas = document.getElementById("ed") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const bar = document.getElementById("bar")!;
const statusEl = () => document.getElementById("status")!;

let file: RoomsFile = structuredClone(roomsJson) as RoomsFile;
let roomId = file.start.room;
let tool: "select" | "paint" | "erase" | "addpt" = "select";
let brush = 3; // cells
let dirty = false;
let mouse = { x: 0, y: 0, in: false };
const masks: Record<string, WalkMask> = {};
const images: Record<string, HTMLImageElement> = {};

type Sel = { kind: "hotspot" | "walkTo" | "floorMin" | "floorMax" | "prop"; i?: number } | null;
let sel: Sel = null;
let layer: "hotspots" | "props" = "hotspots"; // which set the Select tool edits
type Drag = { mode: "move" | "resize" | "walkTo" | "floor" | "paint" | "vertex" | "scale"; handle?: string; vi?: number; ox: number; oy: number; orig?: any } | null;
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
  const lay = group();
  btn("Hotspots", layer === "hotspots", () => { layer = "hotspots"; sel = null; buildBar(); }, lay);
  btn("Sprites", layer === "props", () => { layer = "props"; sel = null; buildBar(); }, lay);
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
  const poly = group();
  btn("◇ To polygon", false, toPolygon, poly);
  btn("+ point", tool === "addpt", () => { tool = tool === "addpt" ? "select" : "addpt"; buildBar(); }, poly);
  btn("□ To rect", false, toRectangle, poly);
  const wk = group();
  btn("Clear walk", false, () => { masks[roomId] = new Uint8Array(GW * GH); setDirty(); }, wk);
  // depth-band scales (how big the character is at the far/near lines)
  const dep = group();
  const fl = room().floor;
  const bump = (key: "minScale" | "maxScale", d: number) => () => { fl[key] = Math.max(0.2, Math.min(4, +(fl[key] + d).toFixed(2))); setDirty(); buildBar(); };
  btn("far −", false, bump("minScale", -0.05), dep);
  const fls = document.createElement("span"); fls.textContent = `far ×${fl.minScale}`; fls.style.opacity = "0.8"; dep.appendChild(fls);
  btn("+", false, bump("minScale", 0.05), dep);
  btn("near −", false, bump("maxScale", -0.05), dep);
  const nls = document.createElement("span"); nls.textContent = `near ×${fl.maxScale}`; nls.style.opacity = "0.8"; dep.appendChild(nls);
  btn("+", false, bump("maxScale", 0.05), dep);
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

// ---- freeform polygon ops ----
function inPolyE(p: { x: number; y: number }, poly: { x: number; y: number }[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (((a.y > p.y) !== (b.y > p.y)) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
const hitH = (p: { x: number; y: number }, h: Hotspot) => (h.poly && h.poly.length >= 3 ? inPolyE(p, h.poly) : inRect(p, h));
const propBox = (pr: Prop) => { const s = SPRITES[pr.sprite]; const w = (s?.w ?? 8) * pr.scale, h = (s?.h ?? 8) * pr.scale; return { x: pr.x, y: pr.y, w, h }; };
const inProp = (p: { x: number; y: number }, pr: Prop) => { const b = propBox(pr); return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h; };
function vertexAt(p: { x: number; y: number }, h: Hotspot) {
  if (!h.poly) return -1;
  for (let i = 0; i < h.poly.length; i++) if (near(p.x, h.poly[i].x, 3) && near(p.y, h.poly[i].y, 3)) return i;
  return -1;
}
function recomputeRect(h: Hotspot) {
  if (!h.poly?.length) return;
  const xs = h.poly.map((v) => v.x), ys = h.poly.map((v) => v.y);
  h.rect = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}
function toPolygon() {
  if (sel?.kind !== "hotspot" || sel.i == null) return alert("Select a hotspot first.");
  const h = room().hotspots[sel.i];
  if (!h.poly) h.poly = [{ x: h.rect.x, y: h.rect.y }, { x: h.rect.x + h.rect.w, y: h.rect.y }, { x: h.rect.x + h.rect.w, y: h.rect.y + h.rect.h }, { x: h.rect.x, y: h.rect.y + h.rect.h }];
  setDirty();
}
function toRectangle() {
  if (sel?.kind !== "hotspot" || sel.i == null) return;
  delete room().hotspots[sel.i].poly;
  setDirty();
}
function addPoint(p: { x: number; y: number }) {
  if (sel?.kind !== "hotspot" || sel.i == null) return;
  const h = room().hotspots[sel.i];
  if (!h.poly) { toPolygon(); return; }
  // insert after the nearest existing vertex
  let best = 0, bd = Infinity;
  h.poly.forEach((v, i) => { const d = Math.hypot(v.x - p.x, v.y - p.y); if (d < bd) { bd = d; best = i; } });
  h.poly.splice(best + 1, 0, { x: Math.round(p.x), y: Math.round(p.y) });
  recomputeRect(h);
  setDirty();
}

async function postRooms(token: string) {
  return fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": token },
    body: JSON.stringify(file, null, 2),
  });
}
async function doSave() {
  masks[roomId] && (room().walk = encodeMask(mask()));
  try {
    let token = localStorage.getItem("slopp_admin_token") ?? "";
    let r = await postRooms(token);
    if (r.status === 401) { // gated deploy: ask for the token once, remember it
      token = prompt("Admin token to save changes:") ?? "";
      localStorage.setItem("slopp_admin_token", token);
      r = await postRooms(token);
    }
    if (!r.ok) throw new Error(await r.text());
    setDirty(false);
    statusEl().textContent = "saved ✓";
  } catch (e) {
    statusEl().className = "dirty";
    statusEl().textContent = "save failed (run the server / check token) — " + (e as Error).message;
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
  if (tool === "addpt") { addPoint(p); return; }
  const r = room();
  // SPRITES layer: resize handle of the selected prop, else select/move
  if (layer === "props") {
    const props = r.props ?? [];
    if (sel?.kind === "prop" && sel.i != null) {
      const b = propBox(props[sel.i]);
      if (near(p.x, b.x + b.w, 3) && near(p.y, b.y + b.h, 3)) { drag = { mode: "scale", ox: 0, oy: 0 }; return; }
    }
    for (let i = props.length - 1; i >= 0; i--) if (inProp(p, props[i])) { sel = { kind: "prop", i }; drag = { mode: "move", ox: p.x - props[i].x, oy: p.y - props[i].y }; return; }
    sel = null; return;
  }
  // HOTSPOTS layer (select tool)
  if (sel?.kind === "hotspot" && sel.i != null) {
    const h = r.hotspots[sel.i];
    const vi = vertexAt(p, h); // drag a polygon vertex
    if (vi >= 0) { drag = { mode: "vertex", vi, ox: p.x, oy: p.y }; return; }
    if (!h.poly) { const handle = handleAt(p, h); if (handle) { drag = { mode: "resize", handle, ox: p.x, oy: p.y, orig: { ...h.rect } }; return; } }
    if (near(p.x, h.walkTo.x, 3) && near(p.y, h.walkTo.y, 3)) { drag = { mode: "walkTo", ox: p.x, oy: p.y }; return; }
  }
  if (near(p.y, r.floor.minY, 2)) { sel = { kind: "floorMin" }; drag = { mode: "floor", ox: 0, oy: 0 }; return; }
  if (near(p.y, r.floor.maxY, 2)) { sel = { kind: "floorMax" }; drag = { mode: "floor", ox: 0, oy: 0 }; return; }
  for (let i = r.hotspots.length - 1; i >= 0; i--) {
    if (hitH(p, r.hotspots[i])) { sel = { kind: "hotspot", i }; drag = { mode: "move", ox: p.x - r.hotspots[i].rect.x, oy: p.y - r.hotspots[i].rect.y }; return; }
  }
  sel = null;
});

canvas.addEventListener("pointermove", (e) => {
  const p = toScene(e); mouse = { x: p.x, y: p.y, in: true };
  if (!drag) return;
  const r = room();
  const rx = Math.round(p.x), ry = Math.round(p.y);
  if (drag.mode === "paint") { paintAt(p, tool === "paint"); return; }
  if (sel?.kind === "prop" && sel.i != null && r.props) {
    const pr = r.props[sel.i];
    if (drag.mode === "scale") {
      const w = SPRITES[pr.sprite]?.w ?? 8;
      pr.scale = Math.max(0.3, Math.min(6, Math.round(((rx - pr.x) / w) * 20) / 20)); // 0.05 steps
    } else {
      pr.x = clampI(rx - Math.round(drag.ox), 0, SX); pr.y = clampI(ry - Math.round(drag.oy), 0, SY);
    }
    setDirty(); return;
  }
  if (sel?.kind === "hotspot" && sel.i != null) {
    const h = r.hotspots[sel.i];
    if (drag.mode === "move") {
      const nx = clampI(rx - Math.round(drag.ox), 0, SX - h.rect.w), ny = clampI(ry - Math.round(drag.oy), 0, SY - h.rect.h);
      const dx = nx - h.rect.x, dy = ny - h.rect.y;
      if (h.poly) h.poly.forEach((v) => { v.x += dx; v.y += dy; });
      h.walkTo.x = clampI(h.walkTo.x + dx, 0, SX); h.walkTo.y = clampI(h.walkTo.y + dy, 0, SY); // walk-to moves with the hotspot
      h.rect.x = nx; h.rect.y = ny; setDirty();
    }
    else if (drag.mode === "vertex" && h.poly && drag.vi != null) { h.poly[drag.vi] = { x: clampI(rx, 0, SX), y: clampI(ry, 0, SY) }; recomputeRect(h); setDirty(); }
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
  // [ / ] resize the selected prop, or the selected depth line's scale
  if (e.key === "[" || e.key === "]") {
    const step = e.key === "]" ? 0.05 : -0.05;
    if (sel?.kind === "prop" && sel.i != null && room().props) {
      const p = room().props![sel.i];
      p.scale = Math.max(0.3, Math.min(6, +(p.scale + step).toFixed(2)));
      e.preventDefault(); setDirty(); return;
    }
    if (sel?.kind === "floorMin" || sel?.kind === "floorMax") {
      const key = sel.kind === "floorMin" ? "minScale" : "maxScale";
      room().floor[key] = Math.max(0.2, Math.min(4, +(room().floor[key] + step).toFixed(2)));
      e.preventDefault(); setDirty(); buildBar(); return;
    }
  }
  const d = e.shiftKey ? 10 : 1;
  const dx = e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0;
  const dy = e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0;
  if (!dx && !dy) return;
  if (sel?.kind === "hotspot" && sel.i != null) {
    const h = room().hotspots[sel.i];
    h.rect.x += dx; h.rect.y += dy; h.walkTo.x += dx; h.walkTo.y += dy;
    if (h.poly) h.poly.forEach((v) => { v.x += dx; v.y += dy; });
  } else if (sel?.kind === "prop" && sel.i != null && room().props) {
    const p = room().props![sel.i]; p.x += dx; p.y += dy;
  } else return;
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

  // props (placed sprites) — draw the actual sprite + an outline so you can see
  // and align them; selectable/movable in the Sprites layer.
  (r.props ?? []).forEach((pr, i) => {
    const sp = SPRITES[pr.sprite];
    if (sp) drawSprite(ctx, sp, Math.round(pr.x * S), Math.round(pr.y * S), pr.scale * S);
    const b = propBox(pr);
    const selp = layer === "props" && sel?.kind === "prop" && sel.i === i;
    ctx.lineWidth = selp ? 2 : 1;
    ctx.strokeStyle = selp ? "#ff8af0" : layer === "props" ? "rgba(255,140,240,0.55)" : "rgba(255,140,240,0.2)";
    ctx.strokeRect(b.x * S + 0.5, b.y * S + 0.5, b.w * S - 1, b.h * S - 1);
    if (layer === "props") label2(pr.id + (selp ? `  ×${pr.scale}` : ""), b.x * S + 1, b.y * S - 2, "#ffb0ee");
    if (selp) { ctx.fillStyle = "#6fe3ff"; ctx.fillRect((b.x + b.w) * S - 3, (b.y + b.h) * S - 3, 6, 6); } // resize handle
  });

  // hotspots
  r.hotspots.forEach((h, i) => {
    const selected = sel?.kind === "hotspot" && sel.i === i;
    const exit = !!h.exit;
    ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeStyle = exit ? "#f0a33a" : selected ? "#ffe27a" : "rgba(255,255,255,0.65)";
    ctx.fillStyle = exit ? "rgba(240,163,58,0.14)" : "rgba(120,160,255,0.12)";
    if (h.poly && h.poly.length >= 2) {
      ctx.beginPath();
      h.poly.forEach((v, k) => (k ? ctx.lineTo(v.x * S, v.y * S) : ctx.moveTo(v.x * S, v.y * S)));
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillRect(h.rect.x * S, h.rect.y * S, h.rect.w * S, h.rect.h * S);
      ctx.strokeRect(h.rect.x * S + 0.5, h.rect.y * S + 0.5, h.rect.w * S - 1, h.rect.h * S - 1);
    }
    label2(h.name + (exit ? ` → ${h.exit!.to}` : "") + (h.poly ? " ◇" : ""), h.rect.x * S + 1, h.rect.y * S - 2, exit ? "#ffd08a" : "#dfe6ff");
    if (selected) {
      ctx.strokeStyle = "rgba(120,230,150,0.7)"; ctx.beginPath();
      ctx.moveTo((h.rect.x + h.rect.w / 2) * S, (h.rect.y + h.rect.h / 2) * S); ctx.lineTo(h.walkTo.x * S, h.walkTo.y * S); ctx.stroke();
      dot(h.walkTo.x * S, h.walkTo.y * S, "#54e08c");
      if (h.poly) {
        for (const v of h.poly) { ctx.fillStyle = "#ffe27a"; ctx.fillRect(v.x * S - 3, v.y * S - 3, 6, 6); }
      } else {
        for (const [hx, hy] of [[h.rect.x, h.rect.y], [h.rect.x + h.rect.w, h.rect.y], [h.rect.x, h.rect.y + h.rect.h], [h.rect.x + h.rect.w, h.rect.y + h.rect.h]]) {
          ctx.fillStyle = "#ffe27a"; ctx.fillRect(hx * S - 3, hy * S - 3, 6, 6);
        }
      }
    }
  });

  // HUD
  const selTxt = sel?.kind === "hotspot" && sel.i != null
    ? (() => { const h = room().hotspots[sel.i!]; return `${h.id}  rect ${h.rect.x},${h.rect.y} ${h.rect.w}×${h.rect.h}  walkTo ${h.walkTo.x},${h.walkTo.y}`; })()
    : sel?.kind === "prop" && sel.i != null
    ? (() => { const p = room().props![sel.i!]; return `${p.id} (${p.sprite})  ${p.x},${p.y}  ×${p.scale}`; })()
    : sel?.kind ? sel.kind : "—";
  label2(`room ${roomId}  ·  ${layer}/${tool}  ·  x${Math.round(mouse.x)} y${Math.round(mouse.y)}`, 4, SY * S - 16, "#cfe6ff");
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
