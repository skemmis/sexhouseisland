import { readFileSync, writeFileSync } from "node:fs";
import { decodeImage, encodePng, fitResize, toDataUrl } from "./imageproc";
import { ART_DIRECTION } from "../src/art";

type Ref = { mimeType: string; data: string };
/** A reference image for the generator: a raw PNG/JPEG file, or a .ts module
 *  with a baked data URL (e.g. a character's portrait). */
function loadRef(path: string): Ref {
  const buf = readFileSync(path);
  if (buf[0] === 0x89 && buf[1] === 0x50) return { mimeType: "image/png", data: buf.toString("base64") };
  if (buf[0] === 0xff && buf[1] === 0xd8) return { mimeType: "image/jpeg", data: buf.toString("base64") };
  const m = buf.toString("utf8").match(/data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)/);
  if (!m) throw new Error(`no image found in ${path}`);
  return { mimeType: m[1], data: m[2] };
}

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

// Both prompts extend the shared house style (src/art.ts) so backdrops,
// portraits, and sprites all read as the same sunset-lit world.
const BACKDROP_AD =
  `${ART_DIRECTION}\n\n` +
  "Render a 16-bit pixel-art video-game BACKGROUND. EMPTY SET: no people, no " +
  "characters, no animals, no text. Wide side-on composition. Leave the bottom " +
  "third as flat open ground for characters to walk on.";

const PORTRAIT_AD =
  `${ART_DIRECTION}\n\n` +
  "Render a 16-bit pixel-art CHARACTER PORTRAIT — head and shoulders, like a " +
  "LucasArts dialogue close-up. One single character, centered, facing the " +
  "viewer, expressive cartoon features, on a simple dark plain background. No text.";

const TITLE_AD =
  `${ART_DIRECTION}\n\n` +
  "Render a 16-bit pixel-art GAME TITLE SCREEN — a FULL-BLEED cinematic " +
  "establishing shot that fills the ENTIRE frame edge to edge (no black bands, " +
  "no borders, no empty margins). Paint the game's title as a large, legible, " +
  "correctly-spelled hand-lettered LOGO reading exactly “SEX HOUSE ISLAND” in the " +
  "upper half. Compose the lower-center a little calmer (menu buttons get added " +
  "later by the engine) but keep painting real scenery there — do NOT leave a " +
  "flat dark band. CRITICAL: do NOT draw any buttons, menus, UI, boxes, or " +
  "interface — paint ONLY the scene and the title logo. No other text besides " +
  "the logo, no watermark, no people or characters.";

const SPRITE_AD =
  `${ART_DIRECTION}\n\n` +
  "Render ONE 16-bit pixel-art CHARACTER SPRITE for an adventure game: a single " +
  "full-body character, standing straight and relaxed, facing the viewer, " +
  "centered and filling almost the full height of the frame, thick near-black " +
  "outline, bold readable shapes, simple cel shading from a warm key light. " +
  "Solid FLAT MAGENTA (#FF00FF) background ONLY — no scenery, no ground line, no " +
  "cast shadow, no text. The whole figure must be inside the frame.";

const SHEET_AD =
  `${ART_DIRECTION}\n\n` +
  "Render a horizontal pixel-art SPRITE SHEET: the SAME single character repeated " +
  "FOUR times in a row, evenly spaced with equal gaps, as a WALK CYCLE shown in a " +
  "consistent 3/4 SIDE VIEW (the character angled toward the viewer AND to one " +
  "side, walking across screen) so the limb motion is clearly visible — frame 1 " +
  "left leg forward + right arm forward, frame 2 legs passing under the body, " +
  "frame 3 right leg forward + left arm forward, frame 4 legs passing. Arms must " +
  "SWING clearly with slightly bent elbows, opposite to the legs. The character " +
  "MUST be IDENTICAL in every frame (same size, proportions, hair, face, colours, " +
  "outfit) and all four MUST stand on the SAME baseline with feet aligned so the " +
  "frames register. Thick near-black outline, simple cel shading, flat solid " +
  "MAGENTA (#FF00FF) background only. No text, no numbers, no panel borders/grid.";

const SHEET_POSE_AD =
  `${ART_DIRECTION}\n\n` +
  "Render a horizontal pixel-art character WALK-CYCLE sprite sheet, thick " +
  "near-black outline, simple cel shading, on a flat solid MAGENTA (#FF00FF) " +
  "background. Reproduce the exact frame layout and body poses from the provided " +
  "pose-guide image (see instructions below). Same feet baseline in every frame. " +
  "No text, no numbers, no panel borders or grid lines.";

