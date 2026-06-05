import { deriveTemplate, type PixelSprite, type Palette } from "./sprite";

// ----------------------------------------------------------------------------
//  A hand-authored 16x24 reference frame. This stands in for "one good frame a
//  model produced." From it we derive the template that constrains every other
//  frame/variant of this character.
//
//  Each char is a palette index. '.' = transparent. This exact string format
//  is what a filler model would emit, so a hand fill and a model fill are
//  interchangeable.
// ----------------------------------------------------------------------------
export const HERO_PALETTE: Palette = {
  ".": "transparent",
  "1": "#14101a", // outline / darkest
  "2": "#e3b07a", // skin
  "3": "#c8915a", // skin shadow
  "4": "#5a3a22", // hair
  "5": "#7a5230", // hair highlight
  "6": "#dfe6ee", // shirt
  "7": "#3a6ea5", // vest
  "8": "#2b507a", // vest shadow
  "9": "#6b4f2a", // belt
  a: "#2b2b3a", // trousers
  b: "#1a1a1a", // eye
  c: "#3a2a18", // boots
};

export const HERO_IDLE: PixelSprite = {
  w: 16,
  h: 24,
  palette: HERO_PALETTE,
  rows: [
    "................", // 0
    "................", // 1
    ".....444444.....", // 2  hair
    ".....455554.....", // 3  hair highlight
    ".....422224.....", // 4  forehead
    ".....4b22b4.....", // 5  eyes
    ".....222322.....", // 6  nose shadow
    ".....222222.....", // 7
    "......2222......", // 8  neck
    "...7766666677...", // 9  shoulders + collar
    "..777766667777..", // 10 torso + arms
    "..778766667877..", // 11 vest shading
    "..778777777877..", // 12
    "..278777777872..", // 13 hands (skin) at ends
    "...9999119999...", // 14 belt + buckle
    "....aaaaaaaa....", // 15 hips
    "....aaa..aaa....", // 16 legs split
    "....aaa..aaa....", // 17
    "....aaa..aaa....", // 18
    "....aaa..aaa....", // 19
    "....aaa..aaa....", // 20
    "....aaa..aaa....", // 21
    "....ccc..ccc....", // 22 boots
    "...cccc..cccc...", // 23 boot soles
  ],
};

/**
 * Map each authored color to a semantic zone. This is the one bit of human
 * intent: "these browns are hair, those are skin." From here the template
 * (silhouette + zones + per-zone allowed palette) is derived automatically.
 */
const COLOR_TO_ZONE: Record<string, string> = {
  "1": "O", // outline
  "2": "S", "3": "S", // skin
  "4": "H", "5": "H", // hair
  "6": "C", // shirt
  "7": "V", "8": "V", // vest
  "9": "B", // belt
  a: "L", // legs
  b: "E", // eye
  c: "K", // boots
};

export const HERO_TEMPLATE = deriveTemplate(HERO_IDLE, COLOR_TO_ZONE);

// A couple of legal "choices" a trivial filler can apply to the template to
// produce instant, identity-stable variants (palette swaps). Real models add
// shading; this just proves the constraint plumbing end to end.
export const VARIANT_DEFAULT: Record<string, string> = {
  O: "1", S: "2", E: "b", H: "4", C: "6", V: "7", B: "9", L: "a", K: "c",
};
export const VARIANT_NIGHT_PIRATE: Record<string, string> = {
  O: "1", S: "3", E: "b", H: "5", C: "6", V: "8", B: "9", L: "a", K: "c",
};
