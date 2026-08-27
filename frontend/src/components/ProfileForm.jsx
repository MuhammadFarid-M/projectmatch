import { useState } from 'react';
import Picker from './Picker';

/* The profile form, in both the guided first-run arrangement and the plain
   edit arrangement.

   These were two near-identical HTML pages. They are one component with two
   orderings now, because every field on them feeds the same scoring engine
   and a field that drifts between the two is a field that silently stops
   matching. What differs is deliberate: onboarding groups the fields under
   headings, explains what each one buys you, and insists on availability,
   because a profile with no dates is invisible to every hard filter. */

const str = v => (v == null ? '' : String(v));

let rowSeq = 0;
const blankProject = () => ({
  uid: ++rowSeq, title: '', outcome: '', duration: '', link: '',
  skills: [], domains: [],
});

export function toFormState(user) {
  const projects = (user.past_projects || []).map(p => ({ ...blankProject(), ...p }));
  return {
    name: str(user.name),
    bio: str(user.bio),
    role: str(user.role),
    experience_level: str(user.experience_level),
    skills: user.skills || [],
    interests: user.interests || [],
    available_from: str(user.available_from),
    available_to: str(user.available_to),
    hours_per_week: user.hours_per_week ?? 0,
    location: str(user.location),
    remote_ok: !!user.remote_ok,
    willing_to_travel: !!user.willing_to_travel,
    open_to_join: !!user.open_to_join,
    github: str(user.github),
    linkedin: str(user.linkedin),
    past_projects: projects.length ? projects : [blankProject()],
  };
}

