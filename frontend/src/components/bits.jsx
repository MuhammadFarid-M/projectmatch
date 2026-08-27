/* The small repeated pieces: notices, empty states, tag rows, the score
   chip and its breakdown. Nothing here holds state that outlives a render
   except the breakdown toggle, which belongs to the card that owns it. */
import { scoreClass } from '../format';

export const Notice = ({ tone = '', children }) =>
  <div className={`notice ${tone}`.trim()}>{children}</div>;

export const Empty = ({ children }) => <div className="empty">{children}</div>;

/* must-have skills read as solid, nice-to-haves and domains as quiet, and
   anything missing as a dashed outline. */
export const Tags = ({ must = [], plain = [], missing = [] }) => (
  <div className="tags">
    {must.map(t => <span className="tag must" key={`m${t}`}>{t}</span>)}
    {plain.map(t => <span className="tag" key={`p${t}`}>{t}</span>)}
    {missing.map(t => <span className="tag miss" key={`x${t}`}>{t}</span>)}
  </div>
);

/* A score with no breakdown behind it is not a button — the old markup used
   a <span> for exactly that case and the CSS still distinguishes them. */
export function Score({ value, onToggle, open, controls }) {
  if (value == null) return null;
  const cls = `score ${scoreClass(value)}${open ? ' lit' : ''}`.trim();
  if (!onToggle) return <span className={cls}>{value}%</span>;
  return (
    <button type="button" className={cls} onClick={onToggle}
            aria-expanded={open} aria-controls={controls}>
      {value}%
    </button>
  );
}

/* Every ranking shows its working. Component weights are fixed in match.py;
   what varies per candidate is how much of each they earned. */
export function Breakdown({ breakdown, open, id, onToggle }) {
  if (!breakdown) return null;
  return (
    <>
      <button type="button" className="linkish" onClick={onToggle}
              aria-expanded={open} aria-controls={id}>
        why this score?
      </button>
      <div className={`breakdown${open ? ' open' : ''}`} id={id}>
        {Object.entries(breakdown).map(([label, value]) => (
          <div className="bar-row" key={label}>
            <span>{label}</span>
            <div className="bar"><span style={{ width: `${value}%` }} /></div>
            <span>{value}%</span>
          </div>
        ))}
      </div>
    </>
  );
}

export const ExternalLinks = ({ github, linkedin, email }) => {
  const parts = [];
  if (github) parts.push(<a href={github} target="_blank" rel="noopener" key="g">GitHub</a>);
  if (linkedin) parts.push(<a href={linkedin} target="_blank" rel="noopener" key="l">LinkedIn</a>);
  if (email) parts.push(<strong key="e">{email}</strong>);
  return parts.length ? (
    <>{parts.map((el, i) => <span key={i}>{i > 0 && ' · '}{el}</span>)}</>
  ) : null;
};
