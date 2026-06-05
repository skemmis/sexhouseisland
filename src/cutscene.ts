// ============================================================================
//  CUTSCENE — a tiny scripted timeline. A cutscene is a list of beats; each
//  beat owns a slice of time, fires `on()` once at its start, and calls
//  `tween(k)` every frame with k in [0,1] across the beat. Reusable for every
//  scripted set-piece (Mike's dive, the pelican stealing the drive, the boat).
// ============================================================================

export interface Beat {
  /** Duration in seconds (0 = a one-frame beat, good for instantaneous `on`). */
  d: number;
  /** Fired once when the beat begins. */
  on?: () => void;
  /** Called each frame with progress k in [0,1]. */
  tween?: (k: number) => void;
}

export class Cutscene {
  private i = 0;
  private clock = 0;
  private started = false;
  done = false;

  constructor(private beats: Beat[]) {
    if (beats.length === 0) this.done = true;
  }

  update(dt: number): void {
    if (this.done) return;
    let beat = this.beats[this.i];
    if (!this.started) { beat.on?.(); this.started = true; this.clock = 0; }
    this.clock += dt;
    const k = beat.d > 0 ? Math.min(1, this.clock / beat.d) : 1;
    beat.tween?.(k);
    while (!this.done && this.clock >= beat.d) {
      const carry = this.clock - beat.d; // roll leftover time into the next beat
      this.i++;
      if (this.i >= this.beats.length) { this.done = true; break; }
      beat = this.beats[this.i];
      beat.on?.();
      this.clock = carry;
      const k2 = beat.d > 0 ? Math.min(1, this.clock / beat.d) : 1;
      beat.tween?.(k2);
    }
  }
}

/** Ease in-out, for less robotic motion. */
export const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

/** A point on a parabolic arc from a->b that peaks `height` px above the chord. */
export function arc(
  a: { x: number; y: number },
  b: { x: number; y: number },
  height: number,
  k: number,
): { x: number; y: number } {
  return {
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k - Math.sin(Math.PI * k) * height,
  };
}
