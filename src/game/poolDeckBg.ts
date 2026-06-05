// Painted pool-deck backdrop, baked as a base64 PNG data URL by
// `npm run gen:bg` (an image-gen model → downscaled to game resolution).
// Empty until generated → the room falls back to the procedural set.
//
// The backdrop is the static SET ONLY (villa, pool, deck, sky). State-dependent
// gameplay objects (pelican, pool skimmer, key glint, open-door glow) are drawn
// as overlays by the engine, NOT painted into this image.
export const POOL_DECK_BG = "";
