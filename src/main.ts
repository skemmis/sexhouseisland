import { SpriteCharacter } from "./spriteCharacter";
import { drawSprite } from "./pixels/render";
import { Cutscene, arc } from "./cutscene";
import { MIKE_SPRITE } from "./game/mikeSprite";
import { MIKE_TUCK } from "./game/mikeTuck";
import { drawText, textWidth, GLYPH_H, GLYPH_W } from "./pixelfont";
import { PLAYER_WALK } from "./game/playerWalk";
import { PLAYER_PORTRAIT } from "./game/playerPortrait";
import { PLAYER_PORTRAIT_IMG } from "./game/playerPortraitImg";
import { makeBackdrop, drawBackdrop, type Backdrop } from "./background";
import {
  interact, newGame, ROOMS, START_POS, ITEMS,
} from "./game";
import { VERBS, type Verb, type Dialogue, type Item } from "./types";

// ---- internal "virtual" resolution (classic SCUMM-ish 320x200) ----
const VW = 320;
const VH = 200;
const SCENE_H = 136; // playfield height; UI lives below this

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
canvas.width = VW;
canvas.height = VH;

// integer-scale the canvas to fill the window crisply
function resize() {
  const scale = Math.max(1, Math.floor(Math.min(window.innerWidth / VW, window.innerHeight / VH)));
  canvas.style.width = `${VW * scale}px`;
  canvas.style.height = `${VH * scale}px`;
}
window.addEventListener("resize", resize);
resize();

// ---------------------------------------------------------------------------
//  Interaction state
// ---------------------------------------------------------------------------
type CursorVerb = Verb | "Walk to";
const state = newGame();
// The player is now a generated pixel-sprite cast member (see game/playerWalk.ts),
// rendered through the same movement/scaling engine as the procedural figure was.
const player = new SpriteCharacter({ ...START_POS }, PLAYER_WALK, 2.0, 8);

let currentVerb: CursorVerb = "Walk to";
let pendingItem: Item | null = null; // the "X" in "Use X on Y"
let hover = { hotspot: "", item: "", verb: "" };

// speech bubbles (queued)
type Speech = { text: string; at: { x: number; y: number }; time: number; speaker: "player" | "npc"; face?: Backdrop };
let speechQueue: Speech[] = [];

// active conversation
let dialogue: Dialogue | null = null;
let dialogueNode = "";

const mouse = { x: 0, y: 0 };

function toVirtual(e: MouseEvent) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * VW,
    y: ((e.clientY - r.top) / r.height) * VH,
  };
}

// ---------------------------------------------------------------------------
//  UI geometry (verb grid + inventory) — all in the bottom strip
// ---------------------------------------------------------------------------
const SENTENCE_Y = SCENE_H;            // 136
const PANEL_Y = SCENE_H + 10;          // 146
const VERB_COLS = 3, VERB_ROWS = 3;
const VERB_W = 64, VERB_H = 14;
const INV_X = VERB_COLS * VERB_W + 4;  // inventory starts after verb grid
const INV_COLS = 4, INV_ROWS = 3;
const INV_CELL = 17;

function verbAt(x: number, y: number): Verb | null {
  if (y < PANEL_Y) return null;
  const col = Math.floor(x / VERB_W);
  const row = Math.floor((y - PANEL_Y) / VERB_H);
  if (col < 0 || col >= VERB_COLS || row < 0 || row >= VERB_ROWS) return null;
  const idx = row * VERB_COLS + col;
  return VERBS[idx] ?? null;
}

function inventoryItemAt(x: number, y: number): Item | null {
  if (x < INV_X || y < PANEL_Y) return null;
  const col = Math.floor((x - INV_X) / INV_CELL);
  const row = Math.floor((y - PANEL_Y) / INV_CELL);
  if (col < 0 || col >= INV_COLS || row < 0 || row >= INV_ROWS) return null;
  const idx = row * INV_COLS + col;
  return state.inventory[idx] ?? null;
}

function hotspotAt(x: number, y: number) {
  if (y >= SCENE_H) return null;
  const room = ROOMS[state.currentRoom];
  // topmost-last wins; iterate in reverse for "closest" feel
  for (let i = room.hotspots.length - 1; i >= 0; i--) {
    const h = room.hotspots[i];
    if (x >= h.rect.x && x <= h.rect.x + h.rect.w && y >= h.rect.y && y <= h.rect.y + h.rect.h)
      return h;
  }
  return null;
}

