import { writeFileSync } from "node:fs";
import { decodeImage, encodePng, fitResize, toDataUrl } from "./imageproc";

// ============================================================================
//  Generate a painted static backdrop via an image-gen API, downscale it to the
//  game resolution (so it sits at the sprites' chunkiness — the Monkey Island
//  look), and bake it into src/game/poolDeckBg.ts as a base64 data URL.
//
//    BG_PROVIDER=replicate REPLICATE_API_TOKEN=...  npm run gen:bg -- "<scene>"
//    BG_PROVIDER=openai     OPENAI_API_KEY=...       npm run gen:bg -- "<scene>"
//
//  Claude (Anthropic) is text-only and cannot paint these — hence an image API.
// ============================================================================

const AD =
  "16-bit pixel-art video-game BACKGROUND, painterly and moody, dusk lighting, " +
  "rich saturated-but-dark palette, bold shapes, in the style of LucasArts' " +
  "The Secret of Monkey Island and Day of the Tentacle. EMPTY SET: no people, no " +
  "characters, no animals, no text. Wide side-on composition. Leave the bottom " +
  "third as flat open ground for characters to walk on.";

async function genOpenAI(prompt: string): Promise<Buffer> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";
  const size = model === "dall-e-3" ? "1792x1024" : "1536x1024";
  const body: Record<string, unknown> = { model, prompt: `${AD}\n\nScene: ${prompt}`, size, n: 1 };
  if (model === "dall-e-3") body.response_format = "b64_json";
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return Buffer.from(json.data[0].b64_json, "base64");
}

async function genReplicate(prompt: string): Promise<Buffer> {
  const key = process.env.REPLICATE_API_TOKEN;
  if (!key) throw new Error("REPLICATE_API_TOKEN not set");
  const model = process.env.REPLICATE_MODEL ?? "black-forest-labs/flux-schnell";
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  // 21:9 ≈ the scene's 2.35:1, so almost no cropping is needed.
  const create = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ input: { prompt: `${AD}\n\nScene: ${prompt}`, aspect_ratio: "21:9", output_format: "png", num_outputs: 1 } }),
  });
  if (!create.ok) throw new Error(`Replicate ${create.status}: ${await create.text()}`);
  let pred = await create.json();
  for (let i = 0; i < 60 && pred.status !== "succeeded"; i++) {
    if (pred.status === "failed" || pred.status === "canceled") throw new Error(`Replicate prediction ${pred.status}: ${pred.error}`);
    await new Promise((r) => setTimeout(r, 1500));
    pred = await (await fetch(pred.urls.get, { headers })).json();
  }
  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  if (!url) throw new Error("Replicate returned no output");
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}

async function genGemini(prompt: string): Promise<Buffer> {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  // Default to the latest standard "nano banana" (Nano Banana 2). For the
  // premium tier set GEMINI_IMAGE_MODEL=gemini-3-pro-image (Nano Banana Pro).
  // Imagen models use a different ":predict" endpoint (handled below).
  const model = process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image";
  const ver = process.env.GEMINI_API_VERSION ?? "v1beta";
  const aspect = process.env.GEMINI_ASPECT ?? "21:9"; // ≈ the scene's 2.35:1
  const full = `${AD}\n\nScene: ${prompt}`;

  if (model.includes("imagen")) {
    const res = await fetch(`https://generativelanguage.googleapis.com/${ver}/models/${model}:predict`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ instances: [{ prompt: full }], parameters: { sampleCount: 1, aspectRatio: aspect === "21:9" ? "16:9" : aspect } }),
    });
    if (!res.ok) throw new Error(`Imagen ${res.status}: ${await res.text()}`);
    const p = (await res.json()).predictions?.[0];
    const b64 = p?.bytesBase64Encoded ?? p?.image?.imageBytes;
    if (!b64) throw new Error("Imagen returned no image");
    return Buffer.from(b64, "base64");
  }

  // Native image model (nano banana): generateContent with an IMAGE modality.
  const url = `https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent`;
  const call = (withAspect: boolean) => {
    const generationConfig: Record<string, unknown> = { responseModalities: ["TEXT", "IMAGE"] };
    if (withAspect) generationConfig.imageConfig = { aspectRatio: aspect };
    return fetch(url, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: withAspect ? full : `${full}\n\nWide panoramic 21:9 composition.` }] }], generationConfig }),
    });
  };
  let res = await call(true);
  if (!res.ok) {
    const t = await res.text();
    if (/imageconfig|aspect|unknown|invalid|modal/i.test(t)) res = await call(false); // tolerate API-shape drift
    else throw new Error(`Gemini ${res.status}: ${t}`);
  }
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const parts = (await res.json()).candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p: any) => p?.inlineData?.data ?? p?.inline_data?.data);
  const b64 = img?.inlineData?.data ?? img?.inline_data?.data;
  if (!b64) throw new Error("Gemini returned no image part");
  return Buffer.from(b64, "base64");
}

function arg(flag: string, def?: string) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : def;
}

async function main() {
  const prompt = process.argv.slice(2).filter((a) => !a.startsWith("--") && process.argv[process.argv.indexOf(a) - 1]?.startsWith("--") !== true).join(" ").trim();
  const provider = (arg("--provider", process.env.BG_PROVIDER) ?? "openai").toLowerCase();
  const w = +(arg("--w", "320")!), h = +(arg("--h", "136")!);
  const modulePath = arg("--module", "src/game/poolDeckBg.ts")!;
  const varName = arg("--var", "POOL_DECK_BG")!;
  if (!prompt) { console.error('Usage: npm run gen:bg -- "<scene description>"  (set BG_PROVIDER + key)'); process.exit(1); }

  console.log(`Generating backdrop via ${provider} …`);
  const raw =
    provider === "replicate" ? await genReplicate(prompt)
    : provider === "gemini" ? await genGemini(prompt)
    : await genOpenAI(prompt);

  writeFileSync("generated/poolDeck-bg.raw", raw); // keep the original for reference
  const src = decodeImage(raw);
  const small = fitResize(src, w, h);
  const png = encodePng(small);
  writeFileSync("generated/poolDeck-bg.png", png); // preview
  writeFileSync(
    modulePath,
    `// Painted backdrop generated by \`npm run gen:bg\` (${provider}) and downscaled\n` +
      `// to ${w}x${h} to match sprite resolution. Static SET only — gameplay objects\n` +
      `// (pelican, skimmer, key glint, open-door glow) are engine overlays.\n` +
      `export const ${varName} = "${toDataUrl(png)}";\n`,
  );
  console.log(`\n✓ backdrop: source ${src.w}x${src.h} -> ${w}x${h}\n  generated/poolDeck-bg.png (preview)\n  ${modulePath} (baked)`);
}

main();
