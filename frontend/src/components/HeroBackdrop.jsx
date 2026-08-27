import PixelSwap from './PixelSwap';

/* The hero's background, and an argument made without words.
 *
 * The field alternates between the two colours the whole product runs on:
 * amber for a gap, green for a skill covered. A wave crosses left to right
 * every two seconds turning one into the other, which is what the platform
 * does — you post the holes, and they get filled.
 *
 * It sits behind the headline, so it stays quiet: low alphas, no hard
 * edges, and a scrim over the top to keep text contrast where it needs to
 * be. The grid lines are drawn at the same 64px as `pixelSize`, so the wave
 * flips cells the eye can already see rather than an invisible lattice.
 */

const Field = ({ tone }) => <div className={`hero-field hero-field--${tone}`} />;

export default function HeroBackdrop() {
  return (
    <div className="hero-bg" aria-hidden="true">
      <PixelSwap
        firstContent={<Field tone="gap" />}
        secondContent={<Field tone="covered" />}
        pixelSize={64}
        gap={0}
        pixelRadius={0}
        pixelSpin={0}
        pixelScale={0.35}
        duration={1400}
        pixelDuration={450}
        pattern="left-to-right"
        randomness={0}
        fade
        trigger="auto"
        interval={2000}
      />
    </div>
  );
}
