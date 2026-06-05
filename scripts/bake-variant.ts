import { readFileSync, writeFileSync } from "node:fs";

// Bake a chosen variant into a game module:
//   npm run bake:variant -- <name> <n> <modulePath> <VAR_NAME>
// e.g. npm run bake:variant -- player 3 src/game/playerPortraitImg.ts PLAYER_PORTRAIT_IMG

const [, , name, nStr, modulePath, varName] = process.argv;
if (!name || !nStr || !modulePath || !varName) {
  console.error("Usage: npm run bake:variant -- <name> <n> <modulePath> <VAR_NAME>");
  process.exit(1);
}
const variants = JSON.parse(readFileSync(`generated/${name}-variants.json`, "utf8"));
const v = variants[+nStr - 1];
if (!v) { console.error(`variant ${nStr} not found (have ${variants.length})`); process.exit(1); }

if (v.kind === "portrait" || v.kind === "backdrop") {
  writeFileSync(modulePath, `// Picked variant ${nStr} of "${name}" (Gemini portrait).\nexport const ${varName} = "${v.dataUrl}";\n`);
} else {
  writeFileSync(
    modulePath,
    `// Picked variant ${nStr} of "${name}" (PixelBench sprite, template: ${v.template}).\n` +
      `import type { PixelSprite } from "../pixels/sprite";\n\n` +
      `export const ${varName}: PixelSprite = ${JSON.stringify(v.sprite, null, 2)};\n`,
  );
}
console.log(`✓ baked variant ${nStr} of "${name}" -> ${modulePath} (${varName})`);
