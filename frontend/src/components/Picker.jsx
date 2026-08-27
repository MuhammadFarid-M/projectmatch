/* A controlled checkbox group. The old version rendered checkboxes into a
   form and let the browser collect them on submit; here the selection is
   state, which is what lets the same component back a skills list, a
   domains list, and the per-project pickers without knowing about any of
   them. */
export default function Picker({ options, selected = [], onChange }) {
  const chosen = new Set(selected);
  const toggle = option => onChange(
    chosen.has(option)
      ? selected.filter(o => o !== option)
      // Rebuild in the vocabulary's own order rather than click order, which
      // is what the browser did when these were checkboxes in a form. Values
      // that have since left the vocabulary are kept rather than quietly
      // dropped the first time somebody ticks something else.
      : [...selected.filter(o => !options.includes(o)),
         ...options.filter(o => chosen.has(o) || o === option)]
  );

  return (
    <div className="picker">
      {options.map(option => (
        <label key={option}>
          <input type="checkbox" checked={chosen.has(option)}
                 onChange={() => toggle(option)} />
          {' '}{option}
        </label>
      ))}
    </div>
  );
}
