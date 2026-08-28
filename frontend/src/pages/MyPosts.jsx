import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post as apiPost } from '../api';
import { postMeta } from '../format';
import { useSession } from '../session';
import { Empty, ExternalLinks } from '../components/bits';
import FoldText from '../components/FoldText';

/* Who is on board, and who is waiting on you. A post is a set of slots, so
   this view is a roster with holes in it rather than a list of posts. */

const JOINED_VIA = {
  applied: 'applied',
  invited: 'you invited them',
  added: 'added',
};

function MemberRow({ slot }) {
  const m = slot.member;
  return (
    <div className="roster-row">
      <div className="grow">
        <strong><Link to={`/users/${m.id}`}>{m.name}</Link></strong>
        <span className="pill filled">{slot.role}</span>
        <div className="meta">
          {[m.experience_level, m.location].filter(Boolean).join(' · ')}
          {' · '}{JOINED_VIA[slot.joined_via] || slot.joined_via}
        </div>
        <div className="meta">
          <ExternalLinks email={m.email} github={m.github} linkedin={m.linkedin} />
        </div>
      </div>
    </div>
  );
}

const OpenRow = ({ slot }) => (
  <div className="roster-row open">
    <div className="grow">
      <strong>{slot.role}</strong>
      <span className="pill">still open</span>
      <div className="meta">
        {(slot.must_have || []).length
          ? `needs ${(slot.must_have || []).join(', ')}`
          : 'no must-haves set'}
      </div>
    </div>
  </div>
);

function OwnedPost({ post, onToggleStatus, busy }) {
  const done = post.filled === post.total_slots && post.total_slots > 0;
  const waiting = post.waiting_count;
  const invited = post.invited_count;

  return (
    <div className="card">
      <div className="card-head">
        <div className="grow">
          <h3><Link to={`/posts/${post.id}`}>{post.title}</Link></h3>
          <div className="meta">{postMeta(post)}</div>
        </div>
        <span className={`pill ${done ? 'filled' : ''}`.trim()}>
          {post.filled}/{post.total_slots} filled{post.status === 'closed' && ' · closed'}
        </span>
      </div>

      <div className="roster">
        {post.slots.filter(s => s.member).map(s => <MemberRow key={s.id} slot={s} />)}
        {post.slots.filter(s => !s.member).map(s => <OpenRow key={s.id} slot={s} />)}
      </div>

      <div className="actions">
        <Link className="btn ghost" to={`/posts/${post.id}`}>
          {waiting
            ? `Review ${waiting} application${waiting > 1 ? 's' : ''}`
            : 'See ranked candidates'}
        </Link>
        <Link className="btn ghost" to={`/posts/${post.id}/edit`}>Edit</Link>
        <button className="danger" disabled={busy}
                onClick={() => onToggleStatus(post)}>
          {post.status === 'open' ? 'Close post' : 'Reopen'}
        </button>
        {invited > 0 && (
          <span className="meta">
            {invited} invite{invited > 1 ? 's' : ''} awaiting a reply
          </span>
        )}
      </div>
    </div>
  );
}

export default function MyPosts() {
  const { refresh } = useSession();
  const [posts, setPosts] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => get('/api/my-posts').then(setPosts), []);
  useEffect(() => { load(); }, [load]);

  async function toggleStatus(post) {
    setBusy(true);
    try {
      await apiPost(`/api/posts/${post.id}/status`, {
        status: post.status === 'open' ? 'closed' : 'open',
      });
      await load();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <h1><FoldText text="My posts" /></h1>
      <p className="sub">The teams you're building, who's on board, and who's waiting
        on you.</p>
      {posts === null ? null : posts.length
        ? posts.map(p => (
            <OwnedPost key={p.id} post={p} onToggleStatus={toggleStatus} busy={busy} />
          ))
        : (
          <Empty>
            You haven't posted anything yet.{' '}
            <Link to="/create">Post a requirement</Link> and the platform will
            rank people for you straight away.
          </Empty>
        )}
    </div>
  );
}
