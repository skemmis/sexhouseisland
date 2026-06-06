// Painted title-screen backdrop. Generate on-brand art into this file with:
//
//   BG_PROVIDER=gemini GEMINI_API_KEY=... npm run gen:bg -- \
//     "Title-screen establishing shot of SEX HOUSE ISLAND: a lavish tropical reality-TV villa on a small island seen from across the lagoon at dusk; early-night sky with a few stars and a warm sunset glow on the horizon; the villa's windows glowing warm amber; palm silhouettes; calm reflective water with a warm moonlight trail; cinematic wide LucasArts title composition. Keep the upper-center and lower third relatively open for a title logo and menu." \
//     --provider gemini --module src/game/titleBg.ts --var TITLE_BG --w 320 --h 200 --aspect 16:9    # center-cropped to the 320x200 title frame
//
// Until then TITLE_BG is empty and the engine falls back to procedural art.
export const TITLE_BG = "";
