import {
  deriveTemplate, type Palette, type PixelSprite, type SpriteTemplate,
} from "./sprite";
import { HERO_TEMPLATE, HERO_IDLE } from "./hero";

// ============================================================================
//  THE SILHOUETTE-TEMPLATE LIBRARY.
//
//  Last turn proved the thesis: a model fills a locked silhouette reliably, but
//  flounders on a blank canvas. So we give it silhouettes. There are two kinds:
//
//   1. COSTUME VARIANTS — same humanoid silhouette, re-zoned so the model
//      paints a different outfit (swimsuit, robe). Cheap: a zone remap of the
//      proven HERO silhouette. Great for the cast, who are all the same shape
//      in different (minimal) clothing.
//
//   2. NEW SILHOUETTES — a different shape entirely (the pelican). These are
//      hand-authored zone maps. More work, but this is what makes a non-human
//      thing render cleanly instead of as a blob.
//
//  A model fills any of these via the same LlmGridFiller — only the template
//  (and optional few-shot example) changes.
// ============================================================================

export interface TemplateEntry {
  label: string;
  template: SpriteTemplate;
  /** A default zone->color choice for instant rules-based (no-model) variants. */
  defaultChoice: Record<string, string>;
  /** Optional few-shot example fill on the same grid, to steer the model. */
  example?: PixelSprite;
}

/** Recolor a silhouette: replace each zone id, swap in a new palette + rules. */
function remapZones(
  src: SpriteTemplate,
  zoneMap: Record<string, string>,
  palette: Palette,
  allow: Record<string, string[]>,
): SpriteTemplate {
  const regions = src.regions.map((row) =>
    [...row].map((c) => (c === "." ? "." : zoneMap[c] ?? c)).join(""),
  );
  return { w: src.w, h: src.h, regions, palette, allow };
}

// ---------------------------------------------------------------------------
//  COSTUME VARIANT: SWIMSUIT  (the all-bathing-suit-all-the-time cast)
//  Bare torso/arms/legs/feet = skin; the belt band becomes swimwear.
// ---------------------------------------------------------------------------
const SWIMSUIT_PALETTE: Palette = {
  ".": "transparent",
  "1": "#14101a", // outline
  "2": "#e3b07a", "3": "#c8915a", "4": "#f0c89a", // skin / shadow / light
  "5": "#3a2a18", "6": "#7a5230", "7": "#caa54a", "8": "#2b2b3a", // hair: dk/brn/blonde/blk
  b: "#1a1a1a", // eye
  "9": "#c0556f", a: "#3a6ea5", c: "#1f6f5c", d: "#9b3b4a", // swimwear: pink/blue/teal/red
};
export const SWIMSUIT: SpriteTemplate = remapZones(
  HERO_TEMPLATE,
  { V: "S", C: "S", B: "W", L: "S", K: "S" }, // vest/shirt/legs/boots -> skin; belt -> swimwear
  SWIMSUIT_PALETTE,
  {
    O: ["1"],
    S: ["2", "3", "4", "1"],
    H: ["5", "6", "7", "8", "1"],
    E: ["b", "2"],
    W: ["9", "a", "c", "d", "1"],
  },
);

// ---------------------------------------------------------------------------
//  COSTUME VARIANT: ROBE  (death doula / judge / Mormon / oracle types)
//  Everything below the neck becomes a robe; face + hair + eyes stay.
// ---------------------------------------------------------------------------
const ROBE_PALETTE: Palette = {
  ".": "transparent",
  "1": "#14101a",
  "2": "#e3b07a", "3": "#c8915a", // skin (face, hands)
  "5": "#3a2a18", "6": "#7a5230", // hair
  b: "#1a1a1a", // eye
  r: "#2e2636", s: "#4a3f5a", t: "#7a6f8a", // robe: dark/mid/light
  g: "#caa54a", // trim / accent
};
export const ROBE: SpriteTemplate = remapZones(
  HERO_TEMPLATE,
  { V: "R", C: "R", B: "R", L: "R", K: "R" }, // whole body below neck -> robe
  ROBE_PALETTE,
  {
    O: ["1"],
    S: ["2", "3", "1"],
    H: ["5", "6", "1"],
    E: ["b", "2"],
    R: ["r", "s", "t", "g", "1"],
  },
);

