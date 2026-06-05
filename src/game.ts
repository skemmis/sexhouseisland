import type { ActionResult, GameState, Item, Room, Verb } from "./types";
import { flatFill } from "./pixels/sprite";
import { drawSprite } from "./pixels/render";
import { TEMPLATES } from "./pixels/templates";
import { makeBackdrop, drawBackdrop } from "./background";
import { POOL_DECK_BG } from "./game/poolDeckBg";

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

// ---- The one room: the Sex House Island pool deck at dusk. Painted
//      procedurally; swap `paint` for a loaded backdrop image in production. ----
export const DOCK: Room = {
  id: "dock",
  // Floor band: characters near the top of the band are "far" (small),
  // near the bottom are "near" (big). This is the SCUMM depth trick.
  floor: { minY: 96, maxY: 132, minScale: 0.7, maxScale: 1.15 },
  hotspots: [
    {
      id: "door",
      name: "villa door",
      rect: { x: 28, y: 40, w: 34, h: 56 },
      walkTo: { x: 55, y: 100 },
      face: 0,
    },
    {
      id: "well",
      name: "the deep end",
      rect: { x: 150, y: 70, w: 44, h: 40 },
      walkTo: { x: 172, y: 116 },
      face: 0,
    },
    {
      id: "rod",
      name: "pool skimmer",
      rect: { x: 250, y: 78, w: 10, h: 40 },
      walkTo: { x: 250, y: 120 },
      face: 1,
    },
    {
      id: "parrot",
      name: "pelican",
      rect: { x: 218, y: 50, w: 22, h: 26 },
      walkTo: { x: 224, y: 122 },
      face: 1,
    },
    {
      id: "sign",
      name: "the sign",
      rect: { x: 96, y: 78, w: 22, h: 24 },
      walkTo: { x: 107, y: 118 },
      face: 0,
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

    case "key":
      if (verb === "Look at") return { say: ["A rusty key, fresh from the deep end. It smells of chlorine and despair."] };
      return { say: [`I can't ${verb.toLowerCase()} the key like that.`] };

    case "sign":
      if (verb === "Look at" || verb === "Use" || verb === "Pull")
        return { say: ['It reads: "SEX HOUSE ISLAND — the show that lets you keep your phone."'] };
      return { say: [`I can't ${verb.toLowerCase()} the sign.`] };
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

// State-dependent objects, drawn over whichever backdrop is in use.
function paintOverlays(ctx: CanvasRenderingContext2D, _t: number, state: GameState) {
  drawSprite(ctx, PELICAN_SPRITE, 214, 48, 1.6);

  if (!state.flags.gotRod) {
    ctx.strokeStyle = "#9aa3ad";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(252, 116); ctx.lineTo(258, 78); ctx.stroke();
    ctx.fillStyle = "rgba(180,200,210,0.6)";
    ctx.fillRect(256, 76, 6, 5); // skimmer net
  }
  if (!state.flags.gotKey) {
    ctx.fillStyle = "rgba(220,210,150,0.7)";
    ctx.fillRect(170, 101, 3, 2); // key glint
  }
  if (state.flags.doorOpen) {
    ctx.fillStyle = "rgba(255,210,120,0.4)";
    ctx.fillRect(28, 40, 34, 56); // warm light spilling from the open villa
  }
}
