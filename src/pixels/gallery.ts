import type { PixelSprite, Palette } from "./sprite";

// ============================================================================
//  LLM-GENERATED GALLERY.
//
//  These sprites were produced by a frontier LLM (the assistant, acting as the
//  filler) reasoning about geometry, scale, and proportion — the MineBench
//  task applied to a 2D grid. No image model, no diffusion, no post-process:
//  each is raw (x, y, palette_index) data emitted directly, then validated.
//
//  They're committed as canned grids so the demo runs offline, but each could
//  equally be the output of `LlmGridFiller.fill()` via `replay()` (see llm.ts).
// ============================================================================

// ---- A pirate NPC (16x24) — same humanoid silhouette family as the hero,
//      different character: red bandana, eyepatch, beard, striped shirt, sash.
const PIRATE_PALETTE: Palette = {
  ".": "transparent",
  "1": "#14101a", // outline
  "2": "#e3b07a", // skin
  "3": "#c8915a", // skin shadow
  r: "#b0392e", // bandana
  R: "#d24a3a", // bandana highlight
  k: "#3a2a18", // beard
  s: "#dfe6ee", // shirt (white stripe)
  S: "#b03a2e", // shirt (red stripe)
  b: "#1a1a1a", // eye
  v: "#5a4a30", // sash
  g: "#caa54a", // gold buckle
  a: "#2b2b3a", // trousers
  c: "#3a2a18", // boots
};
export const PIRATE: PixelSprite = {
  w: 16,
  h: 24,
  palette: PIRATE_PALETTE,
  rows: [
    "................",
    "................",
    ".....rrrrrr.....", // bandana
    ".....rRRRRr.....",
    ".....r2222r.....", // bandana edge + forehead
    ".....2122b2.....", // eyepatch (left) + eye (right)
    ".....232232.....",
    ".....kkkkkk.....", // beard
    "....kkkkkkkk....",
    "...ssssssssss...", // collar
    "..SSSSSSSSSSSS..", // striped shirt
    "..ssssssssssss..",
    "..SSSSSSSSSSSS..",
    "..2SSSSSSSSSS2..", // hands at ends
    "...vvvvggvvvv...", // sash + gold buckle
    "....aaaaaaaa....",
    "....aaa..aaa....",
    "....aaa..aaa....",
    "....aaa..aaa....",
    "....aaa..aaa....",
    "....aaa..aaa....",
    "....aaa..aaa....",
    "....ccc..ccc....",
    "...cccc..cccc...",
  ],
};

// ---- A treasure chest (16x16) ----
const CHEST_PALETTE: Palette = {
  ".": "transparent",
  "1": "#14101a", // outline
  w: "#7a5a2e", // wood
  W: "#9c7838", // wood light
  d: "#4a3520", // wood shadow
  g: "#caa54a", // gold
  G: "#f0d878", // gold highlight
};
export const CHEST: PixelSprite = {
  w: 16,
  h: 16,
  palette: CHEST_PALETTE,
  rows: [
    "................",
    "................",
    "...gGGGGGGGGg...", // lid top band
    "..1WWWWWWWWWW1..",
    "..1wwwwggwwww1..", // latch top
    "..1wwwwGGwwww1..",
    "..gggggggggggg..", // band between lid and body
    "..1wwwwGGwwww1..",
    "..1wwww11wwww1..", // keyhole
    "..1wwwwwwwwww1..",
    "..1wwwwwwwwww1..",
    "..1wddddddddw1..", // shadow band
    "..1wwwwwwwwww1..",
    "..1wwwwwwwwww1..",
    "..111111111111..",
    "................",
  ],
};

// ---- A grog bottle (10x14) ----
const BOTTLE_PALETTE: Palette = {
  ".": "transparent",
  "1": "#14101a", // outline
  c: "#8a6a3a", // cork
  g: "#3a7a4a", // glass
  G: "#5fae6a", // glass highlight
};
export const BOTTLE: PixelSprite = {
  w: 10,
  h: 14,
  palette: BOTTLE_PALETTE,
  rows: [
    "....cc....",
    "....cc....",
    "...1gg1...",
    "...1gg1...",
    "..1gggg1..",
    ".1gggggg1.",
    ".1gGgggg1.",
    ".1gGgggg1.",
    ".1gggggg1.",
    ".1gggggg1.",
    ".1gggggg1.",
    ".1gggggg1.",
    ".11111111.",
    "..........",
  ],
};

export const GALLERY: { name: string; sprite: PixelSprite }[] = [
  { name: "pirate NPC", sprite: PIRATE },
  { name: "treasure chest", sprite: CHEST },
  { name: "grog bottle", sprite: BOTTLE },
];
