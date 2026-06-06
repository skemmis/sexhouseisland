// ============================================================================
//  WALKABLE AREAS + PATHFINDING.
//  A room's walkable ground is a low-res paint mask (1 bit per cell). The player
//  is constrained to it and A* routes around holes (e.g. the pool). Depth/scale
//  is still the floor band — the mask only decides WHERE you can stand, not how
//  big you are. Masks are authored in the editor and stored (base64) in
//  rooms.json. A room with no mask falls back to free movement (engine handles).
// ============================================================================
import type { Vec } from "./types";

export const CELL = 4;          // pixels per walk cell
export const GW = 80;           // 320 / CELL
export const GH = 34;           // 136 / CELL  (scene height)

export type WalkMask = Uint8Array; // length GW*GH, 1 = walkable

export const emptyMask = (): WalkMask => new Uint8Array(GW * GH);
const cidx = (cx: number, cy: number) => cy * GW + cx;
export const cellWalkable = (m: WalkMask, cx: number, cy: number) =>
  cx >= 0 && cy >= 0 && cx < GW && cy < GH && m[cidx(cx, cy)] === 1;
export const pxWalkable = (m: WalkMask, x: number, y: number) =>
  cellWalkable(m, Math.floor(x / CELL), Math.floor(y / CELL));

// ---- compact base64 encoding (works in browser + node) ----
function b64encode(bytes: Uint8Array): string {
  if (typeof btoa !== "undefined") { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
  return Buffer.from(bytes).toString("base64");
}
function b64decode(str: string): Uint8Array {
  if (typeof atob !== "undefined") { const bin = atob(str); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }
  return new Uint8Array(Buffer.from(str, "base64"));
}
export function encodeMask(m: WalkMask): string {
  const bytes = new Uint8Array(Math.ceil(m.length / 8));
  for (let i = 0; i < m.length; i++) if (m[i]) bytes[i >> 3] |= 1 << (i & 7);
  return b64encode(bytes);
}
export function decodeMask(str: string): WalkMask {
  const m = emptyMask();
  if (!str) return m;
  const bytes = b64decode(str);
  for (let i = 0; i < m.length; i++) m[i] = (bytes[i >> 3] >> (i & 7)) & 1;
  return m;
}

const center = (cx: number, cy: number): Vec => ({ x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2 });

/** Nearest walkable cell to (cx,cy), spiralling outward. */
function nearestWalkable(m: WalkMask, cx: number, cy: number): { cx: number; cy: number } | null {
  if (cellWalkable(m, cx, cy)) return { cx, cy };
  for (let r = 1; r < Math.max(GW, GH); r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (cellWalkable(m, cx + dx, cy + dy)) return { cx: cx + dx, cy: cy + dy };
    }
  }
  return null;
}

/** Is the straight pixel segment a→b entirely over walkable ground? */
function lineWalkable(m: WalkMask, a: Vec, b: Vec): boolean {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(d / (CELL / 2)));
  for (let i = 0; i <= steps; i++) {
    const x = a.x + (b.x - a.x) * (i / steps), y = a.y + (b.y - a.y) * (i / steps);
    if (!pxWalkable(m, x, y)) return false;
  }
  return true;
}

/**
 * A* over the walk grid from pixel `start` to pixel `goal`, returning pixel
 * waypoints (string-pulled to remove zig-zag). Snaps start/goal to walkable.
 */
export function findPath(m: WalkMask, start: Vec, goal: Vec): Vec[] {
  const s = nearestWalkable(m, Math.floor(start.x / CELL), Math.floor(start.y / CELL));
  const g = nearestWalkable(m, Math.floor(goal.x / CELL), Math.floor(goal.y / CELL));
  if (!s || !g) return [goal];
  const startI = cidx(s.cx, s.cy), goalI = cidx(g.cx, g.cy);

  const open = new Set<number>([startI]);
  const came = new Map<number, number>();
  const gScore = new Map<number, number>([[startI, 0]]);
  const h = (i: number) => { const cx = i % GW, cy = (i / GW) | 0; return Math.hypot(cx - g.cx, cy - g.cy); };
  const fScore = new Map<number, number>([[startI, h(startI)]]);

  while (open.size) {
    let cur = -1, best = Infinity;
    for (const i of open) { const f = fScore.get(i) ?? Infinity; if (f < best) { best = f; cur = i; } }
    if (cur === goalI) break;
    open.delete(cur);
    const cx = cur % GW, cy = (cur / GW) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (!cellWalkable(m, nx, ny)) continue;
      if (dx && dy && (!cellWalkable(m, cx + dx, cy) || !cellWalkable(m, cx, cy + dy))) continue; // no corner cutting
      const ni = cidx(nx, ny);
      const tentative = (gScore.get(cur) ?? Infinity) + (dx && dy ? 1.414 : 1);
      if (tentative < (gScore.get(ni) ?? Infinity)) {
        came.set(ni, cur); gScore.set(ni, tentative); fScore.set(ni, tentative + h(ni)); open.add(ni);
      }
    }
  }

  if (!came.has(goalI) && startI !== goalI) return [goal]; // unreachable — just point there
  const cells: number[] = [goalI];
  let c = goalI;
  while (c !== startI && came.has(c)) { c = came.get(c)!; cells.unshift(c); }
  let pts = cells.map((i) => center(i % GW, (i / GW) | 0));

  // string-pull: drop waypoints we can see past
  const smooth: Vec[] = [pts[0]];
  let anchor = 0;
  for (let i = 2; i < pts.length; i++) {
    if (!lineWalkable(m, pts[anchor], pts[i])) { smooth.push(pts[i - 1]); anchor = i - 1; }
  }
  if (pts.length > 1) smooth.push(pts[pts.length - 1]);
  if (pxWalkable(m, goal.x, goal.y)) smooth[smooth.length - 1] = { ...goal }; // exact landing if valid
  if (smooth.length > 1 && Math.hypot(smooth[0].x - start.x, smooth[0].y - start.y) < CELL) smooth.shift();
  return smooth;
}
