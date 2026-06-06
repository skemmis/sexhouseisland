import { PNG } from "pngjs";
import { writeFileSync } from "node:fs";

// ============================================================================
//  Draw a clean, perfectly-registered 4-frame WALK-CYCLE SILHOUETTE sheet to
//  feed an image model as a POSE GUIDE (the character identity comes from a
//  separate reference). Procedural = exact stride/arm-swing + alignment we
//  control, which the model won't drift on.  ->  generated/poseSheet.png
// ============================================================================

const FW = 150, FH = 256, N = 4, W = FW * N, H = FH;
const png = new PNG({ width: W, height: H });
for (let i = 0; i < png.data.length; i += 4) { png.data[i] = 255; png.data[i + 1] = 0; png.data[i + 2] = 255; png.data[i + 3] = 255; } // magenta

const set = (x: number, y: number) => {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 4; png.data[o] = 20; png.data[o + 1] = 18; png.data[o + 2] = 26; png.data[o + 3] = 255;
};
const disc = (cx: number, cy: number, r: number) => {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) set(cx + x, cy + y);
};
const seg = (x0: number, y0: number, x1: number, y1: number, r: number) => {
  const dx = x1 - x0, dy = y1 - y0, steps = Math.ceil(Math.hypot(dx, dy)) || 1;
  for (let i = 0; i <= steps; i++) disc(x0 + (dx * i) / steps, y0 + (dy * i) / steps, r);
};

for (let f = 0; f < N; f++) {
  const cx = f * FW + FW / 2, gy = 238;
  const a = 2 * Math.PI * (f / N);
  const legA = 0.6, armA = 0.5;
  const hipY = gy - 108, shY = gy - 172, neckY = gy - 180, headR = 17, legLen = 108, armLen = 80;
  // legs (right leg swings opposite the left)
  const lL = legA * Math.sin(a), lR = legA * Math.sin(a + Math.PI);
  seg(cx - 6, hipY, cx - 6 + legLen * Math.sin(lL), hipY + legLen * Math.cos(lL), 9);
  seg(cx + 6, hipY, cx + 6 + legLen * Math.sin(lR), hipY + legLen * Math.cos(lR), 9);
  // torso
  seg(cx, neckY, cx, hipY, 13);
  // arms (swing opposite the same-side leg)
  const aL = -armA * Math.sin(a), aR = -armA * Math.sin(a + Math.PI);
  seg(cx - 14, shY, cx - 14 + armLen * Math.sin(aL), shY + armLen * Math.cos(aL), 6);
  seg(cx + 14, shY, cx + 14 + armLen * Math.sin(aR), shY + armLen * Math.cos(aR), 6);
  // head
  disc(cx, neckY - headR + 3, headR);
}

writeFileSync("generated/poseSheet.png", PNG.sync.write(png));
console.log(`wrote generated/poseSheet.png ${W}x${H} (${N} poses)`);
