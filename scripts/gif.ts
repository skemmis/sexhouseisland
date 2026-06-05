import type { PixelSprite } from "../src/pixels/sprite";

// Minimal animated-GIF encoder for sprite frames (indexed color, LZW).
// Used to preview generated walk cycles from Node.

function hex(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

function lzw(minCode: number, data: number[]): number[] {
  const clear = 1 << minCode;
  const eoi = clear + 1;
  let codeSize = minCode + 1;
  let dict = new Map<string, number>();
  let next = eoi + 1;
  const reset = () => {
    dict = new Map();
    for (let i = 0; i < clear; i++) dict.set(String.fromCharCode(i), i);
    next = eoi + 1;
    codeSize = minCode + 1;
  };
  const out: number[] = [];
  let cur = 0, bits = 0;
  const emit = (c: number) => {
    cur |= c << bits;
    bits += codeSize;
    while (bits >= 8) { out.push(cur & 0xff); cur >>= 8; bits -= 8; }
  };
  reset();
  emit(clear);
  let w = String.fromCharCode(data[0]);
  for (let i = 1; i < data.length; i++) {
    const k = String.fromCharCode(data[i]);
    const wk = w + k;
    if (dict.has(wk)) w = wk;
    else {
      emit(dict.get(w)!);
      dict.set(wk, next++);
      if (next > (1 << codeSize) && codeSize < 12) codeSize++;
      if (next >= 4096) { emit(clear); reset(); }
      w = k;
    }
  }
  emit(dict.get(w)!);
  emit(eoi);
  if (bits > 0) out.push(cur & 0xff);
  return out;
}

function subBlocks(bytes: number[]): number[] {
  const o: number[] = [];
  for (let i = 0; i < bytes.length; i += 255) {
    const c = bytes.slice(i, i + 255);
    o.push(c.length, ...c);
  }
  o.push(0);
  return o;
}

/** Encode frames (all sharing one palette) into an animated, looping GIF. */
export function encodeGif(frames: PixelSprite[], scale = 8, delayCs = 14, bg = "#181a1e"): Buffer {
  const w = frames[0].w, h = frames[0].h;
  const iw = w * scale, ih = h * scale;

  // build a global color table from the shared palette (index 0 = background)
  const palette = frames[0].palette;
  const colors: [number, number, number][] = [hex(bg)];
  const charToIdx: Record<string, number> = {};
  for (const [ch, css] of Object.entries(palette)) {
    if (ch === "." || css === "transparent") continue;
    charToIdx[ch] = colors.length;
    colors.push(hex(css));
  }
  let bits = 1;
  while (1 << bits < colors.length) bits++;
  bits = Math.max(1, bits);
  const tableSize = 1 << bits;

  const indexPixels = (f: PixelSprite): number[] => {
    const px = new Array<number>(iw * ih).fill(0);
    for (let cy = 0; cy < h; cy++) {
      const row = f.rows[cy] ?? "";
      for (let cx = 0; cx < w; cx++) {
        const idx = charToIdx[row[cx] ?? "."] ?? 0;
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++) px[(cy * scale + dy) * iw + (cx * scale + dx)] = idx;
      }
    }
    return px;
  };

  const b: number[] = [];
  const putStr = (s: string) => { for (const c of s) b.push(c.charCodeAt(0)); };
  putStr("GIF89a");
  b.push(iw & 255, iw >> 8, ih & 255, ih >> 8);
  b.push(0x80 | ((bits - 1) << 4) | (bits - 1), 0, 0); // global color table flag + sizes
  for (let i = 0; i < tableSize; i++) {
    const c = colors[i] ?? [0, 0, 0];
    b.push(c[0], c[1], c[2]);
  }
  b.push(0x21, 0xff, 11); putStr("NETSCAPE2.0"); b.push(3, 1, 0, 0, 0); // loop forever
  for (const f of frames) {
    b.push(0x21, 0xf9, 4, 0x00, delayCs & 255, delayCs >> 8, 0, 0); // graphic control
    b.push(0x2c, 0, 0, 0, 0, iw & 255, iw >> 8, ih & 255, ih >> 8, 0); // image descriptor
    const minCode = Math.max(2, bits);
    b.push(minCode);
    b.push(...subBlocks(lzw(minCode, indexPixels(f))));
  }
  b.push(0x3b);
  return Buffer.from(b);
}