// ---------------------------------------------------------------------------
//  Speech helpers
// ---------------------------------------------------------------------------
function say(
  lines: string[],
  at: { x: number; y: number },
  speaker: "player" | "npc" = "player",
  face?: Backdrop,
) {
  for (const text of lines)
    speechQueue.push({ text, at, time: Math.max(1.1, text.length * 0.045), speaker, face });
}

function playerSpeechPos() {
  return { x: player.pos.x, y: player.pos.y - 50 * player.scaleIn(ROOMS[state.currentRoom]) };
}

// cache of NPC portrait images keyed by their data URL
const npcFaces = new Map<string, Backdrop>();
function faceFor(dataUrl?: string): Backdrop | undefined {
  if (!dataUrl) return undefined;
  let f = npcFaces.get(dataUrl);
  if (!f) { f = makeBackdrop(dataUrl); npcFaces.set(dataUrl, f); }
  return f;
}

// where the NPC currently being talked to stands (set when a hotspot is clicked)
let npcAnchor: { x: number; y: number } | null = null;

// ---------------------------------------------------------------------------
//  Performing actions
// ---------------------------------------------------------------------------
function runResult(r: ReturnType<typeof interact>) {
  if (r.effect) r.effect(state);
  if (r.dialogue) {
    dialogue = r.dialogue;
    dialogueNode = r.dialogue.start;
    showDialogueNode();
  }
  if (r.say) say(r.say, playerSpeechPos(), "player", playerFace);
}

function showDialogueNode() {
  if (!dialogue) return;
  const node = dialogue.nodes[dialogueNode];
  node.effect?.(state); // scripted consequence (e.g. Mike jumps in)
  const at = npcAnchor ?? playerSpeechPos();
  say(node.npc, at, "npc", faceFor(dialogue.speakerPortrait));
}

function clickInScene(p: { x: number; y: number }) {
  // dialogue choice click is handled in the dialogue UI hit-test below
  const room = ROOMS[state.currentRoom];
  const hs = hotspotAt(p.x, p.y);

  if (hs) {
    const verb = currentVerb;
    const item = pendingItem;
    npcAnchor = { x: hs.rect.x + hs.rect.w / 2, y: hs.rect.y - 4 };
    player.walkTo(hs.walkTo, hs.face ?? 0, () => {
      if (verb === "Walk to") {
        // just approached; nothing to do
      } else {
        runResult(interact(verb as Verb, hs.id, state, item?.id));
      }
      resetVerb();
    });
  } else {
    // clamp to floor band and walk
    const y = clamp(p.y, room.floor.minY, room.floor.maxY);
    player.walkTo({ x: clamp(p.x, 6, VW - 6), y }, 0);
    if (currentVerb !== "Use" && currentVerb !== "Give") resetVerb();
  }
}

function resetVerb() {
  currentVerb = "Walk to";
  pendingItem = null;
}

// ---------------------------------------------------------------------------
//  Input
// ---------------------------------------------------------------------------
canvas.addEventListener("mousemove", (e) => {
  const p = toVirtual(e);
  mouse.x = p.x; mouse.y = p.y;
  const hs = hotspotAt(p.x, p.y);
  const it = inventoryItemAt(p.x, p.y);
  const vb = verbAt(p.x, p.y);
  hover = { hotspot: hs?.name ?? "", item: it?.name ?? "", verb: vb ?? "" };
});

