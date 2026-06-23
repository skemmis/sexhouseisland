// Generate glossy, cheesy reality-TV promo imagery for Sex House Island
// using Gemini's image model. Decodes the returned PNG, box-downsamples it,
// and writes a compact JPEG into public/ so the repo stays light.
//
//   node scripts/gen-cast.mjs            # generate everything
//   node scripts/gen-cast.mjs danni hero # only the named ids
//
// Requires AI_INTEGRATIONS_GEMINI_API_KEY in the environment.

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEY = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash-image";
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const LOOK =
  "Glossy, slightly cheesy reality-TV promotional photo. Bubblegum aesthetic: " +
  "saturated hot-pink and cyan studio backdrop, soft glamour beauty lighting, " +
  "high-key, vivid colors, subtle lens glow. Sharp, magazine-cover quality. " +
  "Absolutely NO text, NO captions, NO watermarks, NO logos anywhere in the image.";

// For shots that should read as a real photograph instead of bubblegum promo art.
const PHOTO =
  "Photorealistic wildlife photograph, shot on a DSLR with an 85mm lens, natural " +
  "golden-hour daylight, shallow depth of field, crisp feather and texture detail, " +
  "true-to-life color. Absolutely NO text, NO captions, NO watermarks, NO logos.";

// Cast headshots: tight head-and-shoulders, looking at camera unless noted.
const CAST = [
  ["danni",   "Head-and-shoulders promo portrait of a sweet, innocent-looking 18-year-old American woman with long blonde hair and big wide hopeful eyes, a slightly overwhelmed bright smile, wearing a pink bikini top and layered necklaces, girl-next-door energy."],
  ["grayson", "Head-and-shoulders promo portrait of a pale, shy 22-year-old man in a black hoodie, looking nervously away from the camera, avoiding eye contact, faint blush, awkward posture, soft chaotic hair."],
  ["brock",   "Head-and-shoulders promo portrait of an intensely muscular tan 30-year-old man with a square jaw and a thousand-yard stare, veins showing, shirtless with a dog tag, unsettlingly intense biohacker energy, looks both ripped and slightly unwell."],
  ["sage",    "Head-and-shoulders promo portrait of an intense, serene blonde wellness-influencer mom in her late 30s holding up a mason jar of murky green juice, beatific unsettling calm smile, crunchy natural-living energy, linen top."],
  ["xiao",    "Head-and-shoulders promo portrait of an elegant humanoid companion robot with a beautiful flawless synthetic face, faint seams along the jaw, softly glowing eyes, sleek metallic-pearl skin, refined and poetic expression."],
  ["tanner",  "Head-and-shoulders promo portrait of a smug looksmaxxed 28-year-old man with an exaggerated sharp jawline and perfect veneers, podcaster headphones around his neck, leaning toward a large podcast microphone, self-satisfied smirk."],
  ["greysuit", "Reality-TV promo portrait of a person in a skintight full-body matte grey spandex zentai suit that completely covers the head and face, posing confidently like a dating-show heartthrob. An iPad tablet is strapped over the front of their face like a mask; the iPad screen displays a softly glowing CG render of an impossibly handsome man's face with a dreamy smile. Head and shoulders, hands-on-hips contestant pose."],
  ["lenore",  "Head-and-shoulders promo portrait of a distinguished, dignified silver-haired actor in his 70s, dressed in a tasteful linen blazer, looking quietly out of place and melancholy among bright colors, prestige-drama gravitas."],
  ["marco",   "Head-and-shoulders promo portrait of a glistening soaking-wet 30-year-old man, water dripping down his face and bare shoulders, a towel draped around his neck caught mid-towel-off, perpetually damp, charming uneasy smile, beads of water everywhere."],
  ["mckenzie", "Head-and-shoulders promo portrait of a 20-year-old woman with an early-2000s nu-metal look: heavy black eyeliner, a small eyebrow piercing and a lip ring, choppy dyed-black hair with chunky highlights, wearing an oversized plain white hoodie, a slightly moody unimpressed expression with the faintest smirk."],
];

