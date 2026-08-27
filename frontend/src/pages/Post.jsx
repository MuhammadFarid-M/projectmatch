import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { get, post as apiPost } from '../api';
import { scoreClass } from '../format';
import { useSession } from '../session';
import CandidateCard from '../components/CandidateCard';
import { Empty, ExternalLinks, Notice, Score, Tags } from '../components/bits';

/* One post, from whichever side you are on.

   The owner gets the ranked candidates for every slot still open, plus the
   people who applied. Everyone else gets the open roles and a way in. Same
   post, same engine, two questions. */

const SlotTags = ({ slot }) =>
  <Tags must={slot.must_have || []} plain={slot.nice_to_have || []} />;

/* ---- owner ------------------------------------------------------------- */

/* Ranked candidates for one open slot. Also shows who was filtered out and
   why: a list that silently drops people is a list you can't trust, and the
   filters are a feature — an unavailable candidate is not a weak match, they
   are the wrong question. */
function SlotMatches({ postId, slot, reloadKey, onInvited }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    setData(null);
    get(`/api/posts/${postId}/slots/${slot.id}/matches?limit=8`)
      .then(d => live && setData(d))
      .catch(e => live && setError(e.message));
    return () => { live = false; };
  }, [postId, slot.id, reloadKey]);

  if (error) return <Empty>{error}</Empty>;
  if (!data) return <Empty>Scoring…</Empty>;

  return (
    <>
      {data.matches.length
        ? data.matches.map(c => (
            <CandidateCard key={c.user_id} candidate={c}
                           ctx={{ postId, slotId: slot.id, onInvited }} />
          ))
        : <Empty>Nobody passes the filters for this slot yet.</Empty>}

      {data.dropped_count > 0 && (
        <div className="dropped">
          <strong>{data.dropped_count} people were filtered out</strong>
          {data.dropped.map((d, i) => <div key={i}>{d.name} — {d.reason}</div>)}
        </div>
      )}
    </>
  );
}

function ApplicationCard({ application: a, onDecide, deciding }) {
  return (
    <div className="card">
      <div className="card-head">
        <div className="grow">
          <h3><Link to={`/users/${a.user_id}`}>{a.name}</Link></h3>
          <div className="meta">{a.slot_role}</div>
          {a.note && <p className="reason">“{a.note}”</p>}
        </div>
        <Score value={a.match_score} />
      </div>
      <div className="meta" style={{ marginTop: 8 }}>
        <ExternalLinks github={a.github} linkedin={a.linkedin} />
        {a.status === 'accepted' && a.email && <><br /><strong>{a.email}</strong></>}
      </div>
      {a.status === 'pending' ? (
        <div className="actions">
          <button disabled={deciding} onClick={() => onDecide(a.id, 'accept')}>Accept</button>
          <button className="danger" disabled={deciding}
                  onClick={() => onDecide(a.id, 'reject')}>Reject</button>
        </div>
      ) : (
        <div className="meta"><strong>{a.status}</strong></div>
      )}
    </div>
  );
}

const INVITE_REPLY = {
  pending: 'awaiting reply',
  accepted: 'accepted your invite',
  declined: 'declined',
};