canvas.addEventListener("click", (e) => {
  const p = toVirtual(e);

  // win screen: click to restart
  if (state.won && speechQueue.length === 0) {
    Object.assign(state, newGame());
    player.pos = { ...START_POS };
    mikeCut = null;
    mikeAnim.active = false;
    resetVerb();
    return;
  }

  // if speech is showing, a click skips the current line
  if (speechQueue.length > 0 && !dialogue) {
    speechQueue.shift();
    return;
  }

  // dialogue mode
  if (dialogue) {
    if (speechQueue.length > 0) { speechQueue.shift(); return; }
    const node = dialogue.nodes[dialogueNode];
    if (!node.choices || node.choices.length === 0) { dialogue = null; return; }
    const choice = dialogueChoiceAt(p.y);
    if (choice != null) {
      const c = node.choices[choice];
      say([c.text], playerSpeechPos()); // player voices their choice
      dialogueNode = c.goto;
      showDialogueNode();
    }
    return;
  }

  // 1) verb buttons
  const vb = verbAt(p.x, p.y);
  if (vb) { currentVerb = vb; pendingItem = null; return; }

  // 2) inventory
  const it = inventoryItemAt(p.x, p.y);
  if (it) {
    if ((currentVerb === "Use" || currentVerb === "Give") && !pendingItem) {
      pendingItem = it; // arm "Use X on ..."
    } else if (currentVerb === "Walk to") {
      runResult(interact("Look at", it.id, state)); // default action on items
    } else {
      runResult(interact(currentVerb as Verb, it.id, state, pendingItem?.id));
      resetVerb();
    }
    return;
  }

  // 3) the scene
  if (p.y < SCENE_H) clickInScene(p);
});

// dialogue choices are drawn in the bottom strip; map a y to a choice index
function dialogueChoiceAt(y: number): number | null {
  if (!dialogue) return null;
  const node = dialogue.nodes[dialogueNode];
  if (!node.choices) return null;
  const top = PANEL_Y;
  const idx = Math.floor((y - top) / 11);
  return idx >= 0 && idx < node.choices.length ? idx : null;
}

// ---------------------------------------------------------------------------
//  Render
// ---------------------------------------------------------------------------
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render(now / 1000);
  requestAnimationFrame(frame);
}

// --- Mike's dive cutscene ---------------------------------------------------
type MikeAnim = { active: boolean; pose: "stand" | "tuck" | "hidden"; cx: number; cy: number; scale: number; rot: number; sx: number; sy: number; splash: number };
const mikeAnim: MikeAnim = { active: false, pose: "stand", cx: 0, cy: 0, scale: 1.7, rot: 0, sx: 1, sy: 1, splash: 0 };
let mikeCut: Cutscene | null = null;

function startMikeJump(): Cutscene {
  const start = { x: 278, y: 100 }; // centre of the static Mike (drawn at 265,80,1.7)
  const water = { x: 165, y: 98 };  // the deep end
  return new Cutscene([
    // wind-up crouch (squash the standing pose)
    { d: 0.35, on() { mikeAnim.active = true; mikeAnim.pose = "stand"; mikeAnim.splash = 0; mikeAnim.rot = 0; },
      tween(k) { mikeAnim.cx = start.x; mikeAnim.cy = start.y + 5 * k; mikeAnim.scale = 1.7; mikeAnim.sx = 1 + 0.25 * k; mikeAnim.sy = 1 - 0.3 * k; } },
    // the leap: arc to the water, tuck + spin, shrinking with distance
    { d: 0.85, on() { mikeAnim.pose = "tuck"; mikeAnim.sx = 1; mikeAnim.sy = 1; },
      tween(k) { const p = arc(start, water, 48, k); mikeAnim.cx = p.x; mikeAnim.cy = p.y; mikeAnim.scale = 1.7 - 0.95 * k; mikeAnim.rot = -k * Math.PI * 2.4; } },
    // splash; he's gone for good
    { d: 0.7, on() { state.flags.mikeGone = true; mikeAnim.pose = "hidden"; },
      tween(k) { mikeAnim.splash = k; } },
    { d: 0.01, on() { mikeAnim.active = false; mikeAnim.splash = 0; } },
  ]);
}

function drawSpriteT(sp: typeof MIKE_SPRITE, cx: number, cy: number, scale: number, rot: number, sx: number, sy: number) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(scale * sx, scale * sy);
  drawSprite(ctx, sp, -sp.w / 2, -sp.h / 2, 1);
  ctx.restore();
}

function drawSplash(x: number, y: number, k: number) {
  ctx.save();
  const r = 3 + k * 20, a = 1 - k;
  ctx.strokeStyle = `rgba(180,220,230,${a})`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x, y, r * 0.55, r * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = `rgba(210,235,240,${a})`;
  for (const d of [-0.7, -0.25, 0.25, 0.7]) {
    const dx = x + Math.sin(d) * r, dy = y - Math.cos(d) * 9 * Math.sin(Math.PI * Math.min(1, k * 1.4));
    ctx.fillRect(Math.round(dx), Math.round(dy), 1, 2);
  }
  ctx.restore();
}

