import { SpriteCharacter } from "./spriteCharacter";
import { drawSprite } from "./pixels/render";
import { drawText, textWidth, GLYPH_H } from "./pixelfont";
import { PLAYER_WALK } from "./game/playerWalk";
import { PLAYER_PORTRAIT } from "./game/playerPortrait";
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
type Speech = { text: string; at: { x: number; y: number }; time: number; speaker: "player" | "npc" };
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
function say(lines: string[], at: { x: number; y: number }, speaker: "player" | "npc" = "player") {
  for (const text of lines)
    speechQueue.push({ text, at, time: Math.max(1.1, text.length * 0.045), speaker });
}

function playerSpeechPos() {
  return { x: player.pos.x, y: player.pos.y - 50 * player.scaleIn(ROOMS[state.currentRoom]) };
}

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
  if (r.say) say(r.say, playerSpeechPos());
}

function showDialogueNode() {
  if (!dialogue) return;
  const node = dialogue.nodes[dialogueNode];
  const parrot = ROOMS[state.currentRoom].hotspots.find((h) => h.id === "parrot");
  const at = parrot
    ? { x: parrot.rect.x + parrot.rect.w / 2, y: parrot.rect.y - 6 }
    : playerSpeechPos();
  say(node.npc, at, "npc");
}

function clickInScene(p: { x: number; y: number }) {
  // dialogue choice click is handled in the dialogue UI hit-test below
  const room = ROOMS[state.currentRoom];
  const hs = hotspotAt(p.x, p.y);

  if (hs) {
    const verb = currentVerb;
    const item = pendingItem;
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

function update(dt: number) {
  const room = ROOMS[state.currentRoom];
  player.update(dt, room);

  // advance speech
  if (speechQueue.length > 0) {
    player.talking = true;
    speechQueue[0].time -= dt;
    if (speechQueue[0].time <= 0) speechQueue.shift();
  } else {
    player.talking = false;
  }
}

function render(t: number) {
  const room = ROOMS[state.currentRoom];
  ctx.imageSmoothingEnabled = false;

  // scene
  room.paint(ctx, t, state);
  player.draw(ctx, room);

  // hotspot hover outline (debug-y but helpful while authoring)
  const hs = hotspotAt(mouse.x, mouse.y);
  if (hs && !dialogue && !state.won) {
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.strokeRect(hs.rect.x + 0.5, hs.rect.y + 0.5, hs.rect.w - 1, hs.rect.h - 1);
  }

  // speech bubbles
  for (const sp of speechQueue.slice(0, 1)) drawSpeech(sp.text, sp.at.x, sp.at.y);

  // dialogue portrait — the speaker's generated face, with lip-sync
  if (speechQueue[0]?.speaker === "player") drawPortrait(t);

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

// SCUMM-style dialogue portrait box, bottom-left of the scene, with lip-sync.
function drawPortrait(t: number) {
  const scale = 2.4;
  const size = 24 * scale;
  const px = 4;
  const py = SCENE_H - size - 4;
  ctx.fillStyle = "#0c0c12";
  ctx.fillRect(px - 2, py - 2, size + 4, size + 4);
  ctx.strokeStyle = "#caa54a";
  ctx.strokeRect(px - 1.5, py - 1.5, size + 3, size + 3);
  ctx.imageSmoothingEnabled = false;
  const face = Math.sin(t * 16) > 0 ? PLAYER_PORTRAIT.talking : PLAYER_PORTRAIT.neutral;
  drawSprite(ctx, face, px, py, scale);
}

function drawSpeech(s: string, x: number, y: number) {
  const w = textWidth(s, 1);
  const px = clamp(Math.round(x - w / 2), 3, VW - w - 3);
  const py = clamp(Math.round(y - 8), 3, SCENE_H - GLYPH_H - 3);
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(px - 2, py - 2, w + 4, GLYPH_H + 4);
  drawText(ctx, s, px, py, "#ffffff", 1);
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
