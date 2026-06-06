import type { Vec, Room } from "./types";

/**
 * The player character.
 *
 * IMPORTANT (re: "the animation assets are the scary part"):
 * This character has NO art assets. The walk cycle, idle bob, and talk
 * flap are all drawn procedurally in `draw()` below. That exists to prove
 * the *engine* — depth scaling, facing, frame timing, foot-planted movement —
 * runs end-to-end with zero pixels authored.
 *
 * To swap in real art, you replace `draw()` with a sprite-sheet blit:
 *   const frame = WALK_FRAMES[Math.floor(this.animTime * FPS) % 8];
 *   ctx.drawImage(sheet, frame.sx, frame.sy, fw, fh, ...);
 * Everything else (pathing, scale, facing) stays exactly as-is.
 * That's the whole point of separating engine from assets.
 */
export class Character {
  pos: Vec;
  private target: Vec | null = null;
  private path: Vec[] = [];
  private speed = 60; // px/sec at scale 1
  facing = 0; // -1 left, 1 right, 0 toward camera
  animTime = 0;
  talking = false;
  /** Called once when the character reaches its target. */
  private onArrive: (() => void) | null = null;

  constructor(start: Vec) {
    this.pos = { ...start };
  }

  get moving() {
    return this.target !== null;
  }

  /** Walk straight to a point; `cb` fires on arrival. */
  walkTo(p: Vec, face: number, cb?: () => void) {
    this.path = [];
    this.target = { ...p };
    this.pendingFace = face;
    this.onArrive = cb ?? null;
  }

  /** Follow a sequence of waypoints (from pathfinding); `cb` fires at the end. */
  walkPath(points: Vec[], face: number, cb?: () => void) {
    if (points.length === 0) { this.walkTo(this.pos, face, cb); return; }
    this.path = points.slice();
    this.target = { ...this.path.shift()! };
    this.pendingFace = face;
    this.onArrive = cb ?? null;
  }
  private pendingFace = 0;

  /** Depth scale at the character's current feet position. */
  scaleIn(room: Room): number {
    const { minY, maxY, minScale, maxScale } = room.floor;
    const t = clamp((this.pos.y - minY) / (maxY - minY), 0, 1);
    return minScale + (maxScale - minScale) * t;
  }

  update(dt: number, room: Room) {
    this.animTime += dt;

    if (this.target) {
      const dx = this.target.x - this.pos.x;
      const dy = this.target.y - this.pos.y;
      const dist = Math.hypot(dx, dy);
      this.facing = Math.abs(dx) > 4 ? Math.sign(dx) : 0;

      const step = this.speed * this.scaleIn(room) * dt;
      if (dist <= step) {
        this.pos = { ...this.target };
        if (this.path.length > 0) {
          this.target = { ...this.path.shift()! }; // on to the next waypoint
        } else {
          this.target = null;
          this.facing = this.pendingFace;
          const cb = this.onArrive;
          this.onArrive = null;
          cb?.();
        }
      } else {
        this.pos.x += (dx / dist) * step;
        this.pos.y += (dy / dist) * step;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, room: Room) {
    const s = this.scaleIn(room);
    const x = this.pos.x;
    const y = this.pos.y; // feet
    const walkPhase = this.moving ? Math.sin(this.animTime * 10) : 0;
    const idleBob = this.moving ? 0 : Math.sin(this.animTime * 2) * 0.5;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);

    // --- shadow ---
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    const bodyTop = -42 + idleBob;

    // --- legs (alternate with walk phase) ---
    ctx.strokeStyle = "#2b2b3a";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    const legSwing = walkPhase * 5;
    ctx.beginPath();
    ctx.moveTo(-3, -16); ctx.lineTo(-3 + legSwing, -1);
    ctx.moveTo(3, -16);  ctx.lineTo(3 - legSwing, -1);
    ctx.stroke();

    // --- torso (vest) ---
    ctx.fillStyle = "#3a6ea5";
    roundRect(ctx, -7, bodyTop + 18, 14, 22, 3);
    ctx.fill();
    // white shirt collar
    ctx.fillStyle = "#dfe6ee";
    ctx.beginPath();
    ctx.moveTo(0, bodyTop + 18);
    ctx.lineTo(-4, bodyTop + 26);
    ctx.lineTo(4, bodyTop + 26);
    ctx.closePath();
    ctx.fill();

    // --- arms ---
    ctx.strokeStyle = "#3a6ea5";
    ctx.lineWidth = 3.5;
    const armSwing = walkPhase * 4;
    ctx.beginPath();
    ctx.moveTo(-6, bodyTop + 21); ctx.lineTo(-8 - armSwing, bodyTop + 34);
    ctx.moveTo(6, bodyTop + 21);  ctx.lineTo(8 + armSwing, bodyTop + 34);
    ctx.stroke();

    // --- head ---
    ctx.fillStyle = "#e3b07a"; // skin
    ctx.beginPath();
    ctx.arc(0, bodyTop + 8, 8, 0, Math.PI * 2);
    ctx.fill();
    // hair
    ctx.fillStyle = "#5a3a22";
    ctx.beginPath();
    ctx.arc(0, bodyTop + 5, 8, Math.PI, Math.PI * 2);
    ctx.fill();

    // eyes — shift with facing so it "looks" where it's going
    ctx.fillStyle = "#1a1a1a";
    const eo = this.facing * 2;
    if (this.facing === 0) {
      ctx.fillRect(-3 + eo, bodyTop + 7, 1.5, 2);
      ctx.fillRect(2 + eo, bodyTop + 7, 1.5, 2);
    } else {
      ctx.fillRect(1 + eo, bodyTop + 7, 1.5, 2);
    }

    // mouth — flaps open/closed while talking (the cheapest possible lip-sync)
    ctx.fillStyle = "#7a3b2e";
    const mouthOpen = this.talking ? (Math.sin(this.animTime * 18) > 0 ? 2.5 : 0.5) : 0.8;
    ctx.fillRect(-2 + eo, bodyTop + 11, 4, mouthOpen);

    ctx.restore();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
