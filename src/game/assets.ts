// Maps the backdrop KEY used in rooms.json to the baked image data URL.
// rooms.json (editor-owned) references backdrops by key, never by giant base64,
// so geometry data stays small and asset modules stay separate.
import { POOL_DECK_BG } from "./poolDeckBg";
import { BEACH_BG } from "./beachBg";
import { CONTROL_BG } from "./controlBg";
import { CONFESSIONAL_BG } from "./confessionalBg";
import { GALLEY_BG } from "./galleyBg";
import { JETTY_BG } from "./jettyBg";
import { AIIA_BG } from "./aiiaBg";

export const BACKDROPS: Record<string, string> = {
  poolDeck: POOL_DECK_BG,
  beach: BEACH_BG,
  control: CONTROL_BG,
  confessional: CONFESSIONAL_BG,
  galley: GALLEY_BG,
  jetty: JETTY_BG,
  aiia: AIIA_BG,
};
