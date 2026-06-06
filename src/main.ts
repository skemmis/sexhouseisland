// Game entry point for Sex House Island. Assembles the GameConfig and hands it
// to the engine runtime. Everything game-specific is imported here (and in the
// hooks); the runtime (./runtime) imports none of it.
import { runGame } from "./runtime";
import { interact, newGame, ITEMS, ROOMS, START_ROOM, START_POS, initScenes } from "./game";
import { GAME } from "./game/hooks";
import { PLAYER_WALK } from "./game/playerWalk";
import { PLAYER_PORTRAIT } from "./game/playerPortrait";
import { PLAYER_PORTRAIT_IMG } from "./game/playerPortraitImg";

runGame({
  title: "Sex House Island",
  newGame,
  interact,
  items: ITEMS,
  player: {
    walk: PLAYER_WALK,
    portraitImg: PLAYER_PORTRAIT_IMG,
    portraitPixel: PLAYER_PORTRAIT,
  },
  getRooms: () => ROOMS,
  getStart: () => ({ room: START_ROOM, pos: START_POS }),
  loadScenes: initScenes,
  hooks: GAME,
});
