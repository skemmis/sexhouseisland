import type { ActionResult, Dialogue, GameState, Item, Room, RoomData, RoomsFile, Verb } from "./types";
import { drawSprite } from "./pixels/render";
import { makeBackdrop, drawBackdrop, type Backdrop } from "./background";
import { BACKDROPS } from "./game/assets";
import { SPRITES } from "./game/spriteRegistry";
import roomsData from "./game/rooms.json";
import { MIKE_SPRITE } from "./game/mikeSprite";
import { MIKE_PORTRAIT_IMG } from "./game/mikePortraitImg";
import { BONNY_PORTRAIT_IMG } from "./game/bonnyPortraitImg";
import { MACK_PORTRAIT_IMG } from "./game/mackPortraitImg";


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
  fish:  { id: "fish",  name: "dead fish",   icon: "fish" },
  drive: { id: "drive", name: "show hard drive", icon: "drive" },
};

// ----------------------------------------------------------------------------
//  ROOMS are assembled from data (src/game/rooms.json — the editor-owned scene
//  geometry) plus code hooks keyed by room id: the backdrop (resolved from a
//  key) and the dynamic overlay painter (sprites/effects). Behavior (interact,
//  below) is likewise keyed by hotspot id. So the editor can move any box
//  without touching logic, and logic never depends on coordinates.
// ----------------------------------------------------------------------------
const ROOMS_FILE = roomsData as RoomsFile;

const BG_CACHE: Record<string, Backdrop> = {};
const bgFor = (key: string) => (BG_CACHE[key] ??= makeBackdrop(BACKDROPS[key]));

// Per-room dynamic drawing (state-dependent sprites/effects), keyed by room id.
const OVERLAYS: Record<string, (ctx: CanvasRenderingContext2D, t: number, state: GameState) => void> = {
  dock: paintDockOverlays,
  control: paintControlOverlays,
  confessional: paintConfessionalOverlays,
  galley: paintGalleyOverlays,
  jetty: paintJettyOverlays,
};

// Draw a room's placed sprites (props) from data, respecting visibility flags.
function drawProps(ctx: CanvasRenderingContext2D, props: RoomData["props"], state: GameState) {
  if (!props) return;
  for (const p of props) {
    if (p.visibleWhen && !!state.flags[p.visibleWhen.flag] !== p.visibleWhen.is) continue;
    const sp = SPRITES[p.sprite];
    if (sp) drawSprite(ctx, sp, p.x, p.y, p.scale);
  }
}

function buildRoom(id: string, d: RoomData): Room {
  return {
    id,
    floor: d.floor,
    hotspots: d.hotspots,
    props: d.props,
    walk: d.walk,
    paint: (ctx, t, state) => {
      if (!drawBackdrop(ctx, bgFor(d.backdrop), 0, 0, 320, 136)) {
        ctx.fillStyle = "#0f151c";
        ctx.fillRect(0, 0, 320, 136);
      }
      drawProps(ctx, d.props, state); // editor-placed sprites
      OVERLAYS[id]?.(ctx, t, state); // procedural effects + dynamic Mike
    },
  };
}

function buildAll(f: RoomsFile): Record<string, Room> {
  return Object.fromEntries(Object.entries(f.rooms).map(([id, d]) => [id, buildRoom(id, d)]));
}

export let ROOMS: Record<string, Room> = buildAll(ROOMS_FILE);
export let START_ROOM = ROOMS_FILE.start.room;
export let START_POS = ROOMS_FILE.start.pos;