// ---------------------------------------------------------------------------
//  NEW SILHOUETTE: PELICAN  (16x16, front-facing, big pouch — "Pelican Island")
//  Hand-authored zone map. Zones: D body, E eye, P beak/pouch, G wing, F feet.
//  Compare a fill of THIS against last turn's freeform pelican to see what
//  locking the silhouette buys you.
// ---------------------------------------------------------------------------
const PELICAN_PALETTE: Palette = {
  ".": "transparent",
  "1": "#14101a", // outline
  w: "#eef2f4", W: "#cdd6dc", // feather white / shadow
  o: "#e8902a", O: "#c4701a", // beak orange / shadow
  g: "#9aa3ad", // wing grey
  k: "#1a1a1a", // eye
};
export const PELICAN: SpriteTemplate = {
  w: 16,
  h: 16,
  palette: PELICAN_PALETTE,
  regions: [
    "................",
    "................",
    ".....DDDDDD.....", // head top
    "....DDDDDDDD....",
    "....DDEDDEDD....", // eyes
    "....DDDDDDDD....",
    "....DPPPPPPD....", // pouch begins
    "...DDPPPPPPDD...",
    "...DGPPPPPPGD...", // wings flank pouch
    "...DGGPPPPGGD...",
    "...DDDDDDDDDD...", // body
    "...DDDDDDDDDD...",
    "....DDDDDDDD....",
    "....DDDDDDDD....",
    ".....FF..FF.....", // feet
    "....FFF..FFF....",
  ],
  allow: {
    D: ["w", "W", "1"],
    E: ["k", "w"],
    P: ["o", "O", "1"],
    G: ["g", "W", "1"],
    F: ["o", "O", "1"],
  },
};

// ---------------------------------------------------------------------------
//  REGISTRY — what `npm run gen --template <name>` selects from.
// ---------------------------------------------------------------------------
export const TEMPLATES: Record<string, TemplateEntry> = {
  humanoid: {
    label: "generic clothed humanoid",
    template: HERO_TEMPLATE,
    defaultChoice: { O: "1", S: "2", E: "b", H: "4", C: "6", V: "7", B: "9", L: "a", K: "c" },
    example: HERO_IDLE, // few-shot: the hand-authored hero is a known-good fill
  },
  swimsuit: {
    label: "cast member in a swimsuit (bare body)",
    template: SWIMSUIT,
    defaultChoice: { O: "1", S: "2", E: "b", H: "6", W: "9" },
  },
  robe: {
    label: "robed figure (doula / judge / oracle)",
    template: ROBE,
    defaultChoice: { O: "1", S: "2", E: "b", H: "5", R: "r" },
  },
  pelican: {
    label: "front-facing pelican",
    template: PELICAN,
    defaultChoice: { D: "w", E: "k", P: "o", G: "g", F: "o" },
  },
};

// Build the few-shot example for swimsuit/robe by recoloring the hero example
// through the same zone remap, so each costume variant ships with a worked
// example without hand-authoring a second frame.
function remapExample(
  example: PixelSprite,
  fromTemplate: SpriteTemplate,
  zoneMap: Record<string, string>,
  defaultChoice: Record<string, string>,
  palette: Palette,
): PixelSprite {
  const rows = example.rows.map((row, y) =>
    [...row]
      .map((_, x) => {
        const zone = fromTemplate.regions[y]?.[x] ?? ".";
        if (zone === ".") return ".";
        const mapped = zoneMap[zone] ?? zone;
        return defaultChoice[mapped] ?? ".";
      })
      .join(""),
  );
  return { w: example.w, h: example.h, rows, palette };
}

TEMPLATES.swimsuit.example = remapExample(
  HERO_IDLE, HERO_TEMPLATE,
  { V: "S", C: "S", B: "W", L: "S", K: "S" },
  TEMPLATES.swimsuit.defaultChoice, SWIMSUIT_PALETTE,
);
TEMPLATES.robe.example = remapExample(
  HERO_IDLE, HERO_TEMPLATE,
  { V: "R", C: "R", B: "R", L: "R", K: "R" },
  TEMPLATES.robe.defaultChoice, ROBE_PALETTE,
);

// re-export so deriveTemplate stays available to template authors
export { deriveTemplate };
