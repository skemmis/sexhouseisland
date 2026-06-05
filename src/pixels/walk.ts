import { HERO_IDLE } from "./hero";
import { deriveTemplate, flatFill, type PixelSprite, type SpriteTemplate } from "./sprite";
import { VARIANT_DEFAULT } from "./hero";

// ============================================================================
//  A WALK CYCLE FROM ONE TEMPLATE.
//
//  The whole point of the template approach is identity stability across
//  frames. We enforce it the simplest possible way: every frame shares a
//  BYTE-IDENTICAL upper body (rows 0-14 — head, face, torso, arms). Only the
//  legs (rows 15-23) change to make the stride. Because the invariant region
//  is the same data in every frame, the character's face/proportions/colors
//  *cannot* drift. That's the property image generators can't promise.
//
//  A real filler (LLM / discrete-grid model / diffusion) would generate the
//  per-frame leg cells conditioned on the shared template + the previous
//  frame; here a deterministic rules filler stands in so the harness runs.
// ============================================================================

const COLOR_TO_ZONE: Record<string, string> = {
  "1": "O", "2": "S", "3": "S", "4": "H", "5": "H", "6": "C",
  "7": "V", "8": "V", "9": "B", a: "L", b: "E", c: "K",
};

/** rows 0-14: the shared, frozen upper body — the identity invariant. */
const UPPER = HERO_IDLE.rows.slice(0, 15);

/** rows 15-23 per pose. Front-facing "march": each frame lifts one foot. */
const LEGS_NEUTRAL = HERO_IDLE.rows.slice(15);

const LEGS_LEFT_UP = [
  "....aaaaaaaa....",
  "....aaa..aaa....",
  "....aaa..aaa....",
  "....aaa..aaa....",
  "....aaa..aaa....",
  "....ccc..aaa....", // left foot raised
  ".........aaa....",
  ".........ccc....",
  "........cccc....",
];

const LEGS_RIGHT_UP = [
  "....aaaaaaaa....",
  "....aaa..aaa....",
  "....aaa..aaa....",
  "....aaa..aaa....",
  "....aaa..aaa....",
  "....aaa..ccc....", // right foot raised
  "....aaa.........",
  "....ccc.........",
  "...cccc.........",
];

function compose(legs: string[]): PixelSprite {
  return { w: 16, h: 24, palette: HERO_IDLE.palette, rows: [...UPPER, ...legs] };
}

/** The authored reference frames (already shaded). */
export const WALK_FRAMES: PixelSprite[] = [
  compose(LEGS_NEUTRAL),
  compose(LEGS_LEFT_UP),
  compose(LEGS_NEUTRAL),
  compose(LEGS_RIGHT_UP),
];

/**
 * The per-frame TEMPLATES a filler is conditioned on (silhouette + zones).
 * Derived from the reference frames so the conditioning matches the geometry.
 */
export const WALK_TEMPLATES: SpriteTemplate[] = WALK_FRAMES.map((f) =>
  deriveTemplate(f, COLOR_TO_ZONE),
);

/**
 * Proof of the consistency claim: fill EVERY frame's template with the SAME
 * palette choice. The result is a legal, drift-free cycle generated purely
 * from (shared choice) x (per-frame pose template) — no per-pixel authoring.
 * Swap `flatFill` for a model filler and this is your generation pipeline.
 */
export const WALK_FROM_TEMPLATE: PixelSprite[] = WALK_TEMPLATES.map((t) =>
  flatFill(t, VARIANT_DEFAULT),
);
