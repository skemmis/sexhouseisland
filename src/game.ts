import type { ActionResult, GameState, Item, Room, Verb } from "./types";
import { flatFill } from "./pixels/sprite";
import { drawSprite } from "./pixels/render";
import { TEMPLATES } from "./pixels/templates";
import { makeBackdrop, drawBackdrop } from "./background";
import { POOL_DECK_BG } from "./game/poolDeckBg";
import { MIKE_SPRITE } from "./game/mikeSprite";
import { MIKE_PORTRAIT_IMG } from "./game/mikePortraitImg";

// A baked (no-API) pelican for set dressing, from the silhouette-template library.
const PELICAN_SPRITE = flatFill(TEMPLATES.pelican.template, TEMPLATES.pelican.defaultChoice);

// ============================================================================
//  GAME CONTENT  — this is the "authoring" layer. Everything here is data +
//  a little logic. A designer edits THIS file to make a game; the engine
//  (main.ts) never changes. This is where a real game grows: more rooms,
//  more hotspots, more puzzle logic in `interact()`.
// ============================================================================

export const ITEMS: Record<string, Item> = {
  rod:  { id: "rod",  name: "pool skimmer", icon: "rod" },
  key:  { id: "key",  name: "rusty key",   icon: "key" },
};

// ---- The one room: the Sex House Island pool deck at dusk. Hotspots + floor
//      band are authored over the painted backdrop (see poolDeckBg). ----
export const DOCK: Room = {
  id: "dock",
  // Walkable band = the front deck in front of the pool (the painted pool sits
  // higher up, so the floor starts below it).
  floor: { minY: 110, maxY: 132, minScale: 0.78, maxScale: 1.18 },
  hotspots: [
    {
      id: "door",
      name: "villa door",
      rect: { x: 6, y: 44, w: 30, h: 50 }, // painted door, left wall
      walkTo: { x: 44, y: 118 },
      face: 0,
    },
    {
      id: "well",
      name: "the deep end",
      rect: { x: 104, y: 74, w: 116, h: 46 }, // the painted pool, centre
      walkTo: { x: 150, y: 124 },
      face: 0,
    },
    {
      id: "rod",
      name: "pool skimmer",
      rect: { x: 94, y: 84, w: 16, h: 40 }, // skimmer overlay, leaning at pool's left
      walkTo: { x: 100, y: 124 },
      face: 0,
    },
    {
      id: "parrot",
      name: "pelican",
      rect: { x: 44, y: 100, w: 40, h: 32 }, // pelican overlay, front deck
      walkTo: { x: 66, y: 130 },
      face: -1,
    },
    {
      id: "sign",
      name: "the lantern",
      rect: { x: 36, y: 26, w: 16, h: 18 }, // the painted lantern by the door
      walkTo: { x: 44, y: 118 },
      face: 0,
    },
    {
      id: "mike",
      name: "Mike White",
      rect: { x: 262, y: 80, w: 30, h: 44 }, // by the loungers, right
      walkTo: { x: 250, y: 126 },
      face: 1,
    },
  ],
  paint: paintDock,
};

export const ROOMS: Record<string, Room> = { dock: DOCK };

export const START_ROOM = "dock";
export const START_POS = { x: 130, y: 124 };

export function newGame(): GameState {
  return { flags: {}, inventory: [], currentRoom: START_ROOM, won: false };
}

