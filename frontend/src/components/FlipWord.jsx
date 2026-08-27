import { useEffect, useState } from 'react';
import { FLIP_OFFSET, HERO_INTERVAL } from '../heroCadence';

/* The accent word turns over every few seconds: "missing" in green, then
 * "awaiting" in orange. Same sentence, two readings of it -- what the team
 * lacks, and what it is waiting for.
 *
 * It turns on the hero wave's cadence, offset so the flip lands while the
 * front of white tiles is passing over the word -- the turn happens under
 * the brightest part of the sweep rather than in the quiet after it.
 *
 * Both faces sit in one grid cell so the box is as wide as the longer word
 * and the line never reflows mid-flip. Each face carries its own full stop
 * so the punctuation travels with the word instead of being left stranded
 * against the wider box.
 */

const FACES = [
  { word: 'missing', tone: 'covered' },
  { word: 'awaiting', tone: 'gap' },
];

export default function FlipWord({
  interval = HERO_INTERVAL,
  offset = FLIP_OFFSET,
}) {
  const [turn, setTurn] = useState(0);

  useEffect(() => {
    let ticker;
    // PixelSwap's own first sweep lands one interval after mount, so the
    // first flip waits that long too, plus the offset into the crossing.
    const lead = setTimeout(() => {
      setTurn(t => t + 1);
      ticker = setInterval(() => setTurn(t => t + 1), interval);
    }, interval + offset);
    return () => { clearTimeout(lead); clearInterval(ticker); };
  }, [interval, offset]);

  const showingBack = turn % 2 === 1;

  return (
    <span className={`flip${showingBack ? ' flip--over' : ''}`}>
      {/* the live word for screen readers; the faces are decorative twins */}
      <span className="visually-hidden">{FACES[showingBack ? 1 : 0].word}.</span>
      {FACES.map(({ word, tone }, i) => (
        <span className={`flip__face flip__face--${i ? 'back' : 'front'}`}
              key={word} aria-hidden="true">
          <em className={`accent accent--${tone}`}>{word}</em>.
        </span>
      ))}
    </span>
  );
}
