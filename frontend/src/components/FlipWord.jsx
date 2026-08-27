import { useEffect, useState } from 'react';

/* The accent word turns over every few seconds: "missing" in green, then
 * "awaiting" in orange. Same sentence, two readings of it -- what the team
 * lacks, and what it is waiting for.
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

export default function FlipWord({ interval = 4500 }) {
  const [turn, setTurn] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTurn(t => t + 1), interval);
    return () => clearInterval(id);
  }, [interval]);

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
