import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";

import { LlmGridFiller, type Completion } from "../src/pixels/llm";
import type { PixelSprite } from "../src/pixels/sprite";
import { TEMPLATES } from "../src/pixels/templates";
import { legTemplate, walkCycle } from "../src/pixels/walkgen";
import { encodePng } from "./png";
import { encodeGif } from "./gif";

// ============================================================================
//  Generate a walk cycle for a cast member:
//    npm run gen:walk -- "the looksmaxxer in red trunks" --template swimsuit --name looksmaxxer
//  Generates a base frame, then the legs for each stride pose (conditioned on
//  the base so they match), composites, and writes a GIF + sprite sheet + the
//  frame data (JSON) to bake into the game.
// ============================================================================

function anthropicCompletion(client: Anthropic): Completion {
  return async (prompt: string) => {
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

function arg(flag: string, def?: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : def;
}

function hstack(frames: PixelSprite[], gap = 2): PixelSprite {
  const { h, palette } = frames[0];
  const pad = ".".repeat(gap);
  const rows = Array.from({ length: h }, (_, y) =>
    frames.map((f) => f.rows[y] ?? "").join(pad),
  );
  return { w: frames[0].w * frames.length + gap * (frames.length - 1), h, palette, rows };
}

async function main() {
  const positional: string[] = [];
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) { i++; continue; } // skip flag + its value
    positional.push(argv[i]);
  }
  const description = positional.join(" ").trim();
  const templateName = arg("--template", "swimsuit")!;
  const name = arg("--name", "cast")!;
  const out = arg("--out", "generated")!;

  if (!description) { console.error('Usage: npm run gen:walk -- "<desc>" --template swimsuit --name id'); process.exit(1); }
  if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY is not set."); process.exit(1); }

  const entry = TEMPLATES[templateName];
  if (!entry) { console.error(`unknown template "${templateName}". options: ${Object.keys(TEMPLATES).join(", ")}`); process.exit(1); }
  const skin = entry.template.allow.S;
  if (!skin) { console.error(`template "${templateName}" has no skin (S) zone — walk needs a humanoid body.`); process.exit(1); }

  const client = new Anthropic();
  console.log(`Generating walk cycle for "${description}" (${templateName}) with claude-opus-4-8 …`);

  // 1) base frame (the identity)
  const baseFiller = new LlmGridFiller(anthropicCompletion(client), description, 3, entry.example);
  const base = await baseFiller.fill(entry.template, { frame: 0, prompt: description });
  console.log("  base frame ✓");

  // 2) legs per pose, conditioned on the base so the skin matches
  const legFiller = new LlmGridFiller(anthropicCompletion(client), `${description} — just the legs in mid-stride, matching the body above`, 3);
  const leftUp = await legFiller.fill(legTemplate("LEFT_UP", entry.template.palette, skin), { frame: 1, prev: base });
  console.log("  left-stride legs ✓");
  const rightUp = await legFiller.fill(legTemplate("RIGHT_UP", entry.template.palette, skin), { frame: 3, prev: base });
  console.log("  right-stride legs ✓");

  const frames = walkCycle(base, leftUp, rightUp);

  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, `${name}-walk.gif`), encodeGif(frames, 8, 14));
  writeFileSync(join(out, `${name}-walk.png`), encodePng(hstack(frames), 8));
  writeFileSync(join(out, `${name}-walk.json`), JSON.stringify(frames, null, 2));

  console.log(`\n✓ walk cycle written:\n  ${out}/${name}-walk.gif\n  ${out}/${name}-walk.png\n  ${out}/${name}-walk.json`);
}

main();
