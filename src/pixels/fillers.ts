import { flatFill, type PixelSprite, type SpriteTemplate } from "./sprite";

// ============================================================================
//  THE FILLER INTERFACE — the one seam every generation backend implements.
//
//  A filler receives the template (silhouette + zones + allowed palette) plus
//  context (which frame, the previous frame for temporal coherence) and
//  returns a concrete sprite. The engine validates the result before use, so
//  a misbehaving model can never ship an illegal sprite.
//
//  Everything in the slice is built so these are interchangeable:
//    - RulesFiller   : deterministic, no ML (works today, see below)
//    - LlmGridFiller : a text model emits the index grid via spatial reasoning,
//                      the MineBench-style path (see ./llm.ts)
//    - (DiffusionFiller) : conditioned pixel-art diffusion + snap/quantize
// ============================================================================

export interface FillContext {
  /** Index within an animation, for fillers that vary per frame. */
  frame: number;
  /** Previous frame, so a filler can stay temporally coherent. */
  prev?: PixelSprite;
  /** Free-form direction for generative fillers ("blonde, leather vest"). */
  prompt?: string;
}

export interface Filler {
  readonly name: string;
  fill(template: SpriteTemplate, ctx: FillContext): Promise<PixelSprite> | PixelSprite;
}

/**
 * The trivial backend: one fixed palette choice per zone. No model. This is
 * what makes the rest of the system testable today and doubles as an instant
 * recolor/variant generator.
 */
export class RulesFiller implements Filler {
  readonly name = "rules";
  constructor(private choice: Record<string, string>) {}
  fill(template: SpriteTemplate): PixelSprite {
    return flatFill(template, this.choice);
  }
}

// The MineBench-style backend — a text model emitting the grid via spatial
// reasoning — lives in ./llm.ts as `LlmGridFiller`, since it brings its own
// serialize/parse machinery. It implements this same `Filler` interface, so
// it's a drop-in replacement for `RulesFiller` anywhere a filler is used.
