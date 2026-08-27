import PixelSwap from './PixelSwap';

/* The hero's background: white pixels crossing left to right every three
 * seconds, over the page's own colour and nothing else.
 *
 * Both layers are the same empty surface, so the swap itself changes
 * nothing — what you see is the wavefront. Each aperture carries a white
 * tile that flashes and dissolves as it opens (see .hero-tile in
 * style.css), which is what turns a content swap into a travelling
 * shimmer without tinting the page.
 *
 * A little randomness softens the leading edge: at zero the wavefront is a
 * ruler-straight bar, which reads as a loading sweep rather than a wave.
 * The sweep still has to finish inside `interval`, or the next one is
 * skipped -- 1700ms of travel inside a 2000ms cadence leaves that margin.
 */

const Field = () => <div className="hero-field" />;

export default function HeroBackdrop() {
  return (
    <div className="hero-bg" aria-hidden="true">
      <PixelSwap
        firstContent={<Field />}
        secondContent={<Field />}
        pixelSize={40}
        gap={0}
        pixelRadius={0}
        pixelSpin={0}
        pixelScale={0.35}
        duration={1700}
        pixelDuration={760}
        pattern="left-to-right"
        randomness={0.12}
        trigger="auto"
        interval={2000}
      />
    </div>
  );
}
