/* The signature visual, and the clearest statement of what the product
   does: one segment per skill the role asked for, solid where this person
   covers it and hollow where they don't. Reading the gap should not require
   reading a sentence. */
export default function CoverageMeter({ covered = [], missing = [] }) {
  const total = covered.length + missing.length;
  if (!total) return null;

  return (
    <div className="meter" role="img"
         aria-label={`covers ${covered.length} of ${total} skills this role asked for`}>
      <span className="segs">
        {covered.map(s => <span className="seg on" title={s} key={`on-${s}`} />)}
        {missing.map(s => <span className="seg off" title={`missing: ${s}`} key={`off-${s}`} />)}
      </span>
      <span className="meter-label">{covered.length}/{total} covered</span>
    </div>
  );
}
