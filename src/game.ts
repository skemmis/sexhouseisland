import type { ActionResult, Dialogue, GameState, Item, Room, Verb } from "./types";
import { flatFill } from "./pixels/sprite";
import { drawSprite } from "./pixels/render";
import { TEMPLATES } from "./pixels/templates";
import { makeBackdrop, drawBackdrop } from "./background";
import { POOL_DECK_BG } from "./game/poolDeckBg";
import { MIKE_SPRITE } from "./game/mikeSprite";
import { MIKE_PORTRAIT_IMG } from "./game/mikePortraitImg";
import { BEACH_BG } from "./game/beachBg";
import { CONTROL_BG } from "./game/controlBg";
import { BONNY_SPRITE } from "./game/bonnySprite";
import { BONNY_PORTRAIT_IMG } from "./game/bonnyPortraitImg";
import { MACK_SPRITE } from "./game/mackSprite";
import { MACK_PORTRAIT_IMG } from "./game/mackPortraitImg";

// A baked (no-API) pelican for set dressing, from the silhouette-template library.
const PELICAN_SPRITE = flatFill(TEMPLATES.pelican.template, TEMPLATES.pelican.defaultChoice);

// ============================================================================
//  GAME CONTENT  — this is the "authoring" layer. Everything here is data +
//  a little logic. A designer edits THIS file to make a game; the engine
//  (main.ts) never changes. This is where a real game grows: more rooms,
//  more hotspots, more puzzle logic in `interact()`.
// ============================================================================

export const ITEMS: Record<string, Item> = {
  rod:   { id: "rod",   name: "pool skimmer", icon: "rod" },
  key:   { id: "key",   name: "rusty key",   icon: "key" },
  towel: { id: "towel", name: "beach towel", icon: "towel" },
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
    {
      id: "towel",
      name: "beach towel",
      rect: { x: 296, y: 92, w: 22, h: 16 }, // folded on a lounger, far right
      walkTo: { x: 290, y: 126 },
      face: 1,
    },
    {
      id: "beachpath",
      name: "path to the beach",
      rect: { x: 0, y: 96, w: 14, h: 40 }, // off the left edge of the deck
      walkTo: { x: 12, y: 126 },
      face: -1,
      exit: { to: "beach", entry: { x: 300, y: 122 }, face: -1 },
    },
  ],
  paint: paintDock,
};

// ----------------------------------------------------------------------------
//  THE BEACH — Bonny is here, freezing, watching the red tide come in.
// ----------------------------------------------------------------------------
export const BEACH: Room = {
  id: "beach",
  floor: { minY: 116, maxY: 133, minScale: 0.8, maxScale: 1.15 },
  hotspots: [
    {
      id: "bonny",
      name: "Bonny",
      rect: { x: 150, y: 78, w: 30, h: 46 },
      walkTo: { x: 140, y: 128 },
      face: 1,
    },
    {
      id: "redtide",
      name: "the red tide",
      rect: { x: 40, y: 86, w: 240, h: 22 }, // the surf line
      walkTo: { x: 160, y: 126 },
      face: 0,
    },
    {
      id: "pooldeck",
      name: "way back to the pool",
      rect: { x: 0, y: 70, w: 30, h: 66 }, // the villa wall, left
      walkTo: { x: 18, y: 126 },
      face: -1,
      exit: { to: "dock", entry: { x: 18, y: 126 }, face: 1 },
    },
  ],
  paint: paintBeach,
};

