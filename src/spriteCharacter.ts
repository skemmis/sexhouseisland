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

    // Facing left: mirror the sprite DATA (reverse each row) rather than using a
    // canvas transform. A negative-scale transform around a fractional x reopens
    // the same sub-pixel seams we just closed; flipping the data keeps the
    // boundary-rounded blit exact.
    const frame = this.facing < 0 ? mirror(sprite) : sprite;
    drawSprite(ctx, frame, ox, oy, cell);
  }
}

function mirror(s: PixelSprite): PixelSprite {
  return { w: s.w, h: s.h, palette: s.palette, rows: s.rows.map((r) => [...r].reverse().join("")) };
}
