// Sprite registry — maps the `sprite` key on a Prop (rooms.json) to an actual
// PixelSprite. Shared by the engine (draws props) and the editor (shows/moves
// them). Add cast/props here, reference them by key in the editor.
import { flatFill, type PixelSprite } from "../pixels/sprite";
import { TEMPLATES } from "../pixels/templates";
import { MIKE_SPRITE } from "./mikeSprite";
import { BONNY_SPRITE } from "./bonnySprite";
import { MACK_SPRITE } from "./mackSprite";

const PELICAN = flatFill(TEMPLATES.pelican.template, TEMPLATES.pelican.defaultChoice);

// a small folded beach towel
const TOWEL: PixelSprite = {
  w: 12,
  h: 6,
  rows: [
    "hhhhhhhhhhhh",
    "tttttttttttt",
    "tttttttttttt",
    "pppppppppppp",
    "tttttttttttt",
    "333333333333",
  ],
  palette: { ".": "transparent", h: "#6fb3ab", t: "#3f7d80", p: "#c0556f", "3": "#264a4f" },
};

export const SPRITES: Record<string, PixelSprite> = {
  pelican: PELICAN,
  mike: MIKE_SPRITE,
  bonny: BONNY_SPRITE,
  mack: MACK_SPRITE,
  towel: TOWEL,
};
