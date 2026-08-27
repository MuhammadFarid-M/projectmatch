import { useEffect, useRef } from 'react';
import PixelSwap from '../pixelswap';

/* Two phrases making the same argument from opposite ends: what the product
   does, and what it replaces. The accent word carries the meaning — green
   for what you gain, amber for the limitation you are stuck with today.

   PixelSwap owns the DOM inside this heading, so React is handed an empty
   element and told to keep out. destroy() on unmount cancels the timers. */

const HEADLINES = [
  { html: 'Find the people your team is <em>missing</em>.' },
  { html: 'Your next teammate isn’t in your <em class="alt">contacts</em>.' },
];

export default function PixelHeadline() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    const swap = new PixelSwap(el, {
      pixelSize: 34,
      gap: 2,
      pixelScale: 0.28,
      duration: 900,
      pixelDuration: 380,
      pattern: 'diagonal',
      randomness: 0.55,
      interval: 2000,        // time each phrase stays on screen
    });
    swap.start(HEADLINES);

    // destroy() cancels the timers but leaves the stage it appended, so
    // clear the element too -- otherwise React 18's double-invoked effects
    // in development would leave two headlines stacked on top of each other.
    return () => {
      swap.destroy();
      el.replaceChildren();
      el.classList.remove('pxs');
    };
  }, []);

  return <h1 ref={ref} />;
}
