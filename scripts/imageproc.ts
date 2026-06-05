import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import { readFileSync, writeFileSync } from "node:fs";

// Build-time image processing for backdrops: decode a generated PNG, crop it to
// the game's aspect ratio, downscale to the game resolution (so the painted
// backdrop sits at the same chunky resolution as the sprites — the MI look),
// and emit a base64 data URL to bake into the game.

export interface RGBA { w: number; h: number; data: Uint8Array }

export function decodePng(buf: Buffer): RGBA {
  const png = PNG.sync.read(buf);
  return { w: png.width, h: png.height, data: new Uint8Array(png.data) };
}

/** Decode PNG or JPEG (image-gen APIs return either) into RGBA. */
export function decodeImage(buf: Buffer): RGBA {
  if (buf[0] === 0x89 && buf[1] === 0x50) return decodePng(buf); // PNG
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    const j = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
    return { w: j.width, h: j.height, data: new Uint8Array(j.data) };
  }
  const magic = [...buf.subarray(0, 4)].map((b) => b.toString(16).padStart(2, "0")).join(" ");
  throw new Error(`unsupported image format (magic: ${magic})`);
}

export function encodePng(img: RGBA): Buffer {
  const png = new PNG({ width: img.w, height: img.h });
  png.data = Buffer.from(img.data);
  return PNG.sync.write(png);
}

/** Center-crop to a target aspect ratio (tw/th), then box-average downscale. */
export function fitResize(src: RGBA, tw: number, th: number): RGBA {
  // 1) center-crop src to the target aspect ratio
  const targetAR = tw / th;
  let cw = src.w, ch = Math.round(src.w / targetAR);
  if (ch > src.h) { ch = src.h; cw = Math.round(src.h * targetAR); }
  const cx = Math.floor((src.w - cw) / 2);
  const cy = Math.floor((src.h - ch) / 2);

  // 2) box-average downscale the crop into tw x th
  const out = new Uint8Array(tw * th * 4);
  for (let y = 0; y < th; y++) {
    const sy0 = cy + Math.floor((y * ch) / th);
    const sy1 = Math.max(sy0 + 1, cy + Math.floor(((y + 1) * ch) / th));
    for (let x = 0; x < tw; x++) {
      const sx0 = cx + Math.floor((x * cw) / tw);
      const sx1 = Math.max(sx0 + 1, cx + Math.floor(((x + 1) * cw) / tw));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = sy0; sy < sy1; sy++)
        for (let sx = sx0; sx < sx1; sx++) {
          const o = (sy * src.w + sx) * 4;
          r += src.data[o]; g += src.data[o + 1]; b += src.data[o + 2]; a += src.data[o + 3]; n++;
        }
      const o = (y * tw + x) * 4;
      out[o] = (r / n) | 0; out[o + 1] = (g / n) | 0; out[o + 2] = (b / n) | 0; out[o + 3] = (a / n) | 0;
    }
  }
  return { w: tw, h: th, data: out };
}

export function toDataUrl(buf: Buffer): string {
  return `data:image/png;base64,${buf.toString("base64")}`;
}

// Tiny CLI self-test: `tsx scripts/imageproc.ts <in.png> <out.png> [w h]`
if (process.argv[1]?.endsWith("imageproc.ts")) {
  const [, , inp, outp, w, h] = process.argv;
  if (inp && outp) {
    const src = decodePng(readFileSync(inp));
    const r = fitResize(src, w ? +w : 320, h ? +h : 136);
    writeFileSync(outp, encodePng(r));
    console.log(`resized ${src.w}x${src.h} -> ${r.w}x${r.h} -> ${outp}`);
  }
}
