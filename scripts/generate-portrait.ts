import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";

import { LlmGridFiller, type Completion } from "../src/pixels/llm";
import {
  FACE_TEMPLATE, compositeExpression, expressionTemplate,
} from "../src/pixels/portrait";
import { encodePng } from "./png";
import { encodeGif } from "./gif";

// ============================================================================
//  Generate a character portrait (neutral / talking / horror), no image model.
//    npm run gen:portrait -- "the looksmaxxer, fake tan, tiny eyes" --name looksmaxxer
//  Generates a base bust, then regenerates only the eyes/nose/mouth for each
//  expression (conditioned on the base), composites, and writes a lip-sync GIF
//  + per-expression PNGs + JSON to bake into the dialogue UI.
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

function arg(flag: string, def?: string) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : def;
}

async function main() {
  const positional: string[] = [];
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) { i++; continue; }
    positional.push(argv[i]);
  }
  const desc = positional.join(" ").trim();
  const name = arg("--name", "portrait")!;
  const out = arg("--out", "generated")!;
  if (!desc) { console.error('Usage: npm run gen:portrait -- "<desc>" --name id'); process.exit(1); }
  if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY is not set."); process.exit(1); }

  const client = new Anthropic();
  console.log(`Generating portrait for "${desc}" with claude-opus-4-8 …`);

  const baseFiller = new LlmGridFiller(anthropicCompletion(client), `head-and-shoulders dialogue portrait: ${desc}`, 3);
  const neutral = await baseFiller.fill(FACE_TEMPLATE, { frame: 0, prompt: desc });
  console.log("  neutral ✓");

  const exprFiller = (mood: string) =>
    new LlmGridFiller(anthropicCompletion(client), `eyes, nose and mouth only — ${desc}, ${mood}`, 3);

  const talkGen = await exprFiller("mouth open, mid-speech").fill(expressionTemplate(), { frame: 1, prev: neutral });
  const talking = compositeExpression(neutral, talkGen);
  console.log("  talking ✓");

  const horrorGen = await exprFiller("wide-eyed terror, mouth agape, screaming").fill(expressionTemplate(), { frame: 2, prev: neutral });
  const horror = compositeExpression(neutral, horrorGen);
  console.log("  horror ✓");

  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, `${name}-portrait.png`), encodePng(neutral, 10));
  writeFileSync(join(out, `${name}-horror.png`), encodePng(horror, 10));
  // lip-sync preview: alternate closed / open
  writeFileSync(join(out, `${name}-talk.gif`), encodeGif([neutral, talking], 8, 16));
  writeFileSync(join(out, `${name}-portrait.json`), JSON.stringify({ neutral, talking, horror }, null, 2));

  console.log(`\n✓ portrait written:\n  ${out}/${name}-portrait.png\n  ${out}/${name}-talk.gif\n  ${out}/${name}-horror.png\n  ${out}/${name}-portrait.json`);
}

main();
