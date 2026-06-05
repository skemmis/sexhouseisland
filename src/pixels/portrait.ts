import type { Palette, PixelSprite, SpriteTemplate } from "./sprite";

// ============================================================================
//  CHARACTER PORTRAITS — the SCUMM dialogue close-up, via the SAME PixelBench
//  path as the sprites (an LLM emits the grid; no image model).
//
//  A 24x24 head-and-shoulders bust template. Expressions are done the
//  walk-cycle way: regenerate ONLY the feature cells (eyes / nose / mouth) for
//  each expression and keep every other cell from the base. Hair, face shape,
//  skin tone, and clothing are therefore byte-identical across neutral /
//  talking / horror — the character can't morph between expressions, only emote.
//
//  Seed the palette from the character's body sprite to keep face and body the
//  same person.
// ============================================================================

export const FACE_PALETTE: Palette = {
  ".": "transparent",
  "1": "#14101a", // outline / dark
  "2": "#e3b07a", "3": "#c8915a", "4": "#f0c89a", // skin / shadow / light
  "5": "#3a2a18", "6": "#7a5230", "7": "#caa54a", "8": "#2b2b3a", // hair: dk/brn/blonde/blk
  b: "#1a1a1a", w: "#eef2f4", // eye dark / white
  a: "#9b3b4a", // mouth / lips
  "9": "#3a6ea5", c: "#c0556f", d: "#dfe6ee", // clothing: blue / pink / white
};

export const FACE_TEMPLATE: SpriteTemplate = {
  w: 24,
  h: 24,
  palette: FACE_PALETTE,
  regions: [
    "........................",
    "........HHHHHHHH........",
    ".......HHHHHHHHHH.......",
    "......HHHHHHHHHHHH......",
    "......HHSSSSSSSSHH......",
    "......HSSSSSSSSSSH......",
    "......HSSSSSSSSSSH......",
    "......HSSSSSSSSSSH......",
    "......HSSSSSSSSSSH......",
    "......HSEESSSSEESH......", // eyes
    "......HSEESSSSEESH......",
    "......HSSSSNNSSSSH......", // nose
    "......HSSSSNNSSSSH......",
    "......HSSSMMMMSSSH......", // mouth
    "......HSSSSSSSSSSH......",
    "......HSSSSSSSSSSH......",
    ".......SSSSSSSSSS.......", // jaw
    "........SSSSSSSS........", // neck
    "........SSSSSSSS........",
    "....KKKKKKKKKKKKKKKK....", // shoulders / clothing
    "...KKKKKKKKKKKKKKKKKK...",
    "..KKKKKKKKKKKKKKKKKKKK..",
    "..KKKKKKKKKKKKKKKKKKKK..",
    "..KKKKKKKKKKKKKKKKKKKK..",
  ],
  allow: {
    H: ["5", "6", "7", "8", "1"],
    S: ["2", "3", "4", "1"],
    E: ["b", "w", "2"],
    N: ["3", "2", "1"],
    M: ["a", "1", "2", "b"],
    K: ["9", "c", "d", "1"],
  },
};

/** The cells an expression is allowed to change. */
const FEATURE = new Set(["E", "N", "M"]);

/**
 * A sparse template that exposes ONLY the feature cells (eyes/nose/mouth) — the
 * model fills those and leaves everything else transparent. Composited back
 * onto a base portrait, it swaps the expression with zero identity drift.
 */
export function expressionTemplate(): SpriteTemplate {
  const regions = FACE_TEMPLATE.regions.map((row) =>
    [...row].map((c) => (FEATURE.has(c) ? c : ".")).join(""),
  );
  return {
    w: 24,
    h: 24,
    palette: FACE_PALETTE,
    regions,
    allow: { E: FACE_TEMPLATE.allow.E, N: FACE_TEMPLATE.allow.N, M: FACE_TEMPLATE.allow.M },
  };
}

/** Merge generated feature cells onto a base portrait; everything else stays. */
export function compositeExpression(base: PixelSprite, gen: PixelSprite): PixelSprite {
  const rows = base.rows.map((row, y) =>
    [...row]
      .map((c, x) => {
        const zone = FACE_TEMPLATE.regions[y]?.[x] ?? ".";
        return FEATURE.has(zone) ? gen.rows[y]?.[x] ?? c : c;
      })
      .join(""),
  );
  return { w: base.w, h: base.h, palette: base.palette, rows };
}
