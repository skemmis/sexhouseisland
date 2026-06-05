import { Character } from "./character";
import { drawSprite } from "./pixels/render";
import type { PixelSprite } from "./pixels/sprite";
import type { Room, Vec } from "./types";

/**
 * A Character rendered from generated pixel-sprite walk frames instead of the
 * procedural stick figure. It reuses ALL of the base Character's movement,
 * pathing, depth-scaling, and facing logic — only `draw()` changes. This is
 * the asset-swap seam the very first commit promised: real (model-generated)
 * art drops in here, everything else stays identical.
 */
export class SpriteCharacter extends Character {
  constructor(
    start: Vec,
    private frames: PixelSprite[],
    private cellBase = 2.0, // on-screen pixels per sprite cell at scale 1
    private fps = 8,
  ) {
    super(start);
  }

  override draw(ctx: CanvasRenderingContext2D, room: Room) {
    const s = this.scaleIn(room);
    const cell = this.cellBase * s;
    const sprite = this.moving
      ? this.frames[Math.floor(this.animTime * this.fps) % this.frames.length]
      : this.frames[0];

    const w = sprite.w * cell;
    const h = sprite.h * cell;
    const ox = this.pos.x - w / 2;
    const oy = this.pos.y - h; // feet planted at pos.y

    // grounding shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(this.pos.x, this.pos.y, w * 0.32, cell * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (this.facing < 0) {
      // mirror horizontally about the character's x so it faces left
      ctx.translate(this.pos.x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-this.pos.x, 0);
    }
    drawSprite(ctx, sprite, ox, oy, cell);
    ctx.restore();
  }
}
