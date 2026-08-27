import PixelSwap from './PixelSwap';

/* The hero's background: white pixels crossing left to right every three
 * seconds, over the page's own colour and nothing else.
 *
 * Both layers are the same empty surface, so the swap itself changes
 * nothing — what you see is the wavefront. Each aperture carries a white
 * tile that flashes and dissolves as it opens (see .hero-tile in
 * style.css), which is what turns a content swap into a travelling
 * shimmer without tinting the page.
 */

const Field = () => <div className="hero-field" />;

export default function HeroBackdrop() {
  return (
    <div className="hero-bg" aria-hidden="true">
      <PixelSwap
        firstContent={<Field />}
        secondContent={<Field />}
        pixelSize={64}
        gap={0}
        pixelRadius={0}
        pixelSpin={0}
        pixelScale={0.35}
        duration={1400}
        pixelDuration={450}
        pattern="left-to-right"
        randomness={0}
        trigger="auto"
        interval={3000}
      />
    </div>
  );
}