// ----------------------------------------------------------------------------
//  THE CONTROL ROOM — behind the villa door. The show runs itself. Mackenzie
//  has broken in and is poking around.
// ----------------------------------------------------------------------------
export const CONTROL: Room = {
  id: "control",
  floor: { minY: 112, maxY: 132, minScale: 0.78, maxScale: 1.12 },
  hotspots: [
    {
      id: "terminal",
      name: "the producer's terminal",
      rect: { x: 132, y: 70, w: 56, h: 34 }, // the central screen/keyboard
      walkTo: { x: 160, y: 124 },
      face: 0,
    },
    {
      id: "screens",
      name: "the wall of feeds",
      rect: { x: 40, y: 30, w: 240, h: 40 },
      walkTo: { x: 160, y: 124 },
      face: 0,
    },
    {
      id: "mackenzie",
      name: "Mackenzie",
      rect: { x: 214, y: 78, w: 30, h: 46 },
      walkTo: { x: 224, y: 126 },
      face: 1,
    },
    {
      id: "pooldoor",
      name: "door to the pool deck",
      rect: { x: 0, y: 60, w: 30, h: 76 }, // the door, left
      walkTo: { x: 20, y: 126 },
      face: -1,
      exit: { to: "dock", entry: { x: 44, y: 120 }, face: 0 },
    },
  ],
  paint: paintControl,
};

export const ROOMS: Record<string, Room> = { dock: DOCK, beach: BEACH, control: CONTROL };

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

  // "Walk to" just approaches — only the door reacts to it (to step through).
  const walkTo = (verb as string) === "Walk to";
  if (walkTo && targetId !== "door") return {};

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
          say: ["The rusty key turns with a satisfying *clunk*.", "The 'villa' is open. Funny — it doesn't sound like a villa in there. It hums."],
          effect: (s) => { s.flags.doorOpen = true; },
        };
      }
      if (state.flags.doorOpen && (verb === "Open" || verb === "Use" || verb === "Push" || walkTo))
        return { say: ["I step through — and it isn't a villa at all."], goto: { room: "control", entry: { x: 26, y: 122 }, face: 1 } };
      if ((verb === "Open" || verb === "Use" || walkTo) && !state.flags.doorOpen)
        return { say: ["Locked. We're not allowed inside — that's the whole bit. I'll need a key."] };
      if (verb === "Look at") return { say: state.flags.doorOpen
        ? ["The open door. Beyond it isn't climate-controlled paradise. It's a low blue hum."]
        : ["The villa door. Climate-controlled paradise on the other side, supposedly. Locked, of course."] };
      return { say: [`I can't ${verb.toLowerCase()} the door.`] };

    case "towel":
      if (verb === "Pick up") {
        if (has("towel") || state.flags.gotTowel) return { say: ["I've already got the towel."] };
        return { say: ["A fluffy beach towel, abandoned on a lounger. Contraband, basically — it's nearly clothing."],
          effect: (s) => { s.inventory.push(ITEMS.towel); s.flags.gotTowel = true; } };
      }
      if (verb === "Look at") return { say: ["A beach towel. Soft, dry, warm. The single most powerful object on this island."] };
      return { say: [`I can't ${verb.toLowerCase()} the towel.`] };

    case "beachpath":
    case "pooldeck":
    case "pooldoor":
      if (verb === "Look at") return { say: ["The way through."] };
      return { say: ["I'll just walk there."] };

    case "redtide":
      if (verb === "Look at") return { say: ["The surf has a sickly red shimmer, creeping closer with the tide.", "Bonny would know what it is. Bonny knows everything."] };
      if (verb === "Use" || verb === "Pick up") return { say: ["I am not touching that water."] };
      return { say: [`I can't ${verb.toLowerCase()} the tide.`] };

    case "bonny":
      if (verb === "Give" && withItem === "towel") {
        return { say: ["Oh my GOD — yes. Thank you.", "Bonny wraps herself in the towel and finally stops shivering."],
          effect: (s) => {
            const i = s.inventory.findIndex((x) => x.id === "towel");
            if (i >= 0) s.inventory.splice(i, 1);
            s.flags.bonnyWarm = true;
          } };
      }
      if (verb === "Give" && withItem) return { say: [`Bonny doesn't want my ${itemName(withItem)}.`] };
      if (verb === "Look at") return { say: state.flags.bonnyWarm
        ? ["Bonny, mercifully towel-wrapped now. Twelve million followers and, it turns out, a marine-biology PhD."]
        : ["Bonny — Korean superinfluencer, twelve million followers, hugging herself against the cold. After dark they take everyone's clothes. 'Cardigans don't trend.'"] };
      if (verb === "Talk to") return { dialogue: bonnyDialogue(state) };
      return { say: [`I can't ${verb.toLowerCase()} Bonny.`] };

    case "mackenzie":
      if (verb === "Look at") return { say: ["Mackenzie. Brought nu-metal to a dating show and a grudge to a surveillance state. Currently elbow-deep in the producers' wiring."] };
      if (verb === "Talk to") return { dialogue: mackDialogue() };
      return { say: [`I can't ${verb.toLowerCase()} Mackenzie.`] };

    case "screens":
      if (verb === "Look at") return { say: ["Dozens of feeds: the pool, the beach, the loungers. Every angle of all of us, all the time.", "One screen is just... me. Right now. I wave. Screen-me waves back half a second later."] };
      return { say: [`I can't ${verb.toLowerCase()} the feeds.`] };

    case "terminal":
      if (verb === "Look at" || verb === "Use" || verb === "Pull" || verb === "Push") {
        return { say: [
          "The whole show runs off this one machine. No producers. No crew. No network. Just this.",
          "And there's a single instruction on the screen — the prompt steering all of it:",
          '"make it sexy. don\'t let anything get too unsexy."',
          "That's the entire creative direction. We're being run by an AI and one sentence.",
        ], effect: (s) => { s.flags.sawPrompt = true; s.won = true; } };
      }
      return { say: [`I can't ${verb.toLowerCase()} the terminal.`] };

    case "drone":
      if (verb === "Look at") return { say: ["A camera drone. It films everything. Right now it is filming me looking at it being filmed."] };
      if (verb === "Talk to") return { say: ["It doesn't answer. It only watches. The little red light blinks. Always the red light."] };
      if (verb === "Give") return { say: ["It wants nothing. It already has everything: footage of me."] };
      return { say: ["I swat at it. It bobs out of reach, unbothered. There is no getting rid of it."] };

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
                npc: ["Wait — only one way to find out!", "CANNONBALL!"],
                // Arm the dive; the engine waits until he's finished talking, then plays it.
                effect: (s) => { s.flags.mikeJumpPending = true; },
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

