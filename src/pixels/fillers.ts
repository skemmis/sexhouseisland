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
//    - RulesFiller        : deterministic, no ML (works today)
//    - LlmFiller          : ask a text model to emit the index grid
//    - DiscreteGridFiller : a model whose native output is grid cells/tokens
//                           (the "minebench"/Minecraft-block-style path)
//    - DiffusionFiller    : conditioned pixel-art diffusion + snap/quantize
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

/**
 * PLACEHOLDER for the discrete-grid / "minebench"-style backend.
 *
 * This is deliberately unimplemented because it depends on what that model
 * actually is. The contract it must satisfy is fully defined by `Filler`:
 * given a template whose `regions` grid marks each cell's zone and whose
 * `allow` map lists the legal palette chars per zone, emit a `PixelSprite`
 * whose every cell is a legal char for its zone. A discrete grid model is a
 * natural fit because its output is already cells-on-a-grid rather than
 * continuous pixels — it would be conditioned on (regions, allow, prev) and
 * decode one palette index per opaque cell.
 *
 * To make this real, wire `fill()` to the model's inference call and run the
 * output through `validateFill` (resampling on failure).
 */
export class DiscreteGridFiller implements Filler {
  readonly name = "discrete-grid";
  fill(_template: SpriteTemplate, _ctx: FillContext): PixelSprite {
    throw new Error(
      "DiscreteGridFiller not wired yet — needs the target model's inference interface.",
    );
  }
}
