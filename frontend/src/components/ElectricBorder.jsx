import { useId } from 'react';

/* An animated electric border, after the technique in
 * codepen.io/BalintFerenczy/pen/KwdoyEN.
 *
 * The trick is an SVG filter, not a drawn path: bands of fractal noise
 * scroll in four directions, get blended into one displacement map, and
 * that map pushes the pixels of a plain CSS border around. The border stays
 * an ordinary rounded rectangle in the DOM -- only its rasterisation is
 * distorted, which is why it follows any border-radius for free.
 *
 * Three copies are stacked: a crisp stroke, and two blurred ones for the
 * glow. They are drawn *over* the content, because the card inside has an
 * opaque background -- underneath it, the border is simply covered up. The
 * overlay is inert, so the card keeps its own hover, focus and clicks.
 */
export default function ElectricBorder({
  color = '#7df9ff',
  speed = 1,
  chaos = 0.12,
  thickness = 2,
  radius = 12,
  className = '',
  style,
  children,
}) {
  const filterId = useId().replace(/:/g, '');
  const dur = `${Math.max(6 / speed, 0.5)}s`;
  const scale = Math.round(chaos * 250);   // displacement strength

  const edge = {
    borderRadius: radius,
    borderWidth: thickness,
    borderColor: color,
  };

  return (
    <div className={`eb ${className}`.trim()}
         style={{ ...style, '--eb-color': color, borderRadius: radius }}>
      <svg className="eb-svg" aria-hidden="true" focusable="false">
        <defs>
          <filter id={filterId} colorInterpolationFilters="sRGB"
                  x="-25%" y="-25%" width="150%" height="150%">
            {/* one noise field, sampled twice per axis and scrolled in
                opposite directions, so the crackle never visibly loops */}
            <feTurbulence type="turbulence" baseFrequency="0.02"
                          numOctaves="10" seed="3" result="noise" />
            <feOffset in="noise" dx="0" dy="0" result="scrollY">
              <animate attributeName="dy" values="700;0" dur={dur}
                       repeatCount="indefinite" calcMode="linear" />
            </feOffset>
            <feOffset in="noise" dx="0" dy="0" result="scrollX">
              <animate attributeName="dx" values="0;490" dur={dur}
                       repeatCount="indefinite" calcMode="linear" />
            </feOffset>
            <feBlend in="scrollY" in2="scrollX" mode="screen" result="map" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={scale}
                               xChannelSelector="R" yChannelSelector="B" />
          </filter>
        </defs>
      </svg>

      <div className="eb-content">{children}</div>

      <div className="eb-layers" aria-hidden="true">
        <div className="eb-glow eb-glow--far"
             style={{ ...edge, filter: `url(#${filterId}) blur(9px)` }} />
        <div className="eb-glow eb-glow--near"
             style={{ ...edge, filter: `url(#${filterId}) blur(3px)` }} />
        <div className="eb-stroke" style={{ ...edge, filter: `url(#${filterId})` }} />
      </div>
    </div>
  );
}