const BEACH_BACKDROP = makeBackdrop(BEACH_BG);
const CONTROL_BACKDROP = makeBackdrop(CONTROL_BG);

function paintBeach(ctx: CanvasRenderingContext2D, t: number, state: GameState) {
  if (!drawBackdrop(ctx, BEACH_BACKDROP, 0, 0, 320, 136)) { ctx.fillStyle = "#202b38"; ctx.fillRect(0, 0, 320, 136); }
  // Bonny, shivering by the shore (a tiny shiver wobble until she's warm)
  const shiver = state.flags.bonnyWarm ? 0 : Math.round(Math.sin(t * 22) * 0.7);
  drawSprite(ctx, BONNY_SPRITE, 152 + shiver, 80, 1.9);
}

function paintControl(ctx: CanvasRenderingContext2D, t: number, _state: GameState) {
  if (!drawBackdrop(ctx, CONTROL_BACKDROP, 0, 0, 320, 136)) { ctx.fillStyle = "#0f151c"; ctx.fillRect(0, 0, 320, 136); }
  // a faint blue screen-flicker across the monitor wall
  ctx.fillStyle = `rgba(120,170,210,${0.04 + 0.035 * Math.sin(t * 6)})`;
  ctx.fillRect(36, 26, 248, 46);
  drawSprite(ctx, MACK_SPRITE, 214, 80, 1.9); // Mackenzie, lurking by the racks
}

