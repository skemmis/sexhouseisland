import { drawSprite, drawTemplate } from "./pixels/render";
import { flatFill, validateFill } from "./pixels/sprite";
import {
  HERO_IDLE, HERO_TEMPLATE, VARIANT_DEFAULT, VARIANT_NIGHT_PIRATE,
} from "./pixels/hero";
import { WALK_FRAMES, WALK_TEMPLATES } from "./pixels/walk";

const canvas = document.getElementById("lab") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

const W = 980;
const H = 470;
canvas.width = W;
canvas.height = H;
ctx.imageSmoothingEnabled = false;

function label(text: string, x: number, y: number, color = "#cfcfe0") {
  ctx.fillStyle = color;
  ctx.font = `13px "Courier New", monospace`;
  ctx.fillText(text, x, y);
}

function panel(title: string, x: number) {
  ctx.strokeStyle = "#2a2a38";
  ctx.strokeRect(x, 40, 220, 270);
  label(title, x, 32);
}

// --- run the pipeline ---
const flat = flatFill(HERO_TEMPLATE, VARIANT_DEFAULT);
const variant = flatFill(HERO_TEMPLATE, VARIANT_NIGHT_PIRATE);
const checkHand = validateFill(HERO_TEMPLATE, HERO_IDLE);
const checkFlat = validateFill(HERO_TEMPLATE, flat);

const big = 10; // pixels-per-cell at large scale
const topY = 70;

// 1) template / zones
panel("1. TEMPLATE (zones)", 20);
drawTemplate(ctx, HERO_TEMPLATE, 50, topY, big);

// 2) flat fill (trivial filler)
panel("2. FLAT FILL (rules)", 260);
drawSprite(ctx, flat, 290, topY, big, true);

// 3) hand-authored fill
panel("3. MODEL-STYLE FILL", 500);
drawSprite(ctx, HERO_IDLE, 530, topY, big, true);

// 4) true resolution + a palette-swap variant
panel("4. TRUE RES + VARIANT", 740);
label("1x (16x24):", 760, topY + 8, "#9a9ab0");
drawSprite(ctx, HERO_IDLE, 850, topY, 1);
label("variant", 760, topY + 120, "#9a9ab0");
drawSprite(ctx, variant, 760, topY + 130, 4);
label("(same template,", 850, topY + 150, "#9a9ab0");
label(" new choice)", 850, topY + 166, "#9a9ab0");

// validator readout
label(
  `validate(hand-authored fill): ${checkHand.ok ? "OK — legal sprite" : checkHand.errors[0]}`,
  20, 340, checkHand.ok ? "#9be2a0" : "#e2796a",
);
label(
  `validate(flat fill):          ${checkFlat.ok ? "OK — legal sprite" : checkFlat.errors[0]}`,
  20, 356, checkFlat.ok ? "#9be2a0" : "#e2796a",
);

// --- animated walk cycle: identity-stable across frames ---------------------
const stripY = 378;
label("WALK CYCLE — frames share a byte-identical upper body (rows 0-14); only legs change → zero identity drift", 20, stripY, "#cfcfe0");

// validate every walk frame against its template up front
const walkOk = WALK_FRAMES.every((f, i) => validateFill(WALK_TEMPLATES[i], f).ok);
label(`validate(all ${WALK_FRAMES.length} walk frames): ${walkOk ? "OK" : "FAILED"}`, 20, stripY + 18, walkOk ? "#9be2a0" : "#e2796a");

let t0 = performance.now();
function animate(now: number) {
  const idx = Math.floor((now - t0) / 140) % WALK_FRAMES.length;
  // clear the strip
  ctx.fillStyle = "#0d0d12";
  ctx.fillRect(20, stripY + 26, W - 40, 70);

  // the 4 static frames laid out
  for (let i = 0; i < WALK_FRAMES.length; i++) {
    ctx.strokeStyle = i === idx ? "#9be2a0" : "#2a2a38";
    ctx.strokeRect(24 + i * 70, stripY + 28, 64, 66);
    drawSprite(ctx, WALK_FRAMES[i], 40 + i * 70, stripY + 30, 2.6);
  }
  // the live animation, larger
  drawSprite(ctx, WALK_FRAMES[idx], 360, stripY + 28, 2.6);
  label("live →", 320, stripY + 60, "#9a9ab0");

  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
