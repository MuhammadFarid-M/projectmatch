/* Small formatting decisions that more than one card makes. */

/* The score chip's colour. Kept as a class rather than a value so the
   palette lives entirely in style.css. */
export const scoreClass = n => (n >= 75 ? 'high' : n >= 45 ? '' : 'low');

/* "hackathon · 2026-09-14 · Chennai · remote ok" — the same one-line summary
   of a post, used on every card that shows one. */
export function postMeta(p) {
  return [
    p.event_type,
    p.starts_on,
    p.location,
    p.remote_ok ? 'remote ok' : null,
  ].filter(Boolean).join(' · ');
}

export const initial = name => (String(name || '?').trim()[0] || '?');

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
