import type { ActionResult, GameState, Item, Room, Verb } from "./types";

// ============================================================================
//  GAME CONTENT  — this is the "authoring" layer. Everything here is data +
//  a little logic. A designer edits THIS file to make a game; the engine
//  (main.ts) never changes. This is where a real game grows: more rooms,
//  more hotspots, more puzzle logic in `interact()`.
// ============================================================================

export const ITEMS: Record<string, Item> = {
  rod:  { id: "rod",  name: "fishing rod", icon: "rod" },
  key:  { id: "key",  name: "rusty key",   icon: "key" },
};

// ---- The one room: a moonlit dock. Painted procedurally; swap `paint` for a
//      loaded backdrop image in production. ----
export const DOCK: Room = {
  id: "dock",
  // Floor band: characters near the top of the band are "far" (small),
  // near the bottom are "near" (big). This is the SCUMM depth trick.
  floor: { minY: 96, maxY: 132, minScale: 0.7, maxScale: 1.15 },
  hotspots: [
    {
      id: "door",
      name: "tavern door",
      rect: { x: 28, y: 40, w: 34, h: 56 },
      walkTo: { x: 55, y: 100 },
      face: 0,
    },
    {
      id: "well",
      name: "wishing well",
      rect: { x: 150, y: 70, w: 44, h: 40 },
      walkTo: { x: 172, y: 116 },
      face: 0,
    },
    {
      id: "rod",
      name: "fishing rod",
      rect: { x: 250, y: 78, w: 10, h: 40 },
      walkTo: { x: 250, y: 120 },
      face: 1,
    },
    {
      id: "parrot",
      name: "parrot",
      rect: { x: 220, y: 56, w: 18, h: 18 },
      walkTo: { x: 224, y: 122 },
      face: 1,
    },
    {
      id: "sign",
      name: "weathered sign",
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
          say: ["A perfectly good fishing rod. Finders keepers."],
          effect: (s) => {
            s.inventory.push(ITEMS.rod);
            s.flags.gotRod = true;
          },
        };
      }
      if (verb === "Look at") return { say: ["A bamboo fishing rod, leaning by the crates."] };
      return { say: [`I can't ${verb.toLowerCase()} that.`] };

    case "well":
      if (verb === "Use" && withItem === "rod") {
        if (state.flags.gotKey)
          return { say: ["I've already fished everything good out of there."] };
        return {
          say: ["*plop*", "...", "Got a bite! It's... a rusty old key. Classy."],
          effect: (s) => {
            s.inventory.push(ITEMS.key);
            s.flags.gotKey = true;
          },
        };
      }
      if (verb === "Use" && withItem) return { say: [`Dunking the ${itemName(withItem)} in the well accomplishes nothing.`] };
      if (verb === "Look at") return { say: ["A wishing well. I can see something glinting at the bottom — too deep to reach by hand."] };
      if (verb === "Use") return { say: ["I'm not getting in there."] };
      return { say: [`I can't ${verb.toLowerCase()} the well.`] };

    case "door":
      if (verb === "Use" && withItem === "key") {
        return {
          say: ["The rusty key turns with a satisfying *clunk*. The tavern's open!"],
          effect: (s) => {
            s.flags.doorOpen = true;
            s.won = true;
          },
        };
      }
      if ((verb === "Open" || verb === "Use") && !state.flags.doorOpen)
        return { say: ["It's locked. I'll need a key."] };
      if (verb === "Open") return { say: ["It's already open."] };
      if (verb === "Look at") return { say: ["The door to the Scumm Bar. Locked, of course."] };
      return { say: [`I can't ${verb.toLowerCase()} the door.`] };

    case "parrot":
      if (verb === "Talk to")
        return {
          dialogue: {
            start: "hi",
            nodes: {
              hi: {
                npc: ["Squawk! Welcome to Sex House Island, ya scurvy intern!"],
                choices: [
                  { text: "How do I get into the tavern?", goto: "hint" },
                  { text: "Nice weather we're having.", goto: "weather" },
                  { text: "(Leave)", goto: "bye" },
                ],
              },
              hint: {
                npc: [
                  "Squawk! The barkeep dropped his key down the well years ago.",
                  "Too deep for an arm... but not for a good fishing line! Squawk!",
                ],
                choices: [{ text: "Thanks, bird.", goto: "hi" }],
              },
              weather: {
                npc: ["Squawk! It's a 2D painted backdrop. It's ALWAYS this weather."],
                choices: [{ text: "Fair point.", goto: "hi" }],
              },
              bye: { npc: ["Squawk! Don't get scurvy!"] },
            },
          },
        };
      if (verb === "Look at") return { say: ["A grubby parrot. It seems to know more than it lets on."] };
      if (verb === "Pick up") return { say: ["It pecks me. Hard. I'll pass."] };
      return { say: [`I can't ${verb.toLowerCase()} the parrot.`] };

    case "key":
      if (verb === "Look at") return { say: ["A rusty key, fresh from the well. It smells of wishes and pondscum."] };
      return { say: [`I can't ${verb.toLowerCase()} the key like that.`] };

    case "sign":
      if (verb === "Look at" || verb === "Use" || verb === "Pull")
        return { say: ['It reads: "SCUMM BAR — Grog, gossip, and questionable life choices."'] };
      return { say: [`I can't ${verb.toLowerCase()} the sign.`] };
  }

  return { say: [`I can't ${verb.toLowerCase()} that.`] };
}

