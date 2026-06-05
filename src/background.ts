// Loads a painted backdrop image (a base64 data URL, baked at build time by
// scripts/generate-bg.ts) and exposes a ready-check + the element to draw. The
// background is a single static image the sprites move within — the Monkey
// Island model — distinct from the procedural fallback set.

export interface Backdrop {
  ready(): boolean;
  img: HTMLImageElement | null;
}

export function makeBackdrop(dataUrl: string): Backdrop {
  if (!dataUrl) return { ready: () => false, img: null };
  const img = new Image();
  img.src = dataUrl;
  return { ready: () => img.complete && img.naturalWidth > 0, img };
}

/** Draw the backdrop crisply (no smoothing) to fill a rect. */
export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  bg: Backdrop,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  if (!bg.ready() || !bg.img) return false;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bg.img, x, y, w, h);
  return true;
}
