// Core data model for the adventure engine.
// Everything the game "is" — rooms, hotspots, items, dialogue — is plain data.
// The engine (main.ts) interprets this data; the game (game.ts) authors it.

export type Vec = { x: number; y: number };

/** The nine classic SCUMM verbs. */
export type Verb =
  | "Give"
  | "Open"
  | "Close"
  | "Pick up"
  | "Look at"
  | "Talk to"
  | "Use"
  | "Push"
  | "Pull";

export const VERBS: Verb[] = [
  "Give", "Open", "Close",
  "Pick up", "Look at", "Talk to",
  "Use", "Push", "Pull",
];

/** A clickable region in a room. Rectangular for the slice; swap for polygons later. */
export interface Hotspot {
  id: string;
  name: string;            // shown in the sentence line ("Look at  door")
  rect: { x: number; y: number; w: number; h: number };
  /** Where the player should stand to interact with it. */
  walkTo: Vec;
  /** Optional facing direction once arrived: -1 left, 1 right, 0 toward camera. */
  face?: number;
  /** If set, walking here travels to another room (entering at `entry`). */
  exit?: { to: string; entry: Vec; face?: number };
}

/** An inventory item. `icon` is drawn procedurally for now (see render.ts). */
export interface Item {
  id: string;
  name: string;
  icon: string; // a key into the procedural icon drawer
}

/** A single line of dialogue or a branch in a conversation. */
export interface DialogueNode {
  /** Lines the NPC says when this node is entered. */
  npc: string[];
  /** Player response options. Empty = conversation ends after npc lines. */
  choices?: { text: string; goto: string }[];
  /** Runs once when this node is entered — for scripted consequences. */
  effect?: (state: GameState) => void;
}

export interface Dialogue {
  start: string;
  nodes: Record<string, DialogueNode>;
  /** A base64 portrait data URL for the NPC speaking, shown in the dialogue box. */
  speakerPortrait?: string;
}

/** A room: a backdrop, a walkable floor band, hotspots, and characters. */
export interface Room {
  id: string;
  /** Floor band for walking + depth scaling. minY = far edge, maxY = near edge. */
  floor: { minY: number; maxY: number; minScale: number; maxScale: number };
  hotspots: Hotspot[];
  /** Base64 walkable-area mask (see src/walk.ts); absent = free movement. */
  walk?: string;
  /** Draws the painted backdrop. Replace with a loaded image in production. */
  paint: (ctx: CanvasRenderingContext2D, t: number, state: GameState) => void;
}

/** Pure scene geometry — the editor-owned data that lives in rooms.json. */
export interface RoomData {
  /** Backdrop key, resolved to an image via src/game/assets.ts. */
  backdrop: string;
  floor: { minY: number; maxY: number; minScale: number; maxScale: number };
  hotspots: Hotspot[];
  /** Base64 walkable-area mask (see src/walk.ts); absent = free movement. */
  walk?: string;
}

/** The shape of rooms.json. */
export interface RoomsFile {
  start: { room: string; pos: Vec };
  rooms: Record<string, RoomData>;
}

/** Mutable world state — the save game, essentially. */
export interface GameState {
  flags: Record<string, boolean>;
  inventory: Item[];
  currentRoom: string;
  won: boolean;
}

/**
 * The result of an interaction: what the game logic decides should happen
 * when the player performs `verb` on `target` (optionally with `withItem`).
 */
export interface ActionResult {
  /** Line(s) the player character says. */
  say?: string[];
  /** Mutate world state (set flags, add/remove items). */
  effect?: (state: GameState) => void;
  /** Start a conversation. */
  dialogue?: Dialogue;
  /** Travel to another room (for conditional exits, e.g. an unlocked door). */
  goto?: { room: string; entry: Vec; face?: number };
}
