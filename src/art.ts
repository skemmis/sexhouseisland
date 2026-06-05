// ============================================================================
//  SHARED ART DIRECTION — one source of truth for BOTH generators:
//   - Nano Banana (image-gen backdrops + dialogue portraits), and
//   - PixelBench (the LLM that emits sprite / portrait grids).
//
//  Feeding the same house-style + palette to both keeps characters and
//  backgrounds reading as one cohesive, sunset-lit world.
// ============================================================================

export const ART_DIRECTION =
  "SEX HOUSE ISLAND house style: cartoonish but moody, in the pixel-art spirit " +
  "of LucasArts' The Secret of Monkey Island and Day of the Tentacle. DUSK " +
  "LIGHTING — a warm amber/terracotta key light with cool purple-teal shadows; " +
  "everything looks lit by the same sunset. Rich, slightly desaturated colours, " +
  "bold simple shapes, thick near-black outlines, high contrast.";

// A shared ~16-colour dusk palette. Sprite templates and freeform props should
// draw from this family so characters sit naturally in the painted scenes.
// (Keys are single chars so they double as PixelBench palette indices.)
export const WORLD_PALETTE: Record<string, string> = {
  ".": "transparent",
  "1": "#170f22", // outline / darkest
  "2": "#3a2740", // deep shadow purple
  "3": "#5d3b50", // shadow mauve
  "4": "#8a4f4a", // dusk terracotta
  "5": "#c47a4e", // warm key (lit skin / wood)
  "6": "#e6a86a", // bright warm highlight
  "7": "#f0d59a", // lightest warm
  "8": "#274a52", // cool shadow teal
  "9": "#3f7d80", // teal
  a: "#6fb3ab", // light teal (water)
  b: "#2d2c46", // cool dark (trousers/night)
  c: "#7c6f93", // muted lavender
  d: "#c0556f", // hot pink accent (the show)
  e: "#d8b24a", // gold accent (lamp)
  f: "#cdbda2", // warm stone / stucco
};

/** Prefix a generation prompt with the shared house style. */
export function styled(prompt: string): string {
  return `${ART_DIRECTION}\n\n${prompt}`;
}