function OwnerSidebar({ postId, reloadKey, onDecided }) {
  const [apps, setApps] = useState(null);
  const [deciding, setDeciding] = useState(false);

  useEffect(() => {
    let live = true;
    get(`/api/posts/${postId}/applications`)
      .then(d => live && setApps(d))
      .catch(() => live && setApps([]));
    return () => { live = false; };
  }, [postId, reloadKey]);

  async function decide(appId, decision) {
    setDeciding(true);
    try {
      await apiPost(`/api/applications/${appId}/decide`, { decision });
      await onDecided();
    } finally {
      setDeciding(false);
    }
  }

  if (!apps) return null;
  const applied = apps.filter(a => a.direction === 'applied');
  const invited = apps.filter(a => a.direction === 'invited');

  return (
    <>
      <h2>Applications</h2>
      {applied.length
        ? applied.map(a => (
            <ApplicationCard key={a.id} application={a}
                             onDecide={decide} deciding={deciding} />
          ))
        : <Empty>Nobody has applied yet.</Empty>}

      {invited.length > 0 && (
        <>
          <h2>Invites sent</h2>
          {invited.map(a => (
            <div className="card" key={a.id}>
              <div className="card-head">
                <div className="grow">
                  <h3><Link to={`/users/${a.user_id}`}>{a.name}</Link></h3>
                  <div className="meta">
                    {a.slot_role} · {INVITE_REPLY[a.status] || a.status}
                  </div>
                </div>
                <Score value={a.match_score} />
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}

function OwnerView({ post, reloadKey, reload }) {
  return (
    <>
      <div className="actions" style={{ marginBottom: 4 }}>
        <Link className="btn ghost" to={`/posts/${post.id}/edit`}>Edit this post</Link>
      </div>
      <h2>Ranked candidates</h2>
      {post.slots.map(slot => (
        <div className="slot-block" key={slot.id}>
          {slot.filled_by ? (
            <h3>{slot.role} <span className="pill filled">filled</span></h3>
          ) : (
            <>
              <h3>{slot.role}</h3>
              <SlotTags slot={slot} />
              <SlotMatches postId={post.id} slot={slot}
                           reloadKey={reloadKey} onInvited={reload} />
            </>
          )}
        </div>
      ))}
    </>
  );
}

/* ---- everyone else ----------------------------------------------------- */

const APPLIED_STATUS = {
  pending: <><strong>You applied.</strong> Waiting on the organiser.</>,
  rejected: <strong>The organiser passed on this one.</strong>,
  declined: <strong>You declined this invite.</strong>,
};

const Accepted = () => (
  <>
    <div className="status-accepted">
      <span className="emoji" aria-hidden="true">🎉</span>
      you're on this team
    </div>
    <div>Check Activity for contact details.</div>
  </>
);

function ApplyForm({ post, slot, onApplied }) {
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await apiPost('/api/apply', { post_id: post.id, slot_id: slot.id, note });
      await onApplied();
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  }

  return (
    <form style={{ marginTop: 12 }} onSubmit={submit}>
      <label>A line about why you're a fit</label>
      <textarea maxLength={500} value={note} onChange={e => setNote(e.target.value)}
                placeholder="What you'd bring to this team…" />
      <div className="actions">
        <button disabled={sending}>{sending ? 'Sending…' : 'Express interest'}</button>
      </div>
      {error && <div className="meta"><strong>{error}</strong></div>}
    </form>
  );
}

function VisitorView({ post, me, onApplied }) {
  const mine = {};
  (post.my_applications || []).forEach(a => { mine[a.slot_id] = a.status; });
  const open = post.slots.filter(s => !s.filled_by);

  return (
    <>
      <h2>Open roles</h2>
      {open.length ? open.map(slot => (
        <div className="slot-block" key={slot.id}>
          <h3>{slot.role}</h3>
          <SlotTags slot={slot} />
          {mine[slot.id] ? (
            <div className="meta" style={{ marginTop: 12 }}>
              {mine[slot.id] === 'accepted'
                ? <Accepted />
                : APPLIED_STATUS[mine[slot.id]] || <strong>You applied.</strong>}
            </div>
          ) : me ? (
            <ApplyForm post={post} slot={slot} onApplied={onApplied} />
          ) : (
            <div className="meta" style={{ marginTop: 12 }}>
              <Link to="/auth">Sign in</Link> to apply.
            </div>
          )}
        </div>
      )) : <Empty>Every role on this team is filled.</Empty>}
    </>
  );
}

/* ---- the page ---------------------------------------------------------- */

export default function Post() {
  const { id } = useParams();
  const { me, loading, refresh } = useSession();
  const { state } = useLocation();

  const [post, setPost] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(state?.updated
    ? 'Post updated. Pending applicants were rescored.' : null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    const p = await get(`/api/posts/${id}`);
    setPost(p);
    return p;
  }, [id]);

  useEffect(() => {
    // Refetch once the session resolves: is_owner and my_applications both
    // depend on who is asking. Keyed on the id rather than the user object,
    // so refreshing the badge counts doesn't refetch the post as well --
    // reload() already does that when it needs to.
    if (loading) return;
    load().catch(e => setError(e.message));
  }, [load, loading, me?.id]);

  // Anything that changes the roster changes the rankings too — filling a
  // slot shrinks the gap the rest are scored against.
  const reload = useCallback(async () => {
    await load();
    await refresh();
    setReloadKey(k => k + 1);
  }, [load, refresh]);

  if (error) return <div className="wrap"><Empty>{error}</Empty></div>;
  if (!post) return null;

  const spans = [
    post.event_type,
    post.ends_on && post.ends_on !== post.starts_on
      ? `${post.starts_on} → ${post.ends_on}` : post.starts_on,
    post.location && `${post.location}${post.remote_ok ? ' · remote ok' : ''}`,
    `~${post.hours_needed || 0} hrs/week`,
  ].filter(Boolean);

  const header = (
    <>
      {notice && <Notice tone="good">{notice}</Notice>}
      <h1>{post.title}</h1>
      <p className="sub">{spans.join(' · ')}</p>
      <div className="card">
        <p style={{ margin: 0 }}>{post.description}</p>
        <Tags plain={post.domains || []} />
        <div className="meta">
          Posted by {post.owner && <Link to={`/users/${post.owner.id}`}>{post.owner.name}</Link>}
        </div>
      </div>
    </>
  );

  if (!post.is_owner) {
    return (
      <div className="wrap">
        {header}
        <VisitorView post={post} me={me} onApplied={async () => {
          setNotice('Application sent.');
          await reload();
        }} />
      </div>
    );
  }

  return (
    <div className="layout">
      <div>
        {header}
        <OwnerView post={post} reloadKey={reloadKey} reload={reload} />
      </div>
      <aside className="sidebar">
        <OwnerSidebar postId={post.id} reloadKey={reloadKey} onDecided={reload} />
      </aside>
    </div>
  );
}
