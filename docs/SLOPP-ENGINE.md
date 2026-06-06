# SLOPP Engine — architecture & game-author contract

> A LucasArts-style point-and-click adventure engine. You author a game two ways,
> and they compose: **visual editors** for data (rooms, hotspots, walk areas,
> props, depth) and **code** (a `behavior.ts` an agent like Claude Code can
> write) for logic (puzzles, dialogue, cutscenes). The same AI pipeline that made
> this game (Nano Banana backdrops/portraits + PixelBench sprites + variant
> picker) is part of the engine.

## Monorepo layout (target)

```
slopp/                      # repo root — npm workspaces
  package.json              # workspaces: ["packages/*","games/*"]; root build/start delegate to the active game
  packages/
    engine/                 # @slopp/engine — everything reusable
      src/
        runtime.ts          # runGame(config): the main loop, input, rendering, UI
        character.ts spriteCharacter.ts   # movement, depth scaling, path following
        walk.ts             # walk masks + A* pathfinding
        cutscene.ts         # Cutscene timeline (beats) + arc/ease helpers
        background.ts pixelfont.ts pixels/*   # rendering primitives, sprite model
        dialogue.ts inventory.ts verbs.ts     # dialogue runtime, inventory, the 9 verbs
        editor/             # the room editor (mountEditor)
        server/             # hosting + /api/rooms persistence (file or Postgres)
        art/                # gen:bg, gen:variants, bake CLIs (Nano Banana + PixelBench)
        types.ts
      index.ts              # public barrel export
    create-game/            # (later) `npm create slopp-game` scaffold
  games/
    sexhouseisland/         # this game — CONTENT ONLY
      src/
        main.ts             # entry: builds GameConfig, calls runGame()
        behavior.ts         # interact() puzzle logic + dialogue trees (agent-authored)
        content.ts          # sprite registry, items, player assets, music, art direction
        cutscenes.ts        # game-specific cutscenes (e.g. Mike's dive)
        assets/             # baked backdrops/sprites/portraits (data URLs)
      rooms.json            # scene geometry (editor-owned)
      index.html editor.html
```

The contract: **`@slopp/engine` imports nothing game-specific.** A game is a package that hands the engine a `GameConfig`.

## The public API

```ts
import { runGame } from "@slopp/engine";

runGame({
  title: "Sex House Island",
  resolution: { width: 320, height: 200, sceneHeight: 136 }, // defaults

  // DATA (mostly editor-authored)
  rooms: () => fetch("/api/rooms").then(r => r.json()),       // or a bundled RoomsFile
  items,                       // Record<id, Item>
  sprites,                     // Record<key, PixelSprite>  (props + cast)
  player: { walk, portraitImg, cellBase: 2.0, fps: 8 },

  // BEHAVIOR (code — what an agent writes)
  newGame,                     // () => GameState
  behavior,                    // (verb, targetId, state, withItem?) => ActionResult

  // HOOKS (game-specific runtime bits that used to be hardcoded in the engine)
  cutscenes,                   // Record<name, (api) => Cutscene>  — e.g. Mike's dive
  update,                      // (dt, api) => void   — per-frame game logic (arm/trigger cutscenes)
  drawWorld,                   // (ctx, t, api) => void — extra draw over the scene (drone, diving Mike)
  winScreen,                   // (ctx, api) => void  — custom ending overlay
  music,                       // optional generative-music config
  artDirection,                // string fed to the AI art pipeline
});
```

`api` (passed to hooks) exposes the engine's safe surface: `state`, `player`,
`say(lines, opts)`, `changeRoom(to, entry, face)`, `startCutscene(name)`, plus
`VW`, `SCENE_H`, and the canvas `ctx`.

### What moved out of the engine into game hooks
- **Mike's dive** → `cutscenes.mikeDive` + `update` arms it when `mikeJumpPending`.
- **The camera drone** → `drawWorld` (a game overlay) + a `drone` behavior case.
- **The win screen text** → `winScreen`.
- **Art-direction string / palette** → `content.ts` (`artDirection`), passed to the art CLIs.
- **The soundtrack** → `music` config (engine provides the synth, game picks the tune).

## How an agent adds content (the "Claude Code can build a game" path)
- **New room:** add it in the editor (or to `rooms.json`); add a `backdrop` via `npm run gen:bg`; wire exits.
- **New hotspot:** place it in the editor with an `id`; add a `case "id":` in `behavior.ts`.
- **New character/prop:** `gen:variants` → pick → bake into the sprite registry; place via the editor's Sprites layer.
- **New dialogue:** a `Dialogue` tree returned from a `behavior` case (data-shaped, no engine changes).
- **New cutscene:** a `Cutscene` (list of timed beats) in `cutscenes.ts`, triggered from `behavior`/`update`.

## Migration phases (each commit stays green; Railway root scripts preserved)
1. **Seam inversion (in place):** introduce `runGame(config)`; move Mike/drone/win/music/art-direction out of the runtime into game hooks. No file moves yet — verifiable.
2. **Workspaces + physical split:** `git mv` engine modules → `packages/engine`, game → `games/sexhouseisland`; barrel export; fix import paths; point Vite root + server + `railway.json` at the game package via root scripts.
3. **Editor/server/art decoupled:** editor & server take the game's data path/registry via config (no game imports).
4. **Publish path (later):** version `@slopp/engine`, add `create-slopp-game`; a friend's game becomes its own repo depending on it.
