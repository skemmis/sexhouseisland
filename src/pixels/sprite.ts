// ============================================================================
//  TRUE-PIXEL SPRITE + TEMPLATE FORMAT
//
//  The core idea: separate a sprite into the part that defines IDENTITY (the
//  template: silhouette + semantic zones + a fixed palette) from the part a
//  model GENERATES (the fill: one palette index per opaque cell).
//
//  Why: an image generator hands you a full-res picture with "pretend" pixels
//  and a character whose face/proportions/colors drift every frame. A template
//  makes the grid, silhouette, and palette FIXED, so a "filler" (an LLM, a
//  constrained diffusion model, a discrete grid model, or even plain rules)
//  only has to choose colors WITHIN allowed zones. The result is:
//    - genuinely low-res (one array value == one on-screen pixel),
//    - palette-locked (no 47 shades of blue),
//    - identity-stable across frames (silhouette + zones are shared),
//    - and VERIFIABLE (an illegal fill is rejected, not shipped).
//
//  A sprite/template is authored as an array of equal-length strings, one
//  char per cell. This doubles as an interchange format a model can emit.
// ============================================================================

/** char -> CSS color. The char '.' is reserved for transparent. */
export type Palette = Record<string, string>;

/** A concrete, drawable sprite: a grid of palette chars. */
export interface PixelSprite {
  w: number;
  h: number;
  rows: string[]; // length h, each string length w
  palette: Palette;
}

/**
 * The IDENTITY scaffold a filler is conditioned on.
 *  - `regions`: same grid shape; each char is a zone id ('.' = must be empty).
 *  - `allow`:   zone id -> the palette chars that zone may use.
 * A fill is legal iff every cell's char is in `allow[zoneAt(cell)]`
 * (and empty exactly where the zone is '.').
 */
export interface SpriteTemplate {
  w: number;
  h: number;
  regions: string[];
  palette: Palette;
  allow: Record<string, string[]>;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/** Verify a fill respects its template — the gate that makes generation safe. */
export function validateFill(t: SpriteTemplate, s: PixelSprite): ValidationResult {
  const errors: string[] = [];
  if (s.w !== t.w || s.h !== t.h)
    errors.push(`size mismatch: sprite ${s.w}x${s.h} vs template ${t.w}x${t.h}`);
  const h = Math.min(s.h, t.h);
  for (let y = 0; y < h; y++) {
    const srow = s.rows[y] ?? "";
    const trow = t.regions[y] ?? "";
    if (srow.length !== t.w) errors.push(`row ${y}: width ${srow.length} != ${t.w}`);
    for (let x = 0; x < t.w; x++) {
      const zone = trow[x] ?? ".";
      const cell = srow[x] ?? ".";
      if (zone === ".") {
        if (cell !== ".") errors.push(`(${x},${y}) must be empty (zone '.') but is '${cell}'`);
        continue;
      }
      const allowed = t.allow[zone];
      if (!allowed) { errors.push(`(${x},${y}) unknown zone '${zone}'`); continue; }
      if (cell === ".") errors.push(`(${x},${y}) zone '${zone}' must be filled but is empty`);
      else if (!allowed.includes(cell))
        errors.push(`(${x},${y}) zone '${zone}' got '${cell}', allowed: ${allowed.join("")}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * The simplest possible "filler": one flat color per zone. No model, no
 * shading — just proves the constraint system produces a legal sprite, and
 * gives an instant palette-swap variant mechanism (recoloring = a new choice).
 */
export function flatFill(
  t: SpriteTemplate,
  choice: Record<string, string>,
): PixelSprite {
  const rows = t.regions.map((row) =>
    [...row]
      .map((zone) => {
        if (zone === ".") return ".";
        const pick = choice[zone] ?? t.allow[zone]?.[0] ?? ".";
        return pick;
      })
      .join(""),
  );
  return { w: t.w, h: t.h, rows, palette: t.palette };
}

/**
 * Bootstrap a template FROM an authored sprite: map each color char to a zone,
 * and derive each zone's allowed palette as the set of colors seen in it.
 * In practice you'd hand-author the region map, but deriving it lets a single
 * good frame define the scaffold for every other frame of that character.
 */
export function deriveTemplate(
  s: PixelSprite,
  colorToZone: Record<string, string>,
): SpriteTemplate {
  const allow: Record<string, Set<string>> = {};
  const regions = s.rows.map((row) =>
    [...row]
      .map((c) => {
        if (c === ".") return ".";
        const zone = colorToZone[c];
        if (!zone) throw new Error(`color '${c}' has no zone mapping`);
        (allow[zone] ??= new Set()).add(c);
        return zone;
      })
      .join(""),
  );
  const allowOut: Record<string, string[]> = {};
  for (const z of Object.keys(allow)) allowOut[z] = [...allow[z]].sort();
  return { w: s.w, h: s.h, regions, palette: s.palette, allow: allowOut };
}
