import { SpriteCharacter } from "./spriteCharacter";
import { drawSprite } from "./pixels/render";
import { Cutscene, arc } from "./cutscene";
import { findPath, decodeMask, type WalkMask } from "./walk";
import { startMusic, toggleMusic, musicMuted } from "./music";
import { MIKE_SPRITE } from "./game/mikeSprite";
import { MIKE_TUCK } from "./game/mikeTuck";
import { drawText, textWidth, GLYPH_H, GLYPH_W } from "./pixelfont";
import { PLAYER_WALK } from "./game/playerWalk";
import { PLAYER_PORTRAIT } from "./game/playerPortrait";
import { PLAYER_PORTRAIT_IMG } from "./game/playerPortraitImg";
import { makeBackdrop, drawBackdrop, type Backdrop } from "./background";
import {
  interact, newGame, ROOMS, START_POS, ITEMS, initScenes,
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
let hoveredHotspotId: string | null = null;

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

// the drone's current on-screen rect, updated each frame by drawDrone
let droneRect = { x: -99, y: -99, w: 0, h: 0 };

// A hotspot is live only when its (optional) visibility condition is met.
function hsVisible(h: { visibleWhen?: { flag: string; is: boolean } }) {
  return !h.visibleWhen || !!state.flags[h.visibleWhen.flag] === h.visibleWhen.is;
}
// Point-in-polygon (ray cast) for freeform hotspots.
function inPoly(x: number, y: number, poly: { x: number; y: number }[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (((a.y > y) !== (b.y > y)) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function hitHotspot(x: number, y: number, h: import("./types").Hotspot) {
  if (h.poly && h.poly.length >= 3) return inPoly(x, y, h.poly);
  return x >= h.rect.x && x <= h.rect.x + h.rect.w && y >= h.rect.y && y <= h.rect.y + h.rect.h;
}

function hotspotAt(x: number, y: number) {
  if (y >= SCENE_H) return null;
  // the ever-present camera drone is clickable wherever it's hovering
  if (x >= droneRect.x && x <= droneRect.x + droneRect.w && y >= droneRect.y && y <= droneRect.y + droneRect.h)
    return { id: "drone", name: "the drone", rect: { ...droneRect }, walkTo: { x: clamp(player.pos.x, 8, VW - 8), y: player.pos.y }, face: 0 };
  const room = ROOMS[state.currentRoom];
  // topmost-last wins; iterate in reverse for "closest" feel
  for (let i = room.hotspots.length - 1; i >= 0; i--) {
    const h = room.hotspots[i];
    if (hsVisible(h) && hitHotspot(x, y, h)) return h;
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
  if (r.goto) changeRoom(r.goto.room, r.goto.entry, r.goto.face ?? 0);
  if (r.say) say(r.say, playerSpeechPos(), "player", playerFace);
}

// Travel between rooms: reposition the player and clear any conversation/speech.
function changeRoom(to: string, entry: { x: number; y: number }, face = 0) {
  state.currentRoom = to;
  player.pos = { ...entry };
  player.walkTo({ ...entry }, face); // stop motion + set facing
  speechQueue.length = 0;
  dialogue = null;
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
    moveTo(hs.walkTo, hs.face ?? 0, () => {
      if (hs.exit) changeRoom(hs.exit.to, hs.exit.entry, hs.exit.face ?? 0);
      else runResult(interact(verb as Verb, hs.id, state, item?.id));
      resetVerb();
    });
  } else {
    const mask = getMask(room);
    // with a walk mask, pathfinding snaps to walkable ground; without one,
    // clamp to the floor band as before.
    const target = mask
      ? { x: clamp(p.x, 0, VW), y: clamp(p.y, 0, SCENE_H) }
      : { x: clamp(p.x, 6, VW - 6), y: clamp(p.y, room.floor.minY, room.floor.maxY) };
    moveTo(target, 0);
    if (currentVerb !== "Use" && currentVerb !== "Give") resetVerb();
  }
}

// Move the player to a point, routing around obstacles if the room has a walk
// mask; otherwise walk straight (the pre-mask behavior).
function moveTo(target: { x: number; y: number }, face: number, cb?: () => void) {
  const room = ROOMS[state.currentRoom];
  const mask = getMask(room);
  if (mask) player.walkPath(findPath(mask, player.pos, target), face, cb);
  else player.walkTo(target, face, cb);
}

const maskCache: Record<string, WalkMask | null> = {};
function getMask(room: typeof ROOMS[string]): WalkMask | null {
  if (!(room.id in maskCache)) maskCache[room.id] = room.walk ? decodeMask(room.walk) : null;
  return maskCache[room.id];
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
  hoveredHotspotId = hs?.id ?? null;
});

window.addEventListener("keydown", (e) => {
  if (e.key === "m" || e.key === "M") { startMusic(); toggleMusic(); }
});

// little note icon, top-right: green = playing, dim = muted
function drawMusicIcon() {
  const x = VW - 11, y = 3;
  ctx.fillStyle = musicMuted() ? "rgba(210,210,210,0.4)" : "#54e08c";
  ctx.fillRect(x + 4, y, 1, 6);
  ctx.fillRect(x + 1, y + 5, 4, 3);
  ctx.fillRect(x + 4, y, 3, 1);
}

canvas.addEventListener("click", (e) => {
  startMusic(); // first user gesture kicks off the soundtrack (idempotent)
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
    { d: 0.9, on() { state.flags.mikeGone = true; mikeAnim.pose = "hidden"; },
      tween(k) { mikeAnim.splash = k; } },
    // a beat, then the player reacts
    { d: 0.6, on() { mikeAnim.active = false; mikeAnim.splash = 0; } },
    { d: 0.01, on() { say(["...He's not coming back up."], playerSpeechPos(), "player", playerFace); } },
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

  // trigger Mike's dive the moment his last line clears (speech drained, and
  // either the dialogue has closed or we're on the terminal jump node)
  const onTerminalNode = !!dialogue && !dialogue.nodes[dialogueNode]?.choices?.length;
  if (state.flags.mikeJumpPending && speechQueue.length === 0 && (!dialogue || onTerminalNode) && !state.flags.mikeGone && !mikeCut) {
    dialogue = null; // close the conversation; the dive takes over
    state.flags.mikeJumpPending = false;
    state.flags.mikeJumping = true;
    mikeCut = startMikeJump();
  }
  if (mikeCut && !mikeCut.done) mikeCut.update(dt);

  // speech stays on screen until the player clicks to advance (set in the
  // click handler) — no auto-dismiss timer.
  player.talking = speechQueue.length > 0;
}

// The inescapable camera drone — hovers up-and-right of the player in every
// room, bobbing, red light blinking. Drawn over everything; clickable anywhere.
function drawDrone(t: number) {
  const room = ROOMS[state.currentRoom];
  const s = player.scaleIn(room);
  const cx = Math.round(clamp(player.pos.x + 18, 12, VW - 12));
  const cy = Math.round(clamp(player.pos.y - 52 * s - 4 + Math.sin(t * 4) * 1.5, 8, SCENE_H - 26));
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  // spinning rotors
  ctx.strokeStyle = "rgba(185,195,205,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - 8, cy - 3.5); ctx.lineTo(cx - 2, cy - 3.5); ctx.moveTo(cx + 2, cy - 3.5); ctx.lineTo(cx + 8, cy - 3.5); ctx.stroke();
  ctx.strokeStyle = "#3a3f48";
  ctx.beginPath(); ctx.moveTo(cx - 5, cy - 3.5); ctx.lineTo(cx - 5, cy - 1.5); ctx.moveTo(cx + 5, cy - 3.5); ctx.lineTo(cx + 5, cy - 1.5); ctx.stroke();
  // body + camera lens
  ctx.fillStyle = "#1c2026"; ctx.fillRect(cx - 4, cy - 1, 8, 5);
  ctx.fillStyle = "#2c313a"; ctx.fillRect(cx - 3, cy - 2, 6, 2);
  ctx.fillStyle = "#05060a"; ctx.fillRect(cx - 1, cy + 3, 2, 2); // downward lens
  // the red light, always blinking
  if (Math.sin(t * 6) > 0) { ctx.fillStyle = "#ff3b30"; ctx.fillRect(cx + 3, cy, 1, 1); }
  ctx.restore();
  droneRect = { x: cx - 9, y: cy - 5, w: 18, h: 12 };
}

// A soft bobbing chevron over each way out of the room, so exits are findable.
function drawExitCues(t: number) {
  const room = ROOMS[state.currentRoom];
  const pulse = 0.5 + 0.5 * Math.sin(t * 3);
  const bob = Math.sin(t * 3) * 1.5;
  for (const h of room.hotspots) {
    const isExit = !!h.exit || (h.id === "door" && state.flags.doorOpen);
    if (!isExit || !hsVisible(h)) continue;
    const cx = Math.round(h.rect.x + h.rect.w / 2);
    const cy = Math.round(h.rect.y + h.rect.h / 2 + bob);
    const hot = hoveredHotspotId === h.id;
    ctx.save();
    ctx.globalAlpha = (hot ? 0.85 : 0.4) + 0.35 * pulse;
    ctx.strokeStyle = "#f2e7b0";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();             // an up-chevron: "exit this way"
    ctx.moveTo(cx - 4, cy + 2);
    ctx.lineTo(cx, cy - 3);
    ctx.lineTo(cx + 4, cy + 2);
    ctx.stroke();
    ctx.restore();
  }
}

function render(t: number) {
  const room = ROOMS[state.currentRoom];
  ctx.imageSmoothingEnabled = false;

  // scene
  room.paint(ctx, t, state);
  player.draw(ctx, room);
  drawMikeJump(); // scripted dive, drawn over the scene
  drawExitCues(t); // show where you can leave the room
  drawDrone(t);   // the inescapable camera, in every room

  // one consistent dialogue panel (portrait + wrapped text) above the verb bar
  if (speechQueue[0]) drawDialoguePanel(speechQueue[0], t);
  drawMusicIcon();

  // UI strip
  drawUI();

  // win overlay
  if (state.won && speechQueue.length === 0) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = "#f0ecd0";
    centerText("YOU BROADCAST EVERYTHING", VW / 2, 58, 11);
    centerText("the feeds, the eliminations, the prompt itself —", VW / 2, 76, 5);
    centerText('"make it sexy. don\'t let anything get too unsexy."', VW / 2, 88, 5);
    centerText("the whole world is watching the watchers now.", VW / 2, 100, 5);
    centerText("THE SHOW IS OVER.", VW / 2, 114, 7);
    centerText("click to play again", VW / 2, 126, 5);
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

// One consistent dialogue panel above the verb bar: speaker portrait on the
// left, word-wrapped text on the right. Used for ALL speech (player narration
// and NPC lines), so presentation never varies.
function drawDialoguePanel(sp: Speech, t: number) {
  const pad = 5, ps = 42;
  const hasFace = !!sp.face;
  const x0 = 3, w = VW - 6;
  const textX = x0 + pad + (hasFace ? ps + pad : 0);
  const maxTextW = x0 + w - pad - textX;
  const maxChars = Math.max(8, Math.floor(maxTextW / (GLYPH_W + 1)));
  const lines = wrapText(sp.text, maxChars);
  const lineH = GLYPH_H + 2;
  const textH = lines.length * lineH;
  const h = Math.max(hasFace ? ps + pad * 2 : 0, textH + pad * 2);
  const y0 = SCENE_H - h - 2;

  ctx.fillStyle = "rgba(8,8,14,0.92)";
  ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle = "#caa54a"; ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);

  if (hasFace) {
    const qx = x0 + pad, qy = y0 + (h - ps) / 2;
    ctx.fillStyle = "#0c0c12"; ctx.fillRect(qx, qy, ps, ps);
    const drew = drawBackdrop(ctx, sp.face!, qx, qy, ps, ps);
    if (!drew && sp.speaker === "player") {
      ctx.imageSmoothingEnabled = false;
      const f = Math.sin(t * 16) > 0 ? PLAYER_PORTRAIT.talking : PLAYER_PORTRAIT.neutral;
      drawSprite(ctx, f, qx, qy, ps / 24);
    }
    ctx.strokeStyle = "#caa54a"; ctx.strokeRect(qx + 0.5, qy + 0.5, ps - 1, ps - 1);
  }

  const top = y0 + (h - textH) / 2;
  for (let i = 0; i < lines.length; i++) drawText(ctx, lines[i], textX, top + i * lineH, "#f3efda", 1);
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
  } else if (kind === "towel") {
    ctx.fillStyle = "#d8b24a"; ctx.fillRect(1, 2, 11, 9); // folded towel
    ctx.fillStyle = "#c0556f"; ctx.fillRect(1, 5, 11, 2); // a stripe
    ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(1, 2, 11, 1);
  } else if (kind === "fish") {
    ctx.fillStyle = "#8aa6b0"; ctx.beginPath(); ctx.ellipse(6, 7, 5, 3, 0, 0, Math.PI * 2); ctx.fill(); // body
    ctx.beginPath(); ctx.moveTo(11, 7); ctx.lineTo(14, 4); ctx.lineTo(14, 10); ctx.closePath(); ctx.fill(); // tail
    ctx.fillStyle = "#1a1a1a"; ctx.fillRect(3, 6, 1, 1); // eye
  } else if (kind === "drive") {
    ctx.fillStyle = "#2b2f37"; ctx.fillRect(1, 3, 12, 8); // case
    ctx.fillStyle = "#3a3f48"; ctx.fillRect(1, 3, 12, 2);
    ctx.fillStyle = "#54e08c"; ctx.fillRect(11, 8, 1, 1); // activity LED
  }
  ctx.restore();
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// expose item table for quick debugging in the console
(window as any).ITEMS = ITEMS;

requestAnimationFrame(frame);

// Pull live scene data (the editor's saved edits) from the server, then reset to
// the freshly-loaded rooms. The game boots instantly on the bundled scenes and
// swaps to live data a moment later (identical unless edited). No-op offline.
initScenes().then(() => {
  Object.assign(state, newGame());
  player.pos = { ...START_POS };
  for (const k of Object.keys(maskCache)) delete maskCache[k];
});
