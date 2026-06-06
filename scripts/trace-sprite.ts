import { readFileSync, writeFileSync } from "node:fs";
import { decodeImage, encodePng, type RGBA } from "./imageproc";
import { encodeGif } from "./gif";
import { WORLD_PALETTE } from "../src/art";
import type { PixelSprite } from "../src/pixels/sprite";

// ============================================================================
//  TRACE a generated character image into our true-pixel sprite format.
//
//    npm run trace -- --in generated/playerSrc.raw --module src/game/playerTraced.ts \
//      --var PLAYER_TRACED --w 40 --h 44
//
//  Steps: decode -> key out the flat background -> crop to the figure ->
//  contain-fit to the target grid (box-average) -> snap each opaque cell to the
//  nearest WORLD_PALETTE colour. Output: a PixelSprite .ts module + a scaled PNG
//  preview. Palette-locking on trace is what kills the colour drift between
//  AI-generated frames.
// ============================================================================

const arg = (flag: string, def?: string) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : def;
};

const PAL = Object.entries(WORLD_PALETTE)
  .filter(([k, v]) => k !== "." && v !== "transparent")
  .map(([k, v]) => ({ k, rgb: hexToRgb(v) }));

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function nearest(r: number, g: number, b: number): string {
  let best = PAL[0], bd = Infinity;
  for (const p of PAL) {
    const d = (p.rgb[0] - r) ** 2 + (p.rgb[1] - g) ** 2 + (p.rgb[2] - b) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  return best.k;
}

/** Key out the flat background: anything near the averaged corner colour (or
 *  pure magenta) becomes transparent. Returns a per-pixel alpha mask. */
function keyBackground(img: RGBA): Uint8Array {
  const at = (x: number, y: number) => { const o = (y * img.w + x) * 4; return [img.data[o], img.data[o + 1], img.data[o + 2]]; };
  const corners = [at(0, 0), at(img.w - 1, 0), at(0, img.h - 1), at(img.w - 1, img.h - 1)];
  const bg = [0, 1, 2].map((c) => Math.round(corners.reduce((s, p) => s + p[c], 0) / corners.length)) as [number, number, number];
  const mask = new Uint8Array(img.w * img.h);
  const TH = 64 * 64; // squared RGB distance threshold
  for (let i = 0; i < img.w * img.h; i++) {
    const o = i * 4, r = img.data[o], g = img.data[o + 1], b = img.data[o + 2];
    const dBg = (r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2;
    const dMag = (r - 255) ** 2 + g ** 2 + (b - 255) ** 2; // near #FF00FF
    mask[i] = dBg < TH || dMag < 90 * 90 ? 0 : 255;
  }
  return mask;
}

function bbox(img: RGBA, mask: Uint8Array, cx0 = 0, cx1 = img.w) {
  let x0 = cx1, y0 = img.h, x1 = cx0, y1 = 0;
  for (let y = 0; y < img.h; y++)
    for (let x = cx0; x < cx1; x++)
      if (mask[y * img.w + x]) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return { x: x0, y: y0, w: Math.max(1, x1 - x0 + 1), h: Math.max(1, y1 - y0 + 1) };
}

/** Average the opaque source pixels in a box and snap to the palette ('.' if
 *  mostly background). Shared by single + sheet tracing. */
function cell(img: RGBA, mask: Uint8Array, sx0: number, sx1: number, sy0: number, sy1: number): string {
  let r = 0, g = 0, b = 0, opaque = 0, total = 0;
  for (let sy = sy0; sy < sy1; sy++)
    for (let sx = sx0; sx < sx1; sx++) {
      total++;
      if (mask[sy * img.w + sx]) { const o = (sy * img.w + sx) * 4; r += img.data[o]; g += img.data[o + 1]; b += img.data[o + 2]; opaque++; }
    }
  if (!total || opaque / total < 0.4) return ".";
  return nearest(r / opaque, g / opaque, b / opaque);
}

/** Trace one frame of a sheet into a SHARED w×h canvas: scaled by a common
 *  factor (refH), feet on the bottom baseline, horizontally centered — so the
 *  frames register and don't jitter. */
function traceFrame(img: RGBA, mask: Uint8Array, bb: { x: number; y: number; w: number; h: number }, refH: number, W: number, H: number): PixelSprite {
  const cellsTall = Math.max(1, Math.round((H * bb.h) / refH));
  const cellsWide = Math.max(1, Math.round((H * bb.w) / refH));
  const top = H - cellsTall;                       // feet at the bottom
  const left = Math.round((W - cellsWide) / 2);    // centered
  const palette: Record<string, string> = { ".": "transparent" };
  const rows: string[] = [];
  for (let y = 0; y < H; y++) {
    let row = "";
    for (let x = 0; x < W; x++) {
      const lx = x - left, ly = y - top;
      if (lx < 0 || lx >= cellsWide || ly < 0 || ly >= cellsTall) { row += "."; continue; }
      const sx0 = bb.x + Math.floor((lx * bb.w) / cellsWide), sx1 = bb.x + Math.max(Math.floor((lx * bb.w) / cellsWide) + 1, Math.floor(((lx + 1) * bb.w) / cellsWide));
      const sy0 = bb.y + Math.floor((ly * bb.h) / cellsTall), sy1 = bb.y + Math.max(Math.floor((ly * bb.h) / cellsTall) + 1, Math.floor(((ly + 1) * bb.h) / cellsTall));
      const ch = cell(img, mask, sx0, sx1, sy0, sy1);
      row += ch; if (ch !== ".") palette[ch] = WORLD_PALETTE[ch];
    }
    rows.push(row);
  }
  return { w: W, h: H, rows, palette };
}

function trace(img: RGBA, mask: Uint8Array, maxW: number, maxH: number): PixelSprite {
  const bb = bbox(img, mask);
  const ar = bb.w / bb.h;
  let th = maxH, tw = Math.round(th * ar);
  if (tw > maxW) { tw = maxW; th = Math.round(tw / ar); }
  const palette: Record<string, string> = { ".": "transparent" };
  const rows: string[] = [];
  for (let y = 0; y < th; y++) {
    let row = "";
    for (let x = 0; x < tw; x++) {
      const sx0 = bb.x + Math.floor((x * bb.w) / tw), sx1 = bb.x + Math.max(Math.floor((x * bb.w) / tw) + 1, Math.floor(((x + 1) * bb.w) / tw));
      const sy0 = bb.y + Math.floor((y * bb.h) / th), sy1 = bb.y + Math.max(Math.floor((y * bb.h) / th) + 1, Math.floor(((y + 1) * bb.h) / th));
      let r = 0, g = 0, b = 0, opaque = 0, total = 0;
      for (let sy = sy0; sy < sy1; sy++)
        for (let sx = sx0; sx < sx1; sx++) {
          total++;
          if (mask[sy * img.w + sx]) { const o = (sy * img.w + sx) * 4; r += img.data[o]; g += img.data[o + 1]; b += img.data[o + 2]; opaque++; }
        }
      if (opaque / total < 0.4) { row += "."; continue; } // mostly background
      const ch = nearest(r / opaque, g / opaque, b / opaque);
      row += ch; palette[ch] = WORLD_PALETTE[ch];
    }
    rows.push(row);
  }
  return { w: tw, h: th, rows, palette };
}

/** Render a PixelSprite to a scaled-up RGBA PNG for eyeballing. */
function previewPng(s: PixelSprite, scale: number): RGBA {
  const w = s.w * scale, h = s.h * scale;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const ch = s.rows[y][x];
      if (ch === ".") continue;
      const [r, g, b] = hexToRgb(s.palette[ch]);
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const o = ((y * scale + dy) * w + (x * scale + dx)) * 4;
          data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
        }
    }
  return { w, h, data };
}

