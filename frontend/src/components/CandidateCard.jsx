import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { post } from '../api';
import CoverageMeter from './CoverageMeter';
import { Breakdown, ExternalLinks, Score, Tags } from './bits';

/* What the owner sees in a ranked list. The reason string and the breakdown
   are the point: a number nobody can interrogate is not credible. */

const CONTACT_LABELS = {
  'invited:pending': 'Invited — waiting on them',
  'invited:accepted': 'Invited · joined the team',
  'invited:declined': 'Invited · they declined',
  'applied:pending': 'They applied — see Applications',
  'applied:accepted': 'On the team',
  'applied:rejected': 'You passed on this one',
};

/* Rendered only for the owner of the post, on a slot that is still open.
   Everywhere else the card is read-only. */
function InviteControl({ candidate, ctx }) {
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  if (!ctx) return null;
  if (candidate.contact_state) {
    return (
      <div className="meta">
        <strong>{CONTACT_LABELS[candidate.contact_state] || candidate.contact_state}</strong>
      </div>
    );
  }

  async function send(e) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await post('/api/invite', {
        post_id: ctx.postId,
        slot_id: ctx.slotId,
        user_id: candidate.user_id,
        note,
      });
      ctx.onInvited?.();
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  }

  return (
    <>
      <form className="invite-form" onSubmit={send}>
        <input type="text" maxLength={500} value={note}
               onChange={e => setNote(e.target.value)}
               placeholder="Add a short message (optional)" />
        <button disabled={sending}>{sending ? 'Sending…' : 'Send invite'}</button>
      </form>
      {error && <div className="meta"><strong>{error}</strong></div>}
    </>
  );
}

function BestProject({ project }) {
  const skills = (project.skills || []).slice(0, 4);
  return (
    <div className="meta" style={{ marginTop: 8 }}>
      Closest past project: <strong>{project.title}</strong>
      {project.outcome && ` · ${project.outcome}`}
      {project.duration && ` · ${project.duration}`}
      {project.link && <> · <a href={project.link} target="_blank" rel="noopener">see it</a></>}
      {skills.length > 0 && <><br />{skills.join(', ')}</>}
    </div>
  );
}

export default function CandidateCard({ candidate: c, ctx }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const toggle = () => setOpen(o => !o);

  return (
    <div className="card">
      <div className="card-head">
        <div className="grow">
          <h3><Link to={`/users/${c.user_id}`}>{c.name}</Link></h3>
          <div className="meta">
            {[c.role, c.experience_level, c.location].filter(Boolean).join(' · ')}
          </div>
          <p className="reason">{c.reason}</p>
        </div>
        <Score value={c.score} open={open} onToggle={toggle} controls={id} />
      </div>

      <CoverageMeter covered={c.covered} missing={c.missing} />
      <Tags must={c.covered || []} missing={c.missing || []} />

      <div className="meta" style={{ marginTop: 10 }}>
        <ExternalLinks github={c.github} linkedin={c.linkedin} />
      </div>

      {c.best_project && <BestProject project={c.best_project} />}
      <Breakdown breakdown={c.breakdown} open={open} id={id} onToggle={toggle} />
      <InviteControl candidate={c} ctx={ctx} />
    </div>
  );
}
