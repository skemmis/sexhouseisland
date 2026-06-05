import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";

import { LlmGridFiller, type Completion } from "../src/pixels/llm";
import type { PixelSprite } from "../src/pixels/sprite";
import { TEMPLATES } from "../src/pixels/templates";
import { ART_DIRECTION } from "../src/art";
import { decodeImage, encodePng as encodeRgba, fitResize, toDataUrl, type RGBA } from "./imageproc";
import { encodePng as spriteToPng } from "./png";
import { drawText } from "../src/pixelfont";

// ============================================================================
//  VARIANT PICKER — human in the loop. Generate N options (in parallel) for a
//  portrait (Gemini) or a sprite (PixelBench), lay them out in a NUMBERED
//  contact sheet, and save each variant so the chosen one can be baked in:
//
//    npm run gen:variants -- portrait "the looksmaxxer" --n 4 --name looksmaxxer
//    npm run gen:variants -- sprite   "the death doula" --template robe --n 4 --name doula
//
//  Then: pick a number, and `npm run bake:variant -- <name> <n> <module> <var>`
//  copies that option into the game.
// ============================================================================

// ---- Gemini (nano banana) portrait, one image ----
async function genGeminiPortrait(desc: string): Promise<RGBA> {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const model = process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image";
  const ver = process.env.GEMINI_API_VERSION ?? "v1beta";
  const full =
    `${ART_DIRECTION}\n\nRender a 16-bit pixel-art CHARACTER PORTRAIT (LucasArts dialogue ` +
    `close-up): head and shoulders, one single character centered facing the viewer, on a ` +
    `simple dark background, no text.\n\nCharacter: ${desc}`;
  const call = (withAspect: boolean) => {
    const generationConfig: Record<string, unknown> = { responseModalities: ["TEXT", "IMAGE"] };
    if (withAspect) generationConfig.imageConfig = { aspectRatio: "1:1" };
    return fetch(`https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: full }] }], generationConfig }),
    });
  };
  let res = await call(true);
  if (!res.ok) { const t = await res.text(); if (/imageconfig|aspect|unknown|invalid|modal/i.test(t)) res = await call(false); else throw new Error(`Gemini ${res.status}: ${t}`); }
  const parts = (await res.json()).candidates?.[0]?.content?.parts ?? [];
  const b64 = parts.find((p: any) => p?.inlineData?.data ?? p?.inline_data?.data)?.inlineData?.data ?? parts.find((p: any) => p?.inline_data?.data)?.inline_data?.data;
  if (!b64) throw new Error("Gemini returned no image part");
  return fitResize(decodeImage(Buffer.from(b64, "base64")), 72, 72);
}

function anthropicCompletion(client: Anthropic): Completion {
  return async (prompt: string) => {
    const stream = client.messages.stream({ model: "claude-opus-4-8", max_tokens: 8000, thinking: { type: "adaptive" }, messages: [{ role: "user", content: prompt }] });
    const msg = await stream.finalMessage();
    return msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");
  };
}

// ---- contact sheet: numbered grid of variant PNGs ----
function contactSheet(tiles: RGBA[]): Buffer {
  const pad = 10, label = 16, S = 3;
  const tw = Math.max(...tiles.map((t) => t.w)), th = Math.max(...tiles.map((t) => t.h));
  const cols = Math.min(tiles.length, 4);
  const rows = Math.ceil(tiles.length / cols);
  const cellW = tw + pad, cellH = th + label + pad;
  const W = cols * cellW + pad, H = rows * cellH + pad;
  const iw = W * S, ih = H * S;
  const buf = Buffer.alloc(iw * ih * 4);
  for (let i = 0; i < iw * ih; i++) { buf[i * 4] = 16; buf[i * 4 + 1] = 16; buf[i * 4 + 2] = 22; buf[i * 4 + 3] = 255; }
  const putPx = (x: number, y: number, r: number, g: number, b: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) { const o = ((y * S + dy) * iw + (x * S + dx)) * 4; buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; }
  };
  const ctx: any = { fillStyle: "#fff", fillRect(x: number, y: number, w: number, h: number) { const hx = this.fillStyle as string; const r = parseInt(hx.slice(1, 3), 16), g = parseInt(hx.slice(3, 5), 16), b = parseInt(hx.slice(5, 7), 16); for (let j = 0; j < Math.round(h); j++) for (let i = 0; i < Math.round(w); i++) putPx(Math.round(x) + i, Math.round(y) + j, r, g, b); } };
  tiles.forEach((t, idx) => {
    const cx = pad + (idx % cols) * cellW, cy = pad + Math.floor(idx / cols) * cellH;
    drawText(ctx, `${idx + 1}`, cx, cy, "#e8d8a0", 2);
    for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) { const o = (y * t.w + x) * 4; if (t.data[o + 3] < 8) continue; putPx(cx + x, cy + label + y, t.data[o], t.data[o + 1], t.data[o + 2]); }
  });
  return encodeRgba({ w: iw, h: ih, data: new Uint8Array(buf) });
}

const arg = (f: string, d?: string) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };

async function main() {
  const argv = process.argv.slice(2);
  const kind = argv[0];
  const positional = argv.slice(1).filter((a, i) => !a.startsWith("--") && !argv.slice(1)[i - 1]?.startsWith("--"));
  const desc = positional.join(" ").trim();
  const n = Math.max(1, Math.min(8, +(arg("--n", "4")!)));
  const name = arg("--name", "variant")!;
  const templateName = arg("--template", "swimsuit")!;
  if ((kind !== "portrait" && kind !== "sprite") || !desc) {
    console.error('Usage: npm run gen:variants -- <portrait|sprite> "<desc>" --n 4 --name id [--template swimsuit]');
    process.exit(1);
  }

  console.log(`Generating ${n} ${kind} variants of "${desc}" in parallel …`);
  const tiles: RGBA[] = [];
  const saved: any[] = [];

  if (kind === "portrait") {
    const results = await Promise.allSettled(Array.from({ length: n }, () => genGeminiPortrait(desc)));
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        tiles.push(r.value);
        saved.push({ kind: "portrait", dataUrl: toDataUrl(encodeRgba(r.value)) });
      } else console.error(`  variant ${i + 1} failed: ${r.reason}`);
    });
  } else {
    const entry = TEMPLATES[templateName];
    if (!entry) { console.error(`unknown template "${templateName}". options: ${Object.keys(TEMPLATES).join(", ")}`); process.exit(1); }
    if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY not set"); process.exit(1); }
    const client = new Anthropic();
    const filler = new LlmGridFiller(anthropicCompletion(client), desc, 3, entry.example);
    const results = await Promise.allSettled(Array.from({ length: n }, (_, i) => filler.fill(entry.template, { frame: i, prompt: desc })));
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        tiles.push(decodeImage(spriteToPng(r.value as PixelSprite, 4)));
        saved.push({ kind: "sprite", template: templateName, sprite: r.value });
      } else console.error(`  variant ${i + 1} failed: ${r.reason}`);
    });
  }

  if (tiles.length === 0) { console.error("All variants failed."); process.exit(1); }
  mkdirSync("generated", { recursive: true });
  writeFileSync(join("generated", `${name}-variants.png`), contactSheet(tiles));
  writeFileSync(join("generated", `${name}-variants.json`), JSON.stringify(saved, null, 2));
  console.log(`\n✓ ${tiles.length} variants:\n  generated/${name}-variants.png (numbered contact sheet)\n  generated/${name}-variants.json\nPick a number, then bake with: npm run bake:variant -- ${name} <n> <module> <var>`);
}

main();
