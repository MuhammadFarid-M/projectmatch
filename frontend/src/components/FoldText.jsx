import { useId } from 'react';

/* FoldText — each letter swings down on a hinge, like a row of flaps.
 *
 * The reactbits original drives this with GSAP. It is a fixed transform per
 * character with a fixed offset between them, which CSS keyframes and a
 * per-character animation-delay express directly, so this needs no
 * animation library at all.
 *
 * Characters are grouped into words that stay unbreakable, so a long title
 * still wraps between words instead of splitting mid-word. The container
 * carries the real text as an aria-label and the pieces are hidden, so a
 * screen reader hears "My posts" rather than eight separate letters.
 *
 * `stagger` is a ceiling, not a fixed step: the whole wave is held inside
 * `spread` seconds. At a flat 45ms a short title reads well, but a ninety
 * character sentence would still be unfolding four seconds later, so the
 * step shrinks to fit as the string grows.
 */
export default function FoldText({
  text,
  hinge = 'top',
  duration = 0.65,
  stagger = 0.045,
  spread = 0.9,
  perspective = 700,
  creaseShading = 0.55,
  className = '',
}) {
  const uid = useId().replace(/:/g, '');
  const words = String(text ?? '').split(/(\s+)/);   // keep the spaces
  const steps = words.reduce(
    (n, w) => n + (/^\s+$/.test(w) ? 1 : [...w].length), 0);
  const step = Math.min(stagger, spread / Math.max(steps - 1, 1));

  let index = 0;
  return (
    <span
      className={`fold fold--${hinge} ${className}`.trim()}
      aria-label={String(text ?? '')}
      style={{
        perspective: `${perspective}px`,
        '--fold-dur': `${duration}s`,
        '--fold-shade': creaseShading,
      }}
    >
      {words.map((word, w) => {
        if (/^\s+$/.test(word)) {
          index += 1;
          return <span key={`${uid}-s${w}`} aria-hidden="true"> </span>;
        }
        return (
          <span className="fold__word" key={`${uid}-w${w}`} aria-hidden="true">
            {[...word].map((ch, c) => {
              const delay = index++ * step;
              return (
                <span className="fold__char" key={`${uid}-${w}-${c}`}
                      style={{ '--fold-delay': `${delay}s` }}>
                  {ch}
                </span>
              );
            })}
          </span>
        );
      })}
    </span>
  );
}
