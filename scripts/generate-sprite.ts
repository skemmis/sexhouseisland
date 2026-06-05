import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";

import { LlmGridFiller, type Completion } from "../src/pixels/llm";
import { freeformTemplate, type Palette, type SpriteTemplate } from "../src/pixels/sprite";
import { HERO_TEMPLATE } from "../src/pixels/hero";
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
  const opts: { template?: string; freeform?: string; name?: string; out: string; desc: string } = {
    out: "generated",
    desc: "",
  };
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--template") opts.template = argv[++i];
    else if (a === "--freeform") opts.freeform = argv[++i];
    else if (a === "--name") opts.name = argv[++i];
    else if (a === "--out") opts.out = argv[++i];
    else rest.push(a);
  }
  opts.desc = rest.join(" ").trim();
  return opts;
}

function pickTemplate(opts: ReturnType<typeof parseArgs>): SpriteTemplate {
  if (opts.template === "humanoid") return HERO_TEMPLATE;
  if (opts.freeform) {
    const m = /^(\d+)x(\d+)$/.exec(opts.freeform);
    if (!m) throw new Error(`--freeform expects WxH, e.g. 24x16 (got "${opts.freeform}")`);
    return freeformTemplate(parseInt(m[1]), parseInt(m[2]), GAME_PALETTE);
  }
  // default: a humanoid cast member
  return HERO_TEMPLATE;
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

  const template = pickTemplate(opts);
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  const filler = new LlmGridFiller(anthropicCompletion(client), opts.desc, 3);

  const mode = opts.template === "humanoid" || !opts.freeform ? "humanoid template" : `freeform ${template.w}x${template.h}`;
  console.log(`Generating "${opts.desc}" (${mode}) with claude-opus-4-8 …`);

  let sprite;
  try {
    sprite = await filler.fill(template, { frame: 0, prompt: opts.desc });
  } catch (err) {
    console.error("Generation failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const id = opts.name ? slug(opts.name) : slug(opts.desc);
  mkdirSync(opts.out, { recursive: true });
  const pngPath = join(opts.out, `${id}.png`);
  const tsPath = join(opts.out, `${id}.ts`);
  writeFileSync(pngPath, encodePng(sprite, 12));
  writeFileSync(
    tsPath,
    `// Generated by scripts/generate-sprite.ts — "${opts.desc}"\n` +
      `import type { PixelSprite } from "../src/pixels/sprite";\n\n` +
      `export const SPRITE: PixelSprite = ${JSON.stringify(sprite, null, 2)};\n`,
  );

  console.log("\n" + sprite.rows.join("\n"));
  console.log(`\n✓ valid sprite written:\n  ${pngPath}\n  ${tsPath}`);
}

main();