// ----------------------------------------------------------------------------
//  THE PUZZLE LOGIC.  Given (verb, target, optional item), return what happens.
//  This `interact` function is the heart of the game design. It's a big switch
//  today; as games grow this becomes per-hotspot script objects, but the shape
//  is the same: data in, ActionResult out.
//
//  The slice's puzzle:
//    1. "Pick up" the fishing rod   -> rod enters inventory
//    2. "Use" rod on the well        -> fish out the rusty key
//    3. "Use" key on the tavern door -> door unlocks -> WIN
//  The parrot (Talk to) hints the solution. Everything else has flavor text.
// ----------------------------------------------------------------------------
export function interact(
  verb: Verb,
  targetId: string,
  state: GameState,
  withItem?: string,
): ActionResult {
  const has = (id: string) => state.inventory.some((i) => i.id === id);

  switch (targetId) {
    case "rod":
      if (verb === "Pick up") {
        if (has("rod") || state.flags.gotRod)
          return { say: ["I've already got it."] };
        return {
          say: ["A pool skimmer. The producers left it out. Finders keepers."],
          effect: (s) => {
            s.inventory.push(ITEMS.rod);
            s.flags.gotRod = true;
          },
        };
      }
      if (verb === "Look at") return { say: ["A long-handled pool skimmer, leaning by the loungers."] };
      return { say: [`I can't ${verb.toLowerCase()} that.`] };

    case "well":
      if (verb === "Use" && withItem === "rod") {
        if (state.flags.gotKey)
          return { say: ["I've skimmed everything worth having out of the deep end."] };
        return {
          say: ["*plip*", "...", "Snagged something. A rusty old key. The villa key?"],
          effect: (s) => {
            s.inventory.push(ITEMS.key);
            s.flags.gotKey = true;
          },
        };
      }
      if (verb === "Use" && withItem) return { say: [`Dunking the ${itemName(withItem)} in the pool accomplishes nothing.`] };
      if (verb === "Look at") return { say: ["The deep end. They say it has no bottom. Something glints down there — too deep to reach by hand."] };
      if (verb === "Use") return { say: ["I'm not getting in there. It has no bottom."] };
      return { say: [`I can't ${verb.toLowerCase()} the pool.`] };

    case "door":
      if (verb === "Use" && withItem === "key") {
        return {
          say: ["The rusty key turns with a satisfying *clunk*. The villa's open!"],
          effect: (s) => {
            s.flags.doorOpen = true;
            s.won = true;
          },
        };
      }
      if ((verb === "Open" || verb === "Use") && !state.flags.doorOpen)
        return { say: ["Locked. We're not allowed inside — that's the whole bit. I'll need a key."] };
      if (verb === "Open") return { say: ["It's already open."] };
      if (verb === "Look at") return { say: ["The villa door. Climate-controlled paradise on the other side. Locked, of course."] };
      return { say: [`I can't ${verb.toLowerCase()} the door.`] };

    case "parrot":
      if (verb === "Talk to")
        return {
          dialogue: {
            start: "hi",
            nodes: {
              hi: {
                npc: ["Squawk! Welcome to Sex House Island. Season one hundred and something!"],
                choices: [
                  { text: "How do I get into the villa?", goto: "hint" },
                  { text: "Why are we locked out?", goto: "lore" },
                  { text: "(Leave)", goto: "bye" },
                ],
              },
              hint: {
                npc: [
                  "Squawk! A producer dropped the villa key in the deep end years ago.",
                  "Too deep for an arm... but not for a pool skimmer! Squawk!",
                ],
                choices: [{ text: "Thanks, bird.", goto: "hi" }],
              },
              lore: {
                npc: [
                  "Squawk! It's an inversion this season. You're locked OUT.",
                  "Sleep by the pool. Use the grass. The villa is for WINNERS. Squawk!",
                ],
                choices: [{ text: "Bleak.", goto: "hi" }],
              },
              bye: { npc: ["Squawk! Don't drink the red tide!"] },
            },
          },
        };
      if (verb === "Look at") return { say: ["A large pelican. It has seen things. It seems to know more than it lets on."] };
      if (verb === "Pick up") return { say: ["It snaps at me with that enormous beak. I'll pass."] };
      return { say: [`I can't ${verb.toLowerCase()} the pelican.`] };

    case "mike":
      if (state.flags.mikeGone) {
        if (verb === "Look at") return { say: ["Just ripples where Mike used to be. The deep end kept him."] };
        if (verb === "Talk to") return { say: ["He's not coming back up. He never resurfaced."] };
        return { say: [`I can't ${verb.toLowerCase()} a man who isn't there anymore.`] };
      }
      if (verb === "Look at")
        return { say: ["Mike White. Survivor, the Amazing Race, and now this. He's grinning at the deep end like it owes him money."] };
      if (verb === "Talk to")
        return {
          dialogue: {
            speakerPortrait: MIKE_PORTRAIT_IMG,
            start: "hi",
            nodes: {
              hi: {
                npc: [
                  "Sex House Island?! I am ALL in. I've done Survivor, the Amazing Race — nothing compares.",
                  "Hey. Hey. Does this pool have a bottom? Because I'm looking at it and I don't think it does.",
                  "I have to know. For the show. For ME.",
                ],
                choices: [
                  { text: "Mike, please don't.", goto: "jump" },
                  { text: "Go prove it, Mike.", goto: "jump" },
                ],
              },
              jump: {
                npc: ["Only one way to find out!", "CANNONBALL!", "*SPLOOOSH*", "...", "..."],
                effect: (s) => { s.flags.mikeGone = true; },
              },
            },
          },
        };
      return { say: [`I can't ${verb.toLowerCase()} Mike.`] };

    case "key":
      if (verb === "Look at") return { say: ["A rusty key, fresh from the deep end. It smells of chlorine and despair."] };
      return { say: [`I can't ${verb.toLowerCase()} the key like that.`] };

    case "sign":
      if (verb === "Look at")
        return { say: ["A wrought-iron lantern by the villa door. Inside, it's warm and dry. Out here, it is not."] };
      if (verb === "Use" || verb === "Pull")
        return { say: ["It's bolted to the wall. The producers think of everything."] };
      return { say: [`I can't ${verb.toLowerCase()} the lantern.`] };
  }

  return { say: [`I can't ${verb.toLowerCase()} that.`] };
}

function itemName(id: string) {
  return ITEMS[id]?.name ?? "thing";
}