async function genOpenAI(full: string, size: string): Promise<Buffer> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";
  const body: Record<string, unknown> = { model, prompt: full, size, n: 1 };
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

async function genReplicate(full: string, aspect: string): Promise<Buffer> {
  const key = process.env.REPLICATE_API_TOKEN;
  if (!key) throw new Error("REPLICATE_API_TOKEN not set");
  const model = process.env.REPLICATE_MODEL ?? "black-forest-labs/flux-schnell";
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const create = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ input: { prompt: full, aspect_ratio: aspect, output_format: "png", num_outputs: 1 } }),
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

async function genGemini(full: string, aspect: string, refs: Ref[] = []): Promise<Buffer> {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  // Default to the latest standard "nano banana" (Nano Banana 2). For the
  // premium tier set GEMINI_IMAGE_MODEL=gemini-3-pro-image (Nano Banana Pro).
  // Imagen models use a different ":predict" endpoint (handled below).
  const model = process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image";
  const ver = process.env.GEMINI_API_VERSION ?? "v1beta";

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
    // reference images first, then the text prompt
    const parts: unknown[] = refs.map((r) => ({ inlineData: { mimeType: r.mimeType, data: r.data } }));
    parts.push({ text: withAspect ? full : `${full}\n\nAspect ratio ${aspect}.` });
    return fetch(url, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig }),
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
  const kind = (arg("--kind", "backdrop") ?? "backdrop").toLowerCase();
  const portrait = kind === "portrait";
  const title = kind === "title";
  const sprite = kind === "sprite";
  const sheet = kind === "sheet";
  // --ref may repeat; for a pose-conditioned sheet pass the pose guide FIRST,
  // then the character-identity reference.
  const refPaths: string[] = [];
  process.argv.forEach((a, i) => { if (a === "--ref") refPaths.push(process.argv[i + 1]); });
  const refs = refPaths.map(loadRef);
  const posed = sheet && refs.length >= 2;
  const w = +(arg("--w", portrait ? "64" : "320")!), h = +(arg("--h", portrait ? "64" : "136")!);
  const aspect = arg("--aspect", process.env.GEMINI_ASPECT) ?? (portrait ? "1:1" : "21:9");
  const modulePath = arg("--module", "src/game/poolDeckBg.ts")!;
  const varName = arg("--var", "POOL_DECK_BG")!;
  const stem = modulePath.split("/").pop()!.replace(/\.ts$/, "");
  if (!prompt) { console.error('Usage: npm run gen:bg -- "<description>" [--kind portrait] [--provider gemini]'); process.exit(1); }

  const ad = portrait ? PORTRAIT_AD : sprite ? SPRITE_AD : posed ? SHEET_POSE_AD : sheet ? SHEET_AD : title ? TITLE_AD : BACKDROP_AD;
  const refNote = posed
    ? "\n\nThe FIRST reference image is a POSE GUIDE: reproduce its layout EXACTLY " +
      "— same number of frames, same left-to-right positions, and the SAME body " +
      "pose / limb positions (leg stride and arm swing) in each frame. The SECOND " +
      "reference image is the CHARACTER IDENTITY (face, hair, skin, build, outfit). " +
      "Paint that character into each pose. Do not change the poses or spacing."
    : refs.length
      ? "\n\nIMPORTANT: match the character shown in the provided reference image — " +
        "same face, hairstyle, skin tone, build and outfit/colours."
      : "";
  const full = `${ad}\n\n${portrait || sprite || sheet ? "Character" : "Scene"}: ${prompt}${refNote}`;
  console.log(`Generating ${kind} via ${provider}${refs.length ? ` (+${refs.length} ref)` : ""} …`);
  const raw =
    provider === "replicate" ? await genReplicate(full, aspect)
    : provider === "gemini" ? await genGemini(full, aspect, refs)
    : await genOpenAI(full, portrait ? "1024x1024" : "1536x1024");

  writeFileSync(`generated/${stem}.raw`, raw); // keep the original for reference
  const small = fitResize(decodeImage(raw), w, h);
  const png = encodePng(small);
  writeFileSync(`generated/${stem}.png`, png); // preview
  writeFileSync(
    modulePath,
    `// ${portrait ? "Painted dialogue portrait" : "Painted backdrop"} generated by ` +
      `\`npm run gen:bg\` (${provider}), downscaled to ${w}x${h}.\n` +
      `export const ${varName} = "${toDataUrl(png)}";\n`,
  );
  console.log(`\n✓ ${kind}: ${w}x${h}\n  generated/${stem}.png (preview)\n  ${modulePath} (baked)`);
}

main();
