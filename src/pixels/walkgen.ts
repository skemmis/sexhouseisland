import type { Palette, PixelSprite, SpriteTemplate } from "./sprite";

// ============================================================================
//  MODEL-GENERATED WALK CYCLE.
//
//  The no-drift guarantee, applied to *generated* art: generate ONE base frame
//  (the character's identity), then generate ONLY the legs for each stride pose
//  and composite them under the byte-identical upper body of the base. Because
//  rows 0..15 are copied verbatim from the base in every frame, the face,
//  torso, and arms cannot drift — the model only ever varies the legs.
//
//  Works for the standard 16x24 humanoid leg geometry (humanoid, swimsuit,
//  wetman — all share legs at cols 4-6 / 9-11, rows 16-23).
// ============================================================================

/** Where the upper body ends and the legs begin. */
export const LEG_START = 16;

// Leg silhouettes (rows 16..23) as a single zone 'S'. The model fills color.
const NEUTRAL = [
  "....SSS..SSS....",
  "....SSS..SSS....",
  "....SSS..SSS....",
  "....SSS..SSS....",
  "....SSS..SSS....",
  "....SSS..SSS....",
  "....SSS..SSS....",
  "...SSSS..SSSS...",
];
const LEFT_UP = [
  "....SSS..SSS....",
  "....SSS..SSS....",
  "....SSS..SSS....",
  "....SSS..SSS....",
  "....SSS..SSS....",
  ".........SSS....", // left foot lifted
  ".........SSS....",
  ".........SSSS...",
];
const RIGHT_UP = [
  "....SSS..SSS....",
  "....SSS..SSS....",
  "....SSS..SSS....",
  "....SSS..SSS....",
  "....SSS..SSS....",
  "....SSS.........", // right foot lifted
  "....SSS.........",
  "...SSSS.........",
];

export const LEG_POSES = { NEUTRAL, LEFT_UP, RIGHT_UP } as const;
export type LegPose = keyof typeof LEG_POSES;

/**
 * A template that fills ONLY the legs for a pose (rows 0..15 are empty). The
 * filler is given the base frame as `prev`, so the leg skin matches the body.
 */
export function legTemplate(pose: LegPose, palette: Palette, skin: string[]): SpriteTemplate {
  const empty = ".".repeat(16);
  const regions = [
    ...Array.from({ length: LEG_START }, () => empty),
    ...LEG_POSES[pose],
  ];
  return { w: 16, h: 24, regions, palette, allow: { S: skin } };
}

/** Stitch a base frame's upper body onto generated legs. */
export function composite(base: PixelSprite, legs: PixelSprite): PixelSprite {
  return {
    w: base.w,
    h: base.h,
    palette: base.palette,
    rows: [...base.rows.slice(0, LEG_START), ...legs.rows.slice(LEG_START)],
  };
}

/** Assemble the looping cycle from a base (neutral) + the two lifted poses. */
export function walkCycle(base: PixelSprite, leftUp: PixelSprite, rightUp: PixelSprite): PixelSprite[] {
  return [base, composite(base, leftUp), base, composite(base, rightUp)];
}
