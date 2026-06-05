import zlib from "node:zlib";
import type { PixelSprite } from "../src/pixels/sprite";

// Minimal PNG encoder (RGBA, no dependencies) for writing sprite previews to
// disk from Node. Browser rendering uses the canvas path in src/pixels/render.ts;
// this exists only so the generator script can emit a .png you can look at.

function hex(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const tb = Buffer.from(type);
  const cr = Buffer.alloc(4);
  cr.writeUInt32BE(crc32(Buffer.concat([tb, data])));
  return Buffer.concat([len, tb, data, cr]);
}

/** Render a sprite to a PNG buffer at `scale`x, over a solid background. */
export function encodePng(sprite: PixelSprite, scale = 12, bg = "#181a1e"): Buffer {
  const iw = sprite.w * scale;
  const ih = sprite.h * scale;
  const [br, bgc, bb] = hex(bg);
  const px = Buffer.alloc(iw * ih * 4);
  for (let i = 0; i < iw * ih; i++) {
    px[i * 4] = br; px[i * 4 + 1] = bgc; px[i * 4 + 2] = bb; px[i * 4 + 3] = 255;
  }
  for (let cy = 0; cy < sprite.h; cy++) {
    const row = sprite.rows[cy] ?? "";
    for (let cx = 0; cx < sprite.w; cx++) {
      const ch = row[cx] ?? ".";
      const color = sprite.palette[ch];
      if (!color || color === "transparent") continue;
      const [r, g, b] = hex(color);
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const o = ((cy * scale + dy) * iw + (cx * scale + dx)) * 4;
          px[o] = r; px[o + 1] = g; px[o + 2] = b;
        }
    }
  }
  const raw = Buffer.alloc(ih * (iw * 4 + 1));
  for (let y = 0; y < ih; y++) {
    raw[y * (iw * 4 + 1)] = 0;
    px.copy(raw, y * (iw * 4 + 1) + 1, y * iw * 4, (y + 1) * iw * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(iw, 0);
  ihdr.writeUInt32BE(ih, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