function drawMikeJump() {
  if (!mikeAnim.active) return;
  if (mikeAnim.pose !== "hidden") drawSpriteT(mikeAnim.pose === "tuck" ? MIKE_TUCK : MIKE_SPRITE, mikeAnim.cx, mikeAnim.cy, mikeAnim.scale, mikeAnim.rot, mikeAnim.sx, mikeAnim.sy);
  if (mikeAnim.splash > 0) drawSplash(165, 100, mikeAnim.splash);
}

function update(dt: number) {
  const room = ROOMS[state.currentRoom];
  player.update(dt, room);

  // trigger + advance Mike's scripted dive
  if (state.flags.mikeJumping && !state.flags.mikeGone && !mikeCut) mikeCut = startMikeJump();
  if (mikeCut && !mikeCut.done) mikeCut.update(dt);

  // speech stays on screen until the player clicks to advance (set in the
  // click handler) — no auto-dismiss timer.
  player.talking = speechQueue.length > 0;
}

function render(t: number) {
  const room = ROOMS[state.currentRoom];
  ctx.imageSmoothingEnabled = false;

  // scene
  room.paint(ctx, t, state);
  player.draw(ctx, room);
  drawMikeJump(); // scripted dive, drawn over the scene

  // speech (word-wrapped, stays until click)
  for (const sp of speechQueue.slice(0, 1)) drawSpeech(sp.text, sp.at.x, sp.at.y);

  // dialogue portrait — the speaker's generated face, with lip-sync
  if (speechQueue[0]?.face) drawPortrait(speechQueue[0].face, t);

  // UI strip
  drawUI();

  // win overlay
  if (state.won && speechQueue.length === 0) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = "#f0ecd0";
    centerText("YOU GOT INTO THE VILLA", VW / 2, 80, 12);
    centerText("(the others are still locked out by the pool)", VW / 2, 98, 6);
    centerText("click to play again", VW / 2, 120, 7);
  }
}

function drawUI() {
  // sentence line background
  ctx.fillStyle = "#000";
  ctx.fillRect(0, SENTENCE_Y, VW, VH - SENTENCE_Y);

  if (dialogue && speechQueue.length === 0) { drawDialogueChoices(); return; }

  // sentence line text
  let sentence: string = currentVerb;
  if (pendingItem) sentence = `Use ${pendingItem.name} with`;
  const obj = hover.hotspot || hover.item;
  if (obj) sentence += ` ${obj}`;
  ctx.fillStyle = "#9be2a0";
  text(sentence, 4, SENTENCE_Y + 7, 7);

  // verb grid
  for (let i = 0; i < VERBS.length; i++) {
    const col = i % VERB_COLS, row = Math.floor(i / VERB_COLS);
    const x = col * VERB_W, y = PANEL_Y + row * VERB_H;
    const active = currentVerb === VERBS[i] || hover.verb === VERBS[i];
    ctx.fillStyle = active ? "#f0d060" : "#c08a3a";
    text(VERBS[i], x + 3, y + 10, 7);
  }

  // inventory frame + items
  ctx.strokeStyle = "#5a4128";
  ctx.strokeRect(INV_X - 2, PANEL_Y - 1, INV_COLS * INV_CELL + 2, INV_ROWS * INV_CELL);
  for (let i = 0; i < state.inventory.length && i < INV_COLS * INV_ROWS; i++) {
    const col = i % INV_COLS, row = Math.floor(i / INV_COLS);
    const x = INV_X + col * INV_CELL, y = PANEL_Y + row * INV_CELL;
    const armed = pendingItem?.id === state.inventory[i].id;
    if (armed) { ctx.fillStyle = "rgba(240,208,96,0.3)"; ctx.fillRect(x, y, INV_CELL, INV_CELL); }
    drawIcon(state.inventory[i].icon, x + 2, y + 2);
  }
}

