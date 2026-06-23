# Sex House Island — Season 50 promotional site

The official promo website for **Sex House Island**, the landmark 50th season of
the franchise: the first totally-autonomous season, an all-drone camera crew, an
AI-run house (**A.I.I.A.**), and a fully live (and fully fake) prediction-market
platform — all in cheesy bubblegum reality-TV packaging.

Built with **React + Vite + TypeScript**. No backend required — the markets are
simulated client-side.

## Run it

```bash
npm install
npm run dev        # open the printed localhost URL
npm run build      # production build → dist/
npm run preview    # serve the production build
```

## Pages

| Route        | What it is |
|--------------|------------|
| `/`          | Landing page: hero, cast teaser, the live **Markets** board, investor + ant teasers. |
| `/cast`      | **Meet the Cast** — the Season 50 contestants + host **A.I.I.A.** |
| `/markets`   | **Sex House Island Markets** — the full prediction-market board. |
| `/investors` | **For Investors** — the autonomous-season pitch, KPIs, risk factors. |
| `/ants`      | **An Update on the Ant Situation** — the ant + pelican transparency statement. |

## The Markets engine

`src/site/markets/` is a self-contained, client-side simulation:

- `MarketsProvider.tsx` ticks every ~1.1s, random-walking each market's implied
  probability, the market indices, the sexiness stack-rank, and a live feed of
  fake trades. Everything on the board reads from one React context (`useMarkets`).
- `seed.ts` holds the opening board state and copy; `types.ts` the data model.
- Charts (`components/Chart.tsx`) are hand-rolled SVG — no charting dependency.

## Cast & scene imagery

The glossy headshots and scene art in `public/img/cast` and `public/img` are
generated with Google's Gemini image model:

```bash
AI_INTEGRATIONS_GEMINI_API_KEY=... npm run gen:cast          # regenerate all
AI_INTEGRATIONS_GEMINI_API_KEY=... node scripts/gen-cast.mjs danni hero  # just some
```

See `scripts/gen-cast.mjs` for the prompts (and the box-downscale → JPEG step
that keeps the repo light).

## Note on the original game

This repo previously held a SCUMM-style point-and-click vertical slice. That
engine still lives under `src/` (`src/main.ts`, `src/game/`, etc.) but is no
longer part of the default build — the promo site is now the entry point.