// ============================================================================
//  BACKDROP. A painted static image (image-gen, baked by `npm run gen:bg`) that
//  the sprites move within — the Monkey Island model. Until one is generated,
//  the room falls back to a procedural "set". Either way, state-dependent
//  gameplay objects (pelican, pool skimmer, key glint, open-door glow) are drawn
//  as OVERLAYS on top, so the static backdrop never has to change.
// ============================================================================
const POOL_BG = makeBackdrop(POOL_DECK_BG);

function paintDock(ctx: CanvasRenderingContext2D, t: number, state: GameState) {
  if (!drawBackdrop(ctx, POOL_BG, 0, 0, 320, 136)) paintProceduralSet(ctx, t);
  paintOverlays(ctx, t, state);
}

// The static SET only — no gameplay objects. Used when no painted backdrop is
// baked in yet. (The painted image, when present, replaces this entirely.)
function paintProceduralSet(ctx: CanvasRenderingContext2D, t: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, 96);
  sky.addColorStop(0, "#10131f");
  sky.addColorStop(1, "#39314f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 320, 96);

  ctx.fillStyle = "#f0ecd0";
  ctx.beginPath(); ctx.arc(280, 26, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#39314f";
  ctx.beginPath(); ctx.arc(286, 22, 12, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = "#fff";
  for (let i = 0; i < 40; i++) {
    if (Math.sin(t * 2 + i) > 0.3) ctx.fillRect((i * 71) % 320, (i * 37) % 70, 1, 1);
  }

  ctx.fillStyle = "#1d3a4a";
  ctx.fillRect(0, 70, 320, 20);
  ctx.fillStyle = "rgba(240,236,208,0.15)";
  for (let i = 0; i < 6; i++) ctx.fillRect((t * 8 + i * 40) % 320, 72 + i * 3, 10, 1);

  // villa wall + closed door + window
  ctx.fillStyle = "#cdbfa6"; ctx.fillRect(0, 30, 80, 70);
  ctx.fillStyle = "#b6a487"; ctx.fillRect(0, 28, 80, 4);
  ctx.fillStyle = "#5a4632"; ctx.fillRect(28, 40, 34, 56);
  ctx.fillStyle = "#caa54a"; ctx.fillRect(54, 66, 3, 3);
  ctx.fillStyle = "#e8c86a"; ctx.fillRect(8, 44, 14, 12);

  // deck
  ctx.fillStyle = "#b9ac90"; ctx.fillRect(0, 90, 320, 46);
  ctx.fillStyle = "#a59879";
  for (let x = 0; x < 320; x += 20) ctx.fillRect(x, 90, 1, 46);
  for (let y = 96; y < 136; y += 14) ctx.fillRect(0, y, 320, 1);

  // pool (no glint — that's an overlay)
  ctx.fillStyle = "#cdbfa6"; ctx.fillRect(148, 84, 48, 4);
  ctx.fillStyle = "#2f7fb0"; ctx.fillRect(150, 88, 44, 22);
  ctx.fillStyle = "#1d5f8a"; ctx.fillRect(156, 94, 32, 14);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (let i = 0; i < 4; i++) ctx.fillRect(154 + ((t * 6 + i * 12) % 36), 90 + i * 4, 6, 1);

  // sign + lounger
  ctx.fillStyle = "#8a7250"; ctx.fillRect(104, 90, 4, 16);
  ctx.fillStyle = "#d24a6a"; ctx.fillRect(96, 78, 22, 14);
  ctx.fillStyle = "#fff"; ctx.fillRect(99, 82, 16, 1); ctx.fillRect(99, 85, 12, 1);
  ctx.fillStyle = "#e8e2d4"; ctx.fillRect(244, 100, 30, 8);
  ctx.fillStyle = "#cfc7b4"; ctx.fillRect(244, 100, 30, 2);
}

// State-dependent objects, drawn over the painted backdrop. Positioned to match
// the painted layout (pelican on the front deck, skimmer at the pool's left).
function paintOverlays(ctx: CanvasRenderingContext2D, _t: number, state: GameState) {
  drawSprite(ctx, PELICAN_SPRITE, 48, 102, 1.8); // on the front deck, foreground

  // Mike White, lounging by the pool — until he proves the deep end has no bottom
  if (!state.flags.mikeGone) drawSprite(ctx, MIKE_SPRITE, 265, 80, 1.7);

  if (!state.flags.gotRod) {
    ctx.strokeStyle = "#9aa3ad";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(100, 124); ctx.lineTo(106, 86); ctx.stroke(); // pole
    ctx.fillStyle = "rgba(190,205,215,0.7)";
    ctx.fillRect(102, 84, 7, 5); // skimmer net, leaning at the pool's left edge
  }
  if (!state.flags.gotKey) {
    ctx.fillStyle = "rgba(235,225,160,0.8)";
    ctx.fillRect(150, 100, 3, 2); // key glint in the pool
  }
  if (state.flags.doorOpen) {
    ctx.fillStyle = "rgba(255,210,120,0.45)";
    ctx.fillRect(8, 48, 26, 44); // warm light spilling from the open villa door
  }
}
