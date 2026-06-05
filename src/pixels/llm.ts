import { validateFill, type PixelSprite, type SpriteTemplate } from "./sprite";
import type { FillContext, Filler } from "./fillers";
import { ART_DIRECTION } from "../art";

// ============================================================================
//  THE MINEBENCH-STYLE FILLER.
//
//  MineBench (minebench.ai) tests whether an LLM can emit raw 3D voxel
//  coordinates — (x, y, z, block) — for a prompt like "build a cabin", using
//  pure spatial reasoning with no image tools. Filling a sprite template is
//  the *2D* case of the identical task: emit (x, y, palette_index) for a
//  grid, conditioned on a silhouette + zones + a natural-language style.
//
//  That's why no diffusion model is needed: a capable text model already has
//  the spatial reasoning. We just have to (a) serialize the template into a
//  prompt, (b) parse the grid the model returns, and (c) validate it — exactly
//  MineBench's prompt -> coordinates -> render loop, with validation in place
//  of human Elo voting.
// ============================================================================

/** Plug any model here: an API SDK call, a local model, or a human in the loop. */
export type Completion = (prompt: string) => Promise<string> | string;

/** Turn a template + style into the text prompt a model fills. */
export function serializeTask(t: SpriteTemplate, style: string, example?: PixelSprite): string {
  const palLines = Object.entries(t.palette)
    .filter(([c]) => c !== ".")
    .map(([c, hex]) => `  '${c}' = ${hex}`)
    .join("\n");
  const zoneLines = Object.entries(t.allow)
    .map(([z, chars]) => `  zone '${z}': use only [${chars.join(" ")}]`)
    .join("\n");

  // Few-shot: a single worked example of a good fill on this same template is
  // the cheapest, highest-leverage quality boost — it shows the model what
  // "good shading within zones" looks like rather than just describing it.
  const exampleBlock = example
    ? [
        ``,
        `EXAMPLE of a good fill for THIS zone map (different character, same grid):`,
        ...example.rows,
        ``,
      ]
    : [];

  return [
    `You are a pixel-sprite filler. Fill a ${t.w}x${t.h} grid.`,
    ``,
    `ART DIRECTION: ${ART_DIRECTION}`,
    `STYLE: ${style}`,
    ``,
    `PALETTE (char = color):`,
    palLines,
    `  '.' = transparent (leave empty)`,
    ``,
    `ZONE RULES — each cell belongs to a zone; use only that zone's colors:`,
    zoneLines,
    ``,
    `ZONE MAP (${t.w} chars per line, ${t.h} lines; '.' = empty):`,
    ...t.regions,
    ...exampleBlock,
    `Return ONLY the filled grid: ${t.h} lines of exactly ${t.w} chars each.`,
    `Keep '.' exactly where the zone map has '.'. Light comes from top-left:`,
    `use lighter palette colors on top/left faces, darker on bottom/right, and`,
    `the outline color on silhouette edges. Output no prose, just the grid.`,
  ].join("\n");
}

/** Parse a model response back into a sprite (tolerant of code fences/prose). */
export function parseGrid(response: string, t: SpriteTemplate): PixelSprite {
  const legal = new Set<string>(["."]);
  for (const chars of Object.values(t.allow)) for (const c of chars) legal.add(c);
  const re = new RegExp(`^[${escapeForClass([...legal].join(""))}]{${t.w}}$`);

  const rows = response
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => re.test(l))
    .slice(0, t.h);

  return { w: t.w, h: t.h, rows, palette: t.palette };
}

function escapeForClass(s: string) {
  return s.replace(/[\\\]^-]/g, (m) => "\\" + m);
}

/**
 * The concrete filler: serialize -> complete -> parse -> validate, resampling
 * on an illegal result. Drop in any `Completion` (Anthropic SDK, a local
 * model, or a human). The validator guarantees a legal sprite ever leaves here.
 */
export class LlmGridFiller implements Filler {
  readonly name = "llm-grid";
  constructor(
    private complete: Completion,
    private style: string,
    private maxTries = 3,
    private example?: PixelSprite,
  ) {}

  async fill(template: SpriteTemplate, ctx: FillContext): Promise<PixelSprite> {
    const base = serializeTask(template, this.style, this.example);
    let prompt = base;
    if (ctx.prev) prompt += `\n\nPREVIOUS FRAME (stay consistent with it):\n${ctx.prev.rows.join("\n")}`;

    let lastErr = "";
    for (let attempt = 0; attempt < this.maxTries; attempt++) {
      const res = await this.complete(prompt);
      const sprite = parseGrid(res, template);
      const v = validateFill(template, sprite);
      if (v.ok) return sprite;
      lastErr = v.errors[0] ?? "unknown";
      prompt = `${base}\n\nYour previous attempt was rejected: ${lastErr}\nFix it and return the full grid again.`;
    }
    throw new Error(`LlmGridFiller failed after ${this.maxTries} tries: ${lastErr}`);
  }
}

/**
 * A "completion" that just replays a canned grid. Lets the pipeline run fully
 * offline (and lets a sprite a model already produced be treated as a
 * first-class filler output for tests/demos).
 */
export function replay(grid: string): Completion {
  return () => grid;
}
