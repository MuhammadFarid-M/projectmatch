import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post as apiPost } from '../api';
import { postMeta } from '../format';
import { useSession } from '../session';
import { Empty, Notice, Score } from '../components/bits';
import FoldText from '../components/FoldText';

/* Both halves of the same ledger. An invite and an application are the same
   row in the database, differing only in who started it and therefore who
   decides — so they sit on one page, split by who is waiting on whom. */

const INVITE_STATUS = {
  accepted: 'You joined this team.',
  declined: 'You declined this invite.',
};

const APP_STATUS = {
  pending: 'waiting on the organiser',
  accepted: 'accepted — you are on the team',
  rejected: 'the organiser passed',
};

const Celebrate = ({ children }) => (
  <div className="status-accepted">
    <span className="emoji" aria-hidden="true">🎉</span>
    {children}
  </div>
);

function InviteCard({ invite: v, onRespond, busy }) {
  const pending = v.status === 'pending';
  return (
    <div className={`card invite-card ${pending ? '' : 'done'}`.trim()}>
      <div className="card-head">
        <div className="grow">
          <h3><Link to={`/posts/${v.post_id}`}>{v.title}</Link></h3>
          <div className="meta">
            Invited by <Link to={`/users/${v.owner_id}`}>{v.owner_name}</Link>
            {' for '}<strong>{v.slot_role}</strong>
          </div>
          <div className="meta">{postMeta(v)}</div>
          {v.note && <p className="reason">“{v.note}”</p>}
        </div>
        <Score value={v.match_score} />
      </div>

      {pending ? (
        <div className="actions">
          <button disabled={busy} onClick={() => onRespond(v.id, 'accept')}>
            Accept invite
          </button>
          <button className="danger" disabled={busy}
                  onClick={() => onRespond(v.id, 'decline')}>
            Decline
          </button>
        </div>
      ) : v.status === 'accepted' ? (
        <div className="meta"><Celebrate>you're on the team</Celebrate></div>
      ) : (
        <div className="meta"><strong>{INVITE_STATUS[v.status] || v.status}</strong></div>
      )}
    </div>
  );
}

const ApplicationCard = ({ application: a }) => (
  <div className={`card ${a.status === 'accepted' ? 'invite-card' : ''}`.trim()}>
    <div className="card-head">
      <div className="grow">
        <h3><Link to={`/posts/${a.post_id}`}>{a.title}</Link></h3>
        <div className="meta">
          Applied for <strong>{a.slot_role}</strong> · posted by{' '}
          <Link to={`/users/${a.owner_id}`}>{a.owner_name}</Link>
        </div>
        <div className="meta">{postMeta(a)}</div>
        {a.note && <p className="reason">You wrote: “{a.note}”</p>}
        <div className="meta" style={{ marginTop: 8 }}>
          {a.status === 'accepted'
            ? <Celebrate>accepted — you're on the team</Celebrate>
            : <strong>{APP_STATUS[a.status] || a.status}</strong>}
          {a.owner_email && <div>organiser: <strong>{a.owner_email}</strong></div>}
        </div>
      </div>
      <Score value={a.match_score} />
    </div>
  </div>
);

export default function Activity() {
  const { refresh } = useSession();
  const [invites, setInvites] = useState(null);
  const [apps, setApps] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    // Fetching /api/my-applications is what marks decisions as seen, which
    // clears the nav badge — the same thing an inbox does when you open it.
    const [i, a] = await Promise.all([get('/api/invites'), get('/api/my-applications')]);
    setInvites(i);
    setApps(a);
    await refresh();
  }, [refresh]);

  useEffect(() => { load(); }, [load]);

  async function respond(inviteId, decision) {
    setBusy(true);
    try {
      await apiPost(`/api/invitations/${inviteId}/respond`, { decision });
      setNotice('Response sent.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <h1><FoldText text="Activity" /></h1>
      <p className="sub">Invites teams sent you, and what happened to the applications
        you sent them.</p>
      {notice && <Notice tone="good">{notice}</Notice>}

      <h2>Invites you've received</h2>
      {invites === null ? null : invites.length
        ? invites.map(v => (
            <InviteCard key={v.id} invite={v} onRespond={respond} busy={busy} />
          ))
        : (
          <Empty>
            No invites yet. Keeping your skills and availability current is what
            puts you in front of teams.
          </Empty>
        )}

      <h2>Your applications</h2>
      {apps === null ? null : apps.length
        ? apps.map(a => <ApplicationCard key={a.id} application={a} />)
        : <Empty>You have not applied to anything yet.</Empty>}
    </div>
  );
}
