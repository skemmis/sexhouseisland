import type { PixelSprite, SpriteTemplate } from "./sprite";

/** Draw a true-pixel sprite: every cell is exactly `scale` screen pixels. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  s: PixelSprite,
  ox: number,
  oy: number,
  scale: number,
  grid = false,
) {
  for (let y = 0; y < s.h; y++) {
    const row = s.rows[y] ?? "";
    // Round cell boundaries (not width) so adjacent cells share an exact edge.
    // At fractional `scale` this prevents the 1px seams that flicker the
    // background through the sprite.
    const py0 = Math.round(oy + y * scale);
    const py1 = Math.round(oy + (y + 1) * scale);
    for (let x = 0; x < s.w; x++) {
      const ch = row[x] ?? ".";
      if (ch === ".") continue;
      const color = s.palette[ch];
      if (!color || color === "transparent") continue;
      ctx.fillStyle = color;
      const px0 = Math.round(ox + x * scale);
      const px1 = Math.round(ox + (x + 1) * scale);
      ctx.fillRect(px0, py0, px1 - px0, py1 - py0);
    }
  }
  if (grid) drawGrid(ctx, ox, oy, s.w, s.h, scale);
}

/**
 * Visualize the template a filler is conditioned on: each zone gets a flat
 * debug color so you can see the silhouette + semantic regions at a glance.
 */
export function drawTemplate(
  ctx: CanvasRenderingContext2D,
  t: SpriteTemplate,
  ox: number,
  oy: number,
  scale: number,
  grid = true,
) {
  for (let y = 0; y < t.h; y++) {
    const row = t.regions[y] ?? "";
    for (let x = 0; x < t.w; x++) {
      const zone = row[x] ?? ".";
      if (zone === ".") continue;
      ctx.fillStyle = zoneColor(zone);
      ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
    }
  }
  if (grid) drawGrid(ctx, ox, oy, t.w, t.h, scale);
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  w: number,
  h: number,
  scale: number,
) {
  if (scale < 4) return;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x++) {
    ctx.beginPath();
    ctx.moveTo(ox + x * scale + 0.5, oy);
    ctx.lineTo(ox + x * scale + 0.5, oy + h * scale);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y++) {
    ctx.beginPath();
    ctx.moveTo(ox, oy + y * scale + 0.5);
    ctx.lineTo(ox + w * scale, oy + y * scale + 0.5);
    ctx.stroke();
  }
}

// stable debug colors per zone id
const ZONE_COLORS: Record<string, string> = {
  O: "#222230", // outline
  S: "#e3b07a", // skin
  E: "#3a86ff", // eye
  H: "#8a5a30", // hair
  C: "#dfe6ee", // shirt
  V: "#3a6ea5", // vest
  B: "#6b4f2a", // belt
  L: "#444458", // legs
  K: "#3a2a18", // boots
};
function zoneColor(z: string) {
  return ZONE_COLORS[z] ?? "#ff00ff";
}