function main() {
  const inPath = arg("--in", "generated/playerSrc.raw")!;
  const outModule = arg("--module", "src/game/playerTraced.ts")!;
  const varName = arg("--var", "PLAYER_TRACED")!;
  const maxW = +arg("--w", "40")!, maxH = +arg("--h", "44")!;
  const frames = +arg("--frames", "1")!;
  const stem = outModule.split("/").pop()!.replace(/\.ts$/, "");

  const img = decodeImage(readFileSync(inPath));
  const mask = keyBackground(img);

  if (frames > 1) {
    // Slice the sheet into N equal columns, trace each with shared registration.
    const colW = Math.floor(img.w / frames);
    const boxes = Array.from({ length: frames }, (_, f) => bbox(img, mask, f * colW, f * colW + colW));
    const refH = Math.max(...boxes.map((b) => b.h)); // common scale across frames
    const sprites = boxes.map((bb) => traceFrame(img, mask, bb, refH, maxW, maxH));
    writeFileSync(`generated/${stem}.gif`, encodeGif(sprites, 8, 14));
    sprites.forEach((s, i) => writeFileSync(`generated/${stem}-${i}.png`, encodePng(previewPng(s, 8))));
    writeFileSync(
      outModule,
      `// Walk cycle traced from ${inPath} by \`npm run trace --frames ${frames}\` — snapped to WORLD_PALETTE.\n` +
        `import type { PixelSprite } from "../pixels/sprite";\n\n` +
        `export const ${varName}: PixelSprite[] = ${JSON.stringify(sprites, null, 2)};\n`,
    );
    console.log(`✓ traced ${frames} frames -> ${maxW}x${maxH} cells each\n  generated/${stem}.gif (animated)\n  ${outModule}`);
    return;
  }

  const s = trace(img, mask, maxW, maxH);
  writeFileSync(`generated/${stem}.png`, encodePng(previewPng(s, 8)));
  writeFileSync(
    outModule,
    `// Traced from ${inPath} by \`npm run trace\` — snapped to the WORLD_PALETTE.\n` +
      `import type { PixelSprite } from "../pixels/sprite";\n\n` +
      `export const ${varName}: PixelSprite = ${JSON.stringify(s, null, 2)};\n`,
  );
  console.log(`✓ traced ${img.w}x${img.h} -> ${s.w}x${s.h} cells\n  generated/${stem}.png (preview)\n  ${outModule}`);
}

main();
