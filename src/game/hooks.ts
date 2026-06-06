// GAME-SPECIFIC runtime hooks for Sex House Island. The engine calls these via
// the EngineApi so this logic lives in the GAME, not the engine. See
// docs/SLOPP-ENGINE.md. (Mike's dive cutscene + the broadcast ending.)
import { Cutscene, arc } from "../cutscene";
import { MIKE_SPRITE } from "./mikeSprite";
import { MIKE_TUCK } from "./mikeTuck";
import type { EngineApi, GameHooks } from "../engineApi";
import type { PixelSprite } from "../pixels/sprite";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// The inescapable camera drone: hovers up-and-right of the player, bobbing.
// Its position is shared by the draw + the clickable hotspot below.
function dronePos(api: EngineApi) {
  return {
    x: Math.round(clamp(api.playerPos.x + 18, 12, api.VW - 12)),
    y: Math.round(clamp(api.playerPos.y - 52 * api.playerScale - 4 + Math.sin(api.t * 4) * 1.5, 8, api.SCENE_H - 26)),
  };
}

function drawDrone(api: EngineApi) {
  const ctx = api.ctx;
  const { x: cx, y: cy } = dronePos(api);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.strokeStyle = "rgba(185,195,205,0.5)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - 8, cy - 3.5); ctx.lineTo(cx - 2, cy - 3.5); ctx.moveTo(cx + 2, cy - 3.5); ctx.lineTo(cx + 8, cy - 3.5); ctx.stroke();
  ctx.strokeStyle = "#3a3f48";
  ctx.beginPath(); ctx.moveTo(cx - 5, cy - 3.5); ctx.lineTo(cx - 5, cy - 1.5); ctx.moveTo(cx + 5, cy - 3.5); ctx.lineTo(cx + 5, cy - 1.5); ctx.stroke();
  ctx.fillStyle = "#1c2026"; ctx.fillRect(cx - 4, cy - 1, 8, 5);
  ctx.fillStyle = "#2c313a"; ctx.fillRect(cx - 3, cy - 2, 6, 2);
  ctx.fillStyle = "#05060a"; ctx.fillRect(cx - 1, cy + 3, 2, 2); // downward lens
  if (Math.sin(api.t * 6) > 0) { ctx.fillStyle = "#ff3b30"; ctx.fillRect(cx + 3, cy, 1, 1); } // blinking red light
  ctx.restore();
}

// --- Mike's dive: a spinning cannonball into the bottomless deep end ---------
type MikeAnim = { active: boolean; pose: "stand" | "tuck" | "hidden"; cx: number; cy: number; scale: number; rot: number; sx: number; sy: number; splash: number };
const mikeAnim: MikeAnim = { active: false, pose: "stand", cx: 0, cy: 0, scale: 1.7, rot: 0, sx: 1, sy: 1, splash: 0 };

function makeMikeDive(api: EngineApi): Cutscene {
  const start = { x: 278, y: 100 }, water = { x: 165, y: 98 };
  return new Cutscene([
    { d: 0.35, on() { mikeAnim.active = true; mikeAnim.pose = "stand"; mikeAnim.splash = 0; mikeAnim.rot = 0; },
      tween(k) { mikeAnim.cx = start.x; mikeAnim.cy = start.y + 5 * k; mikeAnim.scale = 1.7; mikeAnim.sx = 1 + 0.25 * k; mikeAnim.sy = 1 - 0.3 * k; } },
    { d: 0.85, on() { mikeAnim.pose = "tuck"; mikeAnim.sx = 1; mikeAnim.sy = 1; },
      tween(k) { const p = arc(start, water, 48, k); mikeAnim.cx = p.x; mikeAnim.cy = p.y; mikeAnim.scale = 1.7 - 0.95 * k; mikeAnim.rot = -k * Math.PI * 2.4; } },
    { d: 0.9, on() { api.state.flags.mikeGone = true; mikeAnim.pose = "hidden"; }, tween(k) { mikeAnim.splash = k; } },
    { d: 0.6, on() { mikeAnim.active = false; mikeAnim.splash = 0; } },
    { d: 0.01, on() { api.say(["...He's not coming back up."]); } },
  ]);
}

function drawMike(api: EngineApi) {
  if (!mikeAnim.active) return;
  const ctx = api.ctx;
  if (mikeAnim.pose !== "hidden") {
    const sp: PixelSprite = mikeAnim.pose === "tuck" ? MIKE_TUCK : MIKE_SPRITE;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(mikeAnim.cx, mikeAnim.cy);
    ctx.rotate(mikeAnim.rot);
    ctx.scale(mikeAnim.scale * mikeAnim.sx, mikeAnim.scale * mikeAnim.sy);
    api.drawSprite(sp, -sp.w / 2, -sp.h / 2, 1);
    ctx.restore();
  }
  if (mikeAnim.splash > 0) {
    const x = 165, y = 100, k = mikeAnim.splash, r = 3 + k * 20, a = 1 - k;
    ctx.save();
    ctx.strokeStyle = `rgba(180,220,230,${a})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.55, r * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = `rgba(210,235,240,${a})`;
    for (const d of [-0.7, -0.25, 0.25, 0.7]) {
      const dx = x + Math.sin(d) * r, dy = y - Math.cos(d) * 9 * Math.sin(Math.PI * Math.min(1, k * 1.4));
      ctx.fillRect(Math.round(dx), Math.round(dy), 1, 2);
    }
    ctx.restore();
  }
}

export const GAME: GameHooks = {
  update(api) {
    const f = api.state.flags;
    // trigger Mike's dive the moment his last line clears (speech drained; the
    // dialogue closed or sitting on the terminal jump node)
    if (f.mikeJumpPending && api.speechCount === 0 && (!api.dialogueActive || api.dialogueTerminal) && !f.mikeGone && !api.cutsceneActive) {
      api.endDialogue();
      f.mikeJumpPending = false;
      f.mikeJumping = true;
      api.startCutscene(makeMikeDive(api));
    }
  },

  drawWorld(api) {
    drawMike(api);
    drawDrone(api);
  },

  extraHotspots(api) {
    const { x: cx, y: cy } = dronePos(api);
    return [{
      id: "drone",
      name: "the drone",
      rect: { x: cx - 9, y: cy - 5, w: 18, h: 12 },
      walkTo: { x: clamp(api.playerPos.x, 8, api.VW - 8), y: api.playerPos.y },
      face: 0,
    }];
  },

  winScreen(api) {
    const ctx = api.ctx;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, api.VW, api.VH);
    ctx.fillStyle = "#f0ecd0";
    api.centerText("YOU BROADCAST EVERYTHING", api.VW / 2, 58, 11);
    api.centerText("the feeds, the eliminations, the prompt itself —", api.VW / 2, 76, 5);
    api.centerText('"make it sexy. don\'t let anything get too unsexy."', api.VW / 2, 88, 5);
    api.centerText("the whole world is watching the watchers now.", api.VW / 2, 100, 5);
    api.centerText("THE SHOW IS OVER.", api.VW / 2, 114, 7);
    api.centerText("click to play again", api.VW / 2, 126, 5);
  },

  reset() {
    mikeAnim.active = false;
    mikeAnim.splash = 0;
  },
};