// Scene / brand imagery (wider crops). An optional 3rd element overrides the
// default bubblegum LOOK with a different style (e.g. photoreal).
const SCENES = [
  ["hero",    "Wide cinematic promotional banner for a cheesy reality dating show set on a tropical island. A glossy bubblegum-pink and turquoise lagoon, a luxury villa with neon, dozens of small camera drones hovering in the sky, a few pelicans gliding past, a giant carved tiki totem head glowing on the beach. Vibrant, saturated, over-the-top, fun. NO text, NO captions, NO logos."],
  ["aiia",    "A large carved wooden tiki totem-pole head on a tropical beach at dusk, its carved eyes and mouth glowing with neon cyan and pink light like a screen, wires and a small server rack at its base, ominous but cute, bubblegum color palette. NO text, NO logos."],
  ["pelican", "A photorealistic close-up of a single large brown pelican standing on a sunny tropical beach, turquoise sea blurred behind it. Its enormous beak pouch is bulging, and a black external computer hard drive with a trailing USB cable is visibly clamped in its beak, as if it just swallowed it. The bird looks alert and slightly guilty. Realistic, candid, like a press wildlife photo.", PHOTO],
  ["drone",   "A swarm of small white quadcopter camera drones hovering over a turquoise pool, bubblegum-pink sky, one drone in sharp focus in the foreground with a glossy camera lens, glamorous cheesy lighting. NO text, NO logos."],
];

async function generate(prompt, style = LOOK) {
  const body = {
    contents: [{ parts: [{ text: `${prompt}\n\n${style}` }] }],
    generationConfig: { responseModalities: ["IMAGE"] },
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 429 || res.status >= 500) {
      const wait = 2000 * 2 ** attempt;
      console.log(`  ${res.status}, retrying in ${wait}ms…`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    const json = await res.json();
    if (json.error) throw new Error(`${json.error.code}: ${json.error.message}`);
    const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part) throw new Error("no image in response");
    return Buffer.from(part.inlineData.data, "base64");
  }
  throw new Error("exhausted retries");
}

// Average-box downscale RGBA by an integer factor, then JPEG encode.
function shrinkToJpeg(pngBuf, maxDim = 600, quality = 80) {
  const png = PNG.sync.read(pngBuf);
  const { width: w, height: h, data } = png;
  const factor = Math.max(1, Math.floor(Math.max(w, h) / maxDim));
  const ow = Math.floor(w / factor);
  const oh = Math.floor(h / factor);
  const out = Buffer.alloc(ow * oh * 4);
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const sx = x * factor + dx, sy = y * factor + dy;
          const i = (sy * w + sx) * 4;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
        }
      }
      const o = (y * ow + x) * 4;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
    }
  }
  return jpeg.encode({ data: out, width: ow, height: oh }, quality).data;
}

async function main() {
  if (!KEY) { console.error("AI_INTEGRATIONS_GEMINI_API_KEY not set"); process.exit(1); }
  const only = new Set(process.argv.slice(2));
  const all = [
    ...CAST.map(([id, p]) => ["img/cast", id, p, 600, LOOK]),
    ...SCENES.map(([id, p, style]) => ["img", id, p, 900, style ?? LOOK]),
  ];
  const jobs = only.size ? all.filter(([, id]) => only.has(id)) : all;

  for (const [dir, id, prompt, maxDim, style] of jobs) {
    const outDir = join(root, "public", dir);
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, `${id}.jpg`);
    if (existsSync(outPath) && !only.size) { console.log(`skip ${id} (exists)`); continue; }
    process.stdout.write(`gen ${id} … `);
    try {
      const png = await generate(prompt, style);
      const jpg = shrinkToJpeg(png, maxDim);
      writeFileSync(outPath, jpg);
      console.log(`ok (${(jpg.length / 1024) | 0} KB)`);
    } catch (e) {
      console.log(`FAIL: ${e.message}`);
    }
  }
  console.log("done.");
}

main();
