// The contract between the engine runtime and a game's hooks. The runtime builds
// an `EngineApi` each frame and hands it to the game's `GameHooks`, so
// game-specific behavior (cutscenes, custom draw layers, the win screen) lives in
// the GAME, not the engine. See docs/SLOPP-ENGINE.md.
import type { GameState, Room, Vec } from "./types";
import type { PixelSprite } from "./pixels/sprite";
import type { Cutscene } from "./cutscene";

export interface EngineApi {
  ctx: CanvasRenderingContext2D;
  state: GameState;
  room: Room;
  t: number;   // seconds, for draw hooks
  dt: number;  // delta seconds, for update hook
  VW: number;
  VH: number;
  SCENE_H: number;
  playerPos: Vec;     // the player's current feet position
  playerScale: number; // depth scale at the player's position
  /** Player voices a line (with the player portrait). */
  say(lines: string[]): void;
  /** Draw a sprite (top-left at x,y; scale = px per cell). */
  drawSprite(sp: PixelSprite, x: number, y: number, scale: number): void;
  /** Centered pixel-font text (used by win screens etc). */
  centerText(s: string, cx: number, y: number, size: number): void;
  // dialogue/speech state, for triggering scripted moments:
  speechCount: number;
  dialogueActive: boolean;
  dialogueTerminal: boolean; // current node has no choices
  endDialogue(): void;
  // one active game cutscene slot, advanced by the engine each frame:
  cutsceneActive: boolean;
  startCutscene(c: Cutscene): void;
}

/** A game supplies these to customize runtime behavior the engine can't know. */
export interface GameHooks {
  /** Per-frame game logic (e.g. arm/trigger cutscenes). */
  update?(api: EngineApi): void;
  /** Draw over the scene (custom actors, the drone, cutscene visuals). */
  drawWorld?(api: EngineApi): void;
  /** Custom ending overlay (drawn when state.won). */
  winScreen?(api: EngineApi): void;
  /** Reset transient hook state (called on new game / restart). */
  reset?(): void;
}
