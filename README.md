# Sex House Island — a SCUMM-style vertical slice

A lightweight, vibe-coded proof-of-concept for an 80s/90s LucasArts-style
point-and-click adventure, built with **TypeScript + HTML5 Canvas**, no
framework. It exists to answer one question: *how feasible is this, really?*

**Answer: the engine is the easy part. This whole slice is ~600 lines.**

## Run it

```bash
npm install
npm run dev      # open the printed localhost URL
```

## What the slice proves (the full SCUMM loop, end-to-end)

- **A walkable room** with a painted backdrop and a walkable floor band.
- **Depth scaling** — the character shrinks as they walk "into" the screen
  (the classic LucasArts trick), see `Character.scaleIn()`.
- **The 9-verb interface** (Give / Open / Close / Pick up / Look at / Talk to /
  Use / Push / Pull) + a sentence line that reads like the real thing.
- **Hotspots** with per-object walk-to points.
- **Inventory** + **"Use X on Y"** combination logic.
- **A dialogue tree** (talk to the parrot).
- **A real 3-step puzzle** with a win state:
  1. *Pick up* the fishing rod.
  2. *Use* the rod on the wishing well → fish out a rusty key.
  3. *Use* the key on the tavern door → you're in. 🎉
  The parrot hints the solution if you *Talk to* it.

## The thing you were worried about: animation assets

There are **zero art files in this repo.** The character's walk cycle, idle
bob, facing, and talk-flap are all **drawn in code** (`src/character.ts`).
That's deliberate — it lets the *engine* run and be felt before a single
sprite is authored, which is exactly how you de-risk the art question.

### Where AI-generated pixel art drops in

The architecture cleanly separates **engine** from **assets**:

| Procedural placeholder (today)        | Production swap (later)                         |
|---------------------------------------|------------------------------------------------|
| `Character.draw()` draws a stick-ish hero | `ctx.drawImage(walkSheet, frame.sx, …)` from a sprite sheet |
| `room.paint()` paints the dock in code    | `ctx.drawImage(backgroundImage, 0, 0)`          |
| `drawIcon()` draws inventory icons        | blit from an item atlas                          |

Nothing else changes — pathing, depth scale, facing, verbs, and puzzle logic
all stay identical. A realistic per-character art budget for this style is
~15–25 small frames (walk = 3 directions × ~8 frames with mirroring, plus
idle + a 2-frame talk flap). That's the actual scope of the "scary" part.

## File map

| File | Role |
|------|------|
| `src/types.ts`     | The data model (rooms, hotspots, items, dialogue). |
| `src/game.ts`      | **Authoring layer** — the room, the puzzle, dialogue. Edit this to make a game. |
| `src/character.ts` | The player + procedural animation (the asset-swap seam). |
| `src/main.ts`      | **Engine** — input, verb bar, inventory, dialogue UI, game loop. Game-agnostic. |

## Honest caveats

The hard parts of shipping a *real* one aren't here and aren't engine work:
**art coherence**, **reliable pixel-art generation** (consistent character
identity across frames is where current image models struggle), and **writing
/ puzzle design** (hand-authored — the genre lives or dies on it).