// Load live scene data from the server (the editor's edits) at startup; falls
// back to the bundled rooms.json offline / in the standalone single-file build.
export async function initScenes(): Promise<void> {
  try {
    const r = await fetch("/api/rooms");
    if (!r.ok) return;
    const f = (await r.json()) as RoomsFile;
    if (!f?.rooms || !f?.start) return;
    for (const k of Object.keys(BG_CACHE)) delete BG_CACHE[k];
    ROOMS = buildAll(f);
    START_ROOM = f.start.room;
    START_POS = f.start.pos;
  } catch { /* no server reachable — keep the bundled scenes */ }
}

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
        return { say: ["I step through — and it isn't a villa at all."], goto: { room: "control", entry: { x: 20, y: 126 }, face: 1 } };
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

    case "archway":
    case "pooldeck":
    case "pooldoor":
    case "confbooth":
    case "confcurtain":
    case "tojetty":
    case "beachback":
    case "galleydoor":
    case "boat":
      if (verb === "Look at") return { say: ["The way through."] };
      return { say: ["I'll just walk there."] };

    // ---- the confessional ----
    case "camera":
      if (verb === "Look at" || verb === "Use" || verb === "Pull") {
        return { say: [
          "The confession cam. A producer's sticky note is still stuck to the lens.",
          'It reads: BROADCAST PASSPHRASE — "make it sexy".',
          "Of course it's the prompt. It's always the prompt.",
        ], effect: (s) => { s.flags.sawPass = true; } };
      }
      return { say: [`I can't ${verb.toLowerCase()} the camera.`] };

    case "stool":
      if (verb === "Look at") return { say: ["The confession stool. Worn smooth by a hundred contestants crying on cue."] };
      if (verb === "Use" || verb === "Push" || verb === "Pull") return { say: ["I sit. The red light blinks. I have nothing to confess that the drone hasn't already filmed."] };
      return { say: [`I can't ${verb.toLowerCase()} the stool.`] };

    // ---- the galley ----
    case "freezer":
      if (verb === "Open" || verb === "Look at" || verb === "Pick up" || verb === "Use") {
        if (has("fish") || state.flags.gotFish) return { say: ["Just frost and a faint smell of regret now."] };
        return { say: ["The chest freezer hums. Inside, under a bag of 'SEXY ICE,' a single stiff dead fish.", "Red-tide casualty, probably. Mine now."],
          effect: (s) => { s.inventory.push(ITEMS.fish); s.flags.gotFish = true; } };
      }
      return { say: [`I can't ${verb.toLowerCase()} the freezer.`] };

    case "snacksign":
      if (verb === "Look at" || verb === "Use") return { say: ["A buzzing neon sign: SEXY SNACKS. Below it, an AI-printed menu: 'deconstructed seduction,' 'flirtini foam,' 'consent crudités.'"] };
      return { say: [`I can't ${verb.toLowerCase()} the sign.`] };

    // ---- the jetty ----
    case "trawler":
      if (verb === "Look at") return { say: ["A fishing trawler, anchored just offshore. Too far to hail. It hasn't moved in days. Maybe it's watching too."] };
      return { say: [`I can't ${verb.toLowerCase()} a boat that far away.`] };
    case "water":
      if (verb === "Look at") return { say: ["The red tide laps at the pilings. Dead fish turn slow circles in it. Bonny was right — you can smell the toxins."] };
      if (verb === "Use" || verb === "Pick up") return { say: ["Touching that water is how you become a cautionary segment."] };
      return { say: [`I can't ${verb.toLowerCase()} the water.`] };

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
      // Endgame: insert the show's hard drive AND know the passphrase to broadcast.
      if (verb === "Use" && withItem === "drive") {
        if (!state.flags.sawPass)
          return { say: ["The terminal accepts the hard drive, then asks for a broadcast passphrase.", "I don't have it. Somebody must have written it down somewhere — producers always do."] };
        return { say: [
          "I slot the hard drive in and type the passphrase: make it sexy.",
          "ACCESS GRANTED. Every episode, every feed, the prompt itself — I push it all to the live broadcast.",
          "Somewhere, a few million phones buzz at once with the truth about Sex House Island.",
        ], effect: (s) => { s.flags.broadcast = true; s.won = true; } };
      }
      if (verb === "Use" && withItem) return { say: [`The terminal has no use for my ${itemName(withItem)}.`] };
      if (verb === "Look at" || verb === "Use" || verb === "Pull" || verb === "Push") {
        return { say: [
          "The whole show runs off this one machine. No producers. No crew. No network. Just this.",
          "There's a single instruction on the screen — the prompt steering all of it:",
          '"make it sexy. don\'t let anything get too unsexy."',
          "I could BROADCAST all of it... but the drive's been pulled, and it'd want the producers' passphrase.",
        ], effect: (s) => { s.flags.sawPrompt = true; } };
      }
      return { say: [`I can't ${verb.toLowerCase()} the terminal.`] };

    case "drone":
      if (verb === "Look at") return { say: ["A camera drone. It films everything. Right now it is filming me looking at it being filmed."] };
      if (verb === "Talk to") return { say: ["It doesn't answer. It only watches. The little red light blinks. Always the red light."] };
      if (verb === "Give") return { say: ["It wants nothing. It already has everything: footage of me."] };
      return { say: ["I swat at it. It bobs out of reach, unbothered. There is no getting rid of it."] };

    case "parrot":
      if (verb === "Give" && withItem === "fish") {
        return { say: [
          "I offer the pelican the dead fish.",
          "It snaps the fish down whole — and, delighted, coughs up the thing it had been hoarding in that enormous pouch:",
          "a grimy little hard drive, stencilled SEX HOUSE ISLAND — PRODUCTION.",
        ], effect: (s) => {
          const i = s.inventory.findIndex((x) => x.id === "fish");
          if (i >= 0) s.inventory.splice(i, 1);
          s.inventory.push(ITEMS.drive); s.flags.gotDrive = true;
        } };
      }
      if (verb === "Give" && withItem) return { say: [`The pelican eyes my ${itemName(withItem)} and looks unimpressed. It wants something fishier.`] };
      if (verb === "Look at" && !state.flags.gotDrive) return { say: ["A large pelican. Its pouch bulges with something hard and rectangular. It has the smug look of a creature holding evidence."] };
      if (verb === "Talk to")
        return {
          dialogue: {
            start: "hi",
            nodes: {
              hi: {
                npc: ["Squawk! Welcome to Sex House Island. Season one hundred and something!"],
                choices: [
                  { text: "How do I get into the villa?", goto: "hint" },
                  { text: "What's in your pouch?", goto: "pouch" },
                  { text: "Why are we locked out?", goto: "lore" },
                  { text: "(Leave)", goto: "bye" },
                ],
              },
              pouch: {
                npc: [
                  "Squawk! MINE. Shiny. Rectangle. Hummmms. The producers want it BAD.",
                  "Bird does not share... unless bird is FED. A nice fish, maybe. A cold one. Squawk!",
                ],
                choices: [{ text: "Noted, bird.", goto: "hi" }],
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

    case "fish":
      if (verb === "Look at") return { say: ["A stiff dead fish, slightly freezer-burned. A red-tide casualty. Smells like leverage."] };
      return { say: [`I can't ${verb.toLowerCase()} the fish like that.`] };

    case "drive":
      if (verb === "Look at") return { say: ["The show's production hard drive, warm and faintly humming. Everything they've ever filmed is on here. Everything WE'VE ever done is on here."] };
      return { say: [`Better to use the hard drive ON something.`] };

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
//  OVERLAYS. State-dependent sprites/effects drawn ON TOP of each room's painted
//  backdrop (the Monkey Island model: the static image never changes; gameplay
//  objects ride above it). Keyed by room id in OVERLAYS above. Positions here
//  are still code for now — placing these visually is a later editor iteration.
// ============================================================================
function paintControlOverlays(ctx: CanvasRenderingContext2D, t: number, _state: GameState) {
  // a faint blue screen-flicker across the monitor wall (Mackenzie is a prop now)
  ctx.fillStyle = `rgba(120,170,210,${0.04 + 0.035 * Math.sin(t * 6)})`;
  ctx.fillRect(36, 26, 248, 46);
}

function paintConfessionalOverlays(ctx: CanvasRenderingContext2D, t: number, _state: GameState) {
  // the camera's red record light, blinking
  if (Math.sin(t * 4) > 0) { ctx.fillStyle = "rgba(255,60,50,0.9)"; ctx.fillRect(206, 52, 2, 2); }
}

function paintGalleyOverlays(ctx: CanvasRenderingContext2D, t: number, state: GameState) {
  // cold blue glow spilling from the open freezer (dimmer once the fish is gone)
  const g = (state.flags.gotFish ? 0.06 : 0.13) + 0.03 * Math.sin(t * 5);
  ctx.fillStyle = `rgba(150,210,235,${g})`;
  ctx.fillRect(126, 60, 74, 30);
}

function paintJettyOverlays(ctx: CanvasRenderingContext2D, t: number, _state: GameState) {
  // a few drifting glints on the red-tide water
  ctx.fillStyle = "rgba(220,120,120,0.5)";
  for (let i = 0; i < 5; i++) ctx.fillRect(50 + ((t * 8 + i * 60) % 240), 70 + (i % 3) * 3, 4, 1);
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


// State-dependent objects, drawn over the painted backdrop. Positioned to match
// the painted layout (pelican on the front deck, skimmer at the pool's left).
function paintDockOverlays(ctx: CanvasRenderingContext2D, _t: number, state: GameState) {
  // (pelican + towel are props now; placed in the editor.)

  // Mike White, lounging by the pool — hidden once he's gone, or while the
  // dive cutscene is animating him (the engine draws the diving Mike then). Stays
  // in code because his position is driven by the cutscene, not static.
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