function drawDialogueChoices() {
  if (!dialogue) return;
  const node = dialogue.nodes[dialogueNode];
  if (!node.choices) {
    ctx.fillStyle = "#888";
    text("(click to continue)", 4, PANEL_Y + 8, 7);
    return;
  }
  const sel = dialogueChoiceAt(mouse.y);
  node.choices.forEach((c, i) => {
    ctx.fillStyle = sel === i ? "#f0d060" : "#9be2a0";
    text(`${i + 1}. ${c.text}`, 4, PANEL_Y + 8 + i * 11, 7);
  });
}

// ---------------------------------------------------------------------------
//  Tiny text + procedural inventory icons
// ---------------------------------------------------------------------------
// These keep their old (baseline-y, size) signatures so call sites are
// unchanged, but render through the crisp pixel font. `size` maps to a pixel
// scale; `y` is treated as the text baseline (glyph bottom).
function text(s: string, x: number, y: number, size: number) {
  const scale = size >= 11 ? 2 : 1;
  drawText(ctx, s, x, y - GLYPH_H * scale, ctx.fillStyle as string, scale);
}
function centerText(s: string, cx: number, y: number, size: number) {
  const scale = size >= 11 ? 2 : 1;
  const w = textWidth(s, scale);
  drawText(ctx, s, cx - w / 2, y - GLYPH_H * scale, ctx.fillStyle as string, scale);
}

// SCUMM-style dialogue portrait box, bottom-left of the scene. Prefers the
// Gemini-painted portrait; falls back to the PixelBench portrait (with lip-sync)
// if none is baked in.
const playerFace = makeBackdrop(PLAYER_PORTRAIT_IMG);
function drawPortrait(face: Backdrop, t: number) {
  const size = 58;
  const px = 4;
  const py = SCENE_H - size - 4;
  ctx.fillStyle = "#0c0c12";
  ctx.fillRect(px - 2, py - 2, size + 4, size + 4);
  ctx.strokeStyle = "#caa54a";
  ctx.strokeRect(px - 1.5, py - 1.5, size + 3, size + 3);
  if (!drawBackdrop(ctx, face, px, py, size, size)) {
    // fallback (player only): the PixelBench portrait with lip-sync
    ctx.imageSmoothingEnabled = false;
    const scale = size / 24;
    const f = Math.sin(t * 16) > 0 ? PLAYER_PORTRAIT.talking : PLAYER_PORTRAIT.neutral;
    drawSprite(ctx, f, px, py, scale);
  }
}

// Greedy word-wrap to a max character count per line.
function wrapText(s: string, maxChars: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of s.split(/\s+/)) {
    if (!cur) cur = word;
    else if ((cur + " " + word).length <= maxChars) cur += " " + word;
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawSpeech(s: string, x: number, y: number) {
  const margin = 8;
  const maxChars = Math.floor((VW - margin * 2) / (GLYPH_W + 1));
  const lines = wrapText(s, maxChars);
  const lineH = GLYPH_H + 2;
  const blockW = Math.max(...lines.map((l) => textWidth(l, 1)));
  const blockH = lines.length * lineH;

  // anchor centered above the speaker, clamped to the scene
  let bx = clamp(Math.round(x - blockW / 2), 3, VW - blockW - 3);
  let by = clamp(Math.round(y - blockH), 3, SCENE_H - blockH - 3);

  ctx.fillStyle = "rgba(0,0,0,0.78)";
  ctx.fillRect(bx - 3, by - 2, blockW + 6, blockH + 3);
  for (let i = 0; i < lines.length; i++) {
    const lw = textWidth(lines[i], 1);
    drawText(ctx, lines[i], Math.round(bx + (blockW - lw) / 2), by + i * lineH, "#ffffff", 1);
  }
}

// procedural inventory icons — replace with sprite atlas in production
function drawIcon(kind: string, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  if (kind === "rod") {
    ctx.strokeStyle = "#c8b06a";
    ctx.beginPath(); ctx.moveTo(2, 12); ctx.lineTo(11, 1); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath(); ctx.moveTo(11, 1); ctx.lineTo(12, 8); ctx.stroke();
  } else if (kind === "key") {
    ctx.fillStyle = "#b8902a";
    ctx.beginPath(); ctx.arc(4, 4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(4, 4, 2, 8);
    ctx.fillRect(4, 10, 4, 2);
  }
  ctx.restore();
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// expose item table for quick debugging in the console
(window as any).ITEMS = ITEMS;

requestAnimationFrame(frame);
