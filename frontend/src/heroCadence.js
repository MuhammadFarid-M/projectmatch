/* One source of truth for the hero's timing, so the wave and the accent
   word cannot drift apart in the source. */

export const HERO_INTERVAL = 2200;   // a wave starts this often
export const HERO_SWEEP = 1900;      // how long one crossing takes
export const HERO_PIXEL = 700;       // one tile's own flash

/* The word sits about a third of the way across, so the front reaches it a
   little after each sweep begins. Flipping on that beat hides the turn
   behind the bright tiles instead of alongside them. The stagger spans
   HERO_SWEEP - HERO_PIXEL, which is the window the front actually travels
   in -- the remainder is the last tile finishing in place. */
export const FLIP_OFFSET = Math.round((HERO_SWEEP - HERO_PIXEL) * 0.38);