function itemName(id: string) {
  return ITEMS[id]?.name ?? "thing";
}

// ============================================================================
//  PROCEDURAL BACKDROP. In production this becomes ctx.drawImage(bgImage,...).
//  Drawn in code here so the slice ships with zero image files.
// ============================================================================
function paintDock(ctx: CanvasRenderingContext2D, t: number, state: GameState) {
  // night sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, 96);
  sky.addColorStop(0, "#10131f");
  sky.addColorStop(1, "#39314f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 320, 96);

  // moon
  ctx.fillStyle = "#f0ecd0";
  ctx.beginPath();
  ctx.arc(280, 26, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#39314f";
  ctx.beginPath();
  ctx.arc(286, 22, 12, 0, Math.PI * 2);
  ctx.fill();

  // stars (deterministic twinkle)
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 40; i++) {
    const sx = (i * 71) % 320;
    const sy = (i * 37) % 70;
    if (Math.sin(t * 2 + i) > 0.3) ctx.fillRect(sx, sy, 1, 1);
  }

  // sea
  ctx.fillStyle = "#1d3a4a";
  ctx.fillRect(0, 70, 320, 20);
  ctx.fillStyle = "rgba(240,236,208,0.15)";
  for (let i = 0; i < 6; i++) {
    const wy = 72 + i * 3;
    ctx.fillRect((t * 8 + i * 40) % 320, wy, 10, 1);
  }

  // tavern wall (left)
  ctx.fillStyle = "#4a3b2a";
  ctx.fillRect(0, 30, 80, 70);
  ctx.fillStyle = "#3a2e20";
  ctx.fillRect(0, 28, 80, 4);
  // door
  ctx.fillStyle = state.flags.doorOpen ? "#1a1208" : "#2a2014";
  ctx.fillRect(28, 40, 34, 56);
  if (!state.flags.doorOpen) {
    ctx.fillStyle = "#caa54a";
    ctx.fillRect(54, 66, 3, 3); // doorknob
  } else {
    // warm light spilling out
    ctx.fillStyle = "rgba(255,200,90,0.35)";
    ctx.fillRect(28, 40, 34, 56);
  }
  // window
  ctx.fillStyle = "#caa54a";
  ctx.fillRect(8, 44, 14, 12);

  // dock planks (floor)
  ctx.fillStyle = "#6b4f33";
  ctx.fillRect(0, 90, 320, 46);
  ctx.fillStyle = "#5a4128";
  for (let x = 0; x < 320; x += 24) ctx.fillRect(x, 90, 2, 46);

  // wishing well
  ctx.fillStyle = "#777";
  ctx.fillRect(150, 86, 44, 24);
  ctx.fillStyle = "#555";
  ctx.fillRect(150, 86, 44, 6);
  ctx.fillStyle = "#1a1a22";
  ctx.fillRect(156, 90, 32, 16); // dark water
  if (!state.flags.gotKey) {
    ctx.fillStyle = "rgba(200,180,90,0.6)";
    ctx.fillRect(170, 100, 3, 2); // glint
  }
  // well roof
  ctx.fillStyle = "#5a3a22";
  ctx.fillRect(148, 70, 48, 4);
  ctx.beginPath();
  ctx.moveTo(150, 70); ctx.lineTo(172, 60); ctx.lineTo(194, 70);
  ctx.closePath();
  ctx.fill();

  // sign post
  ctx.fillStyle = "#4a3520";
  ctx.fillRect(104, 90, 4, 16);
  ctx.fillStyle = "#8a6a3a";
  ctx.fillRect(96, 78, 22, 14);

  // crates + fishing rod (right) — hide rod once taken
  ctx.fillStyle = "#6b4f33";
  ctx.fillRect(244, 96, 28, 18);
  ctx.strokeStyle = "#4a3520";
  ctx.strokeRect(244, 96, 28, 18);
  if (!state.flags.gotRod) {
    ctx.strokeStyle = "#c8b06a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(252, 116); ctx.lineTo(258, 78);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.moveTo(258, 78); ctx.lineTo(264, 96);
    ctx.stroke();
  }

  // parrot on a post
  ctx.fillStyle = "#3a2a18";
  ctx.fillRect(226, 74, 4, 16);
  ctx.fillStyle = "#c0392b";
  ctx.beginPath();
  ctx.ellipse(228, 64, 6, 8, 0, 0, Math.PI * 2); // body
  ctx.fill();
  ctx.fillStyle = "#2980b9";
  ctx.fillRect(231, 60, 4, 4); // head/wing accent
  ctx.fillStyle = "#f1c40f";
  ctx.fillRect(234, 62, 3, 2); // beak
}