function ProjectRow({ project, vocab, onChange, onRemove }) {
  const set = (k, v) => onChange({ ...project, [k]: v });
  return (
    <div className="slot-block">
      <label>Project title</label>
      <input type="text" value={project.title}
             onChange={e => set('title', e.target.value)}
             placeholder="SOC alert triage dashboard" />

      <div className="row">
        <div>
          <label>How far did it get?</label>
          <select value={project.outcome || vocab.outcomes[0]}
                  onChange={e => set('outcome', e.target.value)}>
            {vocab.outcomes.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label>How long did it run?</label>
          <select value={project.duration || vocab.durations[0]}
                  onChange={e => set('duration', e.target.value)}>
            {vocab.durations.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <label>Link to the repo or a live version</label>
      <input type="text" value={project.link}
             onChange={e => set('link', e.target.value)}
             placeholder="https://github.com/…" />

      <label>Skills you used on it</label>
      <Picker options={vocab.skills} selected={project.skills}
              onChange={v => set('skills', v)} />

      <label>Domain it was in</label>
      <Picker options={vocab.domains} selected={project.domains}
              onChange={v => set('domains', v)} />

      <button type="button" className="linkish" onClick={onRemove}>
        remove this project
      </button>
    </div>
  );
}

export default function ProfileForm({ initial, vocab, guided, submitting, onSubmit }) {
  const [form, setForm] = useState(() => toFormState(initial));
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const field = k => ({ value: form[k], onChange: e => set(k, e.target.value) });
  const check = k => ({
    type: 'checkbox', checked: form[k],
    onChange: e => set(k, e.target.checked),
  });

  const setProject = (uid, next) => set('past_projects',
    form.past_projects.map(p => (p.uid === uid ? next : p)));
  const removeProject = uid => set('past_projects',
    form.past_projects.filter(p => p.uid !== uid));
  const addProject = () => set('past_projects', [...form.past_projects, blankProject()]);

  function submit(e) {
    e.preventDefault();
    // uid is a React list key, not part of the profile.
    onSubmit({
      ...form,
      past_projects: form.past_projects.map(({ uid, ...rest }) => rest),
    });
  }

  const identity = (
    <>
      <label>Name</label>
      <input type="text" required {...field('name')} />

      <label>{guided ? 'A couple of lines about yourself' : 'Short description'}</label>
      <textarea {...field('bio')}
        placeholder={guided
          ? "What you build, and what kind of team you're looking for."
          : "A couple of lines about what you build and what you're looking for."} />

      <div className="row">
        <div>
          <label>Primary role</label>
          <select required={guided} {...field('role')}>
            {vocab.roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label>Experience level</label>
          <select {...field('experience_level')}>
            {vocab.levels.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>
    </>
  );

  const skills = (
    <Picker options={vocab.skills} selected={form.skills}
            onChange={v => set('skills', v)} />
  );
  const interests = (
    <Picker options={vocab.domains} selected={form.interests}
            onChange={v => set('interests', v)} />
  );

  const dates = (
    <div className="row">
      <div>
        <label>Available from</label>
        <input type="date" required={guided} {...field('available_from')} />
      </div>
      <div>
        <label>Available until</label>
        <input type="date" required={guided} {...field('available_to')} />
      </div>
    </div>
  );

  const hours = (
    <>
      <label>{guided ? 'Hours per week you can give' : 'Hours per week available'}</label>
      <input type="number" min="0" max="80" {...field('hours_per_week')} />
    </>
  );

  const place = (
    <>
      <label>City</label>
      <input type="text" {...field('location')} placeholder="Chennai" />
      <label className="inline-check">
        <input {...check('remote_ok')} /> Open to remote projects</label>
      <label className="inline-check">
        <input {...check('willing_to_travel')} /> Willing to travel for in-person events</label>
      <label className="inline-check">
        <input {...check('open_to_join')} /> Currently open to joining a team</label>
    </>
  );

  const projects = (
    <>
      <div>
        {form.past_projects.map(p => (
          <ProjectRow key={p.uid} project={p} vocab={vocab}
                      onChange={next => setProject(p.uid, next)}
                      onRemove={() => removeProject(p.uid)} />
        ))}
      </div>
      <button type="button" className="ghost" onClick={addProject}>
        {guided ? '+ Add another project' : '+ Add a project'}
      </button>
    </>
  );

  const links = (
    <>
      <label>{guided ? 'GitHub' : 'GitHub URL'}</label>
      <input type="text" {...field('github')} placeholder="https://github.com/…" />
      <label>{guided ? 'LinkedIn' : 'LinkedIn URL'}</label>
      <input type="text" {...field('linkedin')} placeholder="https://linkedin.com/in/…" />
    </>
  );

  const projectsBlurb = guided
    ? `Scored on whether they resemble the work a team needs — the skills
       used and the domain. How far a project got and whether there's a link
       to open both count, so a shipped project with a repo outranks an
       identical-sounding prototype.`
    : `Teams are scored on whether your previous work resembles what they
       need — the skills you used and the domain you worked in. How far it
       got and whether there's a link to open also count, so a shipped
       project with a repo outranks an identical-sounding prototype.`;

  return (
    <form onSubmit={submit}>
      {guided ? (
        <>
          <h2>Who you are</h2>
          {identity}

          <h2>Skills</h2>
          <p className="sub">The single biggest input. Teams are matched to you on the
            skills they're missing, so under-listing costs you matches.</p>
          {skills}

          <h2>Interests</h2>
          <p className="sub">The problems you actually want to work on. This is what
            stops you being matched to a team you'd be bored by.</p>
          {interests}

          <h2>Availability</h2>
          <p className="sub">Teams with events outside your window won't see you at all —
            this is a hard filter, not a score.</p>
          {dates}
          {hours}
          {place}

          <h2>Past projects</h2>
          <p className="sub">{projectsBlurb}</p>
          {projects}

          <h2>Links</h2>
          {links}
        </>
      ) : (
        <>
          {identity}
          <label>Skills</label>
          {skills}
          <label>Interests — the domains you actually want to work in</label>
          {interests}
          {dates}
          {hours}

          <h2>Past projects</h2>
          <p className="sub">{projectsBlurb}</p>
          {projects}

          {place}
          {links}
        </>
      )}

      <div className="actions" style={guided ? { marginTop: 24 } : undefined}>
        <button disabled={submitting}>
          {submitting ? 'Saving…'
            : guided ? 'Finish and see my matches' : 'Save profile'}
        </button>
      </div>
    </form>
  );
}
