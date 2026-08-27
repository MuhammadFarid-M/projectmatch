import { useCallback, useEffect, useRef, useState } from 'react';

/* PixelSwap — the reactbits.dev effect, as a React component.
 *
 * Two layers of content occupy the same box. To swap them, the incoming
 * layer is cut into a grid of "pixels": each one is an overflow-hidden box
 * holding a full-size copy of that layer, offset by exactly its own
 * position, so every pixel is a window onto the same image locked to the
 * same origin. Each pixel opens from `pixelScale` to full size while its
 * copy scales by the reciprocal about the same point, so the image never
 * moves or distorts — only the aperture grows. Stagger the openings and
 * the new layer assembles itself out of the old one.
 *
 * The transform-origin on the inner copy is the aperture's centre expressed
 * in content coordinates. Two opposite scales about one shared point cancel
 * exactly; about two different points they would not, and the image would
 * visibly swim inside each pixel.
 *
 * `trigger` takes reactbits' "hover" and "click", plus "auto", which sweeps
 * on its own every `interval` ms.
 */

/* Each pattern returns 0..1 for a cell: its position in the running order.
   'left-to-right' with randomness 0 gives a clean vertical wavefront. */
const PATTERNS = {
  'left-to-right': ({ col, cols }) => (cols > 1 ? col / (cols - 1) : 0),
  'right-to-left': ({ col, cols }) => (cols > 1 ? 1 - col / (cols - 1) : 0),
  'top-to-bottom': ({ row, rows }) => (rows > 1 ? row / (rows - 1) : 0),
  diagonal: ({ col, row, cols, rows }) =>
    (col / Math.max(cols - 1, 1) + row / Math.max(rows - 1, 1)) / 2,
  center: ({ col, row, cols, rows }) => {
    const cx = (cols - 1) / 2;
    const cy = (rows - 1) / 2;
    return Math.hypot(col - cx, row - cy) / (Math.hypot(cx, cy) || 1);
  },
  random: () => Math.random(),
};

const MAX_PIXELS = 900;      // a ceiling on grid size, whatever the box
const clamp01 = v => Math.min(Math.max(v, 0), 1);

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* Lay the grid out once per sweep, so the running order stays fixed for the
   whole animation even when the pattern or randomness draws on Math.random. */
function buildPixels({ width, height, pixelSize, gap, pattern, randomness }) {
  const step = pixelSize + gap;
  const cols = Math.ceil(width / step);
  const rows = Math.ceil(height / step);
  if (cols < 1 || rows < 1 || cols * rows > MAX_PIXELS) return [];

  const order = PATTERNS[pattern] || PATTERNS['left-to-right'];
  const pixels = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * step;
      const y = row * step;
      const base = clamp01(order({ col, row, cols, rows }));
      // randomness pulls each cell away from its place in the pattern
      const offset = randomness > 0
        ? clamp01(base * (1 - randomness) + Math.random() * randomness)
        : base;
      pixels.push({
        key: `${row}-${col}`,
        x,
        y,
        w: Math.min(pixelSize, width - x),
        h: Math.min(pixelSize, height - y),
        offset,
      });
    }
  }
  return pixels;
}

export default function PixelSwap({
  firstContent,
  secondContent,
  pixelSize = 32,
  gap = 0,
  pixelRadius = 0,
  pixelSpin = 0,
  pixelScale = 0.35,
  duration = 1400,
  pixelDuration = 450,
  pattern = 'left-to-right',
  randomness = 0,
  fade = false,
  trigger = 'hover',
  interval = 2000,
  className = '',
  ...rest
}) {
  const hostRef = useRef(null);
  const timers = useRef([]);
  const phaseRef = useRef(0);        // read by the interval without re-arming it
  const busyRef = useRef(false);     // one sweep at a time

  const [phase, setPhase] = useState(0);   // which layer is at rest
  const [sweep, setSweep] = useState(null); // { to, pixels, width, height }

  const layers = [firstContent, secondContent];

  const settle = useCallback(next => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const swapTo = useCallback(next => {
    if (busyRef.current || next === phaseRef.current) return;

    const rect = hostRef.current?.getBoundingClientRect();
    const width = Math.round(rect?.width || 0);
    const height = Math.round(rect?.height || 0);

    // Nothing to cut up, or the viewer asked for less motion: just cut across.
    if (!width || !height || prefersReducedMotion()) return settle(next);

    const pixels = buildPixels({
      width, height, pixelSize, gap, pattern, randomness,
    });
    if (!pixels.length) return settle(next);

    busyRef.current = true;
    setSweep({ to: next, pixels, width, height });

    // The last cell starts at (duration - pixelDuration) and runs for
    // pixelDuration, so the sweep as a whole lands on `duration`.
    timers.current.push(setTimeout(() => {
      settle(next);
      setSweep(null);
      busyRef.current = false;
    }, duration + 40));
  }, [pixelSize, gap, pattern, randomness, duration, pixelDuration, settle]);

  // auto: keep sweeping back and forth without waiting to be touched
  useEffect(() => {
    if (trigger !== 'auto' || prefersReducedMotion()) return undefined;
    const id = setInterval(
      () => swapTo(phaseRef.current === 0 ? 1 : 0),
      interval,
    );
    return () => clearInterval(id);
  }, [trigger, interval, swapTo]);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const handlers = {};
  if (trigger === 'hover') {
    handlers.onMouseEnter = () => swapTo(1);
    handlers.onMouseLeave = () => swapTo(0);
  } else if (trigger === 'click') {
    handlers.onClick = () => swapTo(phase === 0 ? 1 : 0);
  }

  const spread = Math.max(duration - pixelDuration, 0);
  const timing = 'cubic-bezier(.22,.61,.36,1)';

  return (
    <div ref={hostRef} className={`pxs ${className}`.trim()} {...handlers} {...rest}>
      <div className="pxs__layer">{layers[phase]}</div>

      {sweep && (
        <div className="pxs__grid" aria-hidden="true">
          {sweep.pixels.map(p => {
            const delay = `${p.offset * spread}ms`;
            return (
              <span
                key={p.key}
                className="pxs__pixel"
                style={{
                  left: p.x,
                  top: p.y,
                  width: p.w,
                  height: p.h,
                  borderRadius: pixelRadius || undefined,
                  animation: `pxs-aperture ${pixelDuration}ms ${timing} ${delay} both`,
                  '--pxs-scale': pixelScale,
                  '--pxs-spin': `${pixelSpin}deg`,
                  '--pxs-opacity': fade ? 0 : 1,
                }}
              >
                <span
                  className="pxs__pixel-content"
                  style={{
                    left: -p.x,
                    top: -p.y,
                    width: sweep.width,
                    height: sweep.height,
                    // the aperture's centre, in this copy's own coordinates
                    transformOrigin: `${p.x + p.w / 2}px ${p.y + p.h / 2}px`,
                    animation: `pxs-content ${pixelDuration}ms ${timing} ${delay} both`,
                    '--pxs-scale': pixelScale,
                  }}
                >
                  {layers[sweep.to]}
                </span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
