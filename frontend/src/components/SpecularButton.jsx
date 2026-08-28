import { useRef } from 'react';

/* SpecularButton — a button whose chrome only exists while you are on it.
 *
 * At rest this is exactly the text it wraps. On hover a pill spawns around
 * it with a specular highlight that tracks the cursor: a bright spot on the
 * ring, brightest where the pointer is, fading around the curve.
 *
 * The ring and the fill are pseudo-elements *outset* from the text box
 * rather than padding on the button, so nothing in the row moves when they
 * appear -- a nav that shifts on hover is worse than no effect at all.
 *
 * Cursor position is written straight to CSS custom properties on the
 * node. Putting it in React state instead would re-render the whole nav on
 * every mousemove for something only the compositor needs.
 */
export default function SpecularButton({
  radius = 999,
  lineColor = '#4DE0F0',
  baseColor = 'rgba(77, 224, 240, .55)',
  tint = '#4DE0F0',
  tintOpacity = 0.12,
  shineSize = 58,
  insetX = 12,
  insetY = 7,
  thickness = 1,
  followMouse = true,
  textColor,
  className = '',
  onClick,
  children,
  ...rest
}) {
  const ref = useRef(null);

  const track = event => {
    if (!followMouse || !ref.current) return;
    const box = ref.current.getBoundingClientRect();
    ref.current.style.setProperty('--sb-x', `${event.clientX - box.left}px`);
    ref.current.style.setProperty('--sb-y', `${event.clientY - box.top}px`);
  };

  // Back to the middle on the way out, so the next hover starts neutral
  // rather than flashing the highlight wherever the cursor last was.
  const recentre = () => {
    ref.current?.style.setProperty('--sb-x', '50%');
    ref.current?.style.setProperty('--sb-y', '50%');
  };

  return (
    <button
      ref={ref}
      type="button"
      className={`specular ${className}`.trim()}
      onMouseMove={track}
      onMouseLeave={recentre}
      onClick={onClick}
      style={{
        '--sb-radius': `${radius}px`,
        '--sb-line': lineColor,
        '--sb-base': baseColor,
        '--sb-tint': tint,
        '--sb-tint-op': tintOpacity,
        '--sb-shine': `${shineSize}px`,
        '--sb-inset-x': `${-insetX}px`,
        '--sb-inset-y': `${-insetY}px`,
        '--sb-thickness': `${thickness}px`,
        color: textColor,
      }}
      {...rest}
    >
      <span className="specular__label">{children}</span>
    </button>
  );
}
