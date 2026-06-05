// ============================================================================
//  PIXEL FONT — a 5x7 bitmap font rendered as actual pixels (fillRect per dot),
//  so text scales crisply with the nearest-neighbor upscaled canvas instead of
//  smearing the way the browser's font renderer does at small sizes.
//
//  Uppercase-only glyph set; lowercase input is rendered with the uppercase
//  glyphs (small-caps look), which reads cleanly and suits the loud TV tone.
// ============================================================================

export const GLYPH_W = 5;
export const GLYPH_H = 7;

// each glyph: 7 rows of 5 chars ('X' = pixel)
const F: Record<string, string[]> = {
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  A: [".XXX.", "X...X", "X...X", "XXXXX", "X...X", "X...X", "X...X"],
  B: ["XXXX.", "X...X", "X...X", "XXXX.", "X...X", "X...X", "XXXX."],
  C: [".XXX.", "X...X", "X....", "X....", "X....", "X...X", ".XXX."],
  D: ["XXXX.", "X...X", "X...X", "X...X", "X...X", "X...X", "XXXX."],
  E: ["XXXXX", "X....", "X....", "XXXX.", "X....", "X....", "XXXXX"],
  F: ["XXXXX", "X....", "X....", "XXXX.", "X....", "X....", "X...."],
  G: [".XXX.", "X...X", "X....", "X.XXX", "X...X", "X...X", ".XXX."],
  H: ["X...X", "X...X", "X...X", "XXXXX", "X...X", "X...X", "X...X"],
  I: ["XXXXX", "..X..", "..X..", "..X..", "..X..", "..X..", "XXXXX"],
  J: ["..XXX", "...X.", "...X.", "...X.", "X..X.", "X..X.", ".XX.."],
  K: ["X...X", "X..X.", "X.X..", "XX...", "X.X..", "X..X.", "X...X"],
  L: ["X....", "X....", "X....", "X....", "X....", "X....", "XXXXX"],
  M: ["X...X", "XX.XX", "X.X.X", "X.X.X", "X...X", "X...X", "X...X"],
  N: ["X...X", "XX..X", "X.X.X", "X.X.X", "X..XX", "X...X", "X...X"],
  O: [".XXX.", "X...X", "X...X", "X...X", "X...X", "X...X", ".XXX."],
  P: ["XXXX.", "X...X", "X...X", "XXXX.", "X....", "X....", "X...."],
  Q: [".XXX.", "X...X", "X...X", "X...X", "X.X.X", "X..X.", ".XX.X"],
  R: ["XXXX.", "X...X", "X...X", "XXXX.", "X.X..", "X..X.", "X...X"],
  S: [".XXXX", "X....", "X....", ".XXX.", "....X", "....X", "XXXX."],
  T: ["XXXXX", "..X..", "..X..", "..X..", "..X..", "..X..", "..X.."],
  U: ["X...X", "X...X", "X...X", "X...X", "X...X", "X...X", ".XXX."],
  V: ["X...X", "X...X", "X...X", "X...X", "X...X", ".X.X.", "..X.."],
  W: ["X...X", "X...X", "X...X", "X.X.X", "X.X.X", "XX.XX", "X...X"],
  X: ["X...X", "X...X", ".X.X.", "..X..", ".X.X.", "X...X", "X...X"],
  Y: ["X...X", "X...X", ".X.X.", "..X..", "..X..", "..X..", "..X.."],
  Z: ["XXXXX", "....X", "...X.", "..X..", ".X...", "X....", "XXXXX"],
  "0": [".XXX.", "X...X", "X..XX", "X.X.X", "XX..X", "X...X", ".XXX."],
  "1": ["..X..", ".XX..", "..X..", "..X..", "..X..", "..X..", ".XXX."],
  "2": [".XXX.", "X...X", "....X", "...X.", "..X..", ".X...", "XXXXX"],
  "3": ["XXXXX", "...X.", "..X..", "...X.", "....X", "X...X", ".XXX."],
  "4": ["...X.", "..XX.", ".X.X.", "X..X.", "XXXXX", "...X.", "...X."],
  "5": ["XXXXX", "X....", "XXXX.", "....X", "....X", "X...X", ".XXX."],
  "6": [".XXX.", "X....", "X....", "XXXX.", "X...X", "X...X", ".XXX."],
  "7": ["XXXXX", "....X", "...X.", "..X..", ".X...", ".X...", ".X..."],
  "8": [".XXX.", "X...X", "X...X", ".XXX.", "X...X", "X...X", ".XXX."],
  "9": [".XXX.", "X...X", "X...X", ".XXXX", "....X", "....X", ".XXX."],
  ".": [".....", ".....", ".....", ".....", ".....", ".XX..", ".XX.."],
  ",": [".....", ".....", ".....", ".....", ".XX..", ".XX..", ".X..."],
  "!": ["..X..", "..X..", "..X..", "..X..", "..X..", ".....", "..X.."],
  "?": [".XXX.", "X...X", "....X", "...X.", "..X..", ".....", "..X.."],
  "'": ["..X..", "..X..", "..X..", ".....", ".....", ".....", "....."],
  '"': [".X.X.", ".X.X.", ".X.X.", ".....", ".....", ".....", "....."],
  "-": [".....", ".....", ".....", "XXXXX", ".....", ".....", "....."],
  ":": [".....", ".XX..", ".XX..", ".....", ".XX..", ".XX..", "....."],
  ";": [".....", ".XX..", ".XX..", ".....", ".XX..", ".XX..", ".X..."],
  "(": ["...X.", "..X..", ".X...", ".X...", ".X...", "..X..", "...X."],
  ")": [".X...", "..X..", "...X.", "...X.", "...X.", "..X..", ".X..."],
  "/": ["....X", "....X", "...X.", "..X..", ".X...", "X....", "X...."],
  "*": [".....", "X.X.X", ".XXX.", "XXXXX", ".XXX.", "X.X.X", "....."],
};

const FALLBACK = F["?"];

/** Draw text as crisp pixels. (x,y) is the top-left; returns the width drawn. */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  scale = 1,
  spacing = 1,
): number {
  ctx.fillStyle = color;
  const clean = text.replace(/[—–]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").toUpperCase();
  let cx = Math.round(x);
  const top = Math.round(y);
  for (const ch of clean) {
    const g = F[ch] ?? FALLBACK;
    for (let r = 0; r < GLYPH_H; r++) {
      const row = g[r];
      for (let c = 0; c < GLYPH_W; c++) {
        if (row[c] === "X") ctx.fillRect(cx + c * scale, top + r * scale, scale, scale);
      }
    }
    cx += (GLYPH_W + spacing) * scale;
  }
  return cx - Math.round(x);
}

/** Width in pixels of a string at a given scale. */
export function textWidth(text: string, scale = 1, spacing = 1): number {
  return text.length * (GLYPH_W + spacing) * scale - spacing * scale;
}
