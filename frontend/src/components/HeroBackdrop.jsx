import PixelSwap from './PixelSwap';

/* The hero's background: white pixels popping in at random until the area
 * is filled, then clearing back to the page again.
 *
 * This is PixelSwap used the way it is meant to be used. One layer is the
 * page's own background, the other is a white field, and the swap runs
 * both ways on a timer: fill, hold a beat, clear, hold a beat. The random
 * pattern is what makes tiles arrive scattered instead of in a front, and
 * the long pixelDuration against a soft pixelScale is what makes each one
 * grow in rather than snap.
 *
 * `duration` has to stay inside `interval` or the next sweep is skipped --
 * 2600ms of fill inside a 2900ms cadence leaves that margin.
 */

const Page = () => <div className="hero-field" />;
const White = () => <div className="hero-field hero-field--fill" />;

export default function HeroBackdrop() {
  return (
    <div className="hero-bg" aria-hidden="true">
      <PixelSwap
        firstContent={<Page />}
        secondContent={<White />}
        pixelSize={64}
        gap={0}
        pixelRadius={0}
        pixelSpin={0}
        pixelScale={0.5}
        duration={2600}
        pixelDuration={900}
        pattern="random"
        randomness={0}
        fade
        trigger="auto"
        interval={2900}
      />
    </div>
  );
}