// ---- Conversations -------------------------------------------------------
function bonnyDialogue(state: GameState): Dialogue {
  if (!state.flags.bonnyWarm) {
    return { speakerPortrait: BONNY_PORTRAIT_IMG, start: "cold", nodes: {
      cold: { npc: [
        "S-sorry — I can't really f-focus, I'm so cold.",
        "They take your clothes at sunset. Apparently audiences don't 'connect with cardigans.'",
        "Find me a towel — anything — and I'll tell you what I know. And I know a lot.",
      ], choices: [ { text: "I'll find you a towel.", goto: "bye" }, { text: "What do you know?", goto: "teaser" } ] },
      teaser: { npc: ["Watch the water. That's all I've got until I can feel my hands. Towel. Please."], choices: [ { text: "On it.", goto: "bye" } ] },
      bye: { npc: ["Hurry? Please?"] },
    } };
  }
  return { speakerPortrait: BONNY_PORTRAIT_IMG, start: "warm", nodes: {
    warm: { npc: [
      "Okay. Bonny's Marine Minute, off the record.",
      "That red in the surf is Karenia brevis — a red-tide algae bloom.",
      "It releases brevetoxins. They aerosolize in the sea spray: burns your eyes and throat, kills the fish you can already smell.",
    ], choices: [
      { text: "Is it dangerous to us?", goto: "danger" },
      { text: "Why is it happening here?", goto: "why" },
      { text: "Twelve million followers, huh?", goto: "fame" },
      { text: "(Leave)", goto: "bye" },
    ] },
    danger: { npc: ["A few hours on a beach? Itchy and miserable. A whole cast sleeping outdoors with no clothes for a season? That's not a dating show, that's an exposure study with a hot tub."], choices: [ { text: "Tell me more.", goto: "warm" }, { text: "(Leave)", goto: "bye" } ] },
    why: { npc: ["Warm water, fertilizer runoff, and nobody at the wheel.", "Speaking of which — have you actually met a producer? Because I haven't. There's a door by the pool that hums."], choices: [ { text: "A door that hums?", goto: "door" }, { text: "(Leave)", goto: "bye" } ] },
    door: { npc: ["By the pool deck. Locked. Whatever runs this show is behind it.", "Get in there. I think you'll hate what you find — and you should."], choices: [ { text: "(Leave)", goto: "bye" } ] },
    fame: { npc: ["Twelve point three. I did a marine-biology PhD and the algorithm decided my niche was 'shivers prettily.' So. Here we are."], choices: [ { text: "(Leave)", goto: "bye" } ] },
    bye: { npc: ["Stay out of the spray."] },
  } };
}

function mackDialogue(): Dialogue {
  return { speakerPortrait: MACK_PORTRAIT_IMG, start: "hi", nodes: {
    hi: { npc: [
      "Oh good, another contestant. Welcome to the brain of the operation. It's basically a Raspberry Pi.",
      "There are no producers, dude. No network notes. There's this.",
    ], choices: [
      { text: "No producers? Explain.", goto: "auto" },
      { text: "What are you doing in here?", goto: "doing" },
      { text: "Nice... everything.", goto: "metal" },
      { text: "(Leave)", goto: "bye" },
    ] },
    auto: { npc: ["The whole show's automated. Casting, editing, who gets eliminated, when the lights go sexy-red — one model, end to end.", "Read the prompt on the terminal. Four lines. It's deranged."], choices: [ { text: "I'll read it.", goto: "bye" }, { text: "(Leave)", goto: "bye" } ] },
    doing: { npc: ["Looking for the off switch. There isn't one — just a feedback slider labeled SEXY, and it only goes up.", "I unplugged it once. It filmed me unplugging it and cut it into a redemption arc."], choices: [ { text: "Grim.", goto: "hi" }, { text: "(Leave)", goto: "bye" } ] },
    metal: { npc: ["Korn saved my life and this show is trying to undo it. I brought one real opinion in here and they keep editing me into 'the moody one.'"], choices: [ { text: "(Leave)", goto: "bye" } ] },
    bye: { npc: ["Read the prompt. Then try to unsee it."] },
  } };
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

  // Mike White, lounging by the pool — hidden once he's gone, or while the
  // dive cutscene is animating him (the engine draws the diving Mike then).
  if (!state.flags.mikeGone && !state.flags.mikeJumping) drawSprite(ctx, MIKE_SPRITE, 265, 80, 1.7);

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
