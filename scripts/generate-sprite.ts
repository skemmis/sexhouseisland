import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";

import { LlmGridFiller, type Completion } from "../src/pixels/llm";
import { freeformTemplate, type Palette, type PixelSprite, type SpriteTemplate } from "../src/pixels/sprite";
import { TEMPLATES } from "../src/pixels/templates";
import { encodePng } from "./png";

// ============================================================================
//  LIVE SPRITE GENERATOR — the MineBench loop against the real Anthropic API.
//
//    npm run gen -- "a death doula in a black bathing suit" --template humanoid
//    npm run gen -- "a dead pelican with a hard drive in its beak" --freeform 24x16
//
//  It serializes the template into a prompt, asks Claude to emit the pixel
//  grid (spatial reasoning, no image model), validates the result against the
//  template, and writes a .png preview + a .ts sprite module. The validator is
//  the gate — an illegal grid is rejected and re-prompted, never shipped.
// ============================================================================

// A shared 16-color palette for freeform props, so generated objects look like
// they belong to the same game. Cast members use HERO_TEMPLATE's palette.
const GAME_PALETTE: Palette = {
  ".": "transparent",
  "1": "#14101a", // outline / darkest
  "2": "#3a2a1e", // dark brown
  "3": "#6b4f2a", // brown
  "4": "#a9824a", // tan
  "5": "#e3b07a", // skin / light tan
  "6": "#dfe6ee", // off-white
  "7": "#9aa3ad", // grey
  "8": "#3a6ea5", // blue
  "9": "#6fae6a", // green
  a: "#b0392e", // red
  b: "#caa54a", // gold
  c: "#c0556f", // pink
  d: "#2b2b3a", // near-black blue
  e: "#5a3a6a", // purple
  f: "#e8c86a", // bright gold / highlight
};

// ---- model-backed Completion: this is the seam from llm.ts -----------------
function anthropicCompletion(client: Anthropic): Completion {
  return async (prompt: string) => {
    // Stream + adaptive thinking per the Claude API guidance; the grid itself
    // is small, but thinking helps the spatial reasoning land.
    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    });
    const msg = await stream.finalMessage();
    return msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  };
}

// ---- arg parsing -----------------------------------------------------------
function parseArgs(argv: string[]) {
  const opts: { template?: string; freeform?: string; name?: string; out: string; n: number; desc: string } = {
    out: "generated",
    n: 1,
    desc: "",
  };
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--template") opts.template = argv[++i];
    else if (a === "--freeform") opts.freeform = argv[++i];
    else if (a === "--name") opts.name = argv[++i];
    else if (a === "--out") opts.out = argv[++i];
    else if (a === "--n") opts.n = Math.max(1, parseInt(argv[++i]) || 1);
    else rest.push(a);
  }
  opts.desc = rest.join(" ").trim();
  return opts;
}

/** Resolve the template + (optional) few-shot example for a run. */
function pickTemplate(opts: ReturnType<typeof parseArgs>): { template: SpriteTemplate; example?: PixelSprite } {
  if (opts.freeform) {
    const m = /^(\d+)x(\d+)$/.exec(opts.freeform);
    if (!m) throw new Error(`--freeform expects WxH, e.g. 24x16 (got "${opts.freeform}")`);
    return { template: freeformTemplate(parseInt(m[1]), parseInt(m[2]), GAME_PALETTE) };
  }
  const entry = TEMPLATES[opts.template ?? "humanoid"];
  if (!entry) throw new Error(`unknown template "${opts.template}". options: ${Object.keys(TEMPLATES).join(", ")}, or --freeform WxH`);
  return { template: entry.template, example: entry.example };
}

// ---- a draft "PixelBench score" --------------------------------------------
// A cheap heuristic for ranking best-of-N variants automatically. It rewards:
//  - color variety (not a flat fill),
//  - shading (a zone using >1 of its allowed colors), and
//  - bilateral symmetry (most sprites read better mirrored).
// This is exactly the slot a human-preference signal (the variant-picker UI)
// would replace or augment — the scorer is a stand-in for taste.
function pixelBenchScore(sprite: PixelSprite): number {
  const cells = sprite.rows.flatMap((r) => [...r]).filter((c) => c !== ".");
  if (cells.length === 0) return 0;
  const distinct = new Set(cells).size;

  // horizontal symmetry: fraction of cells equal to their mirror
  let mirrored = 0, total = 0;
  for (let y = 0; y < sprite.h; y++) {
    const row = sprite.rows[y] ?? "";
    for (let x = 0; x < Math.floor(sprite.w / 2); x++) {
      const a = row[x] ?? ".";
      const b = row[sprite.w - 1 - x] ?? ".";
      if (a === "." && b === ".") continue;
      total++;
      if (a === b) mirrored++;
    }
  }
  const symmetry = total ? mirrored / total : 0;
  return distinct * 1.0 + symmetry * 4.0;
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "sprite";
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.desc) {
    console.error('Usage: npm run gen -- "<description>" [--template humanoid | --freeform WxH] [--name id] [--out dir]');
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set. Export it and re-run:\n  export ANTHROPIC_API_KEY=sk-ant-...");
    process.exit(1);
  }

  const { template, example } = pickTemplate(opts);
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  const filler = new LlmGridFiller(anthropicCompletion(client), opts.desc, 3, example);

  const mode = opts.freeform ? `freeform ${template.w}x${template.h}` : `${opts.template ?? "humanoid"} template`;
  console.log(`Generating "${opts.desc}" (${mode}, n=${opts.n}${example ? ", few-shot" : ""}) with claude-opus-4-8 …`);

  const id = opts.name ? slug(opts.name) : slug(opts.desc);
  mkdirSync(opts.out, { recursive: true });

  // best-of-N: generate N independent variants, score each, keep them all on
  // disk (so a human can pick), and promote the top-scored one to <id>.png.
  const variants: { sprite: PixelSprite; score: number }[] = [];
  for (let i = 0; i < opts.n; i++) {
    try {
      const sprite = await filler.fill(template, { frame: 0, prompt: opts.desc });
      const score = pixelBenchScore(sprite);
      variants.push({ sprite, score });
      if (opts.n > 1) {
        writeFileSync(join(opts.out, `${id}-v${i}.png`), encodePng(sprite, 12));
        console.log(`  variant ${i}: score ${score.toFixed(2)}`);
      }
    } catch (err) {
      console.error(`  variant ${i} failed:`, err instanceof Error ? err.message : err);
    }
  }
  if (variants.length === 0) { console.error("All variants failed."); process.exit(1); }

  variants.sort((a, b) => b.score - a.score);
  const best = variants[0].sprite;

  const pngPath = join(opts.out, `${id}.png`);
  const tsPath = join(opts.out, `${id}.ts`);
  writeFileSync(pngPath, encodePng(best, 12));
  writeFileSync(
    tsPath,
    `// Generated by scripts/generate-sprite.ts — "${opts.desc}"\n` +
      `import type { PixelSprite } from "../src/pixels/sprite";\n\n` +
      `export const SPRITE: PixelSprite = ${JSON.stringify(best, null, 2)};\n`,
  );

  console.log("\n" + best.rows.join("\n"));
  console.log(`\n✓ best of ${variants.length} (score ${variants[0].score.toFixed(2)}) written:\n  ${pngPath}\n  ${tsPath}`);
}

main();
