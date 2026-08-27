import { HERO_INTERVAL, HERO_PIXEL, HERO_SWEEP } from '../heroCadence';
import PixelSwap from './PixelSwap';

/* The hero's background: a band of white pixels travelling left to right,
 * over the page's own colour and nothing else. Nothing accumulates -- each
 * tile lights and is gone, so the hero is never left sitting white.
 *
 * Both layers are the same empty surface, so the swap itself changes
 * nothing on screen. The wavefront is the whole effect: each aperture
 * carries a white tile that flashes and dissolves as it opens (.hero-tile
 * in style.css), which is what turns a content swap into a passing wave.
 *
 * `duration` has to stay inside `interval` or the next sweep is skipped --
 * 1900ms of travel inside a 2200ms cadence leaves that margin.
 */

const Page = () => <div className="hero-field" />;

export default function HeroBackdrop() {
  return (
    <div className="hero-bg" aria-hidden="true">
      <PixelSwap
        firstContent={<Page />}
        secondContent={<Page />}
        pixelSize={64}
        gap={0}
        pixelRadius={0}
        pixelSpin={0}
        pixelScale={0.5}
        duration={HERO_SWEEP}
        pixelDuration={HERO_PIXEL}
        pattern="left-to-right"
        randomness={0.12}
        trigger="auto"
        interval={HERO_INTERVAL}
      />
    </div>
  );
}
