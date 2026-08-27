import { useState } from 'react';
import Picker from './Picker';

/* Creating a post and editing one are the same form over the same fields;
   the only real difference is that an edit has slots that somebody already
   took, and those are locked. Requirements you can still rewrite are the
   ones nobody has been accepted into.

   A post is a set of slots, and that is the modelling decision the whole
   product rests on: filling one slot rescores the rest against a smaller
   gap. So roles are edited as a list here, not as a single "skills needed"
   blob. */

let rowSeq = 0;
const blankSlot = (vocab, slot) => ({
  uid: ++rowSeq,
  id: slot?.id ?? null,
  role: slot?.role ?? vocab.roles[0],
  min_level: slot?.min_level ?? 'intermediate',
  must_have: slot?.must_have ?? [],
  nice_to_have: slot?.nice_to_have ?? [],
});

const str = v => (v == null ? '' : String(v));

function SlotBlock({ index, slot, vocab, onChange, onRemove }) {
  const set = (k, v) => onChange({ ...slot, [k]: v });
  return (
    <div className="slot-block">
      <label>Role {index + 1}</label>
      <select value={slot.role} onChange={e => set('role', e.target.value)}>
        {vocab.roles.map(r => <option key={r} value={r}>{r}</option>)}
      </select>

      <label>Minimum experience level</label>
      <select value={slot.min_level} onChange={e => set('min_level', e.target.value)}>
        {vocab.levels.map(l => <option key={l} value={l}>{l}</option>)}
      </select>

      <label>Must-have skills — weighted double</label>
      <Picker options={vocab.skills} selected={slot.must_have}
              onChange={v => set('must_have', v)} />

      <label>Nice-to-have skills</label>
      <Picker options={vocab.skills} selected={slot.nice_to_have}
              onChange={v => set('nice_to_have', v)} />

      <button type="button" className="linkish" onClick={onRemove}>
        remove this role
      </button>
    </div>
  );
}

function FilledSlot({ slot }) {
  return (
    <div className="slot-block" style={{ opacity: 0.75 }}>
      <h3>{slot.role} <span className="pill filled">filled</span></h3>
      <div className="meta">This role is taken, so its requirements are locked.</div>
    </div>
  );
}

export default function PostForm({ post, vocab, submitting, onSubmit }) {
  const editing = !!post;
  const filled = (post?.slots || []).filter(s => s.filled_by);
  const openSlots = (post?.slots || []).filter(s => !s.filled_by);

  const [form, setForm] = useState(() => ({
    title: str(post?.title),
    description: str(post?.description),
    event_type: str(post?.event_type) || vocab.event_types[0],
    hours_needed: post?.hours_needed ?? 20,
    domains: post?.domains || [],
    starts_on: str(post?.starts_on),
    ends_on: str(post?.ends_on),
    location: str(post?.location),
    remote_ok: !!post?.remote_ok,
    slots: openSlots.length
      ? openSlots.map(s => blankSlot(vocab, s))
      : [blankSlot(vocab)],
  }));

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const field = k => ({ value: form[k], onChange: e => set(k, e.target.value) });

  const setSlot = (uid, next) => set('slots',
    form.slots.map(s => (s.uid === uid ? next : s)));
  const removeSlot = uid => set('slots', form.slots.filter(s => s.uid !== uid));
  const addSlot = () => set('slots', [...form.slots, blankSlot(vocab)]);

  function submit(e) {
    e.preventDefault();
    // uid is a React list key; id is null on a slot that doesn't exist yet.
    onSubmit({
      ...form,
      slots: form.slots.map(({ uid, ...rest }) => rest),
    });
  }

  return (
    <form onSubmit={submit}>
      <label>Title</label>
      <input type="text" required {...field('title')}
             placeholder="Need a frontend dev for next week's hackathon" />

      <label>Description</label>
      <textarea {...field('description')}
        placeholder="What you're building, what's already handled, team size." />

      <div className="row">
        <div>
          <label>Event type</label>
          <select {...field('event_type')}>
            {vocab.event_types.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div>
          <label>Hours per week needed</label>
          <input type="number" min="0" max="80" {...field('hours_needed')} />
        </div>
      </div>

      <label>
        {editing ? 'Domains'
          : 'Domains — used to match people who care about the same problems'}
      </label>
      <Picker options={vocab.domains} selected={form.domains}
              onChange={v => set('domains', v)} />

      <div className="row">
        <div><label>Starts on</label>
          <input type="date" required {...field('starts_on')} /></div>
        <div><label>Ends on</label>
          <input type="date" {...field('ends_on')} /></div>
      </div>

      <label>City</label>
      <input type="text" {...field('location')} placeholder="Chennai" />
      <label className="inline-check">
        <input type="checkbox" checked={form.remote_ok}
               onChange={e => set('remote_ok', e.target.checked)} /> Remote is fine
      </label>

      <h2>{editing ? 'Roles' : 'Roles you need'}</h2>
      {filled.map(s => <FilledSlot key={s.id} slot={s} />)}
      {form.slots.map((s, i) => (
        <SlotBlock key={s.uid} index={i} slot={s} vocab={vocab}
                   onChange={next => setSlot(s.uid, next)}
                   onRemove={() => removeSlot(s.uid)} />
      ))}
      <button type="button" className="ghost" onClick={addSlot}>
        + Add another role
      </button>

      <div className="actions">
        <button disabled={submitting}>
          {submitting ? 'Saving…'
            : editing ? 'Save changes' : 'Publish and see matches'}
        </button>
      </div>
    </form>
  );
}
